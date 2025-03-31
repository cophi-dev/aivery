"use server"

import { revalidatePath } from "next/cache"
import { connectStrava, syncStravaWorkouts, getStravaIntegration, updateStravaSyncPreferences, SUPPORTED_ACTIVITY_TYPES } from "./services/stravaService"
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
    const result = await syncStravaWorkouts(userId)
    
    // Revalidate relevant pages
    revalidatePath("/calendar")
    revalidatePath("/activity")
    revalidatePath("/dashboard")
    revalidatePath("/integrations")
    
    return { 
      success: true, 
      count: result.count,
      types: result.types,
      message: "Successfully synced runs and swims from Strava"
    }
  } catch (error) {
    console.error("Error syncing Strava workouts:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to sync Strava workouts"
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
    return { 
      success: true, 
      subscribed: !!subscription,
      subscription 
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

