"use server"
import { getWorkoutsByUserId, getWorkoutStats as getWorkoutStatsDb } from "./db/repositories/workoutRepository"
import { getUserById, getUserStats } from "./db/repositories/userRepository"
import { getUserIntegrations } from "./db/repositories/integrationRepository"
import type { WorkoutData, ChatMessage } from "@/types/db"

// Mock user ID for demo purposes
// In a real app, you would get this from the session
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01" // This should be a valid ObjectId

// Example server action to get user workouts
export async function fetchUserWorkouts(userId: string = MOCK_USER_ID): Promise<WorkoutData[]> {
  try {
    const workouts = await getWorkoutsByUserId(userId)
    return workouts.map((workout) => ({
      id: workout._id.toString(),
      userId: workout.userId.toString(),
      name: workout.name,
      date: workout.date,
      duration: workout.duration,
      intensity: workout.intensity,
      type: workout.type,
      volume: workout.volume,
      distance: workout.distance,
      exercises: workout.exercises,
      cardioDetails: workout.cardioDetails,
      notes: workout.notes,
      completed: workout.completed,
      completedAt: workout.completedAt,
    }))
  } catch (error) {
    console.error("Error fetching user workouts:", error)
    throw new Error("Failed to fetch workouts")
  }
}

// Example server action to save a chat message
export async function saveUserChatMessage(message: Omit<ChatMessage, "id" | "timestamp">): Promise<void> {
  try {
    // In a real app, you would save this to your database
    console.log("Saving chat message:", message)
  } catch (error) {
    console.error("Error saving chat message:", error)
    throw new Error("Failed to save chat message")
  }
}

// Example server action to get workout statistics
export async function getWorkoutStats(userId: string = MOCK_USER_ID) {
  try {
    return await getWorkoutStatsDb(userId)
  } catch (error) {
    console.error("Error getting workout stats:", error)
    throw new Error("Failed to get workout statistics")
  }
}

// Get user profile and stats
export async function getUserProfile(userId: string = MOCK_USER_ID) {
  try {
    const user = await getUserById(userId)
    if (!user) {
      throw new Error("User not found")
    }

    const stats = await getUserStats(userId)
    const integrations = await getUserIntegrations(userId)

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      stats,
      integrations: integrations.map((integration) => ({
        id: integration._id.toString(),
        provider: integration.provider,
        lastSynced: integration.lastSynced,
      })),
    }
  } catch (error) {
    console.error("Error getting user profile:", error)
    throw new Error("Failed to get user profile")
  }
}

