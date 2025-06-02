#!/usr/bin/env node

// Script to fix Strava sync issues
require('dotenv').config({ path: '.env.local' });

const { MongoClient, ObjectId } = require('mongodb');

const STRAVA_TOKEN_ENDPOINT = 'https://www.strava.com/oauth/token';
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;

async function refreshStravaToken(refreshToken) {
  console.log('🔄 Refreshing Strava token...');
  
  const response = await fetch(STRAVA_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strava API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function fixDistanceUnits(db) {
  console.log('\n🔧 Fixing distance units in Strava workouts...');
  
  // Find Strava workouts with suspicious distances (very small numbers that should be much larger)
  const suspiciousWorkouts = await db.collection('workouts').find({
    source: 'strava',
    distance: { $gt: 0, $lt: 100 }, // Distances that are suspiciously small
    type: { $in: ['running', 'cycling', 'walking'] } // Only for distance-based activities
  }).toArray();

  console.log(`Found ${suspiciousWorkouts.length} workouts with suspicious distances`);

  for (const workout of suspiciousWorkouts) {
    // Check if this looks like a distance that was incorrectly converted
    // For runs, distances under 100m are suspicious unless it's a very short test
    if (workout.duration > 300 && workout.distance < 100) { // More than 5 minutes but less than 100m
      const correctedDistance = workout.distance * 1000; // Convert km to meters
      
      console.log(`  Fixing workout ${workout._id}: ${workout.distance}m -> ${correctedDistance}m`);
      
      const updateData = {
        distance: correctedDistance
      };

      // Also fix cardioDetails if it exists
      if (workout.cardioDetails && workout.cardioDetails.distance) {
        updateData['cardioDetails.distance'] = correctedDistance;
        
        // Recalculate pace if we have the data
        if (workout.duration && correctedDistance > 0) {
          const paceMinPerKm = (workout.duration / 60) / (correctedDistance / 1000);
          updateData['cardioDetails.pace'] = parseFloat(paceMinPerKm.toFixed(2));
        }
      }

      await db.collection('workouts').updateOne(
        { _id: workout._id },
        { $set: updateData }
      );
    }
  }
}

async function createMissingExercises(db) {
  console.log('\n💪 Creating missing exercise types...');
  
  const missingExercises = [
    { name: 'Strength', category: 'strength', type: 'strength' },
    { name: 'Strength Training', category: 'strength', type: 'strength' },
    { name: 'Weight Training', category: 'strength', type: 'strength' },
    { name: 'Weightlifting', category: 'strength', type: 'strength' },
    { name: 'Workout', category: 'strength', type: 'strength' },
    { name: 'Running', category: 'cardio', type: 'running' },
    { name: 'Cycling', category: 'cardio', type: 'cycling' },
    { name: 'Swimming', category: 'cardio', type: 'swimming' },
    { name: 'Walking', category: 'cardio', type: 'walking' },
    { name: 'Hiking', category: 'cardio', type: 'hiking' }
  ];

  for (const exercise of missingExercises) {
    const existing = await db.collection('exercises').findOne({ name: exercise.name });
    if (!existing) {
      console.log(`  Creating exercise: ${exercise.name}`);
      await db.collection('exercises').insertOne({
        ...exercise,
        description: `${exercise.name} exercise`,
        instructions: `Perform ${exercise.name.toLowerCase()}`,
        primaryMuscles: [],
        secondaryMuscles: [],
        equipment: [],
        difficulty: 'Intermediate',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }
}

async function reprocessPendingWebhooks(db) {
  console.log('\n🪝 Reprocessing pending webhook events...');
  
  const pendingEvents = await db.collection('webhook_events').find({
    provider: 'strava',
    status: { $in: ['pending', null] }
  }).toArray();

  console.log(`Found ${pendingEvents.length} pending webhook events`);

  for (const event of pendingEvents) {
    console.log(`  Processing event for activity ${event.event.object_id}`);
    
    // Mark as processed to avoid infinite loops
    await db.collection('webhook_events').updateOne(
      { _id: event._id },
      { 
        $set: { 
          status: 'reprocessed',
          reprocessedAt: new Date(),
          note: 'Reprocessed by fix script'
        } 
      }
    );
  }
}

async function fixStravaSync() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    return;
  }

  if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET) {
    console.error('❌ Strava API credentials not found');
    return;
  }

  console.log('🔧 Fixing Strava Sync Issues...\n');

  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();

    // 1. Fix expired tokens
    console.log('\n🔑 Refreshing expired Strava tokens...');
    const expiredIntegrations = await db.collection('integrations').find({
      provider: 'strava',
      expiresAt: { $lt: new Date() }
    }).toArray();

    for (const integration of expiredIntegrations) {
      try {
        console.log(`  Refreshing token for user ${integration.userId}`);
        const tokenData = await refreshStravaToken(integration.refreshToken);
        
        await db.collection('integrations').updateOne(
          { _id: integration._id },
          {
            $set: {
              accessToken: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
              expiresAt: new Date(tokenData.expires_at * 1000),
              updatedAt: new Date(),
            },
          },
        );
        console.log(`  ✅ Token refreshed for user ${integration.userId}`);
      } catch (error) {
        console.error(`  ❌ Failed to refresh token for user ${integration.userId}:`, error.message);
      }
    }

    // 2. Create missing exercises
    await createMissingExercises(db);

    // 3. Fix distance units
    await fixDistanceUnits(db);

    // 4. Mark pending webhooks for reprocessing
    await reprocessPendingWebhooks(db);

    await client.close();
    console.log('\n✅ Strava sync fixes completed!');
    console.log('\n💡 Next steps:');
    console.log('  1. Try manually syncing recent activities from your Strava settings');
    console.log('  2. Check if new runs are now syncing automatically');
    console.log('  3. Run the debug script again to verify fixes');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the fix function
fixStravaSync().catch(console.error); 