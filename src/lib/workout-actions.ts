"use server"

import { revalidatePath } from "next/cache"
import {
  getWorkoutsByUserId as getWorkoutsByUserIdDb,
  getWorkoutById as getWorkoutByIdDb,
  createWorkout as createWorkoutDb,
  deleteWorkout as deleteWorkoutDb,
  getPreviousWorkouts,
  getPreviousWorkoutsByType,
  updateWorkout as updateWorkoutDb,
} from "@/lib/db/repositories/workoutRepository"
import { getCurrentUser } from "./auth"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ObjectId } from 'mongodb'
import WorkoutExerciseModel, { IWorkoutExercise } from "@/lib/db/models/workoutExercise"
import ExerciseModel, { IExercise } from "@/lib/db/models/exercise"
import type { WorkoutData, WorkoutDataForAI, WorkoutExerciseData, SetData } from "@/types/db"
import mongoose, { Types } from 'mongoose'
import WorkoutModel, { type IWorkout, type ICardioDetails } from "@/lib/db/models/workout"
import { format } from 'date-fns'
import { estimateBodyweightForExercise } from "@/lib/utils"
import { Document } from 'mongoose'
import UserModel, { IUser } from '@/lib/db/models/user'
import SetModel from "@/lib/db/models/set";
import dbConnect from '@/lib/db/mongodb'; // Ensure dbConnect is imported
import ExercisePRModel, { IExercisePR } from '@/lib/db/models/exercisePR';
import { PrismaClient, ChallengeStatus, ChallengeType, ChallengeMetric } from '@prisma/client';
import type { Challenge } from '@prisma/client';
// --- Import the new challenge update function ---
import { updateChallengesAfterWorkout } from './challenge-actions';

const prisma = new PrismaClient(); // Instantiate PrismaClient

// --- Define types for populated lean data --- START
interface LeanSet {
  _id: Types.ObjectId;
  weight?: number;
  reps?: number;
  duration?: number;
  distance?: number;
  notes?: string;
  order?: number;
}

interface LeanExercise {
  _id: Types.ObjectId;
  name: string;
  category: "strength" | "cardio" | "flexibility";
  equipment?: string[];
  trackMaxReps?: boolean; // Include the flag
}

interface LeanWorkoutExercise {
  _id: Types.ObjectId;
  workoutId: Types.ObjectId;
  exerciseId: LeanExercise | null; // Populated exercise
  order?: number;
  notes?: string;
  sets?: LeanSet[]; // Populated sets
  duration?: number;
  distance?: number;
}

interface LeanWorkout {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name?: string;
  date?: Date; // Expecting Date object after lean
  duration?: number;
  distance?: number;
  intensity?: string;
  type?: string;
  notes?: string;
  completed?: boolean;
  completedAt?: Date;
  source?: string;
  sourceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  calculatedVolume?: number;
  cardioDetails?: ICardioDetails;
  records?: any[]; // Keep records loosely typed for now
  workoutExercises?: LeanWorkoutExercise[]; // Populated exercises
}
// --- Define types for populated lean data --- END

// --- START NEW Performance Data Types (mirroring frontend) ---
// These might eventually live in a shared types file
type PerformanceSet = {
  weight?: number;
  reps?: number;
  date: Date; // Date is mandatory here
};

export type ExercisePerformanceStats = { // Export the type
  lastWorkout?: PerformanceSet;
  personalRecord?: PerformanceSet; // Represents highest weight lifted for any reps
};
// --- END NEW Performance Data Types ---

// Define an interface for the input set structure expected by createWorkout
export interface InputSetData {
    weight?: number;
    reps?: number;
    duration?: number;
    distance?: number;
    notes?: string;
    order?: number;
}

// Define the expected shape after lean + populate
interface PopulatedWorkoutExerciseLean {
  _id: Types.ObjectId;
  workoutId: Types.ObjectId;
  exerciseId?: (IExercise & { _id: Types.ObjectId }) | null; // Populated exercise data
  // Include other fields if necessary for debugging or logic
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

// --- START NEW Server Action ---
// Fetch the last performance and PR for a specific exercise
export async function getExercisePerformanceStatsAction(
  exerciseId: string
): Promise<ExercisePerformanceStats | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.warn("[getExercisePerformanceStatsAction] User not authenticated.");
    return null;
  }
  const userId = new Types.ObjectId(session.user.id); // userId defined here

  if (!Types.ObjectId.isValid(exerciseId)) {
    console.warn("[getExercisePerformanceStatsAction] Invalid exercise ID format:", exerciseId);
    return null;
  }
  const canonicalExerciseId = new Types.ObjectId(exerciseId); // canonicalExerciseId defined here

  console.log(`[getExercisePerformanceStatsAction] Fetching stats for user ${userId} and exercise ${canonicalExerciseId}`);

  try {
    await dbConnect(); // Ensure database connection

    // ---> Step 1: Find Last Workout Performance <---
    console.log(`[getExercisePerformanceStatsAction] Finding last workout performance...`);
    let lastWorkoutData: PerformanceSet | undefined = undefined;
    
    // Aggregation to find the most recent workout exercise entry with valid sets
    // Explicitly type the pipeline as any[] to simplify TS checking
    const lastWorkoutPipeline: any[] = [
      { $match: { userId: userId, exerciseId: canonicalExerciseId } },
      { $lookup: { from: 'workouts', localField: 'workoutId', foreignField: '_id', as: 'workoutDetails' } },
      { $unwind: '$workoutDetails' },
      { $match: { 'workoutDetails.userId': userId } }, // Re-verify user ID after lookup
      { $sort: { 'workoutDetails.date': -1 } }, // Sort by workout date descending
      { $limit: 1 }, // Get only the most recent workout entry for this exercise
      { 
        $project: { 
          _id: 0, 
          workoutDate: '$workoutDetails.date', 
          sets: '$sets' // Project the embedded sets array directly
        } 
      } 
    ];

    // Now userId and canonicalExerciseId are correctly in scope
    const lastWorkoutResult = await WorkoutExerciseModel.aggregate(lastWorkoutPipeline);

    // ---> DETAILED LOGGING for Last Workout <---
    console.log(`[getExercisePerformanceStatsAction] Raw lastWorkoutResult from aggregation:`, JSON.stringify(lastWorkoutResult, null, 2));

    if (lastWorkoutResult && lastWorkoutResult.length > 0) {
      const lastWorkoutExercise = lastWorkoutResult[0]; // This now contains the embedded sets
      console.log(`[getExercisePerformanceStatsAction] Processing lastWorkoutExercise:`, JSON.stringify(lastWorkoutExercise, null, 2));
      
      // Find the first valid set directly from the embedded 'sets' array
      const firstValidSetLastWorkout = lastWorkoutExercise.sets?.find((s: any) => s.weight !== undefined && s.reps !== undefined && s.reps > 0);
      
      if (!firstValidSetLastWorkout) {
         console.log(`[getExercisePerformanceStatsAction] Could not find a 'valid' set (weight/reps > 0) in the embedded sets.`);
      }

      if (firstValidSetLastWorkout) {
        lastWorkoutData = {
          weight: firstValidSetLastWorkout.weight,
          reps: firstValidSetLastWorkout.reps,
          date: lastWorkoutExercise.workoutDate, 
        };
        console.log(`[getExercisePerformanceStatsAction] Found last workout data:`, lastWorkoutData);
      } else {
        // This log might be redundant now, covered by the check above
        // console.log(`[getExercisePerformanceStatsAction] Last workout entry found, but no valid sets.`);
      }
    } else {
      console.log(`[getExercisePerformanceStatsAction] No last workout entry found for exercise.`);
    }

    // ---> Step 2: Find Personal Record from ExercisePRs collection <---
    console.log(`[getExercisePerformanceStatsAction] Finding PR from ExercisePRs collection...`);
    let personalRecordData: PerformanceSet | undefined = undefined;
    let prReps: number | undefined = undefined; // Variable to store reps for the PR set

    const exercisePR = await ExercisePRModel.findOne({
        userId: userId,
        exerciseId: canonicalExerciseId,
        unit: 'kg' 
      })
      .sort({ value: -1 }) 
      .lean<IExercisePR>();

    if (exercisePR) {
      console.log(`[getExercisePerformanceStatsAction] Found base PR record:`, exercisePR);
      // ---> Step 2a: If PR has workoutId, find the reps from the original workout <---
      if (exercisePR.workoutId && Types.ObjectId.isValid(exercisePR.workoutId)) {
        console.log(`[getExercisePerformanceStatsAction] PR has workoutId ${exercisePR.workoutId}. Fetching original workout exercise...`);
        const prWorkoutExercise = await WorkoutExerciseModel.findOne({
          userId: userId,
          exerciseId: canonicalExerciseId,
          workoutId: exercisePR.workoutId // Find the specific entry from the PR workout
        }).lean() as IWorkoutExercise | null; // Cast lean result to include sets

        if (prWorkoutExercise && prWorkoutExercise.sets && prWorkoutExercise.sets.length > 0) {
          console.log(`[getExercisePerformanceStatsAction] Found original workout exercise. Searching sets for weight ${exercisePR.value}...`);
          let maxRepsAtPRWeight = 0;
          prWorkoutExercise.sets.forEach((set: any) => {
            // Check if the set's weight matches the PR weight
            if (set.weight === exercisePR.value && typeof set.reps === 'number') {
              console.log(`[getExercisePerformanceStatsAction] Found matching set with weight ${set.weight} and reps ${set.reps}`);
              if (set.reps > maxRepsAtPRWeight) {
                maxRepsAtPRWeight = set.reps;
              }
            }
          });

          if (maxRepsAtPRWeight > 0) {
            prReps = maxRepsAtPRWeight;
            console.log(`[getExercisePerformanceStatsAction] Determined max reps at PR weight (${exercisePR.value}kg) to be: ${prReps}`);
          } else {
             console.log(`[getExercisePerformanceStatsAction] Could not find any sets matching the PR weight ${exercisePR.value} in the original workout exercise.`);
          }
        } else {
          console.log(`[getExercisePerformanceStatsAction] Could not find the original workout exercise document for workoutId ${exercisePR.workoutId}.`);
        }
      } else {
         console.log(`[getExercisePerformanceStatsAction] PR record does not have a valid workoutId.`);
      }
      // ---> End Step 2a <---

      personalRecordData = {
        weight: exercisePR.value, 
        reps: prReps, // Assign the found reps (or undefined if not found)
        date: exercisePR.date, 
      };
      console.log(`[getExercisePerformanceStatsAction] Found PR data (with reps attempt):`, personalRecordData);
    } else {
      console.log(`[getExercisePerformanceStatsAction] No 'kg' PR found in ExercisePRs collection.`);
    }
    
    // ---> Step 3: Combine Results <---
    const result: ExercisePerformanceStats = {};
    if (lastWorkoutData) result.lastWorkout = lastWorkoutData;
    if (personalRecordData) result.personalRecord = personalRecordData;

    // canonicalExerciseId is in scope
    console.log(`[getExercisePerformanceStatsAction] Final combined result for ${canonicalExerciseId}:`, JSON.stringify(result));
    
    return deepSerialize(result); 

  } catch (error) {
    console.error("[getExercisePerformanceStatsAction] Error fetching performance stats:", error);
    return null; // Indicate failure
  }
}
// --- END NEW Server Action ---

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
    // Consider re-throwing or returning a specific error structure
    // throw new Error("Failed to fetch workouts"); 
    return []; // Return empty array on error
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
        // <<< START CHANGE: Add aiHighlight field >>>
        aiHighlight: workout.aiHighlight, // Include the AI highlight if it exists
        // <<< END CHANGE >>>
        calculatedVolume: workout.calculatedVolume, // <<< ADDED: Include calculatedVolume
    };

    // 6. Combine and return the fully plain object
    const finalData = {
        ...plainWorkout,
        workoutExercises: plainWorkoutExercises
    };

    // 7. REMOVE volume calculation here - Trust the value saved in the DB
    // if (finalData.type === 'strength') {
    //     finalData.calculatedVolume = await calculateTotalWeightLifted(finalData);
    //     console.log(`[Fetch Workout] Calculated Volume to be returned: ${finalData.calculatedVolume}`); 
    // } else {
    //     finalData.calculatedVolume = 0; // Ensure it's 0 for non-strength workouts
    // }
    // Ensure calculatedVolume exists from plainWorkout, default to 0 if not
    finalData.calculatedVolume = plainWorkout.calculatedVolume ?? 0;

    console.log("--- [FETCH WORKOUT DEBUG] Final Data Before Return --- ");
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
// REVERTED: Use original parameter type definition to avoid cascading errors
export async function createWorkout(workoutData: Partial<WorkoutData> & { 
  exercises?: Array<{ 
    name: string; 
    notes?: string; 
    sets?: InputSetData[]; 
    duration?: number;
    distance?: number;
    exerciseId?: string; // Keep this for the find logic below
  }> 
}): Promise<IWorkout> { 
  // <<< ADD LOG: Absolute Entry Point >>>
  console.log(`
🚀🚀🚀 [CreateWorkout ACTION ENTRY] 🚀🚀🚀
`);
  console.log(`[CreateWorkout ACTION ENTRY] Received workoutData keys: ${Object.keys(workoutData).join(', ')}`);
  if (workoutData.exercises) {
    console.log(`[CreateWorkout ACTION ENTRY] Received exercises count: ${workoutData.exercises.length}`);
  } else {
    console.log(`[CreateWorkout ACTION ENTRY] No exercises received in initial data.`);
  }
  // <<< END LOG >>>

  let savedWorkout: IWorkout | null = null;
  const createdWorkoutExerciseIds: Types.ObjectId[] = [];
  
  try {
    console.log('Starting workout creation (new schema)...');
    // <<< Add Logging: Log incoming cardioDetails >>>
    console.log('[CreateWorkout Action] Received workoutData.cardioDetails:', JSON.stringify(workoutData.cardioDetails, null, 2));
    // <<< End Logging >>>
    const user = await getCurrentUser();
    if (!user || !user.id) {
      throw new Error("User not authenticated or user ID missing");
    }
    const userId = user.id;
    console.log('User authenticated:', userId);

    // --- Fetch User Weight for Volume Calculation ---
    let userWeight: number | null = null;
    try {
      // Ensure we connect before fetching user weight
      const localDbConnect = (await import("@/lib/db/mongodb")).default; 
      await localDbConnect();
      const userDoc = await UserModel.findById(userId).select('weight').lean<{ weight?: number } | null>();
      if (userDoc && typeof userDoc.weight === 'number' && userDoc.weight > 0) {
        userWeight = userDoc.weight;
      }
      console.log(`[CreateWorkout] User weight for volume calc: ${userWeight || 'N/A'} kg`);
    } catch (err) {
      console.error("[CreateWorkout] Error fetching user weight:", err);
    }
    // --- End Fetch User Weight ---
    
    // --- Connect to DB (if not already connected) --- 
    await dbConnect();
    console.log('Database connection confirmed for workout creation');

    // --- Define workoutType early --- 
    const workoutType = workoutData.type || "strength";

    // --- Pre-calculate Cardio Details & Distance for Doc --- 
    let distanceInMeters: number | undefined = undefined; // Variable to hold final distance
    let cardioDetailsToAssign: ICardioDetails | undefined = undefined; // Variable to hold final details

    // --- Process cardioDetails and calculate distance --- 
    // Use direct equality checks for reliability
    if (workoutType === 'running' || workoutType === 'cycle' || workoutType === 'swim') { // MODIFIED: Include cycle and swim
        const details: Partial<ICardioDetails> = {};
        if (workoutData.cardioDetails) {
            if (workoutData.cardioDetails.distance !== undefined) details.distance = workoutData.cardioDetails.distance; // KM
            if (workoutData.cardioDetails.duration !== undefined) details.duration = workoutData.cardioDetails.duration; // Seconds
            if (workoutData.cardioDetails.pace !== undefined) details.pace = workoutData.cardioDetails.pace;
            if (workoutData.cardioDetails.elevationGain !== undefined) details.elevationGain = workoutData.cardioDetails.elevationGain;
        }
        // Fallbacks
        if (details.distance === undefined && workoutData.distance !== undefined) { details.distance = workoutData.distance; }
        if (details.duration === undefined && workoutData.duration !== undefined) { details.duration = workoutData.duration; }

        if (Object.keys(details).length > 0) {
             cardioDetailsToAssign = details as ICardioDetails; // Stage for assignment later
        } else {
             // Handle case where details might be empty after checks
        }
        
        // Calculate distance in METERS
        const distanceKm = details.distance; // Use the final distance from details (could be from cardioDetails or fallback)
        if (distanceKm !== undefined) {
            distanceInMeters = distanceKm * 1000;
            console.log(`[CreateWorkout Action] Calculated distanceInMeters: ${distanceInMeters}`); 
        } else {
             // Handle case where distanceKm is undefined
        }
    } else {
        // Log if the type doesn't match the specific cardio types we handle here
        console.log(`[CreateWorkout Action] workoutType '${workoutType}' does not require distance/cardioDetails processing in this block.`); // MODIFIED: Changed else log
    }
    // --- End cardio processing block ---

    // --- Calculate Total Duration --- 
    let totalDuration = 0;
    if (workoutData.exercises && Array.isArray(workoutData.exercises)) {
      workoutData.exercises.forEach(exercise => {
        if (exercise.duration) { totalDuration += exercise.duration; }
        if (exercise.sets && Array.isArray(exercise.sets)) {
          exercise.sets.forEach(set => { if (set.duration) { totalDuration += set.duration; } });
        }
      });
    }
    // Use provided duration OR the calculated duration from exercises/sets
    const finalDuration = workoutData.duration ?? totalDuration; 
    // --- End Calculate Total Duration ---

    // --- Calculate Volume --- 
    let calculatedVolumeForDoc = 0;
    if (workoutType === 'strength') {
        calculatedVolumeForDoc = calculateWorkoutVolumeWithBodyweight(
            workoutData.exercises, userWeight
        );
    }
    // --- End Calculate Volume ---
    
    // --- Create Workout Document --- 
    console.log('Formatting workout document data object...');
    const isValidWorkoutType = ["strength", "running", "swimming", "cycling", "hiit", "flexibility", "walking", "yoga", "pilates", "other"].includes(workoutType);
    const isValidSource = ["manual", "garmin", "coros", "strava", "apple", "ai"].includes(workoutData.source || '');
    const isValidIntensity = ["Low", "Medium", "High"].includes(workoutData.intensity || '');

    // Initialize workoutDocData WITH pre-calculated values
    const workoutDocData: Partial<IWorkout> = {
      userId: userId,
      name: workoutData.name || "Workout", 
      date: workoutData.date ? new Date(workoutData.date) : new Date(),
      type: isValidWorkoutType ? workoutType as IWorkout['type'] : 'other',
      notes: workoutData.notes || "",
      source: isValidSource ? workoutData.source as IWorkout['source'] : 'manual',
      intensity: isValidIntensity ? workoutData.intensity as IWorkout['intensity'] : undefined,
      duration: finalDuration, // Use pre-calculated final duration
      cardioDetails: cardioDetailsToAssign, // Use pre-calculated cardio details
      distance: distanceInMeters, // Use pre-calculated distance in meters
      calculatedVolume: calculatedVolumeForDoc // Use pre-calculated volume
    };
    
    // Assign staged values AFTER initial object creation
    // This might be redundant now but ensures assignment happens explicitly
    if (cardioDetailsToAssign) {
        workoutDocData.cardioDetails = cardioDetailsToAssign;
        console.log(`[CreateWorkout Action] Assigned workoutDocData.cardioDetails.`);
        // console.log('workoutDocData after assigning cardioDetails:', JSON.stringify(workoutDocData)); // REMOVED LOG
    }
    if (distanceInMeters !== undefined) {
        workoutDocData.distance = distanceInMeters;
        console.log(`[CreateWorkout Action] Assigned workoutDocData.distance: ${workoutDocData.distance}`);
        // console.log('workoutDocData after assigning distance:', JSON.stringify(workoutDocData)); // REMOVED LOG
    }

    console.log('[CreateWorkout Action] workoutDocData before save:', JSON.stringify(workoutDocData, null, 2));
    const workout = new WorkoutModel(workoutDocData);
    // <<< ADD LOG >>>
    console.log("[CreateWorkout] Attempting to save main workout document...");
    savedWorkout = await workout.save();
    // <<< ADD LOG >>>
    console.log(`[CreateWorkout] Main workout document saved. ID: ${savedWorkout?._id}`);
    
    // <<< FIX: Add null check for savedWorkout >>>
    if (!savedWorkout || !savedWorkout._id) {
        // Rollback logic might need adjustment if save failed here
        console.error("Failed to save workout document or obtain its ID.");
        throw new Error("Workout document creation failed unexpectedly.");
    }
    const workoutId = savedWorkout._id; 
    // <<< End Fix >>>

    // --- Create WorkoutExercise Documents (using workoutData.exercises) --- 
    console.log('Processing exercises for workout...');
    if (workoutData.exercises && workoutData.exercises.length > 0) {
      let exerciseOrderIndex = 0;
      for (const exerciseInput of workoutData.exercises) { 
        const exerciseName = exerciseInput.name;
        if (!exerciseName) {
            console.warn(`Skipping exercise at index ${exerciseOrderIndex} due to missing name.`);
            exerciseOrderIndex++;
            continue; 
        }

        // --- Find or Create Canonical Exercise (Restore original logic) --- 
        let exerciseId: Types.ObjectId | null = null;
        // Check if exerciseId was passed in the input (might need `as any`)
        if ((exerciseInput as any).exerciseId && Types.ObjectId.isValid((exerciseInput as any).exerciseId)) {
            exerciseId = new Types.ObjectId((exerciseInput as any).exerciseId);
            console.log(`Using provided exercise ID: ${exerciseId}`);
        } else {
            // Fallback to finding by name
            console.log(`Finding exercise by name: ${exerciseName}`);
            const exercise = await ExerciseModel.findOne({ name: exerciseName }).lean() as (IExercise & { _id: Types.ObjectId }) | null;
            if (!exercise) {
                 console.warn(`Exercise '${exerciseName}' not found. Skipping.`);
                 exerciseOrderIndex++;
                 continue;
            } else {
                exerciseId = exercise._id;
                console.log(`Found exercise ID: ${exerciseId}`);
            }
        }
        // --- (End Find/Create Exercise) ---

        // --- Prepare sets data for embedding --- 
        let setsToEmbed: any[] = [];
        if (exerciseInput.sets && exerciseInput.sets.length > 0) {
           setsToEmbed = exerciseInput.sets.map((set: InputSetData, setIndex: number) => {
              // ... (rest of set preparation logic) ...
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

        // --- Create WorkoutExercise --- 
        const workoutExerciseData = {
            userId: userId,
            workoutId: workoutId,
            exerciseId: exerciseId,
            order: exerciseOrderIndex, 
            notes: exerciseInput.notes, 
            sets: setsToEmbed, 
            duration: exerciseInput.duration, // Use exerciseInput.duration
            distance: exerciseInput.distance, // Use exerciseInput.distance
        };
        const workoutExercise = new WorkoutExerciseModel(workoutExerciseData);
        // <<< ADD LOG >>>
        console.log(`[CreateWorkout] Attempting to save WorkoutExercise for: ${exerciseName}`);
        const savedWorkoutExercise = await workoutExercise.save();
        // <<< ADD LOG >>>
        console.log(`[CreateWorkout] Saved WorkoutExercise ID: ${savedWorkoutExercise?._id}`);
        createdWorkoutExerciseIds.push(savedWorkoutExercise._id);
        
        exerciseOrderIndex++; 
      }
    } else {
        console.log('No exercises provided in input data.');
    }

    // --- Keep existing logic for walking distance calculation, user update, revalidation --- 
    // <<< ADD LOG >>>
    console.log(`[CreateWorkout] Attempting to call updateUserWorkouts for user ${userId} and workout ${workoutId}...`); 
    // Add specific type check before call
    if (!(workoutId instanceof Types.ObjectId)) {
      console.error(`[CreateWorkout] CRITICAL ERROR: workoutId is not an ObjectId before calling updateUserWorkouts. Type: ${typeof workoutId}, Value:`, workoutId);
      throw new Error('Internal error: workoutId was not a valid ObjectId.');
    }
    // Explicitly assert workoutId type here (should be safe after check)
    await updateUserWorkouts(userId, workoutId as Types.ObjectId); 
    // <<< ADD LOG >>>
    console.log(`[CreateWorkout] Finished calling updateUserWorkouts.`);
    
    // --- <<< NEW: Update Challenge Progress >>> ---
    if (savedWorkout) {
      try {
        console.log(`[CreateWorkout] Calling updateChallengesAfterWorkout for user ${userId} and workout ${workoutId}...`);
        
        // --- REVISED DATA PASSING --- 
        // Construct the data object needed by the challenge function directly
        // We need the saved workout details and the structured exercises INPUT data
        
        // 1. Get the basic saved workout data (as plain object)
        const workoutBaseData = savedWorkout.toObject();

        // 2. Get the structured exercise data *as it was processed for saving*
        //    (This assumes workoutData.exercises reflects the processed structure)
        //    We need to map it slightly to match the expected populated structure
        const workoutExercisesForChallenge = (workoutData.exercises || [])
            .map((exerciseInput, index) => {
                // Find the corresponding canonical exercise details (assuming ExerciseModel is available)
                // This might require fetching exercises again if not readily available
                // For now, let's assume we just need the ID and structure
                let foundExerciseId: Types.ObjectId | null = null;
                if ((exerciseInput as any).exerciseId && Types.ObjectId.isValid((exerciseInput as any).exerciseId)) {
                    foundExerciseId = new Types.ObjectId((exerciseInput as any).exerciseId);
                } 
                // Ideally, we'd have the full exercise name/category too, but depends on availability

                return {
                    // Simulate the populated structure expected by updateChallengesAfterWorkout
                    _id: createdWorkoutExerciseIds[index], // Use the saved WorkoutExercise ID if available
                    workoutId: workoutId,
                    order: index,
                    notes: exerciseInput.notes,
                    sets: exerciseInput.sets?.map((set, setIndex) => ({ // Map sets
                        weight: set.weight,
                        reps: set.reps,
                        order: set.order ?? setIndex,
                        // Add other set fields if needed by challenge logic
                    })),
                    exerciseId: foundExerciseId ? { _id: foundExerciseId, name: exerciseInput.name } : null // Basic populated structure
                    // Add duration/distance if relevant for the exercise
                };
            })
            .filter(ex => ex.exerciseId !== null); // Filter out exercises where ID wasn't resolved
            
        // 3. Combine base workout data with the structured exercises
        const dataForChallengeUpdate = {
            ...workoutBaseData,
            workoutExercises: workoutExercisesForChallenge, // Add the structured exercises
        };
        // --- END REVISED DATA PASSING ---

        // OLD Re-fetch logic REMOVED
        /*
        const workoutWithExercises = await WorkoutModel.findById(workoutId)
          .populate({ 
            path: 'workoutExercises',
            populate: { 
              path: 'exerciseId',
              model: 'Exercise'
            }
          })
          .lean();
        */
        
        // Pass the directly constructed data
        // if (workoutWithExercises) { // Check the constructed data instead
        if (dataForChallengeUpdate) { 
          await updateChallengesAfterWorkout(userId, dataForChallengeUpdate);
        } else {
          console.warn(`[CreateWorkout] Could not construct workout data with exercises for challenge update.`);
        }
      } catch (challengeError) {
        console.error(`[CreateWorkout] Error during challenge update processing:`, challengeError);
        // Log error, but don't throw, to avoid blocking the main workout save response.
      }
    }
    // --- <<< END: Update Challenge Progress >>> ---

    console.log('Revalidating paths...');
    revalidatePath("/calendar");
    revalidatePath("/workouts");
    revalidatePath("/dashboard");
    revalidatePath("/activity");
    revalidatePath("/challenges"); // <<< ADD: Revalidate challenges path
    console.log('Paths revalidated');

    // --- Update User Summaries --- 
    console.log(`[CreateWorkout] Checking if savedWorkout exists before calling summary update. savedWorkout: ${!!savedWorkout}`);
    if (savedWorkout) { // Check savedWorkout before calling summary
      console.log(`[CreateWorkout] Calling updateUserWorkoutSummaries for user ${userId}...`);
      await updateUserWorkoutSummaries(userId);
    }

    // IMPORTANT: Final return statement *inside* the try block for success path
    if (!savedWorkout) {
       // This should theoretically not happen if save succeeded, but as a safeguard:
       throw new Error("Workout saving process completed without a valid savedWorkout object.");
    }
    return savedWorkout.toObject(); // Return the plain object 

  } catch (error) {
    console.error("Error creating workout (new schema):", error);
    
    // --- Rollback Logic --- 
    // (Cleanup logic remains the same)
    if (createdWorkoutExerciseIds.length > 0) {
        console.warn(`Attempting to cleanup ${createdWorkoutExerciseIds.length} created WorkoutExercise documents due to error.`);
        try {
            await WorkoutExerciseModel.deleteMany({ _id: { $in: createdWorkoutExerciseIds as any[] } }); 
            console.log('Cleaned up WorkoutExercise documents (including embedded sets).');
        } catch (cleanupExerciseError) {
            console.error('Failed to cleanup WorkoutExercise/Set documents:', cleanupExerciseError);
        }
    }
    if (savedWorkout && savedWorkout._id && savedWorkout._id instanceof Types.ObjectId) { 
        const workoutIdToDelete = savedWorkout._id; 
        console.warn(`Attempting to cleanup created workout (${workoutIdToDelete}) due to error.`);
        try {
            await WorkoutModel.findByIdAndDelete(workoutIdToDelete as Types.ObjectId);
            console.log(`Cleaned up workout ${workoutIdToDelete}`);
        } catch (cleanupWorkoutError) {
            console.error(`Failed to cleanup workout ${workoutIdToDelete}:`, cleanupWorkoutError);
        }
    }
    // --- ALWAYS Re-throw the error --- 
    throw error; 
  }
}

/**
 * Calculates and updates the performanceSummary and overall personalRecords
 * fields for a given user based on their workout history.
 *
 * @param userId - The ID of the user to update.
 */
export async function updateUserWorkoutSummaries(userId: string): Promise<void> {
  // <<< ADD LOG: Confirming entry into updateUserWorkoutSummaries >>>
  console.log(`[Summ ENTRY] Starting summary update for user: ${userId}`);
  
  if (!userId) {
    console.error('[updateUserWorkoutSummaries] No userId provided.');
    return;
  }
  console.log(`[Summ] Starting overall summary and challenge update for user: ${userId}`);

  try {
    await dbConnect(); // Mongoose connect
    const userObjectId = new Types.ObjectId(userId); // Define userObjectId early

    // --- Fetch necessary data concurrently --- 

    // 1. User Data (Weight, existing overall PRs)
    const userPromise = UserModel.findById(userObjectId)
        .select('weight personalRecords') // Select fields needed for overall PRs and maybe challenges
        .lean<IUser>();
        
    // 2. All Workouts - Define, await separately
    const workoutsPromise = WorkoutModel.find({ userId: userObjectId })
      .select('_id userId date type duration distance calculatedVolume cardioDetails workoutExercises') 
      .populate({ 
          path: 'workoutExercises',
          populate: {
              path: 'exerciseId',
              model: 'Exercise',
              select: 'name category trackMaxReps' 
          }
      })
      .sort({ date: 1 }) 
      .lean<PopulatedLeanWorkout>(); 
    const workoutsRaw = await workoutsPromise; // Await the query here
    console.log("[Summ] Finished awaiting workoutsPromise."); // Log after await

    // 3. Active Challenges for the Current Month (using Prisma)
    // Restore definitions
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const challengesPromise = prisma.challenge.findMany({
        where: {
            userId: userId,
            year: currentYear,
            month: currentMonth,
            status: { 
                in: [ChallengeStatus.NotStarted, ChallengeStatus.InProgress] 
            }
        }
    });

    // Await remaining promises individually (alternative syntax)
    console.log("[Summ] Awaiting userPromise..."); // Log before await
    const userDoc = await userPromise; // <-- Await here
    console.log("[Summ] Finished awaiting userPromise."); // Log after await

    console.log("[Summ] Awaiting challengesPromise..."); // Log before await
    const activeChallenges = await challengesPromise; // <-- Await here
    console.log("[Summ] Finished awaiting challengesPromise."); // Log after await

    // Cast the awaited workouts result, ignoring persistent TS inference issue
    // @ts-ignore - TS incorrectly infers workoutsRaw as single object despite .find().lean()
    const workouts = workoutsRaw as PopulatedLeanWorkout[];

    console.log(`[Summ] Fetched ${workouts.length} workouts and ${activeChallenges.length} active challenges for user ${userId}.`);

    // Extract user weight and existing overall PRs (used later for challenge goal checks?)
    const userWeight = (typeof userDoc?.weight === 'number' && userDoc.weight > 0) ? userDoc.weight : null;
    const initialOverallPRs = userDoc?.personalRecords || {}; // Use initial PRs from DB

    if (workouts.length === 0) {
        // ... reset summaries ...
        return;
    }

    // --- Initialize Summary and Challenge Tracking Variables ---
    let overallDistance = 0, overallDuration = 0, overallVolume = 0;
    const overallCount = workouts.length;
    let lastWorkoutDate = workouts[workouts.length - 1].date; 

    // Initialize overall PR tracking with values from DB, ensure Date conversion
    let overallLongestRun = { 
        value: initialOverallPRs.longestRun?.value ?? 0, 
        date: initialOverallPRs.longestRun?.date ? new Date(initialOverallPRs.longestRun.date) : new Date(0), 
        workoutId: initialOverallPRs.longestRun?.workoutId // Keep ObjectId 
    };
    let overallFastest5kPace = { 
        value: initialOverallPRs.fastest5kPace?.value ?? Infinity, 
        date: initialOverallPRs.fastest5kPace?.date ? new Date(initialOverallPRs.fastest5kPace.date) : new Date(0), 
        workoutId: initialOverallPRs.fastest5kPace?.workoutId
    };
    let overallMaxStrengthVolume = { 
        value: initialOverallPRs.maxStrengthVolume?.value ?? 0, 
        date: initialOverallPRs.maxStrengthVolume?.date ? new Date(initialOverallPRs.maxStrengthVolume.date) : new Date(0), 
        workoutId: initialOverallPRs.maxStrengthVolume?.workoutId
    };
    
    // Define Monthly Challenge Trackers BEFORE the loop
    let monthlyDistance = 0;
    let monthlyVolume = 0; 
    let monthlySessions = 0;
    const monthlyWorkoutDays = new Set<string>();
    const monthlyCategoriesUsed = new Set<string>();
    let monthlyMaxRunDistance = 0;
    const monthlyMaxWeightPerExercise: Record<string, number> = {}; 
    const monthlyMaxRepsPerExercise: Record<string, number> = {};

    // --- Iterate through workouts (Sorted Ascending) ---
    for (const workout of workouts) {
        // Explicitly validate and get workoutId as ObjectId
        let workoutId: Types.ObjectId;
        try {
            if (!workout._id) {
                console.warn(`[Summ] Skipping workout due to missing _id.`);
                continue; // Skip this iteration if _id is missing
            }
            // Attempt to create ObjectId regardless of initial type (string or ObjectId)
            // Mongoose lean() might return string or ObjectId depending on context/version
            // Cast to 'any' to satisfy constructor overload while relying on try/catch for runtime safety
            workoutId = new Types.ObjectId(workout._id as any); 
        } catch (e) {
            console.warn(`[Summ] Skipping workout due to invalid _id format: ${workout._id}. Error:`, e);
            continue; // Skip if conversion fails
        }

        const workoutDate = workout.date instanceof Date ? workout.date : new Date(workout.date);
        const workoutType = workout.type?.toLowerCase() || 'other';
        // REMOVED: const workoutId = typeof workout._id === 'string' ? new Types.ObjectId(workout._id) : workout._id;
        const duration = workout.duration ?? 0;
        const distance = workout.cardioDetails?.distance ?? workout.distance ?? 0;
        const calculatedWorkoutVolume = workout.calculatedVolume ?? 0; 
        
        // Check if workout is in the current month for challenge updates
        const isInCurrentMonth = workoutDate.getFullYear() === currentYear && workoutDate.getMonth() + 1 === currentMonth;

        if (isInCurrentMonth) {
            console.log(`[Summ] Processing workout ${workoutId} from ${workoutDate.toISOString()}`);
            console.log(`[Summ] Type: ${workoutType}, Volume: ${calculatedWorkoutVolume}, Duration: ${duration}`);

            // Update Monthly Aggregates
            monthlySessions++;
            monthlyWorkoutDays.add(workoutDate.toISOString().split('T')[0]);
            monthlyDistance += distance;
            monthlyVolume += calculatedWorkoutVolume;

            console.log(`[Summ] Monthly totals after workout:`, {
                sessions: monthlySessions,
                uniqueDays: monthlyWorkoutDays.size,
                distance: monthlyDistance,
                volume: monthlyVolume
            });

            // Process exercises for monthly maxes and categories
            if (workout.workoutExercises && Array.isArray(workout.workoutExercises)) {
                for (const workoutExercise of workout.workoutExercises) {
                    const exerciseInfo = workoutExercise.exerciseId;
                    if (!exerciseInfo?._id || !exerciseInfo.name) continue;

                    // Add exercise category to the set
                    if (exerciseInfo.category) {
                        monthlyCategoriesUsed.add(exerciseInfo.category.toLowerCase());
                        console.log(`[Summ] Added category: ${exerciseInfo.category.toLowerCase()}`);
                    }

                    // Process sets for max weight and reps
                    const exerciseIdStr = exerciseInfo._id.toString();
                    if (workoutExercise.sets && Array.isArray(workoutExercise.sets)) {
                        for (const set of workoutExercise.sets) {
                            const setWeight = set.weight ?? 0;
                            const setReps = set.reps ?? 0;

                            // Calculate effective weight (including bodyweight exercises)
                            let effectiveWeight = setWeight;
                            if (setWeight === 0 && setReps > 0) {
                                effectiveWeight = estimateBodyweightForExercise(exerciseInfo.name, userWeight);
                                console.log(`[Summ] Using estimated weight for ${exerciseInfo.name}: ${effectiveWeight}kg`);
                            }

                            // Update max weight if this set has a higher effective weight
                            if (setReps > 0 && effectiveWeight > (monthlyMaxWeightPerExercise[exerciseIdStr] ?? 0)) {
                                monthlyMaxWeightPerExercise[exerciseIdStr] = effectiveWeight;
                                console.log(`[Summ] New max weight for ${exerciseInfo.name}: ${effectiveWeight}kg`);
                            }

                            // Update max reps if this set has more reps
                            if (setReps > (monthlyMaxRepsPerExercise[exerciseIdStr] ?? 0)) {
                                monthlyMaxRepsPerExercise[exerciseIdStr] = setReps;
                                console.log(`[Summ] New max reps for ${exerciseInfo.name}: ${setReps}`);
                            }
                        }
                    }
                }
            }

            // Update running-specific metrics
            if ((workoutType === 'running' || workoutType === 'run') && distance > monthlyMaxRunDistance) {
                monthlyMaxRunDistance = distance;
                console.log(`[Summ] New max run distance: ${monthlyMaxRunDistance}km`);
            }
        }
        
        // Update Overall Lifetime Summaries/PRs (Always process)
        overallDuration += duration;
        overallDistance += distance; 
        overallVolume += calculatedWorkoutVolume;

        if (workoutType === 'strength') {
           if (calculatedWorkoutVolume > overallMaxStrengthVolume.value) {
               overallMaxStrengthVolume = { 
                   value: calculatedWorkoutVolume, 
                   date: workoutDate, 
                   workoutId: workoutId // Assign the validated ObjectId
               }; 
           }
        }
        if (workoutType === 'running' || workoutType === 'run') {
          if (distance > overallLongestRun.value) {
            overallLongestRun = { 
                value: distance, 
                date: workoutDate, 
                workoutId: workoutId // Assign the validated ObjectId
            };
          }
          // Potential pace calculation check: Pace = Time / Distance. Ensure units match expected output.
          // Current: duration (seconds assumed) / (distance (km assumed) * 1000) => sec/meter?
          // If pace should be min/km: (duration / 60) / distance
          const pace = duration > 0 && distance > 0 ? duration / distance : 0; // Basic pace (time/dist), adjust units as needed
          
          if (distance >= 5 && pace > 0) { // Ensure pace is valid
            if (pace < overallFastest5kPace.value) {
              overallFastest5kPace = { 
                  value: pace, 
                  date: workoutDate, 
                  workoutId: workoutId // Assign the validated ObjectId
              };
            }
          }
        }
    } // End workout iteration

    // Log monthly totals for debugging
    console.log(`[Summ] Monthly totals for ${currentMonth}/${currentYear}:`, {
        sessions: monthlySessions,
        uniqueDays: monthlyWorkoutDays.size,
        distance: monthlyDistance,
        volume: monthlyVolume,
        maxRunDistance: monthlyMaxRunDistance,
        categoriesUsed: Array.from(monthlyCategoriesUsed),
        exerciseMaxes: {
            weights: Object.keys(monthlyMaxWeightPerExercise).length,
            reps: Object.keys(monthlyMaxRepsPerExercise).length
        }
    });

    // --- Update User Document (Overall Summaries & PRs - Mongoose) ---
    // ... construct userUpdateData ...
    // IMPORTANT: Ensure the overallXyz variables being saved here contain ObjectId for workoutId if that's expected by Mongoose schema/consumers
    const finalUpdateData = {
       'performanceSummary.overallTotals.distance': overallDistance,
       'performanceSummary.overallTotals.duration': overallDuration,
       'performanceSummary.overallTotals.volume': overallVolume,
       'performanceSummary.overallTotals.count': overallCount,
       'performanceSummary.lastWorkoutDate': lastWorkoutDate,
       'personalRecords.longestRun': overallLongestRun.value > 0 ? overallLongestRun : undefined,
       'personalRecords.fastest5kPace': overallFastest5kPace.value !== Infinity ? overallFastest5kPace : undefined,
       'personalRecords.maxStrengthVolume': overallMaxStrengthVolume.value > 0 ? overallMaxStrengthVolume : undefined,
    };
    // Remove undefined fields
    Object.keys(finalUpdateData).forEach(key => {
        if (finalUpdateData[key as keyof typeof finalUpdateData] === undefined) {
            delete finalUpdateData[key as keyof typeof finalUpdateData];
        }
    });
    
    await UserModel.updateOne({ _id: userObjectId }, { $set: finalUpdateData });
    console.log(`[Summ] User document update complete for ${userId}.`);

    // --- Update User Document with New Stats ---
    await UserModel.updateOne(
        { _id: userObjectId },
        { 
            $set: {
                'performanceSummary.overallTotals.distance': overallDistance,
                'performanceSummary.overallTotals.duration': overallDuration,
                'performanceSummary.overallTotals.volume': overallVolume,
                'performanceSummary.overallTotals.count': overallCount,
                'performanceSummary.lastWorkoutDate': lastWorkoutDate,
                'personalRecords.longestRun': overallLongestRun.value > 0 ? overallLongestRun : undefined,
                'personalRecords.fastest5kPace': overallFastest5kPace.value !== Infinity ? overallFastest5kPace : undefined,
                'personalRecords.maxStrengthVolume': overallMaxStrengthVolume.value > 0 ? overallMaxStrengthVolume : undefined
            }
        }
    );

    // Revalidate relevant pages
    revalidatePath('/challenges');
    revalidatePath('/dashboard');
    revalidatePath('/profile');
    revalidatePath('/activity');

    console.log(`[Summ] Successfully updated workout summaries for user ${userId}`);
  } catch (error) { 
     // <<< ENHANCE CATCH LOGGING >>>
     console.error(`
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
[Summ] CRITICAL ERROR during summary update for user ${userId}:
`, error, `
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`);
     // Optionally re-throw to make the failure visible upstream
     // throw error;
  }
}

// --- Helper Function for Volume Calculation ---
// Ensure this helper function is defined correctly
function calculateWorkoutVolumeWithBodyweight(
  exercises: Array<{ name?: string | null; exerciseName?: string | null; sets?: Array<{ weight?: number; reps?: number }> | null }> | null | undefined,
  userWeight: number | null
): number {
  if (!exercises || !Array.isArray(exercises)) {
    return 0;
  }
  let totalVolume = 0;
  exercises.forEach(exercise => {
    const exerciseName = exercise?.exerciseName || exercise?.name || '';
    if (!exerciseName) { return; }
    if (exercise.sets && Array.isArray(exercise.sets)) {
      exercise.sets.forEach(set => {
        const reps = typeof set.reps === 'number' && set.reps > 0 ? set.reps : 0;
        if (reps === 0) return;
        const estimatedWeight = estimateBodyweightForExercise(exerciseName, userWeight);
        const externalWeight = typeof set.weight === 'number' && set.weight > 0 ? set.weight : 0;
        let weightForVolume = estimatedWeight;
        if (externalWeight > 0) { weightForVolume += externalWeight; }
        if (weightForVolume > 0) { totalVolume += weightForVolume * reps; }
      });
    }
  });
  return totalVolume;
}
// --- END HELPER FUNCTION ---

// --- LEAN TYPE DEFINITIONS MOVED TO TOP ---

// --- Define intermediate type BEFORE its first use ---
interface PopulatedLeanWorkout { 
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: Date; // Make date non-optional as query sorts by it
  type?: string;
  duration?: number;
  distance?: number;
  calculatedVolume?: number;
  cardioDetails?: ICardioDetails;
  workoutExercises?: LeanWorkoutExercise[]; 
}

// --- NEW FUNCTION for Exercise PRs ---
/**
 * Calculates and updates exercise-specific PRs for a user.
 * Can optionally process only a specific workout.
 *
 * @param userId - The ID of the user to update PRs for.
 * @param specificWorkoutId - Optional. If provided, only process this workout. Otherwise, process all.
 */
export async function updateExercisePRs(userId: string, specificWorkoutId?: string): Promise<void> {
  await dbConnect();
  console.log(`[updateExercisePRs] Starting for user: ${userId}, specific workout: ${specificWorkoutId || 'all'}`);

  try {
    // <<< FIX: Define userObjectId here >>>
    const userObjectId = new Types.ObjectId(userId);
    
    // <<< FIX: Fetch user and userWeight here >>>
    const user = await UserModel.findById(userObjectId).select('weight').lean<IUser>();
    if (!user) {
      console.error(`[updateExercisePRs] User not found: ${userId}`);
      return;
    }
    const userWeight = (typeof user.weight === 'number' && user.weight > 0) ? user.weight : null;

    // <<< FIX: Define workoutQuery correctly >>>
    const workoutQuery: any = { userId: userObjectId };
    if (specificWorkoutId && Types.ObjectId.isValid(specificWorkoutId)) {
      workoutQuery._id = new Types.ObjectId(specificWorkoutId);
      console.log(`[updateExercisePRs] Querying for specific workout: ${specificWorkoutId}`);
    } else {
      console.log(`[updateExercisePRs] Querying for ALL workouts for user: ${userId}`);
    }

    // --- REFACTORED DATA FETCHING --- 
    
    // 1. Fetch Workout documents (use the defined workoutQuery)
    const workoutDocs = await WorkoutModel.find(workoutQuery) // <<< Use workoutQuery
      .select('_id date') 
      .sort({ date: 1 }) 
      .lean();
      
    if (!workoutDocs || workoutDocs.length === 0) {
      console.log(`[updateExercisePRs] No workouts found matching criteria.`);
      return;
    }
    
    const workoutIds = workoutDocs.map(w => w._id);
    console.log(`[updateExercisePRs] Found ${workoutDocs.length} workouts. Fetching associated exercises...`);
    
    // 2. Fetch related WorkoutExercise documents and populate Exercise details
    const workoutExercises = await WorkoutExerciseModel.find({ workoutId: { $in: workoutIds } })
      .populate<{ exerciseId: LeanExercise | null }>({
        path: 'exerciseId',
        model: ExerciseModel,
        select: 'name category equipment trackMaxReps' // Ensure trackMaxReps is selected
      })
      // REMOVED: Populate sets here - We don't need populated sets for PR calc, lean() is enough
      .lean() as unknown as LeanWorkoutExercise[]; // Use lean for efficiency

    console.log(`[updateExercisePRs] Fetched ${workoutExercises.length} WorkoutExercise documents.`);

    // 3. Group exercises by workoutId for efficient lookup
    const exercisesByWorkoutId = workoutExercises.reduce((acc, ex) => {
        const wId = ex.workoutId.toString();
        if (!acc[wId]) acc[wId] = [];
        acc[wId].push(ex);
        return acc;
    }, {} as Record<string, LeanWorkoutExercise[]>);

    // --- END REFACTORED DATA FETCHING --- 

    console.log(`[updateExercisePRs] Processing ${workoutDocs.length} workouts...`);

    const potentialPRs: Record<string, Partial<IExercisePR> & { value: number; date: Date }> = {};

    // Iterate through the lean WORKOUT documents
    for (const workout of workoutDocs) {
      // Get associated exercises from the map
      // Ensure workout._id is treated as an ObjectId before converting to string
      const workoutDocId = workout._id as Types.ObjectId; 
      const workoutIdString = workoutDocId.toString();
      const exercisesForWorkout = exercisesByWorkoutId[workoutIdString] || [];
      
      if (!exercisesForWorkout || exercisesForWorkout.length === 0 || !workout.date) continue;
      const workoutDate = workout.date; // Already a Date object from .lean()
      const workoutIdObj = workoutDocId; // Use the ObjectId directly where needed

      // Iterate through the lean WorkoutExercise documents for this workout
      for (const exercise of exercisesForWorkout) { 
        // Use the populated/lean exerciseId data
        const exerciseDocId = exercise.exerciseId?._id as Types.ObjectId; // Ensure exerciseId._id is treated as ObjectId
        if (!exerciseDocId || !exercise.exerciseId?.name) continue; 

        const exerciseIdObj = exerciseDocId; // Use the ObjectId directly
        const exerciseName = exercise.exerciseId.name;
        const exerciseTrackMaxReps = exercise.exerciseId.trackMaxReps ?? false;

        let currentMaxWeight = 0;
        let currentMaxReps = 0;

        // Use the lean sets data directly from the WorkoutExercise document
        if (exercise.sets && exercise.sets.length > 0) { 
          for (const set of exercise.sets) {
            const setWeight = set.weight ?? 0;
            const setReps = set.reps ?? 0;

            // Determine effective weight for PR check (external or estimated bodyweight)
            let effectiveWeight = 0;
            if (setWeight > 0) {
              effectiveWeight = setWeight; // Use actual weight if provided
            } else if (setReps > 0) {
              // Only estimate bodyweight if weight is 0 AND reps are > 0
              // <<< FIX: Pass userWeight here >>>
              effectiveWeight = estimateBodyweightForExercise(exerciseName, userWeight);
            }

            // Update max weight achieved in this workout for this exercise
            if (setReps > 0 && effectiveWeight > currentMaxWeight) {
              currentMaxWeight = effectiveWeight;
            }

            // Update max reps achieved in this workout for this exercise
            // This applies regardless of weight for bodyweight exercises
            if (setReps > currentMaxReps) {
              currentMaxReps = setReps;
            }
          }
        }
        // ... rest of the PR staging logic remains the same ...
        // --- Check and Stage Max Weight PR --- 
        // Only stage weight PR if trackMaxReps is false
        if (!exerciseTrackMaxReps && currentMaxWeight > 0) { 
          const prKey = `${exerciseIdObj.toString()}_kg`; 
          const existingPR = potentialPRs[prKey];

          if (!existingPR || currentMaxWeight > existingPR.value || (currentMaxWeight === existingPR.value && workoutDate > existingPR.date)) {
            potentialPRs[prKey] = {
              userId: userObjectId,
              exerciseId: exerciseIdObj, // Pass ObjectId
              exerciseName: exerciseName,
              value: currentMaxWeight,
              unit: 'kg',
              date: workoutDate,
              workoutId: workoutIdObj, // Correct property name
            };
          }
        }

        // --- Check and Stage Max Reps PR --- 
        if (exerciseTrackMaxReps && currentMaxReps > 0) {
          const prKey = `${exerciseIdObj.toString()}_reps`;
          const existingPR = potentialPRs[prKey];

          if (!existingPR || currentMaxReps > existingPR.value || (currentMaxReps === existingPR.value && workoutDate > existingPR.date)) {
            potentialPRs[prKey] = {
              userId: userObjectId,
              exerciseId: exerciseIdObj, // Pass ObjectId
              exerciseName: exerciseName,
              value: currentMaxReps,
              unit: 'reps',
              date: workoutDate,
              workoutId: workoutIdObj, // Correct property name
            };
          }
        }
      } // End loop through exercises
    } // End loop through workouts

    // --- Prepare Bulk Operations ---
    const bulkOps: any[] = []; // Initialize as any[] for flexibility
    const processedDeleteKeys = new Set<string>(); // Keep track of deletes we've added

    for (const prData of Object.values(potentialPRs)) {
      // 1. Add the Upsert operation for the correct PR
      bulkOps.push({
        updateOne: {
          filter: {
            // <<< FIX: Use userObjectId >>>
            userId: userObjectId,
            exerciseId: prData.exerciseId,
            unit: prData.unit // Filter by the correct unit ('kg' or 'reps')
          },
          update: { $set: prData },
          upsert: true
        }
      });

      // 2. Determine the unit to delete (the opposite of the correct one)
      const unitToDelete = prData.unit === 'kg' ? 'reps' : 'kg';
      const deleteKey = `${prData.exerciseId?.toString()}_${unitToDelete}`; // Unique key for this delete op

      // 3. Add the Delete operation *only if we haven't already added it*
      //    This prevents adding duplicate delete operations if both kg and reps were potential PRs
      //    for the same exercise in the same run (which shouldn't happen with current logic, but safety first)
      if (!processedDeleteKeys.has(deleteKey)) {
        bulkOps.push({
          deleteOne: {
            filter: {
              // <<< FIX: Use userObjectId >>>
              userId: userObjectId,
              exerciseId: prData.exerciseId,
              unit: unitToDelete // Filter by the unit we want to remove
            }
          }
        });
        processedDeleteKeys.add(deleteKey); // Mark this delete operation as added
        console.log(`[updateExercisePRs] Staging delete for exercise ${prData.exerciseName} (${prData.exerciseId}), unit: ${unitToDelete}`);
      }
    }
    // --- End Prepare Bulk Operations ---


    // Batch update/insert/delete PRs from the staged potentialPRs
    // const bulkOps = Object.values(potentialPRs).map(prData => ({ // <-- REMOVE OLD MAPPING
    //   updateOne: { // <-- REMOVE OLD MAPPING
    //     filter: { // <-- REMOVE OLD MAPPING
    //       userId: prData.userId, // <-- REMOVE OLD MAPPING
    //       exerciseId: prData.exerciseId, // <-- REMOVE OLD MAPPING
    //       unit: prData.unit // Compound key includes unit // <-- REMOVE OLD MAPPING
    //     }, // <-- REMOVE OLD MAPPING
    //     update: { $set: prData }, // Set the entire staged PR data // <-- REMOVE OLD MAPPING
    //     upsert: true // <-- REMOVE OLD MAPPING
    //   } // <-- REMOVE OLD MAPPING
    // })); // <-- REMOVE OLD MAPPING

    if (bulkOps.length > 0) {
      console.log(`[updateExercisePRs] Performing ${bulkOps.length} bulk PR operations (upserts/deletes) for user ${userId}...`);
      const result = await ExercisePRModel.bulkWrite(bulkOps);
      console.log(`[updateExercisePRs] Bulk write result:`, JSON.stringify(result));
      // Log counts for upserts, modifications, and deletions
      const upsertedCount = result.upsertedCount || 0;
      const modifiedCount = result.modifiedCount || 0;
      const deletedCount = result.deletedCount || 0;
      console.log(`[updateExercisePRs] PR Counts - Upserted: ${upsertedCount}, Modified: ${modifiedCount}, Deleted: ${deletedCount}`);
    } else {
      console.log(`[updateExercisePRs] No new potential PRs identified for user ${userId}.`);
    }

  } catch (error) {
    console.error(`[updateExercisePRs] Error processing exercise PRs for user ${userId}:`, error);
    // Decide on error handling: re-throw, log, or return status
  }
}
// --- END NEW FUNCTION ---

// Define the specific return type for the dashboard PRs
export type DashboardPREntry = { // <-- Added export
  _id: string;
  exerciseName: string;
  value: number;
  unit: string;
  date: string; // ISO string date
  workoutId: string | null;
};

// Add the WorkoutUpdatePayload type
export type WorkoutUpdatePayload = {
  name?: string;
  date?: Date | string;
  type?: string;
  duration?: number;
  distance?: number;
  notes?: string;
  intensity?: string;
  completed?: boolean;
  completedAt?: Date | string;
  source?: WorkoutData['source']; // <-- Changed from string to use WorkoutData type
  cardioDetails?: {
    distance?: number;
    duration?: number;
    pace?: number;
  };
  exercises?: Array<{
    id?: string;
    name: string;
    notes?: string;
    sets?: InputSetData[];
    duration?: number;
    distance?: number;
    exerciseId?: string;
  }>;
};

/**
 * Fetches a *random sample* of exercise PRs for the dashboard.
 */
// Update default limit to 4
export async function fetchDashboardExercisePRs(limit = 4): Promise<DashboardPREntry[]> { 
  console.log(`[fetchDashboardExercisePRs] Fetching ${limit} random PRs...`);
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      console.warn("[fetchDashboardExercisePRs] User not authenticated.");
      return [];
    }
    const userId = user.id;

    await dbConnect();

    // Use aggregation with $sample instead of sort/limit
    const prs = await ExercisePRModel.aggregate([
      { $match: { userId: new Types.ObjectId(userId) } }, // Match the user
      { $sample: { size: limit } }, // Randomly sample 'limit' documents
      {
        // Project only the necessary fields
        $project: {
          _id: 1, // Need _id for serialization
          exerciseName: 1,
          value: 1,
          unit: 1,
          date: 1,
          workoutId: 1,
        }
      }
    ]).exec(); 

    // Aggregation returns plain JS objects. Need to handle potential missing fields.
    const serializedPRs: DashboardPREntry[] = prs.map((pr: any) => { // Use any for initial mapping flexibility
       // Perform runtime checks for required fields before creating the object
       if (!pr?._id || !pr?.exerciseName || pr?.value === undefined || !pr?.unit || !pr?.date || !(pr.date instanceof Date)) {
           console.warn("[fetchDashboardExercisePRs] Skipping aggregated PR due to missing/invalid fields:", pr);
           return null; // Mark as invalid
       }
       // Construct the final object safely
       return {
         _id: pr._id.toString(), // Safe to call toString() if _id exists
         exerciseName: pr.exerciseName,
         value: pr.value,
         unit: pr.unit,
         date: pr.date.toISOString(), // Safe to call if date is a valid Date object
         workoutId: pr?.workoutId?.toString() ?? null, // Safely handle optional workoutId
       };
     }).filter((pr): pr is DashboardPREntry => pr !== null); // Type predicate to filter out nulls

    console.log(`[fetchDashboardExercisePRs] Found and serialized ${serializedPRs.length} random PRs.`);
    return serializedPRs; // This now correctly returns DashboardPREntry[]

  } catch (error) {
    console.error("[fetchDashboardExercisePRs] Error fetching PRs:", error);
    return []; 
  }
}

// NEW: Fetch recently performed unique exercises
export async function getRecentPerformedExercisesAction(): Promise<any[]> { // Return type any[] for now, can be refined to ExerciseData[] if type is imported/defined
  try {
    const user = await getCurrentUser();
    if (!user || !user.id) {
      console.warn("[PerfEx Action] User not authenticated.");
      return []; 
    }
    const userId = user.id;
    const limit = 20; // Number of recent workouts to check

    console.log(`[PerfEx Action] Fetching last ${limit} workouts for user ${userId}...`);

    // 1. Fetch IDs of recent workouts
    const recentWorkoutDocs = await WorkoutModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ date: -1 })
      .limit(limit)
      .select('_id') // Select only the IDs
      .lean();

    if (!recentWorkoutDocs || recentWorkoutDocs.length === 0) {
      console.log("[PerfEx Action] No recent workouts found for user.");
      return [];
    }

    const recentWorkoutIds = recentWorkoutDocs.map(doc => doc._id);
    console.log(`[PerfEx Action] Found ${recentWorkoutIds.length} recent workout IDs:`, recentWorkoutIds.map(id => id?.toString() || ''));

    // 2. Fetch WorkoutExercises associated with these workouts and populate their exerciseId
    const workoutExercises = await WorkoutExerciseModel
        .find({ workoutId: { $in: recentWorkoutIds } })
        .populate<{ exerciseId: IExercise & { _id: Types.ObjectId }}>({ // Populate the exercise details
            path: 'exerciseId',
            model: ExerciseModel
        })
        .lean();

    if (!workoutExercises || workoutExercises.length === 0) {
        console.log("[PerfEx Action] No workout exercises found for the recent workouts.");
        return [];
    }
    console.log(`[PerfEx Action] Found ${workoutExercises.length} workout exercise entries. First few:`, JSON.stringify(workoutExercises.slice(0, 3), null, 2)); // Log first few raw entries

    const uniqueExercisesMap = new Map<string, any>();

    // 3. Iterate through the fetched WorkoutExercises
    for (const workoutExRaw of workoutExercises) {
        const workoutEx = workoutExRaw as unknown as PopulatedWorkoutExerciseLean;
        const exerciseData = workoutEx.exerciseId; 
        const hasValidExerciseData = exerciseData && typeof exerciseData === 'object' && exerciseData._id;

        if (hasValidExerciseData) {
            const exerciseIdString = exerciseData._id.toString();
            if (!uniqueExercisesMap.has(exerciseIdString)) {
                // Log the exercise being added
                console.log(`[PerfEx Action] Adding unique exercise: ${exerciseData.name} (ID: ${exerciseIdString})`);
                uniqueExercisesMap.set(exerciseIdString, deepSerialize(exerciseData)); 
            }
        } else {
            // Log skipped entries for debugging
            console.log(`[PerfEx Action] Skipping workoutEx ${workoutEx._id} due to invalid/missing exerciseData. Raw exerciseId:`, workoutEx.exerciseId);
        }
    }

    const uniqueExercisesArray = Array.from(uniqueExercisesMap.values());
    console.log(`[PerfEx Action] Returning ${uniqueExercisesArray.length} unique performed exercises.`);

    return uniqueExercisesArray;

  } catch (error) {
    console.error("[PerfEx Action] Error fetching recent performed exercises:", error);
    return []; // Return empty array on error
  }
}

// Function to update a user's workouts array (Restored)
async function updateUserWorkouts(userId: string, workoutId: Types.ObjectId): Promise<void> {
  try {
    // Example: Re-calculate user's overall workout summary or specific exercise PRs
    // This would involve fetching relevant data and updating summary documents or PR records.
    console.log(`[updateUserWorkouts] Placeholder: Updating summaries/PRs for user ${userId} after workout ${workoutId.toString()}`);
    
    // Example: Trigger an update for the user's overall performance summary
    // await updateUserPerformanceSummary(userId.toString());

    // Example: Trigger an update for exercise PRs affected by this workout
    // await updateExercisePRs(userId.toString(), workoutId.toString());

  } catch (error) {
    console.error(`[updateUserWorkouts] Error updating user workouts for user ${userId} and workout ${workoutId.toString()}:`, error);
    // Decide on error handling strategy (e.g., log, retry, notify)
  }
}

export async function deleteWorkout(id: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user?.id) {
    console.error("[deleteWorkout] User not authenticated.");
    return false;
  }

  try {
    const result = await deleteWorkoutDb(id);
    revalidatePath('/workouts');
    revalidatePath('/planner');
    return result;
  } catch (error) {
    console.error("[deleteWorkout] Error deleting workout:", error);
    return false;
  }
}

export async function markWorkoutComplete(id: string, data: { duration?: number } = {}): Promise<{ success: boolean; workout?: any; error?: string }> {
  const user = await getCurrentUser();
  if (!user?.id) {
    console.error("[markWorkoutComplete] User not authenticated.");
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const workout = await updateWorkoutDb(id, {
      completed: true,
      completedAt: new Date(),
      ...(data.duration ? { duration: data.duration } : {}),
    });

    if (!workout) {
      return { success: false, error: 'Workout not found' };
    }

    revalidatePath('/workouts');
    revalidatePath('/planner');
    return { success: true, workout };
  } catch (error) {
    console.error("[markWorkoutComplete] Error marking workout complete:", error);
    return { success: false, error: 'Failed to complete workout' };
  }
}

export async function createWorkoutFromExisting(workoutData: Partial<WorkoutData>): Promise<string> {
  const user = await getCurrentUser();
  if (!user?.id) {
    console.error("[createWorkoutFromExisting] User not authenticated.");
    throw new Error('Not authenticated');
  }

  try {
    // Create a new workout based on the existing one
    const { _id, createdAt, updatedAt, completedAt, completed, ...restWorkoutData } = workoutData;
    const newWorkout = await createWorkout({
      ...restWorkoutData,
      date: new Date(), // Always use current date
    });

    if (!newWorkout?._id) {
      throw new Error('Failed to create new workout');
    }

    revalidatePath('/workouts');
    revalidatePath('/planner');
    return newWorkout._id.toString();
  } catch (error) {
    console.error("[createWorkoutFromExisting] Error creating workout:", error);
    throw error;
  }
}

export async function updateWorkoutAction(id: string, workoutData: Partial<WorkoutData>): Promise<WorkoutData | null> {
  const user = await getCurrentUser();
  if (!user?.id) {
    console.error("[updateWorkoutAction] User not authenticated.");
    throw new Error('Not authenticated');
  }

  try {
    const updatedWorkout = await updateWorkoutDb(id, workoutData);
    if (!updatedWorkout) {
      throw new Error('Failed to update workout');
    }

    revalidatePath('/workouts');
    revalidatePath('/planner');
    return updatedWorkout;
  } catch (error) {
    console.error("[updateWorkoutAction] Error updating workout:", error);
    throw error;
  }
}

export async function fetchWorkoutForAI(id: string): Promise<WorkoutDataForAI | null> {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) {
    console.error("[fetchWorkoutForAI] Invalid or missing ID provided.");
    return null;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    console.warn("[fetchWorkoutForAI] User not authenticated.");
    return null;
  }
  const userId = new mongoose.Types.ObjectId(session.user.id);

  console.log(`[fetchWorkoutForAI] Fetching workout ${id} for user ${userId}`);

  try {
    await dbConnect();

    // 1. Fetch the target workout with populated lean details
    const targetWorkout = await WorkoutModel.findOne({ _id: new mongoose.Types.ObjectId(id), userId })
      .populate<{
        workoutExercises: Array<
          Omit<IWorkoutExercise, 'exerciseId' | 'sets'> & {
            exerciseId: LeanExercise | null; // Defined in this file
            sets: LeanSet[]; // Defined in this file
          }
        >;
      }>({
        path: "workoutExercises",
        populate: [
          { path: "exerciseId", model: ExerciseModel, select: "name category equipment trackMaxReps" },
          { path: "sets", model: SetModel, select: "weight reps duration distance notes order" }
        ],
      })
      .lean<LeanWorkout>() // LeanWorkout is defined in this file
      .exec();

    if (!targetWorkout) {
      console.warn(`[fetchWorkoutForAI] Workout ${id} not found for user ${userId}.`);
      return null;
    }

    console.log(`[fetchWorkoutForAI] Target workout fetched. Name: ${targetWorkout.name}, Type: ${targetWorkout.type}`);

    const workoutDataForAIReturn: Partial<WorkoutDataForAI> = {
      ...(targetWorkout as any), // Cast to any to allow spreading LeanWorkout
      _id: targetWorkout._id.toString(),
      userId: targetWorkout.userId.toString(),
      date: targetWorkout.date ? format(new Date(targetWorkout.date), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : new Date().toISOString(),
      // Ensure workoutExercises and their nested fields are correctly typed and serialized
      workoutExercises: targetWorkout.workoutExercises?.map(we => {
        const exerciseIdObj = we.exerciseId ? {
          ...(we.exerciseId as any), // Spread LeanExercise
          _id: we.exerciseId._id.toString(),
          // Ensure all fields expected by WorkoutExerciseData['exerciseId'] are present
          category: we.exerciseId.category || 'other', // Provide default if missing from LeanExercise
        } : undefined;

        return {
          ...(we as any), // Spread LeanWorkoutExercise
          _id: we._id.toString(),
          workoutId: we.workoutId.toString(), // This should be targetWorkout._id.toString() or similar
          exerciseId: exerciseIdObj as WorkoutExerciseData['exerciseId'], // Assert type
          sets: we.sets?.map(s => ({
            ...(s as any), // Spread LeanSet
            _id: s._id.toString(),
            // Ensure all fields expected by SetData are present
            weight: s.weight || 0, // Provide default
            reps: s.reps || 0, // Provide default
            order: s.order || 0, // Provide default
            workoutExerciseId: we._id.toString() // Link back to parent
          } as SetData)) // Assert type for each set
        } as WorkoutExerciseData; // Assert type for each workoutExercise
      }),
      previousWorkouts: [],
      progressMetrics: {}
    };
    
    // Ensure `source` is valid if it exists on targetWorkout
    if (targetWorkout.source && !['manual', 'garmin', 'coros', 'strava', 'apple', 'ai', ''].includes(targetWorkout.source)) {
        delete (workoutDataForAIReturn as any).source; // Remove if invalid
    }


    const previousWorkoutsRaw = await getPreviousWorkoutsByType(
      userId.toString(),
      targetWorkout.type || "",
      new Date(targetWorkout.date || Date.now()),
      targetWorkout._id.toString(), // Corrected: currentWorkoutId (string)
      5                             // Corrected: limit (number)
    );
    
    console.log(`[fetchWorkoutForAI] Fetched ${previousWorkoutsRaw.length} previous workouts of type ${targetWorkout.type}`);

    workoutDataForAIReturn.previousWorkouts = previousWorkoutsRaw.map(pw => {
      // Ensure the mapped object conforms to Partial<WorkoutData>
      // pw should be of type WorkoutData (or at least its properties that are used)
      const mappedPw: Partial<WorkoutData> = {
        _id: pw._id, // pw._id is already a string as per WorkoutData type
        userId: pw.userId, // pw.userId is already a string as per WorkoutData type
        name: pw.name,
        type: pw.type,
        date: pw.date ? format(new Date(pw.date), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined,
        duration: pw.duration,
        distance: pw.distance,
        calculatedVolume: pw.calculatedVolume,
        cardioDetails: pw.cardioDetails ? {
          pace: pw.cardioDetails.pace,
        } : undefined,
        completed: pw.completed, // Uncommented
        completedAt: pw.completedAt ? format(new Date(pw.completedAt), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") : undefined, // Uncommented and formatted
      };
      // Validate source for previous workouts as well
      if (pw.source && !['manual', 'garmin', 'coros', 'strava', 'apple', 'ai', ''].includes(pw.source)) {
        // Don't include invalid source
      } else if (pw.source) {
        mappedPw.source = pw.source as WorkoutData['source'];
      }
      return mappedPw;
    });

    if (workoutDataForAIReturn.previousWorkouts && workoutDataForAIReturn.previousWorkouts.length > 0) {
      const prevDurations = workoutDataForAIReturn.previousWorkouts.map(pw => pw.duration).filter(d => d !== undefined) as number[];
      const avgPrevDuration = prevDurations.length > 0 ? prevDurations.reduce((a, b) => a + b, 0) / prevDurations.length : 0;
      
      const prevDistances = workoutDataForAIReturn.previousWorkouts.map(pw => pw.distance).filter(d => d !== undefined) as number[];
      const avgPrevDistance = prevDistances.length > 0 ? prevDistances.reduce((a, b) => a + b, 0) / prevDistances.length : 0;

      workoutDataForAIReturn.progressMetrics = {
        vsAverageDuration: workoutDataForAIReturn.duration && avgPrevDuration > 0 ? workoutDataForAIReturn.duration - avgPrevDuration : undefined,
        vsAverageDistance: workoutDataForAIReturn.distance && avgPrevDistance > 0 ? workoutDataForAIReturn.distance - avgPrevDistance : undefined,
      };
      console.log(`[fetchWorkoutForAI] Calculated progress metrics:`, workoutDataForAIReturn.progressMetrics);
    }

    console.log(`[fetchWorkoutForAI] Successfully prepared data for workout ${id}.`);
    // Perform a final cast to WorkoutDataForAI after all augmentations
    return workoutDataForAIReturn as WorkoutDataForAI;

  } catch (error) {
    console.error(`[fetchWorkoutForAI] Error fetching workout details for AI (ID: ${id}):`, error);
    return null;
  }
}
    