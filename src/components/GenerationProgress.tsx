'use client';

import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Check, Loader, X } from './ui/Icon';
import type { GenerationDocuments, GenerationProgressState } from '@/lib/useGeneration';

const DOCS = [
  ['requirements', 'requirements.md'],
  ['design', 'design.md'],
  ['tasks', 'tasks.md'],
] as const;

export function GenerationProgress({
  progress,
  documents,
  onStop,
}: {
  progress: GenerationProgressState;
  documents: GenerationDocuments;
  onStop?: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-3 gap-4">
        {DOCS.map(([id, label]) => {
          const completed = Boolean(documents[id]);
          const active = progress.activeStep === id && progress.status === 'generating';
          return (
            <Card key={id} padding="lg" selected={active} variant={completed ? 'inset' : 'default'}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl text-ink">{label}</h3>
                {completed ? (
                  <Check size={18} className="text-success" />
                ) : active ? (
                  <Loader size={18} className="text-sienna animate-spin" />
                ) : (
                  <Badge tone="neutral">Oczekuje</Badge>
                )}
              </div>
              {active && progress.section?.document === id && (
                <p className="mt-4 text-sm text-ink-muted">
                  {progress.section.total > 0
                    ? `Sekcja ${progress.section.index}/${progress.section.total}: ${progress.section.sectionTitle}`
                    : 'Planowanie sekcji'}
                </p>
              )}
            </Card>
          );
        })}
      </div>

      <Card variant="ghost" padding="lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="eyebrow mb-2">Status</p>
            <p className="text-lg text-ink">
              {progress.message || (progress.status === 'completed' ? 'Generowanie zakończone' : 'Gotowe do startu')}
            </p>
            {progress.error && <p className="mt-2 text-sm text-danger">{progress.error.message}</p>}
          </div>
          {progress.status === 'generating' && onStop && (
            <Button variant="danger" iconLeft={<X size={14} />} onClick={onStop}>
              Stop
            </Button>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {DOCS.map(([id, label]) => (
          <Card key={id} variant="inset" padding="md">
            <p className="eyebrow mb-2">{label}</p>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap text-xs font-mono text-ink-muted">
              {documents[id]?.slice(0, 1600) || '...'}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
