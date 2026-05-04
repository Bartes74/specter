/**
 * Feature: spec-generator
 * Property 6: Kontekst sekwencyjnego generowania dokumentów
 *
 * Validates: Wymaganie 8.4
 *
 * Reguła: design.md otrzymuje requirements.md w kontekście,
 *         tasks.md otrzymuje requirements.md ORAZ design.md.
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  buildDocumentPrompt,
  type BuildContext,
} from '@/services/PromptTemplateService';
import { TARGET_TOOLS } from '@/types/providers';
import type { TargetTool } from '@/types/providers';
import type { AppLocale } from '@/types/session';

const NUM_RUNS = { numRuns: 100 };

const LOCALES: ReadonlyArray<AppLocale> = ['pl', 'en'];

// Generator unikalnego markera, którego prompt nie wytworzy sam z siebie
const uniqueMarker = fc
  .stringMatching(/^[A-Z]{4,8}[0-9]{4,8}MARKER$/)
  .map((s) => `<<${s}>>`);

const baseContext = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  projectDescription: 'Aplikacja webowa do zarządzania zadaniami zespołu.',
  answers: [],
  targetTool: 'claude-code',
  locale: 'pl',
  ...overrides,
});

describe('Property 6: Kontekst sekwencyjnego generowania', () => {
  test.prop(
    [uniqueMarker, fc.constantFrom(...TARGET_TOOLS), fc.constantFrom(...LOCALES)],
    NUM_RUNS,
  )('design otrzymuje treść requirements w userPrompt', (marker, tool, locale) => {
    const requirements = `# Wymagania\n## Wymaganie 1\n${marker}\n## Wymaganie 2`;
    const { userPrompt } = buildDocumentPrompt(
      'design',
      baseContext({
        targetTool: tool as TargetTool,
        locale,
        previousDocuments: { requirements },
      }),
    );
    expect(userPrompt).toContain(marker);
  });

  test.prop(
    [uniqueMarker, uniqueMarker, fc.constantFrom(...LOCALES)],
    NUM_RUNS,
  )('tasks otrzymuje requirements ORAZ design w userPrompt', (markerReq, markerDesign, locale) => {
    fc.pre(markerReq !== markerDesign);
    const requirements = `# Wymagania\n${markerReq}`;
    const design = `# Projekt\n${markerDesign}`;
    const { userPrompt } = buildDocumentPrompt(
      'tasks',
      baseContext({
        locale,
        previousDocuments: { requirements, design },
      }),
    );
    expect(userPrompt).toContain(markerReq);
    expect(userPrompt).toContain(markerDesign);
  });

  test.prop([uniqueMarker], NUM_RUNS)(
    'requirements NIE otrzymuje sekcji "wcześniej wygenerowane"',
    (marker) => {
      const { userPrompt } = buildDocumentPrompt(
        'requirements',
        baseContext({
          // Nawet gdy ktoś przekaże previousDocuments — nie powinny się pojawić w prompcie
          previousDocuments: { requirements: marker, design: marker },
        }),
      );
      expect(userPrompt).not.toContain('Wcześniej wygenerowane');
      expect(userPrompt).not.toContain('Previously generated');
      expect(userPrompt).not.toContain(marker);
    },
  );

  test('tasks bez wcześniejszych dokumentów: brak sekcji previousDocuments', () => {
    const { userPrompt } = buildDocumentPrompt('tasks', baseContext({}));
    expect(userPrompt).not.toContain('Wcześniej wygenerowane');
    expect(userPrompt).not.toContain('Previously generated');
  });

  test('design z requirements ALE bez design w previousDocuments: tylko requirements się pojawia', () => {
    const { userPrompt } = buildDocumentPrompt(
      'design',
      baseContext({
        previousDocuments: { requirements: 'REQ_ONLY_MARKER' },
      }),
    );
    expect(userPrompt).toContain('REQ_ONLY_MARKER');
  });
});
