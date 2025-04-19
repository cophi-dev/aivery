import mongoose from 'mongoose';
import dbConnect from '../src/lib/db/mongodb'; // Adjust path as needed
import ExerciseModel from '../src/lib/db/models/exercise'; // Corrected casing
import { fetchExerciseDetailsFromApi } from '../src/lib/exercise-db-api'; // Adjust path as needed

// Configuration
const API_DELAY_MS = 500; // Delay between API calls to be polite
const BATCH_SIZE = 10; // Process exercises in batches

// Utility function for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function populateExerciseDetails() {
  console.log('Connecting to database...');
  await dbConnect();
  console.log('Database connected.');

  let updatedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let processedCount = 0;
  let page = 0;

  console.log('Starting exercise details population...');

  try {
    while (true) {
      console.log(`Fetching batch ${page + 1}...`);
      // Find exercises missing either apiDescription or apiGifUrl
      const exercises = await ExerciseModel.find({
        $or: [
          { apiDescription: { $exists: false } }, 
          { apiDescription: null }, 
          { apiDescription: '' }, 
          { apiGifUrl: { $exists: false } },
          { apiGifUrl: null },
          { apiGifUrl: '' }
        ]
      })
      .limit(BATCH_SIZE)
      .skip(page * BATCH_SIZE)
      .lean(); // Use lean for performance if we only read fields

      if (exercises.length === 0) {
        console.log('No more exercises found needing population. Exiting loop.');
        break; // Exit loop if no more exercises found in the batch
      }

      console.log(`Processing ${exercises.length} exercises in this batch...`);

      for (const exercise of exercises) {
        processedCount++;
        console.log(`\nProcessing exercise ${processedCount}: ${exercise.name} (ID: ${exercise._id})`);

        // Simple check: if name is missing, skip
        if (!exercise.name) {
          console.warn(`  - Skipping exercise ID ${exercise._id} due to missing name.`);
          skippedCount++;
          continue;
        }

        try {
          // Fetch details from the external API
          console.log(`  - Calling ExerciseDB API for: ${exercise.name}`);
          const details = await fetchExerciseDetailsFromApi(exercise.name);

          if (details) {
            console.log(`  - API Success: Found details.`);
            // Update the exercise in the database
            await ExerciseModel.updateOne(
              { _id: exercise._id },
              {
                $set: {
                  apiDescription: details.description,
                  apiGifUrl: details.gifUrl,
                  // Explicitly set updatedAt to avoid relying solely on timestamps: true
                  // Mongoose might not automatically update if $set only contains existing values
                  updatedAt: new Date()
                }
              }
            );
            console.log(`  - DB Success: Updated exercise ID ${exercise._id} in the database.`);
            updatedCount++;
          } else {
            console.log(`  - API Info: No details found for ${exercise.name}. Skipping DB update.`);
            // Optionally, mark as processed but not updated if needed
            skippedCount++; 
          }
        } catch (apiError) {
          console.error(`  - API Error: Failed to fetch or update details for ${exercise.name} (ID: ${exercise._id}):`, apiError);
          failedCount++;
        }
        
        // Wait before the next API call
        console.log(`  - Waiting ${API_DELAY_MS}ms...`);
        await delay(API_DELAY_MS);
      }
      // Increment page for the next batch
      // Note: This simple pagination might re-process failures if they aren't marked.
      // A more robust approach might fetch specific IDs or mark failures.
      // For simplicity, we'll just move to the next potential batch.
      page++; 
      console.log(`Finished batch ${page}. Continuing to next batch...`);

    }

    console.log('\n--- Population Complete ---');
    console.log(`Total exercises processed: ${processedCount}`);
    console.log(`Successfully updated: ${updatedCount}`);
    console.log(`Skipped (no details found or missing name): ${skippedCount}`);
    console.log(`Failed (API/DB errors): ${failedCount}`);

  } catch (error) {
    console.error('\n--- Population Script Error ---');
    console.error('An unexpected error occurred during the population process:', error);
  } finally {
    // Ensure database connection is closed
    console.log('\nClosing database connection...');
    await mongoose.disconnect();
    console.log('Database connection closed.');
  }
}

// Run the script
populateExerciseDetails(); 