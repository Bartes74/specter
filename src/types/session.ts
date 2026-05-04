/**
 * Typy stanu sesji (zgodne z `SessionState` z design.md).
 * Stan żyje wyłącznie w sessionStorage przeglądarki — klucze API nigdy nie trafiają na serwer trwale.
 */
import type { AIProvider, TargetTool } from './providers';

export type AppLocale = 'pl' | 'en';

export interface PathValidationResult {
  valid: boolean;
  exists: boolean;
  writable: boolean;
  hasStandards: boolean;
  standardsPreview?: string;
  error?: string;
}

export interface Question {
  id: string;
  text: string;
  hint?: string;
  isRequired: boolean;
  suggestedAnswers?: SuggestedAnswer[];
}

export interface SuggestedAnswer {
  id: string;
  label: string;
  value: string;
}

export interface QuestionAnswer {
  questionId: string;
  answer: string;
  skipped: boolean;
}

export interface Recommendation<T> {
  recommended: T;
  reason: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface DocumentSuggestion {
  id: string;
  documentType: 'requirements' | 'design' | 'tasks';
  sectionAnchor?: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  suggestedAction: string;
}

export interface DocumentSuggestionDecision {
  suggestion: DocumentSuggestion;
  decision: 'accepted' | 'rejected';
  note: string;
}

export type ProjectSource = 'recent' | 'picker' | 'drop' | 'created' | 'manual';

export interface SessionState {
  // Krok 1: Konfiguracja
  projectPath: string;
  pathValidation: PathValidationResult | null;
  projectSource: ProjectSource | null;

  // Krok 2: Opis projektu
  projectDescription: string;

  // Krok 3: Pytania doprecyzowujące (chat-like)
  questions: Question[];
  answers: QuestionAnswer[];
  activeQuestionIndex: number;
  completenessPercent: number;

  // Krok 4: Wybór narzędzia (z rekomendacją)
  targetTool: TargetTool | null;
  toolRecommendation: Recommendation<TargetTool> | null;

  // Krok 5: Wybór modelu (z rekomendacją + tutorial)
  aiProvider: AIProvider | null;
  aiModel: string | null;
  modelRecommendation: Recommendation<string> | null;
  apiKey: string;
  apiKeyValid: boolean | null;
  tutorialOpenedFor?: AIProvider;

  // Krok 6: Standardy
  standards: string | null;
  standardsSource: 'existing' | 'generated' | 'skipped' | null;
  standardsGeneration?: {
    selectedProfileId: string | null;
    followUpAnswers: QuestionAnswer[];
    draftContent: string | null;
  };

  // Krok 7: Wygenerowane dokumenty + historia
  generatedDocuments: {
    requirements: string | null;
    design: string | null;
    tasks: string | null;
  };
  documentHistory: {
    requirements: string[];
    design: string[];
    tasks: string[];
  };
  documentSuggestions: DocumentSuggestion[];
  handledDocumentSuggestionKeys: string[];
  documentSuggestionStatus: 'idle' | 'analyzing' | 'complete' | 'error';
  documentSuggestionReviewKey: string | null;
  documentSuggestionIteration: number;

  // Meta
  currentStep: number;
  locale: AppLocale;
  generationStatus: 'idle' | 'generating' | 'completed' | 'error';

  // Tour i Tryb Demo
  isDemoMode: boolean;
  tourStepIndex: number | null;

  // Aktywny Profil_Błędu (struktura z src/lib/errors.ts)
  activeErrorProfile: unknown | null;
}

export function createInitialSessionState(locale: AppLocale = 'pl'): SessionState {
  return {
    projectPath: '',
    pathValidation: null,
    projectSource: null,
    projectDescription: '',
    questions: [],
    answers: [],
    activeQuestionIndex: 0,
    completenessPercent: 0,
    targetTool: null,
    toolRecommendation: null,
    aiProvider: null,
    aiModel: null,
    modelRecommendation: null,
    apiKey: '',
    apiKeyValid: null,
    standards: null,
    standardsSource: null,
    generatedDocuments: { requirements: null, design: null, tasks: null },
    documentHistory: { requirements: [], design: [], tasks: [] },
    documentSuggestions: [],
    handledDocumentSuggestionKeys: [],
    documentSuggestionStatus: 'idle',
    documentSuggestionReviewKey: null,
    documentSuggestionIteration: 0,
    currentStep: 0,
    locale,
    generationStatus: 'idle',
    isDemoMode: false,
    tourStepIndex: null,
    activeErrorProfile: null,
  };
}
