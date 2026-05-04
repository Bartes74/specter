'use client';

import type { ReactNode } from 'react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Asterisk, Check, FileText, Monitor, Sparkles } from './ui/Icon';
import type { TargetTool } from '@/types/providers';
import type { AppLocale, Recommendation } from '@/types/session';

const TOOLS: Array<{
  id: TargetTool;
  name: string;
  icon: ReactNode;
  description: Record<AppLocale, string>;
}> = [
  {
    id: 'universal',
    name: 'Uniwersalny',
    icon: <Check size={18} />,
    description: {
      pl: 'Neutralny Markdown zrozumiały dla dowolnego narzędzia AI.',
      en: 'Neutral Markdown readable by any AI tool.',
    },
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    icon: <Sparkles size={18} />,
    description: {
      pl: 'Długi kontekst, refaktoryzacje i precyzyjna specyfikacja.',
      en: 'Long context, refactors, and precise specifications.',
    },
  },
  {
    id: 'codex',
    name: 'Codex',
    icon: <Asterisk size={18} />,
    description: {
      pl: 'Instrukcje krok po kroku, dobre dla pracy w repo i automatyzacji.',
      en: 'Step-by-step instructions, good for repo work and automation.',
    },
  },
  {
    id: 'copilot',
    name: 'Copilot',
    icon: <FileText size={18} />,
    description: {
      pl: 'Naturalny wybór dla pracy blisko GitHuba i Pull Requestów.',
      en: 'Natural choice for GitHub and pull-request centered work.',
    },
  },
  {
    id: 'gemini',
    name: 'Gemini',
    icon: <Monitor size={18} />,
    description: {
      pl: 'Szeroki kontekst, ekosystem Google i projekty multimodalne.',
      en: 'Broad context, Google ecosystem, and multimodal projects.',
    },
  },
];

export function ToolSelector({
  locale,
  selectedTool,
  recommendation,
  onSelect,
}: {
  locale: AppLocale;
  selectedTool: TargetTool | null;
  recommendation: Recommendation<TargetTool> | null;
  onSelect: (tool: TargetTool) => void;
}) {
  return (
    <div className="space-y-8">
      {recommendation && (
        <Card variant="inset" padding="lg">
          <p className="eyebrow mb-2">Rekomendacja</p>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="font-display text-3xl text-ink leading-tight">
                {TOOLS.find((t) => t.id === recommendation.recommended)?.name ?? recommendation.recommended}
              </h2>
              <p className="mt-2 text-sm text-ink-muted">{recommendation.reason}</p>
            </div>
            <Button variant="primary" onClick={() => onSelect(recommendation.recommended)}>
              Użyj rekomendacji
            </Button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {TOOLS.map((tool) => {
          const selected = selectedTool === tool.id;
          const recommended = recommendation?.recommended === tool.id;
          return (
            <button key={tool.id} type="button" onClick={() => onSelect(tool.id)} className="text-left">
              <Card interactive selected={selected} padding="lg" className="h-full">
                <div className="flex items-start justify-between gap-4">
                  <div className="h-10 w-10 rounded-sm grid place-items-center bg-bg-inset text-sienna">
                    {tool.icon}
                  </div>
                  {recommended && <Badge tone="accent">Polecane</Badge>}
                </div>
                <h3 className="font-display text-2xl text-ink mt-7">{tool.name}</h3>
                <p className="text-sm text-ink-muted mt-2 leading-relaxed">
                  {tool.description[locale]}
                </p>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
