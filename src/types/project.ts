import type {
  AppLocale,
  DocumentSuggestion,
  Question,
  QuestionAnswer,
  Recommendation,
} from './session';
import type { AIProvider, TargetTool } from './providers';

export type ProjectDocumentType = 'requirements' | 'design' | 'tasks';

export interface ProjectSnapshot {
  schemaVersion: 1;
  updatedAt: string;
  locale: AppLocale;
  projectDescription: string;
  questions: Question[];
  answers: QuestionAnswer[];
  targetTool: TargetTool | null;
  toolRecommendation: Recommendation<TargetTool> | null;
  aiProvider: AIProvider | null;
  aiModel: string | null;
  modelRecommendation: Recommendation<string> | null;
  standards: string | null;
  standardsSource: 'existing' | 'generated' | 'skipped' | null;
  standardsGeneration?: {
    selectedProfileId: string | null;
    followUpAnswers: QuestionAnswer[];
    draftContent: string | null;
  };
  generatedDocuments: Record<ProjectDocumentType, string | null>;
  documentHistory: Record<ProjectDocumentType, string[]>;
  handledDocumentSuggestionKeys: string[];
  documentSuggestions: DocumentSuggestion[];
  documentSuggestionIteration: number;
}

export interface LoadedProjectWorkspace {
  projectState: ProjectSnapshot | null;
  documents: Record<ProjectDocumentType, string | null>;
  standards: string | null;
}

export interface RecentProjectSummary {
  hasProjectState: boolean;
  descriptionPreview: string | null;
  questionsCount: number;
  answersCount: number;
  targetTool: TargetTool | null;
  aiProvider: AIProvider | null;
  aiModel: string | null;
  documentsCount: number;
  standardsSource: ProjectSnapshot['standardsSource'];
  updatedAt: string | null;
}

export interface RecentProjectWithSummary {
  path: string;
  name: string;
  lastUsedAt: string;
  hasStandards: boolean;
  summary?: RecentProjectSummary;
}
