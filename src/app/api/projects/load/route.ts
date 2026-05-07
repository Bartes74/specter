/**
 * POST /api/projects/load — wczytuje zapisany snapshot istniejącego projektu.
 *
 * Snapshot nie zawiera klucza API. Jeśli projekt był tworzony przed tą funkcją,
 * endpoint nadal zwraca istniejące docs/*.md i standards.md.
 */
import { NextResponse } from 'next/server';
import { readProjectWorkspace } from '@/services/FileSystemService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { loadProjectSchema } from '@/lib/api-schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const parsed = await parseBody(req, loadProjectSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({
      projectState: null,
      documents: { requirements: null, design: null, tasks: null },
      standards: null,
      demo: true,
    });
  }

  try {
    const workspace = await readProjectWorkspace(parsed.data.projectPath);
    return NextResponse.json(workspace);
  } catch (err) {
    return errorResponse(500, 'PROJECT_LOAD_FAILED', (err as Error).message);
  }
}
