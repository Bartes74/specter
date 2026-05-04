/**
 * POST /api/files/save — zapisuje dokumenty w katalogu /docs projektu (Wymagania 1.10, 7.1, 13.3).
 *
 * GWARANCJA TRYBU DEMO (Property 21, Wymaganie 17.7, 17.9):
 *   gdy nagłówek X-Demo-Mode: true → zero zapisów, zwraca sukces.
 */
import { NextResponse } from 'next/server';
import { saveDocument, ensureDocsDirectory } from '@/services/FileSystemService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { saveFilesSchema } from '@/lib/api-schemas';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const parsed = await parseBody(req, saveFilesSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({
      success: true,
      savedFiles: parsed.data.documents.map((d) => `[demo]/docs/${d.filename}`),
      demo: true,
    });
  }

  try {
    // Upewnij się że /docs istnieje
    await ensureDocsDirectory(parsed.data.projectPath);
  } catch (err) {
    return errorResponse(500, 'DOCS_DIR_FAILED', (err as Error).message);
  }

  const savedFiles: string[] = [];
  const errors: { filename: string; error: string }[] = [];

  for (const doc of parsed.data.documents) {
    try {
      const fullPath = await saveDocument(parsed.data.projectPath, doc.filename, doc.content);
      savedFiles.push(fullPath);
    } catch (err) {
      errors.push({ filename: doc.filename, error: (err as Error).message });
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    savedFiles,
    ...(errors.length > 0 ? { errors } : {}),
  });
}
