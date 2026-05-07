/**
 * POST /api/projects/delete — usuwa projekt z ostatnich i kasuje artefakty wygenerowane przez aplikację.
 *
 * Tryb demo jest no-op bez zapisów na dysk i bez zmian preferencji.
 */
import { NextResponse } from 'next/server';
import * as prefs from '@/services/PreferencesService';
import { deleteGeneratedProjectArtifacts } from '@/services/FileSystemService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { deleteProjectSchema } from '@/lib/api-schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const parsed = await parseBody(req, deleteProjectSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({ success: true, deletedPaths: [], demo: true });
  }

  try {
    const deletedPaths = await deleteGeneratedProjectArtifacts(parsed.data.projectPath);
    const updated = await prefs.removeRecentProject(parsed.data.projectPath);
    return NextResponse.json({
      success: true,
      deletedPaths,
      projects: updated.recentProjects,
    });
  } catch (err) {
    return errorResponse(500, 'PROJECT_DELETE_FAILED', (err as Error).message);
  }
}
