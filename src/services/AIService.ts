/**
 * AIService — fasada nad 4 adapterami AI (Zadanie 4.6).
 *
 * Wymagania: 3.1, 5.1, 5.5, 5.6, 5.8, 5.9, 12.1
 *
 * Property 2: wymusza 3-10 pytań w odpowiedzi (przycina nadmiar).
 *
 * Strategia:
 * - Wybór adaptera następuje raz, na podstawie `provider`.
 * - Retry z exponential backoff (max 3 próby) wokół każdego wywołania AI.
 * - Klucze API są przekazywane do adapterów, ale NIGDY nie są logowane (sanitizeLogs).
 */
import type { AIProvider } from '@/types/providers';
import type { AppLocale, Question, QuestionAnswer } from '@/types/session';
import {
  buildDocumentPrompt,
  buildQuestionsPrompt,
  buildStandardsPrompt,
  type BuildContext,
  type DocumentType,
} from './PromptTemplateService';
import { OpenAIAdapter } from './ai/OpenAIAdapter';
import { AnthropicAdapter } from './ai/AnthropicAdapter';
import { GoogleAdapter } from './ai/GoogleAdapter';
import { GithubModelsAdapter } from './ai/GithubModelsAdapter';
import type { AIAdapter, ChatMessage } from './ai/types';
import { withRetry } from '@/lib/retry';
import { safeLog } from '@/lib/security';

export const QUESTION_MIN = 3;
export const QUESTION_MAX = 10;

export interface AIServiceConfig {
  provider: AIProvider;
  modelId: string;
  apiKey: string;
}

/**
 * Fabryka adaptera dla wybranego providera.
 */
export function makeAdapter(config: AIServiceConfig): AIAdapter {
  switch (config.provider) {
    case 'openai':
      return new OpenAIAdapter({ apiKey: config.apiKey, modelId: config.modelId });
    case 'anthropic':
      return new AnthropicAdapter({ apiKey: config.apiKey, modelId: config.modelId });
    case 'google':
      return new GoogleAdapter({ apiKey: config.apiKey, modelId: config.modelId });
    case 'github':
      return new GithubModelsAdapter({ apiKey: config.apiKey, modelId: config.modelId });
  }
}

/**
 * Generuje listę 3-10 pytań doprecyzowujących (Wymagania 3.1, 3.3).
 * Property 2: wynik jest zawsze przycinany do [3, 10] elementów.
 */
export async function generateQuestions(
  config: AIServiceConfig,
  description: string,
  previousAnswers: QuestionAnswer[],
  locale: AppLocale,
): Promise<Question[]> {
  const adapter = makeAdapter(config);
  const { systemPrompt, userPrompt } = buildQuestionsPrompt(description, previousAnswers, locale);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const raw = await withRetry(
    () => adapter.complete(messages, { temperature: 0.5, maxTokens: 2000 }),
    undefined,
    (attempt, err) => safeLog.warn(`AI questions retry ${attempt}:`, err.message),
  );
  return enforceQuestionCount(parseQuestions(raw));
}

/**
 * Generuje dokument (requirements / design / tasks) ze streamingiem.
 */
export async function generateDocument(
  config: AIServiceConfig,
  documentType: DocumentType,
  context: BuildContext,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const adapter = makeAdapter(config);
  const { systemPrompt, userPrompt } = buildDocumentPrompt(documentType, context);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  return withRetry(
    () => adapter.completeStream(messages, onChunk, { temperature: 0.4, maxTokens: 8000 }),
    undefined,
    (attempt, err) => safeLog.warn(`AI ${documentType} retry ${attempt}:`, err.message),
  );
}

/**
 * Generuje plik standards.md dla wybranego profilu (Wymaganie 15.4).
 */
export async function generateStandards(
  config: AIServiceConfig,
  profileName: string,
  followUpAnswers: QuestionAnswer[],
  locale: AppLocale,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const adapter = makeAdapter(config);
  const { systemPrompt, userPrompt } = buildStandardsPrompt(profileName, followUpAnswers, locale);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  return withRetry(
    () => adapter.completeStream(messages, onChunk, { temperature: 0.5, maxTokens: 6000 }),
    undefined,
    (attempt, err) => safeLog.warn(`AI standards retry ${attempt}:`, err.message),
  );
}

/**
 * Sprawdza poprawność klucza API przez najtańsze wywołanie testowe (Wymaganie 5.8).
 */
export async function validateApiKey(config: AIServiceConfig): Promise<boolean> {
  const adapter = makeAdapter(config);
  return adapter.validateApiKey();
}

// --- Helpery: parsowanie i przycinanie pytań ---

/**
 * Parsuje odpowiedź modelu na listę pytań.
 * Akceptuje JSON w formacie `{ questions: [...] }` lub samą tablicę.
 * Toleruje markdown code fence wokół JSON-a.
 */
export function parseQuestions(raw: string): Question[] {
  if (!raw || raw.trim().length === 0) return [];

  // Wytnij ewentualne ```json ... ```
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const fenced = jsonMatch?.[1]?.trim();
  const candidate = fenced && fenced.length > 0 ? fenced : raw.trim();

  // Spróbuj sparsować — jeśli model zwrócił tekst zamiast JSON, fallback do regex
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // Spróbuj wyłuskać pierwszy "{...}" z odpowiedzi
    const objectMatch = candidate.match(/\{[\s\S]*\}/);
    const objectStr = objectMatch?.[0];
    if (!objectStr) return [];
    try {
      parsed = JSON.parse(objectStr);
    } catch {
      return [];
    }
  }

  const list = extractQuestionList(parsed);
  return list
    .map((q, i) => normalizeQuestion(q, i))
    .filter((q): q is Question => q !== null);
}

function extractQuestionList(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) return parsed as unknown[];
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.questions)) return obj.questions as unknown[];
  }
  return [];
}

function normalizeQuestion(raw: unknown, index: number): Question | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const text = typeof r.text === 'string' ? r.text.trim() : '';
  if (text.length === 0) return null;
  return {
    id: typeof r.id === 'string' && r.id.length > 0 ? r.id : `q${index + 1}`,
    text,
    hint: typeof r.hint === 'string' ? r.hint : undefined,
    isRequired: typeof r.isRequired === 'boolean' ? r.isRequired : false,
    suggestedAnswers: normalizeSuggestedAnswers(r.suggestedAnswers),
  };
}

function normalizeSuggestedAnswers(raw: unknown): Question['suggestedAnswers'] {
  if (!Array.isArray(raw)) return undefined;
  const answers = raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const r = item as Record<string, unknown>;
      const label = typeof r.label === 'string' ? r.label.trim() : '';
      const value = typeof r.value === 'string' ? r.value.trim() : label;
      if (!label || !value) return null;
      return {
        id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `s${index + 1}`,
        label,
        value,
      };
    })
    .filter((item): item is NonNullable<Question['suggestedAnswers']>[number] => item !== null)
    .slice(0, 4);
  return answers.length > 0 ? answers : undefined;
}

/**
 * Property 2: wymusza 3-10 pytań.
 * - Gdy < 3: zwraca pustą tablicę (callsite może spróbować ponownie z innym promptem
 *   lub uzupełnić własnymi pytaniami) — alternatywnie: rzuca błąd.
 * - Gdy > 10: przycina do 10 pierwszych.
 */
export function enforceQuestionCount(questions: Question[]): Question[] {
  if (questions.length > QUESTION_MAX) {
    return questions.slice(0, QUESTION_MAX);
  }
  if (questions.length < QUESTION_MIN) {
    // Sygnalizujemy potrzebę retry przez pustą listę. Callsite jest odpowiedzialny
    // za podjęcie decyzji (retry / pad fallbackowymi pytaniami).
    return [];
  }
  return questions;
}
