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
      id: workout._id.toString(),
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
      completed: workout.completed,
      completedAt: workout.completedAt,
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
      id: workout._id.toString(),
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
      completed: workout.completed,
      completedAt: workout.completedAt,
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

    // Calculate volume based on exercises if not provided
    let volume = workoutData.volume || 0
    if (!volume && workoutData.exercises) {
      for (const exercise of workoutData.exercises) {
        for (const set of exercise.sets) {
          volume += set.weight * set.reps
        }
      }
    }

    const workout = {
      ...workoutData,
      userId: new ObjectId(workoutData.userId),
      volume,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(workout)
    
    // Manually create a clean response without MongoDB-specific objects
    const cleanWorkout = {
      ...workout,
      id: result.insertedId.toString(),
      userId: workout.userId.toString(),
      _id: undefined // Remove the _id field to prevent serialization issues
    }
    
    // Delete the _id property to ensure it's not included
    delete cleanWorkout._id;

    return cleanWorkout as WorkoutData
  } catch (error) {
    console.error("Error creating workout:", error)
    throw new Error("Failed to create workout")
  }
}

// Update a workout
export async function updateWorkout(id: string, workoutData: Partial<WorkoutData>): Promise<WorkoutData | null> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    // Remove fields that shouldn't be updated
    const { id: _, userId, createdAt, ...updateData } = workoutData

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    )

    if (!result) {
      return null
    }

    return {
      id: result._id.toString(),
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
      completed: result.completed,
      completedAt: result.completedAt,
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

// Get workout stats for a user
export async function getWorkoutStats(userId: string) {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    // Get total workouts
    const totalWorkouts = await collection.countDocuments({ userId: new ObjectId(userId) })

    // Get total volume (for strength workouts)
    const volumeStats = await collection
      .aggregate([
        { $match: { userId: new ObjectId(userId), type: "strength" } },
        { $group: { _id: null, totalVolume: { $sum: "$volume" } } },
      ])
      .toArray()

    // Get total distance (for cardio workouts)
    const distanceStats = await collection
      .aggregate([
        {
          $match: {
            userId: new ObjectId(userId),
            type: { $in: ["running", "swimming", "cycling"] },
          },
        },
        { $group: { _id: null, totalDistance: { $sum: "$distance" } } },
      ])
      .toArray()

    // Get workouts by type
    const workoutsByType = await collection
      .aggregate([{ $match: { userId: new ObjectId(userId) } }, { $group: { _id: "$type", count: { $sum: 1 } } }])
      .toArray()

    return {
      totalWorkouts,
      totalVolume: volumeStats.length > 0 ? volumeStats[0].totalVolume : 0,
      totalDistance: distanceStats.length > 0 ? distanceStats[0].totalDistance : 0,
      workoutsByType: workoutsByType.reduce((acc, curr) => {
        acc[curr._id] = curr.count
        return acc
      }, {}),
    }
  } catch (error) {
    console.error(`Error getting workout stats for user ${userId}:`, error)
    throw new Error("Failed to get workout stats")
  }
}

// Get previous workouts of the same type
export async function getPreviousWorkouts(userId: string, workoutName: string, currentDate: Date, limit = 3) {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)

    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        name: workoutName,
        date: { $lt: currentDate },
      })
      .sort({ date: -1 })
      .limit(limit)
      .toArray()

    return workouts.map((workout) => ({
      id: workout._id.toString(),
      date: workout.date,
      duration: workout.duration,
      volume: workout.volume,
      exercises: workout.exercises,
    }))
  } catch (error) {
    console.error(`Error getting previous workouts for user ${userId}:`, error)
    throw new Error("Failed to get previous workouts")
  }
}

// Export alias for getUserWorkouts (for backward compatibility)
export const getUserWorkouts = getWorkoutsByUserId

