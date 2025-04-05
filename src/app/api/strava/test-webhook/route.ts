import { NextRequest, NextResponse } from "next/server";
import { syncStravaActivity } from "@/lib/services/stravaService";

// This is a debug endpoint for testing webhook functionality locally
export async function POST(request: NextRequest) {
  // Only allow in development environment
  if (process.env.NODE_ENV !== "development") {
    return new NextResponse("Not available in production", { status: 403 });
  }
  
  try {
    // Get mock event data from request body
    const eventData = await request.json();
    
    console.log("Test webhook event received:", eventData);
    
    // Validate required fields
    if (!eventData.object_type || !eventData.object_id || !eventData.owner_id || !eventData.aspect_type) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" }, 
        { status: 400 }
      );
    }
    
    // Process the activity
    if (eventData.object_type === "activity" && 
        (eventData.aspect_type === "create" || eventData.aspect_type === "update")) {
      
      // Record this test webhook event
      try {
        const { getCollection } = await import("@/lib/db/mongodb");
        const webhookEventsCollection = await getCollection("webhook_events");
        
        await webhookEventsCollection.insertOne({
          provider: "strava",
          event: eventData,
          timestamp: new Date(),
          processedAt: null,
          isTest: true // Mark as test event
        });
      } catch (dbError) {
        console.error("Error recording test webhook event:", dbError);
      }
      
      const result = await syncStravaActivity(
        eventData.owner_id, 
        eventData.object_id.toString()
      );
      
      // Update the test webhook event record
      try {
        const { getCollection } = await import("@/lib/db/mongodb");
        const webhookEventsCollection = await getCollection("webhook_events");
        
        await webhookEventsCollection.updateOne(
          { 
            "event.object_id": eventData.object_id,
            "event.owner_id": eventData.owner_id,
            isTest: true
          },
          { 
            $set: { 
              processedAt: new Date(),
              status: "processed",
              result: result
            } 
          }
        );
      } catch (updateError) {
        console.error("Error updating test webhook event status:", updateError);
      }
      
      return NextResponse.json({ 
        success: true, 
        message: "Activity processed",
        result
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: "Event received but not processed (not a create/update activity event)"
    });
    
  } catch (error) {
    console.error("Error processing test webhook:", error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      },
      { status: 500 }
    );
  }
} 