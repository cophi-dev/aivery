import { NextRequest, NextResponse } from "next/server";
import { verifySignature } from "@upstash/qstash/dist/nextjs"; // Import verifySignature
import { head, del } from '@vercel/blob';
import { promisify } from 'util';
import { gunzip as gunzipCb } from 'zlib';
import { Buffer } from 'buffer'; // Ensure Buffer is available
import { processFitFile } from '@/lib/strava/process-fit-file';
import { processGpxFile } from '@/lib/strava/process-gpx-file';
import { processTcxFile } from '@/lib/strava/process-tcx-file';
import { transformStravaActivity, TransformedStravaActivity } from '@/lib/strava/transform-strava-activity';
import { createCardioWorkout } from '@/lib/workout-actions';
import { ObjectId } from 'mongodb'; // Import ObjectId if using it for userId directly with mongodb driver
import { connectToDatabase } from "@/lib/db/mongodb";
import { StravaImportState } from "@/lib/types";
import { IUser } from '@/lib/db/models/user'; // Corrected path
import { IWorkout } from '@/lib/db/models/workout'; // Corrected path
import { Types, Document } from 'mongoose';
import { gunzip } from 'zlib';

const asyncGunzip = promisify(gunzip);

// QStash specific headers - Keep these as they are used by verifySignature implicitly or for context
const QSTASH_URL = process.env.QSTASH_URL!;
const QSTASH_TOKEN = process.env.QSTASH_TOKEN!;
const QSTASH_CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY!;
const QSTASH_NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY!;

// Keep runtime Node.js
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
    // Verify the signature using the imported function
    const signature = req.headers.get("upstash-signature");
    if (!signature) {
        console.error("Signature missing");
        return NextResponse.json({ success: false, error: "Signature missing" }, { status: 401 });
    }

    const body = await req.text(); // Read body as text for verification

    // Use the imported verifySignature
    const isValid = await verifySignature({
      body: body,
      signature: signature,
      // url: req.url, // Pass the full URL if required by your QStash setup/verification method
      currentSigningKey: QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: QSTASH_NEXT_SIGNING_KEY,
    });

    if (!isValid) {
        console.error("Invalid signature");
        return NextResponse.json({ success: false, error: "Invalid signature" }, { status: 401 });
    }

    // Parse the verified body
    let payload: {
        processingId: string;
        userId: string;
        activityFileBlobPathname: string; // Pathname of the specific activity file blob
        originalArchiveBlobPathname?: string; // Optional: Pathname of the original ZIP archive
        blobUrl: string; // URL to download the specific activity file blob
    };
    try {
        payload = JSON.parse(body);
    } catch (error) {
        console.error("Failed to parse request body:", error);
        return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 });
    }

    const { processingId, userId, activityFileBlobPathname, originalArchiveBlobPathname, blobUrl } = payload;

    // --- Input Validation ---
    if (!processingId || !userId || !activityFileBlobPathname || !blobUrl) {
        console.error("Missing required fields in payload:", { processingId, userId, activityFileBlobPathname, blobUrl });
        return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    // --- Variables for processing ---
    let fileProcessingError = false;
    let errorMessage = "Unknown error";
    // Use mongoose Types.ObjectId for the _id field
    let createdWorkout: (IWorkout & Document<unknown, any, any> & { _id: Types.ObjectId; }) | null = null;

    try {
        // --- Database Connection ---
        const { db } = await connectToDatabase();
        const stateCollection = db.collection<StravaImportState>('strava_import_state');
        const userCollection = db.collection<IUser>('users'); // Assuming 'users' collection name

        // Use the correct identifier for this file
        const fileIdentifier = activityFileBlobPathname;

        // Log start
        console.log(`Processing started for file: ${fileIdentifier} (Processing ID: ${processingId})`);

        // Initial state update: Mark as processing this specific file
        // We check for idempotency *before* this update
        const currentStateBeforeUpdate = await stateCollection.findOne({ processingId: processingId, userId: userId });
        if (!currentStateBeforeUpdate) {
             // This indicates a potentially serious issue, maybe the state doc was deleted?
             console.error(`Critical: Processing state not found for processingId: ${processingId}, userId: ${userId}`);
             // Returning 500 might trigger retries, which could be problematic if the state is truly gone.
             // Returning 404 might be more appropriate? Or 410 Gone? Let's use 404.
             return NextResponse.json({ success: false, error: "Processing state not found" }, { status: 404 });
        }

        // --- Idempotency Checks ---
        if (currentStateBeforeUpdate.processedFiles.includes(fileIdentifier)) {
            console.log(`Skipping already processed file: ${fileIdentifier}`);
            return NextResponse.json({ success: true, message: "File already processed", file: fileIdentifier }, { status: 200 });
        }
        if (currentStateBeforeUpdate.errorFiles.some(ef => ef.file === fileIdentifier)) {
            console.log(`Skipping file with previous error: ${fileIdentifier}`);
            return NextResponse.json({ success: true, message: "File previously errored", file: fileIdentifier }, { status: 200 });
        }
         if (currentStateBeforeUpdate.filesToProcess.includes(fileIdentifier)) {
             // Only update if it's still in the 'to process' list
            await stateCollection.updateOne(
                { processingId: processingId, userId: userId },
                {
                    $set: {
                        status: 'processing',
                        currentlyProcessingFile: fileIdentifier,
                        lastUpdated: new Date()
                    },
                     // Optional: Pull from filesToProcess here? Or in finally? Let's do it in finally.
                    // $pull: { filesToProcess: fileIdentifier }
                }
            );
            console.log(`State updated: Now processing ${fileIdentifier}`);
         } else {
             // File is not in processed, error, or toProcess lists. This is unexpected.
             console.warn(`File ${fileIdentifier} not found in toProcess, processed, or error lists for processingId ${processingId}. Skipping.`);
             return NextResponse.json({ success: false, error: "File state inconsistent", file: fileIdentifier }, { status: 409 }); // 409 Conflict might fit
         }


        // --- Main Processing Steps (Inner Try/Catch) ---
        try {
            // Download file from blob
            console.log(`Downloading blob: ${blobUrl}`);
            const blobResponse = await fetch(blobUrl);
            if (!blobResponse.ok) {
                throw new Error(`Failed to download blob: ${blobResponse.statusText}`);
            }
            const blobBuffer: ArrayBuffer = await blobResponse.arrayBuffer();
            console.log(`Downloaded ${blobBuffer.byteLength} bytes for ${fileIdentifier}`);

            // Decompress if necessary (assuming .gz extension indicates compression)
            let activityDataBuffer: Buffer;
            if (activityFileBlobPathname.endsWith('.gz')) {
                console.log(`Decompressing gzipped file: ${fileIdentifier}`);
                // Convert ArrayBuffer to Buffer for gunzip
                activityDataBuffer = await asyncGunzip(Buffer.from(blobBuffer));
                console.log(`Decompressed size: ${activityDataBuffer.length} bytes`);
            } else {
                // Convert ArrayBuffer to Buffer directly if not gzipped
                activityDataBuffer = Buffer.from(blobBuffer);
            }

            // Parse (using the actual file type extension)
            console.log(`Parsing ${activityFileBlobPathname.split('.').pop()} file: ${fileIdentifier}`);
            const processedActivityData = await processFitFile(activityDataBuffer, activityFileBlobPathname.split('.').pop()); // Pass extension
            if (!processedActivityData) {
                throw new Error(`Failed to process activity file data for ${fileIdentifier}`);
            }
            console.log(`Successfully parsed data for ${fileIdentifier}`);

            // Transform
            const transformedActivity = await transformStravaActivity(processedActivityData);
            if (!transformedActivity) {
                throw new Error(`Failed to transform activity data for ${fileIdentifier}`);
            }
             // Attach userId before creating workout
            if (transformedActivity && userId) {
                 transformedActivity.userId = new Types.ObjectId(userId); // Ensure userId is ObjectId
            } else if (!transformedActivity) {
                throw new Error(`Transformation resulted in null/undefined for ${fileIdentifier}`);
            } else {
                // This case should ideally not happen if userId validation is done earlier
                throw new Error(`User ID is missing or invalid when attempting to attach to workout for ${fileIdentifier}`);
            }
            console.log(`Successfully transformed data for ${fileIdentifier}`);

            // Create workout
            console.log(`Creating workout document for: ${fileIdentifier}`);
            // createCardioWorkout should throw on error or return the document
            createdWorkout = await createCardioWorkout(transformedActivity);
            if (!createdWorkout || !createdWorkout._id) {
                 // Defensive check in case it returns null/undefined without throwing
                 throw new Error(`Workout creation failed or returned invalid document for ${fileIdentifier}`);
            }
            console.log(`Workout created with ID: ${createdWorkout._id} for file: ${fileIdentifier}`);

            // --- Success Path ---
            // No error occurred up to this point. fileProcessingError remains false.

        } catch (error) {
            // --- Error Handling during main processing ---
            console.error(`Error processing ${fileIdentifier}:`, error);
            fileProcessingError = true;
            errorMessage = error instanceof Error ? error.message : "Unknown processing error";
            // No need to update state here, finally block will handle it.
        } finally {
            // --- Update State (Always Runs After Inner Try/Catch) ---
            console.log(`Updating state in finally block for file: ${fileIdentifier}`);
            const updateResult = await stateCollection.findOneAndUpdate(
                { processingId: processingId, userId: userId },
                {
                    $pull: { filesToProcess: fileIdentifier }, // Remove from queue
                    $set: {
                        currentlyProcessingFile: null, // Clear current file being processed
                        lastUpdated: new Date()
                    },
                    ...(fileProcessingError
                        ? { $addToSet: { errorFiles: { file: fileIdentifier, error: errorMessage } } } // Add to error list
                        : { $addToSet: { processedFiles: fileIdentifier } } // Add to processed list
                    )
                },
                { returnDocument: 'after' } // Get the updated document
            );

            if (!updateResult) {
                // This is serious, the state document might have disappeared between the start and now.
                console.error(`CRITICAL: Failed to find state document for update for ${fileIdentifier} in finally block. ProcessingId: ${processingId}`);
                // We cannot determine completion status. Maybe try to return an error QStash won't retry?
                 fileProcessingError = true; // Mark as error anyway
                 errorMessage = "Failed to update state in finally block";
            } else {
                 const finalState = updateResult; // The updated state document
                 console.log(`State updated for ${fileIdentifier}. Processed: ${finalState.processedFiles.length}, Errors: ${finalState.errorFiles.length}, Remaining: ${finalState.filesToProcess.length}`);

                // --- Post-processing (Only if workout was created successfully in the *inner* try block) ---
                if (!fileProcessingError && createdWorkout) {
                    try {
                        console.log(`Running post-processing for workout ${createdWorkout._id} from file ${fileIdentifier}`);
                        // 1. Update User's workout list
                        const userUpdateResult = await userCollection.updateOne(
                            { _id: new Types.ObjectId(userId) },
                            { $addToSet: { workouts: createdWorkout._id } } // Add workout ID to user's list
                        );
                        if (userUpdateResult.modifiedCount > 0) {
                             console.log(`Added workout ${createdWorkout._id} to user ${userId}`);
                        } else {
                             console.warn(`Workout ${createdWorkout._id} might already exist in user ${userId} list or user not found.`);
                        }

                        // 2. Revalidate paths (Consider batching or doing this less often)
                        // Example: revalidatePath(`/users/${userId}/workouts`);
                        // console.log(`(Skipping revalidation) Would revalidate path for user ${userId}`);

                    } catch (postProcessingError) {
                        console.error(`Error during post-processing for workout ${createdWorkout._id} (file ${fileIdentifier}):`, postProcessingError);
                        // Log the error, but don't mark the main file processing as failed, as the workout *was* created.
                        // Maybe add a note to the state? For now, just log.
                    }
                }

                // --- Check for Overall Completion ---
                if (finalState.filesToProcess.length === 0) {
                    console.log(`All files processed for processingId: ${processingId}. Finalizing status.`);
                    const finalStatus = finalState.errorFiles.length > 0 ? 'completed_with_errors' : 'completed';
                    await stateCollection.updateOne(
                        { processingId: processingId, userId: userId },
                        {
                            $set: {
                                status: finalStatus,
                                currentlyProcessingFile: null, // Ensure it's null
                                completedAt: new Date(),
                                lastUpdated: new Date() // Update timestamp again
                            }
                        }
                    );
                     console.log(`Final status set to: ${finalStatus} for processingId: ${processingId}`);

                    // Optionally delete the original archive blob if present and processing complete
                    if (originalArchiveBlobPathname && finalStatus === 'completed') {
                        try {
                            console.log(`Attempting to delete original archive blob: ${originalArchiveBlobPathname}`);
                            await del(originalArchiveBlobPathname);
                            console.log(`Successfully deleted original archive blob: ${originalArchiveBlobPathname}`);
                        } catch (delError) {
                            console.error(`Failed to delete original archive blob ${originalArchiveBlobPathname}:`, delError);
                            // Log error but don't fail the request
                        }
                    }
                }
            } // End if (updateResult)

             // --- Send Response ---
            // QStash expects a 2xx response to not retry, even if there was an error during processing.
            // We signal success/failure in the JSON body.
            if (fileProcessingError) {
                 console.log(`Sending error response for file: ${fileIdentifier}`);
                return NextResponse.json({ success: false, error: errorMessage, file: fileIdentifier }, { status: 200 });
            } else {
                 console.log(`Sending success response for file: ${fileIdentifier}`);
                return NextResponse.json({
                    success: true,
                    file: fileIdentifier,
                    workoutId: createdWorkout?._id.toString() // Include workout ID if created
                 }, { status: 200 });
            }
        } // End finally block

    } catch (error) {
        // --- Outer Catch Block (Handles errors *before* the inner processing try/catch) ---
        console.error(`Unhandled error in process-activity handler for processingId ${processingId}:`, error);
        // Attempt a best-effort state update to mark the specific file as errored if possible
        // This might fail if the connection or payload parsing failed
        if (processingId && userId && activityFileBlobPathname) {
            try {
                 const { db } = await connectToDatabase();
                 const stateCollection = db.collection<StravaImportState>('strava_import_state');
                 await stateCollection.updateOne(
                      { processingId: processingId, userId: userId },
                      {
                          $pull: { filesToProcess: activityFileBlobPathname },
                          $addToSet: { errorFiles: { file: activityFileBlobPathname, error: error instanceof Error ? error.message : "Outer handler error" } },
                          $set: { status: 'processing', currentlyProcessingFile: null, lastUpdated: new Date() } // Keep processing, clear current file
                      }
                 );
                 console.log(`Outer error handler updated state for file ${activityFileBlobPathname}`);
            } catch (stateUpdateError) {
                 console.error(`CRITICAL: Failed to update state during outer error handling for ${activityFileBlobPathname}:`, stateUpdateError);
            }
        }
        // Return 500 to indicate a server error
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Internal Server Error" }, { status: 500 });
    }

    // If we reach here, it means the processing (including finally block) completed for this file
    // Return success response for the QStash message
     return NextResponse.json({
        success: true,
        message: fileProcessingError ? `Processing finished with error for ${activityFileBlobPathname}` : `Successfully processed ${activityFileBlobPathname}`,
        file: activityFileBlobPathname,
        status: fileProcessingError ? 'error' : 'processed',
        createdWorkoutId: createdWorkout?._id?.toString() // Include workout ID if created
    }, { status: 200 });
}

export { handler as POST };
