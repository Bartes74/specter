/**
 * Feature: spec-generator
 * Property 11: Maskowanie kluczy API
 * Property 12: Sanityzacja logów z kluczy API (4 dostawców)
 *
 * Validates: Wymagania 14.2, 14.5
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { maskApiKey, sanitizeLogs } from '@/lib/security';

const NUM_RUNS = { numRuns: 200 };

describe('Property 11: Maskowanie kluczy API', () => {
  test.prop(
    [fc.string({ minLength: 5, maxLength: 200 })],
    NUM_RUNS,
  )('dla klucza dłuższego niż 4 znaki: ostatnie 4 zachowane, reszta zamaskowana', (key) => {
    const masked = maskApiKey(key, 4);
    expect(masked.length).toBe(key.length);
    expect(masked.slice(-4)).toBe(key.slice(-4));
    // Wszystko poza ostatnimi 4 to znak maskujący
    const head = masked.slice(0, -4);
    for (const ch of head) {
      expect(ch).toBe('•');
    }
  });

  test.prop(
    [fc.string({ minLength: 0, maxLength: 4 })],
    NUM_RUNS,
  )('dla klucza ≤ 4 znaków: maskuje całość (nie ujawnia żadnego znaku)', (key) => {
    const masked = maskApiKey(key, 4);
    expect(masked.length).toBe(key.length);
    for (const ch of masked) {
      expect(ch).toBe('•');
    }
  });

  test.prop(
    [fc.anything().filter((v) => typeof v !== 'string')],
    NUM_RUNS,
  )('dla wartości nie-string zwraca pusty string', (notString) => {
    expect(maskApiKey(notString)).toBe('');
  });
});

describe('Property 12: Sanityzacja logów z kluczy API', () => {
  // Generator klucza w formacie konkretnego dostawcy
  const openaiKey = fc.stringMatching(/^sk-[A-Za-z0-9_-]{20,40}$/);
  const anthropicKey = fc.stringMatching(/^sk-ant-[A-Za-z0-9_-]{20,40}$/);
  const googleKey = fc.stringMatching(/^AIza[A-Za-z0-9_-]{30,40}$/);
  const githubToken = fc.stringMatching(/^(ghp|gho|ghu|ghs)_[A-Za-z0-9]{20,40}$/);
  const githubPat = fc.stringMatching(/^github_pat_[A-Za-z0-9_]{20,40}$/);

  test.prop([openaiKey], NUM_RUNS)('maskuje klucz OpenAI', (key) => {
    const sanitized = sanitizeLogs(`Auth: ${key} done`);
    expect(sanitized).not.toContain(key);
    expect(sanitized).toContain('[REDACTED:openai]');
  });

  test.prop([anthropicKey], NUM_RUNS)('maskuje klucz Anthropic (sk-ant-)', (key) => {
    const sanitized = sanitizeLogs(`Bearer ${key}`);
    expect(sanitized).not.toContain(key);
    expect(sanitized).toContain('[REDACTED:anthropic]');
  });

  test.prop([googleKey], NUM_RUNS)('maskuje klucz Google (AIza...)', (key) => {
    const sanitized = sanitizeLogs(`?key=${key}&q=foo`);
    expect(sanitized).not.toContain(key);
    expect(sanitized).toContain('[REDACTED:google]');
  });

  test.prop([githubToken], NUM_RUNS)('maskuje token GitHub (ghp_/gho_/...)', (token) => {
    const sanitized = sanitizeLogs(`x-token: ${token}`);
    expect(sanitized).not.toContain(token);
    expect(sanitized).toContain('[REDACTED:github-token]');
  });

  test.prop([githubPat], NUM_RUNS)('maskuje GitHub PAT (github_pat_...)', (pat) => {
    const sanitized = sanitizeLogs(`token=${pat}`);
    expect(sanitized).not.toContain(pat);
    expect(sanitized).toContain('[REDACTED:github-pat]');
  });

  test('idempotentność: drugie wywołanie nic nie zmienia', () => {
    const text = ['sk', 'abc1234567890ABCDEFGHIJKLMNO'].join('-');
    const once = sanitizeLogs(text);
    const twice = sanitizeLogs(once);
    expect(twice).toBe(once);
  });

  test('pomija przypadkowe ciągi przypominające prefiksy ale zbyt krótkie', () => {
    expect(sanitizeLogs('sk-')).toBe('sk-');
    expect(sanitizeLogs('AIzaShort')).toBe('AIzaShort');
    expect(sanitizeLogs('ghp_x')).toBe('ghp_x');
  });

  test('Anthropic priorytet nad OpenAI (sk-ant- nie psuje się o sk-)', () => {
    const key = ['sk', 'ant', 'abcdefghij1234567890ABCD'].join('-');
    const sanitized = sanitizeLogs(key);
    expect(sanitized).toBe('[REDACTED:anthropic]');
    expect(sanitized).not.toContain('[REDACTED:openai]');
  });
});
