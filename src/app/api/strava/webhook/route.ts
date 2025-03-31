import { NextRequest, NextResponse } from "next/server";
import { syncStravaActivity } from "@/lib/services/stravaService";
import { WEBHOOK_VERIFY_TOKEN } from "@/lib/strava/webhook";

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

    // Only process activity events
    if (event.object_type === "activity") {
      const athleteId = event.owner_id;
      const activityId = event.object_id;
      const aspectType = event.aspect_type;

      console.log(
        `Processing Strava ${aspectType} event for activity ${activityId} by athlete ${athleteId}`
      );

      if (aspectType === "create" || aspectType === "update") {
        // Sync the new or updated activity
        // This may be processed asynchronously
        await syncStravaActivity(athleteId, activityId.toString());
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