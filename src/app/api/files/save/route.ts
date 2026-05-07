/**
 * POST /api/files/save — zapisuje dokumenty w katalogu /docs projektu (Wymagania 1.10, 7.1, 13.3).
 *
 * GWARANCJA TRYBU DEMO (Property 21, Wymaganie 17.7, 17.9):
 *   gdy nagłówek X-Demo-Mode: true → zero zapisów, zwraca sukces.
 */
import { NextResponse } from 'next/server';
import {
  archiveExistingDocuments,
  saveDocument,
  ensureDocsDirectory,
  saveProjectSnapshot,
  saveStandards,
} from '@/services/FileSystemService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { saveFilesSchema } from '@/lib/api-schemas';
import type { ProjectSnapshot } from '@/types/project';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const parsed = await parseBody(req, saveFilesSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({
      success: true,
      savedFiles: parsed.data.documents.map((d) => `[demo]/docs/${d.filename}`),
      archivedFiles: [],
      ...(parsed.data.generatedStandards ? { savedStandardsFile: '[demo]/standards.md' } : {}),
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
  let archivedFiles: string[] = [];
  let savedStandardsFile: string | undefined;
  const errors: { filename: string; error: string }[] = [];

  if (parsed.data.archiveExisting !== false) {
    try {
      archivedFiles = await archiveExistingDocuments(
        parsed.data.projectPath,
        parsed.data.documents
          .map((doc) => doc.filename)
          .filter((filename) =>
            !filename.includes('/') && !filename.includes('\\') && !filename.includes('..'),
          ),
      );
    } catch (err) {
      return errorResponse(500, 'DOCS_ARCHIVE_FAILED', (err as Error).message);
    }
  }

  for (const doc of parsed.data.documents) {
    try {
      const fullPath = await saveDocument(parsed.data.projectPath, doc.filename, doc.content);
      savedFiles.push(fullPath);
    } catch (err) {
      errors.push({ filename: doc.filename, error: (err as Error).message });
    }
  }

  if (parsed.data.generatedStandards) {
    try {
      await saveStandards(parsed.data.projectPath, parsed.data.generatedStandards.content);
      savedStandardsFile = `${parsed.data.projectPath}/standards.md`;
    } catch (err) {
      errors.push({ filename: 'standards.md', error: (err as Error).message });
    }
  }

  let projectStateFile: string | undefined;
  if (parsed.data.projectState && errors.length === 0) {
    try {
      const projectState: ProjectSnapshot = {
        ...parsed.data.projectState,
        schemaVersion: 1,
        currentStep: parsed.data.projectState.currentStep ?? 0,
        activeQuestionIndex: parsed.data.projectState.activeQuestionIndex ?? 0,
        questions: parsed.data.projectState.questions ?? [],
        answers: parsed.data.projectState.answers ?? [],
        documentHistory: {
          requirements: parsed.data.projectState.documentHistory?.requirements ?? [],
          design: parsed.data.projectState.documentHistory?.design ?? [],
          tasks: parsed.data.projectState.documentHistory?.tasks ?? [],
        },
        handledDocumentSuggestionKeys: parsed.data.projectState.handledDocumentSuggestionKeys ?? [],
        documentSuggestions: parsed.data.projectState.documentSuggestions ?? [],
        documentSuggestionIteration: parsed.data.projectState.documentSuggestionIteration ?? 0,
        standardsGeneration: parsed.data.projectState.standardsGeneration
          ? {
              selectedProfileId: parsed.data.projectState.standardsGeneration.selectedProfileId,
              followUpAnswers: parsed.data.projectState.standardsGeneration.followUpAnswers ?? [],
              draftContent: parsed.data.projectState.standardsGeneration.draftContent,
            }
          : undefined,
      };
      projectStateFile = await saveProjectSnapshot(
        parsed.data.projectPath,
        projectState,
      );
    } catch (err) {
      errors.push({ filename: '.spec-generator/project.json', error: (err as Error).message });
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    savedFiles,
    archivedFiles,
    ...(savedStandardsFile ? { savedStandardsFile } : {}),
    ...(projectStateFile ? { projectStateFile } : {}),
    ...(errors.length > 0 ? { errors } : {}),
  });
}
