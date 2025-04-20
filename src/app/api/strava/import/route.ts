import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { head, del, put } from '@vercel/blob'
import { getDatabase } from '@/lib/db/mongodb'
import dbConnect from '@/lib/db/mongoose'
import extract from 'extract-zip';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime';
import { processFitFile, processGpxFile, processTcxFile, ProcessedActivityData } from '@/lib/services/stravaArchiveService';
import { transformStravaActivity } from '@/lib/services/stravaService';
import { createCardioWorkout, updateUserWorkoutSummaries } from '@/lib/workout-actions';
import { promisify } from 'util';
import { gunzip as gunzipCb } from 'zlib';

// --- Interface for Summary Stats --- START
interface ImportStats {
  count: number;
  types: Record<string, number>;
  earliestDate: string | null;
  latestDate: string | null;
  totalDistance: number; // Assuming meters initially, convert later if needed
  totalDuration: number; // Assuming seconds
}
// --- Interface for Summary Stats --- END

// Keep runtime (Node.js needed for streaming and ZIP handling)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes

const gunzipAsync = promisify(gunzipCb);

export async function POST(request: NextRequest) {
  let blobUrlToDelete: string | null = null;
  let tempDir: string | null = null; // Track temp dir for cleanup
  let tempZipPath: string | null = null; // Track temp zip for cleanup

  try {
    console.log('=== Starting Strava import process (SYNCHRONOUS) ===');
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    console.log('User authenticated:', userId);

    // Ensure DB connection is ready before starting
    await dbConnect();
    console.log('Initial DB connection established.');

    const body = await request.json();
    const blobPathname = body.blobPathname;
    const blobUrl = body.blobUrl; // Get the URL
    const originalFilename = body.originalFilename;
    if (!blobPathname || typeof blobPathname !== 'string') {
      return NextResponse.json({ success: false, error: "Missing blobPathname" }, { status: 400 });
    }
    if (!blobUrl || typeof blobUrl !== 'string') { // Add check for URL
        return NextResponse.json({ success: false, error: "Missing blobUrl" }, { status: 400 });
    }
    if (!blobPathname.startsWith(`strava-imports/${userId}/`)) {
        return NextResponse.json({ success: false, error: "Unauthorized access to blob" }, { status: 403 });
    }

    // --- Download Blob --- 
    console.log('Processing file from blob storage:', { blobPathname, blobUrl, originalFilename });
    blobUrlToDelete = blobPathname; // Store original pathname for deletion
    
    console.log(`[Import API] Attempting to fetch blob directly from URL: ${blobUrl}`);
    const blobResponse = await fetch(blobUrl);
    if (!blobResponse.ok) {
        // If fetch fails, try deleting the blob entry if it exists
        try { await del(blobPathname); } catch {}
        return NextResponse.json({ success: false, error: `Failed to download file from storage (status ${blobResponse.status})` }, { status: 500 });
    }
    const arrayBuffer = await blobResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Basic size check after download
    if (buffer.length <= 1) {
        try { await del(blobUrlToDelete); } catch {} 
        return NextResponse.json({ success: false, error: "File upload seems to have failed or is empty." }, { status: 400 });
    }
    console.log('File buffer size from blob URL:', buffer.length);

    // --- Save to Temp ZIP --- 
    tempZipPath = path.join(os.tmpdir(), `strava-import-${uuidv4()}.zip`);
    await fs.writeFile(tempZipPath, buffer);
    console.log(`Saved ZIP file to temp location: ${tempZipPath}`);
    
    // --- Extract ZIP --- 
    tempDir = path.join(os.tmpdir(), `strava-import-${uuidv4()}`);
    console.log(`Creating temp directory for extraction: ${tempDir}`);
    await fs.mkdir(tempDir, { recursive: true });
    try {
      console.log(`Extracting ZIP file to: ${tempDir}`);
      await extract(tempZipPath, { dir: tempDir });
      console.log('ZIP extraction complete');
    } catch (zipError) {
       console.error('Failed to process ZIP file:', zipError);
       const errorMsg = (zipError instanceof Error && zipError.message?.includes('EOF'))
           ? "The ZIP file appears to be corrupted or incomplete. Please try downloading the archive from Strava again."
           : "Failed to process ZIP archive.";
       throw new Error(errorMsg); // Throw to be caught by outer catch
    }

    // --- Find Activity Files --- 
    const resultsSummary = { gpxFilesFound: 0, fitFilesFound: 0, fitGzFilesFound: 0, tcxFilesFound: 0 };
    const allFiles: string[] = await getFilesRecursively(tempDir);
    console.log(`Found ${allFiles.length} total files in extracted ZIP`);
    const activityFilesAbsolutePaths = allFiles.filter(absolutePath => {
      const lowerFile = absolutePath.toLowerCase();
      const normalizedPath = lowerFile.replace(/\\/g, '/');
      const relativePath = path.relative(tempDir!, absolutePath).toLowerCase().replace(/\\/g, '/'); // Use tempDir!
      if (relativePath.includes('routes/')) return false; 
      const isActivityExt = lowerFile.endsWith('.gpx') || lowerFile.endsWith('.fit') || lowerFile.endsWith('.fit.gz') || lowerFile.endsWith('.tcx');
      const isInActivitiesDir = relativePath.includes('activities/');
      const isRootActivity = !relativePath.includes('/') && isActivityExt; 
      if (isActivityExt && (isInActivitiesDir || isRootActivity)) {
          if (lowerFile.endsWith('.gpx')) resultsSummary.gpxFilesFound++;
          else if (lowerFile.endsWith('.fit.gz')) resultsSummary.fitGzFilesFound++;
          else if (lowerFile.endsWith('.fit')) resultsSummary.fitFilesFound++;
          else if (lowerFile.endsWith('.tcx')) resultsSummary.tcxFilesFound++;
          return true;
      }
      return false;
    });
    const totalFiles = activityFilesAbsolutePaths.length;
    console.log(`Found ${totalFiles} potential activity files after filtering`);
    if (totalFiles === 0) {
        console.warn("No activity files found in the extracted archive.");
        // Cleanup handled in finally block
        return NextResponse.json({ success: true, totalFiles: 0, message: "No activity files (.fit, .gpx, .tcx) found." });
    }

    // --- SYNCHRONOUS PROCESSING LOOP --- START
    const processingResults = {
        successCount: 0,
        errorCount: 0,
        errors: [] as { file: string; error: string }[],
        // --- Add summary stats tracking --- START
        summaryStats: {
          count: 0,
          types: {},
          earliestDate: null,
          latestDate: null,
          totalDistance: 0,
          totalDuration: 0,
        } as ImportStats
        // --- Add summary stats tracking --- END
    };
    
    console.log(`Starting synchronous processing of ${totalFiles} files...`);
    for (const absolutePath of activityFilesAbsolutePaths) {
        const relativePath = path.relative(tempDir!, absolutePath); // Use tempDir!
        console.log(`--- Processing file: ${relativePath} ---`);
        try {
            let fileContent = await fs.readFile(absolutePath);
            const lowerFilePath = absolutePath.toLowerCase();
            let isGzipped = false;
            let actualFileType = lowerFilePath;

            // Decompress if necessary
            if (lowerFilePath.endsWith('.gz')) {
                console.log(`Decompressing: ${relativePath}`);
                fileContent = await gunzipAsync(fileContent);
                isGzipped = true;
                actualFileType = lowerFilePath.slice(0, -3);
                console.log(`Decompressed size: ${fileContent.length} bytes`);
            }

            // Parse file content
            let parsedData: ProcessedActivityData | null = null;
            const fileNameForProcessing = relativePath; 
            if (actualFileType.endsWith('.fit')) {
                console.log(`Parsing as FIT: ${fileNameForProcessing}`);
                parsedData = await processFitFile(fileContent, fileNameForProcessing);
            } else if (actualFileType.endsWith('.gpx')) {
                 console.log(`Parsing as GPX: ${fileNameForProcessing}`);
                 parsedData = await processGpxFile(fileContent, fileNameForProcessing);
            } else if (actualFileType.endsWith('.tcx')) {
                 console.log(`Parsing as TCX: ${fileNameForProcessing}`);
                 parsedData = await processTcxFile(fileContent, fileNameForProcessing);
            } else {
                 console.warn(`Unsupported file type skipped: ${fileNameForProcessing}`);
                 // Consider how to count skipped vs errors
                 continue; // Skip to next file
            }

            if (!parsedData) {
                console.warn(`File processing returned no data for: ${fileNameForProcessing}`);
                throw new Error('File parsing returned no data.');
            }

            // Transform data
            console.log(`Transforming activity data for: ${fileNameForProcessing}`);
            const transformedData = transformStravaActivity(parsedData);

            // Save workout
            console.log(`Saving workout to DB for user ${userId}, file: ${fileNameForProcessing}`);
            const workoutInput = { userId: userId, ...transformedData };
            // Use createCardioWorkout as it handles finding/creating Exercise etc.
            const createdWorkout = await createCardioWorkout(workoutInput); 
            if (!createdWorkout) {
                throw new Error('Workout creation function returned undefined or null.');
            }
            console.log(`Successfully saved workout ID: ${createdWorkout._id} from file: ${fileNameForProcessing}`);
            processingResults.successCount++;

            // --- Update Summary Stats --- START
            const stats = processingResults.summaryStats;
            stats.count++;
            const workoutType = transformedData.type || 'other';
            stats.types[workoutType] = (stats.types[workoutType] || 0) + 1;
            
            // --- Log distance before aggregation --- START
            console.log(`[Summary Aggregation] Adding distance: ${transformedData.distance} km from file: ${fileNameForProcessing}`);
            // --- Log distance before aggregation --- END

            // Aggregate distance directly in KM
            stats.totalDistance += (transformedData.distance || 0);
            stats.totalDuration += transformedData.duration || 0; // duration is already in seconds
            
            const workoutDate = transformedData.date; // Use \'date\' property (Date object or null)
            if (workoutDate) {
                const workoutDateStr = workoutDate.toISOString();
                if (!stats.earliestDate || workoutDateStr < stats.earliestDate) {
                    stats.earliestDate = workoutDateStr;
                }
                if (!stats.latestDate || workoutDateStr > stats.latestDate) {
                    stats.latestDate = workoutDateStr;
                }
            }
            // --- Update Summary Stats --- END

        } catch (error: any) {
            console.error(`!!! Error processing file ${relativePath}:`, error);
            processingResults.errorCount++;
            processingResults.errors.push({ file: relativePath, error: error.message || String(error) });
            // Continue to the next file even if one fails
        }
        console.log(`--- Finished processing file: ${relativePath} ---`);
    }
    // --- SYNCHRONOUS PROCESSING LOOP --- END

    // --- Update User Summaries and Overall PRs ---
    try {
      console.log(`[Strava Import] Starting summary update for user: ${userId}`);
      await updateUserWorkoutSummaries(userId);
      console.log(`[Strava Import] Finished summary update for user: ${userId}`);
    } catch (summaryError) {
      console.error(`[Strava Import] Error updating summaries for user ${userId} after import:`, summaryError);
      // Log the error but don't fail the import process
    }
    // --- End Summary Update ---

    // --- Final Actions --- 
    // Delete original archive blob from storage
    if (blobUrlToDelete) {
        try {
            console.log(`Deleting original archive blob: ${blobUrlToDelete}`);
            await del(blobUrlToDelete);
            console.log("Original archive blob deleted.");
        } catch (deleteError) {
            console.error(`Failed to delete original archive blob ${blobUrlToDelete}:`, deleteError);
            // Log error but don't fail the response
        }
    }
    
    // Cleanup handled in finally block
    const finalMessage = `Import finished. Imported: ${processingResults.successCount}, Errors: ${processingResults.errorCount}.`;
    console.log(finalMessage);
    return NextResponse.json({ 
        success: true, 
        message: finalMessage,
        importedCount: processingResults.successCount,
        errorCount: processingResults.errorCount,
        totalFiles: totalFiles,
        errors: processingResults.errors, // Include detailed errors
        fileTypes: resultsSummary,
        summary: processingResults.summaryStats // RETURN SUMMARY STATS
    });

  } catch (error) {
    console.error("Strava import error (Synchronous):", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to process Strava archive.", details: error instanceof Error ? error.stack : undefined }, { status: 500 });
  } finally {
     // --- Cleanup Temp Directory --- 
    if (tempDir) {
        try {
          console.log(`Attempting cleanup of temp extraction directory: ${tempDir}`);
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log("Temp directory cleaned up.");
        } catch (cleanupError) {
          console.error(`Failed to cleanup temp directory ${tempDir}:`, cleanupError);
        }
    }
    // --- Cleanup Temp ZIP File --- 
    if (tempZipPath) {
        try {
            await fs.unlink(tempZipPath);
            console.log('Temporary ZIP file deleted.');
        } catch (cleanupError) {
            console.error('Failed to clean up temporary ZIP file:', cleanupError);
        }
    }
  }
}

// getFilesRecursively function used by processZipFileMoreReliably
async function getFilesRecursively(dir: string): Promise<string[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFilesRecursively(res) : res;
  }));
  return Array.prototype.concat(...files);
}