'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AlertCircle, Check, Loader, RefreshCw, Search, Sparkles } from './ui/Icon';
import {
  MODEL_CATALOG,
  getDefaultModelForProvider,
  getModelConfig,
  getModelDisplayCost,
  sortModelCatalog,
  type ModelCatalogResult,
  type ModelConfig,
} from '@/types/models';
import { AI_PROVIDER_LABELS, AI_PROVIDERS, type AIProvider } from '@/types/providers';
import type { AppLocale, Recommendation } from '@/types/session';
import { validateApiKey as validateApiKeyShape } from '@/lib/validation';

export function ModelSelector({
  locale,
  selectedProvider,
  selectedModel,
  apiKey,
  apiKeyValid,
  recommendation,
  demo,
  onSelect,
  onApiKeyChange,
  onApiKeyValidChange,
  onOpenTutorial,
}: {
  locale: AppLocale;
  selectedProvider: AIProvider | null;
  selectedModel: string | null;
  apiKey: string;
  apiKeyValid: boolean | null;
  recommendation: Recommendation<string> | null;
  demo: boolean;
  onSelect: (provider: AIProvider, modelId: string) => void;
  onApiKeyChange: (key: string) => void;
  onApiKeyValidChange: (valid: boolean | null) => void;
  onOpenTutorial: (provider: AIProvider) => void;
}) {
  const [validating, setValidating] = useState(false);
  const [catalog, setCatalog] = useState<ModelConfig[]>(() => sortModelCatalog(MODEL_CATALOG));
  const [catalogSource, setCatalogSource] = useState<ModelCatalogResult['source']>('static');
  const [catalogFetchedAt, setCatalogFetchedAt] = useState<string | null>(null);
  const [catalogWarning, setCatalogWarning] = useState<string | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [query, setQuery] = useState('');

  const modelsByProvider = useMemo(() => groupByProvider(catalog), [catalog]);
  const activeProvider = selectedProvider ?? MODEL_CATALOG[0]!.provider;
  const activeProviderModels = useMemo(
    () => modelsByProvider[activeProvider] ?? [],
    [activeProvider, modelsByProvider],
  );
  const filteredModels = useMemo(
    () => filterModels(activeProviderModels, query),
    [activeProviderModels, query],
  );

  const refreshCatalog = useCallback(
    async (force = false) => {
      setCatalogLoading(true);
      setCatalogWarning(null);
      try {
        const canUseLiveApi =
          !demo &&
          !!activeProvider &&
          !!apiKey.trim() &&
          validateApiKeyShape(apiKey, activeProvider);
        const res = await fetch('/api/models/catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            aiProvider: activeProvider,
            apiKey: canUseLiveApi ? apiKey : undefined,
            force,
          }),
        });
        const body = (await res.json()) as ModelCatalogResult;
        if (!res.ok) throw new Error(body.warning ?? 'Nie udało się pobrać katalogu modeli.');
        setCatalog((prev) => mergeCatalog(prev, body.models));
        setCatalogSource(body.source);
        setCatalogFetchedAt(body.fetchedAt);
        setCatalogWarning(body.warning ?? null);
      } catch (err) {
        setCatalogWarning(err instanceof Error ? err.message : 'Nie udało się pobrać katalogu modeli.');
      } finally {
        setCatalogLoading(false);
      }
    },
    [activeProvider, apiKey, demo],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      void refreshCatalog(false);
    }, apiKey ? 500 : 0);
    return () => clearTimeout(handle);
  }, [activeProvider, apiKey, refreshCatalog]);

  useEffect(() => {
    if (demo) {
      onApiKeyValidChange(true);
      return;
    }
    if (!selectedProvider || !selectedModel || !apiKey) {
      onApiKeyValidChange(null);
      return;
    }
    if (!validateApiKeyShape(apiKey, selectedProvider)) {
      onApiKeyValidChange(false);
      return;
    }
    const handle = setTimeout(async () => {
      setValidating(true);
      try {
        const res = await fetch('/api/ai/validate-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            aiProvider: selectedProvider,
            aiModel: selectedModel,
            apiKey,
            locale,
          }),
        });
        onApiKeyValidChange(res.ok);
      } catch {
        onApiKeyValidChange(false);
      } finally {
        setValidating(false);
      }
    }, 700);
    return () => clearTimeout(handle);
  }, [apiKey, demo, locale, onApiKeyValidChange, selectedModel, selectedProvider]);

  const recommendationModel = recommendation
    ? getModelConfig(recommendation.recommended, catalog)
    : undefined;

  return (
    <div className="space-y-8">
      {recommendation && (
        <Card variant="inset" padding="lg">
          <p className="eyebrow mb-2">Rekomendacja modelu</p>
          <h2 className="font-display text-3xl text-ink">
            {recommendationModel?.name ?? recommendation.recommended}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">{recommendation.reason}</p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {AI_PROVIDERS.map((provider) => {
          const providerModels = modelsByProvider[provider] ?? [];
          return (
            <Button
              key={provider}
              variant={activeProvider === provider ? 'primary' : 'outline'}
              size="sm"
              onClick={() => {
                const first = providerModels[0] ?? getDefaultModelForProvider(provider, catalog);
                onSelect(first.provider, first.modelId);
                setQuery('');
              }}
            >
              {AI_PROVIDER_LABELS[provider]}
              {providerModels.length > 0 ? ` (${providerModels.length})` : ''}
            </Button>
          );
        })}
      </div>

      <Card variant="ghost" padding="lg">
        <div className="grid lg:grid-cols-[1fr_auto] gap-4 items-end">
          <Input
            label="Klucz API"
            type="password"
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder={demo ? 'Tryb demo nie wymaga klucza' : 'Wklej swój klucz tutaj'}
            disabled={demo}
            iconRight={
              validating ? (
                <Sparkles size={14} className="text-sienna" />
              ) : apiKeyValid === true ? (
                <Check size={14} className="text-success" />
              ) : apiKeyValid === false ? (
                <AlertCircle size={14} className="text-danger" />
              ) : undefined
            }
            successText={apiKeyValid === true ? 'Klucz działa' : undefined}
            errorText={apiKeyValid === false ? 'Klucz nie zadziałał albo ma niepoprawny format' : undefined}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenTutorial(activeProvider)}
              disabled={demo}
            >
              Nie mam klucza
            </Button>
            <Button
              variant="outline"
              onClick={() => void refreshCatalog(true)}
              disabled={demo || !apiKey.trim() || catalogLoading}
              iconLeft={
                catalogLoading ? (
                  <Loader size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )
              }
            >
              Odśwież modele z API
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <Badge tone={catalogSource === 'live' ? 'success' : 'neutral'}>
            {catalogSource === 'live' ? 'Lista z API' : 'Lista bazowa'}
          </Badge>
          <span>
            {catalogFetchedAt
              ? `Aktualizacja: ${new Date(catalogFetchedAt).toLocaleString(locale === 'pl' ? 'pl-PL' : 'en-US')}`
              : 'Katalog odświeża się automatycznie po podaniu klucza.'}
          </span>
        </div>
        {catalogWarning && (
          <p className="mt-3 text-xs text-danger">
            Nie udało się odświeżyć katalogu z API. Pokazuję listę bazową. {catalogWarning}
          </p>
        )}
      </Card>

      <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
        <Input
          label="Szukaj modelu"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="np. mini, opus, flash, gpt-5"
          iconLeft={<Search size={14} />}
        />
        <p className="text-sm text-ink-muted">
          {filteredModels.length} z {activeProviderModels.length} modeli
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {filteredModels.map((model) => (
          <ModelCard
            key={`${model.provider}:${model.modelId}`}
            model={model}
            locale={locale}
            selected={selectedModel === model.modelId}
            recommended={
              recommendation?.recommended === model.id || recommendation?.recommended === model.modelId
            }
            onSelect={() => onSelect(model.provider, model.modelId)}
          />
        ))}
      </div>
    </div>
  );
}

function ModelCard({
  model,
  locale,
  selected,
  recommended,
  onSelect,
}: {
  model: ModelConfig;
  locale: AppLocale;
  selected: boolean;
  recommended: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left"
      disabled={Boolean(model.disabledReason)}
    >
      <Card interactive selected={selected} padding="lg" className="h-full">
        <div className="flex justify-between gap-3">
          <Badge tone="editorial">{AI_PROVIDER_LABELS[model.provider]}</Badge>
          <div className="flex flex-wrap justify-end gap-2">
            {model.source === 'provider-api' && <Badge tone="success">API</Badge>}
            {recommended && <Badge tone="accent">Polecany</Badge>}
          </div>
        </div>
        <h3 className="font-display text-2xl text-ink mt-5">{model.name}</h3>
        <p className="text-sm text-ink-muted mt-2">{model.description[locale]}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="neutral">~{model.estimatedSeconds}s</Badge>
          <Badge tone={model.costBasis === 'official' ? 'neutral' : 'editorial'}>
            {getModelDisplayCost(model, locale)}
          </Badge>
          <Badge tone={model.quality === 'highest' ? 'accent' : 'neutral'}>{model.quality}</Badge>
          <Badge tone="neutral">{formatContext(model.contextTokens)}</Badge>
          {model.maxOutputTokens && <Badge tone="neutral">out {formatContext(model.maxOutputTokens)}</Badge>}
        </div>
        {model.pricing && (
          <p className="mt-4 text-xs text-ink-muted">
            ${model.pricing.inputUsdPer1M?.toFixed(2) ?? '?'} / 1M input,
            {' '}
            ${model.pricing.outputUsdPer1M?.toFixed(2) ?? '?'} / 1M output
          </p>
        )}
      </Card>
    </button>
  );
}

function groupByProvider(models: readonly ModelConfig[]) {
  return models.reduce(
    (acc, model) => {
      acc[model.provider] ??= [];
      acc[model.provider]!.push(model);
      return acc;
    },
    {} as Record<AIProvider, ModelConfig[]>,
  );
}

function mergeCatalog(current: readonly ModelConfig[], incoming: readonly ModelConfig[]): ModelConfig[] {
  const byKey = new Map<string, ModelConfig>();
  for (const model of current) byKey.set(`${model.provider}:${model.modelId}`, model);
  for (const model of incoming) byKey.set(`${model.provider}:${model.modelId}`, model);
  return sortModelCatalog([...byKey.values()]);
}

function filterModels(models: readonly ModelConfig[], query: string): ModelConfig[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return sortModelCatalog(models);
  return sortModelCatalog(
    models.filter((model) =>
      [
        model.name,
        model.modelId,
        model.description.pl,
        model.description.en,
        model.quality,
        model.capabilities?.join(' ') ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalized),
    ),
  );
}

function formatContext(tokens: number): string {
  if (tokens >= 1_000_000) return `${Number((tokens / 1_000_000).toFixed(1))}M ctx`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}k ctx`;
  return `${tokens} ctx`;
}
