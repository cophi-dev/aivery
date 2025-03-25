"use server"

import { revalidatePath } from "next/cache"
import {
  getWorkoutsByUserId,
  getWorkoutById,
  createWorkout as createWorkoutDb,
  updateWorkout as updateWorkoutDb,
  deleteWorkout as deleteWorkoutDb,
  getWorkoutStats,
  getPreviousWorkouts,
} from "./db/repositories/workoutRepository"
import type { WorkoutData } from "@/types/db"
import { getCurrentUser } from "./auth"

// Fetch all workouts for the current user
export async function fetchWorkouts(): Promise<WorkoutData[]> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }
    return await getWorkoutsByUserId(user.id)
  } catch (error) {
    console.error("Error fetching workouts:", error)
    throw new Error("Failed to fetch workouts")
  }
}

// Fetch a single workout
export async function fetchWorkout(id: string): Promise<WorkoutData | null> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }
    const workout = await getWorkoutById(id)
    // Only return the workout if it belongs to the current user
    if (workout && workout.userId !== user.id) {
      return null
    }
    return workout
  } catch (error) {
    console.error(`Error fetching workout ${id}:`, error)
    throw new Error(`Failed to fetch workout ${id}`)
  }
}

// Create a new workout
export async function createWorkout(workoutData: Partial<WorkoutData>): Promise<WorkoutData> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    const newWorkout = await createWorkoutDb({
      ...workoutData,
      userId: user.id,
      date: new Date(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    revalidatePath("/planner")
    revalidatePath("/workout")

    return newWorkout
  } catch (error) {
    console.error("Error creating workout:", error)
    throw new Error("Failed to create workout")
  }
}

// Update an existing workout
export async function updateWorkout(workoutData: WorkoutData): Promise<WorkoutData> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    // Check if the workout belongs to the current user
    const existingWorkout = await getWorkoutById(workoutData._id)
    if (!existingWorkout || existingWorkout.userId !== user.id) {
      throw new Error("Workout not found or unauthorized")
    }

    const updatedWorkout = await updateWorkoutDb(workoutData._id, {
      ...workoutData,
      updatedAt: new Date().toISOString(),
    })

    if (!updatedWorkout) {
      throw new Error("Workout not found or not updated")
    }

    revalidatePath("/planner")
    revalidatePath(`/workout/${workoutData._id}`)

    return updatedWorkout
  } catch (error) {
    console.error(`Error updating workout ${workoutData._id}:`, error)
    throw new Error(`Failed to update workout ${workoutData._id}`)
  }
}

// Delete a workout
export async function deleteWorkout(id: string): Promise<void> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    // Check if the workout belongs to the current user
    const existingWorkout = await getWorkoutById(id)
    if (!existingWorkout || existingWorkout.userId !== user.id) {
      throw new Error("Workout not found or unauthorized")
    }

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
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    const workout = await getWorkoutById(id)
    if (!workout || workout.userId !== user.id) {
      throw new Error("Workout not found or unauthorized")
    }

    const { _id, ...rest } = workout
    const newWorkout = await createWorkoutDb({
      ...rest,
      userId: user.id,
      date: new Date(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    revalidatePath("/planner")
    revalidatePath("/workout")

    return newWorkout._id
  } catch (error) {
    console.error(`Error copying workout ${id}:`, error)
    throw new Error(`Failed to copy workout ${id}`)
  }
}

// Complete a workout
export async function completeWorkout(id: string, completionData: { duration: number; completedExercises: Array<{ index: number; completed: boolean }> }): Promise<WorkoutData> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    // Check if the workout belongs to the current user
    const existingWorkout = await getWorkoutById(id)
    if (!existingWorkout || existingWorkout.userId !== user.id) {
      throw new Error("Workout not found or unauthorized")
    }

    const updatedWorkout = await updateWorkoutDb(id, {
      ...existingWorkout,
      duration: completionData.duration,
      updatedAt: new Date().toISOString(),
    })

    if (!updatedWorkout) {
      throw new Error("Workout not found or not updated")
    }

    revalidatePath("/planner")
    revalidatePath(`/workout/${id}`)

    return updatedWorkout
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
      userId: workoutData.userId,
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
      userId: workoutData.userId,
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

// Get previous workouts for a specific exercise
export async function getPreviousWorkoutsAction(exerciseName: string): Promise<WorkoutData[]> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }
    return await getPreviousWorkouts(user.id, exerciseName, new Date())
  } catch (error) {
    console.error(`Error getting previous workouts for ${exerciseName}:`, error)
    throw new Error(`Failed to get previous workouts for ${exerciseName}`)
  }
}

// Get workout stats for the current user
export async function getWorkoutStatsAction() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }
    return await getWorkoutStats(user.id)
  } catch (error) {
    console.error("Error getting workout stats:", error)
    throw new Error("Failed to get workout stats")
  }
}

