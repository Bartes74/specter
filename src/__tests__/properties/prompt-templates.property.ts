/**
 * Feature: spec-generator
 * Property 3: Poprawność serwisu szablonów promptów
 * Property 4: Włączenie standardów korporacyjnych do promptu
 * Property 8: Język w prompcie generowania
 *
 * Validates: Wymagania 4.3, 6.2, 6.3, 7.3, 7.4, 8.3, 9.3, 10.4
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  buildDocumentPrompt,
  buildQuestionsPrompt,
  buildStandardsPrompt,
  type BuildContext,
  type DocumentType,
} from '@/services/PromptTemplateService';
import { TARGET_TOOLS } from '@/types/providers';
import type { TargetTool } from '@/types/providers';
import type { AppLocale } from '@/types/session';

const NUM_RUNS = { numRuns: 200 };

const DOCUMENT_TYPES: ReadonlyArray<DocumentType> = ['requirements', 'design', 'tasks'];
const LOCALES: ReadonlyArray<AppLocale> = ['pl', 'en'];

const baseContext = (overrides: Partial<BuildContext> = {}): BuildContext => ({
  projectDescription: 'Aplikacja webowa do zarządzania zadaniami zespołu.',
  answers: [],
  targetTool: 'claude-code',
  locale: 'pl',
  ...overrides,
});

describe('Property 3: Poprawność serwisu szablonów promptów', () => {
  test.prop(
    [
      fc.constantFrom(...DOCUMENT_TYPES),
      fc.constantFrom(...TARGET_TOOLS),
      fc.constantFrom(...LOCALES),
    ],
    NUM_RUNS,
  )(
    'dla każdej kombinacji (typ × narzędzie × locale): prompt zawiera instrukcję narzędzia ORAZ instrukcję strukturalną typu dokumentu',
    (documentType, targetTool, locale) => {
      const { systemPrompt } = buildDocumentPrompt(
        documentType,
        baseContext({ targetTool: targetTool as TargetTool, locale }),
      );
      expect(systemPrompt.length).toBeGreaterThan(0);
      // Zawiera markery typu dokumentu
      const structureMarkers = {
        requirements: locale === 'pl' ? 'requirements.md' : 'requirements.md',
        design: locale === 'pl' ? 'design.md' : 'design.md',
        tasks: locale === 'pl' ? 'tasks.md' : 'tasks.md',
      };
      expect(systemPrompt).toContain(structureMarkers[documentType]);
      // Zawiera markery narzędzia (po dwóch słowach w nazwie tool hint)
      const toolMarker: Record<TargetTool, string> = {
        codex: 'Codex',
        'claude-code': 'Claude Code',
        gemini: 'Gemini',
        copilot: 'Copilot',
        universal: locale === 'pl' ? 'neutralny' : 'Neutral',
      };
      expect(systemPrompt).toContain(toolMarker[targetTool as TargetTool]);
    },
  );
});

describe('Property 4: Włączenie standardów korporacyjnych do promptu', () => {
  test.prop(
    [fc.string({ minLength: 1, maxLength: 5000 }), fc.constantFrom(...DOCUMENT_TYPES)],
    NUM_RUNS,
  )('niepuste standardy → prompt zawiera ich treść', (standards, docType) => {
    const { userPrompt } = buildDocumentPrompt(docType, baseContext({ standards }));
    expect(userPrompt).toContain(standards);
  });

  test.prop([fc.constantFrom(...DOCUMENT_TYPES)], NUM_RUNS)(
    'null/undefined/empty standardy → prompt nie zawiera sekcji standardów',
    (docType) => {
      for (const standards of [null, undefined, '', '   ']) {
        const { userPrompt } = buildDocumentPrompt(docType, baseContext({ standards }));
        // Markery sekcji standardów po pl/en
        expect(userPrompt).not.toContain('Standardy korporacyjne');
        expect(userPrompt).not.toContain('Corporate standards');
      }
    },
  );

  test('standardy są wstrzykiwane w kontekst dokumentu, nie w system prompt', () => {
    const standards = 'Wszystkie API muszą używać REST. Zero GraphQL.';
    const { systemPrompt, userPrompt } = buildDocumentPrompt(
      'design',
      baseContext({ standards }),
    );
    expect(userPrompt).toContain(standards);
    expect(systemPrompt).not.toContain(standards);
  });
});

describe('Property 8: Język w prompcie generowania', () => {
  test.prop(
    [fc.constantFrom(...DOCUMENT_TYPES), fc.constantFrom(...TARGET_TOOLS)],
    NUM_RUNS,
  )('locale=pl → prompt zawiera instrukcję polską', (docType, tool) => {
    const { systemPrompt } = buildDocumentPrompt(
      docType,
      baseContext({ targetTool: tool as TargetTool, locale: 'pl' }),
    );
    expect(systemPrompt).toContain('w języku polskim');
  });

  test.prop(
    [fc.constantFrom(...DOCUMENT_TYPES), fc.constantFrom(...TARGET_TOOLS)],
    NUM_RUNS,
  )('locale=en → prompt zawiera instrukcję angielską', (docType, tool) => {
    const { systemPrompt } = buildDocumentPrompt(
      docType,
      baseContext({ targetTool: tool as TargetTool, locale: 'en' }),
    );
    expect(systemPrompt).toContain('in English');
  });

  test.prop([fc.constantFrom(...LOCALES)], NUM_RUNS)(
    'buildQuestionsPrompt respektuje locale',
    (locale) => {
      const { systemPrompt, userPrompt } = buildQuestionsPrompt(
        'Test description',
        [],
        locale,
      );
      if (locale === 'pl') {
        expect(systemPrompt).toContain('analitykiem');
        expect(userPrompt).toContain('pytań');
      } else {
        expect(systemPrompt).toContain('business analyst');
        expect(userPrompt).toContain('questions');
      }
    },
  );

  test.prop([fc.constantFrom(...LOCALES)], NUM_RUNS)(
    'buildStandardsPrompt respektuje locale',
    (locale) => {
      const { systemPrompt, userPrompt } = buildStandardsPrompt('webapp-react', [], locale);
      if (locale === 'pl') {
        expect(systemPrompt).toContain('dobrych praktyk');
        expect(userPrompt).toContain('w języku polskim');
      } else {
        expect(systemPrompt).toContain('best practices');
        expect(userPrompt).toContain('in English');
      }
    },
  );

  test('buildStandardsPrompt przekazuje modelowi ID, treść pytania i odpowiedź', () => {
    const { userPrompt } = buildStandardsPrompt(
      'webapp-react',
      [
        {
          questionId: 'stack-tooling',
          questionText: 'Jaki stack i wersje technologii chcesz przyjąć jako domyślne?',
          answer: 'Next.js App Router, TypeScript strict, Tailwind, Vitest.',
          skipped: false,
        },
      ],
      'pl',
    );

    expect(userPrompt).toContain('ID: stack-tooling');
    expect(userPrompt).toContain('Pytanie: Jaki stack i wersje technologii');
    expect(userPrompt).toContain('Odpowiedź: Next.js App Router');
  });
});

describe('Sekwencyjne generowanie dokumentów (Property 6 — kontekst)', () => {
  test('design.md otrzymuje requirements.md w kontekście', () => {
    const { userPrompt } = buildDocumentPrompt(
      'design',
      baseContext({
        previousDocuments: { requirements: '# Wymagania\n## Wymaganie 1' },
      }),
    );
    expect(userPrompt).toContain('# Wymagania');
  });

  test('tasks.md otrzymuje requirements.md i design.md w kontekście', () => {
    const { userPrompt } = buildDocumentPrompt(
      'tasks',
      baseContext({
        previousDocuments: {
          requirements: '# Req section',
          design: '# Design section',
        },
      }),
    );
    expect(userPrompt).toContain('# Req section');
    expect(userPrompt).toContain('# Design section');
  });

  test('requirements.md NIE otrzymuje sekcji "wcześniej wygenerowane"', () => {
    const { userPrompt } = buildDocumentPrompt('requirements', baseContext({}));
    expect(userPrompt).not.toContain('Wcześniej wygenerowane');
    expect(userPrompt).not.toContain('Previously generated');
  });
});
