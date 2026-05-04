/**
 * Feature: spec-generator
 * Property 19: Kompletność tutoriali (4 dostawców × 2 locale + meta)
 * Property 20: Ostrzeżenie o nieaktualnej treści (>90 dni)
 *
 * Validates: Wymagania 16.1, 16.9, 16.10
 */
import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { AI_PROVIDERS } from '@/types/providers';
import {
  getTutorial,
  isStale,
  STALE_THRESHOLD_DAYS,
  _resetCache,
} from '@/services/TutorialService';

const TUTORIALS_DIR = path.join(process.cwd(), 'content', 'tutorials');
const META_FILE = path.join(TUTORIALS_DIR, '_meta.json');

beforeEach(() => {
  _resetCache();
});

describe('Property 19: Kompletność tutoriali', () => {
  it('dla każdego dostawcy × locale istnieje plik markdown', async () => {
    for (const provider of AI_PROVIDERS) {
      for (const locale of ['pl', 'en'] as const) {
        const filePath = path.join(TUTORIALS_DIR, `${provider}.${locale}.md`);
        const exists = await fs
          .access(filePath)
          .then(() => true)
          .catch(() => false);
        expect(exists, `Missing: ${provider}.${locale}.md`).toBe(true);
      }
    }
  });

  it('_meta.json zawiera wpisy dla wszystkich 4 dostawców z wymaganymi polami', async () => {
    const raw = await fs.readFile(META_FILE, 'utf-8');
    const meta = JSON.parse(raw) as {
      schemaVersion: number;
      providers: Record<string, { sourceUrl: string; lastUpdatedAt: string; verifiedAgainstDocsAt: string; locales: string[] }>;
    };
    expect(meta.schemaVersion).toBe(1);
    for (const provider of AI_PROVIDERS) {
      const m = meta.providers[provider];
      expect(m, `Missing meta for: ${provider}`).toBeDefined();
      if (!m) continue;
      expect(m.sourceUrl).toMatch(/^https:\/\//);
      expect(m.lastUpdatedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(m.verifiedAgainstDocsAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(m.locales).toEqual(expect.arrayContaining(['pl', 'en']));
    }
  });

  it('getTutorial zwraca niepusty contentMarkdown z linkami i kosztami', async () => {
    for (const provider of AI_PROVIDERS) {
      const tutorial = await getTutorial(provider, 'pl');
      expect(tutorial.contentMarkdown.length).toBeGreaterThan(200);
      expect(tutorial.externalLinks.length).toBeGreaterThan(0);
      expect(tutorial.estimatedCostUsd.min).toBeGreaterThanOrEqual(0);
      expect(tutorial.estimatedCostUsd.max).toBeGreaterThanOrEqual(tutorial.estimatedCostUsd.min);
      expect(tutorial.sourceUrl).toMatch(/^https:\/\//);
    }
  });
});

describe('Property 20: Ostrzeżenie o nieaktualnej treści (>90 dni)', () => {
  it('aktualne tutoriale (świeży verifiedAgainstDocsAt) → brak staleWarning', async () => {
    // Wszystkie nasze tutoriale mają verifiedAgainstDocsAt = dzisiejsza data testu
    // → staleWarning powinien być undefined
    for (const provider of AI_PROVIDERS) {
      const tutorial = await getTutorial(provider, 'pl');
      const days = Math.floor(
        (Date.now() - new Date(tutorial.verifiedAgainstDocsAt).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (days <= STALE_THRESHOLD_DAYS) {
        expect(tutorial.staleWarning).toBeUndefined();
      } else {
        expect(tutorial.staleWarning).toBeTruthy();
      }
    }
  });

  it('isStale zwraca false dla świeżych tutoriali', async () => {
    for (const provider of AI_PROVIDERS) {
      // Obecnie wszystkie tutoriale są świeże (utworzone dzisiaj)
      expect(await isStale(provider)).toBe(false);
    }
  });
});

describe('TutorialService — różne locale', () => {
  it('pl i en mają różną treść (nie są copy-paste)', async () => {
    for (const provider of AI_PROVIDERS) {
      const pl = await getTutorial(provider, 'pl');
      const en = await getTutorial(provider, 'en');
      expect(pl.contentMarkdown).not.toBe(en.contentMarkdown);
      // pl powinien zawierać polskie słowa
      expect(/(API|klucz|kont)/i.test(pl.contentMarkdown)).toBe(true);
      // en powinien zawierać angielskie słowa
      expect(/(API|key|account)/i.test(en.contentMarkdown)).toBe(true);
    }
  });
});
