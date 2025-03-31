// Test script for AI endpoints
require('dotenv').config({ path: '.env.local' });
const http = require('http');
const https = require('https');

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(endpoint) {
  return new Promise((resolve, reject) => {
    console.log(`Testing endpoint: ${endpoint}`);
    
    const url = `${BASE_URL}${endpoint}`;
    const client = url.startsWith('https') ? https : http;
    
    const req = client.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log('Response:', JSON.stringify(jsonData, null, 2));
          
          // Check for error indicators
          if (jsonData.error) {
            console.error('Error in response:', jsonData.error);
            resolve(false);
          } else {
            console.log('✅ Endpoint test successful');
            resolve(true);
          }
        } catch (err) {
          console.error('Error parsing response:', err);
          reject(err);
        }
      });
    });
    
    req.on('error', (err) => {
      console.error(`❌ Error testing ${endpoint}:`, err);
      reject(err);
    });
    
    req.end();
  });
}

async function main() {
  console.log('Testing AI endpoints with Anthropic Claude...\n');
  
  try {
    // Test quotes endpoint
    await testEndpoint('/api/quotes?unique=' + Date.now());
    
    // Test dynamic quotes endpoint
    await testEndpoint('/api/quotes/dynamic?nocache=' + Date.now());
    
    // Test my-story endpoint
    // Note: This endpoint might require authentication
    await testEndpoint('/api/my-story');
  } catch (error) {
    console.error('Test error:', error);
  }
  
  console.log('\nTests completed');
}

main(); 