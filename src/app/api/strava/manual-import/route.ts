import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createCardioWorkout } from "@/lib/workout-actions";
import { revalidatePath } from "next/cache";
import { transformStravaActivity } from "@/lib/services/stravaService";
import { getDatabase } from '@/lib/db/mongodb';

// Keep runtime (Node.js needed for file handling)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Set max duration to 60s (Hobby plan limit)

// Function to create base exercise types when they don't exist
async function createBaseExerciseForType(type: string): Promise<void> {
  try {
    console.log(`Creating base exercise for type: ${type}`);
    
    // Clean up the exercise name - capitalize first letter
    const exerciseName = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
    
    // Get database connection
    const db = await getDatabase();
    
    // Check if the exercise already exists
    const existingExercise = await db.collection('exercises').findOne({
      name: exerciseName,
      category: 'cardio'
    });
    
    if (existingExercise) {
      console.log(`Exercise '${exerciseName}' already exists in the database.`);
      return;
    }
    
    // Create a new exercise document
    const exerciseDoc = {
      name: exerciseName,
      category: 'cardio',
      muscleGroups: [], // Cardio exercises don't target specific muscle groups
      equipment: [],    // No specific equipment for generic cardio
      instructions: '',
      userId: null,     // System exercise (not user-specific)
      createdAt: new Date(),
      updatedAt: new Date(),
      isSystemExercise: true, // Mark as system-created
      isDefault: true         // This is a default exercise
    };
    
    // Insert the exercise
    const result = await db.collection('exercises').insertOne(exerciseDoc);
    console.log(`Created base exercise '${exerciseName}' with ID: ${result.insertedId}`);
  } catch (error) {
    console.error(`Error creating base exercise for type '${type}':`, error);
    throw new Error(`Failed to create base exercise: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// API route handler for direct file uploads (GPX, FIT, etc.)
export async function POST(request: NextRequest) {
  try {
    console.log('=== Starting manual Strava file import ===');
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      console.error('No authenticated session');
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    console.log('User authenticated:', userId);

    // Get form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: "No file provided" 
      }, { status: 400 });
    }
    
    console.log(`Processing file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
    
    // Check file extension
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.gpx') && !fileName.endsWith('.fit') && !fileName.endsWith('.fit.gz') && !fileName.endsWith('.tcx')) {
      return NextResponse.json({ 
        success: false, 
        error: "Unsupported file type. Please upload a .gpx, .fit, .fit.gz, or .tcx file." 
      }, { status: 400 });
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    
    // Process file based on type
    let workout = null;
    if (fileName.endsWith('.gpx')) {
      // Import helper functions from the import route
      const { processGpxFile } = await import('../import/route');
      workout = await processGpxFile(fileBuffer, fileName);
    } else if (fileName.endsWith('.fit') || fileName.endsWith('.fit.gz')) {
      // Import helper functions from the import route
      const { processFitFile } = await import('../import/route');
      workout = await processFitFile(fileBuffer, fileName);
    } else if (fileName.endsWith('.tcx')) {
      return NextResponse.json({ 
        success: false, 
        error: "TCX files are not yet supported for direct upload." 
      }, { status: 400 });
    }
    
    if (!workout) {
      return NextResponse.json({ 
        success: false, 
        error: "Could not extract workout data from the file" 
      }, { status: 400 });
    }
    
    // Transform workout data
    const transformedWorkout = transformStravaActivity(workout);
    
    // Fix future dates if needed
    if (transformedWorkout.date) {
      const activityDate = transformedWorkout.date instanceof Date ? 
                          transformedWorkout.date : 
                          new Date(transformedWorkout.date);
      const now = new Date();
      
      // If the date is in the future (likely a parsing error)
      if (activityDate > now) {
        console.log(`Detected future date in activity: ${activityDate.toISOString()}, fixing...`);
        // Set to current date minus random days (to avoid duplicate dates)
        const newDate = new Date(now.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000));
        transformedWorkout.date = newDate; // Set as Date object directly
      }
    }
    
    // Create workout object
    const workoutToSave = {
      ...transformedWorkout,
      distance: transformedWorkout.distance,
      duration: transformedWorkout.duration || 0,
      userId: session.user.id,
      source: "strava",
      sourceId: fileName.replace(/\.[^/.]+$/, ""), // Use filename without extension as ID
      stravaLink: undefined // No Strava link for manual uploads
    };
    
    console.log('Processed workout data:', {
      name: (workoutToSave as any).name, // Cast to any for logging to bypass TS error
      type: workoutToSave.type,
      date: workoutToSave.date,
      duration: workoutToSave.duration,
      distance: workoutToSave.distance
    });
    
    // Improve activity type detection
    if (workoutToSave.type === 'unknown' || workoutToSave.type === 'other') {
      // Try to detect activity type from average speed
      if (workout.average_speed) {
        const speedInKmHr = workout.average_speed * 3.6; // m/s to km/h
        if (speedInKmHr > 15) {
          console.log(`Speed detected as ${speedInKmHr} km/h, likely cycling`);
          workoutToSave.type = 'cycling';
        } else if (speedInKmHr > 3) {
          console.log(`Speed detected as ${speedInKmHr} km/h, likely running`);
          workoutToSave.type = 'running';
        } else {
          console.log(`Speed detected as ${speedInKmHr} km/h, likely walking`);
          workoutToSave.type = 'walking';
        }
      }
    }
    
    // Save workout to database with error handling
    try {
      // First try creating the workout directly
      await createCardioWorkout(workoutToSave);
      console.log(`Successfully imported workout from ${fileName}`);
    } catch (error) {
      // Check if the error is about missing exercise data
      const errorMsg = error instanceof Error ? error.message : String(error);
      const isMissingExerciseError = errorMsg.includes('Essential exercise data missing') || 
                                 errorMsg.includes('Could not find') ||
                                 errorMsg.includes('in exercises collection');
      
      if (isMissingExerciseError) {
        console.log(`Missing exercise type: ${workoutToSave.type}. Creating base exercise...`);
        // Create the base exercise
        await createBaseExerciseForType(workoutToSave.type);
        
        // Try again
        await createCardioWorkout(workoutToSave);
        console.log(`Successfully imported workout after creating exercise type`);
      } else {
        // Rethrow other errors
        throw error;
      }
    }
    
    // Revalidate paths
    revalidatePath("/calendar");
    revalidatePath("/activity");
    revalidatePath("/dashboard");
    
    return NextResponse.json({ 
      success: true,
      workout: {
        name: (workoutToSave as any).name, // Cast to any to bypass TS error
        type: workoutToSave.type,
        date: workoutToSave.date,
        duration: workoutToSave.duration,
        distance: workoutToSave.distance
      }
    });
    
  } catch (error) {
    console.error("Error importing file:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: 500 });
  }
} 