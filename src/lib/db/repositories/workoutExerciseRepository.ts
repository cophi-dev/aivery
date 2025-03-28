import { ObjectId } from "mongodb"
import dbConnect from '../mongodb'
import WorkoutExerciseModel, { IWorkoutExercise } from '../models/workoutExercise'
import ExerciseModel from '../models/exercise'
import type { WorkoutExerciseData, ExerciseData } from "@/types/db"

// Convert Mongoose document to WorkoutExerciseData
function convertDocToWorkoutExerciseData(doc: any, exercise?: any): WorkoutExerciseData {
  if (!doc) return {} as WorkoutExerciseData;
  
  return {
    _id: doc._id ? doc._id.toString() : '',
    workoutId: doc.workoutId ? doc.workoutId.toString() : '',
    exerciseId: doc.exerciseId ? doc.exerciseId.toString() : '',
    exercise: exercise ? {
      _id: exercise._id ? exercise._id.toString() : '',
      name: exercise.name || '',
      description: exercise.description || '',
      muscleGroups: exercise.muscleGroups || [],
      category: exercise.category || 'strength',
      equipment: exercise.equipment || '',
      instructions: exercise.instructions || '',
      createdAt: exercise.createdAt instanceof Date ? exercise.createdAt.toISOString() : String(exercise.createdAt),
      updatedAt: exercise.updatedAt instanceof Date ? exercise.updatedAt.toISOString() : String(exercise.updatedAt),
    } : undefined,
    sets: doc.sets || [],
    notes: doc.notes || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt || new Date()),
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
      exerciseId: new ObjectId(workoutExerciseData.exerciseId),
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

// Get all workout exercises for an exercise
export async function getWorkoutExercisesByExerciseId(exerciseId: string): Promise<WorkoutExerciseData[]> {
  try {
    await dbConnect()
    
    const workoutExerciseDocs = await WorkoutExerciseModel.find({ exerciseId: new ObjectId(exerciseId) })
      .lean()
      .exec()

    // Fetch the exercise data
    const exercise = await ExerciseModel.findById(exerciseId).lean().exec()
    
    return workoutExerciseDocs.map(doc => {
      return convertDocToWorkoutExerciseData(doc, exercise)
    });
  } catch (error) {
    console.error(`Error getting workout exercises for exercise ${exerciseId}:`, error)
    throw new Error(`Failed to get workout exercises for exercise ${exerciseId}`)
  }
} 