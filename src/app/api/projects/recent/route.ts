/**
 * GET  /api/projects/recent — lista ostatnich projektów (Wymaganie 1.2).
 * POST /api/projects/recent — dopisanie projektu lub aktualizacja daty (Wymaganie 1.11).
 *
 * W trybie demo zwraca pustą listę i nie zapisuje niczego (Wymaganie 17.7).
 */
import { NextResponse } from 'next/server';
import * as prefs from '@/services/PreferencesService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { addRecentProjectSchema } from '@/lib/api-schemas';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (isDemoMode(req)) {
    return NextResponse.json({ projects: [] });
  }
  const loaded = await prefs.load();
  return NextResponse.json({ projects: loaded.recentProjects });
}

export async function POST(req: Request) {
  const parsed = await parseBody(req, addRecentProjectSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    const updated = await prefs.addRecentProject({
      ...parsed.data,
      lastUsedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true, projects: updated.recentProjects });
  } catch (err) {
    return errorResponse(500, 'PREFS_WRITE_FAILED', (err as Error).message);
  }
}
