import dotenv from 'dotenv';
// Load environment variables from .env.local file
dotenv.config({ path: './.env.local' });

import mongoose from 'mongoose';
import dbConnect from '@/lib/db/mongoose'; // Adjust path as necessary
import ExerciseModel from '@/lib/db/models/exercise'; // Adjust path as necessary

async function backfillExerciseFlags() {
  console.log('Connecting to database...');
  await dbConnect();
  console.log('Database connected.');

  try {
    console.log('Fetching all exercises...');
    const exercises = await ExerciseModel.find({});
    console.log(`Found ${exercises.length} exercises to process.`);

    let updatedCount = 0;
    const bulkOps = [];

    for (const exercise of exercises) {
      let shouldTrackMaxReps = false;
      if (Array.isArray(exercise.equipment)) {
        // Check if 'bodyweight' exists in equipment array (case-insensitive)
        shouldTrackMaxReps = exercise.equipment.some(
          (equip: any) => typeof equip === 'string' && equip.toLowerCase().trim() === 'bodyweight'
        );
      }

      // Only update if the flag needs to be set and isn't already set
      // Or if it needs to be unset (e.g., if 'bodyweight' was removed)
      if (exercise.trackMaxReps !== shouldTrackMaxReps) {
        bulkOps.push({
          updateOne: {
            filter: { _id: exercise._id },
            update: { $set: { trackMaxReps: shouldTrackMaxReps } },
          },
        });
        updatedCount++;
      }
    }

    if (bulkOps.length > 0) {
      console.log(`Applying updates to ${updatedCount} exercises...`);
      const result = await ExerciseModel.bulkWrite(bulkOps);
      console.log('Bulk write result:', result);
      console.log(`Successfully updated trackMaxReps flag for ${result.modifiedCount} exercises.`);
    } else {
      console.log('No exercises required updating for the trackMaxReps flag.');
    }

  } catch (error) {
    console.error('Error during backfill operation:', error);
  } finally {
    console.log('Closing database connection...');
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

backfillExerciseFlags(); 