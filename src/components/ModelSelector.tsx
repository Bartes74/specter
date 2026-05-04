'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AlertCircle, Check, Sparkles } from './ui/Icon';
import { MODEL_CATALOG, type ModelConfig } from '@/types/models';
import { AI_PROVIDER_LABELS, type AIProvider } from '@/types/providers';
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
  const modelsByProvider = useMemo(() => groupByProvider(MODEL_CATALOG), []);
  const activeProvider = selectedProvider ?? MODEL_CATALOG[0]!.provider;

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

  return (
    <div className="space-y-8">
      {recommendation && (
        <Card variant="inset" padding="lg">
          <p className="eyebrow mb-2">Rekomendacja modelu</p>
          <h2 className="font-display text-3xl text-ink">
            {MODEL_CATALOG.find((m) => m.id === recommendation.recommended)?.name ??
              recommendation.recommended}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">{recommendation.reason}</p>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.keys(modelsByProvider).map((provider) => (
          <Button
            key={provider}
            variant={activeProvider === provider ? 'primary' : 'outline'}
            size="sm"
            onClick={() => {
              const first = modelsByProvider[provider as AIProvider]![0]!;
              onSelect(first.provider, first.modelId);
            }}
          >
            {AI_PROVIDER_LABELS[provider as AIProvider]}
          </Button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {modelsByProvider[activeProvider]!.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            locale={locale}
            selected={selectedModel === model.modelId}
            recommended={recommendation?.recommended === model.id}
            onSelect={() => onSelect(model.provider, model.modelId)}
          />
        ))}
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
          <Button
            variant="outline"
            onClick={() => onOpenTutorial(activeProvider)}
            disabled={demo}
          >
            Nie mam klucza
          </Button>
        </div>
      </Card>
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
    <button type="button" onClick={onSelect} className="text-left">
      <Card interactive selected={selected} padding="lg" className="h-full">
        <div className="flex justify-between gap-3">
          <Badge tone="editorial">{AI_PROVIDER_LABELS[model.provider]}</Badge>
          {recommended && <Badge tone="accent">Polecany</Badge>}
        </div>
        <h3 className="font-display text-2xl text-ink mt-5">{model.name}</h3>
        <p className="text-sm text-ink-muted mt-2">{model.description[locale]}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge tone="neutral">~{model.estimatedSeconds}s</Badge>
          <Badge tone="neutral">~${model.estimatedCostUsd.toFixed(2)}</Badge>
          <Badge tone={model.quality === 'highest' ? 'accent' : 'neutral'}>{model.quality}</Badge>
        </div>
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
