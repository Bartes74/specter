/**
 * GET /api/standards/profiles?locale=pl|en — lista dostępnych profili (Wymaganie 15.2).
 */
import { NextResponse } from 'next/server';
import { listProfiles } from '@/services/StandardsGeneratorService';
import { errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const localeParam = url.searchParams.get('locale');
  const locale = localeParam === 'en' ? 'en' : 'pl';
  try {
    const profiles = await listProfiles(locale);
    return NextResponse.json({ profiles });
  } catch (err) {
    return errorResponse(500, 'PROFILES_LOAD_FAILED', (err as Error).message);
  }
}
