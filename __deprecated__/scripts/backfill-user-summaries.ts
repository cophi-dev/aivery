// scripts/backfill-user-summaries.ts
import dotenv from 'dotenv';
// Load environment variables specifically from .env.local
dotenv.config({ path: '.env.local' }); 

// --- DEBUG --- 
console.log('Attempting to load MONGODB_URI from .env.local...');
console.log(`Value found for MONGODB_URI: ${process.env.MONGODB_URI ? '******' : 'Not Found'}`);
// --- END DEBUG ---

import mongoose from 'mongoose';
import dbConnect from '../src/lib/db/mongoose'; // Adjust path if needed
import UserModel from '../src/lib/db/models/user'; // Adjust path if needed
import { updateUserWorkoutSummaries } from '../src/lib/workout-actions'; // Adjust path if needed
import { Types } from 'mongoose';

async function runBackfill() {
  console.log('Starting user summary backfill script...');

  let connection;
  try {
    // 1. Connect to Database
    console.log('Connecting to database...');
    // Assuming dbConnect handles the connection setup
    connection = await dbConnect();
    console.log('Database connected successfully.');

    // 2. Fetch all User IDs
    console.log('Fetching all user IDs...');
    // Fetch only the _id field, use 'any' type due to persistent lean() typing issues
    const users: any[] = await UserModel.find({}, '_id').lean();
    const userCount = users.length;
    console.log(`Found ${userCount} users to process.`);

    if (userCount === 0) {
      console.log('No users found. Exiting.');
      return;
    }

    // 3. Iterate and update summaries
    let processedCount = 0;
    let errorCount = 0;

    for (const user of users) {
      // Runtime check and cast for _id
      const userId = user?._id;
      if (!(userId instanceof Types.ObjectId)) {
          console.warn(`Found user document with invalid or missing _id: ${userId}, skipping.`);
          processedCount++;
          continue;
      }
      
      // Now userId is confirmed as Types.ObjectId
      processedCount++;
      console.log(`\nProcessing user ${processedCount}/${userCount} (ID: ${userId.toString()})...`);

      try {
        // 4. Call the update function for each user
        await updateUserWorkoutSummaries(userId.toString());
        // Optional: Add a small delay if needed to avoid overwhelming resources
        // await new Promise(resolve => setTimeout(resolve, 50)); // e.g., 50ms delay
      } catch (error) {
        errorCount++;
        console.error(`--> ERROR processing user ${userId.toString()}:`, error instanceof Error ? error.message : error);
        // Continue to the next user even if one fails
      }
    }

    // 5. Log results
    console.log('\n-------------------------------------');
    console.log('Backfill script finished.');
    console.log(`Successfully processed: ${processedCount - errorCount}/${userCount}`);
    console.log(`Errors encountered: ${errorCount}`);
    console.log('-------------------------------------');

  } catch (scriptError) {
    console.error('\n!!! A critical error occurred during the backfill script execution:');
    console.error(scriptError);
    process.exitCode = 1; // Indicate failure
  } finally {
    // 6. Disconnect from Database
    if (mongoose.connection.readyState === 1) { // 1 = connected
      console.log('Disconnecting from database...');
      await mongoose.disconnect();
      console.log('Database disconnected.');
    } else {
      console.log('Database connection was not active, skipping disconnect.');
    }
  }
}

// Execute the script
runBackfill(); 