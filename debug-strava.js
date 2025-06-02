#!/usr/bin/env node

// Debug script to check Strava sync status
require('dotenv').config({ path: '.env.local' });

const { MongoClient } = require('mongodb');

async function debugStrava() {
  const mongoUri = process.env.MONGODB_URI;
  
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    return;
  }

  console.log('🔍 Debugging Strava Sync...\n');

  try {
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();

    // Check environment variables
    console.log('\n📋 Environment Variables:');
    console.log(`  STRAVA_CLIENT_ID: ${process.env.STRAVA_CLIENT_ID ? `${process.env.STRAVA_CLIENT_ID.substring(0, 6)}...` : '❌ Not set'}`);
    console.log(`  STRAVA_CLIENT_SECRET: ${process.env.STRAVA_CLIENT_SECRET ? '✅ Set' : '❌ Not set'}`);
    console.log(`  NEXT_PUBLIC_APP_URL: ${process.env.NEXT_PUBLIC_APP_URL || '❌ Not set'}`);

    // Check for users with Strava integrations
    console.log('\n👥 Users with Strava integrations:');
    const integrations = await db.collection('integrations').find({ provider: 'strava' }).toArray();
    
    for (const integration of integrations) {
      console.log(`  User ID: ${integration.userId}`);
      console.log(`  Athlete ID: ${integration.athleteId}`);
      console.log(`  Expires At: ${integration.expiresAt}`);
      console.log(`  Token Expired: ${new Date(integration.expiresAt) < new Date() ? '❌ Yes' : '✅ No'}`);
      console.log('  ---');
    }

    // Check recent webhook events
    console.log('\n🪝 Recent Webhook Events (last 10):');
    const webhookEvents = await db.collection('webhook_events')
      .find({ provider: 'strava' })
      .sort({ timestamp: -1 })
      .limit(10)
      .toArray();

    if (webhookEvents.length === 0) {
      console.log('  ❌ No webhook events found - webhooks may not be set up or working');
    } else {
      for (const event of webhookEvents) {
        console.log(`  ${event.timestamp} - ${event.event.aspect_type} activity ${event.event.object_id}`);
        console.log(`    Status: ${event.status || 'pending'}`);
        if (event.errorMessage) {
          console.log(`    Error: ${event.errorMessage}`);
        }
      }
    }

    // Check recent Strava workouts
    console.log('\n🏃 Recent Strava Workouts (last 5):');
    const stravaWorkouts = await db.collection('workouts')
      .find({ source: 'strava' })
      .sort({ date: -1 })
      .limit(5)
      .toArray();

    if (stravaWorkouts.length === 0) {
      console.log('  ❌ No Strava workouts found in database');
    } else {
      for (const workout of stravaWorkouts) {
        console.log(`  ${workout.date} - ${workout.type} - ${workout.name}`);
        console.log(`    Distance: ${workout.distance}m, Duration: ${workout.duration}s`);
        console.log(`    Source ID: ${workout.sourceId}`);
      }
    }

    // Check user preferences
    console.log('\n⚙️ Strava Sync Preferences:');
    const preferences = await db.collection('preferences')
      .find({ type: 'strava_sync' })
      .toArray();

    if (preferences.length === 0) {
      console.log('  ℹ️ No sync preferences found (will use defaults: running, swimming)');
    } else {
      for (const pref of preferences) {
        console.log(`  User ${pref.userId}: ${pref.activityTypes.join(', ')}`);
      }
    }

    await client.close();
    console.log('\n✅ Debug complete');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the debug function
debugStrava().catch(console.error); 