'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useSessionState } from '@/lib/useSessionState';
import { useGeneration } from '@/lib/useGeneration';
import { buildStepsForLayout, STEPS, type StepId } from '@/lib/wizard-steps';
import { validateDescription } from '@/lib/validation';
import {
  buildSuggestionBatchRegenerationInstructions,
  getDocumentsReviewKey,
  getDocumentSuggestionKey,
  getDocumentSuggestionHandledKeys,
  MAX_DOCUMENT_SUGGESTION_ITERATIONS,
} from '@/lib/document-suggestions';
import { stripMarkdownCodeFence } from '@/lib/markdown';
import { MODEL_CATALOG, getModelConfig } from '@/types/models';
import type { ErrorProfileData, FixAction, ErrorCode } from '@/lib/errors';
import type {
  AppLocale,
  DocumentSuggestion,
  DocumentSuggestionDecision,
  PathValidationResult,
  ProjectSource,
  Question,
  QuestionAnswer,
  Recommendation,
  SessionState,
} from '@/types/session';
import type { LoadedProjectWorkspace, ProjectSnapshot, RecentProjectWithSummary } from '@/types/project';
import type { AIProvider, TargetTool } from '@/types/providers';
import { WizardLayout } from './WizardLayout';
import { ProjectPicker } from './ProjectPicker';
import { ProjectDescriptionInput } from './ProjectDescriptionInput';
import { ChatLikeQuestion } from './ChatLikeQuestion';
import { ToolSelector } from './ToolSelector';
import { ModelSelector } from './ModelSelector';
import { ApiKeyTutorial } from './ApiKeyTutorial';
import { StandardsGenerator, type StandardsProfile } from './StandardsGenerator';
import { GenerationProgress } from './GenerationProgress';
import { DocumentPreview } from './DocumentPreview';
import { ExistingProjectEditor } from './ExistingProjectEditor';
import { ErrorProfile } from './ErrorProfile';
import { WelcomeTour } from './WelcomeTour';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { ChevronLeft, ChevronRight, Sparkles } from './ui/Icon';

interface WizardFlowProps {
  locale: AppLocale;
}

type DocType = 'requirements' | 'design' | 'tasks';

const DOC_TYPES: readonly DocType[] = ['requirements', 'design', 'tasks'];
const MISSING_API_KEY_MESSAGE =
  'Klucz API nie jest już dostępny po odświeżeniu strony. Wróć do wyboru modelu i wklej go ponownie.';
const STARTER_MODEL_ID = 'gpt-5.4-mini';

export function WizardFlow({ locale }: WizardFlowProps) {
  const t = useTranslations();
  const { state, update, reset, isHydrated } = useSessionState(locale);
  const generation = useGeneration();

  const [recentProjects, setRecentProjects] = useState<RecentProjectWithSummary[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [toolLoading, setToolLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const [savingDocuments, setSavingDocuments] = useState(false);
  const [savingProjectInfo, setSavingProjectInfo] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [editorGenerated, setEditorGenerated] = useState(false);
  const [tourDismissed, setTourDismissed] = useState(false);

  const currentStep = STEPS[state.currentStep] ?? STEPS[0]!;
  const completenessPercent = computeCompleteness(state.questions, state.answers);
  const stepsForLayout = buildStepsForLayout(t, state.currentStep, computeCompleted(state));
  const selectedModel = useMemo(
    () => getModelConfig(state.aiModel ?? state.modelRecommendation?.recommended ?? '') ?? getStarterModel(),
    [state.aiModel, state.modelRecommendation?.recommended],
  );
  const {
    requirements: requirementsDocument,
    design: designDocument,
    tasks: tasksDocument,
  } = state.generatedDocuments;
  const documentReviewKey = useMemo(
    () =>
      getDocumentsReviewKey({
        requirements: requirementsDocument,
        design: designDocument,
        tasks: tasksDocument,
      }),
    [requirementsDocument, designDocument, tasksDocument],
  );

  const refreshRecentProjects = useCallback(async () => {
    const projects = await fetchRecentProjects();
    setRecentProjects(projects);
    return projects;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const projects = await fetchRecentProjects();
        if (!cancelled) setRecentProjects(projects);
      } catch {
        if (!cancelled) setRecentProjects([]);
      } finally {
        if (!cancelled) setLoadingRecent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/preferences');
        const body = (await res.json()) as {
          preferences?: {
            firstRunComplete?: boolean;
            preferredAiProvider?: AIProvider;
            preferredAiModel?: string;
            preferredTargetTool?: TargetTool;
          };
        };
        if (cancelled || !body.preferences) return;
        const patch: Partial<SessionState> = {};
        if (
          !tourDismissed &&
          !body.preferences.firstRunComplete &&
          state.currentStep === 0 &&
          state.tourStepIndex === null
        ) {
          patch.tourStepIndex = 0;
        }
        if (!state.aiProvider && body.preferences.preferredAiProvider) {
          patch.aiProvider = body.preferences.preferredAiProvider;
        }
        if (!state.aiModel && body.preferences.preferredAiModel) {
          patch.aiModel = body.preferences.preferredAiModel;
        }
        if (!state.targetTool && body.preferences.preferredTargetTool) {
          patch.targetTool = body.preferences.preferredTargetTool;
        }
        if (Object.keys(patch).length > 0) update(patch);
      } catch {
        // Preferencje są miłym ułatwieniem, nie blokują wizarda.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    isHydrated,
    state.aiModel,
    state.aiProvider,
    state.currentStep,
    state.targetTool,
    state.tourStepIndex,
    tourDismissed,
    update,
  ]);

  const setError = useCallback(
    (code: ErrorCode, message: string, retryable = true) => {
      update({ activeErrorProfile: buildClientErrorProfile(code, message, locale, retryable) });
    },
    [locale, update],
  );

  const loadQuestions = useCallback(
    async (append: boolean) => {
      setQuestionLoading(true);
      update({ activeErrorProfile: null });
      try {
        const res = await fetch('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(state.isDemoMode ? { 'x-demo-mode': 'true' } : {}),
          },
          body: JSON.stringify({
            projectDescription: state.projectDescription,
            previousAnswers: state.answers,
            standards: state.standards,
            locale,
            ...(state.aiProvider && state.aiModel && state.apiKey
              ? {
                  aiProvider: state.aiProvider,
                  aiModel: state.aiModel,
                  apiKey: state.apiKey,
                }
              : {}),
          }),
        });
        const body = (await res.json()) as { questions?: Question[]; error?: { message?: string } };
        if (!res.ok || !body.questions) {
          throw new Error(body.error?.message ?? 'Nie udało się wygenerować pytań.');
        }
        update((prev) => ({
          questions: append ? [...prev.questions, ...body.questions!] : body.questions!,
          activeQuestionIndex: append ? prev.activeQuestionIndex : 0,
          completenessPercent: append
            ? computeCompleteness([...prev.questions, ...body.questions!], prev.answers)
            : computeCompleteness(body.questions!, prev.answers),
        }));
      } catch (err) {
        setError('NETWORK_ERROR', (err as Error).message);
      } finally {
        setQuestionLoading(false);
      }
    },
    [
      locale,
      setError,
      state.aiModel,
      state.aiProvider,
      state.answers,
      state.apiKey,
      state.isDemoMode,
      state.projectDescription,
      state.standards,
      update,
    ],
  );

  const loadToolRecommendation = useCallback(async () => {
    if (!validateDescription(state.projectDescription).valid) return;
    setToolLoading(true);
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(state.isDemoMode ? { 'x-demo-mode': 'true' } : {}),
        },
        body: JSON.stringify({
          kind: 'tool',
          context: {
            projectDescription: state.projectDescription,
            answers: state.answers,
            standards: state.standards,
          },
          locale,
          ...(state.apiKeyValid && state.aiProvider && state.aiModel && state.apiKey
            ? {
                aiProvider: state.aiProvider,
                aiModel: state.aiModel,
                apiKey: state.apiKey,
              }
            : {}),
        }),
      });
      const body = (await res.json()) as {
        toolRecommendation?: Recommendation<TargetTool>;
      };
      if (body.toolRecommendation) {
        update((prev) => ({
          toolRecommendation: body.toolRecommendation!,
          targetTool: prev.targetTool ?? body.toolRecommendation!.recommended,
        }));
      }
    } catch {
      // Fallback działa po stronie API, a brak rekomendacji nie blokuje ręcznego wyboru.
    } finally {
      setToolLoading(false);
    }
  }, [
    locale,
    state.aiModel,
    state.aiProvider,
    state.answers,
    state.apiKey,
    state.apiKeyValid,
    state.isDemoMode,
    state.projectDescription,
    state.standards,
    update,
  ]);

  const loadModelRecommendation = useCallback(async () => {
    setModelLoading(true);
    try {
      const res = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'model',
          context: {
            projectDescription: state.projectDescription,
            answers: state.answers,
            standards: state.standards,
          },
          locale,
        }),
      });
      const body = (await res.json()) as {
        modelRecommendation?: Recommendation<string>;
      };
      const recommendation = body.modelRecommendation;
      if (recommendation) {
        const recommendedModel = getModelConfig(recommendation.recommended);
        const fallbackModel = getStarterModel();
        update((prev) => ({
          modelRecommendation: recommendation,
          aiProvider: prev.aiProvider ?? recommendedModel?.provider ?? fallbackModel.provider,
          aiModel: prev.aiModel ?? recommendedModel?.modelId ?? fallbackModel.modelId,
        }));
      }
    } catch {
      const model = getStarterModel();
      update((prev) => ({
        aiProvider: prev.aiProvider ?? model.provider,
        aiModel: prev.aiModel ?? model.modelId,
      }));
    } finally {
      setModelLoading(false);
    }
  }, [locale, state.answers, state.projectDescription, state.standards, update]);

  useEffect(() => {
    if (!isHydrated) return;
    if (currentStep.id === 'questions' && state.questions.length === 0 && !questionLoading) {
      void loadQuestions(false);
    }
  }, [currentStep.id, isHydrated, loadQuestions, questionLoading, state.questions.length]);

  useEffect(() => {
    if (!isHydrated) return;
    if (currentStep.id === 'tool' && !state.toolRecommendation && !toolLoading) {
      void loadToolRecommendation();
    }
  }, [currentStep.id, isHydrated, loadToolRecommendation, state.toolRecommendation, toolLoading]);

  useEffect(() => {
    if (!isHydrated) return;
    const shouldRefreshModelRecommendation =
      !state.modelRecommendation || state.modelRecommendation.recommended === 'gpt-5-mini';
    if (currentStep.id === 'model' && shouldRefreshModelRecommendation && !modelLoading) {
      void loadModelRecommendation();
    }
    if (currentStep.id === 'model' && !state.aiModel) {
      const model = getStarterModel();
      update({ aiProvider: model.provider, aiModel: model.modelId });
    }
  }, [
    currentStep.id,
    isHydrated,
    loadModelRecommendation,
    modelLoading,
    state.aiModel,
    state.modelRecommendation,
    update,
  ]);

  useEffect(() => {
    if (generation.progress.status !== state.generationStatus) {
      update({ generationStatus: generation.progress.status });
    }
  }, [generation.progress.status, state.generationStatus, update]);

  useEffect(() => {
    if (currentStep.id !== 'preview') return;
    if (!state.generatedDocuments.requirements && !state.generatedDocuments.design && !state.generatedDocuments.tasks) {
      return;
    }
    if (state.documentSuggestionStatus === 'analyzing') return;
    if (state.documentSuggestionReviewKey === documentReviewKey) return;
    void loadDocumentSuggestions(documentReviewKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentStep.id,
    documentReviewKey,
    state.documentSuggestionReviewKey,
    state.documentSuggestionStatus,
  ]);

  const handleProjectReady = async (
    projectPath: string,
    source: ProjectSource,
    validation: PathValidationResult,
  ) => {
    const standardsPreview =
      validation.hasStandards && validation.standardsPreview?.trim()
        ? validation.standardsPreview
        : null;
    const loadedWorkspace = await loadExistingProjectWorkspace(projectPath, state.isDemoMode);
    const loadedPatch = loadedWorkspace
      ? buildLoadedProjectPatch(loadedWorkspace, locale)
      : {};
    const loadedStandards =
      loadedPatch.standards !== undefined
        ? loadedPatch.standards
        : standardsPreview;
    const loadedDocuments = loadedWorkspace?.documents ?? null;
    const restoredDocuments =
      loadedDocuments && Object.values(loadedDocuments).some(Boolean)
        ? loadedDocuments
        : loadedPatch.generatedDocuments ?? { requirements: null, design: null, tasks: null };
    const projectMode =
      source !== 'created' && hasRestorableProjectData(loadedWorkspace, loadedStandards, restoredDocuments)
        ? 'edit'
        : 'new';
    setEditorGenerated(false);

    update({
      ...loadedPatch,
      projectPath,
      projectSource: source,
      projectMode,
      pathValidation: { ...validation, hasStandards: Boolean(loadedStandards) },
      standards: loadedStandards,
      standardsSource:
        loadedPatch.standardsSource !== undefined
          ? loadedPatch.standardsSource
          : loadedStandards
            ? 'existing'
            : null,
      generatedDocuments: restoredDocuments,
      generationStatus: hasAnyDocument(restoredDocuments) ? 'completed' : 'idle',
      apiKey: '',
      apiKeyValid: null,
      activeErrorProfile: null,
      currentStep: 1,
    });
    try {
      await registerRecentProject(projectPath, Boolean(loadedStandards), state.isDemoMode);
      await refreshRecentProjects();
    } catch {
      // best effort
    }
  };

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display-italic text-2xl text-ink-subtle animate-pulse">
          ładowanie…
        </div>
      </div>
    );
  }

  const goBack = () => {
    if (state.currentStep > 0) update({ currentStep: state.currentStep - 1 });
  };

  const goNext = () => {
    update({ currentStep: Math.min(state.currentStep + 1, STEPS.length - 1) });
  };

  const goHome = () => {
    setSaveMessage(null);
    setEditorGenerated(false);
    reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canAdvance = canAdvanceFrom(currentStep.id, state, completenessPercent);
  const activeErrorProfile = isErrorProfileData(state.activeErrorProfile)
    ? state.activeErrorProfile
    : null;
  const isEditingExistingProject = state.projectMode === 'edit' && Boolean(state.projectPath);
  const canGenerateInEditor = Boolean(
    state.targetTool &&
    state.aiProvider &&
    state.aiModel &&
    (state.isDemoMode || state.apiKey.trim()),
  );

  return (
    <>
      <WizardLayout
        steps={stepsForLayout}
        currentStepIndex={state.currentStep}
        banner={state.isDemoMode ? t('demo.banner') : undefined}
        onHome={goHome}
        hideSteps={isEditingExistingProject}
        customHeader={
          isEditingExistingProject ? (
            <header className="mb-12">
              <p className="eyebrow mb-6">Edycja istniejącego projektu</p>
              <h1 className="font-display text-5xl md:text-6xl text-ink leading-[0.95] tracking-tight max-w-4xl">
                <span className="font-display-italic">Jedna</span> strona informacji
              </h1>
              <p className="mt-6 text-lg text-ink-muted max-w-3xl leading-relaxed">
                Zmień zapisane informacje projektu, wygeneruj nową wersję specyfikacji i zapisz ją.
                Poprzednie dokumenty zostaną przeniesione do old_docs.
              </p>
            </header>
          ) : undefined
        }
        footer={
          isEditingExistingProject ? (
            <>
              <Button variant="ghost" iconLeft={<ChevronLeft size={14} />} onClick={goHome}>
                Dashboard
              </Button>
              <Button variant="outline" onClick={() => void saveProjectInformation()} loading={savingProjectInfo}>
                Zapisz informacje
              </Button>
              <Button
                variant="primary"
                onClick={() => void startGeneration()}
                loading={generation.progress.status === 'generating'}
                disabled={!canGenerateInEditor}
              >
                Wygeneruj nową wersję
              </Button>
              {editorGenerated && DOC_TYPES.every((type) => Boolean(state.generatedDocuments[type])) && (
                <Button variant="primary" onClick={() => void saveAllDocuments()} loading={savingDocuments}>
                  Zapisz dokumenty
                </Button>
              )}
            </>
          ) : state.currentStep > 0 ? (
            <>
              <Button variant="ghost" iconLeft={<ChevronLeft size={14} />} onClick={goBack}>
                {t('common.back')}
              </Button>
              {currentStep.id === 'preview' ? (
                <Button variant="primary" onClick={() => void saveAllDocuments()} loading={savingDocuments}>
                  Zapisz wszystkie dokumenty
                </Button>
              ) : (
                <Button variant="ghost" onClick={reset}>
                  {t('common.cancel')}
                </Button>
              )}
              {currentStep.id !== 'preview' && canAdvance && state.currentStep < STEPS.length - 1 && (
                <Button
                  variant="primary"
                  iconRight={<ChevronRight size={14} />}
                  onClick={goNext}
                >
                  {t('common.next')}
                </Button>
              )}
            </>
          ) : undefined
        }
      >
        {activeErrorProfile && (
          <div className="mb-8">
            <ErrorProfile
              data={activeErrorProfile}
              onAction={(action) => void handleErrorAction(action, activeErrorProfile)}
              onDismiss={() => update({ activeErrorProfile: null })}
            />
          </div>
        )}

        {isEditingExistingProject && (
          <ExistingProjectEditor
            state={state}
            locale={locale}
            progress={generation.progress}
            documents={state.generatedDocuments}
            generationDocuments={generation.documents}
            saveMessage={saveMessage}
            generatedInEditor={editorGenerated}
            savingInfo={savingProjectInfo}
            savingDocuments={savingDocuments}
            onUpdate={update}
            onAnswerChange={upsertAnswer}
            onQuestionTextChange={changeQuestionText}
            onAddInformation={addCustomInformation}
            onRemoveInformation={removeQuestionAndAnswer}
            onGenerate={() => void startGeneration()}
            onSaveInfo={() => void saveProjectInformation()}
            onSaveDocuments={() => void saveAllDocuments()}
            onOpenTutorial={(provider) => update({ tutorialOpenedFor: provider })}
          />
        )}

        {!isEditingExistingProject && currentStep.id === 'project' && (
          <ProjectPicker
            recentProjects={recentProjects}
            loadingRecent={loadingRecent}
            onProjectReady={handleProjectReady}
          />
        )}

        {!isEditingExistingProject && currentStep.id === 'description' && (
          <ProjectDescriptionInput
            value={state.projectDescription}
            onChange={(value) => update({ projectDescription: value })}
          />
        )}

        {!isEditingExistingProject && currentStep.id === 'questions' && (
          <QuestionsStep
            state={state}
            loading={questionLoading}
            completenessPercent={completenessPercent}
            onAnswerChange={upsertAnswer}
            onSkip={skipActiveQuestion}
            onSkipAll={skipRemainingQuestions}
            onPreviousQuestion={() =>
              update({ activeQuestionIndex: Math.max(0, state.activeQuestionIndex - 1) })
            }
            onNextQuestion={advanceQuestion}
            onRequestMore={() => void loadQuestions(true)}
            onContinue={() => update({ currentStep: 3 })}
          />
        )}

        {!isEditingExistingProject && currentStep.id === 'tool' && (
          <div className="space-y-5">
            {toolLoading && <Badge tone="accent">Dobieram rekomendację...</Badge>}
            <ToolSelector
              locale={locale}
              selectedTool={state.targetTool}
              recommendation={state.toolRecommendation}
              onSelect={(tool) =>
                update({
                  targetTool: tool,
                  currentStep: state.currentStep === 3 ? 4 : state.currentStep,
                })
              }
            />
          </div>
        )}

        {!isEditingExistingProject && currentStep.id === 'model' && (
          <div className="space-y-6">
            {modelLoading && <Badge tone="accent">Analizuję dobry model dla tej specyfikacji...</Badge>}
            <ModelSelector
              locale={locale}
              selectedProvider={state.aiProvider}
              selectedModel={state.aiModel}
              apiKey={state.apiKey}
              apiKeyValid={state.apiKeyValid}
              recommendation={state.modelRecommendation}
              demo={state.isDemoMode}
              onSelect={(provider, modelId) =>
                update({ aiProvider: provider, aiModel: modelId, apiKeyValid: state.isDemoMode ? true : null })
              }
              onApiKeyChange={(apiKey) => update({ apiKey })}
              onApiKeyValidChange={(apiKeyValid) => update({ apiKeyValid })}
              onOpenTutorial={(provider) => update({ tutorialOpenedFor: provider })}
            />
          </div>
        )}

        {!isEditingExistingProject && currentStep.id === 'standards' && (
          <StandardsGenerator
            locale={locale}
            existingStandards={state.standards?.trim() ? state.standards : null}
            standardsSource={state.standardsSource}
            onUseStandards={(content, source) =>
              update({ standards: content, standardsSource: source, currentStep: 6 })
            }
            onSkip={() => update({ standards: null, standardsSource: 'skipped', currentStep: 6 })}
            onGenerate={(profile, answers) => generateStandardsForProfile(profile, answers)}
            onRegenerate={(profile, answers) => generateStandardsForProfile(profile, answers)}
            onSave={async (content) => {
              const res = await fetch('/api/standards/save', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(state.isDemoMode ? { 'x-demo-mode': 'true' } : {}),
                },
                body: JSON.stringify({ projectPath: state.projectPath, content }),
              });
              if (!res.ok) throw new Error('Nie udało się zapisać standards.md');
            }}
          />
        )}

        {!isEditingExistingProject && currentStep.id === 'generate' && (
          <GenerateStep
            state={state}
            progress={generation.progress}
            documents={{
              requirements: generation.documents.requirements ?? state.generatedDocuments.requirements ?? undefined,
              design: generation.documents.design ?? state.generatedDocuments.design ?? undefined,
              tasks: generation.documents.tasks ?? state.generatedDocuments.tasks ?? undefined,
            }}
            onStart={() => void startGeneration()}
            onContinue={() => update({ currentStep: 7 })}
          />
        )}

        {!isEditingExistingProject && currentStep.id === 'preview' && (
          <div className="space-y-5">
            {saveMessage && (
              <Card variant="inset" padding="md">
                <p className="text-sm text-ink-muted">{saveMessage}</p>
              </Card>
            )}
            <DocumentPreview
              documents={state.generatedDocuments}
              suggestions={state.documentSuggestions}
              suggestionStatus={state.documentSuggestionStatus}
              suggestionIteration={state.documentSuggestionIteration ?? 0}
              maxSuggestionIterations={MAX_DOCUMENT_SUGGESTION_ITERATIONS}
              onChangeDocument={changeDocument}
              onRegenerate={regenerateDocument}
              onApplySuggestionDecisions={applyDocumentSuggestionDecisions}
              onAnalyzeSuggestions={() => void loadDocumentSuggestions(documentReviewKey, true)}
            />
          </div>
        )}
      </WizardLayout>

      {state.tutorialOpenedFor && (
        <ApiKeyTutorial
          provider={state.tutorialOpenedFor}
          locale={locale}
          onClose={() => update({ tutorialOpenedFor: undefined })}
          onComplete={() => {
            void fetch('/api/preferences', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tutorialsViewed: [state.tutorialOpenedFor] }),
            }).catch(() => undefined);
            update({ tutorialOpenedFor: undefined });
          }}
        />
      )}

      {state.tourStepIndex !== null && (
        <WelcomeTour
          locale={locale}
          stepIndex={state.tourStepIndex}
          onAdvance={() => update({ tourStepIndex: (state.tourStepIndex ?? 0) + 1 })}
          onSkip={() => void completeTour()}
          onStartDemo={() => void startDemo()}
        />
      )}
    </>
  );

  function upsertAnswer(questionId: string, answer: string, skipped = false) {
    update((prev) => {
      const existing = prev.answers.some((item) => item.questionId === questionId);
      const answers = existing
        ? prev.answers.map((item) =>
            item.questionId === questionId ? { questionId, answer, skipped } : item,
          )
        : [...prev.answers, { questionId, answer, skipped }];
      return {
        answers,
        completenessPercent: computeCompleteness(prev.questions, answers),
      };
    });
  }

  function changeQuestionText(questionId: string, text: string) {
    update((prev) => {
      const exists = prev.questions.some((question) => question.id === questionId);
      const questions = exists
        ? prev.questions.map((question) =>
            question.id === questionId ? { ...question, text } : question,
          )
        : [...prev.questions, { id: questionId, text, isRequired: false }];
      return { questions };
    });
  }

  function addCustomInformation() {
    const id = `custom.${Date.now()}`;
    update((prev) => ({
      questions: [
        ...prev.questions,
        { id, text: 'Dodatkowa informacja biznesowa', isRequired: false },
      ],
      answers: [...prev.answers, { questionId: id, answer: '', skipped: false }],
    }));
  }

  function removeQuestionAndAnswer(questionId: string) {
    update((prev) => ({
      questions: prev.questions.filter((question) => question.id !== questionId),
      answers: prev.answers.filter((answer) => answer.questionId !== questionId),
      completenessPercent: computeCompleteness(
        prev.questions.filter((question) => question.id !== questionId),
        prev.answers.filter((answer) => answer.questionId !== questionId),
      ),
    }));
  }

  function advanceQuestion() {
    const question = state.questions[state.activeQuestionIndex];
    if (question && !state.answers.some((answer) => answer.questionId === question.id)) {
      upsertAnswer(question.id, '', !question.isRequired);
    }
    if (state.activeQuestionIndex < state.questions.length - 1) {
      update({ activeQuestionIndex: state.activeQuestionIndex + 1 });
    } else {
      update({ currentStep: 3 });
    }
  }

  function skipActiveQuestion() {
    const question = state.questions[state.activeQuestionIndex];
    if (question) upsertAnswer(question.id, '', true);
    if (state.activeQuestionIndex < state.questions.length - 1) {
      update({ activeQuestionIndex: state.activeQuestionIndex + 1 });
    } else {
      update({ currentStep: 3 });
    }
  }

  function skipRemainingQuestions() {
    const skipped = state.questions.slice(state.activeQuestionIndex).map((question) => ({
      questionId: question.id,
      answer: '',
      skipped: true,
    }));
    update((prev) => ({
      answers: mergeAnswers(prev.answers, skipped),
      completenessPercent: 100,
      currentStep: 3,
    }));
  }

  function resolveModelConfig() {
    const known = getModelConfig(state.aiModel ?? '');
    if (known) return known;
    return {
      ...selectedModel,
      provider: state.aiProvider ?? selectedModel.provider,
      modelId: state.aiModel ?? selectedModel.modelId,
      name: state.aiModel ?? selectedModel.name,
    };
  }

  async function generateStandardsForProfile(profile: StandardsProfile, answers: QuestionAnswer[]) {
    const model = resolveModelConfig();
    const apiKey = state.isDemoMode ? 'demo-key' : state.apiKey.trim();
    if (!apiKey) {
      update({ currentStep: 4, apiKeyValid: null });
      throw new Error(MISSING_API_KEY_MESSAGE);
    }
    const generated = stripMarkdownCodeFence(
      await generation.generateStandards({
        profileId: profile.id,
        profileName: profile.name,
        followUpAnswers: buildStandardsContextAnswers(answers, state),
        aiProvider: model.provider,
        aiModel: model.modelId,
        apiKey,
        locale,
        demo: state.isDemoMode,
      }),
    );
    if (generated.trim().length === 0) {
      throw new Error('Generator zwrócił pusty plik standards.md.');
    }
    update({
      standards: generated,
      standardsSource: 'generated',
      standardsGeneration: {
        selectedProfileId: profile.id,
        followUpAnswers: answers,
        draftContent: generated,
      },
    });
    return generated;
  }

  async function startGeneration() {
    const model = resolveModelConfig();
    if (!state.targetTool) {
      setError('UNKNOWN', 'Wybierz narzędzie docelowe przed generowaniem.');
      return;
    }
    const apiKey = state.isDemoMode ? 'demo-key' : state.apiKey.trim();
    if (!apiKey) {
      update({ currentStep: 4, apiKeyValid: null, generationStatus: 'idle' });
      setError('AUTH_ERROR', MISSING_API_KEY_MESSAGE, false);
      return;
    }
    try {
      update({ generationStatus: 'generating', activeErrorProfile: null });
      const docs = await generation.generateSpec({
        projectPath: state.projectPath,
        projectDescription: state.projectDescription,
        answers: state.answers,
        targetTool: state.targetTool,
        aiProvider: model.provider,
        aiModel: model.modelId,
        apiKey,
        standards: state.standards,
        locale,
        demo: state.isDemoMode,
      });
      update({
        generatedDocuments: {
          requirements: docs.requirements ?? null,
          design: docs.design ?? null,
          tasks: docs.tasks ?? null,
        },
        documentHistory: {
          requirements: docs.requirements ? [docs.requirements] : [],
          design: docs.design ? [docs.design] : [],
          tasks: docs.tasks ? [docs.tasks] : [],
        },
        documentSuggestions: [],
        handledDocumentSuggestionKeys: [],
        documentSuggestionStatus: 'idle',
        documentSuggestionReviewKey: null,
        documentSuggestionIteration: 0,
        generationStatus: 'completed',
      });
      if (state.projectMode === 'edit') {
        setEditorGenerated(true);
        setSaveMessage('Nowa wersja dokumentów jest gotowa. Zapisz dokumenty, żeby zastąpić pliki w docs i przenieść stare wersje do old_docs.');
      }
    } catch (err) {
      update({ generationStatus: 'error' });
      setError('NETWORK_ERROR', (err as Error).message);
    }
  }

  function changeDocument(
    type: DocType,
    content: string,
    options?: { suppressSuggestionAnalysis?: boolean },
  ) {
    update((prev) => {
      const previous = prev.generatedDocuments[type];
      const generatedDocuments = { ...prev.generatedDocuments, [type]: content };
      return {
        generatedDocuments,
        documentHistory: {
          ...prev.documentHistory,
          [type]: appendHistory(prev.documentHistory[type], previous),
        },
        ...(options?.suppressSuggestionAnalysis
          ? {
              documentSuggestionStatus: 'complete' as const,
              documentSuggestionReviewKey: getDocumentsReviewKey(generatedDocuments),
            }
          : {}),
      };
    });
  }

  async function regenerateDocument(type: DocType, instructions: string) {
    const model = resolveModelConfig();
    if (!state.targetTool) return;
    const apiKey = state.isDemoMode ? 'demo-key' : state.apiKey.trim();
    if (!apiKey) {
      update({ currentStep: 4, apiKeyValid: null });
      setError('AUTH_ERROR', MISSING_API_KEY_MESSAGE, false);
      return;
    }
    const content = await generation.regenerateDocument({
      documentType: type,
      mode: 'all',
      additionalInstructions: instructions,
      projectDescription: state.projectDescription,
      answers: state.answers,
      targetTool: state.targetTool,
      aiProvider: model.provider,
      aiModel: model.modelId,
      apiKey,
      standards: state.standards,
      locale,
      previousDocuments: {
        requirements: state.generatedDocuments.requirements ?? undefined,
        design: state.generatedDocuments.design ?? undefined,
      },
      demo: state.isDemoMode,
    });
    return content;
  }

  async function applyDocumentSuggestionDecisions(decisions: DocumentSuggestionDecision[]) {
    if (decisions.length === 0) return;

    const handledKeys = decisions.flatMap((decision) =>
      getDocumentSuggestionHandledKeys(decision.suggestion),
    );
    const nextHandledKeys = uniqueStrings([...state.handledDocumentSuggestionKeys, ...handledKeys]);
    let nextDocuments = { ...state.generatedDocuments };
    const nextHistory = { ...state.documentHistory };
    let regenerated = false;

    try {
      for (const type of DOC_TYPES) {
        const typeDecisions = decisions.filter((decision) => decision.suggestion.documentType === type);
        const hasAccepted = typeDecisions.some((decision) => decision.decision === 'accepted');
        if (!hasAccepted) continue;

        const currentContent = nextDocuments[type];
        const nextContent = await regenerateDocument(
          type,
          buildSuggestionBatchRegenerationInstructions(type, typeDecisions),
        );
        if (typeof nextContent === 'string') {
          nextDocuments = { ...nextDocuments, [type]: nextContent };
          nextHistory[type] = appendHistory(nextHistory[type], currentContent);
          regenerated = true;
        }
      }

      const nextReviewKey = getDocumentsReviewKey(nextDocuments);
      update({
        generatedDocuments: nextDocuments,
        documentHistory: nextHistory,
        documentSuggestions: [],
        handledDocumentSuggestionKeys: nextHandledKeys,
        documentSuggestionStatus:
          regenerated && state.documentSuggestionIteration < MAX_DOCUMENT_SUGGESTION_ITERATIONS
            ? 'idle'
            : 'complete',
        documentSuggestionReviewKey:
          regenerated && state.documentSuggestionIteration < MAX_DOCUMENT_SUGGESTION_ITERATIONS
            ? null
            : nextReviewKey,
      });

      if (regenerated && state.documentSuggestionIteration < MAX_DOCUMENT_SUGGESTION_ITERATIONS) {
        void loadDocumentSuggestions(nextReviewKey, true, nextDocuments, nextHandledKeys);
      }
    } catch (err) {
      setError('NETWORK_ERROR', (err as Error).message);
      throw err;
    }
  }

  async function loadDocumentSuggestions(
    reviewKey = documentReviewKey,
    force = false,
    documentsToAnalyze = state.generatedDocuments,
    handledKeys = state.handledDocumentSuggestionKeys,
  ) {
    const model = resolveModelConfig();
    if (!state.isDemoMode && (!state.apiKey || !state.apiKeyValid)) return;
    const currentIteration = state.documentSuggestionIteration ?? 0;
    if (currentIteration >= MAX_DOCUMENT_SUGGESTION_ITERATIONS) {
      update({
        documentSuggestions: [],
        documentSuggestionStatus: 'complete',
        documentSuggestionReviewKey: reviewKey,
      });
      return;
    }
    const nextIteration = Math.min(currentIteration + 1, MAX_DOCUMENT_SUGGESTION_ITERATIONS);
    update({
      documentSuggestionStatus: 'analyzing',
      ...(force ? { documentSuggestions: [] } : {}),
    });
    const handled = new Set(handledKeys);
    const suggestions: DocumentSuggestion[] = [];
    for (const type of DOC_TYPES) {
      const content = documentsToAnalyze[type];
      if (!content) continue;
      try {
        const res = await fetch('/api/suggest', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(state.isDemoMode ? { 'x-demo-mode': 'true' } : {}),
          },
          body: JSON.stringify({
            kind: 'document-suggestions',
            context: { document: { type, content } },
            locale,
            aiProvider: model.provider,
            aiModel: model.modelId,
            apiKey: state.isDemoMode ? 'demo-key' : state.apiKey,
          }),
        });
        const body = (await res.json()) as { documentSuggestions?: DocumentSuggestion[] };
        if (body.documentSuggestions) {
          const nextSuggestions = body.documentSuggestions.map((suggestion) => ({
            ...suggestion,
            id: `${type}-${suggestion.id}`,
            documentType: type,
          }));
          suggestions.push(
            ...nextSuggestions.filter((suggestion) =>
              getDocumentSuggestionHandledKeys(suggestion).every((key) => !handled.has(key)),
            ),
          );
        }
      } catch {
        // Sugestie są pomocnicze.
      }
    }
    const uniqueSuggestions = dedupeSuggestions(suggestions).slice(0, 6);
    update({
      documentSuggestions: uniqueSuggestions,
      documentSuggestionStatus: 'complete',
      documentSuggestionReviewKey: reviewKey,
      documentSuggestionIteration: nextIteration,
    });
  }

  async function saveProjectInformation() {
    setSavingProjectInfo(true);
    setSaveMessage(null);
    try {
      const res = await fetch('/api/projects/save-state', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(state.isDemoMode ? { 'x-demo-mode': 'true' } : {}),
        },
        body: JSON.stringify({
          projectPath: state.projectPath,
          projectState: buildProjectSnapshotPayload(state, locale, []),
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Nie udało się zapisać informacji projektu.');
      }
      setSaveMessage('Informacje projektu zostały zapisane.');
    } catch (err) {
      setError('FILE_ACCESS', (err as Error).message);
    } finally {
      setSavingProjectInfo(false);
    }
  }

  async function saveAllDocuments() {
    setSavingDocuments(true);
    setSaveMessage(null);
    try {
      const documents = DOC_TYPES.flatMap((type) => {
        const content = state.generatedDocuments[type];
        return content ? [{ filename: `${type}.md`, content }] : [];
      });
      const res = await fetch('/api/files/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(state.isDemoMode ? { 'x-demo-mode': 'true' } : {}),
        },
        body: JSON.stringify({
          projectPath: state.projectPath,
          documents,
          archiveExisting: true,
          projectState: buildProjectSnapshotPayload(state, locale, documents),
        }),
      });
      const body = (await res.json()) as {
        success?: boolean;
        savedFiles?: string[];
        archivedFiles?: string[];
        error?: { message?: string };
      };
      if (!res.ok || !body.success) {
        throw new Error(body.error?.message ?? 'Nie udało się zapisać dokumentów.');
      }
      await registerRecentProject(state.projectPath, Boolean(state.standards?.trim()), state.isDemoMode)
        .then(() => refreshRecentProjects())
        .catch(() => undefined);
      setSaveMessage(null);
      reset();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError('FILE_ACCESS', (err as Error).message);
    } finally {
      setSavingDocuments(false);
    }
  }

  async function completeTour() {
    setTourDismissed(true);
    update({ tourStepIndex: null });
    await fetch('/api/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstRunComplete: true, preferredLocale: locale }),
    }).catch(() => undefined);
  }

  async function startDemo() {
    try {
      setTourDismissed(true);
      const res = await fetch(`/api/demo/scenario?locale=${locale}`);
      const scenario = (await res.json()) as {
        projectDescription?: string;
        prefilledAnswers?: QuestionAnswer[];
        mockedSuggestions?: DocumentSuggestion[];
      };
      const model = getStarterModel();
      update({
        isDemoMode: true,
        tourStepIndex: null,
        projectPath: '[demo]',
        projectSource: 'manual',
        pathValidation: { valid: true, exists: true, writable: true, hasStandards: false },
        projectDescription: scenario.projectDescription ?? '',
        questions: [],
        answers: scenario.prefilledAnswers ?? [],
        documentSuggestions: scenario.mockedSuggestions ?? [],
        handledDocumentSuggestionKeys: [],
        documentSuggestionIteration: scenario.mockedSuggestions?.length ? 1 : 0,
        documentSuggestionStatus: scenario.mockedSuggestions?.length ? 'complete' : 'idle',
        documentSuggestionReviewKey: null,
        targetTool: 'universal',
        aiProvider: model.provider,
        aiModel: model.modelId,
        apiKey: '',
        apiKeyValid: true,
        standards: null,
        standardsSource: null,
        currentStep: 2,
      });
      await fetch('/api/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-demo-mode': 'true' },
        body: JSON.stringify({ firstRunComplete: true }),
      }).catch(() => undefined);
    } catch (err) {
      setError('UNKNOWN', (err as Error).message);
    }
  }

  async function handleErrorAction(action: FixAction, profile: ErrorProfileData) {
    if (action.kind === 'retry') {
      update({ activeErrorProfile: null });
      return;
    }
    if (action.kind === 'open-tutorial') {
      update({ tutorialOpenedFor: state.aiProvider ?? 'openai', activeErrorProfile: null });
      return;
    }
    if (action.kind === 'open-path-picker') {
      update({ currentStep: 0, activeErrorProfile: null });
      return;
    }
    if (action.kind === 'switch-model') {
      update({ currentStep: 4, activeErrorProfile: null });
      return;
    }
    if (action.kind === 'open-step') {
      const stepId = action.payload?.stepId;
      const idx = typeof stepId === 'string' ? STEPS.findIndex((step) => step.id === stepId) : -1;
      update({ currentStep: idx >= 0 ? idx : state.currentStep, activeErrorProfile: null });
      return;
    }
    if (action.kind === 'copy-report' || action.kind === 'copy-prompt') {
      await navigator.clipboard?.writeText(JSON.stringify(profile, null, 2)).catch(() => undefined);
    }
  }
}

function QuestionsStep({
  state,
  loading,
  completenessPercent,
  onAnswerChange,
  onSkip,
  onSkipAll,
  onPreviousQuestion,
  onNextQuestion,
  onRequestMore,
  onContinue,
}: {
  state: SessionState;
  loading: boolean;
  completenessPercent: number;
  onAnswerChange: (questionId: string, answer: string, skipped?: boolean) => void;
  onSkip: () => void;
  onSkipAll: () => void;
  onPreviousQuestion: () => void;
  onNextQuestion: () => void;
  onRequestMore: () => void;
  onContinue: () => void;
}) {
  if (loading && state.questions.length === 0) {
    return (
      <Card variant="inset" padding="lg" className="max-w-2xl">
        <p className="eyebrow mb-3">Analiza opisu</p>
        <h2 className="font-display text-3xl text-ink">Generuję pytania doprecyzowujące...</h2>
      </Card>
    );
  }

  if (state.questions.length === 0) {
    return (
      <Card variant="ghost" padding="lg" className="max-w-2xl">
        <h2 className="font-display text-3xl text-ink">Nie ma jeszcze pytań</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Możesz spróbować ponownie albo przejść dalej z samym opisem.
        </p>
        <div className="mt-6 flex gap-2">
          <Button variant="outline" onClick={onRequestMore} loading={loading}>
            Wygeneruj pytania
          </Button>
          <Button variant="primary" onClick={onContinue}>
            Przejdź dalej
          </Button>
        </div>
      </Card>
    );
  }

  const question = state.questions[state.activeQuestionIndex] ?? state.questions[0]!;
  const answer = state.answers.find((item) => item.questionId === question.id)?.answer ?? '';

  return (
    <div className="space-y-6">
      <ChatLikeQuestion
        question={question}
        questionIndex={Math.min(state.activeQuestionIndex + 1, state.questions.length)}
        totalQuestions={state.questions.length}
        completenessPercent={completenessPercent}
        currentAnswer={answer}
        onAnswerChange={(value) => onAnswerChange(question.id, value)}
        onNext={onNextQuestion}
        onPrevious={onPreviousQuestion}
        onSkip={onSkip}
        onSkipAllRemaining={onSkipAll}
        onRequestMore={onRequestMore}
        canGoPrevious={state.activeQuestionIndex > 0}
      />
      {completenessPercent >= 80 && (
        <Button variant="outline" iconLeft={<Sparkles size={14} />} onClick={onContinue}>
          Zakończ pytania i dobierz narzędzie
        </Button>
      )}
    </div>
  );
}

function GenerateStep({
  state,
  progress,
  documents,
  onStart,
  onContinue,
}: {
  state: SessionState;
  progress: ReturnType<typeof useGeneration>['progress'];
  documents: { requirements?: string; design?: string; tasks?: string };
  onStart: () => void;
  onContinue: () => void;
}) {
  const ready = DOC_TYPES.every((type) => documents[type]);
  return (
    <div className="space-y-7">
      <Card variant="inset" padding="lg" className="max-w-3xl">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Sesja gotowa</p>
            <h2 className="font-display text-3xl text-ink">
              {state.isDemoMode ? 'Uruchom generowanie demo' : 'Uruchom generowanie dokumentów'}
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Powstaną pliki requirements.md, design.md i tasks.md.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={onStart} loading={progress.status === 'generating'}>
              {ready ? 'Wygeneruj ponownie' : 'Start'}
            </Button>
            {ready && (
              <Button variant="outline" onClick={onContinue}>
                Przejdź do podglądu
              </Button>
            )}
          </div>
        </div>
      </Card>
      <GenerationProgress progress={progress} documents={documents} />
    </div>
  );
}

function computeCompleted(state: SessionState): Partial<Record<StepId, boolean>> {
  return {
    project: !!state.projectPath && state.pathValidation?.valid === true,
    description: validateDescription(state.projectDescription).valid,
    questions: state.questions.length === 0 ? state.answers.length > 0 : computeCompleteness(state.questions, state.answers) >= 80,
    tool: state.targetTool !== null,
    model: state.isDemoMode
      ? state.aiModel !== null && state.aiProvider !== null
      : state.aiModel !== null && state.apiKey.trim().length > 0 && state.apiKeyValid === true,
    standards: state.standardsSource !== null,
    generate: state.generationStatus === 'completed',
    preview: DOC_TYPES.every((type) => Boolean(state.generatedDocuments[type])),
  };
}

function canAdvanceFrom(stepId: StepId, state: SessionState, completenessPercent: number): boolean {
  if (stepId === 'description') return validateDescription(state.projectDescription).valid;
  if (stepId === 'questions') return state.questions.length === 0 || completenessPercent >= 50 || state.answers.length > 0;
  if (stepId === 'tool') return state.targetTool !== null;
  if (stepId === 'model') {
    return state.isDemoMode
      ? Boolean(state.aiProvider && state.aiModel)
      : Boolean(state.aiProvider && state.aiModel && state.apiKey.trim().length > 0 && state.apiKeyValid === true);
  }
  if (stepId === 'standards') return state.standardsSource !== null;
  if (stepId === 'generate') return state.generationStatus === 'completed' || DOC_TYPES.every((type) => Boolean(state.generatedDocuments[type]));
  return false;
}

function computeCompleteness(questions: Question[], answers: QuestionAnswer[]): number {
  if (questions.length === 0) return answers.length > 0 ? 100 : 0;
  const answered = questions.filter((question) => {
    const answer = answers.find((item) => item.questionId === question.id);
    return answer && (answer.skipped || answer.answer.trim().length > 0);
  }).length;
  return Math.min(100, Math.round((answered / questions.length) * 100));
}

function buildStandardsContextAnswers(
  profileAnswers: QuestionAnswer[],
  state: SessionState,
): QuestionAnswer[] {
  const contextAnswers: QuestionAnswer[] = [
    {
      questionId: 'context.projectDescription',
      answer: state.projectDescription,
      skipped: state.projectDescription.trim().length === 0,
    },
    {
      questionId: 'context.targetTool',
      answer: state.targetTool ?? '',
      skipped: !state.targetTool,
    },
    {
      questionId: 'context.aiModel',
      answer: state.aiModel ?? '',
      skipped: !state.aiModel,
    },
    ...state.answers.map((answer) => ({
      questionId: `context.question.${answer.questionId}`,
      answer: answer.answer,
      skipped: answer.skipped,
    })),
  ];

  return mergeAnswers(profileAnswers, contextAnswers);
}

function mergeAnswers(current: QuestionAnswer[], incoming: QuestionAnswer[]): QuestionAnswer[] {
  const byId = new Map(current.map((answer) => [answer.questionId, answer]));
  for (const answer of incoming) byId.set(answer.questionId, answer);
  return Array.from(byId.values());
}

function appendHistory(history: string[], previous: string | null): string[] {
  if (!previous) return history;
  if (history[history.length - 1] === previous) return history;
  return [...history, previous].slice(-5);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function dedupeSuggestions(suggestions: DocumentSuggestion[]): DocumentSuggestion[] {
  const seen = new Set<string>();
  const unique: DocumentSuggestion[] = [];
  for (const suggestion of suggestions) {
    const key = getDocumentSuggestionKey(suggestion);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(suggestion);
  }
  return unique;
}

function getStarterModel() {
  return getModelConfig(STARTER_MODEL_ID) ?? MODEL_CATALOG[0]!;
}

async function loadExistingProjectWorkspace(
  projectPath: string,
  demo: boolean,
): Promise<LoadedProjectWorkspace | null> {
  try {
    const res = await fetch('/api/projects/load', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(demo ? { 'x-demo-mode': 'true' } : {}),
      },
      body: JSON.stringify({ projectPath }),
    });
    if (!res.ok) return null;
    return (await res.json()) as LoadedProjectWorkspace;
  } catch {
    return null;
  }
}

async function fetchRecentProjects(): Promise<RecentProjectWithSummary[]> {
  const res = await fetch('/api/projects/recent');
  if (!res.ok) throw new Error('Nie udało się pobrać ostatnich projektów.');
  const body = (await res.json()) as { projects?: RecentProjectWithSummary[] };
  return body.projects ?? [];
}

async function registerRecentProject(
  projectPath: string,
  hasStandards: boolean,
  demo: boolean,
): Promise<void> {
  if (demo || !projectPath.trim()) return;
  const name = projectPath.split(/[/\\]/).filter(Boolean).pop() ?? 'Project';
  const res = await fetch('/api/projects/recent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: projectPath, name, hasStandards }),
  });
  if (!res.ok) throw new Error('Nie udało się zapisać projektu w ostatnich.');
}

function buildLoadedProjectPatch(
  workspace: LoadedProjectWorkspace,
  locale: AppLocale,
): Partial<SessionState> {
  const snapshot = workspace.projectState;
  const documents = hasAnyDocument(workspace.documents)
    ? workspace.documents
    : snapshot?.generatedDocuments ?? { requirements: null, design: null, tasks: null };
  const standards =
    workspace.standards ??
    snapshot?.standards ??
    null;

  if (!snapshot) {
    return {
      standards,
      standardsSource: standards ? 'existing' : null,
      generatedDocuments: documents,
      documentHistory: { requirements: [], design: [], tasks: [] },
      documentSuggestions: [],
      handledDocumentSuggestionKeys: [],
      documentSuggestionStatus: 'idle',
      documentSuggestionReviewKey: null,
      documentSuggestionIteration: 0,
      generationStatus: hasAnyDocument(documents) ? 'completed' : 'idle',
    };
  }

  return {
    projectDescription: snapshot.projectDescription,
    questions: snapshot.questions,
    answers: snapshot.answers,
    activeQuestionIndex: 0,
    completenessPercent: computeCompleteness(snapshot.questions, snapshot.answers),
    targetTool: snapshot.targetTool,
    toolRecommendation: snapshot.toolRecommendation,
    aiProvider: snapshot.aiProvider,
    aiModel: snapshot.aiModel,
    modelRecommendation: snapshot.modelRecommendation,
    standards,
    standardsSource: snapshot.standardsSource ?? (standards ? 'existing' : null),
    standardsGeneration: snapshot.standardsGeneration,
    generatedDocuments: documents,
    documentHistory: snapshot.documentHistory,
    documentSuggestions: [],
    handledDocumentSuggestionKeys: snapshot.handledDocumentSuggestionKeys,
    documentSuggestionStatus: 'idle',
    documentSuggestionReviewKey: null,
    documentSuggestionIteration: snapshot.documentSuggestionIteration,
    locale,
    generationStatus: hasAnyDocument(documents) ? 'completed' : 'idle',
  };
}

function buildProjectSnapshotPayload(
  state: SessionState,
  locale: AppLocale,
  documents: Array<{ filename: string; content: string }>,
): ProjectSnapshot {
  const generatedDocuments = { ...state.generatedDocuments };
  for (const doc of documents) {
    const type = docTypeFromFilename(doc.filename);
    if (type) generatedDocuments[type] = doc.content;
  }

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    locale,
    projectDescription: state.projectDescription,
    questions: state.questions,
    answers: state.answers,
    targetTool: state.targetTool,
    toolRecommendation: state.toolRecommendation,
    aiProvider: state.aiProvider,
    aiModel: state.aiModel,
    modelRecommendation: state.modelRecommendation,
    standards: state.standards,
    standardsSource: state.standardsSource,
    ...(state.standardsGeneration ? { standardsGeneration: state.standardsGeneration } : {}),
    generatedDocuments,
    documentHistory: state.documentHistory,
    handledDocumentSuggestionKeys: state.handledDocumentSuggestionKeys,
    documentSuggestions: state.documentSuggestions,
    documentSuggestionIteration: state.documentSuggestionIteration ?? 0,
  };
}

function hasAnyDocument(documents: ProjectSnapshot['generatedDocuments']): boolean {
  return Boolean(documents.requirements || documents.design || documents.tasks);
}

function hasRestorableProjectData(
  workspace: LoadedProjectWorkspace | null,
  standards: string | null,
  documents: ProjectSnapshot['generatedDocuments'],
): boolean {
  return Boolean(
    workspace?.projectState ||
    standards ||
    hasAnyDocument(documents),
  );
}

function docTypeFromFilename(filename: string): DocType | null {
  if (filename === 'requirements.md') return 'requirements';
  if (filename === 'design.md') return 'design';
  if (filename === 'tasks.md') return 'tasks';
  return null;
}

function isErrorProfileData(value: unknown): value is ErrorProfileData {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ErrorProfileData>;
  return (
    typeof item.errorId === 'string' &&
    typeof item.code === 'string' &&
    typeof item.whatHappened === 'string' &&
    Array.isArray(item.howToFix) &&
    Array.isArray(item.fixActions)
  );
}

function buildClientErrorProfile(
  code: ErrorCode,
  message: string,
  locale: AppLocale,
  retryable: boolean,
): ErrorProfileData {
  const pl = locale === 'pl';
  return {
    errorId:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `err-${Date.now()}`,
    code,
    whatHappened: message || (pl ? 'Operacja nie powiodła się.' : 'The operation failed.'),
    whatItMeans: pl
      ? 'Stan sesji został zachowany. Możesz poprawić ustawienia albo spróbować ponownie.'
      : 'Your session state was preserved. You can adjust settings or try again.',
    howToFix: pl
      ? ['Sprawdź bieżący krok i wymagane pola.', 'Spróbuj ponownie.', 'Jeśli dotyczy to klucza, otwórz tutorial dostawcy.']
      : ['Check the current step and required fields.', 'Try again.', 'If this is about a key, open the provider tutorial.'],
    fixActions: [
      { label: pl ? 'Spróbuj ponownie' : 'Try again', kind: 'retry', primary: true },
      { label: pl ? 'Zmień model' : 'Switch model', kind: 'switch-model' },
      { label: pl ? 'Kopiuj raport' : 'Copy report', kind: 'copy-report' },
    ],
    retryable,
  };
}
