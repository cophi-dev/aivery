#!/usr/bin/env node

// Test script for the new sync last 5 functionality
const fetch = require('node-fetch');

async function testSyncLast5() {
  console.log('🧪 Testing Sync Last 5 functionality...\n');

  const baseUrl = 'http://localhost:3000';
  
  try {
    console.log('Testing sync last 5 endpoint...');
    const response = await fetch(`${baseUrl}/api/strava/sync-last-5`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status: ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Sync Last 5 successful!');
      console.log('Response:', JSON.stringify(result, null, 2));
      console.log(`\n📊 Results:`);
      console.log(`  - Total processed: ${result.totalProcessed}`);
      console.log(`  - New workouts: ${result.newCount}`);
      console.log(`  - Updated workouts: ${result.updatedCount}`);
      console.log(`  - Message: ${result.message}`);
      
      if (result.results && result.results.length > 0) {
        console.log('\n📝 Activity details:');
        result.results.forEach((activity, index) => {
          console.log(`  ${index + 1}. ${activity.name} (${activity.type}) - ${activity.action}`);
          if (activity.error) {
            console.log(`     Error: ${activity.error}`);
          }
        });
      }
    } else {
      const errorText = await response.text();
      console.log(`❌ Sync Last 5 failed: ${response.statusText}`);
      console.log(`Error: ${errorText}`);
    }

    console.log('\n💡 Next steps:');
    console.log('1. Check your workouts page to see the resynced activities');
    console.log('2. Verify that the distances and durations look correct');
    console.log('3. Test the buttons in the UI at /integrations');

  } catch (error) {
    console.error('❌ Error testing sync last 5:', error.message);
    console.log('\n💡 Make sure your development server is running on localhost:3000');
    console.log('💡 Also ensure you have a valid Strava connection');
  }
}

// Run the test
testSyncLast5().catch(console.error); 