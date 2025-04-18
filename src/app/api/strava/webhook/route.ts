import { NextRequest, NextResponse } from "next/server";
import { syncStravaActivity, findUserByStravaAthleteId } from "@/lib/services/stravaService";
import { WEBHOOK_VERIFY_TOKEN } from "@/lib/strava/webhook";
import { revalidatePath } from 'next/cache';

// This is the verification token we'll configure in Strava
// Should be a random string, but we'll hardcode for now
// const WEBHOOK_VERIFY_TOKEN_OLD = "aivery_strava_webhook_verify_token";

export const dynamic = "force-dynamic";

// Handle GET requests (subscription validation)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("Strava webhook validation request:", { mode, token, challenge });

  // Validation logic - Strava sends these params for subscription verification
  if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
    console.log("Strava webhook validation successful");
    return NextResponse.json({ "hub.challenge": challenge });
  } else {
    console.error("Strava webhook validation failed", { mode, token });
    return new NextResponse("Validation failed", { status: 403 });
  }
}

// Handle POST requests (activity updates)
export async function POST(request: NextRequest) {
  try {
    const event = await request.json();
    console.log("Strava webhook event received:", event);

    /*
    Strava webhook event structure:
    {
      object_type: "activity",  // or "athlete"
      object_id: 12345678987654321,
      aspect_type: "create",    // or "update", "delete"
      updates: {},
      owner_id: 12345,
      subscription_id: 123456,
      event_time: 1516126040
    }
    */

    // Record this webhook event in the database for tracking
    try {
      const { getCollection } = await import("@/lib/db/mongodb");
      const webhookEventsCollection = await getCollection("webhook_events");
      
      await webhookEventsCollection.insertOne({
        provider: "strava",
        event: event,
        timestamp: new Date(),
        processedAt: null // Will be updated after processing
      });
    } catch (dbError) {
      console.error("Error recording webhook event:", dbError);
      // Continue processing even if recording fails
    }

    // Only process activity events
    if (event.object_type === "activity") {
      const athleteId = event.owner_id;
      const activityId = event.object_id;
      const aspectType = event.aspect_type;

      console.log(
        `Processing Strava ${aspectType} event for activity ${activityId} by athlete ${athleteId}`
      );

      if (aspectType === "create" || aspectType === "update") {
        try {
          // 1. Find the application user ID associated with the Strava athlete ID
          const appUserId = await findUserByStravaAthleteId(athleteId);
          console.log(`Found app user ID ${appUserId} for athlete ID ${athleteId}`);

          // 2. Sync the new or updated activity using the correct application user ID
          await syncStravaActivity(appUserId.toString(), activityId.toString());
          console.log(`Successfully synced activity ${activityId} for user ${appUserId}`);

          // 3. Update the webhook event record to mark as processed
          try {
            const { getCollection } = await import("@/lib/db/mongodb");
            const webhookEventsCollection = await getCollection("webhook_events");
            
            // Use the original event details to find the record
            await webhookEventsCollection.updateOne(
              { 
                "event.object_id": activityId,
                "event.owner_id": athleteId,
                "event.aspect_type": aspectType,
                // Optionally add a timestamp condition if duplicates are possible
              },
              { 
                $set: { 
                  processedAt: new Date(),
                  status: "processed",
                  appUserId: appUserId // Optionally store the resolved app user ID
                } 
              }
            );
            console.log(`Marked webhook event for activity ${activityId} as processed.`);
            
            // --- Revalidate the workouts path --- 
            try {
              revalidatePath('/workouts');
              console.log(`Revalidated path: /workouts`);
            } catch (revalidateError) {
              console.error(`Error revalidating /workouts path:`, revalidateError);
            }
            // --- End Revalidation --- 

          } catch (updateError) {
            console.error(`Error updating webhook event status for activity ${activityId}:`, updateError);
            // Continue even if update fails, the core sync worked.
          }

        } catch (syncError) {
          // Catch errors specifically from findUserByStravaAthleteId or syncStravaActivity
          console.error(`Error during sync process for activity ${activityId} (Athlete: ${athleteId}):`, syncError);
          // Don't update processedAt, leave it null to indicate failure
          // Update the DB record with an error status?
          try {
             const { getCollection } = await import("@/lib/db/mongodb");
             const webhookEventsCollection = await getCollection("webhook_events");
             await webhookEventsCollection.updateOne(
               { 
                 "event.object_id": activityId,
                 "event.owner_id": athleteId,
                 "event.aspect_type": aspectType,
                 processedAt: null // Target the unprocessed event
               },
               { 
                 $set: { 
                   status: "error",
                   errorMessage: syncError instanceof Error ? syncError.message : "Unknown sync error"
                 } 
               }
             );
          } catch (dbError) {
             console.error(`Error marking webhook event as failed for activity ${activityId}:`, dbError);
          }
        }
      }
      // We don't handle "delete" events for now
    }

    // Always return 200 OK to acknowledge receipt of the webhook
    return new NextResponse("OK");
  } catch (error) {
    console.error("Error processing Strava webhook:", error);
    // Still return 200 to avoid Strava retrying
    return new NextResponse("Error, but acknowledged", { status: 200 });
  }
} 