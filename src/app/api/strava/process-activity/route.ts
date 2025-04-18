import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { getDatabase } from '@/lib/db/mongodb';
import { head, del } from '@vercel/blob';
import { promisify } from 'util';
import { gunzip as gunzipCb } from 'zlib';
import { Buffer } from 'buffer'; // Ensure Buffer is available
import { processFitFile, processGpxFile, processTcxFile, ProcessedActivityData } from '@/lib/services/stravaArchiveService';
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

async function handler(req: NextRequest) {
    console.log("--- Strava Process Activity Job Received ---");
    let processingId: string | null = null;
    let activityFileBlobPathname: string | null = null; // Renamed for clarity
    let originalArchiveBlobPathname: string | null = null; // Path to the original ZIP

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
        // Log the raw body string BEFORE parsing
        console.log("[RAW BODY STRING]:", requestBodyString);

        let parsedBody: any;
        try {
            parsedBody = JSON.parse(requestBodyString);
            if (typeof parsedBody === 'string') {
                console.log("[DEBUG] Body seems double-encoded, parsing again...");
                parsedBody = JSON.parse(parsedBody);
            }
        } catch (parseError) {
            console.error("Failed to parse request body. Raw string was:", requestBodyString, parseError);
            return NextResponse.json({ success: false, error: "Invalid request body format" }, { status: 400 });
        }
        
        const body = parsedBody; 

        // Now assign variables from the correctly parsed body object
        processingId = body.processingId;
        const userId = body.userId;
        activityFileBlobPathname = body.activityFileBlobPathname; 
        originalArchiveBlobPathname = body.originalArchiveBlobPathname;

        // === Add detailed logging before the check ===
        console.log(`[DEBUG] Checking payload fields:`);
        console.log(`[DEBUG] processingId: ${processingId} (Type: ${typeof processingId})`);
        console.log(`[DEBUG] userId: ${userId} (Type: ${typeof userId})`);
        console.log(`[DEBUG] activityFileBlobPathname: ${activityFileBlobPathname} (Type: ${typeof activityFileBlobPathname})`);
        console.log(`[DEBUG] originalArchiveBlobPathname: ${originalArchiveBlobPathname} (Type: ${typeof originalArchiveBlobPathname})`);
        // === End detailed logging ===

        // Use activityFileBlobPathname for logging the specific file being processed
        const logIdentifier = activityFileBlobPathname ? activityFileBlobPathname.split('/').pop() : 'unknown_file';

        if (!processingId || !userId || !activityFileBlobPathname || !originalArchiveBlobPathname) {
             console.error("Missing required fields after parsing - Parsed Body was:", JSON.stringify(body));
             return NextResponse.json({ success: false, error: "Invalid job payload" }, { status: 400 });
        }

        console.log(`Processing job for: ${logIdentifier}`, { processingId, userId });

        // 1. Fetch processing state from MongoDB
        const db = await getDatabase();
        const state = await db.collection('strava_import_state').findOne({ processingId: processingId, userId: userId });

        if (!state) {
            console.error(`Processing state not found for ID: ${processingId}`);
            // TODO: Decide if this is a permanent failure or should be retried by QStash
            return NextResponse.json({ success: false, error: "Processing state not found" }, { status: 404 }); // 404 might prevent retries
        }

        // Calculate relative path (might be undefined)
        let relativePathFromBlob: string | undefined;
        if (state.activityBlobPathPrefix && activityFileBlobPathname.includes(state.activityBlobPathPrefix)) {
            relativePathFromBlob = activityFileBlobPathname.split(state.activityBlobPathPrefix)[1];
        }
        
        // Use logIdentifier as fallback if relative path couldn't be determined
        const fileCheckIdentifier = relativePathFromBlob || logIdentifier || 'unknown_path';
        
        if (state.status === 'completed' || state.status === 'failed') {
             console.log(`Skipping job for already completed/failed batch: ${processingId}, status: ${state.status}`);
             return NextResponse.json({ success: true, message: "Batch already completed or failed" });
        }

        // Check if already processed/errored using fileCheckIdentifier
        if (state.processedFiles?.includes(fileCheckIdentifier) || state.errorFiles?.includes(fileCheckIdentifier)) {
             console.log(`Skipping already processed/errored file: ${fileCheckIdentifier} in batch: ${processingId}`);
             return NextResponse.json({ success: true, message: "File already processed or errored" });
        }

        // 2. Download the SPECIFIC activity file blob
        console.log(`Downloading activity blob: ${activityFileBlobPathname}`);
        let fileBuffer: Buffer;
        try {
            // Use head to get the download URL
            const blobHead = await head(activityFileBlobPathname); 
            if (!blobHead || !blobHead.url) {
                 throw new Error(`Activity blob not found or URL missing: ${activityFileBlobPathname}`);
            }
            // Fetch the content from the URL
            const blobResponse = await fetch(blobHead.url);
            if (!blobResponse.ok) {
                 throw new Error(`Failed to download activity blob: ${activityFileBlobPathname} (Status: ${blobResponse.status})`);
            }
            fileBuffer = Buffer.from(await blobResponse.arrayBuffer());
            console.log(`Downloaded activity file (${fileBuffer.length} bytes) for: ${fileCheckIdentifier}`);
        } catch (downloadError) {
            console.error(`Error downloading activity file ${activityFileBlobPathname}:`, downloadError);
            // Revert to using 'as any' for $push as a temporary workaround
            await db.collection('strava_import_state').updateOne(
                { processingId: processingId },
                { $push: { errorFiles: fileCheckIdentifier as any }, $set: { lastUpdated: new Date() } }
            );
            return NextResponse.json({ success: true, error: `Failed download for ${fileCheckIdentifier}` });
        }

        // 3. Decompress if necessary (.gz)
        const lowerFilePath = activityFileBlobPathname.toLowerCase();
        let isGzipped = false;
        if (lowerFilePath.endsWith('.gz')) {
            console.log(`Decompressing gzipped file: ${fileCheckIdentifier}`);
            try {
                 fileBuffer = await gunzipAsync(fileBuffer);
                 isGzipped = true;
                 console.log(`Decompressed buffer size: ${fileBuffer.length} bytes`);
            } catch (unzipError) {
                console.error(`Failed to decompress file ${fileCheckIdentifier}:`, unzipError);
                // Revert to using 'as any' for $push
                await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { errorFiles: fileCheckIdentifier as any }, $set: { lastUpdated: new Date() } }
                );
                return NextResponse.json({ success: true, error: `Failed to decompress file: ${fileCheckIdentifier}` });
            }
        }

        // Determine actual file type for processing
        const actualFileType = isGzipped ? lowerFilePath.slice(0, -3) : lowerFilePath; 
        
        // 4. Process the extracted file buffer
        let processedActivityData: ProcessedActivityData | null = null;
        try {
            // Pass the relative path (for logging/ID generation) and the buffer
            const fileNameForProcessing = fileCheckIdentifier; 
            if (actualFileType.endsWith('.fit')) {
                console.log(`Processing as FIT file: ${fileNameForProcessing}`);
                processedActivityData = await processFitFile(fileBuffer, fileNameForProcessing);
            } else if (actualFileType.endsWith('.gpx')) {
                 console.log(`Processing as GPX file: ${fileNameForProcessing}`);
                 processedActivityData = await processGpxFile(fileBuffer, fileNameForProcessing);
            } else if (actualFileType.endsWith('.tcx')) {
                 console.log(`Processing as TCX file: ${fileNameForProcessing}`);
                 processedActivityData = await processTcxFile(fileBuffer, fileNameForProcessing);
            } else {
                 console.warn(`Unsupported file type skipped: ${fileNameForProcessing}`);
                 // Revert to using 'as any' for $push
                 await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { processedFiles: fileCheckIdentifier as any }, $set: { lastUpdated: new Date() } }
                 );
                 return NextResponse.json({ success: true, message: `Unsupported file type skipped for ${fileCheckIdentifier}` });
            }

            if (!processedActivityData) {
                console.warn(`File processing returned no data for: ${fileCheckIdentifier}`);
                // Revert to using 'as any' for $push
                await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { errorFiles: fileCheckIdentifier as any }, $set: { lastUpdated: new Date() } }
                 );
                return NextResponse.json({ success: true, error: `File processing failed: ${fileCheckIdentifier}` });
            }
            
        } catch (processingError) {
             console.error(`Error processing file content for ${fileCheckIdentifier}:`, processingError);
             // Revert to using 'as any' for $push
             await db.collection('strava_import_state').updateOne(
                { processingId: processingId },
                { $push: { errorFiles: fileCheckIdentifier as any }, $set: { lastUpdated: new Date() } }
             );
             return NextResponse.json({ success: true, error: `Error processing file: ${fileCheckIdentifier}` });
        }

        // 5. Transform and Save Workout
        try {
             console.log(`Transforming activity data for: ${fileCheckIdentifier}`);
             const workoutData = transformStravaActivity(processedActivityData as any);
             
             console.log(`Saving workout to DB for user ${userId}, file: ${fileCheckIdentifier}`);
             const workoutInput = { userId: userId, ...workoutData };
             const createdWorkout = await createCardioWorkout(workoutInput);

             if (!createdWorkout) {
                 throw new Error('Workout creation function returned undefined or null.');
             }

             console.log(`Successfully saved workout ID: ${createdWorkout._id} from file: ${fileCheckIdentifier}`);

             // 6. Update State - Use fileCheckIdentifier (guaranteed string)
             await db.collection('strava_import_state').updateOne(
                 { processingId: processingId },
                 {
                     $push: {
                         processedFiles: fileCheckIdentifier as any,
                         importedFiles: fileCheckIdentifier as any
                     },
                     $set: { lastUpdated: new Date() }
                 }
             );

             // Check if all files are processed and update final status / delete ORIGINAL archive
             const finalStateCheck = await db.collection('strava_import_state').findOne({ processingId: processingId });
             if (finalStateCheck && (finalStateCheck.processedFiles?.length ?? 0) + (finalStateCheck.errorFiles?.length ?? 0) >= finalStateCheck.totalFiles) {
                 console.log(`All files processed for batch ${processingId}. Updating status to completed.`);
                 await db.collection('strava_import_state').updateOne(
                     { processingId: processingId },
                     { $set: { status: 'completed', lastUpdated: new Date() } }
                 );
                 
                 // Trigger ORIGINAL archive Blob Deletion
                 const archiveToDelete = finalStateCheck.originalArchiveBlobPathname; // Use the correct path
                 if (archiveToDelete) {
                     console.log(`Batch complete. Attempting to delete ORIGINAL archive blob: ${archiveToDelete}`);
                     try {
                         await del(archiveToDelete); 
                         console.log(`Successfully deleted original archive blob: ${archiveToDelete}`);
                     } catch (deleteError) {
                         console.error(`Failed to delete original archive blob ${archiveToDelete}:`, deleteError);
                     }
                 } else {
                     console.warn(`Cannot delete original archive blob for completed batch ${processingId}: path missing in state.`);
                 }
                 // We might also want to delete the individual activity files here or later? For now, keep them.
             }

             return NextResponse.json({ success: true, workoutId: createdWorkout._id });

        } catch (dbError) {
             console.error(`Error transforming or saving workout for file ${fileCheckIdentifier}:`, dbError);
              await db.collection('strava_import_state').updateOne(
                 { processingId: processingId },
                 { $push: { errorFiles: fileCheckIdentifier as any }, $set: { lastUpdated: new Date() } }
              );
             return NextResponse.json({ success: true, error: `Error saving workout: ${fileCheckIdentifier}` });
        }

    } catch (error) {
        console.error("Unhandled error in Strava activity processor:", error);
        if (processingId && activityFileBlobPathname) {
             // Recalculate identifier within this scope for safety
             let errorFileIdentifier = activityFileBlobPathname.split('/').pop() || 'unknown_file';
             try {
                 const db = await getDatabase();
                 const stateForError = await db.collection('strava_import_state').findOne({ processingId: processingId });
                 if(stateForError?.activityBlobPathPrefix && activityFileBlobPathname.includes(stateForError.activityBlobPathPrefix)) {
                     const splitResult = activityFileBlobPathname.split(stateForError.activityBlobPathPrefix)[1];
                     if (splitResult) errorFileIdentifier = splitResult;
                 }
                 // Revert to using 'as any' for $push
                 await db.collection('strava_import_state').updateOne(
                    { processingId: processingId },
                    { $push: { errorFiles: errorFileIdentifier as any }, $set: { lastUpdated: new Date() } }
                 );
             } catch (stateUpdateError) { /* ... */ }
        }
        return NextResponse.json({ success: false, error: "Internal server error during activity processing" }, { status: 500 });
    }
}

// Export the handler directly, verification is done inside
export { handler as POST }; 