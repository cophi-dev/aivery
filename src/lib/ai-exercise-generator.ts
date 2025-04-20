"use server"

import mongoose from 'mongoose';
import dbConnect from '@/lib/db/mongodb';
import Exercise from '@/lib/db/models/exercise';
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
    const dbExercise = await Exercise.findOne({
      name: { $regex: new RegExp(`^${normalizedName}$`, 'i') } // Case-insensitive exact match
    }).lean(); // Use .lean() for plain JS object

    if (dbExercise) {
      console.log(`[ai-exercise-generator] Found exercise in DB: "${dbExercise.name}"`);
      // Map the found data to the Partial<ExerciseData> structure
      // Ensure all expected fields are present or handled
      return {
        name: exerciseName, // Keep original casing if preferred, or use dbExercise.name
        description: dbExercise.description,
        primaryMuscles: dbExercise.primaryMuscles,
        secondaryMuscles: dbExercise.secondaryMuscles,
        category: dbExercise.category as ExerciseCategory, // Assuming category matches
        equipment: dbExercise.equipment, // Already string[]
        instructions: dbExercise.instructions, // Already string[]
        level: dbExercise.level,
        aliases: dbExercise.aliases,
        images: dbExercise.images,
        videos: dbExercise.videos,
        // Add any other relevant fields from ExerciseData
      };
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