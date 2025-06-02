#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function fixAllDistanceIssues() {
  console.log('🔍 Finding ALL workouts with unrealistic distances...\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('aivery_db');
  
  try {
    // Find ALL running workouts with unrealistic distances (more than 50 km)
    // Most people don't run more than 50km in a single session
    const problematicWorkouts = await db.collection('workouts').find({
      type: 'running',
      distance: { $gt: 50000 } // More than 50 km (50,000 meters)
    }).sort({ date: -1 }).toArray();
    
    console.log(`🚨 Found ${problematicWorkouts.length} workout(s) with unrealistic distances:\n`);
    
    const fixes = [];
    
    for (const workout of problematicWorkouts) {
      console.log(`🏃‍♂️ "${workout.name}" (${workout.date.toDateString()})`);
      console.log(`  ID: ${workout._id}`);
      console.log(`  Current Distance: ${workout.distance} meters = ${(workout.distance / 1000).toFixed(1)} km`);
      console.log(`  Duration: ${workout.duration} seconds (${Math.floor(workout.duration / 60)}:${(workout.duration % 60).toString().padStart(2, '0')})`);
      console.log(`  Source: ${workout.source || 'manual'}`);
      
      // Determine the correct distance
      let correctedDistance;
      let reasoning;
      
      // If distance is stored as kilometers but should be meters
      // e.g., 8449.2 km should be 8449.2 meters = 8.4492 km
      if (workout.distance > 1000000) { // More than 1000 km
        correctedDistance = workout.distance / 1000; // Convert km to meters
        reasoning = `Likely stored as meters when should be meters (divided by 1000)`;
      } else if (workout.distance > 50000) { // Between 50-1000 km
        correctedDistance = workout.distance / 1000; // Convert km to meters
        reasoning = `Likely stored incorrectly as meters, should be ${(correctedDistance/1000).toFixed(2)} km`;
      } else {
        // Keep as is if it's reasonable
        continue;
      }
      
      // Calculate pace with corrected distance
      const correctedPace = workout.duration > 0 ? (workout.duration / 60) / (correctedDistance / 1000) : null;
      
      console.log(`  💡 Fix: ${correctedDistance} meters = ${(correctedDistance / 1000).toFixed(2)} km`);
      if (correctedPace) {
        console.log(`  💡 Corrected Pace: ${correctedPace.toFixed(2)} min/km`);
      }
      console.log(`  💡 Reasoning: ${reasoning}`);
      
      fixes.push({
        id: workout._id,
        oldDistance: workout.distance,
        newDistance: correctedDistance,
        newPace: correctedPace,
        workout: workout
      });
      
      console.log('');
    }
    
    // Apply fixes
    if (fixes.length > 0) {
      console.log(`\n🔧 Applying ${fixes.length} fix(es)...\n`);
      
      for (const fix of fixes) {
        const updateFields = {
          distance: fix.newDistance,
        };
        
        // Update cardio details if they exist
        if (fix.workout.cardioDetails) {
          updateFields.cardioDetails = {
            ...fix.workout.cardioDetails,
            distance: fix.newDistance,
            pace: fix.newPace || fix.workout.cardioDetails.pace
          };
        }
        
        const result = await db.collection('workouts').updateOne(
          { _id: fix.id },
          { $set: updateFields }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`✅ Fixed "${fix.workout.name}"`);
          console.log(`   ${(fix.oldDistance / 1000).toFixed(1)} km → ${(fix.newDistance / 1000).toFixed(2)} km`);
        } else {
          console.log(`❌ Failed to update workout ${fix.id}`);
        }
      }
      
      console.log(`\n🎉 Fixed ${fixes.length} workout(s) with distance issues!`);
      
    } else {
      console.log('✅ No workouts found that need fixing');
    }
    
    // Also check for any other suspicious distances
    console.log('\n🔍 Checking for other suspicious patterns...');
    
    const veryShortRuns = await db.collection('workouts').find({
      type: 'running',
      distance: { $lt: 100, $gt: 0 } // Less than 100 meters but more than 0
    }).toArray();
    
    if (veryShortRuns.length > 0) {
      console.log(`\n⚠️ Found ${veryShortRuns.length} runs with very short distances (might need review):`);
      for (const run of veryShortRuns) {
        console.log(`- "${run.name}": ${run.distance} meters on ${run.date.toDateString()}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

fixAllDistanceIssues().catch(console.error); 