'use client';

import type { ErrorProfileData, FixAction } from '@/lib/errors';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { AlertCircle, Check } from './ui/Icon';

export function ErrorProfile({
  data,
  onAction,
  onDismiss,
}: {
  data: ErrorProfileData;
  onAction: (action: FixAction) => void;
  onDismiss?: () => void;
}) {
  return (
    <Card variant="ghost" padding="lg" className="border-danger/40 bg-danger/5">
      <div className="flex items-start gap-4">
        <div className="mt-1 text-danger">
          <AlertCircle size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-2">Profil błędu · {data.code}</p>
          <h3 className="font-display text-3xl text-ink leading-tight">{data.whatHappened}</h3>
          <p className="mt-3 text-sm text-ink-muted">{data.whatItMeans}</p>

          <div className="mt-6 grid md:grid-cols-2 gap-6">
            <section>
              <p className="eyebrow mb-3">Jak to naprawić</p>
              <ol className="space-y-2">
                {data.howToFix.map((step, index) => (
                  <li key={index} className="flex gap-2 text-sm text-ink-muted">
                    <Check size={14} className="mt-0.5 shrink-0 text-success" />
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
            <section>
              <p className="eyebrow mb-3">Akcje</p>
              <div className="flex flex-wrap gap-2">
                {data.fixActions.map((action) => (
                  <Button
                    key={`${action.kind}-${action.label}`}
                    variant={action.primary ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onAction(action)}
                  >
                    {action.label}
                  </Button>
                ))}
                {onDismiss && (
                  <Button variant="ghost" size="sm" onClick={onDismiss}>
                    Zamknij
                  </Button>
                )}
              </div>
              <p className="mt-4 font-mono text-2xs text-ink-subtle break-all">
                ID: {data.errorId}
              </p>
            </section>
          </div>
        </div>
      </div>
    </Card>
  );
}
