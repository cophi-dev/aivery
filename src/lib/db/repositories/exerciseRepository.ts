import { ObjectId } from "mongodb"
import dbConnect from '../mongodb'
import ExerciseModel, { IExercise } from '../models/exercise'
import type { ExerciseData } from "@/types/db"

// Convert Mongoose document to ExerciseData
function convertDocToExerciseData(doc: any): ExerciseData {
  if (!doc) return {} as ExerciseData;
  
  return {
    _id: doc._id ? doc._id.toString() : '',
    name: doc.name || '',
    description: doc.description || '',
    muscleGroups: doc.muscleGroups || [],
    category: doc.category || 'strength',
    equipment: doc.equipment || '',
    instructions: doc.instructions || '',
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : String(doc.createdAt || new Date()),
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt || new Date()),
  };
}

// Get all exercises
export async function getAllExercises(): Promise<ExerciseData[]> {
  try {
    await dbConnect()
    
    const exerciseDocs = await ExerciseModel.find()
      .sort({ name: 1 })
      .lean()
      .exec()

    return exerciseDocs.map(doc => convertDocToExerciseData(doc));
  } catch (error) {
    console.error('Error getting exercises:', error)
    throw new Error('Failed to get exercises')
  }
}

// Get exercises by category
export async function getExercisesByCategory(category: string): Promise<ExerciseData[]> {
  try {
    await dbConnect()
    
    const exerciseDocs = await ExerciseModel.find({ category })
      .sort({ name: 1 })
      .lean()
      .exec()

    return exerciseDocs.map(doc => convertDocToExerciseData(doc));
  } catch (error) {
    console.error(`Error getting exercises by category ${category}:`, error)
    throw new Error(`Failed to get exercises by category ${category}`)
  }
}

// Get exercises by muscle group
export async function getExercisesByMuscleGroup(muscleGroup: string): Promise<ExerciseData[]> {
  try {
    await dbConnect()
    
    const exerciseDocs = await ExerciseModel.find({ muscleGroups: muscleGroup })
      .sort({ name: 1 })
      .lean()
      .exec()

    return exerciseDocs.map(doc => convertDocToExerciseData(doc));
  } catch (error) {
    console.error(`Error getting exercises by muscle group ${muscleGroup}:`, error)
    throw new Error(`Failed to get exercises by muscle group ${muscleGroup}`)
  }
}

// Get exercise by ID
export async function getExerciseById(id: string): Promise<ExerciseData | null> {
  try {
    await dbConnect()
    
    const exerciseDoc = await ExerciseModel.findById(id).lean().exec()

    if (!exerciseDoc) {
      return null
    }
    
    return convertDocToExerciseData(exerciseDoc);
  } catch (error) {
    console.error(`Error getting exercise ${id}:`, error)
    throw new Error(`Failed to get exercise ${id}`)
  }
}

// Get exercise by name
export async function getExerciseByName(name: string): Promise<ExerciseData | null> {
  try {
    await dbConnect()
    
    const exerciseDoc = await ExerciseModel.findOne({ name }).lean().exec()

    if (!exerciseDoc) {
      return null
    }
    
    return convertDocToExerciseData(exerciseDoc);
  } catch (error) {
    console.error(`Error getting exercise by name ${name}:`, error)
    throw new Error(`Failed to get exercise by name ${name}`)
  }
}

// Create a new exercise
export async function createExercise(exerciseData: Partial<ExerciseData>): Promise<ExerciseData> {
  try {
    await dbConnect()
    
    const exercise = new ExerciseModel({
      name: exerciseData.name,
      description: exerciseData.description || "",
      muscleGroups: exerciseData.muscleGroups || [],
      category: exerciseData.category || "strength",
      equipment: exerciseData.equipment || "",
      instructions: exerciseData.instructions || "",
    })

    const savedExercise = await exercise.save()
    const result = savedExercise.toObject()

    return convertDocToExerciseData(result);
  } catch (error) {
    console.error("Error creating exercise:", error)
    throw new Error("Failed to create exercise")
  }
}

// Update an existing exercise
export async function updateExercise(id: string, exerciseData: Partial<ExerciseData>): Promise<ExerciseData | null> {
  try {
    await dbConnect()
    
    const result = await ExerciseModel.findByIdAndUpdate(
      id,
      { ...exerciseData, updatedAt: new Date() },
      { new: true }
    ).lean().exec()

    if (!result) {
      return null
    }

    return convertDocToExerciseData(result);
  } catch (error) {
    console.error(`Error updating exercise ${id}:`, error)
    throw new Error(`Failed to update exercise ${id}`)
  }
}

// Delete an exercise
export async function deleteExercise(id: string): Promise<boolean> {
  try {
    await dbConnect()
    
    const result = await ExerciseModel.findByIdAndDelete(id).exec()
    return !!result
  } catch (error) {
    console.error(`Error deleting exercise ${id}:`, error)
    throw new Error(`Failed to delete exercise ${id}`)
  }
} 