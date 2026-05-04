/**
 * TutorialService — treść tutoriali kluczy API (Zadanie 13.3).
 *
 * Wymagania: 16.1, 16.8, 16.9, 16.10, 16.11
 *
 * Treść jest w content/tutorials/<provider>.<locale>.md, metadane w _meta.json.
 * Aktualizacja możliwa bez deployu kodu.
 *
 * verifyAgainstSource — opcjonalna, używana przez scripts/verify-tutorials.ts.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { AIProvider } from '@/types/providers';
import { AI_PROVIDERS } from '@/types/providers';

const TUTORIALS_DIR = path.join(process.cwd(), 'content', 'tutorials');
const META_FILE = path.join(TUTORIALS_DIR, '_meta.json');

export const STALE_THRESHOLD_DAYS = 90;
export const STALE_INFO_THRESHOLD_DAYS = 30;

export interface TutorialMeta {
  sourceUrl: string;
  lastUpdatedAt: string;
  verifiedAgainstDocsAt: string;
  contentHash: string;
  locales: ('pl' | 'en')[];
}

export interface TutorialsMetaFile {
  schemaVersion: 1;
  providers: Record<AIProvider, TutorialMeta>;
}

export interface ExternalLink {
  label: string;
  url: string;
}

export interface FreeTierInfo {
  available: boolean;
  description: string;
}

export interface TutorialResponse {
  provider: AIProvider;
  locale: 'pl' | 'en';
  contentMarkdown: string;
  externalLinks: ExternalLink[];
  estimatedCostUsd: { min: number; max: number };
  freeTier?: FreeTierInfo;
  lastUpdatedAt: string;
  verifiedAgainstDocsAt: string;
  sourceUrl: string;
  staleWarning?: string;
}

/**
 * Aktualne szacunki kosztów (per pełna specyfikacja, USD).
 * Źródło: tutoriale w content/tutorials/.
 */
const COST_ESTIMATES: Record<AIProvider, { min: number; max: number }> = {
  openai: { min: 0.005, max: 0.15 },
  anthropic: { min: 0.02, max: 0.3 },
  google: { min: 0, max: 0.05 }, // free tier
  github: { min: 0, max: 0 }, // preview, free
};

/**
 * Informacja o darmowym planie (gdzie istnieje).
 */
const FREE_TIER: Partial<Record<AIProvider, FreeTierInfo>> = {
  google: {
    available: true,
    description:
      'Gemini 1.5 Flash: 15 req/min, 1M tokens/min, 1500 req/day. Brak karty kredytowej.',
  },
  github: {
    available: true,
    description: 'GitHub Models w preview — darmowe z limitami zależnymi od planu GitHub.',
  },
  openai: {
    available: false,
    description: 'Brak darmowego planu (czasem $5 kredytów dla nowych kont).',
  },
  anthropic: {
    available: false,
    description: 'Brak darmowego planu — wymagane doładowanie konta.',
  },
};

let cachedMeta: TutorialsMetaFile | null = null;

async function loadMeta(): Promise<TutorialsMetaFile> {
  if (cachedMeta) return cachedMeta;
  const raw = await fs.readFile(META_FILE, 'utf-8');
  cachedMeta = JSON.parse(raw) as TutorialsMetaFile;
  return cachedMeta;
}

/**
 * Lista wspieranych providerów — wszystkie 4.
 */
export function listAvailableProviders(): AIProvider[] {
  return [...AI_PROVIDERS];
}

/**
 * Pobiera tutorial dla danego dostawcy w wybranym języku.
 */
export async function getTutorial(
  provider: AIProvider,
  locale: 'pl' | 'en',
): Promise<TutorialResponse> {
  const meta = await loadMeta();
  const providerMeta = meta.providers[provider];
  if (!providerMeta) {
    throw new Error(`tutorial.providerNotFound:${provider}`);
  }

  const filePath = path.join(TUTORIALS_DIR, `${provider}.${locale}.md`);
  let contentMarkdown: string;
  try {
    contentMarkdown = await fs.readFile(filePath, 'utf-8');
  } catch {
    throw new Error(`tutorial.fileNotFound:${provider}.${locale}.md`);
  }

  const externalLinks = extractMarkdownLinks(contentMarkdown);
  const staleWarning = computeStaleWarning(providerMeta.verifiedAgainstDocsAt, locale);

  return {
    provider,
    locale,
    contentMarkdown,
    externalLinks,
    estimatedCostUsd: COST_ESTIMATES[provider],
    freeTier: FREE_TIER[provider],
    lastUpdatedAt: providerMeta.lastUpdatedAt,
    verifiedAgainstDocsAt: providerMeta.verifiedAgainstDocsAt,
    sourceUrl: providerMeta.sourceUrl,
    ...(staleWarning ? { staleWarning } : {}),
  };
}

/**
 * Sprawdza czy tutorial jest "stale" (verifiedAgainstDocsAt > 90 dni temu).
 */
export async function isStale(provider: AIProvider): Promise<boolean> {
  const meta = await loadMeta();
  const m = meta.providers[provider];
  if (!m) return true;
  return daysAgo(m.verifiedAgainstDocsAt) > STALE_THRESHOLD_DAYS;
}

/**
 * Zwraca SHA-256 hash treści tutoriala (do wykrywania zmian).
 */
export async function computeContentHash(provider: AIProvider, locale: 'pl' | 'en'): Promise<string> {
  const filePath = path.join(TUTORIALS_DIR, `${provider}.${locale}.md`);
  const content = await fs.readFile(filePath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Reset cache (do użytku w testach).
 */
export function _resetCache(): void {
  cachedMeta = null;
}

// --- Helpery ---

function extractMarkdownLinks(markdown: string): ExternalLink[] {
  const links: ExternalLink[] = [];
  const seen = new Set<string>();
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(markdown)) !== null) {
    const label = match[1]!;
    const url = match[2]!;
    if (!url.startsWith('http')) continue;
    const dedupKey = `${label}|${url}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    links.push({ label, url });
  }
  return links;
}

function daysAgo(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.MAX_SAFE_INTEGER;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function computeStaleWarning(verifiedAgainstDocsAt: string, locale: 'pl' | 'en'): string | undefined {
  const days = daysAgo(verifiedAgainstDocsAt);
  if (days <= STALE_THRESHOLD_DAYS) return undefined;
  return locale === 'pl'
    ? `Treść może być nieaktualna — ostatnia weryfikacja ${days} dni temu. Sprawdź oryginalną dokumentację dostawcy.`
    : `Content may be out of date — last verified ${days} days ago. Check the provider's original documentation.`;
}
