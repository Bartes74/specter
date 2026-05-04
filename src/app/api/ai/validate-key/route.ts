/**
 * POST /api/ai/validate-key — tania walidacja klucza API dla wybranego dostawcy.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { validateApiKey } from '@/services/AIService';
import { build as buildErrorProfile } from '@/services/ErrorProfileService';
import { parseBody, errorResponse } from '@/lib/api-helpers';
import { AI_PROVIDERS } from '@/types/providers';
import { safeLog } from '@/lib/security';

export const dynamic = 'force-dynamic';

const schema = z.object({
  aiProvider: z.enum(AI_PROVIDERS),
  aiModel: z.string().min(1),
  apiKey: z.string().min(1),
  locale: z.enum(['pl', 'en']).optional(),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  try {
    const valid = await validateApiKey({
      provider: parsed.data.aiProvider,
      modelId: parsed.data.aiModel,
      apiKey: parsed.data.apiKey,
    });
    if (valid) return NextResponse.json({ valid: true });

    const profile = buildErrorProfile(
      'AUTH_ERROR',
      { provider: parsed.data.aiProvider, operation: 'validate-api-key' },
      parsed.data.locale ?? 'pl',
    );
    return NextResponse.json({ valid: false, errorProfile: profile }, { status: 401 });
  } catch (err) {
    safeLog.error('[/api/ai/validate-key] failed:', err);
    return errorResponse(500, 'UNKNOWN', (err as Error).message);
  }
}
