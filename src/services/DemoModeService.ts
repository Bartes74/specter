/**
 * DemoModeService — scenariusz Trybu_Demo (Zadanie 15.1).
 *
 * Wymagania: 17.5, 17.6, 17.7
 *
 * Scenariusz w content/demo/scenario.<locale>.json — można podmienić bez deployu.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AppLocale, QuestionAnswer, DocumentSuggestion, SessionState } from '@/types/session';

const DEMO_DIR = path.join(process.cwd(), 'content', 'demo');

export interface DemoScenarioResponse {
  projectDescription: string;
  prefilledAnswers: QuestionAnswer[];
  mockedSuggestions: DocumentSuggestion[];
}

const cache = new Map<AppLocale, DemoScenarioResponse>();

/**
 * Zwraca scenariusz demo w wybranym języku.
 */
export async function getScenario(locale: AppLocale): Promise<DemoScenarioResponse> {
  const cached = cache.get(locale);
  if (cached) return cached;
  const filePath = path.join(DEMO_DIR, `scenario.${locale}.json`);
  const raw = await fs.readFile(filePath, 'utf-8');
  const parsed = JSON.parse(raw) as DemoScenarioResponse;
  cache.set(locale, parsed);
  return parsed;
}

/**
 * Sprawdza czy stan sesji jest aktualnie w Trybie_Demo.
 * Pomocnik dla komponentów, które potrzebują renderować banner demo.
 */
export function isDemoActive(sessionState: Pick<SessionState, 'isDemoMode'>): boolean {
  return sessionState.isDemoMode === true;
}

/**
 * Reset cache (testy).
 */
export function _resetCache(): void {
  cache.clear();
}
