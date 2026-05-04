'use client';

import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Check, Loader } from './ui/Icon';
import type { GenerationDocuments, GenerationProgressState } from '@/lib/useGeneration';

const DOCS = [
  ['requirements', 'requirements.md'],
  ['design', 'design.md'],
  ['tasks', 'tasks.md'],
] as const;

export function GenerationProgress({
  progress,
  documents,
}: {
  progress: GenerationProgressState;
  documents: GenerationDocuments;
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
            </Card>
          );
        })}
      </div>

      <Card variant="ghost" padding="lg">
        <p className="eyebrow mb-2">Status</p>
        <p className="text-lg text-ink">
          {progress.message || (progress.status === 'completed' ? 'Generowanie zakończone' : 'Gotowe do startu')}
        </p>
        {progress.error && <p className="mt-2 text-sm text-danger">{progress.error.message}</p>}
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
