export async function register() {
  const { ensureStandardModels } = await import('@/lib/services/llm-config');
  ensureStandardModels();
}
