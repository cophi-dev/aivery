"use server"

import { revalidatePath } from "next/cache"
import { connectStrava, syncStravaWorkouts, getStravaIntegration } from "./services/stravaService"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

export async function connectStravaAction(authCode: string) {
  try {
    const result = await connectStrava(MOCK_USER_ID, authCode)
    revalidatePath("/integrations")
    return { success: true, data: result }
  } catch (error) {
    console.error("Error connecting to Strava:", error)
    return { success: false, error: "Failed to connect to Strava" }
  }
}

export async function syncStravaWorkoutsAction() {
  try {
    const result = await syncStravaWorkouts(MOCK_USER_ID)
    revalidatePath("/planner")
    revalidatePath("/activity")
    revalidatePath("/integrations")
    return { success: true, count: result.count }
  } catch (error) {
    console.error("Error syncing Strava workouts:", error)
    return { success: false, error: "Failed to sync Strava workouts" }
  }
}

export async function getStravaIntegrationAction() {
  try {
    const integration = await getStravaIntegration(MOCK_USER_ID)
    return { success: true, integration }
  } catch (error) {
    console.error("Error getting Strava integration:", error)
    return { success: false, error: "Failed to get Strava integration" }
  }
}

