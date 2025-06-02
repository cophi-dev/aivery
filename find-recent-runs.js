#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function findRecentRuns() {
  console.log('🔍 Finding recent running workouts...\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('aivery_db');
  
  try {
    // Find all running workouts from the last month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const runningWorkouts = await db.collection('workouts').find({
      type: 'running',
      date: { $gte: oneMonthAgo }
    }).sort({ date: -1 }).toArray();
    
    console.log(`📊 Found ${runningWorkouts.length} running workouts in the last month:\n`);
    
    for (const workout of runningWorkouts) {
      console.log(`🏃‍♂️ "${workout.name}"`);
      console.log(`  📅 Date: ${workout.date.toISOString()}`);
      console.log(`  📍 Distance: ${workout.distance} (database field)`);
      console.log(`  📍 cardioDetails.distance: ${workout.cardioDetails?.distance}`);
      
      // Apply frontend conversion logic
      let distanceInKm = 0;
      if (workout.cardioDetails?.distance) {
        distanceInKm = workout.cardioDetails.distance;
      } else if (workout.distance) {
        distanceInKm = workout.distance > 100 ? workout.distance / 1000 : workout.distance;
      }
      
      console.log(`  🎯 UI would show: ${distanceInKm.toFixed(1)} km`);
      
      // Flag potentially problematic ones
      if (distanceInKm > 50) {
        console.log(`  🚨 PROBLEMATIC: This shows ${distanceInKm.toFixed(1)} km - unrealistic for a run!`);
      }
      
      console.log('');
    }
    
    // Also check for any workouts with names containing "Evening Run"
    console.log('\n🔍 Searching specifically for "Evening Run" workouts...');
    const eveningRuns = await db.collection('workouts').find({
      name: { $regex: /evening run/i }
    }).sort({ date: -1 }).toArray();
    
    if (eveningRuns.length > 0) {
      console.log(`Found ${eveningRuns.length} Evening Run workout(s):`);
      for (const run of eveningRuns) {
        console.log(`  - ${run.name}: ${run.date.toISOString()}, distance: ${run.distance}`);
      }
    } else {
      console.log('No "Evening Run" workouts found.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

findRecentRuns().catch(console.error); 