/**
 * LLM Configuration Helper
 * 
 * This module standardizes all LLM model configurations to use OpenAI's gpt-4.1-mini-2025-04-14
 * regardless of what's set in environment variables.
 * 
 * Import and call ensureStandardModels() early in your application startup.
 */

import { LLMProvider } from './llm';

// Standard model configuration - these can be modified at runtime based on available keys
let STANDARD_PROVIDER: LLMProvider = 'openai';
let STANDARD_MODEL = 'gpt-4.1-mini-2025-04-14';

// List of all LLM model environment variables
const MODEL_ENV_VARS = [
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

/**
 * Determines the best provider based on available API keys
 * 
 * @returns {LLMProvider} The best available provider
 */
function determineBestProvider(): LLMProvider {
  // Check OpenAI first (preferred)
  if (process.env.OPENAI_API_KEY) {
    return 'openai';
  }
  
  // Check Grok next
  if (process.env.GROK_API_KEY) {
    // Update model for Grok
    STANDARD_MODEL = 'gpt-4.1-mini-2025-04-14';
    return 'grok';
  }
  
  // Check Gemini last
  if (process.env.GEMINI_API_KEY) {
    // Update model for Gemini
    STANDARD_MODEL = 'gemini-1.5-pro';
    return 'gemini';
  }
  
  // Default to OpenAI even if key might be missing
  // This will lead to fallback responses in the LLM service
  return 'openai';
}

/**
 * Ensures all LLM model environment variables are standardized to the best available model
 * This function overrides environment variables at runtime.
 * 
 * @returns {void}
 */
export function ensureStandardModels(): void {
  // Determine best provider based on available API keys
  STANDARD_PROVIDER = determineBestProvider();
  
  // Override provider
  process.env.LLM_PROVIDER = STANDARD_PROVIDER;
  process.env.LLM_PROVIDER_CHAT = STANDARD_PROVIDER;
  
  // Override all model-specific variables
  MODEL_ENV_VARS.forEach(envVar => {
    process.env[envVar] = STANDARD_MODEL;
  });
  
  // Log standardization
  console.log(`[LLM Config] Standardized all LLM models to ${STANDARD_PROVIDER}/${STANDARD_MODEL}`);
}

/**
 * Gets the standardized model name regardless of environment configuration
 * 
 * @returns {string} The standard model name
 */
export function getStandardModel(): string {
  return STANDARD_MODEL;
}

/**
 * Gets the standardized provider regardless of environment configuration
 * 
 * @returns {LLMProvider} The standard provider
 */
export function getStandardProvider(): LLMProvider {
  return STANDARD_PROVIDER;
}

/**
 * Validates if the OPENAI_API_KEY is configured
 * 
 * @returns {boolean} True if API key is configured, false otherwise
 */
export function validateApiKeyConfig(): boolean {
  const apiKey = process.env.OPENAI_API_KEY;
  return apiKey !== undefined && apiKey.length > 0 && !apiKey.includes('your_openai_api_key_here');
} 