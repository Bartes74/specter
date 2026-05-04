/**
 * Feature: spec-generator
 * Property 13: Brak utraty stanu sesji przy błędzie
 * Property 15: Kompletność Profilu_Błędu
 * Property 16: Powiązanie Profilu_Błędu z akcją naprawczą
 *
 * Validates: Wymagania 12.1, 12.2, 12.3, 12.4, 12.5, 12.10
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { build, buildFixPrompt } from '@/services/ErrorProfileService';
import { ERROR_CODES, type ErrorCode } from '@/lib/errors';
import { AI_PROVIDERS } from '@/types/providers';

const NUM_RUNS = { numRuns: 200 };

const errorCodeArb = fc.constantFrom(...ERROR_CODES);
const localeArb = fc.constantFrom('pl', 'en') as fc.Arbitrary<'pl' | 'en'>;

describe('Property 15: Kompletność Profilu_Błędu', () => {
  test.prop([errorCodeArb, localeArb], NUM_RUNS)(
    'każdy zbudowany profil ma niepuste pola: errorId, code, whatHappened, whatItMeans, howToFix (>=1), fixActions (>=1, dokładnie 1 primary)',
    (code, locale) => {
      const profile = build(code as ErrorCode, {}, locale);
      expect(profile.errorId).toBeTruthy();
      expect(profile.errorId.length).toBeGreaterThan(10); // UUID
      expect(profile.code).toBe(code);
      expect(profile.whatHappened.length).toBeGreaterThan(0);
      expect(profile.whatItMeans.length).toBeGreaterThan(0);
      expect(profile.howToFix.length).toBeGreaterThanOrEqual(1);
      expect(profile.fixActions.length).toBeGreaterThanOrEqual(1);
      const primaries = profile.fixActions.filter((a) => a.primary === true);
      expect(primaries.length).toBe(1);
      // Każdy howToFix step ma niepustą treść
      for (const step of profile.howToFix) {
        expect(step.length).toBeGreaterThan(0);
      }
    },
  );
});

describe('Property 16: Powiązanie Profilu_Błędu z akcją naprawczą', () => {
  test('AUTH_ERROR → primary action open-tutorial', () => {
    const profile = build('AUTH_ERROR', { provider: 'openai' });
    const primary = profile.fixActions.find((a) => a.primary);
    expect(primary?.kind).toBe('open-tutorial');
    expect(primary?.payload?.provider).toBe('openai');
  });

  test('PATH_NOT_FOUND → primary action open-path-picker', () => {
    const primary = build('PATH_NOT_FOUND').fixActions.find((a) => a.primary);
    expect(primary?.kind).toBe('open-path-picker');
  });

  test('FILE_ACCESS → primary action open-path-picker', () => {
    const primary = build('FILE_ACCESS').fixActions.find((a) => a.primary);
    expect(primary?.kind).toBe('open-path-picker');
  });

  test('NETWORK_ERROR → primary action retry', () => {
    const primary = build('NETWORK_ERROR').fixActions.find((a) => a.primary);
    expect(primary?.kind).toBe('retry');
  });

  test('TOKEN_LIMIT → primary action switch-model', () => {
    const primary = build('TOKEN_LIMIT').fixActions.find((a) => a.primary);
    expect(primary?.kind).toBe('switch-model');
  });

  test('PARSE_ERROR → primary action retry', () => {
    const primary = build('PARSE_ERROR').fixActions.find((a) => a.primary);
    expect(primary?.kind).toBe('retry');
  });

  test('UNKNOWN → primary action copy-report', () => {
    const primary = build('UNKNOWN').fixActions.find((a) => a.primary);
    expect(primary?.kind).toBe('copy-report');
  });

  test.prop([errorCodeArb, fc.constantFrom(...AI_PROVIDERS)], NUM_RUNS)(
    'AUTH_ERROR z provider w kontekście niesie ten provider w payload',
    (code, provider) => {
      if (code !== 'AUTH_ERROR') return;
      const primary = build(code, { provider }).fixActions.find((a) => a.primary);
      expect(primary?.payload?.provider).toBe(provider);
    },
  );
});

describe('Property 13: Brak utraty stanu sesji przy błędzie', () => {
  test.prop([errorCodeArb], NUM_RUNS)(
    'build z dowolnym SessionState w kontekście NIE modyfikuje go',
    (code) => {
      const sessionState = {
        projectPath: '/tmp/proj',
        projectDescription: 'desc',
        aiProvider: 'openai' as const,
        aiModel: 'gpt-4o',
        currentStep: 4,
      };
      const snapshot = JSON.stringify(sessionState);
      build(code as ErrorCode, { sessionState });
      expect(JSON.stringify(sessionState)).toBe(snapshot);
    },
  );

  test('buildFixPrompt sanityzuje klucze API w surowym błędzie', () => {
    const profile = build('AUTH_ERROR', { provider: 'openai' });
    const leakedKey = ['sk', 'LEAKED1234567890ABCDEFGHIJKLMNOP'].join('-');
    const prompt = buildFixPrompt(profile, {
      operation: 'POST /api/questions',
      raw: `Failed with key ${leakedKey}`,
    });
    expect(prompt).not.toContain(leakedKey);
    expect(prompt).toContain('[REDACTED:openai]');
  });

  test('buildFixPrompt zawiera errorId i kod', () => {
    const profile = build('NETWORK_ERROR');
    const prompt = buildFixPrompt(profile, {});
    expect(prompt).toContain(profile.errorId);
    expect(prompt).toContain('NETWORK_ERROR');
  });
});
