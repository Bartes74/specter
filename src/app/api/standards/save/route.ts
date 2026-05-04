/**
 * POST /api/standards/save — zapisuje standards.md w katalogu projektu.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { saveStandards } from '@/services/FileSystemService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';

export const dynamic = 'force-dynamic';

const schema = z.object({
  projectPath: z.string().min(1),
  content: z.string().refine((value) => value.trim().length > 0, 'standards.empty'),
});

export async function POST(req: Request) {
  const parsed = await parseBody(req, schema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({ success: true, savedFile: '[demo]/standards.md', demo: true });
  }

  try {
    await saveStandards(parsed.data.projectPath, parsed.data.content);
    return NextResponse.json({ success: true, savedFile: `${parsed.data.projectPath}/standards.md` });
  } catch (err) {
    return errorResponse(500, 'STANDARDS_SAVE_FAILED', (err as Error).message);
  }
}
