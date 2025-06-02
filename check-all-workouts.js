#!/usr/bin/env node

const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function checkAllWorkouts() {
  console.log('🔍 Checking all workouts in database...\n');
  
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db('aivery_db');
  
  try {
    // Get total count
    const totalCount = await db.collection('workouts').countDocuments();
    console.log(`📊 Total workouts in database: ${totalCount}\n`);
    
    if (totalCount === 0) {
      console.log('❌ No workouts found in database');
      return;
    }
    
    // Get the most recent 20 workouts
    const recentWorkouts = await db.collection('workouts').find({})
      .sort({ date: -1 })
      .limit(20)
      .toArray();
    
    console.log('📅 Most recent 20 workouts:');
    for (const workout of recentWorkouts) {
      const distance = workout.distance || workout.cardioDetails?.distance || 0;
      console.log(`  ${workout.date.toISOString().split('T')[0]} | ${workout.type.padEnd(8)} | "${workout.name}" | ${distance}`);
    }
    
    console.log('\n🏃‍♂️ Checking for any workouts with high distance values...');
    const highDistanceWorkouts = await db.collection('workouts').find({
      $or: [
        { distance: { $gt: 100 } },
        { 'cardioDetails.distance': { $gt: 100 } }
      ]
    }).sort({ date: -1 }).toArray();
    
    if (highDistanceWorkouts.length > 0) {
      console.log(`Found ${highDistanceWorkouts.length} workout(s) with distance > 100:`);
      for (const workout of highDistanceWorkouts) {
        console.log(`  📍 "${workout.name}" (${workout.type})`);
        console.log(`     Date: ${workout.date.toISOString()}`);
        console.log(`     distance: ${workout.distance}`);
        console.log(`     cardioDetails.distance: ${workout.cardioDetails?.distance}`);
        
        // Calculate what UI would show
        let distanceInKm = 0;
        if (workout.cardioDetails?.distance) {
          distanceInKm = workout.cardioDetails.distance;
        } else if (workout.distance) {
          distanceInKm = workout.distance > 100 ? workout.distance / 1000 : workout.distance;
        }
        console.log(`     🎯 UI would display: ${distanceInKm.toFixed(1)} km`);
        console.log('');
      }
    } else {
      console.log('No workouts found with distance > 100');
    }
    
    // Check workout types
    console.log('\n📊 Workout types breakdown:');
    const pipeline = [
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ];
    const typeBreakdown = await db.collection('workouts').aggregate(pipeline).toArray();
    for (const type of typeBreakdown) {
      console.log(`  ${type._id}: ${type.count} workouts`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
  }
}

checkAllWorkouts().catch(console.error); 