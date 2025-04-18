import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { getDatabase } from '@/lib/db/mongodb';
import { head, del } from '@vercel/blob';
import yauzl from 'yauzl';
import { promisify } from 'util';
import { gunzip as gunzipCb } from 'zlib';
import { Buffer } from 'buffer'; // Ensure Buffer is available
import { processFitFile, processGpxFile } from '@/lib/services/stravaArchiveService';
import { transformStravaActivity } from '@/lib/services/stravaService'; // Assuming this exists
import { createCardioWorkout } from '@/lib/workout-actions'; // Assuming this exists

// Keep runtime Node.js for file system/zip access if needed for yauzl buffer handling
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Promisify gunzip
const gunzipAsync = promisify(gunzipCb);

// QStash Receiver for signature verification
const qstashReceiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!, 
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

// Helper function to open a ZIP file from a buffer using promises
function openZipFromBuffer(buffer: Buffer): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) return reject(err || new Error('Failed to open ZIP file'));
      resolve(zipfile);
    });
  });
}

// Helper function to find and read a specific entry from a ZIP file buffer
async function findAndReadEntryAsync(zipBuffer: Buffer, targetFileName: string): Promise<Buffer | null> {
    console.log(`Attempting to find and read entry: ${targetFileName}`);
    const zipfile = await openZipFromBuffer(zipBuffer);
    
    return new Promise((resolve, reject) => {
        let foundEntry: yauzl.Entry | null = null;

        zipfile.on('entry', (entry: yauzl.Entry) => {
            // Normalize path separators
            const normalizedEntryName = entry.fileName.replace(/\\/g, '/');
            const normalizedTargetName = targetFileName.replace(/\\/g, '/');
            // console.log(`Checking entry: ${normalizedEntryName}`); // Verbose logging
            
            // Check if this entry matches the target file path (case-insensitive recommended)
            if (normalizedEntryName.toLowerCase() === normalizedTargetName.toLowerCase()) {
                console.log(`Found matching entry: ${entry.fileName}`);
                foundEntry = entry;
                // Stop reading further entries once found
                // Note: yauzl might not have a direct 'stop' method, but we can handle it logicall
            } else if (foundEntry === null) {
                 // Read next entry only if target not found yet
                zipfile.readEntry();
            }
        });

        zipfile.on('end', () => {
            if (foundEntry) {
                console.log(`Opening read stream for found entry: ${foundEntry.fileName}`);
                zipfile.openReadStream(foundEntry, (err, readStream) => {
                    if (err) return reject(err);
                    if (!readStream) return reject(new Error('Failed to open read stream for found entry'));

                    const chunks: Buffer[] = [];
                    readStream.on('data', (chunk) => chunks.push(chunk));
                    readStream.on('end', () => {
                         console.log(`Successfully read buffer for ${foundEntry?.fileName}`);
                         resolve(Buffer.concat(chunks));
                    });
                    readStream.on('error', reject);
                });
            } else {
                console.warn(`Target entry "${targetFileName}" not found in the archive.`);
                resolve(null); // Resolve with null if entry not found
            }
        });

        zipfile.on('error', reject);

        // Start reading entries
        zipfile.readEntry();
    });
}

async function handler(req: NextRequest) {
    console.log("--- Strava Process Activity Job Received ---");
    let processingId: string | null = null;
    let activityFileRelativePath: string | null = null;

    // 1. Verify QStash Signature
    const signature = req.headers.get("upstash-signature");
    if (!signature) {
        console.error("Missing Upstash-Signature header");
        return new NextResponse("Signature required", { status: 401 });
    }
    
    const requestBodyString = await req.text(); // Read body as text ONCE for verification
    const isValid = await qstashReceiver.verify({ signature, body: requestBodyString });

    if (!isValid) {
        console.error("Invalid QStash signature");
        return new NextResponse("Invalid signature", { status: 401 });
    }
    console.log("QStash signature verified successfully.");

    // --- Continue with processing --- 
    try {
        // Parse the body *after* verification
        const body = JSON.parse(requestBodyString); 
        processingId = body.processingId;
        const userId = body.userId;
        const blobPathname = body.blobPathname;
        activityFileRelativePath = body.activityFileRelativePath;

        if (!processingId || !userId || !blobPathname || !activityFileRelativePath) {
            console.error("Missing required fields in job payload:", body);
            return NextResponse.json({ success: false, error: "Invalid job payload" }, { status: 400 });
        }

        console.log("Processing job:", { processingId, userId, activityFileRelativePath });

        // 1. Fetch processing state from MongoDB
        const db = await getDatabase();
        const state = await db.collection('strava_import_state').findOne({ processingId: processingId, userId: userId });

        if (!state) {
            console.error(`Processing state not found for ID: ${processingId}`);
            // TODO: Decide if this is a permanent failure or should be retried by QStash
            return NextResponse.json({ success: false, error: "Processing state not found" }, { status: 404 }); // 404 might prevent retries
        }

        if (state.status === 'completed' || state.status === 'failed') {
             console.log(`Skipping job for already completed/failed batch: ${processingId}, status: ${state.status}`);
             return NextResponse.json({ success: true, message: "Batch already completed or failed" });
        }

        // Check if this specific file has already been processed or errored
        if (state.processedFiles?.includes(activityFileRelativePath) || state.errorFiles?.includes(activityFileRelativePath)) {
             console.log(`Skipping already processed/errored file: ${activityFileRelativePath} in batch: ${processingId}`);
             return NextResponse.json({ success: true, message: "File already processed or errored" });
        }

        // 2. Download original archive blob
        console.log(`Downloading archive blob: ${blobPathname}`);
        const blobHead = await head(blobPathname);
        if (!blobHead || !blobHead.url) {
             console.error(`Original archive blob not found: ${blobPathname}`);
             await db.collection('strava_import_state').updateOne(
                 { processingId: processingId },
                 { $set: { status: 'failed', error: 'Original archive blob missing', lastUpdated: new Date() } }
             );
             return NextResponse.json({ success: false, error: "Original archive blob missing" }, { status: 404 });
        }
        const blobResponse = await fetch(blobHead.url);
        if (!blobResponse.ok) {
             console.error(`Failed to download archive blob: ${blobPathname} (Status: ${blobResponse.status})`);
             // Don't fail the whole batch state, maybe just this file? Or allow retry?
             return NextResponse.json({ success: false, error: "Failed to download archive blob" }, { status: 502 }); // Allows QStash retry
        }
        const archiveBuffer = Buffer.from(await blobResponse.arrayBuffer());
        console.log(`Downloaded archive (${archiveBuffer.length} bytes)`);

        // 3. Extract the specific activity file buffer
        let fileBuffer = await findAndReadEntryAsync(archiveBuffer, activityFileRelativePath);

        if (!fileBuffer) {
            console.error(`Failed to extract file "${activityFileRelativePath}" from archive: ${blobPathname}`);
             await db.collection('strava_import_state').updateOne(
                { processingId: processingId },
                { $push: { errorFiles: activityFileRelativePath as any }, $set: { lastUpdated: new Date() } }
             );
             // Consider this a success for QStash (job attempted), but record file error
             return NextResponse.json({ success: true, error: `File not found in archive: ${activityFileRelativePath}` });
        }
        
        console.log(`Extracted file buffer (${fileBuffer.length} bytes) for: ${activityFileRelativePath}`);
        
        // Check if file needs decompression (.gz)
        const lowerFilePath = activityFileRelativePath.toLowerCase();
        let isGzipped = false;
        if (lowerFilePath.endsWith('.gz')) {
            console.log(`Decompressing gzipped file: ${activityFileRelativePath}`);
            try {
                 fileBuffer = await gunzipAsync(fileBuffer);
                 isGzipped = true;
                 console.log(`Decompressed buffer size: ${fileBuffer.length} bytes`);
            } catch (unzipError) {
                console.error(`Failed to decompress file ${activityFileRelativePath}:`, unzipError);
                await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { errorFiles: activityFileRelativePath as any }, $set: { lastUpdated: new Date() } }
                );
                return NextResponse.json({ success: true, error: `Failed to decompress file: ${activityFileRelativePath}` });
            }
        }

        // Determine actual file type for processing
        const actualFilePath = isGzipped ? lowerFilePath.slice(0, -3) : lowerFilePath; // remove .gz if needed
        
        // 4. Process the extracted file buffer
        let processedActivityData: any = null;
        try {
            if (actualFilePath.endsWith('.fit')) {
                console.log(`Processing as FIT file: ${activityFileRelativePath}`);
                processedActivityData = await processFitFile(fileBuffer, activityFileRelativePath);
            } else if (actualFilePath.endsWith('.gpx')) {
                 console.log(`Processing as GPX file: ${activityFileRelativePath}`);
                 processedActivityData = await processGpxFile(fileBuffer, activityFileRelativePath);
            } else if (actualFilePath.endsWith('.tcx')) {
                 console.warn(`TCX file processing not yet implemented, skipping: ${activityFileRelativePath}`);
                 // Mark as processed but not imported
                 await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { processedFiles: activityFileRelativePath as any }, $set: { lastUpdated: new Date() } }
                 );
                 return NextResponse.json({ success: true, message: `TCX processing skipped for ${activityFileRelativePath}` });
            } else {
                 console.warn(`Unsupported file type skipped: ${activityFileRelativePath}`);
                 // Mark as processed but not imported
                 await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { processedFiles: activityFileRelativePath as any }, $set: { lastUpdated: new Date() } }
                 );
                 return NextResponse.json({ success: true, message: `Unsupported file type skipped for ${activityFileRelativePath}` });
            }

            if (!processedActivityData) {
                console.warn(`File processing returned no data for: ${activityFileRelativePath}`);
                // Mark as error file
                await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { errorFiles: activityFileRelativePath as any }, $set: { lastUpdated: new Date() } }
                 );
                return NextResponse.json({ success: true, error: `File processing failed: ${activityFileRelativePath}` });
            }
            
        } catch (processingError) {
             console.error(`Error processing file content for ${activityFileRelativePath}:`, processingError);
             await db.collection('strava_import_state').updateOne(
                { processingId: processingId },
                { $push: { errorFiles: activityFileRelativePath as any }, $set: { lastUpdated: new Date() } }
             );
             return NextResponse.json({ success: true, error: `Error processing file: ${activityFileRelativePath}` });
        }

        // 5. Transform and Save Workout
        try {
             console.log(`Transforming activity data for: ${activityFileRelativePath}`);
             const workoutData = transformStravaActivity(processedActivityData);
             
             console.log(`Saving workout to DB for user ${userId}, file: ${activityFileRelativePath}`);
             // Fix createCardioWorkout call - pass single object (assuming signature)
             const workoutInput = { 
                 userId: userId, 
                 ...workoutData // Spread the transformed data
             };
             const createdWorkout = await createCardioWorkout(workoutInput);

             if (!createdWorkout) {
                 throw new Error('Workout creation function returned undefined or null.');
             }

             console.log(`Successfully saved workout ID: ${createdWorkout._id} from file: ${activityFileRelativePath}`);

             // 6. Update State - Mark file as imported
             await db.collection('strava_import_state').updateOne(
                 { processingId: processingId },
                 {
                     $push: {
                         processedFiles: activityFileRelativePath as any,
                         importedFiles: activityFileRelativePath as any 
                     },
                     $set: { lastUpdated: new Date() }
                 }
             );

             // Optional: Check if all files are processed and update final status
             // Fetch state again *after* update to get latest counts
             const finalStateCheck = await db.collection('strava_import_state').findOne({ processingId: processingId });
             // Check if the batch processing is complete
             if (finalStateCheck && (finalStateCheck.processedFiles?.length ?? 0) + (finalStateCheck.errorFiles?.length ?? 0) >= finalStateCheck.totalFiles) {
                 console.log(`All files processed for batch ${processingId}. Updating status to completed.`);
                 // Update the batch status to 'completed'
                 await db.collection('strava_import_state').updateOne(
                     { processingId: processingId },
                     { $set: { status: 'completed', lastUpdated: new Date() } }
                 );
                 
                 // --- Trigger Blob Deletion --- 
                 const blobToDelete = finalStateCheck.blobPathname;
                 if (blobToDelete) {
                     console.log(`Batch complete. Attempting to delete archive blob: ${blobToDelete}`);
                     try {
                         await del(blobToDelete); // Use the pathname directly with del
                         console.log(`Successfully deleted blob: ${blobToDelete}`);
                     } catch (deleteError) {
                         console.error(`Failed to delete blob ${blobToDelete} after batch completion:`, deleteError);
                         // Log the error but don't fail the worker job itself
                     }
                 } else {
                     console.warn(`Cannot delete blob for completed batch ${processingId}: blobPathname missing in state.`);
                 }
                 // --- End Blob Deletion --- 
             }

             return NextResponse.json({ success: true, workoutId: createdWorkout._id });

        } catch (dbError) {
             console.error(`Error transforming or saving workout for file ${activityFileRelativePath}:`, dbError);
              await db.collection('strava_import_state').updateOne(
                 { processingId: processingId },
                 { $push: { errorFiles: activityFileRelativePath as any }, $set: { lastUpdated: new Date() } }
              );
             return NextResponse.json({ success: true, error: `Error saving workout: ${activityFileRelativePath}` });
        }

    } catch (error) {
        console.error("Unhandled error in Strava activity processor:", error);
        // Attempt to mark file as error in state if possible
        if (processingId && activityFileRelativePath) {
             try {
                 const db = await getDatabase();
                 await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { errorFiles: activityFileRelativePath as any }, $set: { lastUpdated: new Date() } }
                 );
             } catch (stateUpdateError) {
                 console.error("Failed to update state after unhandled error:", stateUpdateError);
             }
        }
        // Return 500 to potentially allow QStash retry for transient issues
        return NextResponse.json({ success: false, error: "Internal server error during activity processing" }, { status: 500 });
    }
}

// Export the handler directly, verification is done inside
export { handler as POST }; 