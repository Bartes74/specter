/**
 * Schematy walidacji body żądań API (zod).
 * Współdzielone z UI dla type-safe fetch.
 */
import { z } from 'zod';
import { AI_PROVIDERS, TARGET_TOOLS } from '@/types/providers';

const localeSchema = z.enum(['pl', 'en']);
const providerSchema = z.enum(AI_PROVIDERS);
const targetToolSchema = z.enum(TARGET_TOOLS);

const questionAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string(),
  skipped: z.boolean(),
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

// --- /api/files/save ---

export const saveFilesSchema = z.object({
  projectPath: z.string().min(1),
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
