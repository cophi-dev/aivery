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
      _id: workout._id.toString(),
      userId: workout.userId.toString(),
      name: workout.name,
      date: workout.date,
      duration: workout.duration,
      intensity: workout.intensity,
      type: workout.type,
      calculatedVolume: workout.calculatedVolume,
      distance: workout.distance,
      workoutExercises: workout.workoutExercises,
      cardioDetails: workout.cardioDetails,
      notes: workout.notes,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
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
    const stats = await getWorkoutStatsDb(userId)
    return stats
  } catch (error) {
    console.error("Error getting workout stats:", error)
    throw new Error("Failed to get workout stats")
  }
}

// Example server action to get user profile
export async function getUserProfile(userId: string = MOCK_USER_ID) {
  try {
    const user = await getUserById(userId)
    const stats = await getUserStats(userId)
    const integrations = await getUserIntegrations(userId)

    return {
      user,
      stats,
      integrations,
    }
  } catch (error) {
    console.error("Error getting user profile:", error)
    throw new Error("Failed to get user profile")
  }
}

