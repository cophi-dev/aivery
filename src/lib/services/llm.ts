// Centralized Grok (xAI) LLM client

import { getGrokApiKey, GROK_PROVIDER, resolveLLMConfig, type LLMTask } from './llm-settings';

export type LLMProvider = typeof GROK_PROVIDER;

export interface LLMCallOptions {
  provider?: LLMProvider;
  model?: string;
  task?: LLMTask;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  fallbackResponse?: string;
}

const GROK_CHAT_URL = 'https://api.x.ai/v1/chat/completions';

export async function callLLM({
  provider: _provider,
  model,
  task = 'chat',
  messages,
  max_tokens = 1024,
  temperature = 0.7,
  stream = false,
  fallbackResponse,
}: LLMCallOptions): Promise<{
  choices: Array<{ message: { role: string; content: string } }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}> {
  const resolved = resolveLLMConfig(task);
  const activeModel = model ?? resolved.model;
  const apiKey = getGrokApiKey();

  try {
    if (!apiKey) {
      console.error('[LLM] GROK_API_KEY is not configured');
      return generateFallbackResponse(fallbackResponse);
    }

    const response = await fetch(GROK_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: activeModel,
        messages,
        max_tokens,
        temperature,
        stream,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM] Grok API error (${response.status}): ${errorText}`);
      return generateFallbackResponse(fallbackResponse);
    }

    const data = await response.json();

    if (!data.choices?.[0]?.message) {
      console.error('[LLM] Invalid Grok response:', JSON.stringify(data).substring(0, 200));
      return generateFallbackResponse(fallbackResponse);
    }

    return data;
  } catch (error) {
    console.error('[LLM] Error calling Grok API:', error);
    return generateFallbackResponse(fallbackResponse);
  }
}

function generateFallbackResponse(customMessage?: string): {
  choices: Array<{ message: { role: string; content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
} {
  const fallbackContent =
    customMessage ||
    "I'm having trouble reaching the coach right now — try again in a moment.";

  return {
    choices: [{ message: { role: 'assistant', content: fallbackContent } }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}
