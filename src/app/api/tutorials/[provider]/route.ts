/**
 * GET /api/tutorials/:provider?locale=pl|en — treść tutoriala klucza API.
 *
 * Wymagania: 16.1, 16.6, 16.10
 */
import { NextResponse } from 'next/server';
import { getTutorial } from '@/services/TutorialService';
import { isAIProvider } from '@/types/providers';
import { errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider } = await ctx.params;
  if (!isAIProvider(provider)) {
    return errorResponse(404, 'PROVIDER_NOT_SUPPORTED', `Provider not supported: ${provider}`);
  }
  const url = new URL(req.url);
  const localeParam = url.searchParams.get('locale');
  const locale = localeParam === 'en' ? 'en' : 'pl';
  try {
    const tutorial = await getTutorial(provider, locale);
    return NextResponse.json(tutorial);
  } catch (err) {
    return errorResponse(500, 'TUTORIAL_LOAD_FAILED', (err as Error).message);
  }
}
