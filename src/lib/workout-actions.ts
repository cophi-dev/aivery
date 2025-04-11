"use server"

import { revalidatePath } from "next/cache"
import {
  getWorkoutsByUserId as getWorkoutsByUserIdDb,
  getWorkoutById as getWorkoutByIdDb,
  createWorkout as createWorkoutDb,
  deleteWorkout as deleteWorkoutDb,
  getPreviousWorkouts,
  updateWorkout as updateWorkoutDb,
} from "@/lib/db/repositories/workoutRepository"
import { getCurrentUser } from "./auth"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ObjectId } from 'mongodb'
import { IWorkout } from "@/lib/db/models/workout"
import WorkoutExerciseModel, { IWorkoutExercise } from "@/lib/db/models/workoutExercise"
import ExerciseModel, { IExercise } from "@/lib/db/models/exercise"
import type { WorkoutData } from "@/types/db"
import mongoose, { Types } from 'mongoose'
import WorkoutModel from "@/lib/db/models/workout"
import { format } from 'date-fns'
import { estimateBodyweightForExercise } from "@/lib/utils"

// Define an interface for the input set structure expected by createWorkout
interface InputSetData {
    weight?: number;
    reps?: number;
    duration?: number;
    distance?: number;
    notes?: string;
}

// Type representing a WorkoutExercise populated with its Exercise details
// We might move this to types/db.ts later
interface PopulatedWorkoutExercise extends Omit<IWorkoutExercise, 'exerciseId'> { 
  exerciseId: IExercise & { _id: Types.ObjectId };
}

// Helper function to deeply serialize Mongoose docs/objects
// Converts ObjectIds and Dates to strings, ensures plain objects
function deepSerialize(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    // Return primitives directly
    return obj;
  }

  // Handle Mongoose ObjectId
  // Use 'instanceof' and also check for ObjectId structure if needed
  if (obj instanceof mongoose.Types.ObjectId) {
    return obj.toString();
  }
  // Sometimes lean() might return {_id: ..., ...} without instanceof working perfectly
  if (typeof obj._id === 'object' && obj._id instanceof mongoose.Types.ObjectId) {
     obj._id = obj._id.toString(); // Serialize _id within the object too
  }

  // Handle Date
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle Arrays: Recursively serialize each item
  if (Array.isArray(obj)) {
    return obj.map(item => deepSerialize(item));
  }

  // Handle Mongoose Documents explicitly first
  if (typeof obj.toObject === 'function') {
    // Convert Mongoose doc to plain object first
    obj = obj.toObject(); 
  }

  // Handle generic Objects: Recursively serialize properties
  // Crucially, this needs to handle the plain object resulting from .toObject()
  const serializedObj: { [key: string]: any } = {};
  for (const key in obj) {
    // Ensure it's an own property and handle potential prototype pollution
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
        // Check if the key is _id and needs serialization after toObject
        if (key === '_id' && obj[key] instanceof mongoose.Types.ObjectId) {
            serializedObj[key] = obj[key].toString();
        } else {
            // Recursively serialize the property value
            serializedObj[key] = deepSerialize(obj[key]);
        }
    }
  }
  
  return serializedObj;
}

// Fetch all workouts for the current user (Refactored)
// Returns serialized data suitable for client components
export async function fetchWorkouts(): Promise<any[]> { 
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      console.warn("User not authenticated in fetchWorkouts");
      return []; 
    }
    const userId = user.id;
    console.log(`Fetching all workouts for user: ${userId}`);

    // 1. Fetch all workout documents for user, sorted by date descending
    // Use .lean() here as we mostly need plain data downstream
    const workoutDocs = await WorkoutModel.find({ userId: userId }).sort({ date: -1 }).lean(); 

    if (!workoutDocs || workoutDocs.length === 0) {
        console.log(`No workouts found for user: ${userId}`);
        return [];
    }
    console.log(`Found ${workoutDocs.length} workout documents.`);

    // --- ORIGINAL CODE (RESTORED WITH ERROR LOGGING) --- 
    // 2. Get workout IDs
    const workoutIds = workoutDocs.map((doc: any) => doc._id); // Use lean doc

    // 3. Fetch all relevant WorkoutExercise documents, populated
    console.log(`Fetching workout exercises for ${workoutIds.length} workouts...`);
    const workoutExercisesDocs = await WorkoutExerciseModel
      .find({ workoutId: { $in: workoutIds } })
      .populate<{ exerciseId: IExercise & { _id: Types.ObjectId }}>('exerciseId') 
      .lean() // Use lean here too for easier processing
      .sort({ workoutId: 1, order: 1 }); // Sort for easier grouping
    console.log(`Found ${workoutExercisesDocs.length} total workout exercises.`);

    // 4. Group workoutExercises by workoutId (Removed specific error handling)
    const exercisesByWorkoutId = new Map<string, any[]>();
    for (const exerciseDoc of workoutExercisesDocs as any[]) {
        // try {
            const workoutIdStr = exerciseDoc.workoutId.toString();
            if (!exercisesByWorkoutId.has(workoutIdStr)) {
                exercisesByWorkoutId.set(workoutIdStr, []);
            }
            // Manually serialize each exercise doc as we group it
            const plainExercise = {
                _id: exerciseDoc._id.toString(),
                userId: exerciseDoc.userId.toString(),
                workoutId: workoutIdStr, // Already string
                order: exerciseDoc.order,
                notes: exerciseDoc.notes,
                exerciseId: exerciseDoc.exerciseId ? {
                    _id: exerciseDoc.exerciseId._id.toString(),
                    name: exerciseDoc.exerciseId.name,
                    category: exerciseDoc.exerciseId.category,
                } : null,
                sets: exerciseDoc.sets ? exerciseDoc.sets.map((set: any) => ({
                    weight: set.weight,
                    reps: set.reps,
                    duration: set.duration,
                    distance: set.distance,
                    notes: set.notes,
                    order: set.order,
                })) : [],
                duration: exerciseDoc.duration,
                distance: exerciseDoc.distance,
                // Add other fields if needed
                createdAt: (exerciseDoc.createdAt as Date)?.toISOString(), // Handle potential non-Date
                updatedAt: (exerciseDoc.updatedAt as Date)?.toISOString(), // Handle potential non-Date
            };
            exercisesByWorkoutId.get(workoutIdStr)!.push(plainExercise);
        // } catch(err) {
        //     console.error(`[fetchWorkouts ERROR] Failed processing/serializing exercise ${exerciseDoc._id?.toString()} for workout ${exerciseDoc.workoutId?.toString()}:`, err);
        //     // Optionally continue to next exercise, or rethrow if critical
        //     // continue;
        // }
    }

    // 5. Combine workouts with their grouped, serialized exercises (Removed specific error handling)
    const combinedWorkouts = [];
    for (const workoutDoc of workoutDocs as any[]) {
        // try {
            const workoutIdStr = workoutDoc._id.toString();
            // Manually serialize the workout doc (since we used .lean())
            const plainWorkout: any = {
                _id: workoutIdStr,
                userId: workoutDoc.userId.toString(),
                name: workoutDoc.name,
                date: (workoutDoc.date as Date)?.toISOString(), // Handle potential non-Date
                duration: workoutDoc.duration,
                intensity: workoutDoc.intensity,
                type: workoutDoc.type,
                notes: workoutDoc.notes,
                completed: workoutDoc.completed,
                completedAt: (workoutDoc.completedAt as Date)?.toISOString(),
                source: workoutDoc.source,
                sourceId: workoutDoc.sourceId,
                // ... other simple fields
                createdAt: (workoutDoc.createdAt as Date)?.toISOString(),
                updatedAt: (workoutDoc.updatedAt as Date)?.toISOString(),
                // Serialize complex fields carefully
                cardioDetails: workoutDoc.cardioDetails ? deepSerialize(workoutDoc.cardioDetails) : undefined,
                records: workoutDoc.records ? deepSerialize(workoutDoc.records) : [],
            };
            // Attach the corresponding exercises
            const finalWorkout = {
                ...plainWorkout,
                workoutExercises: exercisesByWorkoutId.get(workoutIdStr) || [], // Get exercises or empty array
            };
            combinedWorkouts.push(finalWorkout);
        // } catch (err) {
        //     console.error(`[fetchWorkouts ERROR] Failed combining/serializing workout ${workoutDoc._id?.toString()}:`, err);
        //      // Optionally continue to next workout, or rethrow if critical
        //     // continue;
        // }
    }
    
    // Removed debug log
    // console.log(`[fetchWorkouts Return] Dates in final returned array: ${combinedWorkouts.map((w: any) => w.date).join(', ') || 'Empty array'}`);
    console.log(`Returning ${combinedWorkouts.length} combined and serialized workouts.`);
    return combinedWorkouts;
 // --- END ORIGINAL CODE --- 

  } catch (error) {
    console.error("Error fetching workouts:", error);
    return []; // Return empty array on error
  }
}

// Fetch a single workout with its populated exercises (Refactored & Manually Serialized)
export async function fetchWorkout(id: string): Promise<any | null> { 
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      console.warn("User not authenticated in fetchWorkout");
      return null; 
    }
    const userId = user.id;

    console.log(`Fetching workout with ID: ${id} for user: ${userId}`);

    // 1. Fetch the main workout document (as a full Mongoose document)
    const workout = await WorkoutModel.findById(id);

    if (!workout) {
      console.log(`Workout with ID: ${id} not found.`);
      return null;
    }

    // 2. Check ownership
    if (workout.userId.toString() !== userId) {
        console.warn(`User ${userId} attempted to fetch workout ${id} owned by ${workout.userId.toString()}`);
        return null;
    }
    console.log(`Workout ${id} found and ownership verified.`);

    // 3. Fetch associated WorkoutExercise documents (as full Mongoose documents) and populate
    console.log(`Fetching workout exercises for workout ID: ${id}`);
    // Ensure the populate path matches the schema field name
    const workoutExercisesDocs = await WorkoutExerciseModel
      .find({ workoutId: workout._id })
      .populate<{ exerciseId: IExercise & { _id: Types.ObjectId }}>('exerciseId') 
      .sort({ order: 1 });
      
    console.log(`Found ${workoutExercisesDocs.length} workout exercises.`);

    // 4. Manually serialize workoutExercisesDocs
    const plainWorkoutExercises = workoutExercisesDocs.map(doc => ({
      _id: doc._id.toString(),
      userId: doc.userId.toString(),
      workoutId: doc.workoutId.toString(),
      order: doc.order,
      notes: doc.notes,
      // Safely access populated exercise details
      exerciseId: doc.exerciseId ? {
        _id: doc.exerciseId._id.toString(),
        name: doc.exerciseId.name,
        category: doc.exerciseId.category,
        // Add other Exercise fields if needed by the frontend
      } : null, // Handle case where population might fail (though unlikely here)
      // Serialize sets array
      sets: doc.sets ? doc.sets.map((set: any) => ({ // Use any for now
          weight: set.weight,
          reps: set.reps,
          duration: set.duration,
          distance: set.distance,
          notes: set.notes,
          order: set.order,
      })) : [],
      // Include other performance metrics
      duration: doc.duration,
      distance: doc.distance,
      pace: doc.pace,
      speed: doc.speed,
      elevationGain: doc.elevationGain,
      calories: doc.calories,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }));

    // 5. Manually serialize the main workout document
    const plainWorkout: any = {
        _id: workout._id.toString(),
        userId: workout.userId.toString(),
        name: workout.name,
        date: workout.date.toISOString(),
        duration: workout.duration,
        intensity: workout.intensity,
        type: workout.type,
        notes: workout.notes,
        completed: workout.completed,
        completedAt: workout.completedAt?.toISOString(),
        source: workout.source,
        sourceId: workout.sourceId,
        importedFrom: workout.importedFrom,
        importId: workout.importId,
        stravaLink: workout.stravaLink,
        // Serialize records if they exist
        records: workout.records ? workout.records.map((record: any) => ({ // Use any for now
            timestamp: record.timestamp.toISOString(),
            heart_rate: record.heart_rate,
            distance: record.distance,
            speed: record.speed,
            altitude: record.altitude,
            latitude: record.latitude,
            longitude: record.longitude,
            cadence: record.cadence,
            power: record.power,
        })) : [],
        createdAt: workout.createdAt.toISOString(),
        updatedAt: workout.updatedAt.toISOString(),
        deletedAt: workout.deletedAt?.toISOString(),
        // Add cardioDetails if needed, ensuring it's serialized
        cardioDetails: workout.cardioDetails ? {
            // Manually serialize fields within cardioDetails
            distance: workout.cardioDetails.distance,
            duration: workout.cardioDetails.duration,
            // ... serialize other cardioDetails fields ...
        } : undefined,
    };

    // 6. Combine and return the fully plain object
    const finalData = {
        ...plainWorkout,
        workoutExercises: plainWorkoutExercises
    };

    console.log("Returning MANUALLY serialized workout data:");
    // console.log(JSON.stringify(finalData, null, 2));
    return finalData;

  } catch (error) {
     console.error(`Error fetching and manually serializing workout ${id}:`, error);
     if (error instanceof Error) {
         throw new Error(`Failed to fetch workout ${id}: ${error.message}`);
     } else {
         throw new Error(`Failed to fetch workout ${id} due to an unknown error.`);
     }
  }
}

// Create a new workout (Refactored for WorkoutExercise schema)
export async function createWorkout(workoutData: Partial<WorkoutData> & { exercises?: Array<{ name: string; notes?: string; sets?: InputSetData[] }> }): Promise<IWorkout> { 
  let savedWorkout: IWorkout | null = null;
  const createdWorkoutExerciseIds: Types.ObjectId[] = [];
  
  try {
    console.log('Starting workout creation (new schema)...');
    const user = await getCurrentUser();
    if (!user || !user.id) {
      throw new Error("User not authenticated or user ID missing");
    }
    const userId = user.id;
    console.log('User authenticated:', userId);

    // --- Connect to DB --- (Do this once)
    console.log('Connecting to database...');
    const dbConnect = (await import("@/lib/db/mongoose")).default;
    await dbConnect();
    console.log('Database connected');

    // --- Create Workout Document --- (No embedded exercises)
    console.log('Formatting workout document data...');
    const workoutType = workoutData.type || "strength"; // Determine type
    const workoutDocData = {
      userId: userId,
      name: workoutData.name || "Workout", // Default name
      date: workoutData.date ? new Date(workoutData.date) : new Date(),
      duration: workoutData.duration || 0, // Overall duration if provided, otherwise default
      type: workoutType,
      notes: workoutData.notes || "",
      source: workoutData.source || "manual", // Assuming manual creation here
      // Add other relevant Workout fields from workoutData if needed
      // intensity: workoutData.intensity,
    };
    console.log('Formatted workout document:', JSON.stringify(workoutDocData, null, 2));

    console.log('Creating workout document in database...');
    const workout = new WorkoutModel(workoutDocData);
    savedWorkout = await workout.save();
    if (!savedWorkout || !savedWorkout._id) {
        console.error("Failed to save workout document or obtain its ID.");
        throw new Error("Workout document creation failed unexpectedly.");
    }
    console.log('Workout document saved successfully:', savedWorkout._id.toString());
    const workoutId = savedWorkout._id;

    // --- Create WorkoutExercise Documents --- 
    console.log('Processing exercises for workout...');
    if (workoutData.exercises && workoutData.exercises.length > 0) {
      let exerciseOrderIndex = 0;
      for (const exerciseInput of workoutData.exercises) { 
        if (!exerciseInput.name) {
            console.warn(`Skipping exercise at index ${exerciseOrderIndex} due to missing name.`);
            exerciseOrderIndex++;
            continue; // Skip this iteration
        }

        // Variable to store the exercise ID we'll use
        let exerciseId: Types.ObjectId | null = null;
        
        // If exerciseId is provided directly, use it
        if ((exerciseInput as any).exerciseId) {
            exerciseId = new Types.ObjectId((exerciseInput as any).exerciseId);
            console.log(`Using provided exercise ID: ${exerciseId}`);
        } 
        // Otherwise, try to find by name
        else {
            console.log(`Finding exercise by name: ${exerciseInput.name}`);
            // 1. Find the canonical Exercise
            const exercise = await ExerciseModel.findOne({ name: exerciseInput.name }).lean() as (IExercise & { _id: Types.ObjectId }) | null;
            
            if (!exercise) {
                // For cardio exercises, we should create a canonical exercise if it doesn't exist
                if (workoutData.type && ['run', 'running', 'swim', 'swimming', 'cycle', 'cycling', 'walk', 'walking', 'hike', 'hiking'].includes(workoutData.type)) {
                    console.log(`Creating new canonical exercise for: ${exerciseInput.name}`);
                    
                    // Create the canonical exercise
                    const newExercise = new ExerciseModel({
                        name: exerciseInput.name,
                        category: 'cardio',
                        // Add other required fields for your exercise model
                    });
                    
                    const savedExercise = await newExercise.save();
                    exerciseId = savedExercise._id;
                    console.log(`Created new canonical cardio exercise with ID: ${exerciseId}`);
                } else {
                    console.warn(`Exercise '${exerciseInput.name}' not found in database and not a cardio type to auto-create. Skipping.`);
                    exerciseOrderIndex++;
                    continue;
                }
            } else {
                exerciseId = exercise._id;
                console.log(`Found exercise ID: ${exerciseId}`);
            }
        }
        
        // Skip if we still don't have an exercise ID
        if (!exerciseId) {
            console.warn(`No exercise ID found or created for '${exerciseInput.name}'. Skipping.`);
            exerciseOrderIndex++;
            continue;
        }

        // 2. Format WorkoutExercise data
        const workoutExerciseData = {
            userId: userId,
            workoutId: workoutId,
            exerciseId: exerciseId,
            order: exerciseOrderIndex, // Use the explicit counter for order
            notes: exerciseInput.notes, 
            sets: exerciseInput.sets?.map((set: InputSetData, setIndex: number) => ({ 
                weight: set.weight,
                reps: set.reps,
                duration: set.duration,
                distance: set.distance,
                notes: set.notes,
                order: setIndex,
            })) || [],
            // Add these fields for cardio workouts
            duration: (exerciseInput as any).duration,
            distance: (exerciseInput as any).distance,
        };
        console.log(`Formatted WorkoutExercise ${exerciseOrderIndex}:`, JSON.stringify(workoutExerciseData, null, 2));

        // 3. Create WorkoutExercise document
        const workoutExercise = new WorkoutExerciseModel(workoutExerciseData);
        const savedWorkoutExercise = await workoutExercise.save();
        createdWorkoutExerciseIds.push(savedWorkoutExercise._id);
        console.log(`Saved WorkoutExercise ${exerciseOrderIndex} with ID: ${savedWorkoutExercise._id}`);
        
        exerciseOrderIndex++; // Increment order for the next exercise
      }
    } else {
        console.log('No exercises provided in input data.');
    }

    // If this is a walking workout with duration but no distance, estimate the distance
    // Average walking pace is ~5 km/h = 1.38 m/s
    const workoutTypeStr = (workoutData.type || '').toLowerCase();
    const workoutNameStr = (workoutData.name || '').toLowerCase();
    
    if ((workoutTypeStr === 'walking' || workoutNameStr.includes('walk')) && 
        workoutData.duration && 
        workoutData.duration > 0 &&
        (!workoutData.distance || workoutData.distance <= 0)) {
      
      const durationSecs = workoutData.duration;
      // Calculate estimated distance: 1.38 m/s * duration in seconds
      const estimatedMeters = Math.round(1.38 * durationSecs);
      
      console.log(`Auto-calculating distance for walking workout: ${durationSecs}s → ${estimatedMeters}m`);
      workoutData.distance = estimatedMeters;
      
      // Also set cardioDetails if it exists
      if (workoutData.cardioDetails) {
        workoutData.cardioDetails.distance = estimatedMeters;
      } else {
        workoutData.cardioDetails = { distance: estimatedMeters };
      }
    }

    // --- Update User's Workout Array --- 
    console.log('Updating user workouts array...');
    const UserModel = (await import("@/lib/db/models/user")).default;
    await UserModel.findByIdAndUpdate(
      userId,
      { $push: { workouts: workoutId } }
    );
    console.log('User workouts array updated');

    // --- Revalidate Paths --- 
    console.log('Revalidating paths...');
    revalidatePath("/calendar");
    revalidatePath("/workout"); 
    revalidatePath("/workouts");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    console.log('Paths revalidated');

    // --- Return --- 
    return savedWorkout!.toObject();

  } catch (error) {
    console.error("Error creating workout (new schema):", error);
    // --- Rollback Logic --- 
    if (createdWorkoutExerciseIds.length > 0) {
        console.warn(`Attempting to cleanup ${createdWorkoutExerciseIds.length} created WorkoutExercise documents due to error.`);
        try {
            await WorkoutExerciseModel.deleteMany({ _id: { $in: createdWorkoutExerciseIds } });
            console.log('Cleaned up WorkoutExercise documents.');
        } catch (cleanupExerciseError) {
            console.error('Failed to cleanup WorkoutExercise documents:', cleanupExerciseError);
        }
    }
    if (savedWorkout !== null && savedWorkout._id) { 
        const workoutIdToDelete = savedWorkout._id; 
        console.warn(`Attempting to cleanup created workout (${workoutIdToDelete}) due to error.`);
        try {
            const workout = await WorkoutModel.findByIdAndDelete(workoutIdToDelete);
            console.log(`Cleaned up workout ${workoutIdToDelete}`);
        } catch (cleanupWorkoutError) {
            console.error(`Failed to cleanup workout ${workoutIdToDelete}:`, cleanupWorkoutError);
        }
    }

    // --- Rethrow Error --- 
    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      throw new Error(`Failed to create workout: ${error.message}`); 
    } else {
        throw new Error("Failed to create workout due to an unknown error.");
    }
  }
}

// Type for the incoming exercise data in update payload
interface IncomingExerciseUpdateData {
    // ID of the *WorkoutExercise* document if updating, undefined/null if new
    _id?: string | null; 
    exerciseId?: string; // ID of the canonical Exercise
    name?: string; // Name of the canonical exercise (used to find exerciseId if not provided)
    order?: number;
    notes?: string;
    sets?: InputSetData[];
    duration?: number;
    distance?: number;
    // Add other performance metrics if they can be updated
}

// Interface for the complete update payload
export interface WorkoutUpdatePayload extends Partial<Omit<IWorkout, "_id" | "userId" | "createdAt" | "updatedAt">> {
    exercises?: IncomingExerciseUpdateData[];
}

// Update an existing workout (Refactored)
export async function updateWorkoutAction(workoutId: string, payload: WorkoutUpdatePayload) {
    console.log(`Starting updateWorkoutAction for workout ID: ${workoutId}`);
  const user = await getCurrentUser();
    if (!user || !user.id) {
    throw new Error("User not authenticated");
  }
    const userId = user.id;

    try {
        console.log("Connecting to DB...");
        const dbConnect = (await import("@/lib/db/mongoose")).default;
        await dbConnect();
        console.log("DB Connected.");

        // 1. Verify Ownership
        console.log(`Verifying ownership for workout ${workoutId}...`);
        const existingWorkout = await WorkoutModel.findById(workoutId);
    if (!existingWorkout) {
        throw new Error("Workout not found.");
    }
        if (existingWorkout.userId.toString() !== userId) {
        throw new Error("Unauthorized access to workout.");
    }
        console.log("Ownership verified.");

        // 2. Separate payload into workout fields and exercises
        const { exercises: incomingExercises, ...workoutUpdateData } = payload;
        
        // Simple walking distance estimation with minimal code changes
        // Convert to any to avoid TypeScript errors with property access
        const updateData = workoutUpdateData as any;
        const workoutType = existingWorkout.type || '';
        const workoutName = existingWorkout.name || '';
        const isWalking = workoutType.toLowerCase() === 'walking' || workoutName.toLowerCase().includes('walk');
        
        // If it's a walking workout with duration but no distance
        if (isWalking && existingWorkout.duration > 0 && !updateData.distance) {
          // Estimate distance based on average walking pace (5 km/h = 1.38 m/s)
          const estimatedMeters = Math.round(1.38 * existingWorkout.duration);
          console.log(`Auto-calculating distance for walking workout: ${existingWorkout.duration}s → ${estimatedMeters}m`);
          updateData.distance = estimatedMeters;
        }
        
        // Add updatedAt timestamp
        (workoutUpdateData as any).updatedAt = new Date();

        // 3. Update the main Workout document fields
        console.log("Updating main workout document:", workoutUpdateData);
        const updatedWorkout = await WorkoutModel.findByIdAndUpdate(workoutId, workoutUpdateData, { new: true });
    if (!updatedWorkout) {
            // Should not happen if findById succeeded, but good practice
            throw new Error("Failed to update main workout document after verification.");
        }
        console.log("Main workout document updated.");

        // 4. Handle Exercise Updates
        if (incomingExercises !== undefined) { 
            console.log("Processing exercise updates...");
            const existingWorkoutExercises = await WorkoutExerciseModel.find({ workoutId: workoutId });
            const existingExerciseMap = new Map(existingWorkoutExercises.map(ex => [ex._id.toString(), ex]));
            const incomingExerciseIds = new Set(incomingExercises.map(ex => ex._id).filter(Boolean));
            const operations = []; 

            // --- Deletions --- 
            const exercisesToDelete = existingWorkoutExercises
                .filter(ex => !incomingExerciseIds.has(ex._id.toString()))
                .map(ex => ex._id);
            
            if (exercisesToDelete.length > 0) {
                console.log(`Deleting ${exercisesToDelete.length} WorkoutExercises:`, exercisesToDelete);
                operations.push({ 
                    deleteMany: {
                        filter: { _id: { $in: exercisesToDelete } } 
                    }
                });
            }

            // --- Updates & Additions --- 
            let index = 0;
            for (const incomingEx of incomingExercises) {
                let exerciseIdToLink: Types.ObjectId | undefined = undefined;
                // Find canonical exercise ID if needed
                if (incomingEx.exerciseId) {
                    exerciseIdToLink = new Types.ObjectId(incomingEx.exerciseId);
                } else if (incomingEx.name) {
                    const canonicalExercise = await ExerciseModel.findOne({ name: incomingEx.name }).select('_id').lean() as { _id: Types.ObjectId } | null;
                    if (canonicalExercise) {
                        exerciseIdToLink = canonicalExercise._id; // Access after type assertion
                    } else {
                        console.warn(`Canonical exercise not found for name: ${incomingEx.name}. Skipping.`);
                        index++; // Increment index before continuing
                        continue; 
                    }
                } else {
                     console.warn(`Incoming exercise at index ${index} lacks both exerciseId and name. Skipping.`);
                     index++; // Increment index before continuing
                     continue; 
                }
                
                const workoutExerciseData = { 
                    userId: userId,
                    workoutId: new Types.ObjectId(workoutId),
                    exerciseId: exerciseIdToLink,
                    order: incomingEx.order ?? index, 
                    notes: incomingEx.notes,
                    sets: incomingEx.sets?.map((set: any, setIndex: number) => ({ // Add any types
                        weight: set.weight,
                        reps: set.reps,
                        duration: set.duration,
                        distance: set.distance,
                        notes: set.notes,
                        order: setIndex, 
                    })) || [],
                    duration: incomingEx.duration,
                    distance: incomingEx.distance,
                };

                if (incomingEx._id) { // Update logic
                    console.log(`Preparing update for WorkoutExercise: ${incomingEx._id}`);
                    if (existingExerciseMap.has(incomingEx._id)) { // Verify it actually existed
                        operations.push({
                            updateOne: {
                                filter: { _id: new Types.ObjectId(incomingEx._id), workoutId: new Types.ObjectId(workoutId) }, // Ensure user ownership via workoutId
                                update: { $set: workoutExerciseData }
                            }
                        });
                    } else {
                        console.warn(`Incoming exercise has ID ${incomingEx._id} but it wasn't found among existing exercises for this workout. Treating as new.`);
                        // Treat as insertion if ID mismatch (could happen with client errors)
                        operations.push({ insertOne: { document: workoutExerciseData } });
                    }
                } else { // Add logic
                    console.log(`Preparing insertion for new WorkoutExercise: ${incomingEx.name || incomingEx.exerciseId}`);
                    operations.push({ insertOne: { document: workoutExerciseData } });
                }
                index++; // Increment index at the end of the loop
            }
            
            // --- Execute Bulk Write --- 
            if (operations.length > 0) {
                console.log(`Executing ${operations.length} bulk write operations for exercises...`);
                const bulkResult = await WorkoutExerciseModel.bulkWrite(operations);
                console.log("Bulk write result:", bulkResult);
            } else {
                console.log("No exercise add/update/delete operations needed.");
            }
        } else {
             console.log("No 'exercises' array provided in payload, skipping exercise updates.");
        }

        // 5. Revalidate Paths
        console.log("Revalidating paths...");
        revalidatePath(`/workout/${workoutId}`); // The specific workout page
        revalidatePath("/activity");
        revalidatePath("/dashboard");
        // Add other relevant paths like /calendar, /workouts list page if they exist

        console.log(`updateWorkoutAction completed for workout ID: ${workoutId}`);
        // Return the updated main workout document (consider if populated data is needed)
        return updatedWorkout.toObject(); // Return plain object

  } catch (error: any) {
        console.error(`Error updating workout action for ${workoutId}:`, error);
    throw new Error(`Failed to update workout: ${error.message}`);
  }
}

// Delete a workout (Refactored)
export async function deleteWorkout(id: string): Promise<void> {
  try {
    const user = await getCurrentUser()
    if (!user || !user.id) {
      throw new Error("User not authenticated or user ID missing")
    }
    const userId = user.id;

    // 1. Check if the workout belongs to the current user
    // Use the Mongoose model directly here
    const existingWorkout = await WorkoutModel.findById(id);
    if (!existingWorkout) {
      console.warn(`Workout ${id} not found for deletion.`);
      // Or throw new Error("Workout not found") if preferred
      return; // Exit if workout doesn't exist
    }
    if (existingWorkout.userId.toString() !== userId) {
      throw new Error("Unauthorized: Workout does not belong to user")
    }

    // 2. Delete associated WorkoutExercise documents
    console.log(`Deleting workout exercises associated with workout ID: ${id}`);
    const deleteExercisesResult = await WorkoutExerciseModel.deleteMany({ workoutId: id });
    console.log(`Deleted ${deleteExercisesResult.deletedCount} workout exercise documents.`);

    // 3. Delete the main Workout document
    // Use the Mongoose model directly
    console.log(`Deleting main workout document with ID: ${id}`);
    const deleteWorkoutResult = await WorkoutModel.findByIdAndDelete(id);
    
    if (!deleteWorkoutResult) {
      // This might happen in a race condition if already deleted
      console.warn(`Workout ${id} was not found during findByIdAndDelete (potentially already deleted).`);
      // Don't throw an error here, as the goal (deletion) is achieved or wasn't needed
    } else {
        console.log(`Successfully deleted main workout document: ${id}`);
    }

    // 4. Remove workout from user's workouts array
    // This step might be optional depending on whether you query this array directly
    // or always fetch workouts via the workouts collection.
    // Keeping it for now for consistency.
    console.log(`Removing workout ${id} from user ${userId}'s list.`);
    const UserModel = (await import("@/lib/db/models/user")).default;
    await UserModel.findByIdAndUpdate(
      userId,
      { $pull: { workouts: id } } // Use the string ID
    );
    console.log(`Removed workout from user list.`);

    // 5. Revalidate paths
    revalidatePath("/calendar")
    revalidatePath("/workouts") // Maybe workouts list page?
    revalidatePath("/dashboard")
    revalidatePath("/activity") // Activity Feed
  } catch (error) {
    console.error(`Error deleting workout ${id}:`, error)
    // Rethrow a more specific error
    if (error instanceof Error) {
        throw new Error(`Failed to delete workout ${id}: ${error.message}`);
    } else {
        throw new Error(`Failed to delete workout ${id} due to an unknown error.`);
    }
  }
}

// Copy a workout to today's date (Refactored)
export async function copyWorkoutToToday(originalWorkoutId: string): Promise<string> {
  console.log(`Starting copyWorkoutToToday for original ID: ${originalWorkoutId}`);
  try {
    const user = await getCurrentUser()
    if (!user || !user.id) { 
      throw new Error("User not authenticated or user ID missing")
    }
    const userId = user.id;

    // 1. Fetch the original workout with exercises (already serialized by fetchWorkout)
    console.log(`Fetching original workout: ${originalWorkoutId}`);
    const originalWorkoutData = await fetchWorkout(originalWorkoutId);
    if (!originalWorkoutData) {
      // fetchWorkout already checks ownership and existence
      throw new Error("Original workout not found or unauthorized");
    }
    console.log("Original workout fetched successfully.");

    // 2. Prepare data for the NEW workout document
    // Exclude fields that should not be copied directly
    const { 
      _id, 
      userId: originalUserId, // Avoid potential confusion
      date: originalDate,
      createdAt: originalCreatedAt,
      updatedAt: originalUpdatedAt,
      completed: originalCompleted,
      completedAt: originalCompletedAt,
      source: originalSource,
      sourceId: originalSourceId,
      stravaLink: originalStravaLink,
      records: originalRecords,
      workoutExercises, // Extract exercises
      ...newWorkoutBaseData // Keep relevant fields like name, type, intensity, notes
    } = originalWorkoutData;

    const newWorkoutPayload: Partial<WorkoutData> & { exercises?: Array<any> } = {
      ...newWorkoutBaseData, // Includes name, type, intensity, notes etc.
      userId: userId, // Assign to the current user
      date: new Date(), // Set date to now
      source: 'manual', // Copied workouts are typically considered manual entries
      // Optionally copy notes, or clear them
      // notes: originalWorkoutData.notes || "Copied workout", 
    };

    // 3. Prepare exercise data for the new workout
    if (workoutExercises && workoutExercises.length > 0) {
      console.log(`Preparing ${workoutExercises.length} exercises for copy...`);
      newWorkoutPayload.exercises = workoutExercises.map((ex: any) => ({
        // We need exerciseId (or name) and performance metrics (sets, duration, etc.)
        // Omit the old _id, workoutId, userId, createdAt, updatedAt
        exerciseId: ex.exerciseId?._id, // Pass the ID of the canonical exercise
        name: ex.exerciseId?.name, // Pass name just in case createWorkout needs it
        order: ex.order,
        notes: ex.notes, // Copy notes specific to the exercise performance
        sets: ex.sets?.map((set: any) => ({ // Copy set details
          weight: set.weight,
          reps: set.reps,
          duration: set.duration,
          distance: set.distance,
          notes: set.notes,
          order: set.order, // Keep set order
        })) || [],
        duration: ex.duration, // Copy cardio/other metrics
        distance: ex.distance,
        // Copy other relevant performance fields
      }));
    } else {
      console.log("Original workout had no exercises to copy.");
      newWorkoutPayload.exercises = [];
    }

    // 4. Call createWorkout with the prepared data
    console.log("Calling createWorkout for the copied workout...");
    const newWorkout = await createWorkout(newWorkoutPayload as any); 
    
    // --- Add Check and Assertion for ID --- 
    if (!newWorkout || !newWorkout._id) {
        console.error("createWorkout failed to return a valid workout object with an ID during copy.");
        throw new Error("Failed to create copied workout.");
    }
    const newWorkoutId = newWorkout._id as Types.ObjectId; // Assert type
    console.log(`Successfully created copied workout with ID: ${newWorkoutId.toString()}`);

    // 5. Revalidate paths (handled by createWorkout)
    // ...

    // 6. Return the new workout ID (as string)
    return newWorkoutId.toString();

  } catch (error) {
    console.error(`Error copying workout ${originalWorkoutId}:`, error);
    if (error instanceof Error) {
        throw new Error(`Failed to copy workout: ${error.message}`);
    } else {
        throw new Error(`Failed to copy workout due to an unknown error.`);
    }
  }
}

// Complete a workout
export async function markWorkoutComplete(id: string, completionData: { duration: number }) {
  const user = await getCurrentUser()
  if (!user || !user.id) { // Refined check
    throw new Error("User not authenticated or user ID missing")
  }
  const userId = user.id;

  try {
    const existingWorkout = await getWorkoutByIdDb(id)
    if (!existingWorkout || existingWorkout.userId !== userId) { // Use userId here
      throw new Error("Workout not found or unauthorized")
    }

    // Prepare update data including updatedAt
    const updatePayload: Partial<WorkoutData> = {
        duration: completionData.duration,
        updatedAt: new Date().toISOString(), 
    };

    const updatedWorkout = await updateWorkoutDb(id, updatePayload);
    if (!updatedWorkout) {
      throw new Error("Failed to mark workout as complete in database.")
    }

    revalidatePath("/dashboard/workouts"); 
    revalidatePath(`/workouts/${id}`);

    return { success: true, workout: updatedWorkout };
  } catch (error: any) {
    console.error("Error marking workout complete:", error)
    return { success: false, error: error.message }
  }
}

// Create a workout from existing data
export async function createWorkoutFromExisting(workoutData: any): Promise<string> {
  try {
    const newWorkout = await createWorkoutDb({
      ...workoutData,
      userId: workoutData.userId,
    })

    revalidatePath("/calendar")

    return newWorkout._id
  } catch (error) {
    console.error("Error creating workout from existing:", error)
    throw new Error("Failed to create workout from existing")
  }
}

// Calculate total weight lifted in a workout
export async function calculateTotalWeightLifted(workout: any): Promise<number> {
  if (!workout?.exercises || !Array.isArray(workout.exercises)) {
    return 0;
  }

  let totalWeight = 0;

  for (const exercise of workout.exercises) {
    if (exercise.sets && Array.isArray(exercise.sets)) {
      for (const set of exercise.sets) {
        if (set.weight && set.reps) {
          totalWeight += set.weight * set.reps;
        }
      }
    }
  }

  return totalWeight;
}

// Create a new cardio workout
export async function createCardioWorkout(workoutData: Partial<WorkoutData>): Promise<IWorkout> {
  let savedWorkout: IWorkout | null = null;
  try {
    console.log('Starting cardio workout creation (new schema)...');
    console.log('Input workout data:', JSON.stringify({
      name: workoutData.name,
      type: workoutData.type,
      date: workoutData.date,
      duration: workoutData.duration,
      distance: workoutData.distance,
      source: workoutData.source,
      sourceId: workoutData.sourceId,
      stravaLink: workoutData.stravaLink
    }, null, 2));

    const user = await getCurrentUser();
    if (!user || !user.id) {
      console.error('No authenticated user found');
      throw new Error("User not authenticated or user ID missing");
    }
    const userId = user.id;
    console.log('User authenticated:', userId);

    // Connect to DB
    console.log('Connecting to database...');
    const dbConnect = (await import("@/lib/db/mongoose")).default;
    await dbConnect();
    console.log('Database connected');

    // Find the corresponding Exercise Document
    const workoutType = workoutData.type || "running";
    const exerciseName = workoutType.charAt(0).toUpperCase() + workoutType.slice(1);
    console.log(`Searching for exercise with name: ${exerciseName}`);
    const exercise = await ExerciseModel.findOne({ name: exerciseName, category: 'cardio' }).lean() as (IExercise & { _id: Types.ObjectId }) | null;
    if (!exercise) {
        console.error(`Exercise '${exerciseName}' with category 'cardio' not found in the database.`);
        throw new Error(`Essential exercise data missing: Could not find '${exerciseName}' (cardio) in exercises collection.`);
    }
    const exerciseId = exercise._id;
    console.log(`Found exercise ID: ${exerciseId} for ${exerciseName}`);

    // Extract Strava link
    let stravaLink = workoutData.stravaLink;
    if (!stravaLink && workoutData.notes) {
      const stravaLinkRegex = /https:\/\/www\.strava\.com\/activities\/(\d+)/;
      const match = workoutData.notes.match(stravaLinkRegex);
      if (match && match[0]) {
        stravaLink = match[0];
        console.log('Extracted Strava link:', stravaLink);
      }
    }

    // Create Workout Document
    console.log('Formatting workout document data...');
    const workoutDocData = {
      userId: userId,
      name: workoutData.name || exerciseName,
      date: workoutData.date ? new Date(workoutData.date) : new Date(),
      duration: workoutData.duration || 0,
      type: workoutType,
      cardioDetails: workoutData.cardioDetails ?? undefined,
      notes: workoutData.notes || "",
      source: workoutData.source || "manual",
      sourceId: workoutData.sourceId,
      importedFrom: workoutData.importedFrom,
      importId: workoutData.importId,
      stravaLink: stravaLink,
      records: workoutData.records ?? [],
    };
    console.log('Formatted workout document:', JSON.stringify(workoutDocData, null, 2));

    console.log('Creating workout document in database...');
    const workout = new WorkoutModel(workoutDocData);
    savedWorkout = await workout.save();
    if (!savedWorkout || !savedWorkout._id) {
        console.error("Failed to save workout document or obtain its ID.");
        throw new Error("Workout document creation failed unexpectedly.");
    }
    console.log('Workout document saved successfully:', savedWorkout._id.toString());
    const workoutId = savedWorkout._id;

    // Create WorkoutExercise Document
    console.log('Formatting workoutExercise document data...');
    const workoutExerciseData = {
        userId: userId,
        workoutId: workoutId,
        exerciseId: exerciseId,
        order: 0,
        duration: workoutData.duration || 0,
        distance: workoutData.distance ?? undefined,
        notes: workoutData.notes || "",
    };
    console.log('Formatted workoutExercise document:', JSON.stringify(workoutExerciseData, null, 2));

    console.log('Creating workoutExercise document in database...');
    const workoutExercise = new WorkoutExerciseModel(workoutExerciseData);
    const savedWorkoutExercise = await workoutExercise.save();
    console.log('WorkoutExercise document saved successfully:', savedWorkoutExercise._id.toString());

    // Update User's Workout Array
    console.log('Updating user workouts array...');
    const UserModel = (await import("@/lib/db/models/user")).default;
    await UserModel.findByIdAndUpdate(
      userId,
      { $push: { workouts: workoutId } }
    );
    console.log('User workouts array updated');

    // Revalidate Paths
    console.log('Revalidating paths...');
    revalidatePath("/calendar");
    revalidatePath("/workout");
    revalidatePath("/workouts");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    console.log('Paths revalidated');

    // Return the main workout document
    // Ensure savedWorkout is not null before accessing .toObject()
    return savedWorkout!.toObject();
  } catch (error) {
    console.error("Error creating cardio workout (new schema):", error);
    // Optional: Rollback
    if (savedWorkout !== null && savedWorkout._id) { 
        // Use the ID directly, relying on the null check. Mongoose should handle the type.
        const workoutIdToDelete = savedWorkout._id; 
        console.warn(`Attempting to clean up created workout (${workoutIdToDelete}) due to error.`);
        try {
            const workout = await WorkoutModel.findByIdAndDelete(workoutIdToDelete);
            console.log(`Cleaned up workout ${workoutIdToDelete}`);
        } catch (cleanupError) {
            console.error(`Failed to cleanup workout ${workoutIdToDelete}:`, cleanupError);
        }
    }

    if (error instanceof Error) {
      console.error("Error details:", error.message);
      console.error("Error stack:", error.stack);
      throw new Error(`Failed to create cardio workout: ${error.message}`); 
    } else {
        throw new Error("Failed to create cardio workout due to an unknown error.");
    }
  }
}

// Process cardio details for better AI analysis
function enhanceCardioWorkout(workout: any): any {
  let enhancedWorkout = { ...workout }
  
  if (["running", "cycling", "swimming"].includes(workout.type)) {
    // Ensure cardioDetails is populated
    if (!enhancedWorkout.cardioDetails && enhancedWorkout.distance) {
      enhancedWorkout.cardioDetails = {
        distance: enhancedWorkout.distance,
        duration: enhancedWorkout.duration,
        pace: enhancedWorkout.distance > 0 ? (enhancedWorkout.duration / enhancedWorkout.distance) : 0
      }
    }
    
    // Calculate additional metrics if missing
    if (enhancedWorkout.cardioDetails) {
      const cardioDetails = enhancedWorkout.cardioDetails;
      // Calculate pace if missing but we have distance and duration
      if (!cardioDetails.pace && cardioDetails.distance && cardioDetails.distance > 0) {
        cardioDetails.pace = cardioDetails.duration ? cardioDetails.duration / cardioDetails.distance : 0;
      }
      
      // Calculate speed in km/h if we have pace
      if (cardioDetails.pace && cardioDetails.pace > 0) {
        cardioDetails.speed = 60 / cardioDetails.pace;
      }
    }
  }
  
  return enhancedWorkout;
}

// Fetch workout data formatted for AI analysis
export async function fetchWorkoutForAI(id: string): Promise<any> {
  try {
    const workout = await getWorkoutByIdDb(id)

    if (!workout) {
      return null
    }

    // Get previous workouts of the same type for comparison
    const previousWorkouts = await getPreviousWorkouts(
      workout.userId, 
      workout.type, // Use workout type instead of name for better matching
      new Date(workout.date), 
      5 // Increase the number of previous workouts for better trend analysis
    )

    // Process cardio details for better AI analysis
    let enhancedWorkout = enhanceCardioWorkout(workout);
    
    // Calculate progression metrics compared to previous workouts
    let progressMetrics = null
    if (previousWorkouts.length > 0) {
      progressMetrics = calculateProgressionMetrics(enhancedWorkout, previousWorkouts)
    }

    return {
      ...enhancedWorkout,
      previousWorkouts: previousWorkouts.length > 0 ? previousWorkouts : undefined,
      progressMetrics
    }
  } catch (error) {
    console.error(`Error fetching workout ${id} for AI:`, error)
    throw new Error(`Failed to fetch workout ${id} for AI`)
  }
}

// Calculate progression metrics compared to previous workouts
function calculateProgressionMetrics(currentWorkout: any, previousWorkouts: any[]): any {
  // Skip if no previous workouts
  if (!previousWorkouts.length) return null
  
  const metrics: any = {}
  
  // Sort previous workouts by date (newest first)
  const sortedWorkouts = [...previousWorkouts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  
  // Calculate average metrics from previous workouts
  const avgDuration = sortedWorkouts.reduce((sum: number, w: any) => sum + w.duration, 0) / sortedWorkouts.length
  
  // Calculate duration trend
  metrics.durationChange = currentWorkout.duration - avgDuration
  metrics.durationChangePercent = avgDuration > 0 ? (metrics.durationChange / avgDuration) * 100 : 0
  
  // Calculate distance trend if available
  if (currentWorkout.distance || currentWorkout.cardioDetails?.distance) {
    const currentDistance = currentWorkout.distance || currentWorkout.cardioDetails?.distance || 0
    const previousDistances = sortedWorkouts
      .map((w: any) => w.distance || w.cardioDetails?.distance || 0)
      .filter((d: number) => d > 0)
    
    if (previousDistances.length > 0) {
      const avgDistance = previousDistances.reduce((sum: number, d: number) => sum + d, 0) / previousDistances.length
      metrics.distanceChange = currentDistance - avgDistance
      metrics.distanceChangePercent = avgDistance > 0 ? (metrics.distanceChange / avgDistance) * 100 : 0
    }
  }
  
  // Calculate pace trend if available for running/cycling/swimming
  if (["running", "cycling", "swimming"].includes(currentWorkout.type)) {
    if (currentWorkout.cardioDetails?.pace) {
      const currentPace = currentWorkout.cardioDetails.pace
      const previousPaces = sortedWorkouts
        .map((w: any) => w.cardioDetails?.pace)
        .filter((p: any) => p !== undefined) as number[]
      
      if (previousPaces.length > 0) {
        const avgPace = previousPaces.reduce((sum: number, p: number) => sum + p, 0) / previousPaces.length
        // Note: For pace, lower is better, so we invert the change
        metrics.paceChange = avgPace - currentPace
        metrics.paceChangePercent = avgPace > 0 ? (metrics.paceChange / avgPace) * 100 : 0
      }
    }
  }
  
  return metrics
}

// Get previous workouts for a specific exercise
export async function getPreviousWorkoutsAction(exerciseName: string): Promise<WorkoutData[]> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error("User not authenticated")
    }
    return await getPreviousWorkouts(user.id, exerciseName, new Date())
  } catch (error) {
    console.error(`Error getting previous workouts for ${exerciseName}:`, error)
    throw new Error(`Failed to get previous workouts for ${exerciseName}`)
  }
}

// Get workout statistics for a specific user
export async function getWorkoutStats(userId: string): Promise<any> {
  try {
    // Fetch all workouts first (using the refactored function)
    const allWorkouts = await fetchWorkouts(); // Already serialized
    // console.log(`Fetched ${allWorkouts.length} workouts for stats.`);

    const stats: any = {
      totalWorkouts: allWorkouts.length,
      totalDuration: 0,
      totalVolume: 0,
      totalDistance: 0,
      workoutsByType: {},
      durationByType: {},
      volumeByType: {},
      distanceByType: {},
      workoutsByMonth: {},
      firstWorkoutDate: null,
      lastWorkoutDate: null,
      mostFrequentType: null,
      averageDuration: 0,
    };

    if (allWorkouts.length === 0) {
      return stats; // Return empty stats if no workouts
    }

    let earliestDate = new Date(allWorkouts[0].date);
    let latestDate = new Date(allWorkouts[0].date);
    const typeCounts: Record<string, number> = {};

    allWorkouts.forEach((workout: any) => {
      const workoutDate = new Date(workout.date);
      const monthYear = format(workoutDate, 'yyyy-MM');
      const type = workout.type || 'other';

      // Track overall stats
      stats.totalDuration += workout.duration || 0;
      if (workout.date) {
          if (workoutDate < earliestDate) earliestDate = workoutDate;
          if (workoutDate > latestDate) latestDate = workoutDate;
      }
      
      // Calculate volume (assuming workoutExercises exists and is structured correctly)
      let currentWorkoutVolume = 0;
      if (type === 'strength' && workout.workoutExercises && workout.workoutExercises.length > 0) {
         currentWorkoutVolume = workout.workoutExercises.reduce((exSum: number, ex: any) => {
            // Need exercise name for bodyweight estimation
            const exerciseName = ex.exerciseId?.name || ''; 
            const exerciseSetVolume = ex.sets?.reduce((setSum: number, set: any) => {
              const weight = set.weight ?? 0;
              const reps = set.reps ?? 0;
              const estimatedWeight = weight > 0 ? weight : estimateBodyweightForExercise(exerciseName);
              return setSum + (estimatedWeight * reps);
            }, 0) || 0;
            return exSum + exerciseSetVolume;
         }, 0);
         stats.totalVolume += currentWorkoutVolume;
      }
      
      // Calculate distance (assuming workoutExercises exists)
      let currentWorkoutDistance = 0;
      if (['running', 'cycling', 'swimming'].includes(type) && workout.workoutExercises && workout.workoutExercises.length > 0) {
        currentWorkoutDistance = workout.workoutExercises.reduce((exSum: any, ex: any) => exSum + (ex.distance || 0), 0);
        stats.totalDistance += currentWorkoutDistance;
      }

      // Track stats by type
      stats.workoutsByType[type] = (stats.workoutsByType[type] || 0) + 1;
      stats.durationByType[type] = (stats.durationByType[type] || 0) + (workout.duration || 0);
      if (type === 'strength') stats.volumeByType[type] = (stats.volumeByType[type] || 0) + currentWorkoutVolume;
      if (['running', 'cycling', 'swimming'].includes(type)) stats.distanceByType[type] = (stats.distanceByType[type] || 0) + currentWorkoutDistance;
      typeCounts[type] = (typeCounts[type] || 0) + 1;

      // Track stats by month
      stats.workoutsByMonth[monthYear] = (stats.workoutsByMonth[monthYear] || 0) + 1;
    });

    stats.firstWorkoutDate = earliestDate.toISOString();
    stats.lastWorkoutDate = latestDate.toISOString();

    // Find most frequent workout type
    let maxCount = 0;
    for (const type in typeCounts) {
      if (typeCounts[type] > maxCount) {
        maxCount = typeCounts[type];
        stats.mostFrequentType = type;
      }
    }

    // Calculate average duration
    if (stats.totalWorkouts > 0) {
      stats.averageDuration = stats.totalDuration / stats.totalWorkouts;
    }

    console.log("Calculated workout stats:", stats);
    return stats;

  } catch (error) {
    console.error(`Error getting workout stats for user ${userId}:`, error);
    // Return a default/empty stats object on error
      return {
        totalWorkouts: 0, totalDuration: 0, totalVolume: 0, totalDistance: 0,
        workoutsByType: {}, durationByType: {}, volumeByType: {}, distanceByType: {},
        workoutsByMonth: {}, firstWorkoutDate: null, lastWorkoutDate: null,
        mostFrequentType: null, averageDuration: 0
    };
  }
}

// This function seems redundant or misnamed based on its content (calculating overall stats)
// Renaming or refactoring might be needed later.
export async function getWorkoutStatsAction() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    console.error("User not authenticated in getWorkoutStatsAction");
    return { error: "User not authenticated" };
  }
  try {
    const stats = await getWorkoutStats(session.user.id);
    return stats;
  } catch (error: any) {
    console.error("Error in getWorkoutStatsAction:", error);
    return { error: error.message || "Failed to fetch workout statistics" };
  }
}

// Get recent workouts of a specific type (Refactored)
export async function getWorkoutsByType(userId: string, type: string, limit = 10): Promise<any[]> {
  console.log(`Fetching workouts for user ${userId}, type ${type}, limit ${limit}`);
  try {
    // Fetch all workouts using the refactored function (includes exercises, serialized)
    const allWorkouts = await fetchWorkouts(); 
    
    // Filter by type
    const filteredWorkouts = allWorkouts.filter(workout => workout.type === type);
    
    // Sort by date (already sorted desc by fetchWorkouts, but re-sort just in case)
    // Slice to limit
    const result = filteredWorkouts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
      
    console.log(`Returning ${result.length} workouts of type ${type}`);
    return result;

  } catch (error) {
    console.error(`Error getting workouts by type ${type}:`, error);
    return [];
  }
}

// Get workouts in a date range (Refactored)
export async function getWorkoutsByDateRange(userId: string, startDate: Date, endDate: Date): Promise<any[]> {
  console.log(`Fetching workouts for user ${userId}, range ${startDate.toISOString()} to ${endDate.toISOString()}`);
  try {
    // Fetch all workouts (includes exercises, serialized)
    const allWorkouts = await fetchWorkouts();
    
    // Filter by date range
    const result = allWorkouts
      .filter(workout => {
        const workoutDate = new Date(workout.date); // Date is already string from serialization
        // Adjust endDate to include the whole day
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        return workoutDate >= startDate && workoutDate <= endOfDay;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort desc

    console.log(`Returning ${result.length} workouts in date range.`);
    return result;

  } catch (error) {
    console.error("Error fetching workouts by date range:", error);
    // Re-throw error as the original function did?
    if (error instanceof Error) {
        throw new Error(`Failed to fetch workouts by date range: ${error.message}`);
    } else {
        throw new Error(`Failed to fetch workouts by date range due to an unknown error.`);
    }
    // Or return [] like other functions?
    // return [];
  }
}

// Get workouts by intensity (Refactored)
export async function getWorkoutsByIntensity(userId: string, intensity: string, limit = 10): Promise<any[]> {
  console.log(`Fetching workouts for user ${userId}, intensity ${intensity}, limit ${limit}`);
  try {
    // Fetch all workouts (includes exercises, serialized)
    const allWorkouts = await fetchWorkouts();
    
    // Filter by intensity
    const filteredWorkouts = allWorkouts.filter(workout => workout.intensity === intensity);
    
    // Sort and limit
    const result = filteredWorkouts
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
      
    console.log(`Returning ${result.length} workouts with intensity ${intensity}`);
    return result;

  } catch (error) {
    console.error(`Error fetching ${intensity} intensity workouts:`, error);
    // Re-throw error like original?
    if (error instanceof Error) {
        throw new Error(`Failed to fetch ${intensity} intensity workouts: ${error.message}`);
    } else {
        throw new Error(`Failed to fetch ${intensity} intensity workouts due to an unknown error.`);
    }
    // Or return []?
    // return [];
  }
}

// Get recent workouts (Refactored)
export async function getRecentWorkouts(userId: string, limit = 10): Promise<any[]> {
  console.log(`Fetching recent workouts for user ${userId}, limit ${limit}`);
  try {
    // Fetch all workouts (includes exercises, serialized, already sorted desc)
    const allWorkouts = await fetchWorkouts();
    
    // Slice to limit
    const result = allWorkouts.slice(0, limit);
    
    console.log(`Returning ${result.length} recent workouts.`);
    return result;

  } catch (error) {
    console.error("Error fetching recent workouts:", error);
     // Re-throw error like original?
    if (error instanceof Error) {
        throw new Error(`Failed to fetch recent workouts: ${error.message}`);
    } else {
        throw new Error(`Failed to fetch recent workouts due to an unknown error.`);
    }
    // Or return []?
    // return [];
  }
}

// Get running workouts (Uses refactored getWorkoutsByType)
// No change needed here as it calls the already refactored function
export async function getRunningWorkouts(userId: string, limit = 10): Promise<any[]> {
  console.log(`Fetching running workouts for user ${userId}, limit ${limit}`);
  try {
    return await getWorkoutsByType(userId, 'running', limit);
  } catch (error) {
    // Error logging and re-throwing can be simplified if getWorkoutsByType handles it
    console.error("Error fetching running workouts:", error);
    throw new Error("Failed to fetch running workouts"); // Keep original throw for now
  }
}

// Get strength workouts (Uses refactored getWorkoutsByType)
// No change needed here
export async function getStrengthWorkouts(userId: string, limit = 10): Promise<any[]> {
  console.log(`Fetching strength workouts for user ${userId}, limit ${limit}`);
  try {
    return await getWorkoutsByType(userId, 'strength', limit);
  } catch (error) {
    console.error("Error fetching strength workouts:", error);
    throw new Error("Failed to fetch strength workouts"); // Keep original throw for now
  }
}

