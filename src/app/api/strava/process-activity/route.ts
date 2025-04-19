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
import { ObjectId } from 'mongodb'; // Import ObjectId if using it for userId

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
    let userId: string | ObjectId | null = null; // Use appropriate type
    let activityFileBlobPathname: string | null = null;
    let originalArchiveBlobPathname: string | null = null;
    let finalFileIdentifier: string | undefined;

    try {
        // 1. Verify Signature & Parse Body
        const signature = req.headers.get("upstash-signature");
        if (!signature) {
            return new NextResponse("Signature required", { status: 401 });
        }
        const requestBodyString = await req.text();
        const isValid = await qstashReceiver.verify({ signature, body: requestBodyString });
        if (!isValid) {
            return new NextResponse("Invalid signature", { status: 401 });
        }
        console.log("QStash signature verified.");

        let body: any;
        try {
            body = JSON.parse(requestBodyString);
            if (typeof body === 'string') body = JSON.parse(body); // Handle double-encoding
        } catch (parseError) {
            console.error("Failed to parse body:", requestBodyString, parseError);
            return NextResponse.json({ success: false, error: "Invalid body format" }, { status: 400 });
        }

        // Assign and Validate Payload
        processingId = body.processingId;
        userId = body.userId;
        activityFileBlobPathname = body.activityFileBlobPathname;
        originalArchiveBlobPathname = body.originalArchiveBlobPathname;
        
        if (!processingId || !userId || !activityFileBlobPathname || !originalArchiveBlobPathname) {
            console.error("Missing required fields after parsing:", JSON.stringify(body));
            return NextResponse.json({ success: false, error: "Invalid job payload" }, { status: 400 });
        }
        
        // Determine file identifier (use relative path if possible, fallback to filename)
        finalFileIdentifier = activityFileBlobPathname.split('/').pop() || 'unknown_file'; // Fallback
        const db = await getDatabase();
        const stateCollection = db.collection('strava_import_state');
        
        // Try to get more specific relative path from state
        const preliminaryState = await stateCollection.findOne({ processingId: processingId, userId: userId });
        if (preliminaryState?.activityBlobPathPrefix && activityFileBlobPathname.includes(preliminaryState.activityBlobPathPrefix)) {
            const relative = activityFileBlobPathname.split(preliminaryState.activityBlobPathPrefix)[1];
            if (relative) finalFileIdentifier = relative; 
        }

        console.log(`Processing job for file: ${finalFileIdentifier}`, { processingId, userId });

        // 2. Initial State Update: Set as processing
        await stateCollection.updateOne(
            { processingId: processingId, userId: userId },
            { $set: { status: 'processing', currentlyProcessingFile: finalFileIdentifier, lastUpdated: new Date() } }
        );

        // 3. Core Processing Logic (within its own try/catch)
        let fileBuffer: Buffer;
        let processedActivityData: ProcessedActivityData | null = null;
        let workoutCreationError: Error | null = null;
        let fileProcessingError = false;
        let errorMessage = '';

        try {
            // Download
            console.log(`Downloading activity blob: ${activityFileBlobPathname}`);
            const blobHead = await head(activityFileBlobPathname);
            if (!blobHead?.url) throw new Error(`Blob not found or URL missing: ${activityFileBlobPathname}`);
            const blobResponse = await fetch(blobHead.url);
            if (!blobResponse.ok) throw new Error(`Failed download (Status: ${blobResponse.status}): ${activityFileBlobPathname}`);
            fileBuffer = Buffer.from(await blobResponse.arrayBuffer());
            console.log(`Downloaded ${finalFileIdentifier} (${fileBuffer.length} bytes)`);

            // Decompress
            const lowerFilePath = activityFileBlobPathname.toLowerCase();
            let isGzipped = false;
            if (lowerFilePath.endsWith('.gz')) {
                console.log(`Decompressing: ${finalFileIdentifier}`);
                fileBuffer = await gunzipAsync(fileBuffer);
                isGzipped = true;
                console.log(`Decompressed size: ${fileBuffer.length} bytes`);
            }
            const actualFileType = isGzipped ? lowerFilePath.slice(0, -3) : lowerFilePath;

            // Parse
            const fileNameForProcessing = finalFileIdentifier;
            console.log(`Parsing as ${actualFileType.split('.').pop()?.toUpperCase()}: ${fileNameForProcessing}`);
            if (actualFileType.endsWith('.fit')) {
                processedActivityData = await processFitFile(fileBuffer, fileNameForProcessing);
            } else if (actualFileType.endsWith('.gpx')) {
                processedActivityData = await processGpxFile(fileBuffer, fileNameForProcessing);
            } else if (actualFileType.endsWith('.tcx')) {
                processedActivityData = await processTcxFile(fileBuffer, fileNameForProcessing);
            } else {
                console.warn(`Unsupported file type skipped: ${fileNameForProcessing}`);
                // Treat as processed but not imported (no error)
            }

            // Transform & Save (only if parsed successfully)
            if (processedActivityData) {
                 console.log(`Transforming activity data for: ${fileNameForProcessing}`);
                 const workoutData = transformStravaActivity(processedActivityData as any);
                 console.log(`Saving workout to DB for user ${userId}, file: ${fileNameForProcessing}`);
                 const workoutInput = { userId: userId, ...workoutData };
                 const createdWorkout = await createCardioWorkout(workoutInput);
                 if (!createdWorkout) {
                     throw new Error('Workout creation function returned null/undefined.');
                 }
                 console.log(`Saved workout ID: ${createdWorkout._id} from file: ${fileNameForProcessing}`);
            } else if (!actualFileType.endsWith('.fit') && !actualFileType.endsWith('.gpx') && !actualFileType.endsWith('.tcx')) {
                // Was an unsupported type, not an error, just processed.
            } else {
                // Parsed as supported type, but got no data - treat as error
                 throw new Error('File processing returned no data.');
            }

        } catch (processingError) {
            fileProcessingError = true;
            errorMessage = processingError instanceof Error ? processingError.message : 'Unknown processing error';
            console.error(`Error during processing steps for ${finalFileIdentifier}:`, processingError);
        }

        // 4. Final State Update (Success or Error)
        const updateOperation: any = {
            $set: { currentlyProcessingFile: null, lastUpdated: new Date() },
            $push: { }
        };
        if (fileProcessingError) {
            updateOperation.$push.errorFiles = finalFileIdentifier as any;
            console.log(`Marking file as errored: ${finalFileIdentifier}`);
        } else {
            updateOperation.$push.processedFiles = finalFileIdentifier as any;
            // Only add to importedFiles if data was actually processed and saved
            if (processedActivityData) {
                 updateOperation.$push.importedFiles = finalFileIdentifier as any;
            }
            console.log(`Marking file as processed: ${finalFileIdentifier}`);
        }
        await stateCollection.updateOne({ processingId: processingId }, updateOperation);

        // 5. Check Completion Status
        const finalStateCheck = await stateCollection.findOne({ processingId: processingId });
        if (finalStateCheck && (finalStateCheck.processedFiles?.length ?? 0) + (finalStateCheck.errorFiles?.length ?? 0) >= finalStateCheck.totalFiles) {
            const finalStatus = finalStateCheck.errorFiles?.length > 0 ? 'queued_with_errors' : 'completed';
            console.log(`All files processed for batch ${processingId}. Updating status to ${finalStatus}.`);
            await stateCollection.updateOne(
                { processingId: processingId },
                { $set: { status: finalStatus, currentlyProcessingFile: null, lastUpdated: new Date() } }
            );

            // Delete Original Archive
            const archiveToDelete = finalStateCheck.originalArchiveBlobPathname;
            if (archiveToDelete) {
                console.log(`Attempting to delete original archive blob: ${archiveToDelete}`);
                try {
                    await del(archiveToDelete);
                    console.log(`Successfully deleted: ${archiveToDelete}`);
                } catch (delError) {
                    console.error(`Failed to delete archive blob ${archiveToDelete}:`, delError);
                }
            }
        }

        // Return success response for the job queue
        return NextResponse.json({ 
            success: true, 
            processed: !fileProcessingError, 
            file: finalFileIdentifier, 
            error: fileProcessingError ? errorMessage : null 
        });

    } catch (error) {
        // Handle outer errors (parsing, initial state update, etc.)
        console.error("Outer error processing activity job:", error);
        // Mark file as error if possible
        if (processingId && userId && finalFileIdentifier) {
            try {
                const db = await getDatabase();
                await db.collection('strava_import_state').updateOne(
                    { processingId: processingId, userId: userId }, // Add userId filter
                    { $push: { errorFiles: finalFileIdentifier as any }, $set: { currentlyProcessingFile: null, lastUpdated: new Date() } }
                );
            } catch (dbError) {
                console.error("Failed to mark file as error during outer catch:", dbError);
            }
        }
        // Return error status to QStash
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Failed to process activity job" }, { status: 500 });
    }
}

// Export the handler directly, verification is done inside
export const POST = handler; 