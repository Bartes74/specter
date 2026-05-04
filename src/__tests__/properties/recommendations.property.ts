/**
 * Feature: spec-generator
 * Property 17: Dostępność rekomendacji narzędzia/modelu
 *
 * Validates: Wymagania 4.2, 4.3, 5.2
 *
 * Reguła: dla niepustego projectDescription RecommendationService SHALL zwrócić rekomendację
 * narzędzia ORAZ modelu, każda z polami: recommended, niepuste reason, confidence ∈ {low, medium, high}.
 *
 * recommendModel jest heurystyczne (deterministyczne) — testujemy je bez mocków.
 * recommendTool wymaga AI — testujemy parser/fallback bez mocków SDK.
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  recommendModel,
  parseToolRecommendation,
  parseDocumentSuggestions,
  _internal,
} from '@/services/RecommendationService';
import { TARGET_TOOLS } from '@/types/providers';

const NUM_RUNS = { numRuns: 200 };

const localeArb = fc.constantFrom('pl', 'en') as fc.Arbitrary<'pl' | 'en'>;
const answerArb = fc.record({
  questionId: fc.string({ minLength: 1, maxLength: 5 }),
  answer: fc.string({ minLength: 0, maxLength: 200 }),
  skipped: fc.boolean(),
});

describe('Property 17: Dostępność rekomendacji modelu (heurystyka)', () => {
  test.prop(
    [
      fc.string({ minLength: 1, maxLength: 10_000 }),
      fc.array(answerArb, { minLength: 0, maxLength: 10 }),
      localeArb,
    ],
    NUM_RUNS,
  )('zawsze zwraca prawidłową rekomendację modelu', (description, answers, locale) => {
    const rec = recommendModel({
      projectDescription: description,
      answers,
      standards: null,
      locale,
    });
    expect(rec.recommended.length).toBeGreaterThan(0);
    expect(rec.reason.length).toBeGreaterThan(0);
    expect(['low', 'medium', 'high']).toContain(rec.confidence);
  });

  test('długi opis projektu → rekomenduje aktualny Claude Sonnet (długi kontekst)', () => {
    const rec = recommendModel({
      projectDescription: 'a'.repeat(6000),
      answers: [],
      standards: null,
      locale: 'pl',
    });
    expect(rec.recommended).toBe('claude-sonnet-4.6');
    expect(rec.confidence).toBe('high');
  });

  test('niepuste standards → rekomenduje aktualny Claude Sonnet', () => {
    const rec = recommendModel({
      projectDescription: 'krótki opis',
      answers: [],
      standards: 'a'.repeat(200),
      locale: 'pl',
    });
    expect(rec.recommended).toBe('claude-sonnet-4.6');
  });

  test('mały projekt → rekomenduje aktualny szybki/tani model OpenAI', () => {
    const rec = recommendModel({
      projectDescription: 'Mała aplikacja TODO',
      answers: [],
      standards: null,
      locale: 'pl',
    });
    expect(rec.recommended).toBe('gpt-5.4-mini');
    expect(rec.confidence).toBe('medium');
  });
});

describe('Property 17: parseToolRecommendation — fallback gdy AI zawiedzie', () => {
  test.prop([localeArb], NUM_RUNS)(
    'pusta odpowiedź → fallback rekomendacja z confidence=low',
    (locale) => {
      const rec = parseToolRecommendation('', locale);
      expect((TARGET_TOOLS as readonly string[]).includes(rec.recommended)).toBe(true);
      expect(rec.reason.length).toBeGreaterThan(0);
      expect(rec.confidence).toBe('low');
    },
  );

  test.prop([fc.string(), localeArb], NUM_RUNS)('śmieciowa odpowiedź → fallback', (raw, locale) => {
    const rec = parseToolRecommendation(raw, locale);
    expect((TARGET_TOOLS as readonly string[]).includes(rec.recommended)).toBe(true);
    expect(rec.reason.length).toBeGreaterThan(0);
  });

  test('poprawny JSON z prawidłową rekomendacją jest akceptowany', () => {
    const raw = JSON.stringify({
      recommended: 'gemini',
      reason: 'Dobry wybór dla małych projektów.',
      confidence: 'high',
    });
    const rec = parseToolRecommendation(raw, 'pl');
    expect(rec.recommended).toBe('gemini');
    expect(rec.reason).toBe('Dobry wybór dla małych projektów.');
    expect(rec.confidence).toBe('high');
  });

  test('JSON z nieprawidłowym narzędziem → fallback', () => {
    const raw = JSON.stringify({
      recommended: 'jakies-nieistniejace',
      reason: 'x',
      confidence: 'high',
    });
    const rec = parseToolRecommendation(raw, 'pl');
    expect(rec).toEqual(_internal.FALLBACK_TOOL.pl);
  });

  test('JSON z markdown fence', () => {
    const raw = '```json\n{"recommended":"codex","reason":"OK","confidence":"medium"}\n```';
    const rec = parseToolRecommendation(raw, 'en');
    expect(rec.recommended).toBe('codex');
    expect(rec.confidence).toBe('medium');
  });
});

describe('parseDocumentSuggestions', () => {
  test('pusta odpowiedź → []', () => {
    expect(parseDocumentSuggestions('', 'requirements')).toEqual([]);
  });

  test('parsuje listę sugestii z severity i message', () => {
    const raw = JSON.stringify({
      suggestions: [
        {
          severity: 'warning',
          message: 'Sekcja X jest pusta',
          suggestedAction: 'Wygeneruj X',
          sectionAnchor: '## X',
        },
        {
          severity: 'info',
          message: 'Drobiazg',
          suggestedAction: 'Popraw',
        },
      ],
    });
    const result = parseDocumentSuggestions(raw, 'design');
    expect(result).toHaveLength(2);
    expect(result[0]!.severity).toBe('warning');
    expect(result[0]!.sectionAnchor).toBe('## X');
    expect(result[0]!.documentType).toBe('design');
  });

  test('odrzuca sugestie bez message', () => {
    const raw = JSON.stringify({
      suggestions: [{ severity: 'info', message: '' }, { severity: 'info', message: 'realna' }],
    });
    expect(parseDocumentSuggestions(raw, 'tasks')).toHaveLength(1);
  });
});
