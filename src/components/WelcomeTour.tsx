'use client';

import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import type { AppLocale } from '@/types/session';

const STEPS = {
  pl: [
    ['Co robi aplikacja', 'Spec Generator prowadzi Cię od prostego opisu do trzech gotowych dokumentów projektu.'],
    ['Jak wygląda przepływ', 'Najpierw wybierasz folder, potem odpowiadasz na krótkie pytania, a aplikacja generuje specyfikację.'],
    ['Klucz API', 'Prawdziwe generowanie wymaga klucza dostawcy AI. Tryb demo działa bez klucza i bez zapisów na dysk.'],
    ['Pomoc', 'Tutoriale kluczy i generator standardów są dostępne w trakcie wizarda.'],
  ],
  en: [
    ['What it does', 'Spec Generator turns a plain project description into three ready project documents.'],
    ['The flow', 'Pick a folder, answer short questions, then generate the specification.'],
    ['API key', 'Real generation requires an AI provider key. Demo mode works without a key and without disk writes.'],
    ['Help', 'Key tutorials and standards generation are available inside the wizard.'],
  ],
};

export function WelcomeTour({
  locale,
  stepIndex,
  onAdvance,
  onSkip,
  onStartDemo,
}: {
  locale: AppLocale;
  stepIndex: number;
  onAdvance: () => void;
  onSkip: () => void;
  onStartDemo: () => void;
}) {
  const steps = STEPS[locale];
  const current = steps[stepIndex] ?? steps[0]!;
  const last = stepIndex >= steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-ink/35 p-4 md:p-8 grid place-items-center">
      <Card variant="elevated" padding="xl" className="w-full max-w-2xl">
        <Badge tone="editorial">Wprowadzenie {stepIndex + 1} / {steps.length}</Badge>
        <h2 className="mt-5 font-display text-5xl text-ink leading-none">{current[0]}</h2>
        <p className="mt-5 text-lg text-ink-muted leading-relaxed">{current[1]}</p>
        <div className="mt-10 flex flex-wrap justify-between gap-2">
          <Button variant="ghost" onClick={onSkip}>Pomiń wprowadzenie</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onStartDemo}>Wypróbuj demo</Button>
            <Button variant="primary" onClick={last ? onSkip : onAdvance}>
              {last ? 'Zaczynamy' : 'Dalej'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
