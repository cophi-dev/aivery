# Development Scripts

This directory contains utility scripts for Aivery development.

## LLM Environment Standardization

### update-llm-env.js

This script standardizes all LLM model configurations to use OpenAI's `gpt-4.1-mini-2025-04-14` model across the application.

**Usage:**

```bash
node scripts/dev/update-llm-env.js
```

or

```bash
./scripts/dev/update-llm-env.js
```

**What it does:**

1. Creates or updates your `.env.local` file
2. Sets `LLM_PROVIDER=openai`
3. Sets all model-specific environment variables to `gpt-4.1-mini-2025-04-14`:
   - `LLM_MODEL_INSIGHT`
   - `LLM_MODEL_ANALYSIS`
   - `LLM_MODEL_DIRECT`
   - `LLM_MODEL_PLAN`
   - `LLM_MODEL_CHAT`
   - `LLM_MODEL_SUMMARY`
   - `LLM_MODEL_PARSE`
   - `LLM_MODEL_OPTIMIZE`
   - `LLM_MODEL_EXERCISE`
4. Ensures `OPENAI_API_KEY` is present (with a placeholder if not set)

**After running:**

Make sure to add your valid OpenAI API key to the `.env.local` file if it's not already set.

## Why Standardize on gpt-4.1-mini-2025-04-14?

- Consistent quality across all AI features
- Reliable performance and handling of fitness domain knowledge
- Simplified monitoring and debugging
- Better cost management with a single model

## Other Development Scripts

[Additional scripts would be documented here] 