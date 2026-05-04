'use client';

import { diffLines } from 'diff';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { cn } from '@/lib/cn';

export function DocumentDiff({
  previousContent,
  newContent,
  onAcceptChanges,
  onRevertChanges,
}: {
  previousContent: string;
  newContent: string;
  onAcceptChanges: () => void;
  onRevertChanges: () => void;
}) {
  const parts = diffLines(previousContent, newContent);
  return (
    <Card variant="ghost" padding="lg">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="eyebrow mb-1">Diff</p>
          <h3 className="font-display text-2xl text-ink">Co się zmieniło</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={onAcceptChanges}>Zaakceptuj</Button>
          <Button variant="ghost" size="sm" onClick={onRevertChanges}>Cofnij</Button>
        </div>
      </div>
      <pre className="max-h-80 overflow-auto rounded border border-rule bg-bg-inset p-3 text-xs font-mono">
        {parts.map((part, index) => (
          <span
            key={index}
            className={cn(
              part.added && 'bg-success/10 text-success',
              part.removed && 'bg-danger/10 text-danger line-through',
            )}
          >
            {part.value}
          </span>
        ))}
      </pre>
    </Card>
  );
}
