import { ObjectId } from "mongodb"
import { getCollection } from "../mongodb"
import type { WorkoutData } from "@/types/db"

const DB_NAME = "aivery"
const COLLECTION_NAME = "workouts"

// Get all workouts for a user
export async function getWorkoutsByUserId(userId: string, limit = 1000, skip = 0): Promise<WorkoutData[]> {
  try {
    if (!userId) {
      console.error("getWorkoutsByUserId called with no userId");
      return [];
    }

    const collection = await getCollection(DB_NAME, COLLECTION_NAME);
    if (!collection) {
      console.error("Failed to get collection");
      return [];
    }

    // First try to properly format the ObjectId to avoid failures
    let userIdObject;
    try {
      userIdObject = new ObjectId(userId);
    } catch (error) {
      console.error("Invalid user ID format:", userId, error);
      return [];
    }

    // Use a timeout to prevent hanging queries
    const timeoutPromise = new Promise<any[]>((_, reject) => 
      setTimeout(() => reject(new Error("Query timeout")), 10000)
    );

    const queryPromise = collection
      .find({ userId: userIdObject })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    // Race the query against the timeout
    const workouts = await Promise.race([queryPromise, timeoutPromise]);

    return workouts.map((workout) => ({
      _id: workout._id.toString(),
      userId: typeof workout.userId === 'object' && workout.userId !== null 
        ? workout.userId.toString() 
        : workout.userId,
      name: workout.name || '',
      date: workout.date || new Date(),
      duration: workout.duration || 0,
      intensity: workout.intensity || '',
      type: workout.type || '',
      volume: workout.volume || 0,
      distance: workout.distance || 0,
      exercises: workout.exercises || [],
      cardioDetails: workout.cardioDetails || null,
      notes: workout.notes || '',
      stravaLink: workout.stravaLink || '',
      sourceId: workout.sourceId || '',
      source: workout.source || '',
      importedFrom: workout.importedFrom || '',
      importId: workout.importId || '',
      createdAt: workout.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: workout.updatedAt?.toISOString() || new Date().toISOString(),
    }));
  } catch (error) {
    console.error("Error getting user workouts:", error);
    return [];
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
      stravaLink: workout.stravaLink,
      sourceId: workout.sourceId,
      source: workout.source,
      importedFrom: workout.importedFrom,
      importId: workout.importId,
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
      distance: workoutData.distance ?? undefined,
      exercises: workoutData.exercises || [],
      cardioDetails: workoutData.cardioDetails ?? undefined,
      notes: workoutData.notes || "",
      stravaLink: workoutData.stravaLink,
      source: workoutData.source,
      sourceId: workoutData.sourceId,
      importedFrom: workoutData.importedFrom,
      importId: workoutData.importId,
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
      stravaLink: workout.stravaLink,
      source: workout.source,
      sourceId: workout.sourceId,
      importedFrom: workout.importedFrom,
      importId: workout.importId,
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

// Get total running distance for a user
export async function getTotalRunningDistance(userId: string): Promise<number> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    const workouts = await collection
      .find({ 
        userId: new ObjectId(userId),
        type: "running"
      })
      .toArray()
    
    let totalDistance = 0
    workouts.forEach(workout => {
      // Use either top-level distance or cardioDetails.distance
      const distance = workout.distance || workout.cardioDetails?.distance || 0
      totalDistance += distance
    })
    
    return totalDistance
  } catch (error) {
    console.error("Error getting total running distance:", error)
    throw new Error("Failed to get total running distance")
  }
}

// Get total distance for a specific workout type
export async function getTotalDistanceByType(userId: string, workoutType: string): Promise<number> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    const result = await collection.aggregate([
      {
        $match: {
          userId: new ObjectId(userId),
          type: workoutType,
          $or: [
            { distance: { $exists: true, $ne: null } },
            { "cardioDetails.distance": { $exists: true, $ne: null } }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalDistance: {
            $sum: {
              $cond: [
                { $gt: ["$distance", 0] },
                "$distance",
                { $cond: [{ $gt: ["$cardioDetails.distance", 0] }, "$cardioDetails.distance", 0] }
              ]
            }
          }
        }
      }
    ]).toArray()

    return result[0]?.totalDistance || 0
  } catch (error) {
    console.error(`Error getting total ${workoutType} distance:`, error)
    throw new Error(`Failed to get total ${workoutType} distance`)
  }
}

// Get comprehensive workout statistics for any workout type
export async function getWorkoutTypeStats(userId: string, workoutType: string): Promise<{
  totalDistance: number;
  totalSessions: number;
  fastestPace?: number;
  fastestSession?: {
    date: Date;
    distance: number;
    duration: number;
    pace: number;
  };
  longestSession?: {
    date: Date;
    distance: number;
    duration: number;
    pace: number;
  };
  averagePace?: number;
  averageDistance?: number;
  averageDuration?: number;
  totalDuration: number;
}> {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        type: workoutType,
        $or: [
          { distance: { $exists: true, $ne: null } },
          { "cardioDetails.distance": { $exists: true, $ne: null } }
        ]
      })
      .toArray()

    if (workouts.length === 0) {
      return {
        totalDistance: 0,
        totalSessions: 0,
        totalDuration: 0
      }
    }

    let totalDistance = 0
    let totalDuration = 0
    let fastestPace = Infinity
    let fastestSession: {
      date: Date;
      distance: number;
      duration: number;
      pace: number;
    } | undefined = undefined
    let longestSession: {
      date: Date;
      distance: number;
      duration: number;
      pace: number;
    } | undefined = undefined
    let totalPace = 0
    let sessionsWithPace = 0

    workouts.forEach(workout => {
      const distance = workout.distance || workout.cardioDetails?.distance || 0
      const duration = workout.duration || workout.cardioDetails?.duration || 0
      
      // Calculate pace in min/km for distance-based workouts
      const pace = distance > 0 ? duration / distance : 0

      totalDistance += distance
      totalDuration += duration

      if (distance > 0 && duration > 0) {
        // Track fastest pace
        if (pace > 0 && pace < fastestPace) {
          fastestPace = pace
          fastestSession = {
            date: workout.date,
            distance,
            duration,
            pace
          }
        }

        // Track longest session
        if (!longestSession || distance > longestSession.distance) {
          longestSession = {
            date: workout.date,
            distance,
            duration,
            pace
          }
        }

        // Add to average pace calculation
        if (pace > 0) {
          totalPace += pace
          sessionsWithPace++
        }
      }
    })

    return {
      totalDistance,
      totalSessions: workouts.length,
      totalDuration,
      fastestPace: fastestPace !== Infinity ? fastestPace : undefined,
      fastestSession,
      longestSession,
      averagePace: sessionsWithPace > 0 ? totalPace / sessionsWithPace : undefined,
      averageDistance: totalDistance / workouts.length,
      averageDuration: totalDuration / workouts.length
    }
  } catch (error) {
    console.error(`Error getting ${workoutType} statistics:`, error)
    throw new Error(`Failed to get ${workoutType} statistics`)
  }
}

// Alias for backward compatibility
export const getRunningStats = (userId: string) => getWorkoutTypeStats(userId, 'running')

export async function getWorkoutsByDate(userId: string, date: Date) {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    // Create start and end of the day
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        }
      })
      .sort({ date: 1 })
      .toArray()
      
    return workouts
  } catch (error) {
    console.error("Error getting workouts by date:", error)
    throw new Error("Failed to get workouts by date")
  }
}

export async function getWorkoutDatesForMonth(userId: string, date: Date) {
  try {
    const collection = await getCollection(DB_NAME, COLLECTION_NAME)
    
    // Create start and end of the month
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
    
    const workouts = await collection
      .find({
        userId: new ObjectId(userId),
        date: {
          $gte: startOfMonth,
          $lte: endOfMonth
        }
      })
      .project({ date: 1 })
      .toArray()
      
    return workouts.map(w => new Date(w.date))
  } catch (error) {
    console.error("Error getting workout dates:", error)
    throw new Error("Failed to get workout dates")
  }
}

