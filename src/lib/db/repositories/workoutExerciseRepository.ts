import { ObjectId } from "mongodb"
import dbConnect from '../mongodb'
import WorkoutExerciseModel, { IWorkoutExercise } from '../models/workoutExercise'
import ExerciseModel from '../models/exercise'
import type { WorkoutExerciseData, ExerciseData } from "@/types/db"
import WorkoutModel from "../models/workout"
import { isValidObjectId } from 'mongoose'

// Convert Mongoose document to WorkoutExerciseData
function convertDocToWorkoutExerciseData(doc: any, exercise?: any, workout?: any): WorkoutExerciseData {
  if (!doc) return {} as WorkoutExerciseData;
  
  // Determine the correct date: Use parent workout date if available, otherwise fallback
  const dateToUse = workout?.date || workout?.createdAt || doc.createdAt;
  
  // --- Calculate Pace --- 
  let calculatedPace: number | undefined = undefined;
  const duration = doc.duration !== undefined && !isNaN(Number(doc.duration)) ? Number(doc.duration) : undefined;
  const distance = doc.distance !== undefined && !isNaN(Number(doc.distance)) ? Number(doc.distance) : undefined;
  
  if (duration !== undefined && duration > 0 && distance !== undefined && distance > 0) {
    // Calculate pace in seconds per kilometer
    calculatedPace = duration / distance;
  }
  // --- End Calculate Pace ---

  return {
    _id: doc._id ? doc._id.toString() : '',
    workoutId: doc.workoutId ? doc.workoutId.toString() : '',
    exerciseId: exercise ? {
        _id: exercise._id ? exercise._id.toString() : '',
        name: exercise.name || 'Unknown Exercise',
        category: exercise.category || ''
    } : {
        _id: doc.exerciseId ? doc.exerciseId.toString() : '',
        name: 'Unknown Exercise',
        category: ''
    },
    sets: doc.sets || [],
    notes: doc.notes || '',
    duration: duration,
    distance: distance,
    pace: calculatedPace,
    speed: doc.speed !== undefined && !isNaN(Number(doc.speed)) ? Number(doc.speed) : undefined,
    elevationGain: doc.elevationGain !== undefined && !isNaN(Number(doc.elevationGain)) ? Number(doc.elevationGain) : undefined,
    calories: doc.calories !== undefined && !isNaN(Number(doc.calories)) ? Number(doc.calories) : undefined,
    createdAt: dateToUse instanceof Date ? dateToUse.toISOString() : String(dateToUse || new Date()),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt || new Date()),
  };
}

// Get all workout exercises for a workout
export async function getWorkoutExercisesByWorkoutId(workoutId: string): Promise<WorkoutExerciseData[]> {
  try {
    await dbConnect()
    
    const workoutExerciseDocs = await WorkoutExerciseModel.find({ workoutId: new ObjectId(workoutId) })
      .lean()
      .exec()

    // Get all exercise IDs
    const exerciseIds = workoutExerciseDocs.map(doc => (doc as any).exerciseId)
    
    // Fetch all exercises in a single query
    const exercises = await ExerciseModel.find({ _id: { $in: exerciseIds } }).lean().exec()
    
    // Create a map of exercise ID to exercise
    const exerciseMap = new Map()
    exercises.forEach(exercise => {
      if (exercise && exercise._id) {
        exerciseMap.set(exercise._id.toString(), exercise)
      }
    })

    return workoutExerciseDocs.map(doc => {
      const docAny = doc as any
      const exerciseId = docAny.exerciseId ? docAny.exerciseId.toString() : ''
      const exercise = exerciseMap.get(exerciseId)
      return convertDocToWorkoutExerciseData(doc, exercise)
    });
  } catch (error) {
    console.error(`Error getting workout exercises for workout ${workoutId}:`, error)
    throw new Error(`Failed to get workout exercises for workout ${workoutId}`)
  }
}

// Get a workout exercise by ID
export async function getWorkoutExerciseById(id: string): Promise<WorkoutExerciseData | null> {
  try {
    await dbConnect()
    
    const workoutExerciseDoc = await WorkoutExerciseModel.findById(id).lean().exec()

    if (!workoutExerciseDoc) {
      return null
    }
    
    const exerciseId = (workoutExerciseDoc as any).exerciseId
    const exercise = exerciseId ? await ExerciseModel.findById(exerciseId).lean().exec() : null
    
    return convertDocToWorkoutExerciseData(workoutExerciseDoc, exercise);
  } catch (error) {
    console.error(`Error getting workout exercise ${id}:`, error)
    throw new Error(`Failed to get workout exercise ${id}`)
  }
}

// Create a new workout exercise
export async function createWorkoutExercise(workoutExerciseData: Partial<WorkoutExerciseData>): Promise<WorkoutExerciseData> {
  try {
    await dbConnect()
    
    const workoutExercise = new WorkoutExerciseModel({
      workoutId: new ObjectId(workoutExerciseData.workoutId),
      exerciseId: new ObjectId(workoutExerciseData.exerciseId?._id),
      sets: workoutExerciseData.sets || [],
      notes: workoutExerciseData.notes || "",
    })

    const savedWorkoutExercise = await workoutExercise.save()
    const result = savedWorkoutExercise.toObject()
    
    const exercise = await ExerciseModel.findById(result.exerciseId).lean().exec()

    return convertDocToWorkoutExerciseData(result, exercise);
  } catch (error) {
    console.error("Error creating workout exercise:", error)
    throw new Error("Failed to create workout exercise")
  }
}

// Update an existing workout exercise
export async function updateWorkoutExercise(id: string, workoutExerciseData: Partial<WorkoutExerciseData>): Promise<WorkoutExerciseData | null> {
  try {
    await dbConnect()
    
    const result = await WorkoutExerciseModel.findByIdAndUpdate(
      id,
      { 
        sets: workoutExerciseData.sets,
        notes: workoutExerciseData.notes,
        updatedAt: new Date() 
      },
      { new: true }
    ).lean().exec()

    if (!result) {
      return null
    }

    const exerciseId = (result as any).exerciseId
    const exercise = exerciseId ? await ExerciseModel.findById(exerciseId).lean().exec() : null
    
    return convertDocToWorkoutExerciseData(result, exercise);
  } catch (error) {
    console.error(`Error updating workout exercise ${id}:`, error)
    throw new Error(`Failed to update workout exercise ${id}`)
  }
}

// Delete a workout exercise
export async function deleteWorkoutExercise(id: string): Promise<boolean> {
  try {
    await dbConnect()
    
    const result = await WorkoutExerciseModel.findByIdAndDelete(id).exec()
    return !!result
  } catch (error) {
    console.error(`Error deleting workout exercise ${id}:`, error)
    throw new Error(`Failed to delete workout exercise ${id}`)
  }
}

// Delete all workout exercises for a workout
export async function deleteWorkoutExercisesByWorkoutId(workoutId: string): Promise<boolean> {
  try {
    await dbConnect()
    
    const result = await WorkoutExerciseModel.deleteMany({ workoutId: new ObjectId(workoutId) }).exec()
    return !!result
  } catch (error) {
    console.error(`Error deleting workout exercises for workout ${workoutId}:`, error)
    throw new Error(`Failed to delete workout exercises for workout ${workoutId}`)
  }
}

// Get all workout exercises for a specific user and exercise
export async function getWorkoutExercisesByExerciseId(
  exerciseId: string, 
  userId: string
): Promise<WorkoutExerciseData[]> {
  try {
    await dbConnect()

    // Query WorkoutExerciseModel directly with userId (as confirmed by schema)
    const workoutExerciseDocs = await WorkoutExerciseModel.find({ 
      exerciseId: new ObjectId(exerciseId),
      userId: new ObjectId(userId)
    })
      .sort({ createdAt: -1 }) // Keep sorting by WorkoutExercise creation for now
      .lean()
      .exec()

    if (workoutExerciseDocs.length === 0) {
      return [];
    }

    // Fetch the base exercise data
    const exercise = await ExerciseModel.findById(exerciseId).lean().exec()

    // --- Fetch parent Workout data specifically for dates --- 
    const workoutIds = workoutExerciseDocs.map(doc => doc.workoutId).filter(isValidObjectId);
    const workoutDetailsMap = new Map();
    if (workoutIds.length > 0) {
      const relatedWorkouts = await WorkoutModel.find({ _id: { $in: workoutIds } }).lean().exec();
      relatedWorkouts.forEach(w => {
          if (w && w._id) { // Check if w and w._id are not null/undefined
              workoutDetailsMap.set((w._id as ObjectId).toString(), w); 
          }
      });
    }
    // --- End fetching parent Workout data ---
    
    // Map documents, passing parent workout data to converter
    return workoutExerciseDocs.map(doc => {
      const parentWorkout = workoutDetailsMap.get(doc.workoutId.toString());
      // Pass parent workout data to the conversion function
      return convertDocToWorkoutExerciseData(doc, exercise, parentWorkout) 
    });

  } catch (error) {
    console.error(`Error getting workout exercises for exercise ${exerciseId} and user ${userId}:`, error)
    throw new Error(`Failed to get workout exercises for exercise ${exerciseId}`)
  }
} 