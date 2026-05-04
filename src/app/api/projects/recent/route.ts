/**
 * GET  /api/projects/recent — lista ostatnich projektów (Wymaganie 1.2).
 * POST /api/projects/recent — dopisanie projektu lub aktualizacja daty (Wymaganie 1.11).
 *
 * W trybie demo zwraca pustą listę i nie zapisuje niczego (Wymaganie 17.7).
 */
import { NextResponse } from 'next/server';
import * as prefs from '@/services/PreferencesService';
import { readProjectWorkspace } from '@/services/FileSystemService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { addRecentProjectSchema } from '@/lib/api-schemas';
import type { RecentProjectWithSummary } from '@/types/project';
import type { RecentProject } from '@/services/PreferencesService';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (isDemoMode(req)) {
    return NextResponse.json({ projects: [] });
  }
  const loaded = await prefs.load();
  const projects = await Promise.all(loaded.recentProjects.map(enrichRecentProject));
  return NextResponse.json({ projects });
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

async function enrichRecentProject(project: RecentProject): Promise<RecentProjectWithSummary> {
  try {
    const workspace = await readProjectWorkspace(project.path);
    const snapshot = workspace.projectState;
    const documentsCount = Object.values(workspace.documents).filter(Boolean).length;
    const answers = snapshot?.answers ?? [];
    const answeredCount = answers.filter((answer) => !answer.skipped && answer.answer.trim().length > 0).length;
    const description = snapshot?.projectDescription.trim() ?? '';

    return {
      ...project,
      summary: {
        hasProjectState: Boolean(snapshot),
        descriptionPreview: description ? description.slice(0, 220) : null,
        questionsCount: snapshot?.questions.length ?? 0,
        answersCount: answeredCount,
        targetTool: snapshot?.targetTool ?? null,
        aiProvider: snapshot?.aiProvider ?? null,
        aiModel: snapshot?.aiModel ?? null,
        documentsCount,
        standardsSource: snapshot?.standardsSource ?? (workspace.standards ? 'existing' : null),
        updatedAt: snapshot?.updatedAt ?? null,
      },
    };
  } catch {
    return project;
  }
}
