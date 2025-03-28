"use server"

import { revalidatePath } from "next/cache"
import {
  getAllExercises,
  getExercisesByCategory,
  getExercisesByMuscleGroup,
  getExerciseById,
  getExerciseByName,
  createExercise,
  updateExercise,
  deleteExercise,
} from "./db/repositories/exerciseRepository"
import type { ExerciseData, WorkoutExerciseData } from "@/types/db"
import { getCurrentUser } from "./auth"
import { 
  getWorkoutExercisesByExerciseId 
} from "@/lib/db/repositories/workoutExerciseRepository"
import { getSession } from "next-auth/react"

// Fetch all exercises
export async function fetchExercises(): Promise<ExerciseData[]> {
  try {
    return await getAllExercises();
  } catch (error) {
    console.error("Error fetching exercises:", error);
    return []; 
  }
}

// Fetch exercises by category
export async function fetchExercisesByCategory(category: string): Promise<ExerciseData[]> {
  try {
    return await getExercisesByCategory(category);
  } catch (error) {
    console.error(`Error fetching exercises by category ${category}:`, error);
    return []; 
  }
}

// Fetch exercises by muscle group
export async function fetchExercisesByMuscleGroup(muscleGroup: string): Promise<ExerciseData[]> {
  try {
    return await getExercisesByMuscleGroup(muscleGroup);
  } catch (error) {
    console.error(`Error fetching exercises by muscle group ${muscleGroup}:`, error);
    return []; 
  }
}

// Fetch a single exercise
export async function fetchExercise(id: string): Promise<ExerciseData | null> {
  try {
    return await getExerciseById(id);
  } catch (error) {
    console.error(`Error fetching exercise ${id}:`, error);
    return null;
  }
}

// Fetch a single exercise by name
export async function fetchExerciseByName(name: string): Promise<ExerciseData | null> {
  try {
    return await getExerciseByName(name);
  } catch (error) {
    console.error(`Error fetching exercise by name ${name}:`, error);
    return null;
  }
}

// Create a new exercise
export async function createExerciseAction(exerciseData: Partial<ExerciseData>): Promise<ExerciseData | null> {
  try {
    // Ensure user is authenticated (admin check could be added here)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated");
    }

    // Check if an exercise with the same name already exists
    const existingExercise = await getExerciseByName(exerciseData.name || "");
    if (existingExercise) {
      throw new Error("An exercise with this name already exists");
    }

    const newExercise = await createExercise(exerciseData);
    
    revalidatePath("/workout/new");
    revalidatePath("/exercises");
    
    return newExercise;
  } catch (error) {
    console.error("Error creating exercise:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to create exercise");
  }
}

// Update an existing exercise
export async function updateExerciseAction(id: string, exerciseData: Partial<ExerciseData>): Promise<ExerciseData | null> {
  try {
    // Ensure user is authenticated (admin check could be added here)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated");
    }

    // If name is changing, check if the new name already exists for a different exercise
    if (exerciseData.name) {
      const existingExercise = await getExerciseByName(exerciseData.name);
      if (existingExercise && existingExercise._id !== id) {
        throw new Error("An exercise with this name already exists");
      }
    }

    const updatedExercise = await updateExercise(id, exerciseData);
    
    revalidatePath("/workout/new");
    revalidatePath("/exercises");
    revalidatePath(`/exercises/${id}`);
    
    return updatedExercise;
  } catch (error) {
    console.error(`Error updating exercise ${id}:`, error);
    throw new Error(error instanceof Error ? error.message : `Failed to update exercise ${id}`);
  }
}

// Delete an exercise
export async function deleteExerciseAction(id: string): Promise<boolean> {
  try {
    // Ensure user is authenticated (admin check could be added here)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated");
    }

    const success = await deleteExercise(id);
    
    revalidatePath("/workout/new");
    revalidatePath("/exercises");
    
    return success;
  } catch (error) {
    console.error(`Error deleting exercise ${id}:`, error);
    throw new Error(`Failed to delete exercise ${id}`);
  }
}

// Function to get exercise history
export async function getExerciseHistory(exerciseId: string): Promise<WorkoutExerciseData[]> {
  try {
    const workoutExercises = await getWorkoutExercisesByExerciseId(exerciseId)
    return workoutExercises
  } catch (error) {
    console.error("Error fetching exercise history:", error)
    throw new Error("Failed to fetch exercise history")
  }
} 