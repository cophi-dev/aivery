import {
  createIntegration,
  getIntegrationByUserAndProvider,
  updateIntegration,
  updateLastSynced,
} from "../db/repositories/integrationRepository"
import { createWorkout } from "../db/repositories/workoutRepository"
import { ObjectId } from "mongodb"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

export async function connectGarmin(userId: string, authCode: string) {
  try {
    // In a real app, you would exchange the auth code for tokens
    // This is just a mock implementation
    const accessToken = "mock_access_token"
    const refreshToken = "mock_refresh_token"
    const expiresAt = new Date(Date.now() + 3600 * 1000) // 1 hour from now

    // Check if integration already exists
    const existingIntegration = await getIntegrationByUserAndProvider(userId, "garmin")

    if (existingIntegration) {
      // Update existing integration
      return await updateIntegration(existingIntegration._id.toString(), {
        accessToken,
        refreshToken,
        expiresAt,
      })
    } else {
      // Create new integration
      return await createIntegration({
        userId: new ObjectId(userId),
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
    const existingIntegration = await getIntegrationByUserAndProvider(userId, "coros")

    if (existingIntegration) {
      // Update existing integration
      return await updateIntegration(existingIntegration._id.toString(), {
        accessToken,
        refreshToken,
        expiresAt,
      })
    } else {
      // Create new integration
      return await createIntegration({
        userId: new ObjectId(userId),
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
    const existingIntegration = await getIntegrationByUserAndProvider(userId, "strava")

    if (existingIntegration) {
      // Update existing integration
      return await updateIntegration(existingIntegration._id.toString(), {
        accessToken,
        refreshToken,
        expiresAt,
      })
    } else {
      // Create new integration
      return await createIntegration({
        userId: new ObjectId(userId),
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
    // Get Garmin integration
    const integration = await getIntegrationByUserAndProvider(userId, "garmin")
    if (!integration) {
      throw new Error("Garmin integration not found")
    }

    // In a real app, you would fetch workouts from Garmin API
    // This is just a mock implementation
    const mockWorkouts = [
      {
        sourceId: "garmin_123",
        name: "Morning Run",
        date: new Date(),
        duration: 45,
        intensity: "Medium",
        type: "running",
        distance: 5.2,
        cardioDetails: {
          distance: 5.2,
          duration: 45,
          pace: 8.65,
          elevationGain: 120,
          heartRate: {
            average: 145,
            max: 175,
          },
        },
        notes: "Imported from Garmin",
      },
      {
        sourceId: "garmin_124",
        name: "Strength Training",
        date: new Date(Date.now() - 86400000), // Yesterday
        duration: 60,
        intensity: "High",
        type: "strength",
        volume: 3000,
        exercises: [
          {
            name: "Bench Press",
            sets: [
              { weight: 80, reps: 10 },
              { weight: 85, reps: 8 },
              { weight: 90, reps: 6 },
            ],
          },
          {
            name: "Squats",
            sets: [
              { weight: 100, reps: 10 },
              { weight: 110, reps: 8 },
              { weight: 120, reps: 6 },
            ],
          },
        ],
        notes: "Imported from Garmin",
      },
    ]

    // Save workouts to database
    for (const workoutData of mockWorkouts) {
      await createWorkout({
        userId: new ObjectId(userId),
        ...workoutData,
        source: "garmin",
      })
    }

    // Update last synced timestamp
    await updateLastSynced(integration._id.toString(), new Date())

    return mockWorkouts.length
  } catch (error) {
    console.error("Error syncing Garmin workouts:", error)
    throw new Error("Failed to sync Garmin workouts")
  }
}

export async function syncCorosWorkouts(userId: string) {
  try {
    // Get COROS integration
    const integration = await getIntegrationByUserAndProvider(userId, "coros")
    if (!integration) {
      throw new Error("COROS integration not found")
    }

    // In a real app, you would fetch workouts from COROS API
    // This is just a mock implementation
    const mockWorkouts = [
      {
        sourceId: "coros_123",
        name: "Trail Run",
        date: new Date(),
        duration: 60,
        intensity: "High",
        type: "running",
        distance: 8.5,
        cardioDetails: {
          distance: 8.5,
          duration: 60,
          pace: 7.06,
          elevationGain: 250,
          heartRate: {
            average: 155,
            max: 185,
          },
        },
        notes: "Imported from COROS",
      },
      {
        sourceId: "coros_124",
        name: "Swimming",
        date: new Date(Date.now() - 86400000), // Yesterday
        duration: 30,
        intensity: "Medium",
        type: "swimming",
        distance: 1.5,
        cardioDetails: {
          distance: 1.5,
          duration: 30,
          pace: 20,
          heartRate: {
            average: 135,
            max: 155,
          },
          laps: [
            { number: 1, distance: 50, duration: 45 },
            { number: 2, distance: 50, duration: 43 },
            { number: 3, distance: 50, duration: 44 },
          ],
          poolLength: 25,
          strokeType: "freestyle",
        },
        notes: "Imported from COROS",
      },
    ]

    // Save workouts to database
    for (const workoutData of mockWorkouts) {
      await createWorkout({
        userId: new ObjectId(userId),
        ...workoutData,
        source: "coros",
      })
    }

    // Update last synced timestamp
    await updateLastSynced(integration._id.toString(), new Date())

    return mockWorkouts.length
  } catch (error) {
    console.error("Error syncing COROS workouts:", error)
    throw new Error("Failed to sync COROS workouts")
  }
}

export async function syncStravaWorkouts(userId: string) {
  try {
    // Get Strava integration
    const integration = await getIntegrationByUserAndProvider(userId, "strava")
    if (!integration) {
      throw new Error("Strava integration not found")
    }

    // In a real app, you would fetch workouts from Strava API
    // This is just a mock implementation
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

    // Save workouts to database
    for (const workoutData of mockWorkouts) {
      await createWorkout({
        userId: new ObjectId(userId),
        ...workoutData,
        source: "strava",
      })
    }

    // Update last synced timestamp
    await updateLastSynced(integration._id.toString(), new Date())

    return mockWorkouts.length
  } catch (error) {
    console.error("Error syncing Strava workouts:", error)
    throw new Error("Failed to sync Strava workouts")
  }
}

