'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Input, Textarea } from './ui/Input';
import { GenerationProgress } from './GenerationProgress';
import type { StandardsProfile } from './StandardsGenerator';
import {
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  TARGET_TOOLS,
  type AIProvider,
  type TargetTool,
} from '@/types/providers';
import {
  getDefaultModelForProvider,
  getModelConfig,
  getModelDisplayCost,
  getProviderModels,
} from '@/types/models';
import type { GenerationDocuments, GenerationProgressState } from '@/lib/useGeneration';
import type { AppLocale, Question, QuestionAnswer, SessionState } from '@/types/session';

type DocType = 'requirements' | 'design' | 'tasks';
type Documents = Record<DocType, string | null>;

const TOOL_LABELS: Record<TargetTool, string> = {
  universal: 'Uniwersalny',
  'claude-code': 'Claude Code',
  codex: 'Codex',
  copilot: 'Copilot',
  gemini: 'Gemini',
};

export function ExistingProjectEditor({
  state,
  locale,
  progress,
  documents,
  generationDocuments,
  saveMessage,
  generatedInEditor,
  savingInfo,
  savingDocuments,
  onUpdate,
  onAnswerChange,
  onQuestionTextChange,
  onAddInformation,
  onRemoveInformation,
  onGenerate,
  onSaveInfo,
  onSaveDocuments,
  onOpenTutorial,
}: {
  state: SessionState;
  locale: AppLocale;
  progress: GenerationProgressState;
  documents: Documents;
  generationDocuments: GenerationDocuments;
  saveMessage: string | null;
  generatedInEditor: boolean;
  savingInfo: boolean;
  savingDocuments: boolean;
  onUpdate: (patch: Partial<SessionState>) => void;
  onAnswerChange: (questionId: string, answer: string, skipped?: boolean) => void;
  onQuestionTextChange: (questionId: string, text: string) => void;
  onAddInformation: () => void;
  onRemoveInformation: (questionId: string) => void;
  onGenerate: () => void;
  onSaveInfo: () => void;
  onSaveDocuments: () => void;
  onOpenTutorial: (provider: AIProvider) => void;
}) {
  const activeProvider = state.aiProvider ?? 'openai';
  const providerModels = getProviderModels(activeProvider);
  const [standardsProfiles, setStandardsProfiles] = useState<StandardsProfile[]>([]);
  const activeModel =
    getModelConfig(state.aiModel ?? '', providerModels) ??
    getDefaultModelForProvider(activeProvider);
  const editableQuestions = useMemo(
    () => mergeQuestionsAndAnswers(state.questions, state.answers),
    [state.answers, state.questions],
  );
  const standardsAnswers = state.standardsGeneration?.followUpAnswers ?? [];
  const standardsProfile = useMemo(
    () => standardsProfiles.find((profile) => profile.id === state.standardsGeneration?.selectedProfileId) ?? null,
    [standardsProfiles, state.standardsGeneration?.selectedProfileId],
  );
  const standardsQuestions = useMemo(
    () => mergeQuestionsAndAnswers(standardsProfile?.followUpQuestions ?? [], standardsAnswers),
    [standardsAnswers, standardsProfile?.followUpQuestions],
  );
  const hasCompleteDocuments = Boolean(documents.requirements && documents.design && documents.tasks);
  const canGenerate = Boolean(
    state.targetTool &&
    state.aiProvider &&
    state.aiModel &&
    (state.isDemoMode || state.apiKey.trim()),
  );

  useEffect(() => {
    if (!state.standardsGeneration?.selectedProfileId && standardsAnswers.length === 0) {
      setStandardsProfiles([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/standards/profiles?locale=${locale}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('profiles.failed'))))
      .then((body: { profiles?: StandardsProfile[] }) => {
        if (!cancelled) setStandardsProfiles(body.profiles ?? []);
      })
      .catch(() => {
        if (!cancelled) setStandardsProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, standardsAnswers.length, state.standardsGeneration?.selectedProfileId]);

  const updateStandardsAnswer = (questionId: string, answer: string, skipped: boolean) => {
    if (!state.standardsGeneration) return;
    onUpdate({
      standardsGeneration: {
        ...state.standardsGeneration,
        followUpAnswers: state.standardsGeneration.followUpAnswers.map((item) =>
          item.questionId === questionId ? { ...item, answer, skipped } : item,
        ),
      },
    });
  };

  return (
    <div className="space-y-8">
      <Card variant="inset" padding="lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <p className="eyebrow mb-2">Projekt</p>
            <p className="font-mono text-sm text-ink-muted break-all">{state.projectPath}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone={state.pathValidation?.hasStandards ? 'accent' : 'neutral'}>
                {state.pathValidation?.hasStandards ? 'standards.md' : 'bez standards.md'}
              </Badge>
              <Badge tone={hasCompleteDocuments ? 'success' : 'neutral'}>
                {documentCount(documents)} / 3 dokumenty
              </Badge>
              <Badge tone="editorial">{state.projectSource ?? 'projekt'}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onSaveInfo} loading={savingInfo}>
              Zapisz informacje
            </Button>
            <Button
              variant="primary"
              onClick={onGenerate}
              loading={progress.status === 'generating'}
              disabled={!canGenerate}
            >
              Wygeneruj nową wersję
            </Button>
          </div>
        </div>
        {saveMessage && <p className="mt-4 text-sm text-success">{saveMessage}</p>}
      </Card>

      <section className="grid xl:grid-cols-[1.1fr_0.9fr] gap-6">
        <Card variant="ghost" padding="lg">
          <CardHeader
            title="Opis projektu"
            subtitle="To główny kontekst biznesowy, na którym generator opiera wszystkie dokumenty."
          />
          <Textarea
            value={state.projectDescription}
            onChange={(event) => onUpdate({ projectDescription: event.target.value })}
            className="min-h-[260px]"
            placeholder="Opisz cel, użytkowników, procesy i ograniczenia projektu..."
            showCount
          />
        </Card>

        <Card variant="ghost" padding="lg">
          <CardHeader
            title="Narzędzie i model"
            subtitle="Te ustawienia będą użyte przy wygenerowaniu nowej wersji specyfikacji."
          />
          <div className="space-y-5">
            <div>
              <p className="eyebrow mb-3">Narzędzie docelowe</p>
              <div className="flex flex-wrap gap-2">
                {TARGET_TOOLS.map((tool) => (
                  <Button
                    key={tool}
                    type="button"
                    size="sm"
                    variant={state.targetTool === tool ? 'primary' : 'outline'}
                    onClick={() => onUpdate({ targetTool: tool })}
                  >
                    {TOOL_LABELS[tool]}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <p className="eyebrow mb-3">Dostawca API</p>
              <div className="flex flex-wrap gap-2">
                {AI_PROVIDERS.map((provider) => (
                  <Button
                    key={provider}
                    type="button"
                    size="sm"
                    variant={activeProvider === provider ? 'primary' : 'outline'}
                    onClick={() => {
                      const model = getDefaultModelForProvider(provider);
                      onUpdate({ aiProvider: provider, aiModel: model.modelId, apiKeyValid: null });
                    }}
                  >
                    {AI_PROVIDER_LABELS[provider]}
                  </Button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="block eyebrow mb-2">Model</span>
              <select
                value={activeModel.modelId}
                onChange={(event) => {
                  const model = getModelConfig(event.target.value, providerModels) ?? activeModel;
                  onUpdate({ aiProvider: model.provider, aiModel: model.modelId, apiKeyValid: null });
                }}
                className="h-11 w-full rounded-md border border-rule bg-bg-elevated px-3.5 text-base text-ink focus:outline-none focus:border-sienna"
              >
                {providerModels.map((model) => (
                  <option key={model.modelId} value={model.modelId}>
                    {model.name} · {getModelDisplayCost(model, locale)}
                  </option>
                ))}
              </select>
            </label>

            <Input
              label="Klucz API"
              type="password"
              value={state.apiKey}
              onChange={(event) => onUpdate({ apiKey: event.target.value, apiKeyValid: null })}
              placeholder="Wklej klucz tylko na czas generowania"
              hint="Klucz zostaje wyłącznie w pamięci tej sesji i nie jest zapisywany w projekcie."
            />
            <Button variant="ghost" size="sm" onClick={() => onOpenTutorial(activeProvider)}>
              Nie mam klucza albo chcę sprawdzić instrukcję
            </Button>
          </div>
        </Card>
      </section>

      <Card variant="ghost" padding="lg">
        <CardHeader
          title="Informacje doprecyzowujące"
          subtitle="Edytuj odpowiedzi zamiast przechodzić ponownie przez pytania. Możesz też dodać własną decyzję biznesową."
          action={
            <Button variant="outline" size="sm" onClick={onAddInformation}>
              Dodaj informację
            </Button>
          }
        />
        {editableQuestions.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Ten projekt nie ma jeszcze zapisanych pytań ani odpowiedzi.
          </p>
        ) : (
          <div className="space-y-4">
            {editableQuestions.map((question, index) => {
              const answer = state.answers.find((item) => item.questionId === question.id) ?? {
                questionId: question.id,
                answer: '',
                skipped: false,
              };
              return (
                <div key={question.id} className="border-t border-rule pt-4">
                  <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
                    <Input
                      label={`Obszar ${String(index + 1).padStart(2, '0')}`}
                      value={question.text}
                      onChange={(event) => onQuestionTextChange(question.id, event.target.value)}
                    />
                    <Textarea
                      label="Odpowiedź / decyzja"
                      value={answer.answer}
                      onChange={(event) =>
                        onAnswerChange(question.id, event.target.value, answer.skipped)
                      }
                      className="min-h-[120px]"
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
                      <input
                        type="checkbox"
                        checked={answer.skipped}
                        onChange={(event) =>
                          onAnswerChange(question.id, answer.answer, event.target.checked)
                        }
                        className="h-4 w-4 accent-sienna"
                      />
                      Nie dotyczy tego projektu
                    </label>
                    <Button variant="ghost" size="sm" onClick={() => onRemoveInformation(question.id)}>
                      Usuń
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card variant="ghost" padding="lg">
        <CardHeader
          title="Standardy projektu"
          subtitle="Jeśli zmieniły się decyzje biznesowe albo techniczne, możesz od razu poprawić standards.md przed regeneracją."
        />
        <Textarea
          value={state.standards ?? ''}
          onChange={(event) =>
            onUpdate({
              standards: event.target.value,
              standardsSource: event.target.value.trim() ? state.standardsSource ?? 'existing' : 'skipped',
            })
          }
          className="min-h-[260px] font-mono text-sm"
          placeholder="Brak standardów. Możesz je dopisać tutaj albo zostawić puste."
        />
        {standardsAnswers.length > 0 && (
          <div className="mt-6 border-t border-rule pt-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="eyebrow mb-2">Decyzje dla standards.md</p>
                <h3 className="font-display text-2xl text-ink">Pytania i odpowiedzi standardów</h3>
              </div>
              <Badge tone="editorial">
                {standardsProfile?.name ?? state.standardsGeneration?.selectedProfileId ?? 'profil'}
              </Badge>
            </div>
            <div className="mt-4 space-y-4">
              {standardsAnswers.map((answer, index) => {
                const question = standardsQuestions.find((item) => item.id === answer.questionId) ?? {
                  id: answer.questionId,
                  text: readableQuestionId(answer.questionId),
                  isRequired: false,
                };
                return (
                  <div key={answer.questionId} className="border-t border-rule pt-4 first:border-t-0 first:pt-0">
                    <p className="text-sm font-medium text-ink">
                      {String(index + 1).padStart(2, '0')}. {question.text}
                    </p>
                    {question.hint && <p className="mt-1 text-xs text-ink-muted">{question.hint}</p>}
                    <Textarea
                      label="Odpowiedź / decyzja"
                      value={answer.answer}
                      onChange={(event) =>
                        updateStandardsAnswer(answer.questionId, event.target.value, false)
                      }
                      className="mt-3 min-h-[110px]"
                    />
                    <label className="mt-2 inline-flex items-center gap-2 text-sm text-ink-muted">
                      <input
                        type="checkbox"
                        checked={answer.skipped}
                        onChange={(event) =>
                          updateStandardsAnswer(answer.questionId, answer.answer, event.target.checked)
                        }
                        className="h-4 w-4 accent-sienna"
                      />
                      Pominięto przy generowaniu standardów
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow mb-2">Dokumenty</p>
            <h2 className="font-display text-3xl text-ink">Nowa wersja specyfikacji</h2>
          </div>
          {generatedInEditor && hasCompleteDocuments && (
            <Button variant="primary" onClick={onSaveDocuments} loading={savingDocuments}>
              Zapisz dokumenty i archiwizuj stare
            </Button>
          )}
        </div>
        <GenerationProgress
          progress={progress}
          documents={{
            requirements: generationDocuments.requirements ?? documents.requirements ?? undefined,
            design: generationDocuments.design ?? documents.design ?? undefined,
            tasks: generationDocuments.tasks ?? documents.tasks ?? undefined,
          }}
        />
      </section>
    </div>
  );
}

function mergeQuestionsAndAnswers(questions: Question[], answers: QuestionAnswer[]): Question[] {
  const byId = new Map(questions.map((question) => [question.id, question]));
  for (const answer of answers) {
    if (!byId.has(answer.questionId)) {
      byId.set(answer.questionId, {
        id: answer.questionId,
        text: readableQuestionId(answer.questionId),
        isRequired: false,
      });
    }
  }
  return Array.from(byId.values());
}

function readableQuestionId(questionId: string): string {
  if (questionId.startsWith('context.')) return 'Informacja kontekstowa';
  if (questionId.startsWith('custom.')) return 'Dodatkowa informacja';
  return questionId.replace(/[._-]+/g, ' ');
}

function documentCount(documents: Documents): number {
  return Object.values(documents).filter(Boolean).length;
}
