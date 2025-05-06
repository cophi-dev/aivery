import { ObjectId } from "mongodb"
import { getCollection } from "../mongodb"
import type { WorkoutData } from "@/types/db"
import dbConnect from '../mongodb'
import WorkoutModel, { IWorkout } from '../models/workout'
import WorkoutExerciseModel from '../models/workoutExercise'
import mongoose, { Document, FlattenMaps } from 'mongoose'
import ExerciseModel from "../models/exercise"
import { Types } from 'mongoose'

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
  
  return {
    _id: doc._id ? doc._id.toString() : '',
    userId: doc.userId ? doc.userId.toString() : '',
    name: doc.name || '',
    date: doc.date || new Date(),
    duration: doc.duration || 0,
    intensity: doc.intensity || '',
    type: doc.type || '',
    distance: doc.distance,
    workoutExercises: doc.workoutExercises || [],
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

  // Handle dates - **Check if it's a valid Date before calling toISOString**
  if (obj instanceof Date && !isNaN(obj.getTime())) {
    return obj.toISOString();
  }
  // If it might be a date string, try parsing it
  if (typeof obj === 'string') {
     // Add a basic check for date-like strings, adjust regex as needed
     // This prevents trying to parse non-date strings
    if (/^\d{4}-\d{2}-\d{2}/.test(obj)) { 
        const potentialDate = new Date(obj);
        if (!isNaN(potentialDate.getTime())) {
            return potentialDate.toISOString();
        }
    }
    // Return the original string if not a parseable date
    return obj;
  }

  // Handle ObjectId
  // Use optional chaining and check _bsontype for more robustness
  if (obj?._bsontype === 'ObjectId' && typeof obj.toString === 'function') {
    return obj.toString();
  }

  // Handle arrays by mapping over each item
  if (Array.isArray(obj)) {
    return obj.map(item => convertToPlainObject(item));
  }
  
  // If we have a MongoDB document with a toObject method, use it first
  // Make sure obj is not null and toObject exists
  if (obj && typeof obj.toObject === 'function') {
    obj = obj.toObject({ virtuals: false }); // Call toObject, exclude virtuals
  }

  // Handle plain objects or objects from toObject()
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && !(obj instanceof Date)) {
    const result: any = {};
    for (const key in obj) {
      // Make sure it's an own property
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Skip internal Mongoose/mongo properties more broadly
        if (key.startsWith('$') || key === '__v') continue;
        result[key] = convertToPlainObject(obj[key]); // Recurse
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
    
    // 1. Fetch workouts
    const workoutDocs = await WorkoutModel.find({ userId: new ObjectId(userId) })
      .sort({ date: -1 })
      .limit(limit)
      .lean()
      .exec() as any[];
    
    // 2. Get all workout IDs
    const workoutIds = workoutDocs.map(doc => doc._id);

    // 3. Fetch all workout exercises for these workouts
    const workoutExercises = await WorkoutExerciseModel.find({
      workoutId: { $in: workoutIds }
    })
    .populate('exerciseId')
    .lean()
    .exec();

    // 4. Group exercises by workout ID
    const exercisesByWorkout = workoutExercises.reduce((acc, exercise) => {
      const workoutId = exercise.workoutId.toString();
      if (!acc[workoutId]) {
        acc[workoutId] = [];
      }
      acc[workoutId].push(exercise);
      return acc;
    }, {} as Record<string, any[]>);
    
    // 5. Map workouts with their exercises
    return workoutDocs.map((doc: any) => {
      const workoutId = doc._id.toString();
      return {
        _id: workoutId,
        userId: doc.userId.toString(),
        name: doc.name || '',
        date: doc.date instanceof Date ? doc.date.toISOString() : 
              (doc.date ? new Date(doc.date).toISOString() : new Date().toISOString()),
        duration: doc.duration || 0,
        distance: doc.distance || 0,
        intensity: doc.intensity || '',
        type: doc.type || '',
        calculatedVolume: doc.calculatedVolume,
        cardioDetails: doc.cardioDetails,
        notes: doc.notes || '',
        source: doc.source || '',
        sourceId: doc.sourceId || '',
        importedFrom: doc.importedFrom || '',
        importId: doc.importId || '',
        stravaLink: doc.stravaLink || '',
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : 
                  (doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString()),
        updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : 
                  (doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date().toISOString()),
        workoutExercises: (exercisesByWorkout[workoutId] || []).map(exercise => ({
          _id: exercise._id.toString(),
          workoutId: exercise.workoutId.toString(),
          exerciseId: exercise.exerciseId ? {
            _id: exercise.exerciseId._id.toString(),
            name: exercise.exerciseId.name,
            category: exercise.exerciseId.category
          } : null,
          sets: (exercise.sets || []).map(set => ({
            weight: set.weight || 0,
            reps: set.reps || 0,
            duration: set.duration,
            distance: set.distance,
            notes: set.notes,
            order: set.order
          })),
          notes: exercise.notes || '',
          order: exercise.order,
          duration: exercise.duration,
          distance: exercise.distance
        }))
      };
    });
  } catch (error) {
    console.error('Error getting workouts:', error)
    throw new Error('Failed to get workouts')
  }
}

// Helper function defined or imported here if needed
function calculateExerciseVolume(exercise: any): number {
  // Placeholder - Actual implementation needed
  // This function should calculate volume based on sets (weight * reps)
  // Similar logic might exist in workout-details-client.tsx or utils.ts
  if (!exercise || !exercise.sets) return 0;
  return exercise.sets.reduce((sum: number, set: any) => {
    const weight = set.weight || 0;
    const reps = set.reps || 0;
    return sum + (weight * reps);
  }, 0);
}

// Get a workout by ID
export async function getWorkoutById(id: string): Promise<WorkoutData | null> {
  try {
    await dbConnect()
    
    // 1. Fetch the main workout document without population
    const workoutDoc = await WorkoutModel.findById(id)
      .lean()
      .exec();
      
    if (!workoutDoc) {
      console.log(`[workoutRepository] Workout with ID ${id} not found.`);
      return null;
    }

    // Add an assertion to ensure workoutDoc is not an array
    if (Array.isArray(workoutDoc)) {
      // This case should ideally not happen with findById, but handle defensively
      console.error(`[workoutRepository] Expected single document for ID ${id}, but received array.`);
      throw new Error(`Unexpected array received for workout ID ${id}`);
    }

    // 2. Fetch related WorkoutExercise documents and populate their exerciseId
    const workoutExercises = await WorkoutExerciseModel.find({ workoutId: workoutDoc._id })
      .populate({ 
          path: 'exerciseId', 
          model: 'Exercise' // Ensure Exercise model is referenced correctly
      })
      .lean()
      .exec() as any[]; // Assert as any array for now to bypass complex type inference

    // 3. Combine the workout doc with the fetched exercises
    // Create a new object to avoid modifying the lean workoutDoc directly if needed elsewhere
    const combinedDoc = {
      ...(workoutDoc as any), // Cast workoutDoc to any before spreading
      workoutExercises: workoutExercises // Attach the fetched and populated exercises
    };

    // Use the serialization helper function
    const plainWorkout = convertToPlainObject(combinedDoc);

    // Optional: Add a check or type assertion if needed, but convertToPlainObject should handle it
    if (!plainWorkout || typeof plainWorkout !== 'object') {
        console.error(`[workoutRepository] Failed to convert workout ${id} to plain object.`);
        return null;
    }
    
    // Ensure the final object matches the expected return type
    return plainWorkout as WorkoutData;
  } catch (error) {
    console.error(`Error getting workout ${id}:`, error)
    throw new Error(`Failed to get workout ${id}`)
  }
}

// Create a new workout (Simplified userId handling)
export async function createWorkout(workoutData: Partial<WorkoutData>): Promise<WorkoutData> {
  try {
    await dbConnect();
    
    // Attempt to create ObjectId regardless, MongoDB driver/Mongoose might handle it
    const workoutToSave = {
      ...workoutData,
      userId: new ObjectId(workoutData.userId as string | ObjectId), // Convert or pass through
      date: workoutData.date || new Date(),
      volume: undefined, 
      exercises: undefined,
    };

    // Remove properties not in schema explicitly before saving
    delete (workoutToSave as any).volume;
    delete (workoutToSave as any).exercises;
    delete (workoutToSave as any).calculatedVolume; // Also remove this if it sneaks in
    delete (workoutToSave as any).pace; // Remove this if it sneaks in
    
    const workout = new WorkoutModel(workoutToSave);
    const savedWorkout = await workout.save();
    const result = savedWorkout.toObject();

    // Return mapped data, ensuring no volume field
    return {
      _id: result._id.toString(),
      userId: result.userId.toString(),
      name: result.name,
      date: result.date,
      duration: result.duration,
      intensity: result.intensity,
      type: result.type,
      distance: result.distance,
      workoutExercises: result.workoutExercises,
      cardioDetails: result.cardioDetails,
      notes: result.notes,
      stravaLink: result.stravaLink,
      source: result.source,
      sourceId: result.sourceId,
      importedFrom: result.importedFrom,
      importId: result.importId,
      createdAt: result.createdAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
      // Ensure records and other fields are mapped if needed, matching WorkoutData type
      records: result.records,
      calories: result.calories
    } as WorkoutData;

  } catch (error) {
    console.error("Error creating workout:", error)
    throw new Error("Failed to create workout")
  }
}

// Update an existing workout
export async function updateWorkout(id: string, workoutData: Partial<WorkoutData>): Promise<WorkoutData | null> {
  try {
    await dbConnect()
    
    // Separate fields for $set and $unset
    const { aiHighlight, ...setData } = workoutData;
    const updateOps: any = { $set: { ...setData, updatedAt: new Date() } };
    
    // Explicitly unset aiHighlight if it was passed as undefined (or null)
    if (workoutData.hasOwnProperty('aiHighlight') && (aiHighlight === undefined || aiHighlight === null)) {
      updateOps.$unset = { aiHighlight: "" }; 
    }
    
    const result = await WorkoutModel.findByIdAndUpdate(
      id,
      updateOps, // Use the combined update operations object
      { new: true } // Return the updated document
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
      distance: workout.distance,
      workoutExercises: workout.workoutExercises,
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
      "workoutExercises.name": exerciseName,
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
      workoutExercises: workoutDoc.workoutExercises || [],
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

/**
 * Fetch previous workouts of a specific type, excluding the current one.
 * @param userId - User ID
 * @param workoutType - Type of workout (e.g., 'running', 'strength')
 * @param currentDate - The date of the current workout (to find older ones)
 * @param currentWorkoutId - The ID of the current workout (to exclude it)
 * @param limit - Max number of previous workouts to return
 * @returns Array of previous workout documents (lean)
 */
export async function getPreviousWorkoutsByType(
  userId: string,
  workoutType: string,
  currentDate: Date,
  currentWorkoutId: string,
  limit = 10
): Promise<WorkoutData[]> {
  if (!userId || !workoutType || !currentDate || !currentWorkoutId) {
    console.error("[getPreviousWorkoutsByType] Missing required parameters.");
    return [];
  }

  console.log(`[getPreviousWorkoutsByType] Fetching previous '${workoutType}' workouts for user ${userId} before ${currentDate.toISOString()} (excluding ${currentWorkoutId}).`);

  try {
    await dbConnect();

    const previousWorkoutDocs = await WorkoutModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      type: workoutType,
      date: { $lt: currentDate }, // Find workouts strictly *before* the current date
      _id: { $ne: new mongoose.Types.ObjectId(currentWorkoutId) } // Exclude the current workout ID itself
    })
      .sort({ date: -1 }) // Sort by date descending (most recent first)
      .limit(limit)
      .lean() // Return plain JavaScript objects
      .exec();

    console.log(`[getPreviousWorkoutsByType] Found ${previousWorkoutDocs.length} previous workouts.`);

    // Use the serialization helper - ensure it handles potential errors gracefully
    const serializedWorkouts = previousWorkoutDocs.map(doc => {
        try {
            return convertToPlainObject(doc);
        } catch (serializeError) {
            console.error(`[getPreviousWorkoutsByType] Error serializing workout doc ${doc?._id}:`, serializeError);
            return null; // Return null for documents that fail serialization
        }
    }).filter(Boolean) as WorkoutData[]; // Filter out nulls and assert type

    return serializedWorkouts;

  } catch (error) {
    console.error(`Error fetching previous ${workoutType} workouts:`, error);
    return []; // Return empty array on error
  }
}

/**
 * Gets the Personal Record (PR) for a specific exercise.
 * For weight-based exercises, finds the max weight lifted for at least one rep.
 * For rep-based exercises (like pull-ups), finds the max reps done in a single set.
 * 
 * @param userId - The user's ID.
 * @param exerciseName - The exact name of the exercise.
 * @returns An object with the PR value, unit, and date, or null if no record found.
 */
export async function getExercisePR(
  userId: string,
  exerciseName: string
): Promise<{ value: number; unit: string; date: Date } | null> {
  try {
    await dbConnect();

    // --- Fetch Exercise Details ---
    const exercise = await ExerciseModel.findOne({ name: exerciseName }).lean<{ trackMaxReps?: boolean } | null>();
    if (!exercise) {
      console.warn(`[getExercisePR] Exercise named '${exerciseName}' not found.`);
      // Decide how to handle: return null or assume weight-based? Let's assume weight-based for now.
      // If you want to strictly return null, uncomment the next line:
      // return null;
    }
    const isRepBased = exercise?.trackMaxReps ?? false; // Use trackMaxReps, default to false if exercise not found or field missing
    console.log(`[getExercisePR] Exercise: '${exerciseName}', isRepBased (from trackMaxReps): ${isRepBased}`);
    // --- End Fetch Exercise Details ---

    let pipeline: any[] = [
      { $match: { userId: new ObjectId(userId), 'workoutExercises.name': exerciseName } },
      { $unwind: '$workoutExercises' },
      { $match: { 'workoutExercises.name': exerciseName } },
      { $unwind: '$workoutExercises.sets' },
    ];

    if (isRepBased) {
      // Find max reps in a single set
      pipeline.push(
        { $match: { 'workoutExercises.sets.reps': { $gt: 0 } } }, // Ensure reps > 0
        { $sort: { 'workoutExercises.sets.reps': -1, date: -1 } }, // Sort by reps desc, then date desc
        { $limit: 1 }
      );
    } else {
      // Find max weight lifted for at least 1 rep
      pipeline.push(
        { $match: { 'workoutExercises.sets.weight': { $gt: 0 }, 'workoutExercises.sets.reps': { $gte: 1 } } }, // Ensure weight > 0 and reps >= 1
        { $sort: { 'workoutExercises.sets.weight': -1, date: -1 } }, // Sort by weight desc, then date desc
        { $limit: 1 }
      );
    }

    const result = await WorkoutModel.aggregate(pipeline).exec();

    if (result.length > 0) {
      const record = result[0];
      if (isRepBased) {
        return {
          value: record.workoutExercises.sets.reps,
          unit: 'reps',
          date: record.date,
        };
      } else {
        return {
          value: record.workoutExercises.sets.weight,
          unit: 'kg', // Assuming weight is stored in kg
          date: record.date,
        };
      }
    }

    return null; // No matching record found
  } catch (error) {
    console.error(`Error getting PR for ${exerciseName}:`, error);
    // Don't throw, just return null if error occurs
    return null;
  }
}

/**
 * Gets the fastest pace for a specific running distance.
 * 
 * @param userId - The user's ID.
 * @param distanceKm - The target distance in kilometers (e.g., 5 for 5k).
 * @param tolerance - The tolerance for matching the distance (e.g., 0.1 for +/- 100m).
 * @returns An object with the pace (min/km) and date, or null if no record found.
 */
export async function getFastestPace(
  userId: string,
  distanceKm: number,
  tolerance: number = 0.1 
): Promise<{ pace: number; date: Date; workoutId: string } | null> { // Ensure workoutId is in return type
  try {
    await dbConnect();
    const minDistance = distanceKm - tolerance;
    const maxDistance = distanceKm + tolerance;

    const pipeline: any[] = [
      { $match: { userId: new ObjectId(userId), type: { $in: ['running', 'run'] }, "cardioDetails.distance": { $gte: minDistance, $lte: maxDistance, $gt: 0 }, duration: { $gt: 0 } } },
      { $addFields: { paceSecondsPerKm: { $cond: { if: { $and: [ { $gt: ["$cardioDetails.distance", 0] }, { $ne: ["$cardioDetails.distance", null] } ] }, then: { $divide: ["$duration", "$cardioDetails.distance"] }, else: null } } } },
      { $match: { paceSecondsPerKm: { $ne: null } } },
      { $sort: { paceSecondsPerKm: 1, date: -1 } },
      { $limit: 1 }
    ];

    const result = await WorkoutModel.aggregate(pipeline).exec();
    if (result.length > 0) {
      const record = result[0];
      const paceMinPerKm = record.paceSecondsPerKm / 60;
      return { pace: paceMinPerKm, date: record.date, workoutId: record._id.toString() }; // Include workoutId
    }
    return null;
  } catch (error) {
    console.error(`Error getting fastest ${distanceKm}k pace:`, error);
    return null;
  }
}

// Get recent workouts (Refactored)
export async function getRecentWorkouts(userId: string, limit = 10): Promise<any[]> {
  console.log(`Fetching recent workouts for user ${userId}, limit ${limit}`);
  try {
    // This function implementation was missing in the previous edit.
    // Re-implementing based on previous logic: Fetch all, sort, limit, serialize.
    await dbConnect();
    const workoutDocs = await WorkoutModel.find({ userId: new mongoose.Types.ObjectId(userId) })
      .sort({ date: -1 }) // Sort by date descending
      .limit(limit)
      .lean()
      .exec();
      
    // Use the serialization helper
    const serializedWorkouts = workoutDocs.map(doc => {
        try {
            return convertToPlainObject(doc);
        } catch (serializeError) {
            console.error(`[getRecentWorkouts] Error serializing workout doc ${doc?._id}:`, serializeError);
            return null; // Skip documents that fail serialization
        }
    }).filter(Boolean) as any[]; // Ensure result is properly typed/filtered

    console.log(`Returning ${serializedWorkouts.length} recent workouts.`);
    return serializedWorkouts;

  } catch (error) {
    console.error("Error fetching recent workouts:", error);
     // Return empty array on error, consistent with other functions
     return [];
  }
}

// Get all workouts for a user within a specific date range
export async function getUserWorkoutsByDateRange(
  userId: string,
  startDate: Date,
  endDate: Date,
  limit = 1000
): Promise<WorkoutData[]> {
  try {
    await dbConnect();
    
    console.log(`[getUserWorkoutsByDateRange] Fetching workouts for user ${userId} between ${startDate.toISOString()} and ${endDate.toISOString()}`);
    
    const workoutDocs = await WorkoutModel.find({
      userId: new mongoose.Types.ObjectId(userId),
      date: {
        $gte: startDate,
        $lte: endDate,
      },
      deletedAt: null // Exclude soft-deleted workouts
    })
      .sort({ date: -1 })
      .limit(limit)
      .lean()
      .exec() as any[]; // Use a less strict type after lean()

    console.log(`[getUserWorkoutsByDateRange] Found ${workoutDocs.length} workouts.`);

    // Convert Mongoose documents to plain objects suitable for client/API response
    const plainWorkouts = workoutDocs.map(doc => convertToPlainObject(doc) as WorkoutData);
    
    return plainWorkouts;

  } catch (error) {
    console.error(`Error fetching workouts for user ${userId} by date range:`, error);
    throw new Error("Failed to fetch workouts by date range.");
  }
}

// Function to get the timestamp of the latest workout for a user
export async function getLatestWorkoutTimestampForUser(userId: string): Promise<Date | null> {
    await dbConnect();
    console.log(`[WorkoutRepo] Fetching latest workout timestamp for User ${userId}`);
    try {
        // Explicitly type the expected result after .select and .lean
        const latestWorkout = await WorkoutModel.findOne({ 
            userId: new Types.ObjectId(userId),
            deletedAt: null // Only consider non-deleted workouts
        })
        .sort({ date: -1 }) // Sort by date descending to get the latest
        .select('date') // Only select the date field
        .lean() as { date: Date } | null; // Cast the result type

        if (latestWorkout && latestWorkout.date) {
            console.log(`[WorkoutRepo] Found latest workout date: ${latestWorkout.date.toISOString()}`);
            return latestWorkout.date;
        }
        console.log(`[WorkoutRepo] No workouts found for user.`);
        return null;
    } catch (error) {
        console.error('[WorkoutRepo] Error fetching latest workout timestamp:', error);
        throw new Error('Failed to fetch latest workout timestamp.');
    }
}

// Helper function to find the latest date among an array of workouts
export function findLatestTimestampInWorkouts(workouts: WorkoutData[]): Date | null {
    if (!workouts || workouts.length === 0) {
        return null;
    }
    // Assuming workouts are already sorted or we need to find the max date
    // For simplicity, let's assume the `date` field is reliable
    let latestDate: Date | null = null;
    for (const workout of workouts) {
        const workoutDate = new Date(workout.date); // Ensure it's a Date object
        if (!latestDate || workoutDate > latestDate) {
            latestDate = workoutDate;
        }
    }
    return latestDate;
}

