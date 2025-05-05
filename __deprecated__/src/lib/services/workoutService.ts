import { getDbClient } from "../db/connection"
import type { WorkoutData } from "@/types/db"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Mock workouts for fallback
// const mockWorkouts: WorkoutData[] = [
//  DELETED MOCK DATA BLOCK TO FIX BUILD ERRORS
//];
const mockWorkouts: WorkoutData[] = []; // Return empty array

// Get all workouts
export async function getWorkouts(): Promise<WorkoutData[]> {
  try {
    const dbClient = await getDbClient()
    const workouts = await dbClient.findWorkouts()

    if (workouts.length === 0) {
      return mockWorkouts
    }

    return workouts as WorkoutData[]
  } catch (error) {
    console.error("Error getting workouts:", error)
    return mockWorkouts
  }
}

// Get a workout by ID
export async function getWorkout(id: string): Promise<WorkoutData | null> {
  try {
    const dbClient = await getDbClient()
    const workout = await dbClient.findWorkoutById(id)

    if (!workout) {
      return mockWorkouts.find((w) => w._id === id) || null
    }

    return workout as WorkoutData
  } catch (error) {
    console.error(`Error getting workout ${id}:`, error)
    return mockWorkouts.find((w) => w._id === id) || null
  }
}

// Create a new workout
export async function createWorkout(workoutData: Partial<WorkoutData>): Promise<WorkoutData> {
  try {
    // Calculate volume based on exercises
    let volume = 0
    if (workoutData.workoutExercises) {
      for (const exercise of workoutData.workoutExercises) {
        if (exercise.sets && Array.isArray(exercise.sets)) {
          for (const set of exercise.sets) {
            volume += (set.weight ?? 0) * (set.reps ?? 0)
          }
        }
      }
    }

    const workout = {
      ...workoutData,
      userId: MOCK_USER_ID,
      calculatedVolume: volume,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      workoutExercises: workoutData.workoutExercises || [],
    }

    delete (workout as any).volume
    delete (workout as any).exercises

    const dbClient = await getDbClient()
    const result = await dbClient.insertWorkout(workout)

    return {
      ...workout,
      _id: result.id,
    } as WorkoutData
  } catch (error) {
    console.error("Error creating workout:", error)

    // Create a mock workout
    const newWorkout = {
      _id: Date.now().toString(),
      userId: MOCK_USER_ID,
      name: workoutData.name || "Untitled Workout",
      date: workoutData.date || new Date(),
      duration: workoutData.duration || 60,
      intensity: workoutData.intensity || "Medium",
      type: workoutData.type || "strength",
      calculatedVolume: 0,
      workoutExercises: workoutData.workoutExercises || [],
      notes: workoutData.notes || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    return newWorkout as WorkoutData
  }
}

// Update a workout
export async function updateWorkout(id: string, workoutData: Partial<WorkoutData>): Promise<boolean> {
  try {
    const dbClient = await getDbClient()
    return await dbClient.updateWorkout(id, {
      ...workoutData,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error(`Error updating workout ${id}:`, error)
    return false
  }
}

// Delete a workout
export async function deleteWorkout(id: string): Promise<boolean> {
  try {
    const dbClient = await getDbClient()
    return await dbClient.deleteWorkout(id)
  } catch (error) {
    console.error(`Error deleting workout ${id}:`, error)
    return false
  }
}

