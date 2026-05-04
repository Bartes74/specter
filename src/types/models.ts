import type { AIProvider } from './providers';
import type { AppLocale } from './session';

export type ModelQualityLevel = 'fast' | 'balanced' | 'highest';

export interface ModelConfig {
  id: string;
  provider: AIProvider;
  modelId: string;
  name: string;
  description: Record<AppLocale, string>;
  estimatedSeconds: number;
  estimatedCostUsd: number;
  quality: ModelQualityLevel;
  supportsStreaming: boolean;
  contextTokens: number;
  disabledReason?: Record<AppLocale, string>;
  sourceUrl: string;
}

/**
 * Aktualizowane na podstawie oficjalnych katalogów modeli (maj 2026).
 * Źródła:
 * - OpenAI: https://platform.openai.com/docs/models
 * - Anthropic: https://docs.anthropic.com/en/docs/about-claude/models/all-models
 * - Google: https://ai.google.dev/gemini-api/docs/models
 * - GitHub Models: https://docs.github.com/en/rest/models/catalog
 */
export const MODEL_CATALOG: readonly ModelConfig[] = [
  {
    id: 'gpt-5.2',
    provider: 'openai',
    modelId: 'gpt-5.2',
    name: 'GPT-5.2',
    description: {
      pl: 'Flagowy model OpenAI do złożonych, agentowych i kodowych zadań.',
      en: 'OpenAI flagship model for complex agentic and coding-heavy tasks.',
    },
    estimatedSeconds: 70,
    estimatedCostUsd: 0.22,
    quality: 'highest',
    supportsStreaming: true,
    contextTokens: 400_000,
    sourceUrl: 'https://platform.openai.com/docs/models/gpt-5.2',
  },
  {
    id: 'gpt-5-mini',
    provider: 'openai',
    modelId: 'gpt-5-mini',
    name: 'GPT-5 mini',
    description: {
      pl: 'Szybszy i tańszy model OpenAI dla dobrze opisanych projektów.',
      en: 'Faster and cheaper OpenAI model for well-scoped projects.',
    },
    estimatedSeconds: 42,
    estimatedCostUsd: 0.06,
    quality: 'balanced',
    supportsStreaming: true,
    contextTokens: 400_000,
    sourceUrl: 'https://platform.openai.com/docs/models',
  },
  {
    id: 'claude-sonnet-4.6',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: {
      pl: 'Najlepszy balans szybkości i inteligencji Claude, z bardzo długim kontekstem.',
      en: 'Best Claude balance of speed and intelligence with a very long context window.',
    },
    estimatedSeconds: 62,
    estimatedCostUsd: 0.18,
    quality: 'highest',
    supportsStreaming: true,
    contextTokens: 1_000_000,
    sourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/models/all-models',
  },
  {
    id: 'claude-haiku-4.5',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5-20251001',
    name: 'Claude Haiku 4.5',
    description: {
      pl: 'Szybki Claude do niedużych specyfikacji i tańszych iteracji.',
      en: 'Fast Claude model for smaller specs and cheaper iterations.',
    },
    estimatedSeconds: 36,
    estimatedCostUsd: 0.07,
    quality: 'fast',
    supportsStreaming: true,
    contextTokens: 200_000,
    sourceUrl: 'https://docs.anthropic.com/en/docs/about-claude/models/all-models',
  },
  {
    id: 'gemini-3.1-pro-preview',
    provider: 'google',
    modelId: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro Preview',
    description: {
      pl: 'Najmocniejszy Gemini do reasoning, kodu i długiego kontekstu.',
      en: 'Strongest Gemini model for reasoning, coding, and long-context work.',
    },
    estimatedSeconds: 58,
    estimatedCostUsd: 0.08,
    quality: 'highest',
    supportsStreaming: true,
    contextTokens: 1_048_576,
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview',
  },
  {
    id: 'gemini-3-flash-preview',
    provider: 'google',
    modelId: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    description: {
      pl: 'Szybszy Gemini do iteracyjnego generowania i trybu demo-like.',
      en: 'Faster Gemini model for iterative generation and demo-like flows.',
    },
    estimatedSeconds: 34,
    estimatedCostUsd: 0.03,
    quality: 'balanced',
    supportsStreaming: true,
    contextTokens: 1_048_576,
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/models/gemini-3-flash-preview',
  },
  {
    id: 'github-openai-gpt-4.1',
    provider: 'github',
    modelId: 'openai/gpt-4.1',
    name: 'OpenAI GPT-4.1 (GitHub Models)',
    description: {
      pl: 'Model z katalogu GitHub Models, wygodny dla użytkowników GitHub/Copilot.',
      en: 'Model from GitHub Models catalog, convenient for GitHub/Copilot users.',
    },
    estimatedSeconds: 46,
    estimatedCostUsd: 0,
    quality: 'balanced',
    supportsStreaming: true,
    contextTokens: 1_048_576,
    sourceUrl: 'https://docs.github.com/en/rest/models/catalog',
  },
] as const;

export function getModelConfig(modelIdOrCatalogId: string): ModelConfig | undefined {
  return MODEL_CATALOG.find(
    (model) => model.id === modelIdOrCatalogId || model.modelId === modelIdOrCatalogId,
  );
}

export function getDefaultModelForProvider(provider: AIProvider): ModelConfig {
  return MODEL_CATALOG.find((model) => model.provider === provider && !model.disabledReason) ??
    MODEL_CATALOG[0]!;
}

export function getProviderModels(provider: AIProvider): ModelConfig[] {
  return MODEL_CATALOG.filter((model) => model.provider === provider);
}
