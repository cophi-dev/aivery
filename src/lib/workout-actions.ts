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
import WorkoutExerciseModel, { IWorkoutExercise } from "@/lib/db/models/workoutExercise"
import ExerciseModel, { IExercise } from "@/lib/db/models/exercise"
import type { WorkoutData } from "@/types/db"
import mongoose, { Types } from 'mongoose'
import WorkoutModel, { type IWorkout, type ICardioDetails } from "@/lib/db/models/workout"
import { format } from 'date-fns'
import { estimateBodyweightForExercise } from "@/lib/utils"
import { Document } from 'mongoose'
import UserModel from '@/lib/db/models/user'
import SetModel from "@/lib/db/models/set";

// Define an interface for the input set structure expected by createWorkout
export interface InputSetData {
    weight?: number;
    reps?: number;
    duration?: number;
    distance?: number;
    notes?: string;
    order?: number;
}

// Type representing a WorkoutExercise populated with its Exercise details
// We might move this to types/db.ts later
interface PopulatedWorkoutExercise extends Omit<IWorkoutExercise, 'exerciseId'> { 
  exerciseId: IExercise & { _id: Types.ObjectId };
}

// Helper function to safely serialize dates
function serializeDate(date: any): string | undefined {
  if (!date) return undefined;
  if (date instanceof Date) return date.toISOString();
  if (typeof date === 'string') return new Date(date).toISOString();
  return undefined;
}

// Helper function to deep serialize objects
function deepSerialize(obj: any, seen = new WeakSet()): any {
  if (!obj) return obj;
  
  // Handle primitives
  if (typeof obj !== 'object') return obj;
  
  // Handle circular references
  if (seen.has(obj)) {
    return null; // Break circular reference
  }
  seen.add(obj);
  
  // Handle dates
  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Handle ObjectId
  if (obj instanceof Types.ObjectId) {
    return obj.toString();
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => deepSerialize(item, seen));
  }

  // Handle Mongoose documents
  if (typeof obj.toObject === 'function') {
    obj = obj.toObject();
  }

  // Handle plain objects
  const result: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      // Skip internal Mongoose properties
      if (key === '__v' || key === '$__' || key === '$init') continue;
      result[key] = deepSerialize(obj[key], seen);
    }
  }
  return result;
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

    // 1. Fetch all workout documents for the user
    const workoutDocs = await WorkoutModel
      .find({ userId: new Types.ObjectId(userId) })
      .lean()
      .sort({ date: -1 }); // Sort by date descending

    if (!workoutDocs || workoutDocs.length === 0) {
      console.log("No workouts found for user.");
      return [];
    }

    // 2. Extract workout IDs for fetching exercises
    const workoutIds = workoutDocs.map(doc => doc._id);

    // 3. Fetch all relevant WorkoutExercise documents, populated
    console.log(`Fetching workout exercises for ${workoutIds.length} workouts...`);
    const workoutExercisesDocs = await WorkoutExerciseModel
      .find({ workoutId: { $in: workoutIds } })
      .populate<{ exerciseId: IExercise & { _id: Types.ObjectId }}>('exerciseId')
      .lean()
      .sort({ workoutId: 1, order: 1 });

    console.log(`Found ${workoutExercisesDocs.length} total workout exercises.`);

    // 4. Group workout exercises by workout ID
    const exercisesByWorkout = workoutExercisesDocs.reduce((acc: any, exercise: any) => {
      const workoutId = exercise.workoutId.toString();
      if (!acc[workoutId]) acc[workoutId] = [];
      acc[workoutId].push(exercise);
      return acc;
    }, {});

    // 5. Combine workouts with their exercises
    const combinedWorkouts = workoutDocs.map((workoutDoc: any) => {
      const workoutId = workoutDoc._id.toString();
      const workoutExercises = exercisesByWorkout[workoutId] || [];

      // Serialize the workout document
      const serializedWorkout = {
        _id: workoutId,
        userId: workoutDoc.userId.toString(),
        name: workoutDoc.name,
        date: serializeDate(workoutDoc.date),
        duration: workoutDoc.duration,
        distance: workoutDoc.distance,
        intensity: workoutDoc.intensity,
        type: workoutDoc.type,
        notes: workoutDoc.notes,
        completed: workoutDoc.completed,
        completedAt: serializeDate(workoutDoc.completedAt),
        source: workoutDoc.source,
        sourceId: workoutDoc.sourceId,
        createdAt: serializeDate(workoutDoc.createdAt),
        updatedAt: serializeDate(workoutDoc.updatedAt),
        calculatedVolume: workoutDoc.calculatedVolume,
        cardioDetails: deepSerialize(workoutDoc.cardioDetails),
        records: deepSerialize(workoutDoc.records || []),
        workoutExercises: workoutExercises.map((exercise: any) => ({
          _id: exercise._id.toString(),
          workoutId: exercise.workoutId.toString(),
          exerciseId: exercise.exerciseId ? {
            _id: exercise.exerciseId._id.toString(),
            name: exercise.exerciseId.name,
            category: exercise.exerciseId.category
          } : null,
          order: exercise.order,
          notes: exercise.notes,
          sets: (exercise.sets || []).map((set: any) => ({
            weight: set.weight,
            reps: set.reps,
            duration: set.duration,
            distance: set.distance,
            notes: set.notes,
            order: set.order
          })),
          duration: exercise.duration,
          distance: exercise.distance
        }))
      };

      return serializedWorkout;
    });

    console.log(`>>> FETCHWORKOUTS: Returning ${combinedWorkouts.length} workouts. First few:`, JSON.stringify(combinedWorkouts.slice(0, 3), null, 2)); // Log first few fetched workouts
    return combinedWorkouts;
  } catch (error) {
    console.error("Error fetching workouts:", error);
    return [];
  }
}

// Interface for the lean workout summary object
interface WorkoutSummary {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name?: string;
  type?: string;
  date?: Date | string;
}

// NEW: Fetch a workout summary (name, type, date) for the current user
export async function fetchWorkoutSummary(id: string): Promise<{ _id: string; name: string | null; type: string | null; date: string | null } | null> {
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      console.warn("User not authenticated in fetchWorkoutSummary");
      return null;
    }
    const userId = user.id;

    if (!Types.ObjectId.isValid(id)) {
       console.warn("Invalid workout ID format provided:", id);
       return null;
    }

    console.log(`Fetching workout summary for ID: ${id} for user: ${userId}`);

    const workout = await WorkoutModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .select('_id name type date') // <-- Add _id to select
      .lean<WorkoutSummary>(); // Use lean and cast to specific interface

    if (!workout) {
      console.log(`Workout summary not found or user ${userId} does not own workout ${id}.`);
      return null;
    }

    // Return the selected fields (date is already serializable)
    return {
      _id: workout._id.toString(), // <-- Add _id to return object
      name: workout.name ?? null, // Use nullish coalescing
      type: workout.type ?? null,
      date: workout.date ? format(new Date(workout.date), 'yyyy-MM-dd') : null // Use ISO 8601 date format
    };

  } catch (error) {
    console.error(`Error fetching workout summary for ID ${id}:`, error);
    return null; // Return null on error
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

    // 1. Fetch the main workout document, explicitly selecting distance
    const workout = await WorkoutModel.findById(id).select('+distance');

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

    // 3. Fetch associated WorkoutExercise documents, populate exerciseId AND sets
    console.log(`Fetching workout exercises for workout ID: ${id}`);
    const workoutExercisesDocs = await WorkoutExerciseModel
      .find({ workoutId: workout._id })
      .populate<{ exerciseId: IExercise & { _id: Types.ObjectId }}>('exerciseId') // Populate exercise details
      .sort({ order: 1 });
      
    console.log(`Found ${workoutExercisesDocs.length} workout exercises. Populated sets? ${workoutExercisesDocs.length > 0 ? !!workoutExercisesDocs[0].sets : 'N/A'}`);

    // Define the expected populated type
    type PopulatedWorkoutExerciseDoc = IWorkoutExercise & {
      _id: Types.ObjectId; // Ensure _id is ObjectId
      exerciseId?: (IExercise & { _id: Types.ObjectId }) | null; // Populated field type
    };

    // 4. Manually serialize workoutExercisesDocs (ensure sets are serialized correctly after population)
    const plainWorkoutExercises = workoutExercisesDocs.map(doc => {
      // Use optional chaining and provide defaults or null
      const docId = doc?._id?.toString();
      const workoutId = doc?.workoutId?.toString();
      const exerciseIdObj = doc?.exerciseId as any; // Cast to any to access properties
      const populatedSets = doc?.sets as any[]; // <-- Access populated sets

      if (!docId || !workoutId) {
        console.error(`WorkoutExercise is missing essential IDs (_id or workoutId)! Skipping serialization for doc:`, doc);
        return null; // Skip if essential IDs are missing
      }

      let exerciseDetails = null;
      if (exerciseIdObj?._id) { // Check populated field safely
         exerciseDetails = {
          _id: exerciseIdObj._id.toString(),
          name: exerciseIdObj.name ?? 'Unknown Exercise', // Default if name missing
          category: exerciseIdObj.category ?? 'Unknown',
         };
      } else {
          console.warn(`WorkoutExercise ${docId} is missing populated exerciseId details.`);
      }

      return {
        _id: docId,
        workoutId: workoutId,
        order: doc?.order,
        notes: doc?.notes,
        exerciseId: exerciseDetails,
        sets: populatedSets ? populatedSets.map(set => ({
            _id: set?._id?.toString(), // Include set ID if needed
            weight: set?.weight,
            reps: set?.reps,
            duration: set?.duration,
            distance: set?.distance,
            notes: set?.notes,
            order: set?.order,
        })) : [],
        duration: doc?.duration,
        distance: doc?.distance,
        pace: doc?.pace,
        speed: doc?.speed,
        elevationGain: doc?.elevationGain,
        calories: doc?.calories,
        // Use optional chaining for dates too, provide fallback
        createdAt: doc?.createdAt instanceof Date ? doc.createdAt.toISOString() : undefined,
        updatedAt: doc?.updatedAt instanceof Date ? doc.updatedAt.toISOString() : undefined,
      };
    }).filter(Boolean); // Filter out any null values from skipped records

    // 5. Manually serialize the main workout document
    const plainWorkout: any = {
        _id: workout._id.toString(),
        userId: workout.userId.toString(),
        name: workout.name,
        date: workout.date.toISOString(),
        duration: workout.duration,
        distance: workout.distance,
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
        // Use deepSerialize for cardioDetails
        cardioDetails: workout.cardioDetails ? deepSerialize(workout.cardioDetails) : undefined,
    };

    // 6. Combine and return the fully plain object
    const finalData = {
        ...plainWorkout,
        workoutExercises: plainWorkoutExercises
    };

    // 7. Calculate and add total volume using the dedicated helper function
    if (finalData.type === 'strength') {
        // Pass the partially built finalData which should include userId and workoutExercises
        finalData.calculatedVolume = await calculateTotalWeightLifted(finalData);
        console.log(`[Fetch Workout] Volume calculated via helper: ${finalData.calculatedVolume}kg`);
    } else {
        finalData.calculatedVolume = 0; // Ensure it's 0 for non-strength workouts
    }

    console.log("--- [FETCH WORKOUT DEBUG] Final Data Before Return ---");
    console.log(`Workout ID: ${finalData._id}`);
    console.log(`Workout Distance (Raw): ${finalData.distance}`); 
    console.log(`Workout Exercises Count: ${finalData.workoutExercises?.length ?? 0}`); 
    if(finalData.workoutExercises && finalData.workoutExercises.length > 0) {
      console.log("First Workout Exercise Details:", JSON.stringify(finalData.workoutExercises[0], null, 2)); 
    }
    console.log("--- [FETCH WORKOUT DEBUG] End --- ");

    console.log("Returning MANUALLY serialized workout data:");
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
export async function createWorkout(workoutData: Partial<WorkoutData> & { 
  exercises?: Array<{ 
    name: string; 
    notes?: string; 
    sets?: InputSetData[]; 
    duration?: number;
    distance?: number;
  }> 
}): Promise<IWorkout> { 
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

    // --- Connect to DB --- 
    console.log('Connecting to database...');
    const dbConnect = (await import("@/lib/db/mongoose")).default;
    await dbConnect();
    console.log('Database connected');

    // --- Create Workout Document --- 
    console.log('Formatting workout document data...');
    const workoutType = workoutData.type || "strength"; 
    const isValidWorkoutType = ["strength", "running", "swimming", "cycling", "hiit", "flexibility", "walking", "yoga", "pilates", "other"].includes(workoutType);
    const isValidSource = ["manual", "garmin", "coros", "strava", "apple", "ai"].includes(workoutData.source || '');
    const isValidIntensity = ["Low", "Medium", "High"].includes(workoutData.intensity || '');

    const workoutDocData: Partial<IWorkout> = {
      userId: userId,
      name: workoutData.name || "Workout", 
      date: workoutData.date ? new Date(workoutData.date) : new Date(),
      type: isValidWorkoutType ? workoutType as IWorkout['type'] : 'other',
      notes: workoutData.notes || "",
      source: isValidSource ? workoutData.source as IWorkout['source'] : 'manual',
      intensity: isValidIntensity ? workoutData.intensity as IWorkout['intensity'] : undefined,
      cardioDetails: undefined, // Initialize cardioDetails
      calculatedVolume: 0 // Initialize calculatedVolume explicitly
    };

    // Calculate total duration from exercises if available
    let totalDuration = 0;
    if (workoutData.exercises && Array.isArray(workoutData.exercises)) {
      workoutData.exercises.forEach(exercise => {
        // Add exercise duration if it exists
        if (exercise.duration) {
          totalDuration += exercise.duration;
        }
        // Add durations from sets if they exist
        if (exercise.sets && Array.isArray(exercise.sets)) {
          exercise.sets.forEach(set => {
            if (set.duration) {
              totalDuration += set.duration;
            }
          });
        }
      });
    }
    // Use provided duration as fallback if no exercises or if it's larger
    workoutDocData.duration = Math.max(totalDuration, workoutData.duration || 0);
    
    // Build cardioDetails only if relevant and data exists
    if (['run', 'cycle', 'swim', 'walk', 'hike', 'row'].includes(workoutType) && (workoutData.distance !== undefined || workoutData.duration !== undefined)) {
        const details: Partial<ICardioDetails> = {};
        if (workoutData.distance !== undefined) {
            details.distance = workoutData.distance;
        }
        if (workoutData.duration !== undefined) {
            details.duration = workoutData.duration;
        }
        // Add other cardio fields from workoutData.cardioDetails if they exist
        if (workoutData.cardioDetails) {
            if (workoutData.cardioDetails.pace !== undefined) details.pace = workoutData.cardioDetails.pace;
            if (workoutData.cardioDetails.elevationGain !== undefined) details.elevationGain = workoutData.cardioDetails.elevationGain;
            // Add more fields as needed, ensuring type compatibility
        }
        // Only assign if we actually added details
        if (Object.keys(details).length > 0) {
             // Type assertion needed as we build Partial<ICardioDetails>
             workoutDocData.cardioDetails = details as ICardioDetails; 
        }
    }

    // Calculate total volume for strength workouts
    let totalVolume = 0;
    if (workoutType === 'strength' && workoutData.exercises && Array.isArray(workoutData.exercises)) {
        workoutData.exercises.forEach(exercise => {
            if (exercise.sets && Array.isArray(exercise.sets)) {
                exercise.sets.forEach(set => {
                    const weight = typeof set.weight === 'number' ? set.weight : 0;
                    const reps = typeof set.reps === 'number' ? set.reps : 0;
                    // Use simple weight * reps for consistency
                    totalVolume += weight * reps;
                });
            }
        });
        workoutDocData.calculatedVolume = totalVolume;
        console.log(`Calculated total volume for new strength workout: ${totalVolume}kg`);
    } else {
        // Ensure volume is 0 for non-strength workouts or those without exercises
        workoutDocData.calculatedVolume = 0;
    }

    // Filter out undefined fields before saving (optional, Mongoose handles undefined)
    // Object.keys(workoutDocData).forEach(key => workoutDocData[key as keyof typeof workoutDocData] === undefined && delete workoutDocData[key as keyof typeof workoutDocData]);
    
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

    // --- Create WorkoutExercise Documents and related Set Documents --- 
    console.log('Processing exercises for workout...');
    if (workoutData.exercises && workoutData.exercises.length > 0) {
      let exerciseOrderIndex = 0;
      for (const exerciseInput of workoutData.exercises) { 
        if (!exerciseInput.name) {
            console.warn(`Skipping exercise at index ${exerciseOrderIndex} due to missing name.`);
            exerciseOrderIndex++;
            continue; 
        }

        // --- Find or Create Canonical Exercise --- (Keep existing logic)
        let exerciseId: Types.ObjectId | null = null;
        if ((exerciseInput as any).exerciseId) {
            exerciseId = new Types.ObjectId((exerciseInput as any).exerciseId);
            console.log(`Using provided exercise ID: ${exerciseId}`);
        } else {
            console.log(`Finding exercise by name: ${exerciseInput.name}`);
            const exercise = await ExerciseModel.findOne({ name: exerciseInput.name }).lean() as (IExercise & { _id: Types.ObjectId }) | null;
            if (!exercise) {
                 // Keep existing logic for handling missing/cardio exercises
                 console.warn(`Exercise '${exerciseInput.name}' not found or handled. Skipping.`);
                 exerciseOrderIndex++;
                 continue;
            } else {
                exerciseId = exercise._id;
                console.log(`Found exercise ID: ${exerciseId}`);
            }
        }
        if (!exerciseId) {
            console.warn(`No exercise ID found or created for '${exerciseInput.name}'. Skipping.`);
            exerciseOrderIndex++;
            continue;
        }

        // --- Prepare sets data for embedding --- 
        let setsToEmbed: any[] = []; // Define as any[] for simplicity, could use a Mongoose subdocument type
        if (exerciseInput.sets && exerciseInput.sets.length > 0) {
           setsToEmbed = exerciseInput.sets.map((set: InputSetData, setIndex: number) => {
              const setData = {
                // workoutExerciseId: savedWorkoutExercise._id, // No longer needed for embedding
                order: set.order ?? setIndex, 
                weight: set.weight,
                reps: set.reps,
                duration: set.duration,
                distance: set.distance,
                notes: set.notes,
              };
              // Filter out undefined fields
              Object.keys(setData).forEach(key => setData[key as keyof typeof setData] === undefined && delete setData[key as keyof typeof setData]);
              return setData;
           });
           console.log(`Prepared ${setsToEmbed.length} sets for embedding in WorkoutExercise ${exerciseOrderIndex}`);
        }

        // --- Create WorkoutExercise (WITH embedded sets) --- 
        const workoutExerciseData = {
            userId: userId,
            workoutId: workoutId,
            exerciseId: exerciseId,
            order: exerciseOrderIndex, 
            notes: exerciseInput.notes, 
            sets: setsToEmbed, // <-- Embed the sets array directly
            // Keep duration/distance if relevant for non-set based exercises
            duration: (exerciseInput as any).duration, 
            distance: (exerciseInput as any).distance,
        };
        console.log(`Formatted WorkoutExercise ${exerciseOrderIndex} with embedded sets:`, JSON.stringify(workoutExerciseData, null, 2));
        const workoutExercise = new WorkoutExerciseModel(workoutExerciseData);
        const savedWorkoutExercise = await workoutExercise.save();
        createdWorkoutExerciseIds.push(savedWorkoutExercise._id);
        console.log(`Saved WorkoutExercise ${exerciseOrderIndex} with ID: ${savedWorkoutExercise._id}`);

        exerciseOrderIndex++; // Increment order for the next exercise
      }
    } else {
        console.log('No exercises provided in input data.');
    }

    // --- Keep existing logic for walking distance calculation, user update, revalidation --- 
    console.log('Updating user workouts array...');
    // @ts-ignore - Linter incorrectly infers workoutId as {} here, despite checks.
    await updateUserWorkouts(userId, workoutId);
    console.log('Revalidating paths...');
    revalidatePath("/calendar"); 
    revalidatePath("/workouts"); 
    revalidatePath("/dashboard");
    // ... other paths
    console.log('Paths revalidated');

    return savedWorkout!.toObject();

  } catch (error) {
    console.error("Error creating workout (new schema):", error);
    // --- Keep existing Rollback Logic --- 
    if (createdWorkoutExerciseIds.length > 0) {
        console.warn(`Attempting to cleanup ${createdWorkoutExerciseIds.length} created WorkoutExercise documents due to error.`);
        // Include cleanup for created Sets as well if possible/necessary
        try {
            // Delete the WorkoutExercises themselves
            await WorkoutExerciseModel.deleteMany({ _id: { $in: createdWorkoutExerciseIds as any[] } }); 
            console.log('Cleaned up WorkoutExercise documents (including embedded sets).');
        } catch (cleanupExerciseError) {
            console.error('Failed to cleanup WorkoutExercise/Set documents:', cleanupExerciseError);
        }
    }
    // Check explicitly if savedWorkout and its _id (as ObjectId) exist before trying to delete
    if (savedWorkout && savedWorkout._id && savedWorkout._id instanceof Types.ObjectId) { 
        const workoutIdToDelete = savedWorkout._id; 
        console.warn(`Attempting to cleanup created workout (${workoutIdToDelete}) due to error.`);
        try {
            // Explicitly cast to Types.ObjectId as a last resort for linter
            await WorkoutModel.findByIdAndDelete(workoutIdToDelete as Types.ObjectId);
            console.log(`Cleaned up workout ${workoutIdToDelete}`);
        } catch (cleanupWorkoutError) {
            console.error(`Failed to cleanup workout ${workoutIdToDelete}:`, cleanupWorkoutError);
        }
    }
    // Re-throw the original error after attempting cleanup
    throw error;
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
        const { exercises: incomingExercises, ...workoutUpdateDataInput } = payload;
        
        // Create a type-safe object for the update
        const workoutUpdateData: Partial<IWorkout> = { ...workoutUpdateDataInput };

        // Recalculate total volume if type is strength and exercises are provided
        let updatedVolume: number | undefined = undefined;
        if (workoutUpdateData.type === 'strength' && incomingExercises !== undefined) {
            updatedVolume = 0; // Start calculation only if relevant
            // Use incomingExercises if available, otherwise fetch existing to recalculate
            const exercisesToCalculate = incomingExercises || []; 
            // Note: If incomingExercises is undefined but type *is* strength, we might 
            // want to fetch existing exercises to ensure volume is recalculated correctly.
            // For now, we only recalculate if exercises are part of the update.
            
            exercisesToCalculate.forEach(exercise => {
                if (exercise.sets && Array.isArray(exercise.sets)) {
                    exercise.sets.forEach(set => {
                        const weight = typeof set.weight === 'number' ? set.weight : 0;
                        const reps = typeof set.reps === 'number' ? set.reps : 0;
                        updatedVolume! += weight * reps;
                    });
                }
            });
            workoutUpdateData.calculatedVolume = updatedVolume;
            console.log(`Recalculated volume for updated strength workout: ${updatedVolume}kg`);
        } else if (workoutUpdateData.type && workoutUpdateData.type !== 'strength') {
            // Explicitly set volume to 0 if type is changed to non-strength
            workoutUpdateData.calculatedVolume = 0;
            console.log(`Workout type changed to non-strength, setting calculatedVolume to 0.`);
        } else if (workoutUpdateData.type === 'strength' && incomingExercises === undefined) {
            // If type is strength but exercises aren't in payload, recalculate from existing
            // This handles cases where only workout metadata (like name/date) is changed
            console.log("Recalculating volume from existing exercises as type is strength and no exercises provided in update...");
            const existingWorkoutExercises = await WorkoutExerciseModel.find({ workoutId: workoutId }).lean();
            updatedVolume = 0;
            existingWorkoutExercises.forEach(exercise => {
                 if (exercise.sets && Array.isArray(exercise.sets)) {
                    exercise.sets.forEach(set => {
                        const weight = typeof set.weight === 'number' ? set.weight : 0;
                        const reps = typeof set.reps === 'number' ? set.reps : 0;
                        updatedVolume! += weight * reps;
                    });
                }
            });
            workoutUpdateData.calculatedVolume = updatedVolume;
            console.log(`Recalculated volume from existing exercises: ${updatedVolume}kg`);
        }

        // Calculate total duration from exercises if available
        let totalDuration = 0;
        if (incomingExercises && Array.isArray(incomingExercises)) {
          incomingExercises.forEach(exercise => {
            // Add exercise duration if it exists
            if (exercise.duration) {
              totalDuration += exercise.duration;
            }
            // Add durations from sets if they exist
            if (exercise.sets && Array.isArray(exercise.sets)) {
              exercise.sets.forEach(set => {
                if (set.duration) {
                  totalDuration += set.duration;
                }
              });
            }
          });
        }
        // Use provided duration as fallback if no exercises or if it's larger
        workoutUpdateData.duration = Math.max(totalDuration, payload.duration || 0);

        // Update the workout document using the type-safe object
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
                console.log(`Deleting ${exercisesToDelete.length} WorkoutExercises (including embedded Sets):`, exercisesToDelete);
                
                // --- REMOVED: Delete associated Sets FIRST (they are embedded) ---
                // await SetModel.deleteMany({ workoutExerciseId: { $in: exercisesToDelete as any[] } });
                // console.log(`Deleted Sets associated with ${exercisesToDelete.length} WorkoutExercises.`);
                // --- END REMOVED ---
                
                // Now prepare deletion for WorkoutExercises themselves
                operations.push({ 
                    deleteMany: {
                        filter: { _id: { $in: exercisesToDelete } } 
                    }
                });
            }

            // --- Updates & Additions (WorkoutExercise only) --- 
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
                
                // --- Prepare sets data for embedding --- 
                let setsToEmbed: any[] = []; 
                if (incomingEx.sets && incomingEx.sets.length > 0) {
                   setsToEmbed = incomingEx.sets.map((set: InputSetData, setIndex: number) => {
                      const setData = {
                        order: set.order ?? setIndex, 
                        weight: set.weight,
                        reps: set.reps,
                        duration: set.duration,
                        distance: set.distance,
                        notes: set.notes,
                      };
                      Object.keys(setData).forEach(key => setData[key as keyof typeof setData] === undefined && delete setData[key as keyof typeof setData]);
                      return setData;
                   });
                }
                
                // Prepare data for WorkoutExercise document (WITH sets)
                const workoutExerciseData = { 
                    userId: userId,
                    workoutId: new Types.ObjectId(workoutId),
                    exerciseId: exerciseIdToLink,
                    order: incomingEx.order ?? index, 
                    notes: incomingEx.notes,
                    duration: incomingEx.duration, // Keep other relevant fields
                    distance: incomingEx.distance,
                    sets: setsToEmbed // <-- Embed sets here
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
            
            // --- Execute Bulk Write for WorkoutExercises --- 
            if (operations.length > 0) {
                console.log(`Executing ${operations.length} bulk write operations for exercises...`);
                const bulkResult = await WorkoutExerciseModel.bulkWrite(operations);
                console.log("WorkoutExercise bulk write result:", bulkResult);
            } else {
                console.log("No WorkoutExercise add/update/delete operations needed.");
            }
            
            // --- REMOVED: Handle Set updates/creations separately --- 
            // console.log("Processing Set updates/creations...");
            // ... entire loop from lines 798-831 removed ...
            // console.log("Set updates/creations finished.");
            // --- END REMOVED ---
            
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
// Modified to include estimated bodyweight for weight=0 sets
export async function calculateTotalWeightLifted(workout: any): Promise<number> {
  // Ensure we have workoutExercises and a userId to fetch user weight
  // Check for workoutExercises property instead of exercises
  if (!workout?.workoutExercises || !Array.isArray(workout.workoutExercises) || !workout.userId) {
    console.warn("[Volume Calc] Missing workoutExercises or userId, returning 0 volume.", { hasWorkoutExercises: !!workout?.workoutExercises, hasUserId: !!workout.userId });
    return 0;
  }

  let totalWeight = 0;
  let userWeight: number | null = null; // Initialize as null

  // Fetch user weight once
  try {
    // Assuming workout.userId is available and is a valid ID (string or ObjectId)
    const userId = workout.userId.toString(); 
    // Use findOne and explicitly cast to a type that includes weight or check property existence
    const user = await UserModel.findOne({ _id: new Types.ObjectId(userId) }).select('weight').lean<{ weight?: number } | null>();
    // Check if user exists and has a weight property before assigning
    if (user && typeof user.weight === 'number' && user.weight > 0) {
      userWeight = user.weight;
    }
    // console.log(`[Volume Calc] Using user weight for volume calc: ${userWeight} kg`);
  } catch (error) {
    console.error("[Volume Calc] Error fetching user weight:", error);
    // Proceed without user weight if fetching fails, userWeight remains null
  }

  // Loop through workout.workoutExercises instead of workout.exercises
  for (const exercise of workout.workoutExercises) {
    // Ensure exercise name is available for the estimation function
    // Adjust access based on the structure within workoutExercises
    const exerciseName = exercise?.exerciseId?.name || exercise.name; // Check both potential structures
    if (!exerciseName) {
        console.warn("[Volume Calc] Skipping exercise due to missing name:", exercise);
        continue;
    }
    
    if (exercise.sets && Array.isArray(exercise.sets)) {
      for (const set of exercise.sets) {
        // Ensure reps are valid
        const reps = typeof set.reps === 'number' && set.reps > 0 ? set.reps : 0;
        if (reps === 0) continue; // Skip sets with no reps
        
        let weightForSet = typeof set.weight === 'number' ? set.weight : 0;

        // If weight is 0, attempt to estimate based on bodyweight
        if (weightForSet <= 0) {
          // Pass the fetched (or null) userWeight to the estimation function
          const estimatedWeight = estimateBodyweightForExercise(exerciseName, userWeight);
          if (estimatedWeight > 0) {
            // console.log(`[Volume Calc] Using estimated weight ${estimatedWeight}kg for ${reps} reps of ${exerciseName} (User Weight: ${userWeight || 'N/A'})`);
            weightForSet = estimatedWeight;
          } else {
            // console.log(`[Volume Calc] Weight is 0 and no estimate found for ${exerciseName}. Volume contribution is 0.`);
            weightForSet = 0; // Ensure it remains 0 if no estimate found
          }
        }

        // Add to total volume
        totalWeight += weightForSet * reps;
      }
    }
  }
  // console.log(`[Volume Calc] Final calculated volume for workout: ${totalWeight} kg`);
  return totalWeight;
}

// Create a new cardio workout
export async function createCardioWorkout(data: any): Promise<WorkoutDocument> {
  try {
    // Find the associated exercise or create it if needed
    const exerciseType = data.type?.toLowerCase() || 'other';
    let exercise = await ExerciseModel.findOne({
      category: 'cardio',
      name: { $regex: new RegExp(`^${exerciseType}$`, 'i') },
    });

    if (!exercise) {
      console.log(`Creating new cardio exercise for type: ${exerciseType}`);
      exercise = await ExerciseModel.create({
        name: exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1),
        category: 'cardio',
        muscleGroups: [],
        equipment: [],
        instructions: '',
        isSystemExercise: true,
        isDefault: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Generate a descriptive name that includes distance if available
    let workoutName = data.title || `${exerciseType.charAt(0).toUpperCase() + exerciseType.slice(1)}`;
    if (data.distance && data.distance > 0) {
      // Format distance with appropriate precision
      const distanceStr = data.distance < 1 ? 
        `${(data.distance * 1000).toFixed(0)}m` : 
        `${data.distance.toFixed(2)}km`;
      
      // Add distance to name if not already there
      if (!workoutName.includes(distanceStr) && !workoutName.match(/\d+(\.\d+)?\s*(km|m|miles)/i)) {
        workoutName = `${workoutName} (${distanceStr})`;
      }
    }

    // Always log what's being saved to help with debugging
    console.log(`Creating cardio workout with: name=${workoutName}, type=${exerciseType}, duration=${data.duration} minutes, distance=${data.distance || 0}km`);

    // Create cardio workout document with detailed information
    const workout = await WorkoutModel.create({
      name: workoutName,
      date: data.date || new Date(),
      type: exerciseType,  // Use the specific exercise type (running, cycling, etc.) instead of 'cardio'
      userId: data.userId,
      // Don't multiply by 60 if source is strava since it's already in seconds
      duration: data.source === 'strava' ? data.duration : (data.duration || 0) * 60,
      distance: data.distance || 0, // Distance in km
      calories: data.calories || 0,
      intensity: data.intensity || 'Medium',
      notes: data.description || '',
      source: data.source || 'manual',
      sourceId: data.sourceId,
      sourceData: data.sourceData,
      stravaLink: data.stravaLink,
      cardioDetails: {
        distance: data.distance || 0, // Ensure distance is also in cardioDetails (km)
        // Don't multiply by 60 if source is strava since it's already in seconds
        duration: data.source === 'strava' ? data.duration : (data.duration || 0) * 60,
        pace: data.distance && data.duration ? data.duration / data.distance : 0, // pace (min/km) calculation uses input minutes
        speed: data.distance && data.duration ? data.distance / (data.duration / 60) : 0, // speed (km/h) calculation uses input minutes
        elevationGain: data.totalElevationGain || 0,
        heartRate: (data.averageHeartRate || data.maxHeartRate) ? {
          average: data.averageHeartRate || 0,
          max: data.maxHeartRate || 0,
        } : undefined,
        sportDetails: {
          sport: exerciseType,
          subSport: data.sportType || undefined,
        },
        maxSpeed: data.maxSpeed || 0,
      },
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    // Create workout exercise entry to link the workout to the exercise
    await WorkoutExerciseModel.create({
      workoutId: workout._id,
      exerciseId: exercise._id,
      userId: data.userId,
      // Don't multiply by 60 if source is strava since it's already in seconds
      duration: data.source === 'strava' ? data.duration : (data.duration || 0) * 60,
      distance: data.distance || 0, // Distance in km
      order: 1,
      sets: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update user's workouts array
    await updateUserWorkouts(data.userId, workout._id);

    return workout;
  } catch (error) {
    console.error('Error creating cardio workout:', error);
    throw error;
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

      // Get duration from multiple possible sources to ensure we always have a value
      const duration = Number(workout.duration) || 
                       (workout.cardioDetails?.duration ? Number(workout.cardioDetails.duration) : 0);
                       
      // Track overall stats
      stats.totalDuration += duration;
      
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
      
      // Calculate distance from multiple possible sources
      let currentWorkoutDistance = 0;
      
      // First check direct distance property
      if (typeof workout.distance === 'number' && workout.distance > 0) {
        currentWorkoutDistance = workout.distance;
      } 
      // Then check cardioDetails.distance
      else if (workout.cardioDetails && typeof workout.cardioDetails.distance === 'number' && workout.cardioDetails.distance > 0) {
        currentWorkoutDistance = workout.cardioDetails.distance;
      }
      // Finally check workoutExercises
      else if (['running', 'cycling', 'swimming', 'walking', 'hiking'].includes(type) && 
                workout.workoutExercises && workout.workoutExercises.length > 0) {
        currentWorkoutDistance = workout.workoutExercises.reduce((exSum: any, ex: any) => 
          exSum + (typeof ex.distance === 'number' ? ex.distance : 0), 0);
      }
      
      // Add the distance to the total
      if (currentWorkoutDistance > 0) {
        stats.totalDistance += currentWorkoutDistance;
        
        // Track distance by type
        if (!stats.distanceByType[type]) stats.distanceByType[type] = 0;
        stats.distanceByType[type] += currentWorkoutDistance;
      }

      // Track stats by type
      stats.workoutsByType[type] = (stats.workoutsByType[type] || 0) + 1;
      stats.durationByType[type] = (stats.durationByType[type] || 0) + duration;
      if (type === 'strength') stats.volumeByType[type] = (stats.volumeByType[type] || 0) + currentWorkoutVolume;
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

// Type for workout document with MongoDB _id
type WorkoutDocument = IWorkout & Document & { _id: Types.ObjectId };

// Function to update a user's workouts array
async function updateUserWorkouts(userId: string, workoutId: Types.ObjectId): Promise<void> {
  try {
    // Update User's Workout Array
    console.log('Updating user workouts array...');
    await UserModel.findByIdAndUpdate(
      userId,
      { $push: { workouts: workoutId } }
    );
    
    // Revalidate Paths
    console.log('Revalidating paths...');
    revalidatePath("/calendar");
    revalidatePath("/workout");
    revalidatePath("/workouts");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    console.log('Paths revalidated');
  } catch (error) {
    console.error('Error updating user workouts:', error);
    throw error;
  }
}

