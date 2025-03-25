"use server"

import { revalidatePath } from "next/cache"
import {
  getUserWorkouts,
  getWorkoutById,
  createWorkout as createWorkoutDb,
  updateWorkout as updateWorkoutDb,
  deleteWorkout as deleteWorkoutDb,
  getWorkoutStats,
  getPreviousWorkouts,
} from "./db/repositories/workoutRepository"
import type { WorkoutData } from "@/types/db"

// Mock user ID for demo purposes
// In a real app, you would get this from the session
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Fetch all workouts
export async function fetchWorkouts(): Promise<WorkoutData[]> {
  try {
    return await getUserWorkouts(MOCK_USER_ID)
  } catch (error) {
    console.error("Error fetching workouts:", error)
    throw new Error("Failed to fetch workouts")
  }
}

// Fetch a single workout
export async function fetchWorkout(id: string): Promise<WorkoutData | null> {
  try {
    return await getWorkoutById(id)
  } catch (error) {
    console.error(`Error fetching workout ${id}:`, error)
    throw new Error(`Failed to fetch workout ${id}`)
  }
}

// Create a new workout
export async function createWorkout(workoutData: Partial<WorkoutData>): Promise<WorkoutData> {
  try {
    const newWorkout = await createWorkoutDb({
      ...workoutData,
      userId: MOCK_USER_ID,
    })

    revalidatePath("/planner")
    revalidatePath("/workout")
    
    // Serialize dates to ISO strings to prevent serialization issues
    return {
      ...newWorkout,
      date: newWorkout.date instanceof Date ? newWorkout.date.toISOString() : newWorkout.date,
      createdAt: newWorkout.createdAt instanceof Date ? newWorkout.createdAt.toISOString() : newWorkout.createdAt,
      updatedAt: newWorkout.updatedAt instanceof Date ? newWorkout.updatedAt.toISOString() : newWorkout.updatedAt,
      completedAt: newWorkout.completedAt instanceof Date ? newWorkout.completedAt.toISOString() : newWorkout.completedAt,
    } as WorkoutData
  } catch (error) {
    console.error("Error creating workout:", error)
    throw new Error("Failed to create workout")
  }
}

// Update an existing workout
export async function updateWorkout(workoutData: WorkoutData): Promise<WorkoutData> {
  try {
    const updatedWorkout = await updateWorkoutDb(workoutData.id, workoutData)

    if (!updatedWorkout) {
      throw new Error("Workout not found or not updated")
    }

    revalidatePath("/planner")
    revalidatePath(`/workout/${workoutData.id}`)

    return updatedWorkout
  } catch (error) {
    console.error(`Error updating workout ${workoutData.id}:`, error)
    throw new Error(`Failed to update workout ${workoutData.id}`)
  }
}

// Delete a workout
export async function deleteWorkout(id: string): Promise<void> {
  try {
    const success = await deleteWorkoutDb(id)

    if (!success) {
      throw new Error("Workout not found or not deleted")
    }

    revalidatePath("/planner")
  } catch (error) {
    console.error(`Error deleting workout ${id}:`, error)
    throw new Error(`Failed to delete workout ${id}`)
  }
}

// Copy a workout to today's date
export async function copyWorkoutToToday(id: string): Promise<string> {
  try {
    const workout = await getWorkoutById(id)

    if (!workout) {
      throw new Error("Workout not found")
    }

    const { id: _, date, createdAt, updatedAt, ...rest } = workout

    const newWorkout = await createWorkoutDb({
      ...rest,
      userId: MOCK_USER_ID,
      date: new Date(),
    })

    revalidatePath("/planner")

    return newWorkout.id
  } catch (error) {
    console.error(`Error copying workout ${id}:`, error)
    throw new Error(`Failed to copy workout ${id}`)
  }
}

// Complete a workout
export async function completeWorkout(
  id: string,
  completionData: {
    duration: number
    completedExercises: { index: number; completed: boolean }[]
  },
): Promise<void> {
  try {
    const workout = await getWorkoutById(id)

    if (!workout) {
      throw new Error("Workout not found")
    }

    await updateWorkoutDb(id, {
      duration: completionData.duration,
      completed: true,
      completedAt: new Date(),
    })

    revalidatePath("/planner")
    revalidatePath(`/workout/${id}`)
  } catch (error) {
    console.error(`Error completing workout ${id}:`, error)
    throw new Error(`Failed to complete workout ${id}`)
  }
}

// Create a workout from existing data
export async function createWorkoutFromExisting(workoutData: any): Promise<string> {
  try {
    const newWorkout = await createWorkoutDb({
      ...workoutData,
      userId: MOCK_USER_ID,
    })

    revalidatePath("/planner")

    return newWorkout.id
  } catch (error) {
    console.error("Error creating workout from existing:", error)
    throw new Error("Failed to create workout from existing")
  }
}

// Create a cardio workout
export async function createCardioWorkout(workoutData: any): Promise<string> {
  try {
    const newWorkout = await createWorkoutDb({
      ...workoutData,
      userId: MOCK_USER_ID,
    })

    revalidatePath("/planner")
    revalidatePath("/activity")

    return newWorkout.id
  } catch (error) {
    console.error("Error creating cardio workout:", error)
    throw new Error("Failed to create cardio workout")
  }
}

// Fetch workout data formatted for AI analysis
export async function fetchWorkoutForAI(id: string): Promise<any> {
  try {
    const workout = await getWorkoutById(id)

    if (!workout) {
      return null
    }

    // Get previous workouts of the same type for comparison
    const previousWorkouts = await getPreviousWorkouts(workout.userId, workout.name, new Date(workout.date), 3)

    return {
      ...workout,
      previousWorkouts: previousWorkouts.length > 0 ? previousWorkouts : undefined,
    }
  } catch (error) {
    console.error(`Error fetching workout ${id} for AI:`, error)
    throw new Error(`Failed to fetch workout ${id} for AI`)
  }
}

// Get workout statistics
export async function getWorkoutStatsAction() {
  try {
    return await getWorkoutStats(MOCK_USER_ID)
  } catch (error) {
    console.error("Error getting workout stats:", error)
    throw new Error("Failed to get workout stats")
  }
}

