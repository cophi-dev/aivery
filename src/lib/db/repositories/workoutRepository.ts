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

// Export alias for getUserWorkouts (for backward compatibility)
export const getUserWorkouts = getWorkoutsByUserId

