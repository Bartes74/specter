'use client';

import { useEffect, useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Textarea } from './ui/Input';
import { Badge } from './ui/Badge';
import { stripMarkdownCodeFence } from '@/lib/markdown';
import type { AppLocale, Question, QuestionAnswer } from '@/types/session';

export interface StandardsProfile {
  id: string;
  name: string;
  description: string;
  followUpQuestions: Question[];
}

export function StandardsGenerator({
  locale,
  existingStandards,
  standardsSource,
  onUseStandards,
  onSkip,
  onGenerate,
  onRegenerate,
  onSave,
}: {
  locale: AppLocale;
  existingStandards?: string | null;
  standardsSource?: 'existing' | 'generated' | 'skipped' | null;
  onUseStandards: (content: string, source: 'existing' | 'generated') => void;
  onSkip: () => void;
  onGenerate: (profile: StandardsProfile, answers: QuestionAnswer[]) => Promise<string>;
  onRegenerate: (profile: StandardsProfile, answers: QuestionAnswer[]) => Promise<string>;
  onSave: (content: string) => Promise<void>;
}) {
  const normalizedExistingStandards =
    existingStandards && existingStandards.trim().length > 0
      ? stripMarkdownCodeFence(existingStandards)
      : null;
  const [mode, setMode] = useState<'choice' | 'profiles' | 'questions' | 'preview'>(
    normalizedExistingStandards ? 'preview' : 'choice',
  );
  const [profiles, setProfiles] = useState<StandardsProfile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<StandardsProfile | null>(null);
  const [answers, setAnswers] = useState<QuestionAnswer[]>([]);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [content, setContent] = useState(normalizedExistingStandards ?? '');
  const [contentSource, setContentSource] = useState<'existing' | 'generated'>(
    standardsSource === 'existing' ? 'existing' : 'generated',
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/standards/profiles?locale=${locale}`)
      .then((res) => res.json())
      .then((body) => setProfiles(body.profiles ?? []))
      .catch(() => setProfiles([]));
  }, [locale]);

  useEffect(() => {
    const nextExisting =
      existingStandards && existingStandards.trim().length > 0
        ? stripMarkdownCodeFence(existingStandards)
        : null;
    if (nextExisting) {
      setContent((prev) => (prev === nextExisting ? prev : nextExisting));
      setContentSource(standardsSource === 'existing' ? 'existing' : 'generated');
      setMode('preview');
    }
  }, [existingStandards, standardsSource]);

  if (mode === 'choice') {
    return (
      <div className="max-w-3xl space-y-5">
        <Card variant="inset" padding="lg">
          <h2 className="font-display text-3xl text-ink">Nie znaleziono standards.md</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Możesz wygenerować standardy projektu albo kontynuować bez nich.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setMode('profiles')}>
              Wygeneruj standards.md
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              Pomiń standardy
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (mode === 'profiles') {
    return (
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-4">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => {
                setSelectedProfile(profile);
                setAnswers(
                  profile.followUpQuestions.map((q) => ({
                    questionId: q.id,
                    answer: '',
                    skipped: false,
                  })),
                );
                setMode('questions');
              }}
              className="text-left"
            >
              <Card interactive padding="lg" className="h-full">
                <Badge tone="editorial">{profile.id}</Badge>
                <h3 className="mt-4 font-display text-2xl text-ink">{profile.name}</h3>
                <p className="mt-2 text-sm text-ink-muted">{profile.description}</p>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (mode === 'questions' && selectedProfile) {
    const question = selectedProfile.followUpQuestions[activeQuestion];
    const answer = answers.find((a) => a.questionId === question?.id)?.answer ?? '';
    const done = activeQuestion >= selectedProfile.followUpQuestions.length;
    if (done) {
      return (
        <Card variant="ghost" padding="lg" className="max-w-2xl">
          <h2 className="font-display text-3xl text-ink">Gotowe do generowania</h2>
          <p className="mt-2 text-sm text-ink-muted">
            Zebraliśmy odpowiedzi dla profilu {selectedProfile.name}.
          </p>
          <div className="mt-6 flex gap-2">
            <Button
              variant="primary"
              loading={generating}
              onClick={async () => {
                setGenerating(true);
                setErrorText(null);
                try {
                  const generated = await onGenerate(selectedProfile, answers);
                  if (generated.trim().length === 0) {
                    throw new Error('Generator zwrócił pusty plik standards.md.');
                  }
                  setContent(stripMarkdownCodeFence(generated));
                  setContentSource('generated');
                  setMode('preview');
                } catch (err) {
                  setErrorText((err as Error).message);
                } finally {
                  setGenerating(false);
                }
              }}
            >
              Generuj standardy
            </Button>
            <Button variant="ghost" onClick={() => setActiveQuestion(0)}>
              Wróć do pytań
            </Button>
          </div>
          {errorText && <p className="mt-4 text-sm text-danger">{errorText}</p>}
        </Card>
      );
    }
    return (
      <div className="max-w-3xl">
        <Badge tone="editorial">Pytanie {activeQuestion + 1} z {selectedProfile.followUpQuestions.length}</Badge>
        <h2 className="mt-5 font-display text-4xl text-ink leading-tight">{question?.text}</h2>
        {question?.hint && <p className="mt-2 text-sm text-ink-muted">{question.hint}</p>}
        <div className="mt-7">
          <Textarea
            value={answer}
            onChange={(event) => {
              const value = event.target.value;
              setAnswers((prev) =>
                prev.map((a) =>
                  a.questionId === question?.id ? { ...a, answer: value, skipped: false } : a,
                ),
              );
            }}
            placeholder="Twoja odpowiedź..."
            className="min-h-[160px]"
          />
        </div>
        <div className="mt-5 flex justify-between gap-2">
          <Button
            variant="ghost"
            disabled={activeQuestion === 0}
            onClick={() => setActiveQuestion((v) => Math.max(0, v - 1))}
          >
            Wstecz
          </Button>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setAnswers((prev) =>
                  prev.map((a) => (a.questionId === question?.id ? { ...a, skipped: true } : a)),
                );
                setActiveQuestion((v) => v + 1);
              }}
            >
              Pomiń
            </Button>
            <Button variant="primary" onClick={() => setActiveQuestion((v) => v + 1)}>
              Dalej
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const regenerationProfile =
    selectedProfile ?? profiles.find((profile) => profile.id === 'webapp-react') ?? profiles[0] ?? null;
  const regenerationAnswers =
    answers.length > 0
      ? answers
      : regenerationProfile?.followUpQuestions.map((question) => ({
          questionId: question.id,
          answer: '',
          skipped: false,
        })) ?? [];

  return (
    <div className="space-y-5">
      <Card variant="ghost" padding="lg">
        <p className="eyebrow mb-3">{contentSource === 'existing' ? 'Wykryte standardy' : 'Podgląd standardów'}</p>
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          errorText={content.trim().length === 0 ? 'Standardy są puste. Wygeneruj je albo pomiń ten krok.' : undefined}
          className="min-h-[480px] font-mono text-sm"
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            loading={generating}
            disabled={!regenerationProfile}
            onClick={async () => {
              if (!regenerationProfile) return;
              setGenerating(true);
              setErrorText(null);
              try {
                const generated = await onRegenerate(regenerationProfile, regenerationAnswers);
                if (generated.trim().length === 0) {
                  throw new Error('Generator zwrócił pusty plik standards.md.');
                }
                setSelectedProfile(regenerationProfile);
                setAnswers(regenerationAnswers);
                setContent(stripMarkdownCodeFence(generated));
                setContentSource('generated');
              } catch (err) {
                setErrorText((err as Error).message);
              } finally {
                setGenerating(false);
              }
            }}
          >
            Regeneruj standards.md
          </Button>
          <Button variant="ghost" onClick={() => setMode('profiles')}>
            Zmień profil
          </Button>
          <Button variant="ghost" onClick={onSkip}>Pomiń</Button>
          <Button
            variant="outline"
            loading={saving}
            disabled={content.trim().length === 0}
            onClick={async () => {
              setSaving(true);
              setErrorText(null);
              try {
                await onSave(content);
              } catch (err) {
                setErrorText((err as Error).message);
              } finally {
                setSaving(false);
              }
            }}
          >
            Zapisz standards.md
          </Button>
          <Button
            variant="primary"
            disabled={content.trim().length === 0}
            onClick={() => onUseStandards(content, contentSource)}
          >
            Użyj tych standardów
          </Button>
        </div>
        {errorText && <p className="mt-3 text-sm text-danger">{errorText}</p>}
      </Card>
    </div>
  );
}
