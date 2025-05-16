// Centralized LLM call helper for OpenAI, Grok, Gemini, etc.

export type LLMProvider = 'openai' | 'grok' | 'gemini';
export interface LLMCallOptions {
  provider: LLMProvider;
  model: string;
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export async function callLLM({
  provider,
  model,
  messages,
  max_tokens = 1024,
  temperature = 0.7,
  stream = false,
}: LLMCallOptions): Promise<any> {
  let apiUrl: string, headers: Record<string, string>;

  if (provider === 'openai') {
    apiUrl = 'https://api.openai.com/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` };
  } else if (provider === 'grok') {
    apiUrl = 'https://api.x.ai/v1/chat/completions';
    headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROK_API_KEY}` };
  } else if (provider === 'gemini') {
    // TODO: Add Gemini endpoint and key here
    throw new Error('Gemini provider not yet implemented');
  } else {
    throw new Error('Unknown LLM provider');
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, messages, max_tokens, temperature, stream }),
  });

  if (!response.ok) {
    throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
  }
  return response.json();
} 