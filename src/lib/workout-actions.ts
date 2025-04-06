"use server"

import { revalidatePath } from "next/cache"
import {
  getWorkoutsByUserId,
  getWorkoutById,
  createWorkout as createWorkoutDb,
  deleteWorkout as deleteWorkoutDb,
  getPreviousWorkouts,
  updateWorkoutInDatabase,
} from "./db/repositories/workoutRepository"
import type { WorkoutData } from "@/types/db"
import { getCurrentUser } from "./auth"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ObjectId } from 'mongodb'

// Fetch all workouts for the current user
export async function fetchWorkouts(): Promise<WorkoutData[]> {
  try {
    // First ensure we have a user
    const user = await getCurrentUser()
    if (!user) {
      console.warn("User not authenticated in fetchWorkouts");
      return []; // Return empty array instead of throwing
    }

    // Validate user.id is present
    if (!user.id) {
      console.warn("User ID is missing in fetchWorkouts");
      return []; // Return empty array instead of throwing
    }

    // Try to get workouts
    try {
      return await getWorkoutsByUserId(user.id);
    } catch (dbError) {
      console.error("Database error in fetchWorkouts:", dbError);
      return []; // Return empty array instead of throwing
    }
  } catch (error) {
    console.error("Error fetching workouts:", error);
    return []; // Return empty array instead of throwing
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
export async function updateWorkout(workoutId: string, workoutData: Partial<Omit<WorkoutData, '_id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<WorkoutData | null> {
  'use server'
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  if (!ObjectId.isValid(workoutId)) {
     throw new Error("Invalid Workout ID provided for update.");
  }
  
  // Optional: Fetch the workout first to ensure the user owns it
  const existingWorkout = await getWorkoutById(workoutId);
  if (!existingWorkout) {
      throw new Error("Workout not found.");
  }
  if (existingWorkout.userId?.toString() !== session.user.id) {
      throw new Error("You do not have permission to update this workout.");
  }

  try {
    const updatedWorkout = await updateWorkoutInDatabase(workoutId, workoutData);
    if (!updatedWorkout) {
      throw new Error("Failed to update workout in database.");
    }

    // Revalidate relevant paths
    revalidatePath('/workouts');
    revalidatePath(`/workout/${workoutId}`);
    revalidatePath(`/workouts/new`); // Revalidate form page in case user goes back

    return updatedWorkout;
  } catch (error) {
    console.error("Error in updateWorkout server action:", error);
    // Re-throw or return a specific error structure
    throw error instanceof Error ? error : new Error("Failed to update workout due to an unexpected error.");
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

    const updatedWorkout = await updateWorkoutInDatabase(id, {
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
export async function calculateTotalWeightLifted(workout: any): Promise<number> {
  if (!workout?.exercises || !Array.isArray(workout.exercises)) {
    return 0;
  }

  let totalWeight = 0;

  for (const exercise of workout.exercises) {
    if (exercise.sets && Array.isArray(exercise.sets)) {
      for (const set of exercise.sets) {
        if (set.weight && set.reps) {
          totalWeight += set.weight * set.reps;
        }
      }
    }
  }

  return totalWeight;
}

// Create a new cardio workout
export async function createCardioWorkout(workoutData: Partial<WorkoutData>): Promise<WorkoutData> {
  try {
    console.log('Starting cardio workout creation...');
    console.log('Input workout data:', JSON.stringify(workoutData, null, 2));

    const user = await getCurrentUser();
    if (!user) {
      console.error('No authenticated user found');
      throw new Error("User not authenticated");
    }
    console.log('User authenticated:', user.id);

    // Extract Strava link from notes if it exists but stravaLink is not set
    let stravaLink = workoutData.stravaLink;
    if (!stravaLink && workoutData.notes) {
      const stravaLinkRegex = /https:\/\/www\.strava\.com\/activities\/(\d+)/;
      const match = workoutData.notes.match(stravaLinkRegex);
      if (match && match[0]) {
        stravaLink = match[0];
        console.log('Extracted Strava link:', stravaLink);
      }
    }

    // Format the workout data, including the new records field
    const formattedWorkoutData = {
      userId: workoutData.userId || user.id,
      name: workoutData.name || "Cardio Workout",
      date: workoutData.date ? new Date(workoutData.date) : new Date(),
      duration: workoutData.duration || 0,
      type: workoutData.type || "running",
      distance: workoutData.distance ?? undefined,
      cardioDetails: workoutData.cardioDetails ?? undefined,
      notes: workoutData.notes || "",
      source: workoutData.source || "manual",
      sourceId: workoutData.sourceId,
      importedFrom: workoutData.importedFrom,
      importId: workoutData.importId,
      stravaLink: stravaLink,
      records: workoutData.records ?? [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    console.log('Formatted workout data:', JSON.stringify(formattedWorkoutData, null, 2));

    // Connect to database
    console.log('Connecting to database...');
    const dbConnect = (await import("@/lib/db/mongoose")).default;
    await dbConnect();
    console.log('Database connected');

    // Create the workout
    console.log('Creating workout in database...');
    const WorkoutModel = (await import("@/lib/db/models/workout")).default;
    const workout = new WorkoutModel(formattedWorkoutData);
    console.log('Workout model created');

    // Save the workout
    console.log('Saving workout...');
    const savedWorkout = await workout.save();
    console.log('Workout saved successfully:', savedWorkout._id.toString());
    
    // Update the user's workouts array
    console.log('Updating user workouts array...');
    const UserModel = (await import("@/lib/db/models/user")).default;
    await UserModel.findByIdAndUpdate(
      user.id,
      { $push: { workouts: savedWorkout._id } }
    );
    console.log('User workouts array updated');

    // Revalidate paths
    console.log('Revalidating paths...');
    revalidatePath("/calendar");
    revalidatePath("/workout");
    revalidatePath("/workouts");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    console.log('Paths revalidated');

    return savedWorkout.toObject();
  } catch (error) {
    console.error("Error creating cardio workout:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
    }
    throw new Error("Failed to create cardio workout");
  }
}

// Process cardio details for better AI analysis
function enhanceCardioWorkout(workout: any): any {
  let enhancedWorkout = { ...workout }
  
  if (["running", "cycling", "swimming"].includes(workout.type)) {
    // Ensure cardioDetails is populated
    if (!enhancedWorkout.cardioDetails && enhancedWorkout.distance) {
      enhancedWorkout.cardioDetails = {
        distance: enhancedWorkout.distance,
        duration: enhancedWorkout.duration,
        pace: enhancedWorkout.distance > 0 ? (enhancedWorkout.duration / enhancedWorkout.distance) : 0
      }
    }
    
    // Calculate additional metrics if missing
    if (enhancedWorkout.cardioDetails) {
      const cardioDetails = enhancedWorkout.cardioDetails;
      // Calculate pace if missing but we have distance and duration
      if (!cardioDetails.pace && cardioDetails.distance && cardioDetails.distance > 0) {
        cardioDetails.pace = cardioDetails.duration ? cardioDetails.duration / cardioDetails.distance : 0;
      }
      
      // Calculate speed in km/h if we have pace
      if (cardioDetails.pace && cardioDetails.pace > 0) {
        cardioDetails.speed = 60 / cardioDetails.pace;
      }
    }
  }
  
  return enhancedWorkout;
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
      workout.type, // Use workout type instead of name for better matching
      new Date(workout.date), 
      5 // Increase the number of previous workouts for better trend analysis
    )

    // Process cardio details for better AI analysis
    let enhancedWorkout = enhanceCardioWorkout(workout);
    
    // Calculate progression metrics compared to previous workouts
    let progressMetrics = null
    if (previousWorkouts.length > 0) {
      progressMetrics = calculateProgressionMetrics(enhancedWorkout, previousWorkouts)
    }

    return {
      ...enhancedWorkout,
      previousWorkouts: previousWorkouts.length > 0 ? previousWorkouts : undefined,
      progressMetrics
    }
  } catch (error) {
    console.error(`Error fetching workout ${id} for AI:`, error)
    throw new Error(`Failed to fetch workout ${id} for AI`)
  }
}

// Calculate progression metrics compared to previous workouts
function calculateProgressionMetrics(currentWorkout: any, previousWorkouts: any[]): any {
  // Skip if no previous workouts
  if (!previousWorkouts.length) return null
  
  const metrics: any = {}
  
  // Sort previous workouts by date (newest first)
  const sortedWorkouts = [...previousWorkouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  
  // Calculate average metrics from previous workouts
  const avgDuration = sortedWorkouts.reduce((sum: number, w: any) => sum + w.duration, 0) / sortedWorkouts.length
  
  // Calculate duration trend
  metrics.durationChange = currentWorkout.duration - avgDuration
  metrics.durationChangePercent = avgDuration > 0 ? (metrics.durationChange / avgDuration) * 100 : 0
  
  // Calculate distance trend if available
  if (currentWorkout.distance || currentWorkout.cardioDetails?.distance) {
    const currentDistance = currentWorkout.distance || currentWorkout.cardioDetails?.distance || 0
    const previousDistances = sortedWorkouts
      .map((w: any) => w.distance || w.cardioDetails?.distance || 0)
      .filter((d: number) => d > 0)
    
    if (previousDistances.length > 0) {
      const avgDistance = previousDistances.reduce((sum: number, d: number) => sum + d, 0) / previousDistances.length
      metrics.distanceChange = currentDistance - avgDistance
      metrics.distanceChangePercent = avgDistance > 0 ? (metrics.distanceChange / avgDistance) * 100 : 0
    }
  }
  
  // Calculate pace trend if available for running/cycling/swimming
  if (["running", "cycling", "swimming"].includes(currentWorkout.type)) {
    if (currentWorkout.cardioDetails?.pace) {
      const currentPace = currentWorkout.cardioDetails.pace
      const previousPaces = sortedWorkouts
        .map((w: any) => w.cardioDetails?.pace)
        .filter((p: any) => p !== undefined) as number[]
      
      if (previousPaces.length > 0) {
        const avgPace = previousPaces.reduce((sum: number, p: number) => sum + p, 0) / previousPaces.length
        // Note: For pace, lower is better, so we invert the change
        metrics.paceChange = avgPace - currentPace
        metrics.paceChangePercent = avgPace > 0 ? (metrics.paceChange / avgPace) * 100 : 0
      }
    }
  }
  
  return metrics
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

// Get workout statistics for a user
export async function getWorkoutStats(userId: string): Promise<any> {
  try {
    const workouts = await fetchWorkouts()
    
    // Calculate general stats
    const totalWorkouts = workouts.length
    const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0)
    
    // Group workouts by type
    const workoutsByType = workouts.reduce((acc, workout) => {
      const type = workout.type
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(workout)
      return acc
    }, {} as Record<string, any[]>)
    
    // Calculate stats by type
    const statsByType = Object.entries(workoutsByType).map(([type, typeWorkouts]) => {
      const count = typeWorkouts.length
      const totalDuration = typeWorkouts.reduce((sum, w) => sum + w.duration, 0)
      const avgDuration = Math.round(totalDuration / count)
      
      // Additional stats based on workout type
      let additionalStats = {}
      
      if (type === 'running' || type === 'cycling' || type === 'swimming') {
        const totalDistance = typeWorkouts.reduce((sum, w) => sum + (w.distance || 0), 0)
        const avgDistance = totalDistance / count
        additionalStats = {
          totalDistance,
          avgDistance,
          avgPace: totalDistance > 0 ? totalDuration / totalDistance : 0
        }
      } else if (type === 'strength') {
        const totalVolume = typeWorkouts.reduce((sum, w) => sum + (w.volume || 0), 0)
        additionalStats = {
          totalVolume,
          avgVolume: totalVolume / count
        }
      }
      
      return {
        type,
        count,
        totalDuration,
        avgDuration,
        ...additionalStats
      }
    })
    
    return {
      totalWorkouts,
      totalDuration,
      avgDuration: totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0,
      statsByType,
      firstWorkoutDate: workouts.length > 0 ? 
        new Date(Math.min(...workouts.map(w => new Date(w.date).getTime()))) : null,
      lastWorkoutDate: workouts.length > 0 ? 
        new Date(Math.max(...workouts.map(w => new Date(w.date).getTime()))) : null
    }
  } catch (error) {
    console.error("Error calculating workout stats:", error)
    throw new Error("Failed to calculate workout stats")
  }
}

// Get workouts by type
export async function getWorkoutsByType(userId: string, type: string, limit = 10): Promise<any[]> {
  try {
    const allWorkouts = await fetchWorkouts()
    return allWorkouts
      .filter(workout => workout.type === type)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  } catch (error) {
    console.error(`Error fetching ${type} workouts:`, error)
    throw new Error(`Failed to fetch ${type} workouts`)
  }
}

// Get workouts in a date range
export async function getWorkoutsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
  try {
    const allWorkouts = await fetchWorkouts()
    return allWorkouts
      .filter(workout => {
        const workoutDate = new Date(workout.date)
        return workoutDate >= startDate && workoutDate <= endDate
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  } catch (error) {
    console.error("Error fetching workouts by date range:", error)
    throw new Error("Failed to fetch workouts by date range")
  }
}

// Get workouts by intensity
export async function getWorkoutsByIntensity(userId: string, intensity: string, limit = 10): Promise<any[]> {
  try {
    const allWorkouts = await fetchWorkouts()
    return allWorkouts
      .filter(workout => workout.intensity === intensity)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  } catch (error) {
    console.error(`Error fetching ${intensity} intensity workouts:`, error)
    throw new Error(`Failed to fetch ${intensity} intensity workouts`)
  }
}

// Get recent workouts
export async function getRecentWorkouts(userId: string, limit = 10): Promise<any[]> {
  try {
    const allWorkouts = await fetchWorkouts()
    return allWorkouts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit)
  } catch (error) {
    console.error("Error fetching recent workouts:", error)
    throw new Error("Failed to fetch recent workouts")
  }
}

// Get running workouts
export async function getRunningWorkouts(userId: string, limit = 10): Promise<any[]> {
  try {
    return await getWorkoutsByType(userId, 'running', limit)
  } catch (error) {
    console.error("Error fetching running workouts:", error)
    throw new Error("Failed to fetch running workouts")
  }
}

// Get strength workouts
export async function getStrengthWorkouts(userId: string, limit = 10): Promise<any[]> {
  try {
    return await getWorkoutsByType(userId, 'strength', limit)
  } catch (error) {
    console.error("Error fetching strength workouts:", error)
    throw new Error("Failed to fetch strength workouts")
  }
}

