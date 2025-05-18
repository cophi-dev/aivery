// Centralized LLM call helper for OpenAI, Grok, Gemini, etc.

export type LLMProvider = 'openai' | 'grok' | 'gemini';
export interface LLMCallOptions {
  provider: LLMProvider;
  model: string;
  messages: any[];
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
  fallbackResponse?: string;
}

export async function callLLM({
  provider,
  model,
  messages,
  max_tokens = 1024,
  temperature = 0.7,
  stream = false,
  fallbackResponse,
}: LLMCallOptions): Promise<any> {
  let apiUrl: string, headers: Record<string, string>;

  try {
    if (provider === 'openai') {
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` };
    } else if (provider === 'grok') {
      apiUrl = 'https://api.x.ai/v1/chat/completions';
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROK_API_KEY}` };
    } else if (provider === 'gemini') {
      // TODO: Add Gemini endpoint and key here
      console.warn("Gemini provider not implemented, falling back to OpenAI");
      // Use OpenAI as fallback when Gemini is selected but not implemented
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}` };
      provider = 'openai';
      model = process.env.LLM_MODEL_CHAT || 'gpt-4.1-mini-2025-04-14';
    } else {
      throw new Error('Unknown LLM provider');
    }

    // Check if API key exists
    const apiKey = headers.Authorization.split(' ')[1];
    if (!apiKey) {
      console.error(`[LLM] Missing API key for provider: ${provider}`);
      return generateFallbackResponse(fallbackResponse);
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, max_tokens, temperature, stream }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[LLM] API error (${response.status}): ${errorText}`);
      return generateFallbackResponse(fallbackResponse);
    }
    
    const data = await response.json();
    
    // Verify that we got a valid response
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      console.error("[LLM] Invalid response format:", JSON.stringify(data).substring(0, 200));
      return generateFallbackResponse(fallbackResponse);
    }
    
    return data;
  } catch (error) {
    console.error(`[LLM] Error calling ${provider} API:`, error);
    return generateFallbackResponse(fallbackResponse);
  }
}

// Helper function to create a fallback response in the expected format
function generateFallbackResponse(customMessage?: string): any {
  const fallbackContent = customMessage || 
    "I'll do my best to help you with that, although I'm experiencing some technical difficulties at the moment.";
  
  return {
    choices: [
      {
        message: {
          role: "assistant",
          content: fallbackContent
        }
      }
    ],
    usage: { 
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0 
    }
  };
} 