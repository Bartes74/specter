/**
 * StandardsGeneratorService — Generator standards.md (Zadanie 12.2).
 *
 * Wymagania: 15.2, 15.3, 15.4
 *
 * Profile aplikacji są ładowane z plików JSON w content/profiles/.
 * Generowanie używa AIService z dedykowanym promptem.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AppLocale, Question, QuestionAnswer } from '@/types/session';
import { generateStandards as aiGenerateStandards, type AIServiceConfig } from './AIService';

export interface ApplicationProfileRaw {
  id: string;
  name: { pl: string; en: string };
  description: { pl: string; en: string };
  followUpQuestions: Array<{
    id: string;
    text: { pl: string; en: string };
    hint?: { pl: string; en: string };
    isRequired: boolean;
  }>;
}

export interface ApplicationProfile {
  id: string;
  name: string;
  description: string;
  followUpQuestions: Question[];
}

const PROFILES_DIR = path.join(process.cwd(), 'content', 'profiles');

let cachedProfiles: ApplicationProfileRaw[] | null = null;

/**
 * Wczytuje wszystkie profile z `content/profiles/`. Cache w pamięci procesu.
 */
async function loadProfiles(): Promise<ApplicationProfileRaw[]> {
  if (cachedProfiles) return cachedProfiles;
  const files = await fs.readdir(PROFILES_DIR);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  const profiles: ApplicationProfileRaw[] = [];
  for (const file of jsonFiles) {
    const raw = await fs.readFile(path.join(PROFILES_DIR, file), 'utf-8');
    profiles.push(JSON.parse(raw) as ApplicationProfileRaw);
  }
  cachedProfiles = profiles;
  return profiles;
}

/**
 * Zwraca listę profili z lokalizowanymi nazwami i opisami.
 */
export async function listProfiles(locale: AppLocale): Promise<ApplicationProfile[]> {
  const raw = await loadProfiles();
  return raw.map((p) => ({
    id: p.id,
    name: p.name[locale],
    description: p.description[locale],
    followUpQuestions: localizeQuestions(p.followUpQuestions, locale),
  }));
}

/**
 * Zwraca pytania uzupełniające dla danego profilu (Wymaganie 15.3).
 */
export async function getFollowUpQuestions(
  profileId: string,
  locale: AppLocale,
): Promise<Question[]> {
  const raw = await loadProfiles();
  const profile = raw.find((p) => p.id === profileId);
  if (!profile) {
    throw new Error(`profile.notFound:${profileId}`);
  }
  return localizeQuestions(profile.followUpQuestions, locale);
}

/**
 * Generuje treść standards.md przez AI dla wybranego profilu (Wymaganie 15.4).
 */
export async function generateStandards(
  profileId: string,
  followUpAnswers: QuestionAnswer[],
  config: AIServiceConfig,
  locale: AppLocale,
  onChunk: (chunk: string) => void,
): Promise<string> {
  const raw = await loadProfiles();
  const profile = raw.find((p) => p.id === profileId);
  if (!profile) {
    throw new Error(`profile.notFound:${profileId}`);
  }
  return aiGenerateStandards(config, profile.name[locale], followUpAnswers, locale, onChunk);
}

/**
 * Zwraca surowy profil (na potrzeby fixtures w trybie demo).
 */
export async function getProfile(profileId: string): Promise<ApplicationProfileRaw | null> {
  const raw = await loadProfiles();
  return raw.find((p) => p.id === profileId) ?? null;
}

/**
 * Reset cache (do użytku w testach).
 */
export function _resetCache(): void {
  cachedProfiles = null;
}

function localizeQuestions(
  raw: ApplicationProfileRaw['followUpQuestions'],
  locale: AppLocale,
): Question[] {
  return raw.map((q) => ({
    id: q.id,
    text: q.text[locale],
    hint: q.hint?.[locale],
    isRequired: q.isRequired,
  }));
}
