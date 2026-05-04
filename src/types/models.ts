import type { AIProvider } from './providers';
import type { AppLocale } from './session';

export type ModelQualityLevel = 'fast' | 'balanced' | 'highest';
export type ModelCostBasis = 'official' | 'estimated' | 'unknown' | 'plan';
export type ModelCatalogSource = 'static' | 'provider-api';

export interface ModelPricing {
  inputUsdPer1M?: number;
  cachedInputUsdPer1M?: number;
  outputUsdPer1M?: number;
  note?: Record<AppLocale, string>;
}

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
  maxOutputTokens?: number;
  pricing?: ModelPricing;
  costBasis: ModelCostBasis;
  capabilities?: string[];
  inputModalities?: string[];
  outputModalities?: string[];
  disabledReason?: Record<AppLocale, string>;
  sourceUrl: string;
  source: ModelCatalogSource;
  fetchedAt?: string;
}

export interface ModelCatalogResult {
  models: ModelConfig[];
  source: 'static' | 'live' | 'mixed';
  fetchedAt: string;
  warning?: string;
}

const ESTIMATED_RUN_INPUT_TOKENS = 30_000;
const ESTIMATED_RUN_OUTPUT_TOKENS = 12_000;

/**
 * Statyczny seed aktualizowany z oficjalnych źródeł. Runtime uzupełnia go
 * przez endpointy katalogu modeli providerów, więc krok 5 nie zależy od
 * przebudowania aplikacji, gdy dostawca doda nowy model.
 *
 * Źródła:
 * - OpenAI: https://developers.openai.com/api/docs/models
 * - OpenAI pricing: https://openai.com/api/pricing/
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/models/overview
 * - Anthropic Models API: https://platform.claude.com/docs/en/api/models/list
 * - Google Gemini: https://ai.google.dev/gemini-api/docs/models
 * - Google Gemini pricing: https://ai.google.dev/gemini-api/docs/pricing
 * - GitHub Models: https://docs.github.com/en/rest/models/catalog
 */
export const MODEL_CATALOG: readonly ModelConfig[] = [
  model({
    id: 'gpt-5.5',
    provider: 'openai',
    modelId: 'gpt-5.5',
    name: 'GPT-5.5',
    description: {
      pl: 'Najmocniejszy model OpenAI do złożonego reasoning, kodu i pracy profesjonalnej.',
      en: 'OpenAI flagship model for complex reasoning, coding, and professional work.',
    },
    estimatedSeconds: 78,
    quality: 'highest',
    contextTokens: 1_050_000,
    maxOutputTokens: 128_000,
    pricing: { inputUsdPer1M: 5, cachedInputUsdPer1M: 0.5, outputUsdPer1M: 30 },
    sourceUrl: 'https://developers.openai.com/api/docs/models',
  }),
  model({
    id: 'gpt-5.4',
    provider: 'openai',
    modelId: 'gpt-5.4',
    name: 'GPT-5.4',
    description: {
      pl: 'Mocny model OpenAI do pracy kodowej i specyfikacji, tańszy od GPT-5.5.',
      en: 'Strong OpenAI model for coding and specifications, cheaper than GPT-5.5.',
    },
    estimatedSeconds: 64,
    quality: 'highest',
    contextTokens: 1_050_000,
    maxOutputTokens: 128_000,
    pricing: { inputUsdPer1M: 2.5, cachedInputUsdPer1M: 0.25, outputUsdPer1M: 15 },
    sourceUrl: 'https://developers.openai.com/api/docs/models/gpt-5.4/',
  }),
  model({
    id: 'gpt-5.4-mini',
    provider: 'openai',
    modelId: 'gpt-5.4-mini',
    name: 'GPT-5.4 mini',
    description: {
      pl: 'Najlepszy domyślny balans jakości, szybkości i kosztu dla większości specyfikacji.',
      en: 'Best default balance of quality, speed, and cost for most specifications.',
    },
    estimatedSeconds: 38,
    quality: 'balanced',
    contextTokens: 400_000,
    maxOutputTokens: 128_000,
    pricing: { inputUsdPer1M: 0.75, cachedInputUsdPer1M: 0.075, outputUsdPer1M: 4.5 },
    sourceUrl: 'https://openai.com/api/pricing/',
  }),
  model({
    id: 'gpt-5.2',
    provider: 'openai',
    modelId: 'gpt-5.2',
    name: 'GPT-5.2',
    description: {
      pl: 'Flagowy model poprzedniej generacji OpenAI do agentowych i kodowych zadań.',
      en: 'Previous-generation OpenAI flagship model for agentic and coding-heavy tasks.',
    },
    estimatedSeconds: 68,
    quality: 'highest',
    contextTokens: 400_000,
    maxOutputTokens: 128_000,
    pricing: { inputUsdPer1M: 1.75, cachedInputUsdPer1M: 0.175, outputUsdPer1M: 14 },
    sourceUrl: 'https://platform.openai.com/docs/models/gpt-5.2/',
  }),
  model({
    id: 'gpt-5-mini',
    provider: 'openai',
    modelId: 'gpt-5-mini',
    name: 'GPT-5 mini',
    description: {
      pl: 'Tani i szybki model OpenAI do dobrze opisanych projektów.',
      en: 'Fast and inexpensive OpenAI model for well-scoped projects.',
    },
    estimatedSeconds: 40,
    quality: 'balanced',
    contextTokens: 400_000,
    maxOutputTokens: 128_000,
    pricing: { inputUsdPer1M: 0.25, cachedInputUsdPer1M: 0.025, outputUsdPer1M: 2 },
    sourceUrl: 'https://platform.openai.com/docs/pricing',
  }),
  model({
    id: 'gpt-5-nano',
    provider: 'openai',
    modelId: 'gpt-5-nano',
    name: 'GPT-5 nano',
    description: {
      pl: 'Najtańszy model OpenAI do krótkich iteracji i prostych specyfikacji.',
      en: 'Lowest-cost OpenAI model for short iterations and simple specs.',
    },
    estimatedSeconds: 26,
    quality: 'fast',
    contextTokens: 400_000,
    maxOutputTokens: 128_000,
    pricing: { inputUsdPer1M: 0.05, cachedInputUsdPer1M: 0.005, outputUsdPer1M: 0.4 },
    sourceUrl: 'https://platform.openai.com/docs/pricing',
  }),
  model({
    id: 'gpt-4.1',
    provider: 'openai',
    modelId: 'gpt-4.1',
    name: 'GPT-4.1',
    description: {
      pl: 'Sprawdzony model nierozumujący z bardzo dużym kontekstem.',
      en: 'Reliable non-reasoning model with a very large context window.',
    },
    estimatedSeconds: 46,
    quality: 'balanced',
    contextTokens: 1_047_576,
    maxOutputTokens: 32_768,
    pricing: { inputUsdPer1M: 2, cachedInputUsdPer1M: 0.5, outputUsdPer1M: 8 },
    sourceUrl: 'https://platform.openai.com/docs/models/compare',
  }),
  model({
    id: 'gpt-4.1-mini',
    provider: 'openai',
    modelId: 'gpt-4.1-mini',
    name: 'GPT-4.1 mini',
    description: {
      pl: 'Szybszy wariant GPT-4.1 do tańszych iteracji.',
      en: 'Faster GPT-4.1 variant for cheaper iterations.',
    },
    estimatedSeconds: 32,
    quality: 'fast',
    contextTokens: 1_047_576,
    maxOutputTokens: 32_768,
    pricing: { inputUsdPer1M: 0.4, cachedInputUsdPer1M: 0.1, outputUsdPer1M: 1.6 },
    sourceUrl: 'https://platform.openai.com/docs/pricing',
  }),
  model({
    id: 'gpt-4o',
    provider: 'openai',
    modelId: 'gpt-4o',
    name: 'GPT-4o',
    description: {
      pl: 'Starszy, elastyczny model multimodalny OpenAI, nadal dobry do typowych zadań.',
      en: 'Older flexible multimodal OpenAI model, still good for common tasks.',
    },
    estimatedSeconds: 42,
    quality: 'balanced',
    contextTokens: 128_000,
    maxOutputTokens: 16_384,
    pricing: { inputUsdPer1M: 2.5, cachedInputUsdPer1M: 1.25, outputUsdPer1M: 10 },
    sourceUrl: 'https://platform.openai.com/docs/pricing',
  }),
  model({
    id: 'gpt-4o-mini',
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    description: {
      pl: 'Bardzo tani model OpenAI do prostych, szybkich przebiegów.',
      en: 'Very low-cost OpenAI model for simple, fast runs.',
    },
    estimatedSeconds: 28,
    quality: 'fast',
    contextTokens: 128_000,
    maxOutputTokens: 16_384,
    pricing: { inputUsdPer1M: 0.15, cachedInputUsdPer1M: 0.075, outputUsdPer1M: 0.6 },
    sourceUrl: 'https://platform.openai.com/docs/pricing',
  }),

  model({
    id: 'claude-opus-4.7',
    provider: 'anthropic',
    modelId: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    description: {
      pl: 'Najmocniejszy Claude do złożonego reasoning i agentowego kodowania.',
      en: 'Most capable Claude model for complex reasoning and agentic coding.',
    },
    estimatedSeconds: 82,
    quality: 'highest',
    contextTokens: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { inputUsdPer1M: 5, outputUsdPer1M: 25 },
    sourceUrl: 'https://platform.claude.com/docs/en/about-claude/models/overview',
  }),
  model({
    id: 'claude-sonnet-4.6',
    provider: 'anthropic',
    modelId: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    description: {
      pl: 'Najlepszy balans szybkości i inteligencji Claude, z kontekstem 1M.',
      en: 'Best Claude balance of speed and intelligence, with a 1M context window.',
    },
    estimatedSeconds: 58,
    quality: 'highest',
    contextTokens: 1_000_000,
    maxOutputTokens: 64_000,
    pricing: { inputUsdPer1M: 3, outputUsdPer1M: 15 },
    sourceUrl: 'https://platform.claude.com/docs/en/about-claude/models/overview',
  }),
  model({
    id: 'claude-haiku-4.5',
    provider: 'anthropic',
    modelId: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    description: {
      pl: 'Najszybszy Claude do niedużych specyfikacji i tańszych iteracji.',
      en: 'Fastest Claude model for smaller specs and cheaper iterations.',
    },
    estimatedSeconds: 34,
    quality: 'fast',
    contextTokens: 200_000,
    maxOutputTokens: 64_000,
    pricing: { inputUsdPer1M: 1, outputUsdPer1M: 5 },
    sourceUrl: 'https://platform.claude.com/docs/en/about-claude/models/overview',
  }),

  model({
    id: 'gemini-3-pro-preview',
    provider: 'google',
    modelId: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro Preview',
    description: {
      pl: 'Najmocniejszy Gemini do reasoning, kodu, multimodalności i długiego kontekstu.',
      en: 'Strongest Gemini model for reasoning, coding, multimodality, and long context.',
    },
    estimatedSeconds: 58,
    quality: 'highest',
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    pricing: {
      inputUsdPer1M: 2,
      outputUsdPer1M: 12,
      note: {
        pl: 'Cena rośnie dla promptów powyżej 200k tokenów.',
        en: 'Price increases for prompts over 200k tokens.',
      },
    },
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  }),
  model({
    id: 'gemini-3-flash-preview',
    provider: 'google',
    modelId: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    description: {
      pl: 'Zbalansowany Gemini do szybkiego generowania i iteracji w dużym kontekście.',
      en: 'Balanced Gemini model for fast generation and iteration with long context.',
    },
    estimatedSeconds: 34,
    quality: 'balanced',
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    pricing: { inputUsdPer1M: 0.5, cachedInputUsdPer1M: 0.05, outputUsdPer1M: 3 },
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  }),
  model({
    id: 'gemini-2.5-flash-preview',
    provider: 'google',
    modelId: 'gemini-2.5-flash-preview-09-2025',
    name: 'Gemini 2.5 Flash Preview',
    description: {
      pl: 'Tani Gemini do skalowania, dużego wolumenu i szybkich iteracji.',
      en: 'Low-cost Gemini model for scale, high volume, and fast iterations.',
    },
    estimatedSeconds: 32,
    quality: 'fast',
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    pricing: { inputUsdPer1M: 0.3, cachedInputUsdPer1M: 0.03, outputUsdPer1M: 2.5 },
    sourceUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
  }),

  model({
    id: 'github-openai-gpt-4.1',
    provider: 'github',
    modelId: 'openai/gpt-4.1',
    name: 'OpenAI GPT-4.1 (GitHub Models)',
    description: {
      pl: 'Model z katalogu GitHub Models, wygodny dla użytkowników GitHuba i Copilota.',
      en: 'Model from GitHub Models catalog, convenient for GitHub and Copilot users.',
    },
    estimatedSeconds: 46,
    estimatedCostUsd: 0,
    costBasis: 'plan',
    quality: 'balanced',
    contextTokens: 1_048_576,
    maxOutputTokens: 32_768,
    sourceUrl: 'https://docs.github.com/en/rest/models/catalog',
  }),
  model({
    id: 'github-openai-gpt-5-mini',
    provider: 'github',
    modelId: 'openai/gpt-5-mini',
    name: 'OpenAI GPT-5 mini (GitHub Models)',
    description: {
      pl: 'Tani model OpenAI dostępny przez GitHub Models, jeśli katalog konta go udostępnia.',
      en: 'Low-cost OpenAI model through GitHub Models when available in the account catalog.',
    },
    estimatedSeconds: 42,
    estimatedCostUsd: 0,
    costBasis: 'plan',
    quality: 'balanced',
    contextTokens: 400_000,
    maxOutputTokens: 128_000,
    sourceUrl: 'https://docs.github.com/en/rest/models/catalog',
  }),
] as const;

export function getModelConfig(
  modelIdOrCatalogId: string,
  catalog: readonly ModelConfig[] = MODEL_CATALOG,
): ModelConfig | undefined {
  return catalog.find(
    (model) => model.id === modelIdOrCatalogId || model.modelId === modelIdOrCatalogId,
  );
}

export function getDefaultModelForProvider(
  provider: AIProvider,
  catalog: readonly ModelConfig[] = MODEL_CATALOG,
): ModelConfig {
  return catalog.find((model) => model.provider === provider && !model.disabledReason) ??
    MODEL_CATALOG.find((model) => model.provider === provider && !model.disabledReason) ??
    MODEL_CATALOG[0]!;
}

export function getProviderModels(
  provider: AIProvider,
  catalog: readonly ModelConfig[] = MODEL_CATALOG,
): ModelConfig[] {
  return sortModelCatalog(catalog.filter((model) => model.provider === provider));
}

export function getModelDisplayCost(model: ModelConfig, locale: AppLocale): string {
  if (model.costBasis === 'plan') {
    return locale === 'pl' ? 'wg limitów konta' : 'account limits';
  }
  if (model.costBasis === 'unknown') {
    return locale === 'pl' ? 'koszt nieznany' : 'unknown cost';
  }
  return `~$${model.estimatedCostUsd.toFixed(2)}`;
}

export function sortModelCatalog(models: readonly ModelConfig[]): ModelConfig[] {
  return [...models].sort((a, b) => {
    const providerOrder = providerRank(a.provider) - providerRank(b.provider);
    if (providerOrder !== 0) return providerOrder;
    const qualityOrder = qualityRank(a.quality) - qualityRank(b.quality);
    if (qualityOrder !== 0) return qualityOrder;
    const costOrder = a.estimatedCostUsd - b.estimatedCostUsd;
    if (Math.abs(costOrder) > 0.001) return costOrder;
    return a.name.localeCompare(b.name);
  });
}

export function estimateModelRunCost(pricing?: ModelPricing, fallback = 0): number {
  if (!pricing?.inputUsdPer1M || !pricing.outputUsdPer1M) return fallback;
  const inputCost = (ESTIMATED_RUN_INPUT_TOKENS / 1_000_000) * pricing.inputUsdPer1M;
  const outputCost = (ESTIMATED_RUN_OUTPUT_TOKENS / 1_000_000) * pricing.outputUsdPer1M;
  return Math.round((inputCost + outputCost) * 100) / 100;
}

function model(
  config: Omit<
    ModelConfig,
    'supportsStreaming' | 'source' | 'costBasis' | 'estimatedCostUsd'
  > & {
    supportsStreaming?: boolean;
    costBasis?: ModelCostBasis;
    estimatedCostUsd?: number;
  },
): ModelConfig {
  const costBasis = config.costBasis ?? (config.pricing ? 'official' : 'unknown');
  return {
    ...config,
    supportsStreaming: config.supportsStreaming ?? true,
    costBasis,
    estimatedCostUsd: config.estimatedCostUsd ?? estimateModelRunCost(config.pricing, 0),
    source: 'static',
  };
}

function qualityRank(quality: ModelQualityLevel): number {
  switch (quality) {
    case 'highest':
      return 0;
    case 'balanced':
      return 1;
    case 'fast':
      return 2;
  }
}

function providerRank(provider: AIProvider): number {
  switch (provider) {
    case 'openai':
      return 0;
    case 'anthropic':
      return 1;
    case 'google':
      return 2;
    case 'github':
      return 3;
  }
}
