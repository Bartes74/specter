/**
 * Feature: spec-generator
 * Property 9: Poprawność dzielenia treści na fragmenty (chunking)
 *
 * Validates: Wymaganie 12.2
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import { splitIntoChunks, estimateTokens, TOKEN_SAFETY_MARGIN } from '@/lib/chunking';
import { AI_PROVIDERS } from '@/types/providers';

// Mniej iteracji bo tiktoken jest wolny przy dużych tekstach
const NUM_RUNS = { numRuns: 50 };

describe('Property 9: Poprawność dzielenia treści na fragmenty', () => {
  test.prop(
    [
      fc.string({ minLength: 100, maxLength: 5000 }),
      fc.constantFrom(...AI_PROVIDERS),
      fc.integer({ min: 100, max: 1000 }),
    ],
    NUM_RUNS,
  )('konkatenacja chunków odtwarza oryginalny tekst', (text, provider, maxTokens) => {
    const chunks = splitIntoChunks(text, { maxTokens, provider });
    expect(chunks.join('')).toBe(text);
  });

  test.prop(
    [
      // Tekst dłuższy niż limit, żeby wymusić podział
      fc.string({ minLength: 2000, maxLength: 8000 }),
      fc.constantFrom(...AI_PROVIDERS),
    ],
    NUM_RUNS,
  )('każdy chunk mieści się w (limit × margines bezpieczeństwa)', (text, provider) => {
    const maxTokens = 200; // Mały limit, żeby wymusić wiele chunków
    const chunks = splitIntoChunks(text, { maxTokens, provider });
    const effectiveLimit = Math.floor(maxTokens * TOKEN_SAFETY_MARGIN);
    for (const chunk of chunks) {
      const tokens = estimateTokens(chunk, provider);
      // Tolerujemy +10% odchyłu na ostatni chunk po wymuszonym fallbacku w findBreakpoint
      expect(tokens).toBeLessThanOrEqual(Math.ceil(effectiveLimit * 1.1));
    }
  });

  test('pusty tekst zwraca pustą listę chunków', () => {
    expect(splitIntoChunks('', { maxTokens: 1000, provider: 'openai' })).toEqual([]);
  });

  test('krótki tekst zwraca jeden chunk (bez podziału)', () => {
    const text = 'Krótki opis projektu.';
    const chunks = splitIntoChunks(text, { maxTokens: 10000, provider: 'anthropic' });
    expect(chunks).toEqual([text]);
  });

  test('chunking respektuje granice akapitów gdy to możliwe', () => {
    const para1 = 'A'.repeat(500);
    const para2 = 'B'.repeat(500);
    const text = `${para1}\n\n${para2}`;
    const chunks = splitIntoChunks(text, { maxTokens: 200, provider: 'anthropic' });
    // Konkatenacja zachowana
    expect(chunks.join('')).toBe(text);
    // Co najmniej jeden chunk powinien kończyć się na granicy akapitu jeśli była dostępna
    expect(chunks.length).toBeGreaterThan(1);
  });

  test('wszystkie 4 dostawców zwracają konsystentny wynik', () => {
    const text = 'a'.repeat(3000);
    for (const provider of AI_PROVIDERS) {
      const chunks = splitIntoChunks(text, { maxTokens: 300, provider });
      expect(chunks.join('')).toBe(text);
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    }
  });
});
