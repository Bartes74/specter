'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Textarea } from './ui/Input';
import { SegmentedControl } from './ui/SegmentedControl';
import { DocumentSuggestions } from './DocumentSuggestions';
import { DocumentDiff } from './DocumentDiff';
import type { DocumentSuggestion, DocumentSuggestionDecision } from '@/types/session';

type DocType = 'requirements' | 'design' | 'tasks';
type Documents = Record<DocType, string | null>;

export function DocumentPreview({
  documents,
  suggestions,
  suggestionStatus,
  suggestionIteration,
  maxSuggestionIterations,
  onChangeDocument,
  onRegenerate,
  onApplySuggestionDecisions,
  onAnalyzeSuggestions,
}: {
  documents: Documents;
  suggestions: DocumentSuggestion[];
  suggestionStatus: 'idle' | 'analyzing' | 'complete' | 'error';
  suggestionIteration: number;
  maxSuggestionIterations: number;
  onChangeDocument: (type: DocType, content: string, options?: { suppressSuggestionAnalysis?: boolean }) => void;
  onRegenerate: (type: DocType, instructions: string) => Promise<string | void>;
  onApplySuggestionDecisions: (decisions: DocumentSuggestionDecision[]) => Promise<void>;
  onAnalyzeSuggestions: () => void;
}) {
  const [active, setActive] = useState<DocType>('requirements');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(documents[active] ?? '');
  const [instructions, setInstructions] = useState('');
  const [diff, setDiff] = useState<{
    previous: string;
    next: string;
  } | null>(null);

  const setActiveDoc = (doc: DocType) => {
    setActive(doc);
    setEditing(false);
    setDraft(documents[doc] ?? '');
    setDiff(null);
  };

  const content = documents[active] ?? '';

  const regenerate = async () => {
    const previous = content;
    const next = await onRegenerate(active, instructions);
    if (typeof next === 'string') {
      setDiff({ previous, next });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <SegmentedControl
          value={active}
          onChange={setActiveDoc}
          options={[
            { value: 'requirements', label: 'requirements.md' },
            { value: 'design', label: 'design.md' },
            { value: 'tasks', label: 'tasks.md' },
          ]}
        />
      </div>

      {diff && (
        <DocumentDiff
          previousContent={diff.previous}
          newContent={diff.next}
          onAcceptChanges={() => {
            onChangeDocument(active, diff.next);
            setDiff(null);
          }}
          onRevertChanges={() => setDiff(null)}
        />
      )}

      <Card variant="default" padding="lg">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <p className="eyebrow">{active}.md</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(content);
                setEditing((v) => !v);
              }}
            >
              {editing ? 'Podgląd' : 'Edytuj'}
            </Button>
            {editing && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  onChangeDocument(active, draft);
                  setEditing(false);
                }}
              >
                Zastosuj edycję
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[520px] font-mono text-sm" />
        ) : (
          <article className="max-w-none text-ink prose-headings:font-display">
            <ReactMarkdown>{content || '_Brak treści._'}</ReactMarkdown>
          </article>
        )}
      </Card>

      <Card variant="ghost" padding="lg">
        <p className="eyebrow mb-3">Regeneracja</p>
        <Textarea
          value={instructions}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="Dodatkowe wskazówki do regeneracji..."
          className="min-h-[100px]"
        />
        <div className="mt-3 flex justify-end">
          <Button variant="outline" onClick={regenerate}>
            Wygeneruj ponownie
          </Button>
        </div>
      </Card>

      <section>
        <p className="eyebrow mb-4">Sugestie AI</p>
        <DocumentSuggestions
          suggestions={suggestions}
          status={suggestionStatus}
          iteration={suggestionIteration}
          maxIterations={maxSuggestionIterations}
          onApplyDecisions={onApplySuggestionDecisions}
          onAnalyzeAgain={onAnalyzeSuggestions}
        />
      </section>
    </div>
  );
}
