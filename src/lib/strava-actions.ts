"use server"

import { revalidatePath } from "next/cache"
import { connectStrava, getStravaIntegration, updateStravaSyncPreferences, SUPPORTED_ACTIVITY_TYPES } from "./services/stravaService"
import { syncStravaWorkouts } from "./services/integrationService"
import { getServerSession } from "next-auth/next"
import { authOptions } from "./auth"
import { createWebhookSubscription, getWebhookSubscription, deleteWebhookSubscription } from "./strava/webhook"
import { getCollection } from "@/lib/db/mongodb"
import { ObjectId } from "mongodb"

export async function connectStravaAction(authCode: string) {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }
    
    const userId = session.user.id
    
    // Connect Strava using real user ID
    const result = await connectStrava(userId, authCode)
    
    // Automatically set up webhook subscription for auto-sync after connecting
    try {
      console.log("Automatically setting up webhook subscription for auto-sync after Strava connection")
      await createWebhookSubscription()
    } catch (webhookError) {
      console.error("Failed to automatically set up webhook subscription:", webhookError)
      // Don't fail the overall connection process if webhook setup fails
    }
    
    // Revalidate relevant pages
    revalidatePath("/integrations")
    return { success: true, data: result }
  } catch (error) {
    console.error("Error connecting to Strava:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to connect to Strava"
    return { success: false, error: errorMessage }
  }
}

export async function syncStravaWorkoutsAction() {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }
    
    const userId = session.user.id
    
    // Sync Strava workouts (only runs and swims)
    const count = await syncStravaWorkouts(userId)
    
    // Revalidate relevant pages
    revalidatePath("/calendar")
    revalidatePath("/activity")
    revalidatePath("/dashboard")
    revalidatePath("/integrations")
    
    return { 
      success: true, 
      count,
      types: ['running', 'swimming'], // Default types
      message: "Successfully synced runs and swims from Strava"
    }
  } catch (error) {
    console.error("Error syncing Strava workouts:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to sync Strava workouts"
    return { success: false, error: errorMessage }
  }
}

export async function syncStravaLast5Action() {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }
    
    const userId = session.user.id
    console.log(`[syncStravaLast5Action] User ${userId} requesting last 5 sync`)
    
    // Since this is a server action, we'll make a simulated call to our sync logic
    // by importing and using the same logic as the API endpoint
    const { getValidAccessToken } = await import("./services/stravaService")
    const { getRecentStravaActivities } = await import("./strava")
    const WorkoutModel = (await import("@/lib/db/models/workout")).default
    const dbConnect = (await import("@/lib/db/mongodb")).default
    
    await dbConnect()
    
    // Get valid access token
    const accessToken = await getValidAccessToken(userId)
    if (!accessToken) {
      throw new Error("Failed to obtain valid Strava access token.")
    }
    
    // Fetch recent activities
    const recentActivities = await getRecentStravaActivities(accessToken)
    const last5Activities = recentActivities.slice(0, 5)
    
    let syncedCount = 0
    let updatedCount = 0
    
    // Process each activity
    for (const activity of last5Activities) {
      try {
        // Check if workout exists
        const existingWorkout = await WorkoutModel.findOne({
          userId: userId,
          source: 'strava',
          sourceId: activity.id.toString()
        }).exec()

        // Simple activity mapping
        const distanceInMeters = typeof activity.distance === 'number' ? activity.distance : 0
        const durationSeconds = activity.moving_time || activity.elapsed_time || 0
        const workoutType = activity.type?.toLowerCase().includes('run') ? 'running' :
                           activity.type?.toLowerCase().includes('ride') ? 'cycling' :
                           activity.type?.toLowerCase().includes('swim') ? 'swimming' :
                           activity.type?.toLowerCase().includes('walk') ? 'walking' : 'other'

        const workoutData = {
          userId: userId,
          name: activity.name || `${activity.type} Activity`,
          type: workoutType,
          date: new Date(activity.start_date),
          duration: durationSeconds,
          distance: distanceInMeters,
          intensity: 'Medium',
          stravaLink: `https://www.strava.com/activities/${activity.id}`,
          source: 'strava',
          sourceId: activity.id.toString(),
          importedFrom: 'strava-sync-last-5',
        }

        if (existingWorkout) {
          await WorkoutModel.findByIdAndUpdate(existingWorkout._id, { $set: workoutData }, { new: true })
          updatedCount++
        } else {
          await WorkoutModel.create(workoutData)
          syncedCount++
        }
      } catch (activityError) {
        console.error(`Error processing activity ${activity.id}:`, activityError)
      }
    }

    // Revalidate relevant pages
    revalidatePath("/calendar")
    revalidatePath("/activity") 
    revalidatePath("/dashboard")
    revalidatePath("/integrations")
    revalidatePath("/workouts")
    
    return {
      success: true,
      newCount: syncedCount,
      updatedCount: updatedCount,
      totalProcessed: last5Activities.length,
      message: `Processed ${last5Activities.length} recent activities: ${syncedCount} new, ${updatedCount} updated`
    }
  } catch (error) {
    console.error("Error syncing last 5 Strava workouts:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to sync last 5 Strava workouts"
    return { success: false, error: errorMessage }
  }
}

export async function getStravaIntegrationAction() {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }
    
    const userId = session.user.id
    
    // Get Strava integration
    const integration = await getStravaIntegration(userId)
    return { success: true, integration }
  } catch (error) {
    console.error("Error getting Strava integration:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to get Strava integration"
    return { success: false, error: errorMessage }
  }
}

export async function updateStravaSyncPreferencesAction(activityTypes: string[]) {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }
    
    const userId = session.user.id
    
    // Update preferences
    const result = await updateStravaSyncPreferences(userId, activityTypes)
    
    return { success: true }
  } catch (error) {
    console.error("Error updating Strava sync preferences:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to update Strava sync preferences"
    return { success: false, error: errorMessage }
  }
}

export async function getSupportedActivityTypes() {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }
    
    const userId = session.user.id
    
    // Get user's preferences
    const collection = await getCollection("preferences")
    const preferences = await collection.findOne({
      userId: new ObjectId(userId),
      type: "strava_sync"
    })
    
    // Map the user's preferences to the activity types
    const activityTypes = SUPPORTED_ACTIVITY_TYPES.map(type => ({
      ...type,
      enabled: preferences?.activityTypes?.includes(type.id) ?? type.enabled
    }))
    
    return { success: true, activityTypes }
  } catch (error) {
    console.error("Error getting activity types:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to get activity types"
    return { success: false, error: errorMessage }
  }
}

export async function getStravaWebhookStatusAction() {
  try {
    const subscription = await getWebhookSubscription();
    
    // Get the last updated timestamp from the webhook events collection
    let lastUpdated = null;
    try {
      const webhookEventsCollection = await getCollection("webhook_events");
      // Find the most recent webhook event for Strava
      const latestEvent = await webhookEventsCollection.findOne(
        { provider: "strava" },
        { sort: { timestamp: -1 } }
      );
      
      if (latestEvent) {
        lastUpdated = latestEvent.timestamp;
      }
    } catch (dbError) {
      console.error("Error getting last webhook event timestamp:", dbError);
      // Don't fail the overall status check if this fails
    }
    
    return { 
      success: true, 
      subscribed: !!subscription,
      subscription,
      lastUpdated
    };
  } catch (error) {
    console.error("Error getting Strava webhook status:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to get Strava webhook status";
    return { success: false, error: errorMessage };
  }
}

export async function setupStravaWebhookAction() {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error("Not authenticated");
    }
    
    // Create or verify webhook subscription
    const subscription = await createWebhookSubscription();
    
    return { 
      success: true, 
      subscription 
    };
  } catch (error) {
    console.error("Error setting up Strava webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to set up Strava webhook";
    return { success: false, error: errorMessage };
  }
}

export async function removeStravaWebhookAction(subscriptionId: number) {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      throw new Error("Not authenticated");
    }
    
    // Delete webhook subscription
    const result = await deleteWebhookSubscription(subscriptionId);
    
    return { success: true };
  } catch (error) {
    console.error("Error removing Strava webhook:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to remove Strava webhook";
    return { success: false, error: errorMessage };
  }
}

