/**
 * GET /api/demo/scenario?locale=pl|en — scenariusz Trybu_Demo (Wymaganie 17.5).
 */
import { NextResponse } from 'next/server';
import { getScenario } from '@/services/DemoModeService';
import { errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const localeParam = url.searchParams.get('locale');
  const locale = localeParam === 'en' ? 'en' : 'pl';
  try {
    const scenario = await getScenario(locale);
    return NextResponse.json(scenario);
  } catch (err) {
    return errorResponse(500, 'DEMO_LOAD_FAILED', (err as Error).message);
  }
}
