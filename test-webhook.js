#!/usr/bin/env node

// Test script to verify Strava webhook endpoint is working
const fetch = require('node-fetch');

async function testWebhook() {
  console.log('🧪 Testing Strava webhook endpoint...\n');

  // Test if the app is running
  const baseUrl = 'http://localhost:3000';
  
  try {
    // First test a simple GET request to check if the webhook verification works
    console.log('1. Testing webhook verification (GET)...');
    const verifyResponse = await fetch(`${baseUrl}/api/strava/webhook?hub.mode=subscribe&hub.verify_token=aivery_strava_webhook_verify_token&hub.challenge=test123`);
    
    console.log(`   Status: ${verifyResponse.status}`);
    if (verifyResponse.ok) {
      const verifyResult = await verifyResponse.json();
      console.log(`   ✅ Verification successful: ${JSON.stringify(verifyResult)}`);
    } else {
      console.log(`   ❌ Verification failed: ${verifyResponse.statusText}`);
    }

    // Test a mock webhook POST request
    console.log('\n2. Testing webhook processing (POST)...');
    const webhookData = {
      object_type: "activity",
      object_id: 12345678987654321,
      aspect_type: "create", 
      updates: {},
      owner_id: 64755794, // One of the athlete IDs from our debug
      subscription_id: 123456,
      event_time: Math.floor(Date.now() / 1000)
    };

    const postResponse = await fetch(`${baseUrl}/api/strava/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookData)
    });

    console.log(`   Status: ${postResponse.status}`);
    if (postResponse.ok) {
      console.log(`   ✅ Webhook POST successful: ${postResponse.statusText}`);
    } else {
      const errorText = await postResponse.text();
      console.log(`   ❌ Webhook POST failed: ${postResponse.statusText}`);
      console.log(`   Error: ${errorText}`);
    }

    console.log('\n✅ Webhook tests completed!');
    console.log('💡 If both tests passed, your Strava webhooks should now work correctly.');

  } catch (error) {
    console.error('❌ Error testing webhook:', error.message);
    console.log('\n💡 Make sure your development server is running on localhost:3000');
  }
}

// Run the test
testWebhook().catch(console.error); 