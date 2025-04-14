"use server"

import { revalidatePath } from "next/cache"
import {
  getWorkoutExercisesByWorkoutId,
  getWorkoutExerciseById,
  createWorkoutExercise,
  updateWorkoutExercise,
  deleteWorkoutExercise,
  deleteWorkoutExercisesByWorkoutId,
} from "./db/repositories/workoutExerciseRepository"
import { getWorkoutById } from "./db/repositories/workoutRepository"
import { getExerciseById } from "./db/repositories/exerciseRepository"
import type { WorkoutExerciseData } from "@/types/db"
import { getCurrentUser } from "./auth"

// Fetch all workout exercises for a workout
export async function fetchWorkoutExercises(workoutId: string): Promise<WorkoutExerciseData[]> {
  try {
    // First ensure we have a user
    const user = await getCurrentUser()
    if (!user) {
      console.warn("User not authenticated in fetchWorkoutExercises");
      return []; 
    }

    // Check if the workout belongs to the current user
    const workout = await getWorkoutById(workoutId)
    if (!workout || workout.userId !== user.id) {
      console.warn("Workout not found or unauthorized");
      return []; 
    }

    return await getWorkoutExercisesByWorkoutId(workoutId);
  } catch (error) {
    console.error(`Error fetching workout exercises for workout ${workoutId}:`, error);
    return []; 
  }
}

// Fetch a single workout exercise
export async function fetchWorkoutExercise(id: string): Promise<WorkoutExerciseData | null> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    const workoutExercise = await getWorkoutExerciseById(id)
    if (!workoutExercise) {
      return null
    }

    // Check if the workout belongs to the current user
    const workout = await getWorkoutById(workoutExercise.workoutId)
    if (!workout || workout.userId !== user.id) {
      return null
    }

    return workoutExercise
  } catch (error) {
    console.error(`Error fetching workout exercise ${id}:`, error);
    return null;
  }
}

// Add an exercise to a workout
export async function addExerciseToWorkout(workoutId: string, exerciseId: string, sets: Array<{weight: number, reps: number}>): Promise<WorkoutExerciseData | null> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    // Check if the workout belongs to the current user
    const workout = await getWorkoutById(workoutId)
    if (!workout || workout.userId !== user.id) {
      throw new Error("Workout not found or unauthorized")
    }

    // Fetch exercise details to get name and category
    const exerciseDetails = await getExerciseById(exerciseId); 
    if (!exerciseDetails) {
        console.error(`Exercise with ID ${exerciseId} not found.`);
        throw new Error(`Exercise with ID ${exerciseId} not found.`);
    }

    const workoutExerciseData: Partial<WorkoutExerciseData> = {
      workoutId,
      // Construct the exerciseId object as required by the type
      exerciseId: {
          _id: exerciseId, 
          name: exerciseDetails.name, // Use fetched name
          category: exerciseDetails.category // Use fetched category (optional)
      },
      sets: sets || [{weight: 0, reps: 0}]
    }

    const newWorkoutExercise = await createWorkoutExercise(workoutExerciseData)
    
    revalidatePath(`/workout/${workoutId}`)
    revalidatePath(`/workout/edit/${workoutId}`)
    
    return newWorkoutExercise
  } catch (error) {
    console.error("Error adding exercise to workout:", error)
    throw new Error(error instanceof Error ? error.message : "Failed to add exercise to workout")
  }
}

// Update workout exercise sets
export async function updateWorkoutExerciseSets(id: string, sets: Array<{weight: number, reps: number}>, notes?: string): Promise<WorkoutExerciseData | null> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    const workoutExercise = await getWorkoutExerciseById(id)
    if (!workoutExercise) {
      throw new Error("Workout exercise not found")
    }

    // Check if the workout belongs to the current user
    const workout = await getWorkoutById(workoutExercise.workoutId)
    if (!workout || workout.userId !== user.id) {
      throw new Error("Workout not found or unauthorized")
    }

    const updatedWorkoutExercise = await updateWorkoutExercise(id, { sets, notes })
    
    revalidatePath(`/workout/${workoutExercise.workoutId}`)
    revalidatePath(`/workout/edit/${workoutExercise.workoutId}`)
    
    return updatedWorkoutExercise
  } catch (error) {
    console.error(`Error updating workout exercise ${id}:`, error)
    throw new Error(error instanceof Error ? error.message : `Failed to update workout exercise ${id}`)
  }
}

// Remove an exercise from a workout
export async function removeExerciseFromWorkout(id: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    const workoutExercise = await getWorkoutExerciseById(id)
    if (!workoutExercise) {
      throw new Error("Workout exercise not found")
    }

    // Check if the workout belongs to the current user
    const workout = await getWorkoutById(workoutExercise.workoutId)
    if (!workout || workout.userId !== user.id) {
      throw new Error("Workout not found or unauthorized")
    }

    const success = await deleteWorkoutExercise(id)
    
    revalidatePath(`/workout/${workoutExercise.workoutId}`)
    revalidatePath(`/workout/edit/${workoutExercise.workoutId}`)
    
    return success
  } catch (error) {
    console.error(`Error removing exercise from workout ${id}:`, error)
    throw new Error(`Failed to remove exercise from workout ${id}`)
  }
}

// Remove all exercises from a workout
export async function removeAllExercisesFromWorkout(workoutId: string): Promise<boolean> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    // Check if the workout belongs to the current user
    const workout = await getWorkoutById(workoutId)
    if (!workout || workout.userId !== user.id) {
      throw new Error("Workout not found or unauthorized")
    }

    const success = await deleteWorkoutExercisesByWorkoutId(workoutId)
    
    revalidatePath(`/workout/${workoutId}`)
    revalidatePath(`/workout/edit/${workoutId}`)
    
    return success
  } catch (error) {
    console.error(`Error removing all exercises from workout ${workoutId}:`, error)
    throw new Error(`Failed to remove all exercises from workout ${workoutId}`)
  }
} 