// scripts/backfill-workout-volumes.ts
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); // Load .env.local

import mongoose, { Types } from 'mongoose';
import dbConnect from '../src/lib/db/mongoose';
import UserModel from '../src/lib/db/models/user';
import WorkoutModel from '../src/lib/db/models/workout';
import WorkoutExerciseModel from '../src/lib/db/models/workoutExercise';
import ExerciseModel from '../src/lib/db/models/exercise'; // Needed for exercise name lookup
import { estimateBodyweightForExercise } from '../src/lib/utils'; // Import the estimator

// --- Duplicate Calculation Logic (Adapted from workout-actions.ts) ---
// We duplicate this here to avoid complex dependencies or exports for a one-time script.
function calculateVolumeInternal(
  exercises: Array<{ exerciseName?: string | null; sets?: Array<{ weight?: number; reps?: number }> | null }>,
  userWeight: number | null
): number {
  if (!exercises || !Array.isArray(exercises)) {
    return 0;
  }

  let totalVolume = 0;
  exercises.forEach(exercise => {
    const exerciseName = exercise?.exerciseName || '';
    if (!exerciseName) {
      // console.warn("[Volume Calc Internal] Skipping exercise due to missing name.");
      return; // Skip this exercise
    }

    if (exercise.sets && Array.isArray(exercise.sets)) {
      exercise.sets.forEach(set => {
        const reps = typeof set.reps === 'number' && set.reps > 0 ? set.reps : 0;
        if (reps === 0) return; // Skip sets with no reps

        // 1. Always get the estimated bodyweight contribution
        const estimatedWeight = estimateBodyweightForExercise(exerciseName, userWeight);

        // 2. Get the external weight added
        const externalWeight = typeof set.weight === 'number' && set.weight > 0 ? set.weight : 0;

        // 3. Determine the final weight for this set's volume
        let weightForVolume = estimatedWeight; // Start with bodyweight estimate
        if (externalWeight > 0) {
          weightForVolume += externalWeight; // Add external weight if present
        }

        // 4. Add to total volume (only if weightForVolume > 0)
        if (weightForVolume > 0) {
          totalVolume += weightForVolume * reps;
        }
      });
    }
  });
  return totalVolume;
}
// --- End Calculation Logic ---

async function runVolumeBackfill() {
  console.log('Starting workout volume backfill script...');

  try {
    // 1. Connect to DB
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connected.');

    // Ensure Exercise model is registered by referencing it
    ExerciseModel;
    WorkoutExerciseModel;
    WorkoutModel;
    UserModel;
    console.log('Ensured models are referenced.');

    // 2. Fetch User Weights
    console.log('Fetching user weights...');
    // Use 'any[]' due to lean() typing issues
    const users: any[] = await UserModel.find({}, '_id weight').lean();
    const userWeightMap = new Map<string, number | null>();
    users.forEach(u => {
      // Runtime check for _id
      const userId = u?._id;
      if (userId instanceof Types.ObjectId) {
        userWeightMap.set(userId.toString(), (typeof u.weight === 'number' && u.weight > 0) ? u.weight : null);
      } else {
        console.warn('Skipping user due to invalid or missing _id:', u);
      }
    });
    console.log(`Fetched weights for ${userWeightMap.size} users.`);

    // 3. Fetch Strength Workouts
    console.log('Fetching strength workouts...');
    // Use 'any[]' due to lean() typing issues
    const strengthWorkouts: any[] = await WorkoutModel.find(
      { type: 'strength' },
      '_id userId calculatedVolume' // Select necessary fields
    ).lean();
    const workoutCount = strengthWorkouts.length;
    console.log(`Found ${workoutCount} strength workouts.`);

    if (workoutCount === 0) {
      console.log('No strength workouts found. Exiting.');
      return;
    }

    const strengthWorkoutIds = strengthWorkouts.map(w => w._id);

    // 4. Fetch Workout Exercises for these workouts
    console.log('Fetching exercises for strength workouts...');
    // Populate exerciseId to get the name needed for bodyweight estimation
    const workoutExercises = await WorkoutExerciseModel.find({
      workoutId: { $in: strengthWorkoutIds }
    })
    .populate({ path: 'exerciseId', select: 'name' }) // Populate exercise name
    .lean();

    // Group exercises by workoutId for easier lookup
    const exercisesByWorkoutId = new Map<string, any[]>();
    workoutExercises.forEach((ex: any) => {
      const workoutIdStr = ex.workoutId.toString();
      if (!exercisesByWorkoutId.has(workoutIdStr)) {
        exercisesByWorkoutId.set(workoutIdStr, []);
      }
      exercisesByWorkoutId.get(workoutIdStr)?.push(ex);
    });
    console.log(`Fetched ${workoutExercises.length} exercise entries.`);

    // 5. Iterate, Calculate, and Prepare Updates
    console.log('Calculating new volumes and preparing updates...');
    const bulkUpdateOps: any[] = [];
    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    for (const workout of strengthWorkouts) {
      processedCount++;
      // Runtime check for _id and userId
      const workoutId = workout?._id;
      const userId = workout?.userId;
      if (!(workoutId instanceof Types.ObjectId) || !(userId instanceof Types.ObjectId)) {
          console.warn(`Skipping workout due to invalid/missing _id or userId:`, workout);
          continue;
      }
      
      const workoutIdStr = workoutId.toString();
      const userIdStr = userId.toString();
      const currentVolume = workout.calculatedVolume ?? 0;

      try {
        const userWeight = userWeightMap.get(userIdStr) ?? null; // Get weight, default null
        const exercisesForWorkout = exercisesByWorkoutId.get(workoutIdStr) || [];

        // Map exercises to the structure needed by calculateVolumeInternal
        const mappedExercises = exercisesForWorkout.map((ex: any) => ({
          // Ensure we get the name from the populated exerciseId
          exerciseName: ex.exerciseId?.name || null,
          sets: ex.sets
        }));

        const newVolume = calculateVolumeInternal(mappedExercises, userWeight);
        const roundedNewVolume = Math.round(newVolume); // Round to nearest integer

        // Compare rounded volumes to avoid unnecessary updates due to float precision
        if (roundedNewVolume !== Math.round(currentVolume)) {
          // console.log(`Workout ${workoutIdStr}: Volume changed ${currentVolume} -> ${roundedNewVolume}. Staging update.`);
          updatedCount++;
          bulkUpdateOps.push({
            updateOne: {
              filter: { _id: workoutId }, // Use ObjectId directly
              update: { $set: { calculatedVolume: roundedNewVolume } }
            }
          });
        } else {
           // console.log(`Workout ${workoutIdStr}: Volume unchanged (${currentVolume}). Skipping.`);
        }

        // Log progress occasionally
         if (processedCount % 100 === 0) {
             console.log(`Processed ${processedCount}/${workoutCount}...`);
         }

      } catch (calcError) {
        errorCount++;
        console.error(`--> ERROR calculating volume for workout ${workoutIdStr}:`, calcError instanceof Error ? calcError.message : calcError);
      }
    }

    // 6. Execute Bulk Update
    console.log(`\nExecuting ${bulkUpdateOps.length} volume updates...`);
    if (bulkUpdateOps.length > 0) {
      const bulkResult = await WorkoutModel.bulkWrite(bulkUpdateOps);
      console.log('Bulk update result:', bulkResult);
    } else {
      console.log('No volume updates were needed.');
    }

    // 7. Log Final Results
    console.log('\n-------------------------------------');
    console.log('Workout volume backfill finished.');
    console.log(`Total strength workouts processed: ${processedCount}`);
    console.log(`Workouts needing volume update: ${updatedCount}`);
    console.log(`Errors during calculation: ${errorCount}`);
    console.log('-------------------------------------');

  } catch (scriptError) {
    console.error('\n!!! A critical error occurred during the volume backfill script:');
    console.error(scriptError);
    process.exitCode = 1;
  } finally {
    // 8. Disconnect
    if (mongoose.connection.readyState === 1) {
      console.log('Disconnecting from database...');
      await mongoose.disconnect();
      console.log('Database disconnected.');
    }
  }
}

// Run the script
runVolumeBackfill(); 