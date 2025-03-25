import { ObjectId } from "mongodb"
import { getCollection } from "../mongodb"
import type { WorkoutData } from "@/types/db"

const DB_NAME = "aivery"
const COLLECTION_NAME = "workouts"

// Get all workouts for a user
export async function getWorkoutsByUserId(userId: string, limit = 20, skip = 0): Promise<WorkoutData[]> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    const workouts = await collection
      .find({ userId: new ObjectId(userId) })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    return workouts.map((workout) => ({
      _id: workout._id.toString(),
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
      createdAt: workout.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: workout.updatedAt?.toISOString() || new Date().toISOString(),
    }))
  } catch (error) {
    console.error("Error getting user workouts:", error)
    throw new Error("Failed to get user workouts")
  }
}

// Get a workout by ID
export async function getWorkoutById(id: string): Promise<WorkoutData | null> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    const workout = await collection.findOne({ _id: new ObjectId(id) })

    if (!workout) {
      return null
    }

    return {
      _id: workout._id.toString(),
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
      createdAt: workout.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: workout.updatedAt?.toISOString() || new Date().toISOString(),
    }
  } catch (error) {
    console.error(`Error getting workout ${id}:`, error)
    throw new Error(`Failed to get workout ${id}`)
  }
}

// Create a new workout
export async function createWorkout(workoutData: Partial<WorkoutData>): Promise<WorkoutData> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    const workout = {
      userId: new ObjectId(workoutData.userId),
      name: workoutData.name || "",
      date: workoutData.date || new Date(),
      duration: workoutData.duration || 0,
      intensity: workoutData.intensity || "",
      type: workoutData.type || "strength",
      volume: workoutData.volume || 0,
      distance: workoutData.distance || undefined,
      exercises: workoutData.exercises || [],
      cardioDetails: workoutData.cardioDetails || undefined,
      notes: workoutData.notes || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(workout)

    return {
      _id: result.insertedId.toString(),
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
      createdAt: workout.createdAt.toISOString(),
      updatedAt: workout.updatedAt.toISOString(),
    }
  } catch (error) {
    console.error("Error creating workout:", error)
    throw new Error("Failed to create workout")
  }
}

// Update an existing workout
export async function updateWorkout(id: string, workoutData: Partial<WorkoutData>): Promise<WorkoutData | null> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    const workout = {
      ...workoutData,
      updatedAt: new Date(),
    }

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: workout },
      { returnDocument: "after" }
    )

    if (!result) {
      return null
    }

    return {
      _id: result._id.toString(),
      userId: result.userId.toString(),
      name: result.name,
      date: result.date,
      duration: result.duration,
      intensity: result.intensity,
      type: result.type,
      volume: result.volume,
      distance: result.distance,
      exercises: result.exercises,
      cardioDetails: result.cardioDetails,
      notes: result.notes,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }
  } catch (error) {
    console.error(`Error updating workout ${id}:`, error)
    throw new Error(`Failed to update workout ${id}`)
  }
}

// Delete a workout
export async function deleteWorkout(id: string): Promise<boolean> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    return result.deletedCount === 1
  } catch (error) {
    console.error(`Error deleting workout ${id}:`, error)
    throw new Error(`Failed to delete workout ${id}`)
  }
}

// Get workout statistics
export async function getWorkoutStats(userId: string) {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    const stats = await collection.aggregate([
      { $match: { userId: new ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalWorkouts: { $sum: 1 },
          totalDuration: { $sum: "$duration" },
          totalVolume: { $sum: "$volume" },
          averageDuration: { $avg: "$duration" },
          averageVolume: { $avg: "$volume" },
        },
      },
    ]).toArray()

    return stats[0] || {
      totalWorkouts: 0,
      totalDuration: 0,
      totalVolume: 0,
      averageDuration: 0,
      averageVolume: 0,
    }
  } catch (error) {
    console.error("Error getting workout stats:", error)
    throw new Error("Failed to get workout stats")
  }
}

// Get previous workouts for a specific exercise
export async function getPreviousWorkouts(userId: string, exerciseName: string, currentDate: Date, limit = 3): Promise<WorkoutData[]> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        "exercises.name": exerciseName,
        date: { $lt: currentDate },
      })
      .sort({ date: -1 })
      .limit(limit)
      .toArray()

    return workouts.map((workout) => ({
      _id: workout._id.toString(),
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
      createdAt: workout.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: workout.updatedAt?.toISOString() || new Date().toISOString(),
    }))
  } catch (error) {
    console.error(`Error getting previous workouts for ${exerciseName}:`, error)
    throw new Error(`Failed to get previous workouts for ${exerciseName}`)
  }
}

// Get monthly workout distance by type
export async function getMonthlyWorkoutDistanceByType(userId: string, workoutType: string, year: number, month: number): Promise<number> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    // Create date range for the specified month
    const startDate = new Date(year, month - 1, 1) // Month is 0-indexed in JS Date
    const endDate = new Date(year, month, 0) // Last day of the month
    
    // Query workouts of the specified type within the date range
    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        type: workoutType,
        date: { $gte: startDate, $lte: endDate }
      })
      .toArray()
    
    // Calculate total distance, checking both top-level distance and cardioDetails.distance
    let totalDistance = 0
    workouts.forEach(workout => {
      // Use top-level distance field if available
      if (workout.distance) {
        totalDistance += workout.distance
      } 
      // Otherwise fallback to cardioDetails.distance if available
      else if (workout.cardioDetails?.distance) {
        totalDistance += workout.cardioDetails.distance
      }
    })
    
    return totalDistance
  } catch (error) {
    console.error(`Error getting monthly ${workoutType} distance:`, error)
    throw new Error(`Failed to get monthly ${workoutType} distance`)
  }
}

// Get workout distance for a date range
export async function getWorkoutDistanceForDateRange(
  userId: string, 
  workoutType: string, 
  startDate: Date, 
  endDate: Date
): Promise<number> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    // Query workouts of the specified type within the date range
    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        type: workoutType,
        date: { $gte: startDate, $lte: endDate }
      })
      .toArray()
    
    // Calculate total distance, checking both top-level distance and cardioDetails.distance
    let totalDistance = 0
    workouts.forEach(workout => {
      // Use top-level distance field if available
      if (workout.distance) {
        totalDistance += workout.distance
      } 
      // Otherwise fallback to cardioDetails.distance if available
      else if (workout.cardioDetails?.distance) {
        totalDistance += workout.cardioDetails.distance
      }
    })
    
    return totalDistance
  } catch (error) {
    console.error(`Error getting ${workoutType} distance for date range:`, error)
    throw new Error(`Failed to get ${workoutType} distance for date range`)
  }
}

// Get monthly workout duration by type
export async function getMonthlyWorkoutDurationByType(userId: string, workoutType: string, year: number, month: number): Promise<number> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    // Create date range for the specified month
    const startDate = new Date(year, month - 1, 1) // Month is 0-indexed in JS Date
    const endDate = new Date(year, month, 0) // Last day of the month
    
    // Query workouts of the specified type within the date range
    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        type: workoutType,
        date: { $gte: startDate, $lte: endDate }
      })
      .toArray()
    
    // Calculate total duration
    let totalDuration = 0
    workouts.forEach(workout => {
      if (workout.duration) {
        totalDuration += workout.duration
      }
    })
    
    return totalDuration
  } catch (error) {
    console.error(`Error getting monthly ${workoutType} duration:`, error)
    throw new Error(`Failed to get monthly ${workoutType} duration`)
  }
}

// Get workout durations for a date range
export async function getWorkoutDurationForDateRange(
  userId: string, 
  workoutType: string, 
  startDate: Date, 
  endDate: Date
): Promise<number> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    // Query workouts of the specified type within the date range
    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        type: workoutType,
        date: { $gte: startDate, $lte: endDate }
      })
      .toArray()
    
    // Calculate total duration
    let totalDuration = 0
    workouts.forEach(workout => {
      if (workout.duration) {
        totalDuration += workout.duration
      }
    })
    
    return totalDuration
  } catch (error) {
    console.error(`Error getting ${workoutType} duration for date range:`, error)
    throw new Error(`Failed to get ${workoutType} duration for date range`)
  }
}

// Get workout notes for analysis
export async function getWorkoutNotesByType(
  userId: string,
  workoutType: string,
  startDate: Date,
  endDate: Date
): Promise<{ notes: string[], count: number }> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    // Query workouts of the specified type within the date range
    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        type: workoutType,
        date: { $gte: startDate, $lte: endDate }
      })
      .sort({ date: -1 })
      .toArray()
    
    // Extract notes from workouts
    const notes = workouts
      .filter(workout => workout.notes && workout.notes.trim() !== '')
      .map(workout => workout.notes as string)
    
    return {
      notes,
      count: workouts.length
    }
  } catch (error) {
    console.error(`Error getting ${workoutType} notes:`, error)
    throw new Error(`Failed to get ${workoutType} notes`)
  }
}

// Export alias for getUserWorkouts (for backward compatibility)
export const getUserWorkouts = getWorkoutsByUserId

