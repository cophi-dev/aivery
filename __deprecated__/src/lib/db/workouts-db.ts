import { getCollection } from "./mongodb"
import { ObjectId } from "mongodb"

const DB_NAME = "aivery"
const WORKOUTS_COLLECTION = "workouts"

// Mock user ID for demo purposes
const MOCK_USER_ID = "64f5a53e9d312a1f5e7b8f01"

// Create a new workout
export async function createWorkout(workoutData: any) {
  try {
    const collection = await getCollection(WORKOUTS_COLLECTION)

    // Add userId and timestamps
    const workout = {
      ...workoutData,
      userId: new ObjectId(workoutData.userId || MOCK_USER_ID),
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(workout)
    return { id: result.insertedId.toString(), ...workout }
  } catch (error) {
    console.error("Error creating workout:", error)
    throw new Error("Failed to create workout")
  }
}

// Get a workout by ID
export async function getWorkout(id: string) {
  try {
    const collection = await getCollection(WORKOUTS_COLLECTION)

    const workout = await collection.findOne({ _id: new ObjectId(id) })

    if (!workout) {
      return null
    }

    return {
      id: workout._id.toString(),
      ...workout,
    }
  } catch (error) {
    console.error(`Error getting workout ${id}:`, error)
    return null
  }
}

// Get all workouts for a user
export async function getUserWorkouts(userId: string = MOCK_USER_ID, limit = 20, skip = 0) {
  try {
    const collection = await getCollection(WORKOUTS_COLLECTION)

    const workouts = await collection
      .find({ userId: new ObjectId(userId) })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .toArray()

    return workouts.map((workout: any) => ({
      id: workout._id.toString(),
      ...workout,
    }))
  } catch (error) {
    console.error(`Error getting workouts for user ${userId}:`, error)
    return []
  }
}

// Update a workout
export async function updateWorkout(id: string, workoutData: any) {
  try {
    const collection = await getCollection(WORKOUTS_COLLECTION)

    // Remove fields that shouldn't be updated
    const { _id, userId, createdAt, ...updateData } = workoutData

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateData,
          updatedAt: new Date(),
        },
      },
    )

    if (result.modifiedCount === 0) {
      throw new Error("Workout not found or not modified")
    }

    return await getWorkout(id)
  } catch (error) {
    console.error(`Error updating workout ${id}:`, error)
    throw new Error("Failed to update workout")
  }
}

// Delete a workout
export async function deleteWorkout(id: string) {
  try {
    const collection = await getCollection(WORKOUTS_COLLECTION)

    const result = await collection.deleteOne({ _id: new ObjectId(id) })

    return result.deletedCount === 1
  } catch (error) {
    console.error(`Error deleting workout ${id}:`, error)
    throw new Error("Failed to delete workout")
  }
}

// Get workout stats for a user
export async function getWorkoutStats(userId: string = MOCK_USER_ID) {
  try {
    const collection = await getCollection(WORKOUTS_COLLECTION)

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

    // Get recent workouts
    const recentWorkouts = await collection
      .find({ userId: new ObjectId(userId) })
      .sort({ date: -1 })
      .limit(5)
      .toArray()

    return {
      totalWorkouts,
      totalVolume: volumeStats.length > 0 ? volumeStats[0].totalVolume : 0,
      totalDistance: distanceStats.length > 0 ? distanceStats[0].totalDistance : 0,
      workoutsByType: workoutsByType.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr._id] = curr.count
        return acc
      }, {} as Record<string, number>),
      recentWorkouts: recentWorkouts.map((workout: any) => ({
        id: workout._id.toString(),
        name: workout.name,
        date: workout.date,
        type: workout.type,
      })),
    }
  } catch (error) {
    console.error(`Error getting workout stats for user ${userId}:`, error)
    // Return default stats if database operation fails
    return {
      totalWorkouts: 0,
      totalVolume: 0,
      totalDistance: 0,
      workoutsByType: {},
      recentWorkouts: [],
    }
  }
}

