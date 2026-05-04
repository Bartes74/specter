/**
 * Cztery wspierane Dostawca_Klucza_API (Wymagania 5, 16).
 * Używane konsekwentnie w całej aplikacji jako jedyny typ providera.
 */
export const AI_PROVIDERS = ['openai', 'anthropic', 'google', 'github'] as const;
export type AIProvider = (typeof AI_PROVIDERS)[number];

export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  google: 'Google (Gemini)',
  github: 'GitHub (Copilot / Models)',
};

export function isAIProvider(value: unknown): value is AIProvider {
  return typeof value === 'string' && (AI_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Cztery wspierane Narzędzie_AI_Docelowe (Wymaganie 4).
 * 'universal' — neutralny format (Wymaganie 4.7).
 */
export const TARGET_TOOLS = ['codex', 'claude-code', 'gemini', 'copilot', 'universal'] as const;
export type TargetTool = (typeof TARGET_TOOLS)[number];

export function isTargetTool(value: unknown): value is TargetTool {
  return typeof value === 'string' && (TARGET_TOOLS as readonly string[]).includes(value);
}
