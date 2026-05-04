/**
 * POST /api/suggest — rekomendacje narzędzia/modelu/sugestie dokumentów (Wymaganie 4.2, 5.2, 13.8).
 *
 * Body:
 *   { kind: 'tool' | 'model' | 'document-suggestions', context: {...}, locale, aiProvider, aiModel, apiKey }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  recommendTool,
  recommendToolHeuristic,
  recommendModel,
  analyzeDocument,
} from '@/services/RecommendationService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { AI_PROVIDERS } from '@/types/providers';
import { AIAdapterError } from '@/services/ai/types';
import { safeLog } from '@/lib/security';

export const dynamic = 'force-dynamic';

const questionAnswerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string(),
  skipped: z.boolean(),
});

const suggestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('tool'),
    context: z.object({
      projectDescription: z.string().min(1),
      answers: z.array(questionAnswerSchema).default([]),
      standards: z.string().optional().nullable(),
    }),
    locale: z.enum(['pl', 'en']),
    aiProvider: z.enum(AI_PROVIDERS).optional(),
    aiModel: z.string().optional(),
    apiKey: z.string().optional(),
  }),
  z.object({
    kind: z.literal('model'),
    context: z.object({
      projectDescription: z.string().min(1),
      answers: z.array(questionAnswerSchema).default([]),
      standards: z.string().optional().nullable(),
    }),
    locale: z.enum(['pl', 'en']),
    // model i klucz API NIE są wymagane dla rekomendacji modelu (heurystyka po stronie serwera)
    aiProvider: z.enum(AI_PROVIDERS).optional(),
    aiModel: z.string().optional(),
    apiKey: z.string().optional(),
  }),
  z.object({
    kind: z.literal('document-suggestions'),
    context: z.object({
      document: z.object({
        type: z.enum(['requirements', 'design', 'tasks']),
        content: z.string().min(1),
      }),
    }),
    locale: z.enum(['pl', 'en']),
    aiProvider: z.enum(AI_PROVIDERS),
    aiModel: z.string().min(1),
    apiKey: z.string().min(1),
  }),
]);

const DEMO_RESPONSE = {
  pl: {
    tool: {
      recommended: 'claude-code' as const,
      reason: 'Demo: Claude Code dobrze pasuje do projektów wymagających długiego kontekstu.',
      confidence: 'medium' as const,
    },
    model: {
      recommended: 'gpt-5-mini',
      reason: 'Demo: GPT-5 mini oferuje dobry balans jakości i kosztu.',
      confidence: 'medium' as const,
    },
    suggestions: [
      {
        id: 'demo-1',
        documentType: 'requirements' as const,
        severity: 'info' as const,
        message: 'Demo: rozważ dodanie sekcji "Bezpieczeństwo" do wymagań.',
        suggestedAction: 'Dodaj wymaganie dotyczące uwierzytelniania.',
      },
    ],
  },
  en: {
    tool: {
      recommended: 'claude-code' as const,
      reason: 'Demo: Claude Code fits projects requiring a long context.',
      confidence: 'medium' as const,
    },
    model: {
      recommended: 'gpt-5-mini',
      reason: 'Demo: GPT-5 mini offers a good quality-cost balance.',
      confidence: 'medium' as const,
    },
    suggestions: [
      {
        id: 'demo-1',
        documentType: 'requirements' as const,
        severity: 'info' as const,
        message: 'Demo: consider adding a "Security" section to requirements.',
        suggestedAction: 'Add an authentication requirement.',
      },
    ],
  },
};

export async function POST(req: Request) {
  const parsed = await parseBody(req, suggestSchema);
  if (parsed.error) return parsed.error;

  const input = parsed.data;
  const demo = isDemoMode(req);

  try {
    if (input.kind === 'model') {
      // Heurystyka — działa zawsze, bez wywołań AI
      const model = recommendModel({
        projectDescription: input.context.projectDescription,
        answers: input.context.answers ?? [],
        standards: input.context.standards,
        locale: input.locale,
      });
      return NextResponse.json({ modelRecommendation: model });
    }

    if (demo) {
      if (input.kind === 'tool') {
        return NextResponse.json({ toolRecommendation: DEMO_RESPONSE[input.locale].tool });
      }
      if (input.kind === 'document-suggestions') {
        return NextResponse.json({ documentSuggestions: DEMO_RESPONSE[input.locale].suggestions });
      }
    }

    if (input.kind === 'tool') {
      if (!input.aiProvider || !input.aiModel || !input.apiKey) {
        const tool = recommendToolHeuristic({
          projectDescription: input.context.projectDescription,
          answers: input.context.answers ?? [],
          standards: input.context.standards,
          locale: input.locale,
        });
        return NextResponse.json({ toolRecommendation: tool });
      }
      const tool = await recommendTool(
        { provider: input.aiProvider, modelId: input.aiModel, apiKey: input.apiKey },
        {
          projectDescription: input.context.projectDescription,
          answers: input.context.answers ?? [],
          standards: input.context.standards,
          locale: input.locale,
        },
      );
      return NextResponse.json({ toolRecommendation: tool });
    }

    if (input.kind === 'document-suggestions') {
      const suggestions = await analyzeDocument(
        { provider: input.aiProvider, modelId: input.aiModel, apiKey: input.apiKey },
        input.context.document.type,
        input.context.document.content,
        input.locale,
      );
      return NextResponse.json({ documentSuggestions: suggestions });
    }

    return errorResponse(400, 'KIND_UNKNOWN', 'Unknown suggestion kind');
  } catch (err) {
    safeLog.error('[/api/suggest] failed:', err);
    if (err instanceof AIAdapterError) {
      return errorResponse(502, err.code, err.message);
    }
    return errorResponse(500, 'UNKNOWN', (err as Error).message);
  }
}
