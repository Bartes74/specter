import { createHash } from 'crypto';
import type { AIProvider } from '@/types/providers';
import type {
  ModelCatalogResult,
  ModelConfig,
  ModelPricing,
  ModelQualityLevel,
} from '@/types/models';
import {
  MODEL_CATALOG,
  estimateModelRunCost,
  getModelConfig,
  sortModelCatalog,
} from '@/types/models';
import { safeLog } from '@/lib/security';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

const catalogCache = new Map<string, { expiresAt: number; result: ModelCatalogResult }>();

export interface LoadModelCatalogInput {
  provider?: AIProvider;
  apiKey?: string;
  force?: boolean;
}

export async function loadModelCatalog(input: LoadModelCatalogInput): Promise<ModelCatalogResult> {
  const fetchedAt = new Date().toISOString();
  const staticModels = input.provider
    ? MODEL_CATALOG.filter((model) => model.provider === input.provider)
    : [...MODEL_CATALOG];

  if (!input.provider || !input.apiKey?.trim()) {
    return {
      models: sortModelCatalog(staticModels),
      source: 'static',
      fetchedAt,
    };
  }

  const cacheKey = `${input.provider}:${fingerprint(input.apiKey)}`;
  const cached = catalogCache.get(cacheKey);
  if (!input.force && cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  try {
    const liveModels = await fetchProviderModels(input.provider, input.apiKey);
    const result: ModelCatalogResult = {
      models: sortModelCatalog(mergeModels(staticModels, liveModels)),
      source: 'live',
      fetchedAt,
    };
    catalogCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, result });
    return result;
  } catch (err) {
    safeLog.warn('Model catalog refresh failed:', err instanceof Error ? err.message : String(err));
    return {
      models: sortModelCatalog(staticModels),
      source: 'static',
      fetchedAt,
      warning: err instanceof Error ? err.message : 'Model catalog refresh failed',
    };
  }
}

export function mergeModels(
  staticModels: readonly ModelConfig[],
  liveModels: readonly ModelConfig[],
): ModelConfig[] {
  const byKey = new Map<string, ModelConfig>();
  for (const model of staticModels) {
    byKey.set(modelKey(model), model);
  }
  for (const model of liveModels) {
    const key = modelKey(model);
    const existing = byKey.get(key);
    byKey.set(
      key,
      existing
        ? {
            ...existing,
            ...model,
            description: {
              pl: existing.description.pl || model.description.pl,
              en: existing.description.en || model.description.en,
            },
            pricing: existing.pricing ?? model.pricing,
            costBasis: existing.costBasis === 'official' ? existing.costBasis : model.costBasis,
            estimatedCostUsd:
              existing.costBasis === 'official' ? existing.estimatedCostUsd : model.estimatedCostUsd,
            source: 'provider-api',
          }
        : model,
    );
  }
  return [...byKey.values()];
}

async function fetchProviderModels(provider: AIProvider, apiKey: string): Promise<ModelConfig[]> {
  switch (provider) {
    case 'openai':
      return fetchOpenAIModels(apiKey);
    case 'anthropic':
      return fetchAnthropicModels(apiKey);
    case 'google':
      return fetchGoogleModels(apiKey);
    case 'github':
      return fetchGitHubModels(apiKey);
  }
}

async function fetchOpenAIModels(apiKey: string): Promise<ModelConfig[]> {
  const res = await fetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  });
  const body = (await readJson(res)) as { data?: Array<{ id?: unknown; created?: unknown }> };
  if (!res.ok) throw new Error(readError(body, res.status));
  return (body.data ?? [])
    .map((item) => (typeof item.id === 'string' ? item.id : ''))
    .filter(isUsableOpenAIModel)
    .map((modelId) => buildModelFromLive('openai', modelId));
}

async function fetchAnthropicModels(apiKey: string): Promise<ModelConfig[]> {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=1000', {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    cache: 'no-store',
  });
  const body = (await readJson(res)) as {
    data?: Array<{ id?: unknown; display_name?: unknown; capabilities?: unknown }>;
  };
  if (!res.ok) throw new Error(readError(body, res.status));
  return (body.data ?? [])
    .map((item) => {
      const id = typeof item.id === 'string' ? item.id : '';
      return id
        ? buildModelFromLive('anthropic', id, {
            name: typeof item.display_name === 'string' ? item.display_name : undefined,
            capabilities: flattenCapabilityKeys(item.capabilities),
          })
        : null;
    })
    .filter((model): model is ModelConfig => model !== null);
}

async function fetchGoogleModels(apiKey: string): Promise<ModelConfig[]> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { cache: 'no-store' },
  );
  const body = (await readJson(res)) as {
    models?: Array<{
      name?: unknown;
      displayName?: unknown;
      description?: unknown;
      inputTokenLimit?: unknown;
      outputTokenLimit?: unknown;
      supportedGenerationMethods?: unknown;
    }>;
  };
  if (!res.ok) throw new Error(readError(body, res.status));
  return (body.models ?? [])
    .map((item) => {
      const rawName = typeof item.name === 'string' ? item.name : '';
      const modelId = rawName.replace(/^models\//, '');
      const methods = Array.isArray(item.supportedGenerationMethods)
        ? item.supportedGenerationMethods.filter((method): method is string => typeof method === 'string')
        : [];
      if (!modelId || !methods.includes('generateContent')) return null;
      return buildModelFromLive('google', modelId, {
        name: typeof item.displayName === 'string' ? item.displayName : undefined,
        description:
          typeof item.description === 'string'
            ? { pl: item.description, en: item.description }
            : undefined,
        contextTokens:
          typeof item.inputTokenLimit === 'number' ? item.inputTokenLimit : undefined,
        maxOutputTokens:
          typeof item.outputTokenLimit === 'number' ? item.outputTokenLimit : undefined,
        supportsStreaming: methods.includes('streamGenerateContent'),
        capabilities: methods,
      });
    })
    .filter((model): model is ModelConfig => model !== null);
}

async function fetchGitHubModels(apiKey: string): Promise<ModelConfig[]> {
  const res = await fetch('https://models.github.ai/catalog/models', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${apiKey}`,
      'X-GitHub-Api-Version': '2026-03-10',
    },
    cache: 'no-store',
  });
  const body = (await readJson(res)) as Array<{
    id?: unknown;
    name?: unknown;
    summary?: unknown;
    capabilities?: unknown;
    limits?: { max_input_tokens?: unknown; max_output_tokens?: unknown };
    supported_input_modalities?: unknown;
    supported_output_modalities?: unknown;
    html_url?: unknown;
  }>;
  if (!res.ok) throw new Error(readError(body, res.status));
  if (!Array.isArray(body)) return [];

  return body
    .map((item) => {
      const modelId = typeof item.id === 'string' ? item.id : '';
      const outputs = Array.isArray(item.supported_output_modalities)
        ? item.supported_output_modalities.filter((modality): modality is string => typeof modality === 'string')
        : [];
      if (!modelId || (outputs.length > 0 && !outputs.includes('text'))) return null;
      return buildModelFromLive('github', modelId, {
        name: typeof item.name === 'string' ? item.name : undefined,
        description:
          typeof item.summary === 'string' ? { pl: item.summary, en: item.summary } : undefined,
        contextTokens:
          typeof item.limits?.max_input_tokens === 'number' ? item.limits.max_input_tokens : undefined,
        maxOutputTokens:
          typeof item.limits?.max_output_tokens === 'number' ? item.limits.max_output_tokens : undefined,
        capabilities: Array.isArray(item.capabilities)
          ? item.capabilities.filter((cap): cap is string => typeof cap === 'string')
          : undefined,
        inputModalities: Array.isArray(item.supported_input_modalities)
          ? item.supported_input_modalities.filter((modality): modality is string => typeof modality === 'string')
          : undefined,
        outputModalities: outputs,
        sourceUrl: typeof item.html_url === 'string' ? item.html_url : undefined,
      });
    })
    .filter((model): model is ModelConfig => model !== null);
}

export function buildModelFromLive(
  provider: AIProvider,
  modelId: string,
  overrides: Partial<Pick<
    ModelConfig,
    | 'name'
    | 'description'
    | 'contextTokens'
    | 'maxOutputTokens'
    | 'supportsStreaming'
    | 'capabilities'
    | 'inputModalities'
    | 'outputModalities'
    | 'sourceUrl'
  >> = {},
): ModelConfig {
  const known = getModelConfig(modelId);
  if (known) {
    return {
      ...known,
      ...overrides,
      id: known.id,
      provider,
      modelId,
      name: overrides.name ?? known.name,
      description: overrides.description ?? known.description,
      source: 'provider-api',
      fetchedAt: new Date().toISOString(),
    };
  }

  const pricing = inferPricing(provider, modelId);
  const costBasis = pricing ? 'estimated' : provider === 'github' ? 'plan' : 'unknown';
  const quality = inferQuality(modelId);
  return {
    id: `${provider}-${slugModelId(modelId)}`,
    provider,
    modelId,
    name: overrides.name ?? humanizeModelId(modelId),
    description: overrides.description ?? inferDescription(provider, modelId),
    estimatedSeconds: inferSeconds(quality, modelId),
    estimatedCostUsd: pricing ? estimateModelRunCost(pricing, 0) : 0,
    quality,
    supportsStreaming: overrides.supportsStreaming ?? true,
    contextTokens: overrides.contextTokens ?? inferContextTokens(provider, modelId),
    maxOutputTokens: overrides.maxOutputTokens ?? inferMaxOutputTokens(provider, modelId),
    pricing,
    costBasis,
    capabilities: overrides.capabilities,
    inputModalities: overrides.inputModalities,
    outputModalities: overrides.outputModalities,
    sourceUrl: overrides.sourceUrl ?? providerSourceUrl(provider),
    source: 'provider-api',
    fetchedAt: new Date().toISOString(),
  };
}

function isUsableOpenAIModel(modelId: string): boolean {
  const id = modelId.toLowerCase();
  if (
    /embedding|moderation|tts|whisper|transcribe|image|dall-e|sora|realtime|audio|search|computer-use|babbage|davinci/.test(
      id,
    )
  ) {
    return false;
  }
  return /^(gpt-[45]|o[134]|chatgpt-|gpt-oss)/.test(id);
}

function inferPricing(provider: AIProvider, modelId: string): ModelPricing | undefined {
  const id = modelId.toLowerCase();
  if (provider === 'openai') {
    if (/gpt-5\.5/.test(id)) return { inputUsdPer1M: 5, cachedInputUsdPer1M: 0.5, outputUsdPer1M: 30 };
    if (/gpt-5\.4-mini/.test(id)) return { inputUsdPer1M: 0.75, cachedInputUsdPer1M: 0.075, outputUsdPer1M: 4.5 };
    if (/gpt-5\.4/.test(id)) return { inputUsdPer1M: 2.5, cachedInputUsdPer1M: 0.25, outputUsdPer1M: 15 };
    if (/gpt-5\.2/.test(id)) return { inputUsdPer1M: 1.75, cachedInputUsdPer1M: 0.175, outputUsdPer1M: 14 };
    if (/gpt-5\.1|gpt-5-codex|gpt-5-chat-latest|gpt-5$/.test(id)) return { inputUsdPer1M: 1.25, cachedInputUsdPer1M: 0.125, outputUsdPer1M: 10 };
    if (/gpt-5-mini/.test(id)) return { inputUsdPer1M: 0.25, cachedInputUsdPer1M: 0.025, outputUsdPer1M: 2 };
    if (/gpt-5-nano/.test(id)) return { inputUsdPer1M: 0.05, cachedInputUsdPer1M: 0.005, outputUsdPer1M: 0.4 };
    if (/gpt-4\.1-mini/.test(id)) return { inputUsdPer1M: 0.4, cachedInputUsdPer1M: 0.1, outputUsdPer1M: 1.6 };
    if (/gpt-4\.1-nano/.test(id)) return { inputUsdPer1M: 0.1, cachedInputUsdPer1M: 0.025, outputUsdPer1M: 0.4 };
    if (/gpt-4\.1/.test(id)) return { inputUsdPer1M: 2, cachedInputUsdPer1M: 0.5, outputUsdPer1M: 8 };
    if (/gpt-4o-mini/.test(id)) return { inputUsdPer1M: 0.15, cachedInputUsdPer1M: 0.075, outputUsdPer1M: 0.6 };
    if (/gpt-4o/.test(id)) return { inputUsdPer1M: 2.5, cachedInputUsdPer1M: 1.25, outputUsdPer1M: 10 };
  }
  if (provider === 'anthropic') {
    if (/opus-4-7/.test(id)) return { inputUsdPer1M: 5, outputUsdPer1M: 25 };
    if (/sonnet-4-6/.test(id)) return { inputUsdPer1M: 3, outputUsdPer1M: 15 };
    if (/haiku-4-5/.test(id)) return { inputUsdPer1M: 1, outputUsdPer1M: 5 };
  }
  if (provider === 'google') {
    if (/gemini-3-pro/.test(id)) return { inputUsdPer1M: 2, outputUsdPer1M: 12 };
    if (/gemini-3-flash/.test(id)) return { inputUsdPer1M: 0.5, cachedInputUsdPer1M: 0.05, outputUsdPer1M: 3 };
    if (/gemini-2\.5-flash/.test(id)) return { inputUsdPer1M: 0.3, cachedInputUsdPer1M: 0.03, outputUsdPer1M: 2.5 };
  }
  return undefined;
}

function inferQuality(modelId: string): ModelQualityLevel {
  const id = modelId.toLowerCase();
  if (/nano|mini|haiku|flash|lite/.test(id)) return 'fast';
  if (/opus|pro|sonnet|gpt-5\.5|gpt-5\.4|gpt-5\.2|o3/.test(id)) return 'highest';
  return 'balanced';
}

function inferSeconds(quality: ModelQualityLevel, modelId: string): number {
  if (/nano|lite/i.test(modelId)) return 24;
  if (quality === 'fast') return 34;
  if (quality === 'highest') return 64;
  return 44;
}

function inferContextTokens(provider: AIProvider, modelId: string): number {
  const id = modelId.toLowerCase();
  if (provider === 'anthropic') return /haiku/.test(id) ? 200_000 : 1_000_000;
  if (provider === 'google') return 1_048_576;
  if (/gpt-5\.5|gpt-5\.4/.test(id)) return 1_050_000;
  if (/gpt-4\.1/.test(id)) return 1_047_576;
  if (/gpt-4o/.test(id)) return 128_000;
  return 400_000;
}

function inferMaxOutputTokens(provider: AIProvider, modelId: string): number {
  const id = modelId.toLowerCase();
  if (provider === 'anthropic') return /opus/.test(id) ? 128_000 : 64_000;
  if (provider === 'google') return 65_536;
  if (/gpt-4\.1/.test(id)) return 32_768;
  return 128_000;
}

function inferDescription(provider: AIProvider, modelId: string): Record<'pl' | 'en', string> {
  const providerName = provider === 'google' ? 'Google Gemini' : provider === 'github' ? 'GitHub Models' : provider;
  return {
    pl: `Model ${humanizeModelId(modelId)} wykryty automatycznie z katalogu API ${providerName}.`,
    en: `${humanizeModelId(modelId)} detected automatically from the ${providerName} API catalog.`,
  };
}

function humanizeModelId(modelId: string): string {
  return modelId
    .split('/')
    .pop()!
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function slugModelId(modelId: string): string {
  return modelId.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function providerSourceUrl(provider: AIProvider): string {
  switch (provider) {
    case 'openai':
      return 'https://developers.openai.com/api/docs/models';
    case 'anthropic':
      return 'https://platform.claude.com/docs/en/api/models/list';
    case 'google':
      return 'https://ai.google.dev/gemini-api/docs/models';
    case 'github':
      return 'https://docs.github.com/en/rest/models/catalog';
  }
}

function flattenCapabilityKeys(raw: unknown): string[] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const keys: string[] = [];
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'object' && value && 'supported' in value) {
      if ((value as { supported?: unknown }).supported === true) keys.push(key);
    }
  }
  return keys.length > 0 ? keys : undefined;
}

function modelKey(model: ModelConfig): string {
  return `${model.provider}:${model.modelId}`;
}

function fingerprint(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: { message: text.slice(0, 300) } };
  }
}

function readError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const error = obj.error;
    if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
      return `${status} ${(error as { message: string }).message}`;
    }
    if (typeof obj.message === 'string') return `${status} ${obj.message}`;
  }
  return `Nie udało się odświeżyć katalogu modeli (status ${status}).`;
}
