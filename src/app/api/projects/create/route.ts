/**
 * POST /api/projects/create — tworzy nowy folder projektu (Wymagania 1.4, 1.9).
 *
 * W trybie demo zwraca syntetyczną ścieżkę i nic nie tworzy (Wymaganie 17.7).
 */
import { NextResponse } from 'next/server';
import * as path from 'node:path';
import { createProject } from '@/services/FileSystemService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { createProjectSchema } from '@/lib/api-schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const parsed = await parseBody(req, createProjectSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({
      success: true,
      projectPath: path.posix.join(parsed.data.parentPath, parsed.data.projectName),
      demo: true,
    });
  }

  try {
    const projectPath = await createProject(parsed.data.parentPath, parsed.data.projectName);
    return NextResponse.json({ success: true, projectPath });
  } catch (err) {
    const code = mapErrorToCode((err as Error).message);
    return errorResponse(code === 'PROJECT_EXISTS' ? 409 : 400, code, (err as Error).message);
  }
}

function mapErrorToCode(message: string): string {
  if (message === 'project.alreadyExists') return 'PROJECT_EXISTS';
  if (message === 'parent.notFound') return 'PARENT_NOT_FOUND';
  if (message === 'parent.notDirectory') return 'PARENT_NOT_DIRECTORY';
  if (message.startsWith('name.')) return 'NAME_INVALID';
  if (message === 'path.suspiciousSegment') return 'PATH_SUSPICIOUS';
  return 'CREATE_FAILED';
}
