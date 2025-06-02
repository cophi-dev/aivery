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

// New combined smart sync action
export async function smartSyncStravaAction() {
  try {
    // Get current user's ID from session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      throw new Error("Not authenticated")
    }
    
    const userId = session.user.id
    console.log(`[smartSyncStravaAction] Starting smart sync for user: ${userId}`)
    
    // Get user's Strava integration
    const integration = await getStravaIntegration(userId)
    if (!integration) {
      throw new Error("Strava not connected")
    }
    
    const { getValidAccessToken } = await import("./services/stravaService")
    
    // Ensure we have a valid access token
    const validToken = await getValidAccessToken(userId)
    if (!validToken) {
      throw new Error("Failed to get valid Strava access token")
    }
    
    // Step 1: Check for deleted activities that need to be removed
    const { getCollection } = await import("@/lib/db/mongodb")
    const { ObjectId } = await import("mongodb")
    const workoutsCollection = await getCollection("workouts")
    
    // Get all Strava-synced workouts for this user (check recent ones)
    const stravaWorkouts = await workoutsCollection.find({
      userId: new ObjectId(userId),
      stravaActivityId: { $exists: true, $ne: null }
    }).sort({ date: -1 }).limit(20).toArray()
    
    let deletedCount = 0
    
    // Check if each workout still exists on Strava
    for (const workout of stravaWorkouts) {
      try {
        const checkResponse = await fetch(
          `https://www.strava.com/api/v3/activities/${workout.stravaActivityId}`,
          {
            headers: {
              'Authorization': `Bearer ${validToken}`
            }
          }
        )
        
        if (checkResponse.status === 404) {
          // Activity was deleted on Strava, remove from our database
          await workoutsCollection.deleteOne({ _id: workout._id })
          deletedCount++
          console.log(`[smartSyncStravaAction] Deleted workout ${workout._id} (Strava activity ${workout.stravaActivityId} no longer exists)`)
        }
      } catch (checkError) {
        console.error(`[smartSyncStravaAction] Error checking activity ${workout.stravaActivityId}:`, checkError)
        // Continue with other workouts
      }
    }
    
    // Step 2: Sync recent activities (last 10 to catch any new/updated ones)
    const { getRecentStravaActivities } = await import("./strava")
    const WorkoutModel = (await import("@/lib/db/models/workout")).default
    const dbConnect = (await import("@/lib/db/mongodb")).default
    
    await dbConnect()
    
    const recentActivities = await getRecentStravaActivities(validToken)
    const last10Activities = recentActivities.slice(0, 10)
    
    console.log(`[smartSyncStravaAction] Fetched ${last10Activities.length} recent activities from Strava`)
    
    let newCount = 0
    let updatedCount = 0
    let syncedCount = 0
    
    // Process each activity
    for (const activity of last10Activities) {
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
          importedFrom: 'strava-smart-sync',
        }

        if (existingWorkout) {
          await WorkoutModel.findByIdAndUpdate(existingWorkout._id, { $set: workoutData }, { new: true })
          updatedCount++
        } else {
          await WorkoutModel.create(workoutData)
          newCount++
        }
        
        syncedCount++
        console.log(`[smartSyncStravaAction] Processed activity ${activity.id}: ${activity.name}`)
      } catch (activityError) {
        console.error(`[smartSyncStravaAction] Failed to sync activity ${activity.id}:`, activityError)
        // Continue with other activities
      }
    }
    
    console.log(`[smartSyncStravaAction] Completed: ${newCount} new, ${updatedCount} updated, ${deletedCount} deleted, ${syncedCount} total processed`)
    
    // Update last synced timestamp
    await updateStravaLastSynced(userId)
    
    // Revalidate relevant pages
    revalidatePath("/workouts")
    revalidatePath("/dashboard")
    revalidatePath("/integrations")
    revalidatePath("/calendar")
    revalidatePath("/activity")
    
    // Create summary message
    const changes = []
    if (newCount > 0) changes.push(`${newCount} new`)
    if (updatedCount > 0) changes.push(`${updatedCount} updated`)
    if (deletedCount > 0) changes.push(`${deletedCount} deleted`)
    
    const message = changes.length > 0 
      ? `Smart sync completed: ${changes.join(', ')} activities`
      : "All activities are up to date"
    
    return {
      success: true,
      newCount,
      updatedCount,
      deletedCount,
      syncedCount,
      message
    }
  } catch (error) {
    console.error("Error in smartSyncStravaAction:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to perform smart sync"
    return { success: false, error: errorMessage }
  }
}

