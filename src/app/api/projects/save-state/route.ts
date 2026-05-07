/**
 * POST /api/projects/save-state — zapisuje edytowalne informacje projektu bez generowania plików.
 *
 * Snapshot nie zawiera klucza API. Tryb demo jest no-op bez zapisów na dysk.
 */
import { NextResponse } from 'next/server';
import { saveProjectSnapshot } from '@/services/FileSystemService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { saveProjectStateSchema } from '@/lib/api-schemas';
import type { ProjectSnapshot } from '@/types/project';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const parsed = await parseBody(req, saveProjectStateSchema);
  if (parsed.error) return parsed.error;

  if (isDemoMode(req)) {
    return NextResponse.json({ success: true, savedFile: '[demo]/.spec-generator/project.json', demo: true });
  }

  try {
    const savedFile = await saveProjectSnapshot(
      parsed.data.projectPath,
      normalizeProjectState(parsed.data.projectState as Partial<ProjectSnapshot>),
    );
    return NextResponse.json({ success: true, savedFile });
  } catch (err) {
    return errorResponse(500, 'PROJECT_STATE_SAVE_FAILED', (err as Error).message);
  }
}

function normalizeProjectState(state: Partial<ProjectSnapshot>): ProjectSnapshot {
  return {
    schemaVersion: 1,
    updatedAt: state.updatedAt ?? new Date().toISOString(),
    locale: state.locale ?? 'pl',
    currentStep: state.currentStep ?? 0,
    activeQuestionIndex: state.activeQuestionIndex ?? 0,
    projectDescription: state.projectDescription ?? '',
    questions: state.questions ?? [],
    answers: state.answers ?? [],
    targetTool: state.targetTool ?? null,
    toolRecommendation: state.toolRecommendation ?? null,
    aiProvider: state.aiProvider ?? null,
    aiModel: state.aiModel ?? null,
    modelRecommendation: state.modelRecommendation ?? null,
    standards: state.standards ?? null,
    standardsSource: state.standardsSource ?? null,
    documentHistory: {
      requirements: state.documentHistory?.requirements ?? [],
      design: state.documentHistory?.design ?? [],
      tasks: state.documentHistory?.tasks ?? [],
    },
    generatedDocuments: {
      requirements: state.generatedDocuments?.requirements ?? null,
      design: state.generatedDocuments?.design ?? null,
      tasks: state.generatedDocuments?.tasks ?? null,
    },
    handledDocumentSuggestionKeys: state.handledDocumentSuggestionKeys ?? [],
    documentSuggestions: state.documentSuggestions ?? [],
    documentSuggestionIteration: state.documentSuggestionIteration ?? 0,
    standardsGeneration: state.standardsGeneration
      ? {
          selectedProfileId: state.standardsGeneration.selectedProfileId,
          followUpAnswers: state.standardsGeneration.followUpAnswers ?? [],
          draftContent: state.standardsGeneration.draftContent,
        }
      : undefined,
  };
}
