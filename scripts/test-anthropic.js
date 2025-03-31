// Test script for Anthropic API
require('dotenv').config({ path: '.env.local' });
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  try {
    console.log('Testing Anthropic API connection...');
    console.log('API Key (first 5 chars):', process.env.ANTHROPIC_API_KEY?.substring(0, 5) + '...');
    
    const response = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: 'Hello, Claude! Please respond with a brief greeting to confirm you are working correctly.'
        }
      ],
      temperature: 0.7,
    });
    
    console.log('\nResponse from Claude:');
    console.log(response.content[0].text);
    console.log('\nConnection test successful!');
  } catch (error) {
    console.error('Error testing Anthropic API:', error);
  }
}

main(); 