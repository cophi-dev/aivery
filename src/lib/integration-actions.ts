"use server"

import { revalidatePath } from "next/cache"
import {
  connectGarmin,
  connectCoros,
  connectStrava,
  syncGarminWorkouts,
  syncCorosWorkouts,
  syncStravaWorkouts,
} from "./services/integrationService"
import { getUserIntegrations } from "./db/repositories/integrationRepository"
import type { IIntegration } from "./db/models/integration"
import type { Document } from "mongoose"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

export async function connectGarminAction(authCode: string) {
  try {
    await connectGarmin(MOCK_USER_ID, authCode)
    revalidatePath("/settings")
    revalidatePath("/integrations")
    return { success: true }
  } catch (error) {
    console.error("Error connecting to Garmin:", error)
    return { success: false, error: "Failed to connect to Garmin" }
  }
}

export async function connectCorosAction(authCode: string) {
  try {
    await connectCoros(MOCK_USER_ID, authCode)
    revalidatePath("/settings")
    revalidatePath("/integrations")
    return { success: true }
  } catch (error) {
    console.error("Error connecting to COROS:", error)
    return { success: false, error: "Failed to connect to COROS" }
  }
}

export async function connectStravaAction(authCode: string) {
  try {
    await connectStrava(MOCK_USER_ID, authCode)
    revalidatePath("/settings")
    revalidatePath("/integrations")
    return { success: true }
  } catch (error) {
    console.error("Error connecting to Strava:", error)
    return { success: false, error: "Failed to connect to Strava" }
  }
}

export async function syncGarminWorkoutsAction() {
  try {
    const count = await syncGarminWorkouts(MOCK_USER_ID)
    revalidatePath("/planner")
    revalidatePath("/activity")
    return { success: true, count }
  } catch (error) {
    console.error("Error syncing Garmin workouts:", error)
    return { success: false, error: "Failed to sync Garmin workouts" }
  }
}

export async function syncCorosWorkoutsAction() {
  try {
    const count = await syncCorosWorkouts(MOCK_USER_ID)
    revalidatePath("/planner")
    revalidatePath("/activity")
    return { success: true, count }
  } catch (error) {
    console.error("Error syncing COROS workouts:", error)
    return { success: false, error: "Failed to sync COROS workouts" }
  }
}

export async function syncStravaWorkoutsAction() {
  try {
    const count = await syncStravaWorkouts(MOCK_USER_ID)
    revalidatePath("/planner")
    revalidatePath("/activity")
    return { success: true, count }
  } catch (error) {
    console.error("Error syncing Strava workouts:", error)
    return { success: false, error: "Failed to sync Strava workouts" }
  }
}

export async function getUserIntegrationsAction() {
  try {
    const integrations = await getUserIntegrations(MOCK_USER_ID)
    return {
      success: true,
      integrations: integrations.map((integration: IIntegration & Document) => ({
        id: (integration._id as { toString: () => string }).toString(),
        provider: integration.provider,
        lastSynced: integration.lastSynced,
      })),
    }
  } catch (error) {
    console.error("Error getting user integrations:", error)
    return { success: false, error: "Failed to get user integrations" }
  }
}

