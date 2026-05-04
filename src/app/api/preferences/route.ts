/**
 * GET/PATCH /api/preferences — lokalne preferencje użytkownika.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import * as prefs from '@/services/PreferencesService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { AI_PROVIDERS, TARGET_TOOLS } from '@/types/providers';

export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  firstRunComplete: z.boolean().optional(),
  preferredLocale: z.enum(['pl', 'en']).optional(),
  preferredTargetTool: z.enum(TARGET_TOOLS).optional(),
  preferredAiProvider: z.enum(AI_PROVIDERS).optional(),
  preferredAiModel: z.string().optional(),
  tutorialsViewed: z.array(z.enum(AI_PROVIDERS)).optional(),
});

export async function GET(req: Request) {
  if (isDemoMode(req)) {
    const loaded = await prefs.load();
    return NextResponse.json({ preferences: { ...loaded, recentProjects: [] }, demo: true });
  }
  const loaded = await prefs.load();
  return NextResponse.json({ preferences: loaded });
}

export async function PATCH(req: Request) {
  const parsed = await parseBody(req, patchSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({ ok: true, demo: true });
  }

  try {
    const current = await prefs.load();
    const next = {
      ...current,
      ...parsed.data,
    };
    await prefs.save(next);
    return NextResponse.json({ ok: true, preferences: next });
  } catch (err) {
    return errorResponse(500, 'PREFS_WRITE_FAILED', (err as Error).message);
  }
}
