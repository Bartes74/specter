/**
 * POST /api/generate/document — regeneracja całego dokumentu albo pojedynczej sekcji.
 */
import { z } from 'zod';
import { generateDocumentRobust } from '@/services/AIService';
import {
  createSSEStream,
  isDemoMode,
  parseBody,
  type SSEEvent,
} from '@/lib/api-helpers';
import { AI_PROVIDERS, TARGET_TOOLS } from '@/types/providers';
import { AIAdapterError } from '@/services/ai/types';
import { safeLog } from '@/lib/security';

export const dynamic = 'force-dynamic';

const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string(),
  skipped: z.boolean(),
});

const schema = z.object({
  documentType: z.enum(['requirements', 'design', 'tasks']),
  mode: z.enum(['all', 'section']).optional(),
  sectionAnchor: z.string().optional(),
  additionalInstructions: z.string().optional(),
  projectDescription: z.string().min(20).max(10_000),
  answers: z.array(answerSchema),
  targetTool: z.enum(TARGET_TOOLS),
  aiProvider: z.enum(AI_PROVIDERS),
  aiModel: z.string().min(1),
  apiKey: z.string().min(1),
  standards: z.string().optional().nullable(),
  locale: z.enum(['pl', 'en']),
  previousDocuments: z
    .object({
      requirements: z.string().optional(),
      design: z.string().optional(),
    })
    .optional(),
});

type ParsedRegenerateInput = z.infer<typeof schema>;
type RegenerateInput = Omit<ParsedRegenerateInput, 'mode'> & { mode: 'all' | 'section' };

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  const abortController = new AbortController();
  req.signal.addEventListener('abort', () => abortController.abort(), { once: true });
  const sse = createSSEStream({ onCancel: () => abortController.abort() });
  const input: RegenerateInput = { ...parsed.data, mode: parsed.data.mode ?? 'all' };
  const demo = isDemoMode(req);

  void run({ sse, input, demo, signal: abortController.signal }).catch((err) => safeLog.error('[/api/generate/document] failed:', err));

  return sse.response;
}

async function run(args: {
  sse: ReturnType<typeof createSSEStream>;
  input: RegenerateInput;
  demo: boolean;
  signal: AbortSignal;
}) {
  const { sse, input, demo, signal } = args;
  const send = (event: SSEEvent) => sse.send(event);

  try {
    if (signal.aborted) return;
    send({
      type: 'progress',
      step: input.documentType,
      message:
        input.mode === 'section'
          ? `Regeneruję sekcję ${input.sectionAnchor ?? ''}`
          : `Regeneruję ${input.documentType}.md`,
    });

    let full = '';
    if (demo) {
      full = makeDemoDocument(input);
      send({
        type: 'section_progress',
        document: input.documentType,
        sectionId: 'demo-section',
        sectionTitle: input.documentType,
        index: 1,
        total: 1,
        status: 'generating',
      });
      for (let i = 0; i < full.length; i += 80) {
        if (signal.aborted) return;
        send({ type: 'content', document: input.documentType, chunk: full.slice(i, i + 80) });
        await sleep(10);
      }
      send({
        type: 'section_progress',
        document: input.documentType,
        sectionId: 'demo-section',
        sectionTitle: input.documentType,
        index: 1,
        total: 1,
        status: 'complete',
      });
    } else {
      const augmentedDescription = [
        input.projectDescription,
        input.mode === 'section' && input.sectionAnchor
          ? `Regenerate only this section: ${input.sectionAnchor}. Return the full updated document.`
          : '',
        input.additionalInstructions ? `Additional instructions: ${input.additionalInstructions}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');
      full = await generateDocumentRobust(
        {
          provider: input.aiProvider,
          modelId: input.aiModel,
          apiKey: input.apiKey,
        },
        input.documentType,
        {
          projectDescription: augmentedDescription,
          answers: input.answers,
          standards: input.standards,
          targetTool: input.targetTool,
          locale: input.locale,
          previousDocuments: input.previousDocuments,
        },
        {
          onSectionProgress: (progress) => send({ type: 'section_progress', ...progress }),
          onSectionComplete: (document, chunk) => send({ type: 'content', document, chunk }),
          signal,
        },
      );
    }

    send({ type: 'document_complete', document: input.documentType, fullContent: full });
    send({ type: 'done', documents: { [input.documentType]: full } });
  } catch (err) {
    if (signal.aborted) {
      return;
    }
    if (err instanceof AIAdapterError) {
      send({ type: 'error', code: err.code, message: err.message, retryable: err.retryable });
    } else {
      send({ type: 'error', code: 'UNKNOWN', message: (err as Error).message, retryable: false });
    }
  } finally {
    sse.close();
  }
}

function makeDemoDocument(input: RegenerateInput): string {
  const suffix = input.additionalInstructions ? `\n\n## Zastosowane wskazówki\n${input.additionalInstructions}` : '';
  if (input.locale === 'en') {
    return `# ${input.documentType} regenerated in demo\n\nDemo regeneration for ${input.mode}.${suffix}`;
  }
  return `# ${input.documentType} zregenerowany w demo\n\nRegeneracja demonstracyjna dla trybu ${input.mode}.${suffix}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
