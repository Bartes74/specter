/**
 * Schematy walidacji body żądań API (zod).
 * Współdzielone z UI dla type-safe fetch.
 */
import { z } from 'zod';
import { AI_PROVIDERS, TARGET_TOOLS } from '@/types/providers';

const localeSchema = z.enum(['pl', 'en']);
const providerSchema = z.enum(AI_PROVIDERS);
const targetToolSchema = z.enum(TARGET_TOOLS);
const documentTypeSchema = z.enum(['requirements', 'design', 'tasks']);

const questionAnswerSchema = z.object({
  questionId: z.string().min(1),
  questionText: z.string().min(1).optional(),
  answer: z.string(),
  skipped: z.boolean(),
});

const suggestedAnswerSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  value: z.string().min(1),
});

const questionSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  hint: z.string().optional(),
  isRequired: z.boolean(),
  suggestedAnswers: z.array(suggestedAnswerSchema).optional(),
});

const confidenceSchema = z.enum(['low', 'medium', 'high']);

const toolRecommendationSchema = z.object({
  recommended: targetToolSchema,
  reason: z.string().min(1),
  confidence: confidenceSchema,
});

const modelRecommendationSchema = z.object({
  recommended: z.string().min(1),
  reason: z.string().min(1),
  confidence: confidenceSchema,
});

const documentSuggestionSchema = z.object({
  id: z.string().min(1),
  documentType: documentTypeSchema,
  sectionAnchor: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string().min(1),
  suggestedAction: z.string().min(1),
});

const generatedDocumentsSchema = z.object({
  requirements: z.string().nullable(),
  design: z.string().nullable(),
  tasks: z.string().nullable(),
});

const documentHistorySchema = z.object({
  requirements: z.array(z.string()).default([]),
  design: z.array(z.string()).default([]),
  tasks: z.array(z.string()).default([]),
});

// --- /api/validate/path ---

export const validatePathSchema = z.object({
  projectPath: z.string().min(1),
  ensureDocs: z.boolean().optional(),
});
export type ValidatePathInput = z.infer<typeof validatePathSchema>;

// --- /api/projects/recent (POST) ---

export const addRecentProjectSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1),
  hasStandards: z.boolean(),
});
export type AddRecentProjectInput = z.infer<typeof addRecentProjectSchema>;

// --- /api/projects/create ---

export const createProjectSchema = z.object({
  parentPath: z.string().min(1),
  projectName: z.string().min(1),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// --- /api/projects/load ---

export const loadProjectSchema = z.object({
  projectPath: z.string().min(1),
});
export type LoadProjectInput = z.infer<typeof loadProjectSchema>;

// --- /api/projects/delete ---

export const deleteProjectSchema = z.object({
  projectPath: z.string().min(1),
});
export type DeleteProjectInput = z.infer<typeof deleteProjectSchema>;

// --- Project snapshot stored next to project files ---

export const projectSnapshotSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  updatedAt: z.string().min(1),
  locale: localeSchema,
  currentStep: z.number().int().min(0).max(20).default(0),
  activeQuestionIndex: z.number().int().min(0).max(100).default(0),
  projectDescription: z.string().max(10_000),
  questions: z.array(questionSchema).default([]),
  answers: z.array(questionAnswerSchema).default([]),
  targetTool: targetToolSchema.nullable(),
  toolRecommendation: toolRecommendationSchema.nullable(),
  aiProvider: providerSchema.nullable(),
  aiModel: z.string().nullable(),
  modelRecommendation: modelRecommendationSchema.nullable(),
  standards: z.string().nullable(),
  standardsSource: z.enum(['existing', 'generated', 'skipped']).nullable(),
  standardsGeneration: z
    .object({
      selectedProfileId: z.string().nullable(),
      followUpAnswers: z.array(questionAnswerSchema).default([]),
      draftContent: z.string().nullable(),
    })
    .optional(),
  generatedDocuments: generatedDocumentsSchema,
  documentHistory: documentHistorySchema,
  handledDocumentSuggestionKeys: z.array(z.string()).default([]),
  documentSuggestions: z.array(documentSuggestionSchema).default([]),
  documentSuggestionIteration: z.number().int().min(0).max(10).default(0),
});
export type ProjectSnapshotInput = z.infer<typeof projectSnapshotSchema>;

// --- /api/projects/save-state ---

export const saveProjectStateSchema = z.object({
  projectPath: z.string().min(1),
  projectState: projectSnapshotSchema,
});
export type SaveProjectStateInput = z.infer<typeof saveProjectStateSchema>;

// --- /api/files/save ---

export const saveFilesSchema = z.object({
  projectPath: z.string().min(1),
  archiveExisting: z.boolean().optional(),
  projectState: projectSnapshotSchema.optional(),
  generatedStandards: z
    .object({
      content: z.string().refine((value) => value.trim().length > 0, 'standards.empty'),
    })
    .optional(),
  documents: z
    .array(
      z.object({
        filename: z.string().min(1).max(100),
        content: z.string(),
      }),
    )
    .min(1)
    .max(10),
});
export type SaveFilesInput = z.infer<typeof saveFilesSchema>;

// --- /api/questions ---

export const questionsSchema = z.object({
  projectDescription: z.string().min(20).max(10_000),
  previousAnswers: z.array(questionAnswerSchema).optional(),
  standards: z.string().optional().nullable(),
  locale: localeSchema,
  aiProvider: providerSchema.optional(),
  aiModel: z.string().min(1).optional(),
  apiKey: z.string().min(1).optional(),
});
export type QuestionsInput = z.infer<typeof questionsSchema>;

// --- /api/generate ---

export const generateSchema = z.object({
  projectPath: z.string().min(1),
  projectDescription: z.string().min(20).max(10_000),
  answers: z.array(questionAnswerSchema),
  targetTool: targetToolSchema,
  aiProvider: providerSchema,
  aiModel: z.string().min(1),
  apiKey: z.string().min(1),
  standards: z.string().optional().nullable(),
  locale: localeSchema,
});
export type GenerateInput = z.infer<typeof generateSchema>;

// --- /api/standards/generate ---

export const generateStandardsSchema = z.object({
  profileId: z.string().min(1),
  profileName: z.string().min(1),
  followUpAnswers: z.array(questionAnswerSchema),
  locale: localeSchema,
  aiProvider: providerSchema,
  aiModel: z.string().min(1),
  apiKey: z.string().optional(),
  demo: z.boolean().optional(),
});
export type GenerateStandardsInput = z.infer<typeof generateStandardsSchema>;
