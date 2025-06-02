#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function fixSpecificWorkout() {
  console.log('🔍 Investigating problematic workout from May 30, 2025...\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('aivery_db');
  
  try {
    // Find workouts from May 30, 2025 with unrealistic distances
    const workouts = await db.collection('workouts').find({
      date: {
        $gte: new Date('2025-05-30T00:00:00.000Z'),
        $lt: new Date('2025-05-31T00:00:00.000Z')
      },
      type: 'running',
      distance: { $gt: 1000 } // More than 1000 km is unrealistic
    }).toArray();
    
    console.log(`Found ${workouts.length} problematic workout(s) on May 30, 2025:`);
    
    for (const workout of workouts) {
      console.log(`\n🏃‍♂️ Workout: ${workout.name}`);
      console.log(`  ID: ${workout._id}`);
      console.log(`  Current Distance: ${workout.distance} meters (${(workout.distance / 1000).toFixed(1)} km)`);
      console.log(`  Duration: ${workout.duration} seconds (${Math.floor(workout.duration / 60)}:${(workout.duration % 60).toString().padStart(2, '0')})`);
      console.log(`  Source: ${workout.source}`);
      console.log(`  Date: ${workout.date}`);
      
      // Calculate what the distance should probably be
      // If it's showing 8449.2 km, it should probably be 8.4492 km (8449.2 meters)
      const correctedDistance = workout.distance / 1000; // Convert from km to meters
      const correctedPace = workout.duration > 0 ? (workout.duration / 60) / (correctedDistance / 1000) : null;
      
      console.log(`\n💡 Suggested fix:`);
      console.log(`  Corrected Distance: ${correctedDistance} meters (${(correctedDistance / 1000).toFixed(2)} km)`);
      if (correctedPace) {
        console.log(`  Corrected Pace: ${correctedPace.toFixed(2)} min/km`);
      }
      
      // Apply the fix
      console.log(`\n🔧 Applying fix...`);
      
      const updateFields = {
        distance: correctedDistance,
      };
      
      // Update cardio details if they exist
      if (workout.cardioDetails) {
        updateFields.cardioDetails = {
          ...workout.cardioDetails,
          distance: correctedDistance,
          pace: correctedPace || workout.cardioDetails.pace
        };
      }
      
      const result = await db.collection('workouts').updateOne(
        { _id: workout._id },
        { $set: updateFields }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`✅ Fixed workout ${workout._id}`);
        console.log(`  New distance: ${correctedDistance} meters (${(correctedDistance / 1000).toFixed(2)} km)`);
      } else {
        console.log(`❌ Failed to update workout ${workout._id}`);
      }
    }
    
    if (workouts.length === 0) {
      console.log('✅ No problematic workouts found on May 30, 2025');
      
      // Let's also check for any workouts with distance > 100 km in the last week
      console.log('\n🔍 Checking for any other unrealistic distances in recent workouts...');
      
      const recentProblematic = await db.collection('workouts').find({
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        type: 'running',
        distance: { $gt: 100000 } // More than 100 km
      }).toArray();
      
      if (recentProblematic.length > 0) {
        console.log(`Found ${recentProblematic.length} recent workout(s) with unrealistic distances:`);
        for (const workout of recentProblematic) {
          console.log(`- ${workout.name}: ${(workout.distance / 1000).toFixed(1)} km on ${workout.date.toDateString()}`);
        }
      } else {
        console.log('✅ No other recent workouts with unrealistic distances found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixSpecificWorkout().catch(console.error); 