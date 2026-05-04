/**
 * POST /api/validate/path — walidacja folderu projektu (Wymagania 1.7-1.10, 6.1).
 *
 * Zwraca {valid, exists, writable, hasStandards, standardsPreview, error}.
 * W trybie demo zwraca zawsze valid=true (mock).
 */
import { NextResponse } from 'next/server';
import { ensureDocsDirectory, validatePath } from '@/services/FileSystemService';
import { parseBody, isDemoMode } from '@/lib/api-helpers';
import { validatePathSchema } from '@/lib/api-schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const parsed = await parseBody(req, validatePathSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({
      valid: true,
      exists: true,
      writable: true,
      hasStandards: false,
    });
  }

  const result = await validatePath(parsed.data.projectPath);
  if (result.valid && parsed.data.ensureDocs) {
    await ensureDocsDirectory(parsed.data.projectPath);
  }
  return NextResponse.json(result);
}
