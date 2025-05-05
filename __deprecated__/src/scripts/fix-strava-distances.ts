// Script to fix distances for existing Strava workouts
// This corrects workouts that were imported with distances 1000x smaller than they should be

import { getCollection } from "@/lib/db/mongodb";
import { ObjectId } from "mongodb";
import dbConnect from "@/lib/db/mongoose";
import { revalidatePath } from "next/cache";

async function fixStravaDistances() {
  console.log("Starting Strava distance fix script...");
  
  try {
    // Connect to database
    console.log("Connecting to database...");
    await dbConnect();
    console.log("Database connected");
    
    // Get workouts collection
    const workoutsCollection = await getCollection("workouts");
    
    // Find all workouts with source="strava" and very small distances
    const workouts = await workoutsCollection.find({
      source: "strava",
      distance: { $lt: 1 } // Likely incorrect distances (too small)
    }).toArray();
    
    console.log(`Found ${workouts.length} Strava workouts with potentially incorrect distances`);
    
    let updatedCount = 0;
    
    // Process each workout
    for (const workout of workouts) {
      // Original distance is likely 1000x smaller than it should be
      // Only multiply if the distance is very small (less than 1 km)
      const originalDistance = workout.distance || 0;
      const newDistance = originalDistance * 1000;
      
      console.log(`Workout ID: ${workout._id}`);
      console.log(`  Original distance: ${originalDistance} km`);
      console.log(`  Updated distance: ${newDistance} km`);
      
      // Update the workout with the corrected distance
      await workoutsCollection.updateOne(
        { _id: workout._id },
        { 
          $set: {
            distance: newDistance,
            updatedAt: new Date()
          }
        }
      );
      
      updatedCount++;
    }
    
    console.log(`Successfully updated ${updatedCount} workouts`);
    
    // Revalidate paths to refresh the UI
    revalidatePath("/calendar");
    revalidatePath("/activity");
    revalidatePath("/dashboard");
    
    console.log("Fix completed successfully");
    
  } catch (error) {
    console.error("Error fixing Strava distances:", error);
  }
}

// Run the script
fixStravaDistances()
  .then(() => console.log("Script execution completed"))
  .catch(error => console.error("Script execution failed:", error)); 