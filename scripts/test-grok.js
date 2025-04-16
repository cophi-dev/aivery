// Test script for Grok API
require('dotenv').config({ path: '.env.local' });
// const Anthropic = require('@anthropic-ai/sdk'); // REMOVED

// const anthropic = new Anthropic({ // REMOVED
//   apiKey: process.env.ANTHROPIC_API_KEY, // REMOVED
// }); // REMOVED

async function main() {
  const grokApiKey = process.env.GROK_API_KEY;

  if (!grokApiKey) {
    console.error('Error: GROK_API_KEY is not set in your .env.local file.');
    process.exit(1);
  }

  try {
    console.log('Testing Grok API connection...');
    console.log('API Key (first 5 chars):', grokApiKey.substring(0, 5) + '...');
    
    // const response = await anthropic.messages.create({ // REMOVED
    //   model: 'claude-3-5-haiku-20241022', // REMOVED
    //   max_tokens: 100, // REMOVED
    //   messages: [ // REMOVED
    //     { // REMOVED
    //       role: 'user', // REMOVED
    //       content: 'Hello, Claude! Please respond with a brief greeting to confirm you are working correctly.' // REMOVED
    //     } // REMOVED
    //   ], // REMOVED
    //   temperature: 0.7, // REMOVED
    // }); // REMOVED

    const fetchResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grokApiKey}`
      },
      body: JSON.stringify({
        model: 'grok-3-latest',
        messages: [
          { role: 'user', content: 'Hello, Grok! Please respond with a brief greeting to confirm you are working correctly.' }
        ],
        max_tokens: 100,
        temperature: 0.7,
        stream: false,
      })
    });

    if (!fetchResponse.ok) {
        const errorBody = await fetchResponse.text();
        console.error(`Grok API error: ${fetchResponse.status} ${fetchResponse.statusText}`, errorBody);
        throw new Error(`Grok API request failed with status ${fetchResponse.status}`);
    }

    const data = await fetchResponse.json();
    console.log('\nRaw Response from Grok:', data);
    
    // console.log('\nResponse from Claude:'); // REMOVED
    // console.log(response.content[0].text); // REMOVED
    if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
        console.log('\nFormatted Response from Grok:');
        console.log(data.choices[0].message.content.trim());
    } else {
        console.warn('\nCould not extract message content from Grok response.');
    }

    console.log('\nConnection test successful!');
  } catch (error) {
    console.error('\nError testing Grok API:', error.message || error);
    process.exit(1);
  }
}

main(); 