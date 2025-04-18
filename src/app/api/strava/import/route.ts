import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { head, del } from '@vercel/blob'
import { getDatabase } from '@/lib/db/mongodb'
import extract from 'extract-zip';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Client } from "@upstash/qstash"; // Import QStash client

// Keep runtime (Node.js needed for streaming and ZIP handling)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Adjusted for potentially longer queuing setup?

export async function POST(request: NextRequest) {
  let blobUrlToDelete: string | null = null;

  try {
    console.log('=== Starting Strava import process (from Blob Storage) ===');
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    console.log('User authenticated:', userId);

    const body = await request.json();
    const blobPathname = body.blobPathname;
    const originalFilename = body.originalFilename;
    if (!blobPathname || typeof blobPathname !== 'string') {
      return NextResponse.json({ success: false, error: "Missing blobPathname" }, { status: 400 });
    }
    if (!blobPathname.startsWith(`strava-imports/${userId}/`)) {
        return NextResponse.json({ success: false, error: "Unauthorized access to blob" }, { status: 403 });
    }

    console.log('Processing file from blob storage:', { blobPathname, originalFilename });
    const blobHead = await head(blobPathname);
    if (!blobHead || !blobHead.url) {
        try { await del(blobPathname); } catch {} 
        return NextResponse.json({ success: false, error: "Uploaded file not found in storage." }, { status: 404 });
    }
    blobUrlToDelete = blobHead.url;
    if (blobHead.size <= 1) { // Allow size 1 as placeholder might not be exactly 1
        try { await del(blobUrlToDelete); } catch {} 
        return NextResponse.json({ success: false, error: "File upload seems to have failed or is empty." }, { status: 400 });
    }

    const blobResponse = await fetch(blobHead.url);
    if (!blobResponse.ok) {
        return NextResponse.json({ success: false, error: `Failed to download file from storage (status ${blobResponse.status})` }, { status: 500 });
    }
    const arrayBuffer = await blobResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('File buffer size from blob:', buffer.length);

    const tempFilePath = path.join(os.tmpdir(), `strava-import-${uuidv4()}.zip`);
    await fs.writeFile(tempFilePath, buffer);
    console.log(`Saved ZIP file to temp location: ${tempFilePath}`);
    
    try {
        const results = await processZipFileMoreReliably(tempFilePath, originalFilename || null, blobPathname, userId); // Pass userId
        
        // Do NOT delete the blob here anymore. Deletion should happen after processing.
        // try {
        //     if (blobUrlToDelete) await del(blobUrlToDelete);
        // } catch (deleteError) { ... }

        try {
            await fs.unlink(tempFilePath);
            console.log('Temporary ZIP file deleted.');
        } catch (cleanupError) {
            console.error('Failed to clean up temporary ZIP file:', cleanupError);
        }

        return NextResponse.json({ success: true, ...results }); // Return results from processZipFileMoreReliably

    } catch (zipError) {
        console.error('Failed to process ZIP file:', zipError);
        try { await fs.unlink(tempFilePath); } catch {} 
        const errorMsg = (zipError instanceof Error && zipError.message?.includes('EOF'))
            ? "The ZIP file appears to be corrupted or incomplete. Please try downloading the archive from Strava again."
            : "Failed to process ZIP archive.";
        return NextResponse.json({ success: false, error: errorMsg, details: zipError instanceof Error ? zipError.message : undefined }, { status: 400 });
    }

  } catch (error) {
    console.error("Strava import error (Blob Storage):", error);
    // Attempt to delete the blob only if it hasn't been queued successfully
    // if (blobUrlToDelete && /* check if queuing failed based on error type? */) { ... }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to process Strava archive.", details: error instanceof Error ? error.stack : undefined }, { status: 500 });
  }
}

// processZipFileMoreReliably function orchestrates extraction and queuing
async function processZipFileMoreReliably(zipFilePath: string, originalFilename: string | null, blobPathname: string, userId: string): Promise<any> {
  console.log('Processing Strava ZIP file with extract-zip for better nested folder support');
  const processingId = uuidv4();
  const tempDir = path.join(os.tmpdir(), `strava-import-${processingId}`);
  console.log(`Creating temp directory for extraction: ${tempDir}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    console.log(`Extracting ZIP file to: ${tempDir}`);
    await extract(zipFilePath, { dir: tempDir });
    console.log('ZIP extraction complete');
    
    const resultsSummary = { gpxFilesFound: 0, fitFilesFound: 0, fitGzFilesFound: 0, tcxFilesFound: 0 };
    const allFiles: string[] = await getFilesRecursively(tempDir);
    console.log(`Found ${allFiles.length} total files in extracted ZIP`);
    
    const activityFiles = allFiles.filter(file => {
      const lowerFile = file.toLowerCase();
      const normalizedPath = lowerFile.replace(/\\/g, '/');
      if (normalizedPath.includes('/routes/') || normalizedPath.includes('\\routes\\')) return false;
      const isActivityExt = lowerFile.endsWith('.gpx') || lowerFile.endsWith('.fit') || lowerFile.endsWith('.fit.gz') || lowerFile.endsWith('.tcx');
      const isInActivitiesDir = normalizedPath.includes('/activities/') || normalizedPath.includes('\\activities\\');
      const isRootActivity = !normalizedPath.includes('/') && isActivityExt;
      if (isActivityExt) {
          if (lowerFile.endsWith('.gpx')) resultsSummary.gpxFilesFound++;
          else if (lowerFile.endsWith('.fit.gz')) resultsSummary.fitGzFilesFound++;
          else if (lowerFile.endsWith('.fit')) resultsSummary.fitFilesFound++;
          else if (lowerFile.endsWith('.tcx')) resultsSummary.tcxFilesFound++;
      }
      return (isInActivitiesDir && isActivityExt) || isRootActivity;
    });
    
    console.log(`Found ${activityFiles.length} potential activity files after filtering`);
    const totalFiles = activityFiles.length;

    if (totalFiles === 0) {
        console.warn("No activity files found in the extracted archive.");
        // Clean up the temporary directory as it's not needed
        try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
        return {
            processingId: null, // No ID needed if no files
            totalFiles: 0,
            message: "No activity files (.fit, .gpx, .tcx) found in the provided archive."
        }
    }
    
    const processingState = {
      processingId, userId, status: 'pending', createdAt: new Date(), lastUpdated: new Date(),
      activityFiles: activityFiles.map(file => path.relative(tempDir, file)),
      processedFiles: [] as string[], importedFiles: [] as string[], errorFiles: [] as string[],
      totalFiles: totalFiles, originalFilename: originalFilename || 'strava-export.zip',
      blobPathname: blobPathname
    };
    
    try {
      const db = await getDatabase();
      await db.collection('strava_import_state').insertOne(processingState);
      console.log('Saved initial processing state to MongoDB');
    } catch (dbError) {
      console.error('Error saving processing state to MongoDB:', dbError);
      try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
      throw new Error('Failed to save processing state to database: ' + (dbError instanceof Error ? dbError.message : String(dbError)));
    }

    console.log(`Enqueuing ${totalFiles} jobs via QStash for processingId: ${processingId}`);
    const qstashClient = new Client({ token: process.env.QSTASH_TOKEN! });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL;
    if (!appUrl) {
        console.error('Error: NEXT_PUBLIC_APP_URL or VERCEL_URL environment variable not set.');
        try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
        throw new Error('Application URL environment variable not configured.');
    }
    const workerBaseUrl = appUrl.startsWith('http') ? appUrl : `https://${appUrl}`;
    const workerUrl = `${workerBaseUrl}/api/strava/process-activity`;
    console.log(`Worker URL target: ${workerUrl}`);

    let enqueuedCount = 0;
    let failedEnqueueFiles: string[] = [];
    const batchSize = 100; 
    for (let i = 0; i < processingState.activityFiles.length; i += batchSize) {
        const batchFilePaths = processingState.activityFiles.slice(i, i + batchSize);
        const messagesToEnqueue = batchFilePaths.map(activityFilePath => ({
            url: workerUrl,
            body: JSON.stringify({ processingId, userId, blobPathname, activityFileRelativePath: activityFilePath }),
            headers: { 'content-type': 'application/json' }
        }));
        try {
            const responses = await qstashClient.batchJSON(messagesToEnqueue);
            responses.forEach((response, index) => {
                if ('messageId' in response && response.messageId) enqueuedCount++;
                else if ('error' in response && response.error) failedEnqueueFiles.push(batchFilePaths[index]);
                else failedEnqueueFiles.push(batchFilePaths[index]); // Treat unexpected as failure
            });
        } catch (batchEnqueueError) {
            console.error(`Failed to enqueue QStash batch starting at index ${i}:`, batchEnqueueError);
            failedEnqueueFiles.push(...batchFilePaths);
        }
    }

    console.log(`Successfully enqueued ${enqueuedCount} / ${totalFiles} jobs via QStash.`);
    let finalStatus = 'queued';
    if (failedEnqueueFiles.length > 0) {
       console.warn(`Failed to enqueue ${failedEnqueueFiles.length} jobs.`);
       finalStatus = (enqueuedCount === 0) ? 'enqueue_failed' : 'queued_with_errors';
    }

    try {
      const db = await getDatabase();
      await db.collection('strava_import_state').updateOne(
        { processingId: processingId },
        { $set: { status: finalStatus, errorFiles: failedEnqueueFiles, lastUpdated: new Date() } }
      );
      console.log(`Updated processing state status to ${finalStatus} in MongoDB`);
    } catch (dbUpdateError) {
      console.error(`Failed to update DB status after QStash enqueue attempt:`, dbUpdateError);
    }

    // Don't delete tempDir here - the worker needs the state file initially?
    // No, state is in DB now. We *can* delete tempDir.
    try {
      console.log(`Cleaning up temp directory: ${tempDir}`);
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error(`Failed to cleanup temp directory ${tempDir}:`, cleanupError);
      // Log error but don't fail the overall process
    }

    return {
      processingId: processingId,
      totalFiles: totalFiles,
      message: `${enqueuedCount}/${totalFiles} activity processing jobs queued.`,
      fileTypes: resultsSummary
    };

  } catch (error) {
    console.error('Error in processZipFileMoreReliably:', error);
    try { await fs.rm(tempDir, { recursive: true, force: true }); } catch {}
    throw error; // Re-throw error to be caught by POST handler
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