"use server"

import mongoose from 'mongoose';
import dbConnect from '@/lib/db/mongodb';
import ExerciseModel, { IExercise } from '@/lib/db/models/exercise';
import { ExerciseData } from "@/types/db";

// Define the proper category type
type ExerciseCategory = "strength" | "cardio" | "flexibility";

// Removed the hardcoded ExerciseTemplate interface and exerciseDatabase object

/**
 * Generate exercise details by looking up the exercise in the MongoDB database.
 * 
 * @param exerciseName The name of the exercise to generate details for
 * @returns Partial exercise data if found, or a basic object with the name if not found.
 */
export async function generateExerciseDetails(exerciseName: string): Promise<Partial<ExerciseData>> {
  console.log(`[ai-exercise-generator] Looking up exercise: "${exerciseName}"`);
  const normalizedName = exerciseName.trim().toLowerCase();
  const result: Partial<ExerciseData> = { name: exerciseName }; // Start with the name

  if (!normalizedName) {
    console.warn("[ai-exercise-generator] Empty exercise name provided.");
    return result; // Return just the (empty) name if input is empty
  }

  try {
    await dbConnect(); // Ensure database connection

    // Find exercise in the database (case-insensitive)
    const dbExercise = await ExerciseModel.findOne({
      name: { $regex: new RegExp(`^${normalizedName}$`, 'i') } // Case-insensitive exact match
    }).lean(); // Use .lean() for plain JS object

    if (dbExercise) {
      console.log(`[ai-exercise-generator] Found exercise in DB: "${dbExercise.name}"`);
      // Cast dbExercise to IExercise to help TypeScript understand its shape
      const exerciseDoc = dbExercise as any as IExercise; // Cast to expected interface
      
      // Map the found data using the casted object
      const exerciseData: Partial<ExerciseData> = {
        _id: exerciseDoc._id ? exerciseDoc._id.toString() : undefined, // Convert ObjectId to string
        name: exerciseName, 
        description: exerciseDoc.description,
        muscleGroups: exerciseDoc.muscleGroups, // Now accessed via casted type
        secondaryMuscles: exerciseDoc.secondaryMuscles,
        category: exerciseDoc.category as ExerciseCategory, 
        equipment: exerciseDoc.equipment, 
        instructions: exerciseDoc.instructions, 
        level: exerciseDoc.level,
        aliases: exerciseDoc.aliases,
        images: exerciseDoc.images,
        videos: exerciseDoc.videos,
      };
      return exerciseData;
    } else {
      console.log(`[ai-exercise-generator] Exercise "${exerciseName}" not found in DB.`);
      // If not found, return the basic object with just the name
      // Optionally, could attempt fuzzy matching against DB here if desired
      // For now, just return the name
      return result;
    }
  } catch (error) {
    console.error(`[ai-exercise-generator] Error fetching exercise "${exerciseName}" from DB:`, error);
    // Return the basic object with the name on error
    return result;
  }
  // We don't need a finally block to disconnect here, as Mongoose connection
  // management is typically handled globally or per-request in Next.js.
} 