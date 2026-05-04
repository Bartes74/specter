'use client';

import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { AI_PROVIDER_LABELS, type AIProvider } from '@/types/providers';
import type { AppLocale } from '@/types/session';

interface TutorialResponse {
  contentMarkdown: string;
  estimatedCostUsd: { min: number; max: number };
  freeTier?: { available: boolean; description: string };
  sourceUrl: string;
  staleWarning?: string;
}

export function ApiKeyTutorial({
  provider,
  locale,
  onClose,
  onComplete,
}: {
  provider: AIProvider;
  locale: AppLocale;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [tutorial, setTutorial] = useState<TutorialResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/tutorials/${provider}?locale=${locale}`)
      .then((res) => res.json())
      .then((body) => {
        if (!cancelled) setTutorial(body as TutorialResponse);
      })
      .catch(() => {
        if (!cancelled) setTutorial(null);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, provider]);

  return (
    <div className="fixed inset-0 z-50 bg-ink/35 p-4 md:p-8 overflow-y-auto">
      <Card variant="elevated" padding="xl" className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <p className="eyebrow mb-2">Tutorial klucza API</p>
            <h2 className="font-display text-4xl text-ink">{AI_PROVIDER_LABELS[provider]}</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>Zamknij</Button>
        </div>

        {tutorial?.staleWarning && (
          <div className="mb-6 rounded border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            {tutorial.staleWarning}{' '}
            <a href={tutorial.sourceUrl} target="_blank" rel="noreferrer" className="underline">
              Otwórz źródło
            </a>
          </div>
        )}

        {tutorial ? (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              <Badge tone="accent">
                Koszt ~${tutorial.estimatedCostUsd.min}–${tutorial.estimatedCostUsd.max}
              </Badge>
              {tutorial.freeTier && (
                <Badge tone={tutorial.freeTier.available ? 'success' : 'neutral'}>
                  {tutorial.freeTier.available ? 'Darmowy plan dostępny' : 'Bez darmowego planu'}
                </Badge>
              )}
            </div>
            <article className="prose prose-sm max-w-none text-ink prose-headings:font-display prose-a:text-sienna">
              <ReactMarkdown>{tutorial.contentMarkdown}</ReactMarkdown>
            </article>
          </>
        ) : (
          <p className="text-ink-muted">Ładowanie instrukcji...</p>
        )}

        <div className="mt-8 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Zamknij</Button>
          <Button variant="primary" onClick={onComplete}>Mam klucz</Button>
        </div>
      </Card>
    </div>
  );
}
