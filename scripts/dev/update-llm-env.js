#!/usr/bin/env node

/**
 * This script updates the .env.local file to standardize all LLM models to use gpt-4.1-mini-2025-04-14.
 * Run with: node scripts/dev/update-llm-env.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ENV_FILE_PATH = path.join(process.cwd(), '.env.local');

// Check if .env.local exists
if (!fs.existsSync(ENV_FILE_PATH)) {
  console.error(`Error: .env.local file not found at ${ENV_FILE_PATH}`);
  console.log('Creating a new .env.local file with OpenAI configuration...');
  
  const envContent = `# LLM Configuration
OPENAI_API_KEY=your_openai_api_key_here

# Default provider for all LLM calls
LLM_PROVIDER=openai

# Default model for specific LLM tasks (all standardized to gpt-4.1-mini-2025-04-14)
LLM_MODEL_INSIGHT=gpt-4.1-mini-2025-04-14
LLM_MODEL_ANALYSIS=gpt-4.1-mini-2025-04-14
LLM_MODEL_DIRECT=gpt-4.1-mini-2025-04-14
LLM_MODEL_PLAN=gpt-4.1-mini-2025-04-14
LLM_MODEL_CHAT=gpt-4.1-mini-2025-04-14
LLM_MODEL_SUMMARY=gpt-4.1-mini-2025-04-14
LLM_MODEL_PARSE=gpt-4.1-mini-2025-04-14
LLM_MODEL_OPTIMIZE=gpt-4.1-mini-2025-04-14
LLM_MODEL_EXERCISE=gpt-4.1-mini-2025-04-14
`;

  fs.writeFileSync(ENV_FILE_PATH, envContent);
  console.log('Created .env.local file with OpenAI configuration. Please add your OpenAI API key.');
  process.exit(0);
}

// Read existing .env file
const envContent = fs.readFileSync(ENV_FILE_PATH, 'utf8');
const lines = envContent.split('\n');

// Environment variables to check and update
const envVars = [
  'LLM_PROVIDER',
  'LLM_MODEL_INSIGHT',
  'LLM_MODEL_ANALYSIS',
  'LLM_MODEL_DIRECT',
  'LLM_MODEL_PLAN',
  'LLM_MODEL_CHAT',
  'LLM_MODEL_SUMMARY',
  'LLM_MODEL_PARSE',
  'LLM_MODEL_OPTIMIZE',
  'LLM_MODEL_EXERCISE'
];

// Track which variables exist
const existingVars = {};
envVars.forEach(v => existingVars[v] = false);

// Check and update existing variables
const updatedLines = lines.map(line => {
  // Skip comments and empty lines
  if (line.trim().startsWith('#') || line.trim() === '') {
    return line;
  }
  
  const parts = line.split('=');
  if (parts.length < 2) return line;
  
  const key = parts[0].trim();
  
  if (key === 'LLM_PROVIDER') {
    existingVars[key] = true;
    return `${key}=openai`;
  }
  
  if (key.startsWith('LLM_MODEL_')) {
    existingVars[key] = true;
    return `${key}=gpt-4.1-mini-2025-04-14`;
  }
  
  return line;
});

// Add missing variables
for (const varName of envVars) {
  if (!existingVars[varName]) {
    if (varName === 'LLM_PROVIDER') {
      updatedLines.push('LLM_PROVIDER=openai');
    } else {
      updatedLines.push(`${varName}=gpt-4.1-mini-2025-04-14`);
    }
  }
}

// Make sure OPENAI_API_KEY is present
if (!envContent.includes('OPENAI_API_KEY=')) {
  updatedLines.push('OPENAI_API_KEY=your_openai_api_key_here');
}

// Write updated content back to .env.local
fs.writeFileSync(ENV_FILE_PATH, updatedLines.join('\n'));

console.log('Successfully updated .env.local file:');
console.log('- Set LLM_PROVIDER to openai');
console.log('- Standardized all LLM models to gpt-4.1-mini-2025-04-14');
console.log('- Added any missing LLM configuration variables');
console.log('\nMake sure you have set a valid OPENAI_API_KEY in your .env.local file.'); 