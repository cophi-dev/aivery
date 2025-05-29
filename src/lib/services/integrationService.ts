import {
  createIntegration,
  getIntegrationByUserAndProvider,
  updateIntegration,
  updateLastSynced,
} from "../db/repositories/integrationRepository"
import { createWorkout } from "../db/repositories/workoutRepository"
import mongoose from "mongoose"
import type { IIntegration } from "../db/models/integration"
import type { Document } from "mongoose"
import type { WorkoutData } from "@/types/db"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

type IntegrationWithDoc = IIntegration & Document

export async function connectGarmin(userId: string, authCode: string) {
  try {
    // In a real app, you would exchange the auth code for tokens
    // This is just a mock implementation
    const accessToken = "mock_access_token"
    const refreshToken = "mock_refresh_token"
    const expiresAt = new Date(Date.now() + 3600 * 1000) // 1 hour from now

    // Check if integration already exists
    const existingIntegration = await getIntegrationByUserAndProvider(userId, "garmin") as IntegrationWithDoc | null

    if (existingIntegration) {
      // Update existing integration
      return await updateIntegration((existingIntegration._id as { toString: () => string }).toString(), {
        accessToken,
        refreshToken,
        expiresAt,
      })
    } else {
      // Create new integration
      return await createIntegration({
        userId: new mongoose.Types.ObjectId(userId),
        provider: "garmin",
        accessToken,
        refreshToken,
        expiresAt,
      })
    }
  } catch (error) {
    console.error("Error connecting to Garmin:", error)
    throw new Error("Failed to connect to Garmin")
  }
}

export async function connectCoros(userId: string, authCode: string) {
  try {
    // In a real app, you would exchange the auth code for tokens
    // This is just a mock implementation
    const accessToken = "mock_access_token"
    const refreshToken = "mock_refresh_token"
    const expiresAt = new Date(Date.now() + 3600 * 1000) // 1 hour from now

    // Check if integration already exists
    const existingIntegration = await getIntegrationByUserAndProvider(userId, "coros") as IntegrationWithDoc | null

    if (existingIntegration) {
      // Update existing integration
      return await updateIntegration((existingIntegration._id as { toString: () => string }).toString(), {
        accessToken,
        refreshToken,
        expiresAt,
      })
    } else {
      // Create new integration
      return await createIntegration({
        userId: new mongoose.Types.ObjectId(userId),
        provider: "coros",
        accessToken,
        refreshToken,
        expiresAt,
      })
    }
  } catch (error) {
    console.error("Error connecting to COROS:", error)
    throw new Error("Failed to connect to COROS")
  }
}

export async function connectStrava(userId: string, authCode: string) {
  try {
    // In a real app, you would exchange the auth code for tokens
    // This is just a mock implementation
    const accessToken = "mock_access_token"
    const refreshToken = "mock_refresh_token"
    const expiresAt = new Date(Date.now() + 3600 * 1000) // 1 hour from now

    // Check if integration already exists
    const existingIntegration = await getIntegrationByUserAndProvider(userId, "strava") as IntegrationWithDoc | null

    if (existingIntegration) {
      // Update existing integration
      return await updateIntegration((existingIntegration._id as { toString: () => string }).toString(), {
        accessToken,
        refreshToken,
        expiresAt,
      })
    } else {
      // Create new integration
      return await createIntegration({
        userId: new mongoose.Types.ObjectId(userId),
        provider: "strava",
        accessToken,
        refreshToken,
        expiresAt,
      })
    }
  } catch (error) {
    console.error("Error connecting to Strava:", error)
    throw new Error("Failed to connect to Strava")
  }
}

export async function syncGarminWorkouts(userId: string) {
  try {
    const integration = await getIntegrationByUserAndProvider(userId, "garmin") as IntegrationWithDoc | null
    if (!integration) {
      throw new Error("Garmin integration not found")
    }

    // In a real app, you would fetch workouts from Garmin's API
    // For now, just update the last synced timestamp without creating mock data
    
    await updateLastSynced((integration._id as { toString: () => string }).toString(), new Date())

    return 0 // Return 0 since we're not creating any workouts
  } catch (error) {
    console.error("Error syncing Garmin workouts:", error)
    throw new Error("Failed to sync Garmin workouts")
  }
}

export async function syncCorosWorkouts(userId: string) {
  try {
    const integration = await getIntegrationByUserAndProvider(userId, "coros") as IntegrationWithDoc | null
    if (!integration) {
      throw new Error("COROS integration not found")
    }

    // In a real app, you would fetch workouts from COROS's API
    // For now, just update the last synced timestamp without creating mock data
    
    await updateLastSynced((integration._id as { toString: () => string }).toString(), new Date())

    return 0 // Return 0 since we're not creating any workouts
  } catch (error) {
    console.error("Error syncing COROS workouts:", error)
    throw new Error("Failed to sync COROS workouts")
  }
}

export async function syncStravaWorkouts(userId: string) {
  try {
    const integration = await getIntegrationByUserAndProvider(userId, "strava") as IntegrationWithDoc | null
    if (!integration) {
      throw new Error("Strava integration not found")
    }

    // In a real app, you would fetch workouts from Strava's API
    // For now, just update the last synced timestamp without creating mock data
    
    await updateLastSynced((integration._id as { toString: () => string }).toString(), new Date())

    return 0 // Return 0 since we're not creating any workouts
  } catch (error) {
    console.error("Error syncing Strava workouts:", error)
    throw new Error("Failed to sync Strava workouts")
  }
}

