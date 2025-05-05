// scripts/backfill-exercise-prs.ts
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' }); // Load environment variables from .env.local

import mongoose, { Types } from 'mongoose';
import dbConnect from '@/lib/db/mongoose';
import UserModel from '../src/lib/db/models/user';
// We need the actual function that updates PRs
import { updateExercisePRs } from '../src/lib/workout-actions';
// Import other models ONLY IF needed by updateExercisePRs indirectly (it shouldn't be)
// We also need ExercisePRModel to ensure its registration if Mongoose acts up
import ExercisePRModel from '../src/lib/db/models/exercisePR';

async function runExercisePRBackfill() {
  console.log('Starting exercise PR backfill script...');

  try {
    // 1. Connect to Database
    console.log('Connecting to database...');
    await dbConnect();
    console.log('Database connected successfully.');

    // Ensure models are referenced (belt-and-suspenders for Mongoose registration)
    UserModel;
    ExercisePRModel;
    // Add WorkoutModel, WorkoutExerciseModel if updateExercisePRs needs them implicitly
    // (It fetches them internally, so referencing here might not be strictly needed but doesn't hurt)
    (await import('../src/lib/db/models/workout')).default;
    (await import('../src/lib/db/models/workoutExercise')).default;
    console.log('Ensured models are referenced.');

    // 2. Fetch all User IDs
    console.log('Fetching all user IDs...');
    // Use 'any[]' due to potential lean() typing issues
    const users: any[] = await UserModel.find({}, '_id').lean();
    const userCount = users.length;
    console.log(`Found ${userCount} users to process.`);

    if (userCount === 0) {
      console.log('No users found. Exiting.');
      return;
    }

    // 3. Iterate and update PRs
    let processedCount = 0;
    let errorCount = 0; // Track errors during the PR update calls

    for (const user of users) {
      // Runtime check for _id
      const userIdObj = user?._id;
      if (!(userIdObj instanceof Types.ObjectId)) {
          console.warn(`Found user document with invalid or missing _id: ${userIdObj}, skipping.`);
          processedCount++; // Count as processed even if skipped
          continue;
      }
      const userIdStr = userIdObj.toString();
      processedCount++;
      console.log(`\nProcessing user ${processedCount}/${userCount} (ID: ${userIdStr})...`);

      try {
        // 4. Call the update function for each user (process ALL workouts)
        await updateExercisePRs(userIdStr);
        // Optional: Add delay
        // await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        errorCount++;
        console.error(`--> ERROR processing exercise PRs for user ${userIdStr}:`, error instanceof Error ? error.message : error);
        // Continue processing other users
      }
    }

    // 5. Log results
    console.log('\n-------------------------------------');
    console.log('Exercise PR backfill script finished.');
    console.log(`Users processed: ${processedCount}`);
    console.log(`Errors during processing: ${errorCount}`);
    console.log('-------------------------------------');

  } catch (scriptError) {
    console.error('\n!!! A critical error occurred during the Exercise PR backfill script:');
    console.error(scriptError);
    process.exitCode = 1; // Indicate failure
  } finally {
    // 6. Disconnect from Database
    if (mongoose.connection.readyState === 1) {
      console.log('Disconnecting from database...');
      await mongoose.disconnect();
      console.log('Database disconnected.');
    } else {
      console.log('Database connection was not active, skipping disconnect.');
    }
  }
}

// Execute the script
runExercisePRBackfill(); 