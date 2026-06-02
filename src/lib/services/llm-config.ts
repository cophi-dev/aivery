/**
 * Application startup: enforce Grok-only LLM configuration.
 */

import { applyGrokEnvironmentDefaults, getGrokApiKey, resolveLLMConfig, type LLMTask } from './llm-settings';
import type { LLMProvider } from './llm';

export function ensureStandardModels(): void {
  applyGrokEnvironmentDefaults();
}

export function getStandardModel(task: LLMTask = 'chat'): string {
  return resolveLLMConfig(task).model;
}

export function getStandardProvider(): LLMProvider {
  return 'grok';
}

export function validateApiKeyConfig(): boolean {
  return Boolean(getGrokApiKey());
}
