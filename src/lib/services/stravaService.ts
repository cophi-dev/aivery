import { getCollection } from "../db/mongodb"
import { ObjectId } from "mongodb"
import { mockIntegrations } from "../db/mock-data"

const DB_NAME = "aivery"
const INTEGRATIONS_COLLECTION = "integrations"
const WORKOUTS_COLLECTION = "workouts"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

export async function connectStrava(userId: string, authCode: string) {
  try {
    console.log(`Connecting Strava for user ${userId} with auth code ${authCode}`)

    // In a real implementation, you would exchange the auth code for tokens
    // using Strava's OAuth API
    const mockTokens = {
      access_token: "mock_access_token",
      refresh_token: "mock_refresh_token",
      expires_at: new Date(Date.now() + 3600 * 1000), // 1 hour from now
    }

    // Store the tokens in the database
    const collection = await getCollection(DB_NAME, INTEGRATIONS_COLLECTION)

    // Check if integration already exists
    const existingIntegration = await collection.findOne({
      userId: new ObjectId(userId),
      provider: "strava",
    })

    if (existingIntegration) {
      // Update existing integration
      await collection.updateOne(
        { _id: existingIntegration._id },
        {
          $set: {
            accessToken: mockTokens.access_token,
            refreshToken: mockTokens.refresh_token,
            expiresAt: mockTokens.expires_at,
            updatedAt: new Date(),
          },
        },
      )
      return { id: existingIntegration._id.toString(), provider: "strava" }
    } else {
      // Create new integration
      const result = await collection.insertOne({
        userId: new ObjectId(userId),
        provider: "strava",
        accessToken: mockTokens.access_token,
        refreshToken: mockTokens.refresh_token,
        expiresAt: mockTokens.expires_at,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      return { id: result.insertedId.toString(), provider: "strava" }
    }
  } catch (error) {
    console.error("Error connecting to Strava:", error)
    // Return mock data if database fails
    return {
      id: mockIntegrations[0]._id.toString(),
      provider: "strava",
    }
  }
}

export async function syncStravaWorkouts(userId: string) {
  try {
    console.log(`Syncing Strava workouts for user ${userId}`)

    // In a real implementation, you would:
    // 1. Get the access token from the database
    // 2. If expired, refresh the token
    // 3. Call Strava API to get workouts
    // 4. Store workouts in the database

    // Mock workouts for demo purposes
    const mockWorkouts = [
      {
        sourceId: "strava_123",
        name: "Evening Ride",
        date: new Date(),
        duration: 90,
        intensity: "Medium",
        type: "cycling",
        distance: 25.8,
        cardioDetails: {
          distance: 25.8,
          duration: 90,
          pace: 3.49,
          elevationGain: 350,
          heartRate: {
            average: 140,
            max: 165,
          },
          power: {
            average: 210,
            max: 450,
          },
          bikeType: "road",
        },
        notes: "Imported from Strava",
      },
      {
        sourceId: "strava_124",
        name: "Lunch Run",
        date: new Date(Date.now() - 86400000), // Yesterday
        duration: 30,
        intensity: "High",
        type: "running",
        distance: 5.0,
        cardioDetails: {
          distance: 5.0,
          duration: 30,
          pace: 6.0,
          elevationGain: 80,
          heartRate: {
            average: 160,
            max: 180,
          },
        },
        notes: "Imported from Strava",
      },
    ]

    // Store workouts in the database
    const workoutsCollection = await getCollection(DB_NAME, WORKOUTS_COLLECTION)
    const integrationCollection = await getCollection(DB_NAME, INTEGRATIONS_COLLECTION)

    let importedCount = 0

    for (const workout of mockWorkouts) {
      // Check if workout already exists
      const existingWorkout = await workoutsCollection.findOne({
        userId: new ObjectId(userId),
        sourceId: workout.sourceId,
        source: "strava",
      })

      if (!existingWorkout) {
        await workoutsCollection.insertOne({
          ...workout,
          userId: new ObjectId(userId),
          source: "strava",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        importedCount++
      }
    }

    // Update last synced timestamp
    await integrationCollection.updateOne(
      { userId: new ObjectId(userId), provider: "strava" },
      { $set: { lastSynced: new Date(), updatedAt: new Date() } },
    )

    return { count: importedCount }
  } catch (error) {
    console.error("Error syncing Strava workouts:", error)
    // Return mock data if database fails
    return { count: 2 }
  }
}

export async function getStravaIntegration(userId: string) {
  try {
    const collection = await getCollection(DB_NAME, INTEGRATIONS_COLLECTION)
    const integration = await collection.findOne({
      userId: new ObjectId(userId),
      provider: "strava",
    })

    if (!integration) {
      return null
    }

    return {
      id: integration._id.toString(),
      provider: integration.provider,
      lastSynced: integration.lastSynced,
    }
  } catch (error) {
    console.error("Error getting Strava integration:", error)
    // Return null if database fails
    return null
  }
}

