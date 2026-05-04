/**
 * Feature: spec-generator
 * Property 2: Wymuszenie liczby pytań doprecyzowujących (3-10)
 *
 * Validates: Wymaganie 3.3
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import {
  enforceQuestionCount,
  parseQuestions,
  QUESTION_MAX,
  QUESTION_MIN,
} from '@/services/AIService';
import type { Question } from '@/types/session';

const NUM_RUNS = { numRuns: 200 };

const questionArb: fc.Arbitrary<Question> = fc.record({
  id: fc.string({ minLength: 1, maxLength: 10 }),
  text: fc.string({ minLength: 1, maxLength: 200 }),
  hint: fc.option(fc.string({ minLength: 0, maxLength: 100 }), { nil: undefined }),
  isRequired: fc.boolean(),
});

describe('Property 2: Wymuszenie liczby pytań doprecyzowujących', () => {
  test.prop(
    [fc.array(questionArb, { minLength: 0, maxLength: 30 })],
    NUM_RUNS,
  )('wynik mieści się w [0] ∪ [3, 10]', (questions) => {
    const result = enforceQuestionCount(questions);
    if (questions.length < QUESTION_MIN) {
      // Sygnalizujemy potrzebę retry pustą listą
      expect(result.length).toBe(0);
    } else if (questions.length > QUESTION_MAX) {
      expect(result.length).toBe(QUESTION_MAX);
    } else {
      expect(result.length).toBe(questions.length);
      expect(result.length).toBeGreaterThanOrEqual(QUESTION_MIN);
      expect(result.length).toBeLessThanOrEqual(QUESTION_MAX);
    }
  });

  test.prop(
    [fc.array(questionArb, { minLength: QUESTION_MAX + 1, maxLength: 50 })],
    NUM_RUNS,
  )('przy nadmiarze: zachowuje pierwsze 10 pytań w kolejności', (questions) => {
    const result = enforceQuestionCount(questions);
    expect(result.length).toBe(QUESTION_MAX);
    for (let i = 0; i < QUESTION_MAX; i++) {
      expect(result[i]).toEqual(questions[i]);
    }
  });
});

describe('parseQuestions — tolerancja na różne formaty odpowiedzi', () => {
  test('parsuje czysty JSON { questions: [...] }', () => {
    const raw = JSON.stringify({
      questions: [
        { id: 'q1', text: 'Kto będzie używał aplikacji?', isRequired: true },
        { id: 'q2', text: 'Jaki jest deadline?', isRequired: false },
      ],
    });
    const result = parseQuestions(raw);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('q1');
  });

  test('parsuje suggestedAnswers i zachowuje bezpieczny kształt chipów UI', () => {
    const raw = JSON.stringify({
      questions: [
        {
          id: 'q1',
          text: 'Jaki jest zakres MVP?',
          isRequired: true,
          suggestedAnswers: [
            { id: 's1', label: 'Mały MVP', value: 'Pierwsza wersja zawiera tylko kluczowy przepływ.' },
            { id: '', label: '', value: '' },
          ],
        },
      ],
    });
    const result = parseQuestions(raw);
    expect(result[0]!.suggestedAnswers).toEqual([
      { id: 's1', label: 'Mały MVP', value: 'Pierwsza wersja zawiera tylko kluczowy przepływ.' },
    ]);
  });

  test('parsuje JSON owinięty w markdown code fence', () => {
    const raw = '```json\n{"questions":[{"id":"q1","text":"OK?","isRequired":true}]}\n```';
    expect(parseQuestions(raw)).toHaveLength(1);
  });

  test('parsuje samą tablicę', () => {
    const raw = JSON.stringify([
      { text: 'Pytanie 1', isRequired: true },
      { text: 'Pytanie 2', isRequired: false },
    ]);
    const result = parseQuestions(raw);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('q1');
    expect(result[1]!.id).toBe('q2');
  });

  test('odrzuca pytania bez treści', () => {
    const raw = JSON.stringify({
      questions: [
        { id: 'q1', text: '', isRequired: true },
        { id: 'q2', text: '   ', isRequired: false },
        { id: 'q3', text: 'Realne pytanie', isRequired: true },
      ],
    });
    const result = parseQuestions(raw);
    expect(result).toHaveLength(1);
    expect(result[0]!.text).toBe('Realne pytanie');
  });

  test('zwraca [] dla całkowicie nieparsowalnej odpowiedzi', () => {
    expect(parseQuestions('to nie jest JSON')).toEqual([]);
    expect(parseQuestions('')).toEqual([]);
  });

  test('wyłuskuje JSON z mieszanej odpowiedzi (model dodał komentarz przed JSON)', () => {
    const raw = 'Oto pytania:\n{"questions":[{"text":"Pytanie 1","isRequired":true}]}\nPowodzenia!';
    expect(parseQuestions(raw)).toHaveLength(1);
  });
});
