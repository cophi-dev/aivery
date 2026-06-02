/**
 * Single source of truth for Grok LLM configuration.
 * Switch models via GROK_MODEL or per-task LLM_MODEL_* env vars.
 */

export type LLMTask =
  | 'chat'
  | 'insight'
  | 'analysis'
  | 'direct'
  | 'plan'
  | 'summary'
  | 'parse'
  | 'optimize'
  | 'exercise';

export const GROK_PROVIDER = 'grok' as const;

const TASK_ENV_KEYS: Record<LLMTask, string> = {
  chat: 'LLM_MODEL_CHAT',
  insight: 'LLM_MODEL_INSIGHT',
  analysis: 'LLM_MODEL_ANALYSIS',
  direct: 'LLM_MODEL_DIRECT',
  plan: 'LLM_MODEL_PLAN',
  summary: 'LLM_MODEL_SUMMARY',
  parse: 'LLM_MODEL_PARSE',
  optimize: 'LLM_MODEL_OPTIMIZE',
  exercise: 'LLM_MODEL_EXERCISE',
};

/** Default xAI models per task — override any via env */
const DEFAULT_MODELS: Record<LLMTask, string> = {
  chat: 'grok-3-mini-latest',
  insight: 'grok-3-mini-latest',
  analysis: 'grok-3-mini',
  direct: 'grok-3-mini',
  plan: 'grok-3-mini',
  summary: 'grok-3-mini-latest',
  parse: 'grok-3-mini',
  optimize: 'grok-3-mini-latest',
  exercise: 'grok-3-mini',
};

const ALL_TASK_ENV_KEYS = [
  'LLM_PROVIDER',
  'LLM_PROVIDER_CHAT',
  'LLM_PROVIDER_INSIGHT',
  'LLM_PROVIDER_ANALYSIS',
  'LLM_PROVIDER_DIRECT',
  'LLM_PROVIDER_PLAN',
  'LLM_PROVIDER_OPTIMIZE',
  'LLM_PROVIDER_PARSE',
  'LLM_PROVIDER_EXERCISE',
  ...Object.values(TASK_ENV_KEYS),
];

export function getGrokApiKey(): string | undefined {
  const key = process.env.GROK_API_KEY?.trim();
  if (!key || key.startsWith('CHANGE_ME')) return undefined;
  return key;
}

export function isGrokConfigured(): boolean {
  return Boolean(getGrokApiKey());
}

export function resolveLLMConfig(task: LLMTask): { provider: typeof GROK_PROVIDER; model: string } {
  const taskModel = process.env[TASK_ENV_KEYS[task]]?.trim();
  const globalModel = process.env.GROK_MODEL?.trim();
  const model = taskModel || globalModel || DEFAULT_MODELS[task];
  return { provider: GROK_PROVIDER, model };
}

/** Pins runtime env to Grok so legacy OpenAI defaults cannot leak in */
export function applyGrokEnvironmentDefaults(): void {
  process.env.LLM_PROVIDER = GROK_PROVIDER;

  ALL_TASK_ENV_KEYS.forEach((key) => {
    if (key === 'LLM_PROVIDER' || key.startsWith('LLM_PROVIDER_')) {
      process.env[key] = GROK_PROVIDER;
      return;
    }
    const task = (Object.entries(TASK_ENV_KEYS).find(([, v]) => v === key)?.[0] ??
      null) as LLMTask | null;
    if (task) {
      process.env[key] = resolveLLMConfig(task).model;
    }
  });

  if (process.env.NODE_ENV === 'development') {
    console.log(
      `[LLM] Grok-only mode — default model: ${process.env.GROK_MODEL || DEFAULT_MODELS.chat}`
    );
  }
}
