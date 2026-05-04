/**
 * PreferencesService — lokalne preferencje użytkownika (Zadanie 4.1a).
 *
 * Plik: ~/.spec-generator/preferences.json
 *
 * Wymagania: 1.2, 1.3, 1.11, 17.1, 17.4
 *
 * GWARANCJE BEZPIECZEŃSTWA:
 * - Klucze API NIGDY nie są tu zapisywane (sprawdzane przez sanitizeLogs przy każdym save)
 * - Plik tworzony z trybem 0600 (read/write tylko dla właściciela)
 * - Maksymalnie 10 ostatnich projektów (Property 14)
 * - Brak duplikatów ścieżek (Property 14)
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import type { AIProvider } from '@/types/providers';
import { isAIProvider } from '@/types/providers';
import { sanitizeLogs } from '@/lib/security';

export interface RecentProject {
  path: string;
  name: string;
  lastUsedAt: string; // ISO 8601
  hasStandards: boolean;
}

export interface UserPreferences {
  firstRunComplete: boolean;
  recentProjects: RecentProject[];
  preferredLocale: 'pl' | 'en';
  preferredTargetTool?: string;
  preferredAiModel?: string;
  preferredAiProvider?: AIProvider;
  tutorialsViewed: AIProvider[];
}

export const PREFS_DIR = path.join(os.homedir(), '.spec-generator');
export const PREFS_FILE = path.join(PREFS_DIR, 'preferences.json');
export const MAX_RECENT_PROJECTS = 10;

const DEFAULT_PREFS: UserPreferences = {
  firstRunComplete: false,
  recentProjects: [],
  preferredLocale: 'pl',
  tutorialsViewed: [],
};

/**
 * Wczytuje preferencje, zwracając wartości domyślne gdy plik nie istnieje
 * lub jest uszkodzony.
 */
export async function load(): Promise<UserPreferences> {
  try {
    const raw = await fs.readFile(PREFS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return mergeWithDefaults(parsed);
  } catch {
    return { ...DEFAULT_PREFS, recentProjects: [] };
  }
}

/**
 * Zapisuje preferencje. Sanityzuje treść przed zapisem (bezpieczeństwo:
 * gdyby ktoś kiedyś przypadkiem dodał klucz API, zostanie zamaskowany).
 */
export async function save(prefs: UserPreferences): Promise<void> {
  await fs.mkdir(PREFS_DIR, { recursive: true, mode: 0o700 });
  const json = JSON.stringify(prefs, null, 2);
  // Bezpiecznik: gdyby kiedyś coś przypominającego klucz API trafiło do prefs,
  // zostanie zamaskowane przed zapisem.
  const sanitized = sanitizeLogs(json);
  await fs.writeFile(PREFS_FILE, sanitized, { encoding: 'utf-8', mode: 0o600 });
}

/**
 * Dodaje projekt do listy ostatnich lub aktualizuje datę dla istniejącego.
 *
 * Property 14: lista zawiera ≤ 10 elementów, sortowana malejąco po lastUsedAt,
 *              brak duplikatów ścieżek.
 */
export async function addRecentProject(project: RecentProject): Promise<UserPreferences> {
  const prefs = await load();
  const next = applyRecentProject(prefs, project);
  await save(next);
  return next;
}

/**
 * Logika dodawania (wydzielona, żeby property test mógł ją sprawdzać bez I/O).
 */
export function applyRecentProject(
  prefs: UserPreferences,
  project: RecentProject,
): UserPreferences {
  const normalized = path.resolve(project.path);
  const filtered = prefs.recentProjects.filter(
    (p) => path.resolve(p.path) !== normalized,
  );
  const updated: RecentProject = {
    ...project,
    path: normalized,
  };
  const merged = [updated, ...filtered]
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, MAX_RECENT_PROJECTS);
  return { ...prefs, recentProjects: merged };
}

/**
 * Oznacza pierwsze uruchomienie jako zakończone (Wymaganie 17.1).
 */
export async function markFirstRunComplete(): Promise<UserPreferences> {
  const prefs = await load();
  if (prefs.firstRunComplete) return prefs;
  const next: UserPreferences = { ...prefs, firstRunComplete: true };
  await save(next);
  return next;
}

/**
 * Oznacza tutorial dla danego dostawcy jako obejrzany.
 */
export async function markTutorialViewed(provider: AIProvider): Promise<UserPreferences> {
  const prefs = await load();
  if (prefs.tutorialsViewed.includes(provider)) return prefs;
  const next: UserPreferences = {
    ...prefs,
    tutorialsViewed: [...prefs.tutorialsViewed, provider],
  };
  await save(next);
  return next;
}

// --- Helpery ---

function mergeWithDefaults(parsed: unknown): UserPreferences {
  if (!parsed || typeof parsed !== 'object') {
    return { ...DEFAULT_PREFS, recentProjects: [] };
  }
  const obj = parsed as Record<string, unknown>;
  return {
    firstRunComplete: typeof obj.firstRunComplete === 'boolean' ? obj.firstRunComplete : false,
    recentProjects: sanitizeRecentList(obj.recentProjects),
    preferredLocale: obj.preferredLocale === 'en' ? 'en' : 'pl',
    preferredTargetTool: typeof obj.preferredTargetTool === 'string' ? obj.preferredTargetTool : undefined,
    preferredAiModel: typeof obj.preferredAiModel === 'string' ? obj.preferredAiModel : undefined,
    preferredAiProvider: isAIProvider(obj.preferredAiProvider) ? obj.preferredAiProvider : undefined,
    tutorialsViewed: Array.isArray(obj.tutorialsViewed)
      ? obj.tutorialsViewed.filter(isAIProvider)
      : [],
  };
}

function sanitizeRecentList(input: unknown): RecentProject[] {
  if (!Array.isArray(input)) return [];
  const valid: RecentProject[] = [];
  const seenPaths = new Set<string>();
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    if (
      typeof r.path !== 'string' ||
      typeof r.name !== 'string' ||
      typeof r.lastUsedAt !== 'string'
    ) {
      continue;
    }
    const normalized = path.resolve(r.path);
    if (seenPaths.has(normalized)) continue;
    seenPaths.add(normalized);
    valid.push({
      path: normalized,
      name: r.name,
      lastUsedAt: r.lastUsedAt,
      hasStandards: typeof r.hasStandards === 'boolean' ? r.hasStandards : false,
    });
  }
  return valid
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .slice(0, MAX_RECENT_PROJECTS);
}
