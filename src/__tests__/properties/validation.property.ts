/**
 * Feature: spec-generator
 * Property 1:  Walidacja długości opisu projektu
 * Property 10: Pipeline walidacji danych wejściowych
 *
 * Validates: Wymagania 2.2, 2.3, 12.4
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  validateDescription,
  validateApiKey,
  validateProjectName,
  validateSessionState,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/lib/validation';
import { createInitialSessionState } from '@/types/session';
import { AI_PROVIDERS } from '@/types/providers';

const NUM_RUNS = { numRuns: 200 };

describe('Property 1: Walidacja długości opisu projektu', () => {
  test.prop([fc.string({ minLength: 0, maxLength: 20_000 })], NUM_RUNS)(
    'akceptuje wtw długość ∈ [20, 10000]',
    (str) => {
      const result = validateDescription(str);
      const lengthInRange =
        str.length >= DESCRIPTION_MIN_LENGTH && str.length <= DESCRIPTION_MAX_LENGTH;
      expect(result.valid).toBe(lengthInRange);
    },
  );

  test.prop([fc.anything().filter((v) => typeof v !== 'string')], NUM_RUNS)(
    'odrzuca wartości nie-string',
    (notString) => {
      expect(validateDescription(notString).valid).toBe(false);
    },
  );

  test.prop(
    [fc.integer({ min: 20, max: 10_000 })],
    NUM_RUNS,
  )('zawsze akceptuje string o dokładnej długości w [20, 10000]', (len) => {
    const str = 'a'.repeat(len);
    expect(validateDescription(str).valid).toBe(true);
  });
});

describe('Property 10: Pipeline walidacji stanu sesji', () => {
  test('odrzuca pusty stan początkowy', () => {
    const state = createInitialSessionState();
    const result = validateSessionState(state);
    expect(result.valid).toBe(false);
    // Co najmniej projectPath, projectDescription, targetTool, aiProvider, aiModel, apiKey muszą być błędem
    expect(Object.keys(result.errors)).toEqual(
      expect.arrayContaining([
        'projectPath',
        'projectDescription',
        'targetTool',
        'aiProvider',
        'aiModel',
        'apiKey',
      ]),
    );
  });

  test.prop(
    [fc.constantFrom(...AI_PROVIDERS)],
    NUM_RUNS,
  )('akceptuje kompletny stan z prawidłowym kluczem (per dostawca)', (provider) => {
    const state = createInitialSessionState();
    state.projectPath = '/tmp/test-project';
    state.pathValidation = {
      valid: true,
      exists: true,
      writable: true,
      hasStandards: false,
    };
    state.projectDescription = 'a'.repeat(100);
    state.targetTool = 'claude-code';
    state.aiProvider = provider;
    state.aiModel = 'some-model-id';
    state.apiKey = sampleKeyFor(provider);
    state.apiKeyValid = true;

    const result = validateSessionState(state);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  test('w trybie demo nie wymaga klucza API', () => {
    const state = createInitialSessionState();
    state.projectPath = '/tmp/test-project';
    state.pathValidation = {
      valid: true,
      exists: true,
      writable: true,
      hasStandards: false,
    };
    state.projectDescription = 'a'.repeat(100);
    state.targetTool = 'claude-code';
    state.aiProvider = 'openai';
    state.aiModel = 'gpt-4o';
    state.apiKey = '';
    state.isDemoMode = true;

    const result = validateSessionState(state);
    expect(result.valid).toBe(true);
  });
});

describe('validateApiKey — kształt klucza per dostawca', () => {
  test('rozpoznaje prawidłowe formaty', () => {
    expect(validateApiKey(`sk-${'1234567890abcdef'}`, 'openai')).toBe(true);
    expect(validateApiKey(`sk-ant-${'abcdefghijklmnopqrst'}`, 'anthropic')).toBe(true);
    expect(validateApiKey(`AIzaSy${'ABCDEFGHIJKLMNOPQRSTUV'}`, 'google')).toBe(true);
    expect(validateApiKey(`ghp_${'ABCDEFGHIJKLMNOPQRST'}`, 'github')).toBe(true);
    expect(validateApiKey(`github_pat_${'ABCDEFGHIJKLMNOPQRST'}`, 'github')).toBe(true);
  });

  test('odrzuca puste, krótkie, z białymi znakami', () => {
    expect(validateApiKey('', 'openai')).toBe(false);
    expect(validateApiKey('sk-', 'openai')).toBe(false);
    expect(validateApiKey('  sk-1234567890  ', 'openai')).toBe(false);
  });

  test('odrzuca klucz innego dostawcy', () => {
    expect(validateApiKey('sk-1234567890abcdef', 'anthropic')).toBe(false);
    expect(validateApiKey('AIzaSyABCDEFGHIJKLMNOPQRSTUV', 'github')).toBe(false);
  });
});

describe('validateProjectName — bezpieczne nazwy folderów', () => {
  test('akceptuje typowe nazwy', () => {
    expect(validateProjectName('moj-projekt').valid).toBe(true);
    expect(validateProjectName('My Project 2025').valid).toBe(true);
    expect(validateProjectName('app.v2').valid).toBe(true);
  });

  test('odrzuca puste, ze znakami specjalnymi, zarezerwowane', () => {
    expect(validateProjectName('').valid).toBe(false);
    expect(validateProjectName('   ').valid).toBe(false);
    expect(validateProjectName('a/b').valid).toBe(false);
    expect(validateProjectName('a\\b').valid).toBe(false);
    expect(validateProjectName('a:b').valid).toBe(false);
    expect(validateProjectName('a*b').valid).toBe(false);
    expect(validateProjectName('a?b').valid).toBe(false);
    expect(validateProjectName('CON').valid).toBe(false);
    expect(validateProjectName('LPT1').valid).toBe(false);
    expect(validateProjectName('name.').valid).toBe(false);
    expect(validateProjectName('name..').valid).toBe(false);
  });

  test('przyjazne dla użytkownika: trim spacji na brzegach', () => {
    // Ludzie często przypadkowo dopisują spację — trimujemy zamiast odrzucać
    expect(validateProjectName('  name  ').valid).toBe(true);
    expect(validateProjectName('name ').valid).toBe(true);
  });
});

// --- Helpery testowe ---

function sampleKeyFor(provider: (typeof AI_PROVIDERS)[number]): string {
  switch (provider) {
    case 'openai':    return `sk-${'1234567890abcdef1234567890'}`;
    case 'anthropic': return `sk-ant-${'1234567890abcdefghijklmn'}`;
    case 'google':    return `AIzaSy${'1234567890abcdefghij1234567'}`;
    case 'github':    return `ghp_${'1234567890abcdefghij12345'}`;
  }
}
