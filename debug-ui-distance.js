#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function debugUIDistance() {
  console.log('🔍 Debugging UI distance display issue...\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('aivery_db');
  
  try {
    // Check workouts from May 28th and May 30th 2025 (the problematic dates)
    const problematicDates = [
      new Date('2025-05-28T00:00:00.000Z'),
      new Date('2025-05-29T00:00:00.000Z'), 
      new Date('2025-05-30T00:00:00.000Z'),
      new Date('2025-05-31T00:00:00.000Z')
    ];
    
    for (const targetDate of problematicDates) {
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      console.log(`📅 Checking workouts on ${targetDate.toDateString()}:`);
      
      const workouts = await db.collection('workouts').find({
        date: {
          $gte: targetDate,
          $lt: nextDay
        }
      }).sort({ date: 1 }).toArray();
      
      if (workouts.length === 0) {
        console.log('  ❌ No workouts found');
        continue;
      }
      
      console.log(`  ✅ Found ${workouts.length} workout(s):`);
      
      for (const workout of workouts) {
        console.log(`\n  🏃‍♂️ "${workout.name}" (${workout.type})`);
        console.log(`    Database distance: ${workout.distance}`);
        console.log(`    cardioDetails.distance: ${workout.cardioDetails?.distance}`);
        
        // Apply the same logic as the frontend
        let distanceInKm = 0;
        if (workout.cardioDetails?.distance) {
          // cardioDetails.distance is already in km
          distanceInKm = workout.cardioDetails.distance;
          console.log(`    ⚙️  Using cardioDetails.distance: ${distanceInKm} km`);
        } else if (workout.distance) {
          // If distance is large (> 100), assume it's in meters and convert to km
          const beforeConversion = workout.distance;
          distanceInKm = workout.distance > 100 ? workout.distance / 1000 : workout.distance;
          console.log(`    ⚙️  Converting from ${beforeConversion} -> ${distanceInKm} km (${beforeConversion > 100 ? 'meters->km' : 'already km'})`);
        }
        
        // Apply formatDistance logic
        let formattedDistance;
        if (isNaN(distanceInKm) || distanceInKm < 0) {
          formattedDistance = "0.0 km";
        } else if (distanceInKm > 10000) {
          formattedDistance = "Error: Invalid distance";
        } else if (distanceInKm > 1000) {
          formattedDistance = `${distanceInKm.toFixed(1)} km`;
        } else if (distanceInKm < 0.01) {
          formattedDistance = "0.0 km";
        } else {
          formattedDistance = `${distanceInKm.toFixed(1)} km`;
        }
        
        console.log(`    🎯 Final UI display should be: "${formattedDistance}"`);
        
        // If this is way off, there might be another issue
        if (distanceInKm > 100) {
          console.log(`    🚨 ISSUE: This would display as ${distanceInKm.toFixed(1)} km which is unrealistic!`);
          
          // Check if the distance field is somehow wrong
          if (workout.distance && workout.distance > 50000) {
            console.log(`    💡 POTENTIAL FIX: distance field (${workout.distance}) seems to be in meters but very large`);
            console.log(`       Should probably be: ${(workout.distance / 1000).toFixed(2)} km`);
          }
        }
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

debugUIDistance().catch(console.error); 