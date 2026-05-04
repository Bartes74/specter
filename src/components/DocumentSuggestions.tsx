'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Textarea } from './ui/Input';
import { Spinner } from './ui/Spinner';
import {
  buildAutonomousSuggestionNote,
  evaluateSuggestionDecision,
} from '@/lib/document-suggestions';
import type { DocumentSuggestion, DocumentSuggestionDecision } from '@/types/session';

type DecisionDraft = {
  decision: DocumentSuggestionDecision['decision'];
  note: string;
};

export function DocumentSuggestions({
  suggestions,
  status,
  iteration,
  maxIterations,
  onApplyDecisions,
  onAnalyzeAgain,
}: {
  suggestions: DocumentSuggestion[];
  status: 'idle' | 'analyzing' | 'complete' | 'error';
  iteration: number;
  maxIterations: number;
  onApplyDecisions: (decisions: DocumentSuggestionDecision[]) => Promise<void>;
  onAnalyzeAgain: () => void;
}) {
  const [decisions, setDecisions] = useState<Record<string, DecisionDraft>>({});
  const [applying, setApplying] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    const activeIds = new Set(suggestions.map((suggestion) => suggestion.id));
    setDecisions((prev) =>
      Object.fromEntries(Object.entries(prev).filter(([id]) => activeIds.has(id))),
    );
  }, [suggestions]);

  const decidedCount = useMemo(
    () => suggestions.filter((suggestion) => Boolean(decisions[suggestion.id]?.decision)).length,
    [decisions, suggestions],
  );
  const allDecided = suggestions.length > 0 && decidedCount === suggestions.length;
  const displayIteration = Math.min(Math.max(iteration, 1), maxIterations);
  const isFinalIteration = displayIteration >= maxIterations;

  if (status === 'analyzing') {
    return (
      <Card variant="inset" padding="md">
        <div className="flex items-center gap-3">
          <Spinner size="sm" className="text-sienna" label="Analizuję dokumenty" />
          <div>
            <p className="text-sm text-ink">Analizuję wygenerowane dokumenty.</p>
            <p className="mt-1 text-xs text-ink-muted">
              Sugestie pojawią się za chwilę. To runda {Math.min(iteration + 1, maxIterations)} z {maxIterations}.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card variant="inset" padding="md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm text-ink">
              {iteration >= maxIterations
                ? 'Zakończono limit dwóch rund sugestii dla tej wersji dokumentów.'
                : status === 'complete'
                ? 'Brak aktywnych sugestii dla tej wersji dokumentów.'
                : status === 'error'
                  ? 'Analiza sugestii nie powiodła się.'
                  : 'Sugestie nie zostały jeszcze uruchomione.'}
            </p>
            <p className="mt-1 text-xs text-ink-muted">
              {iteration >= maxIterations
                ? 'Dokumenty są gotowe do zapisu albo ręcznej edycji bez kolejnej pętli pytań.'
                : 'Analiza nie uruchamia się w pętli po samym zapisie plików.'}
            </p>
          </div>
          {iteration < maxIterations && (
            <Button variant="outline" size="sm" onClick={onAnalyzeAgain}>
              Sprawdź ponownie
            </Button>
          )}
        </div>
      </Card>
    );
  }

  const decisionPayload = (): DocumentSuggestionDecision[] =>
    suggestions.map((suggestion) => ({
      suggestion,
      decision: decisions[suggestion.id]!.decision,
      note:
        decisions[suggestion.id]!.decision === 'accepted' && !decisions[suggestion.id]?.note.trim()
          ? buildAutonomousSuggestionNote(suggestion)
          : decisions[suggestion.id]?.note ?? '',
    }));

  return (
    <div className="space-y-3">
      <Card variant="inset" padding="md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm text-ink">Najpierw zdecyduj o każdej sugestii.</p>
            <p className="mt-1 text-xs text-ink-muted">
              To runda {displayIteration} z {maxIterations}. {isFinalIteration
                ? 'Po tej regeneracji aplikacja zakończy analizę sugestii.'
                : 'Po regeneracji będzie jeszcze jedna kontrolna analiza.'}
            </p>
          </div>
          <Badge tone={allDecided ? 'accent' : 'neutral'}>
            Decyzje {decidedCount} / {suggestions.length}
          </Badge>
        </div>
      </Card>

      {suggestions.map((suggestion) => {
        const draft = decisions[suggestion.id];
        const decision = draft?.decision;
        const quality = evaluateSuggestionDecision(suggestion, decision, draft?.note ?? '');
        const noteLabel =
          decision === 'accepted'
            ? 'Informacje do wdrożenia'
            : 'Powód odrzucenia lub decyzja biznesowa';
        const notePlaceholder =
          decision === 'accepted'
            ? 'Dopisz decyzję, ograniczenie, przykład procesu albo dane potrzebne do poprawienia dokumentu...'
            : 'Krótko zapisz, dlaczego ta sugestia nie dotyczy projektu lub nie powinna wracać w kolejnej analizie...';

        return (
          <Card key={suggestion.id} variant="ghost" padding="md">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <div className="flex flex-wrap gap-2 mb-2">
                  <Badge
                    tone={
                      suggestion.severity === 'critical'
                        ? 'danger'
                        : suggestion.severity === 'warning'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {suggestion.severity}
                  </Badge>
                  <Badge tone="editorial">{suggestion.documentType}</Badge>
                </div>
                <p className="text-sm text-ink">{suggestion.message}</p>
                <p className="mt-1 text-xs text-ink-muted">{suggestion.suggestedAction}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant={decision === 'accepted' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() =>
                    setDecisions((prev) => ({
                      ...prev,
                      [suggestion.id]: { decision: 'accepted', note: prev[suggestion.id]?.note ?? '' },
                    }))
                  }
                >
                  Akceptuję
                </Button>
                <Button
                  variant={decision === 'rejected' ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() =>
                    setDecisions((prev) => ({
                      ...prev,
                      [suggestion.id]: { decision: 'rejected', note: prev[suggestion.id]?.note ?? '' },
                    }))
                  }
                >
                  Odrzucam
                </Button>
              </div>
            </div>

            {decision && (
              <div className="mt-5 border-t border-rule pt-5">
                <div className="mb-4 rounded-md border border-rule bg-bg-inset/70 p-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={qualityTone(quality.level)}>{quality.label}</Badge>
                      <span className="text-xs text-ink-muted">{quality.score}% precyzji</span>
                    </div>
                    {decision === 'accepted' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDecisions((prev) => ({
                            ...prev,
                            [suggestion.id]: {
                              decision,
                              note: buildAutonomousSuggestionNote(suggestion),
                            },
                          }))
                        }
                      >
                        Nie wiem, zaproponuj optymalnie
                      </Button>
                    )}
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rule">
                    <div
                      className={`h-full rounded-full ${qualityBarClass(quality.level)}`}
                      style={{ width: `${quality.score}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-ink-muted">{quality.helperText}</p>
                  {quality.missing.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                      {quality.missing.map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <Textarea
                  label={noteLabel}
                  value={draft?.note ?? ''}
                  onChange={(event) =>
                    setDecisions((prev) => ({
                      ...prev,
                      [suggestion.id]: {
                        decision,
                        note: event.target.value,
                      },
                    }))
                  }
                  placeholder={notePlaceholder}
                  className="min-h-[110px]"
                />
              </div>
            )}
          </Card>
        );
      })}

      <Card variant="inset" padding="md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm text-ink">Po zebraniu decyzji wygenerujemy nowe wersje dokumentów.</p>
            <p className="mt-1 text-xs text-ink-muted">
              {isFinalIteration
                ? 'To ostatnia runda. Po regeneracji aplikacja nie będzie zadawać kolejnych pytań z sugestii.'
                : 'Kolejna analiza uruchomi się dopiero po tej regeneracji i pominie odrzucone tematy.'}
            </p>
            {errorText && <p className="mt-2 text-sm text-danger">{errorText}</p>}
          </div>
          <Button
            variant="primary"
            loading={applying}
            disabled={!allDecided}
            onClick={async () => {
              setApplying(true);
              setErrorText(null);
              try {
                await onApplyDecisions(decisionPayload());
                setDecisions({});
              } catch (err) {
                setErrorText((err as Error).message);
              } finally {
                setApplying(false);
              }
            }}
          >
            {isFinalIteration ? 'Wygeneruj finalne wersje' : 'Wygeneruj nowe wersje dokumentów'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function qualityTone(level: ReturnType<typeof evaluateSuggestionDecision>['level']) {
  if (level === 'strong') return 'success';
  if (level === 'usable' || level === 'delegated') return 'accent';
  return 'warning';
}

function qualityBarClass(level: ReturnType<typeof evaluateSuggestionDecision>['level']) {
  if (level === 'strong') return 'bg-success';
  if (level === 'usable' || level === 'delegated') return 'bg-sienna';
  return 'bg-warning';
}
