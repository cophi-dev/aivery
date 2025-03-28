import { ObjectId } from "mongodb"
import { getCollection } from "../mongodb"
import type { WorkoutData } from "@/types/db"
import dbConnect from '../mongodb'
import WorkoutModel, { IWorkout } from '../models/workout'
import mongoose, { Document, FlattenMaps } from 'mongoose'

type LeanDocument<T> = {
  [P in keyof T]: T[P] extends Document ? LeanDocument<T[P]> : T[P]
}

// Type guard to handle Mongoose document type conversions
type SafeAny = Record<string, any>
function isWorkoutDocument(doc: any): doc is SafeAny {
  return doc !== null && typeof doc === 'object';
}

// Helper function to handle MongoDB document conversion
function convertDocToWorkoutData(doc: any): WorkoutData {
  if (!doc) return {} as WorkoutData;
  
  // Create a type-safe object with proper conversions
  return {
    _id: doc._id ? doc._id.toString() : '',
    userId: doc.userId ? doc.userId.toString() : '',
    name: doc.name || '',
    date: doc.date || new Date(),
    duration: doc.duration || 0,
    intensity: doc.intensity || '',
    type: doc.type || '',
    volume: doc.volume || 0,
    distance: doc.distance,
    exercises: doc.exercises || [],
    cardioDetails: doc.cardioDetails,
    notes: doc.notes || '',
    stravaLink: doc.stravaLink,
    sourceId: doc.sourceId,
    source: doc.source,
    importedFrom: doc.importedFrom,
    importId: doc.importId,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt || new Date()),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt || new Date()),
  };
}

// Add a helper function at the top of the file to recursively convert MongoDB objects

/**
 * Helper function to convert MongoDB documents to plain objects
 * This recursively converts all ObjectIds to strings and removes any methods
 */
function convertToPlainObject(obj: any): any {
  // Handle null or undefined
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle dates
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle ObjectId
  if (obj && obj._id && typeof obj._id.toString === 'function') {
    obj = { ...obj, _id: obj._id.toString() };
  }
  
  // If we have a MongoDB document with a toObject method, use it
  if (obj && typeof obj.toObject === 'function') {
    obj = obj.toObject();
  }
  
  // Handle arrays by mapping over each item
  if (Array.isArray(obj)) {
    return obj.map(item => convertToPlainObject(item));
  }
  
  // Handle plain objects with potential nested MongoDB objects
  if (obj && typeof obj === 'object' && obj.constructor === Object) {
    const result: any = {};
    for (const key in obj) {
      // Skip keys that start with $ or _
      if (key.startsWith('$') || key === '__v') continue;
      
      // Convert ObjectIds in any key to strings
      if (obj[key] && typeof obj[key].toString === 'function' && obj[key]._bsontype === 'ObjectID') {
        result[key] = obj[key].toString();
      } else {
        result[key] = convertToPlainObject(obj[key]);
      }
    }
    return result;
  }
  
  // Return primitive values and everything else as is
  return obj;
}

const DB_NAME = "aivery"
const COLLECTION_NAME = "workouts"

// Get all workouts for a user
export async function getWorkoutsByUserId(userId: string, limit = 1000, skip = 0): Promise<WorkoutData[]> {
  try {
    await dbConnect()
    
    const workoutDocs = await WorkoutModel.find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean()
      .exec()

    // Process documents to ensure they're safe for client components
    // This creates new objects with only the necessary properties and
    // avoids any MongoDB objects with toJSON methods that cause warnings
    return workoutDocs.map((doc: any) => {
      // Create a new clean object with only the properties we need
      return {
        _id: doc._id ? doc._id.toString() : '',
        userId: doc.userId ? doc.userId.toString() : '',
        type: doc.type || '',
        name: doc.name || '',
        date: doc.date instanceof Date ? doc.date.toISOString() : 
              (doc.date ? new Date(doc.date).toISOString() : new Date().toISOString()),
        duration: doc.duration || 0,
        distance: doc.distance || 0,
        calories: doc.calories || 0,
        notes: doc.notes || '',
        intensity: doc.intensity || '',
        volume: doc.volume || 0,
        
        // Carefully handle exercises to avoid nested buffer objects
        exercises: Array.isArray(doc.exercises) ? doc.exercises.map((exercise: any) => ({
          _id: exercise._id ? exercise._id.toString() : undefined,
          name: exercise.name || '',
          sets: Array.isArray(exercise.sets) ? exercise.sets.map((set: any) => ({
            weight: set.weight || 0,
            reps: set.reps || 0,
            // Skip any _id fields with buffer properties
          })) : []
        })) : [],
        
        // Create a simplified version of cardioDetails
        cardioDetails: doc.cardioDetails ? {
          distance: doc.cardioDetails.distance || 0,
          duration: doc.cardioDetails.duration || 0,
          pace: doc.cardioDetails.pace || 0,
          speed: doc.cardioDetails.speed || 0,
          maxSpeed: doc.cardioDetails.maxSpeed || 0,
          elevationGain: doc.cardioDetails.elevationGain || 0,
          
          // Include only simplified heart rate data
          heartRate: doc.cardioDetails.heartRate ? {
            average: doc.cardioDetails.heartRate.average || 0,
            max: doc.cardioDetails.heartRate.max || 0
            // Explicitly omit zones and other objects that might contain buffer properties
          } : undefined,
          
          // Include only simplified power data
          power: doc.cardioDetails.power ? {
            average: doc.cardioDetails.power.average || 0,
            max: doc.cardioDetails.power.max || 0
            // Omit any potentially problematic nested fields
          } : undefined,
          
          // Skip laps entirely as they often contain buffer objects
        } : undefined,
        
        // Include metadata fields as simple strings
        source: doc.source || '',
        sourceId: doc.sourceId || '',
        importedFrom: doc.importedFrom || '',
        importId: doc.importId || '',
        stravaLink: doc.stravaLink || '',
        
        // Ensure dates are properly serialized
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : 
                  (doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString()),
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : 
                  (doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString())
      };
    });
  } catch (error) {
    console.error('Error getting workouts:', error)
    throw new Error('Failed to get workouts')
  }
}

// Get a workout by ID
export async function getWorkoutById(id: string): Promise<WorkoutData | null> {
  try {
    await dbConnect()
    
    // Use explicit type assertion for the lean document
    const doc = await WorkoutModel.findById(id).lean().exec() as any;

    if (!doc) {
      return null
    }
    
    // Create a new clean object with only the properties we need
    // This avoids any MongoDB objects with toJSON methods that cause warnings
    return {
      _id: doc._id ? doc._id.toString() : '',
      userId: doc.userId ? doc.userId.toString() : '',
      type: doc.type || '',
      name: doc.name || '',
      date: doc.date instanceof Date ? doc.date.toISOString() : 
            (doc.date ? new Date(doc.date).toISOString() : new Date().toISOString()),
      duration: doc.duration || 0,
      distance: doc.distance || 0,
      calories: doc.calories || 0,
      notes: doc.notes || '',
      intensity: doc.intensity || '',
      volume: doc.volume || 0,
      
      // Carefully handle exercises to avoid nested buffer objects
      exercises: Array.isArray(doc.exercises) ? doc.exercises.map((exercise: any) => ({
        _id: exercise._id ? exercise._id.toString() : undefined,
        name: exercise.name || '',
        sets: Array.isArray(exercise.sets) ? exercise.sets.map((set: any) => ({
          weight: set.weight || 0,
          reps: set.reps || 0,
          // Skip any _id fields with buffer properties
        })) : []
      })) : [],
      
      // Create a simplified version of cardioDetails
      cardioDetails: doc.cardioDetails ? {
        distance: doc.cardioDetails.distance || 0,
        duration: doc.cardioDetails.duration || 0,
        pace: doc.cardioDetails.pace || 0,
        speed: doc.cardioDetails.speed || 0,
        maxSpeed: doc.cardioDetails.maxSpeed || 0,
        elevationGain: doc.cardioDetails.elevationGain || 0,
        
        // Include only simplified heart rate data
        heartRate: doc.cardioDetails.heartRate ? {
          average: doc.cardioDetails.heartRate.average || 0,
          max: doc.cardioDetails.heartRate.max || 0
          // Explicitly omit zones and other objects that might contain buffer properties
        } : undefined,
        
        // Include only simplified power data
        power: doc.cardioDetails.power ? {
          average: doc.cardioDetails.power.average || 0,
          max: doc.cardioDetails.power.max || 0
          // Omit any potentially problematic nested fields
        } : undefined,
        
        // Skip laps entirely as they often contain buffer objects
      } : undefined,
      
      // Include metadata fields as simple strings
      source: doc.source || '',
      sourceId: doc.sourceId || '',
      importedFrom: doc.importedFrom || '',
      importId: doc.importId || '',
      stravaLink: doc.stravaLink || '',
      
      // Ensure dates are properly serialized
      createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : 
                (doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString()),
      updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : 
                (doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString())
    };
  } catch (error) {
    console.error(`Error getting workout ${id}:`, error)
    throw new Error(`Failed to get workout ${id}`)
  }
}

// Create a new workout
export async function createWorkout(workoutData: Partial<WorkoutData>): Promise<WorkoutData> {
  try {
    await dbConnect()
    
    const workout = new WorkoutModel({
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
    })

    const savedWorkout = await workout.save()
    const result = savedWorkout.toObject()

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
      stravaLink: result.stravaLink,
      source: result.source,
      sourceId: result.sourceId,
      importedFrom: result.importedFrom,
      importId: result.importId,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    }
  } catch (error) {
    console.error("Error creating workout:", error)
    throw new Error("Failed to create workout")
  }
}

// Update an existing workout
export async function updateWorkout(id: string, workoutData: Partial<WorkoutData>): Promise<WorkoutData | null> {
  try {
    await dbConnect()
    
    const result = await WorkoutModel.findByIdAndUpdate(
      id,
      { ...workoutData, updatedAt: new Date() },
      { new: true }
    ).lean().exec()

    if (!result) {
      return null
    }

    // Type assertion to handle Mongoose document
    const workout = result as any;
    
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
      createdAt: workout.createdAt.toISOString(),
      updatedAt: workout.updatedAt.toISOString(),
    }
  } catch (error) {
    console.error(`Error updating workout ${id}:`, error)
    throw new Error(`Failed to update workout ${id}`)
  }
}

// Delete a workout
export async function deleteWorkout(id: string): Promise<boolean> {
  try {
    await dbConnect()
    
    const result = await WorkoutModel.findByIdAndDelete(id).exec()
    return !!result
  } catch (error) {
    console.error(`Error deleting workout ${id}:`, error)
    throw new Error(`Failed to delete workout ${id}`)
  }
}

// Get workout statistics
export async function getWorkoutStats(userId: string) {
  try {
    await dbConnect()
    
    const stats = await WorkoutModel.aggregate([
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
    ]).exec()

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
    await dbConnect()
    
    const workoutDocs = await WorkoutModel.find({
      userId: new ObjectId(userId),
      "exercises.name": exerciseName,
      date: { $lt: currentDate },
    })
      .sort({ date: -1 })
      .limit(limit)
      .lean()
      .exec()

    return workoutDocs.map((workoutDoc: any) => ({
      _id: workoutDoc._id.toString(),
      userId: workoutDoc.userId.toString(),
      name: workoutDoc.name || '',
      date: workoutDoc.date || new Date(),
      duration: workoutDoc.duration || 0,
      intensity: workoutDoc.intensity || '',
      type: workoutDoc.type || '',
      volume: workoutDoc.volume || 0,
      distance: workoutDoc.distance,
      exercises: workoutDoc.exercises || [],
      cardioDetails: workoutDoc.cardioDetails,
      notes: workoutDoc.notes || '',
      createdAt: workoutDoc.createdAt instanceof Date ? workoutDoc.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: workoutDoc.updatedAt instanceof Date ? workoutDoc.updatedAt.toISOString() : new Date().toISOString(),
    }))
  } catch (error) {
    console.error(`Error getting previous workouts for ${exerciseName}:`, error)
    throw new Error(`Failed to get previous workouts for ${exerciseName}`)
  }
}

// Get monthly workout distance by type
export async function getMonthlyWorkoutDistanceByType(userId: string, workoutType: string, year: number, month: number): Promise<number> {
  try {
    await dbConnect()
    
    // Create date range for the specified month
    const startDate = new Date(year, month - 1, 1) // Month is 0-indexed in JS Date
    const endDate = new Date(year, month, 0) // Last day of the month
    
    // Query workouts of the specified type within the date range
    const workouts = await WorkoutModel.find({
      userId: new ObjectId(userId),
      type: workoutType,
      date: { $gte: startDate, $lte: endDate }
    })
      .lean()
      .exec()
    
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
    await dbConnect()
    
    // Query workouts of the specified type within the date range
    const workouts = await WorkoutModel.find({
      userId: new ObjectId(userId),
      type: workoutType,
      date: { $gte: startDate, $lte: endDate }
    })
      .lean()
      .exec()
    
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
    await dbConnect()
    
    // Create date range for the specified month
    const startDate = new Date(year, month - 1, 1) // Month is 0-indexed in JS Date
    const endDate = new Date(year, month, 0) // Last day of the month
    
    // Query workouts of the specified type within the date range
    const workouts = await WorkoutModel.find({
      userId: new ObjectId(userId),
      type: workoutType,
      date: { $gte: startDate, $lte: endDate }
    })
      .lean()
      .exec()
    
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
    await dbConnect()
    
    // Query workouts of the specified type within the date range
    const workouts = await WorkoutModel.find({
      userId: new ObjectId(userId),
      type: workoutType,
      date: { $gte: startDate, $lte: endDate }
    })
      .lean()
      .exec()
    
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
    await dbConnect()
    
    // Query workouts of the specified type within the date range
    const workouts = await WorkoutModel.find({
      userId: new ObjectId(userId),
      type: workoutType,
      date: { $gte: startDate, $lte: endDate }
    })
      .sort({ date: -1 })
      .lean()
      .exec()
    
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
    await dbConnect()
    
    const workouts = await WorkoutModel.find({ 
      userId: new ObjectId(userId),
      type: "running"
    })
      .lean()
      .exec()
    
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
    await dbConnect()
    
    const result = await WorkoutModel.aggregate([
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
    ]).exec()

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
    await dbConnect()
    
    const workouts = await WorkoutModel.find({
      userId: new ObjectId(userId),
      type: workoutType,
      $or: [
        { distance: { $exists: true, $ne: null } },
        { "cardioDetails.distance": { $exists: true, $ne: null } }
      ]
    })
      .lean()
      .exec()

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
    await dbConnect()
    
    // Create start and end of the day
    const startOfDay = new Date(date)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(date)
    endOfDay.setHours(23, 59, 59, 999)
    
    const workouts = await WorkoutModel.find({
      userId: new ObjectId(userId),
      date: {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
      .sort({ date: 1 })
      .lean()
      .exec()
      
    return workouts
  } catch (error) {
    console.error("Error getting workouts by date:", error)
    throw new Error("Failed to get workouts by date")
  }
}

export async function getWorkoutDatesForMonth(userId: string, date: Date) {
  try {
    await dbConnect()
    
    // Create start and end of the month
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
    
    const workouts = await WorkoutModel.find({
      userId: new ObjectId(userId),
      date: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    })
      .select({ date: 1 })
      .lean()
      .exec()
      
    // Type assertion to handle the Mongoose document type
    return workouts.map((workout: any) => new Date(workout.date))
  } catch (error) {
    console.error("Error getting workout dates:", error)
    throw new Error("Failed to get workout dates")
  }
}

