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

    // Format the workout data
    const formattedWorkoutData = {
      name: workoutData.name,
      date: workoutData.date ? new Date(workoutData.date) : new Date(),
      duration: workoutData.duration,
      intensity: workoutData.intensity,
      notes: workoutData.notes,
      type: workoutData.type || "strength", // Default to strength if type not provided
      exercises: workoutData.exercises?.map(exercise => ({
        name: exercise.name,
        sets: exercise.sets.map(set => ({
          weight: set.weight,
          reps: set.reps
        }))
      })),
      userId: user.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const newWorkout = await createWorkoutDb(formattedWorkoutData)
    
    // Update the user's workouts array
    const dbConnect = (await import("@/lib/db/mongoose")).default;
    const UserModel = (await import("@/lib/db/models/user")).default;
    
    await dbConnect();
    await UserModel.findByIdAndUpdate(
      user.id,
      { $push: { workouts: newWorkout._id } }
    );

    revalidatePath("/calendar")
    revalidatePath("/workout")
    revalidatePath("/workouts")
    revalidatePath("/dashboard")
    revalidatePath("/activity")

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

    revalidatePath("/calendar")
    revalidatePath(`/workout/${workoutData._id}`)
    revalidatePath(`/activity/${workoutData._id}`)
    revalidatePath('/activity')
    revalidatePath('/dashboard')

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
    
    // Remove workout from user's workouts array
    const dbConnect = (await import("@/lib/db/mongoose")).default;
    const UserModel = (await import("@/lib/db/models/user")).default;
    
    await dbConnect();
    await UserModel.findByIdAndUpdate(
      user.id,
      { $pull: { workouts: id } }
    );

    revalidatePath("/calendar")
    revalidatePath("/workouts")
    revalidatePath("/dashboard")
    revalidatePath("/activity")
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

    revalidatePath("/calendar")
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

    revalidatePath("/calendar")
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

    revalidatePath("/calendar")

    return newWorkout._id
  } catch (error) {
    console.error("Error creating workout from existing:", error)
    throw new Error("Failed to create workout from existing")
  }
}

// Calculate total weight lifted in a workout
export function calculateTotalWeightLifted(workout: any): number {
  if (!workout?.exercises || !Array.isArray(workout.exercises)) {
    return 0;
  }
  
  return workout.exercises.reduce((total: number, exercise: any) => {
    if (!exercise.sets || !Array.isArray(exercise.sets)) {
      return total;
    }
    
    const exerciseTotal = exercise.sets.reduce((setTotal: number, set: any) => {
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      return setTotal + (weight * reps);
    }, 0);
    
    return total + exerciseTotal;
  }, 0);
}

// Create a cardio workout
export async function createCardioWorkout(workoutData: any): Promise<string> {
  try {
    console.log("Creating workout with data:", JSON.stringify(workoutData));
    
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }

    // Ensure distance is a number or null, not undefined
    const cleanedWorkoutData = {
      ...workoutData,
      userId: user.id,
      distance: workoutData.distance !== undefined ? workoutData.distance : null,
      cardioDetails: workoutData.cardioDetails ? {
        ...workoutData.cardioDetails,
        distance: workoutData.cardioDetails.distance !== undefined ? workoutData.cardioDetails.distance : null
      } : null
    };

    const newWorkout = await createWorkoutDb(cleanedWorkoutData)

    revalidatePath("/calendar")
    revalidatePath("/activity")
    revalidatePath("/dashboard")
    revalidatePath("/")

    return newWorkout._id
  } catch (error) {
    console.error("Detailed error in createCardioWorkout:", error);
    throw error;
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
    const previousWorkouts = await getPreviousWorkouts(
      workout.userId, 
      workout.name || 'Unknown', // Provide a default value if name is undefined
      new Date(workout.date), 
      3
    )

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

