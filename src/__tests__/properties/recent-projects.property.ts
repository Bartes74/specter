/**
 * Feature: spec-generator
 * Property 14: Spójność listy ostatnich projektów
 *
 * Validates: Wymagania 1.2, 1.11
 */
import { describe, expect } from 'vitest';
import { test, fc } from '@fast-check/vitest';
import * as path from 'node:path';
import {
  applyRecentProject,
  MAX_RECENT_PROJECTS,
  type RecentProject,
  type UserPreferences,
} from '@/services/PreferencesService';

const NUM_RUNS = { numRuns: 200 };

const projectArb: fc.Arbitrary<RecentProject> = fc.record({
  path: fc.stringMatching(/^\/[a-z0-9_-]{1,20}(\/[a-z0-9_-]{1,20}){0,3}$/),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  lastUsedAt: fc
    .integer({ min: 0, max: 10_000_000 })
    .map((offset) => new Date(1_700_000_000_000 + offset).toISOString()),
  hasStandards: fc.boolean(),
});

const initialPrefs: UserPreferences = {
  firstRunComplete: false,
  recentProjects: [],
  preferredLocale: 'pl',
  tutorialsViewed: [],
};

describe('Property 14: Spójność listy ostatnich projektów', () => {
  test.prop([fc.array(projectArb, { minLength: 1, maxLength: 50 })], NUM_RUNS)(
    'po dodaniu N projektów: lista ≤ 10 elementów, brak duplikatów ścieżek, posortowana malejąco',
    (projects) => {
      let prefs = initialPrefs;
      for (const p of projects) {
        prefs = applyRecentProject(prefs, p);
      }
      const list = prefs.recentProjects;
      expect(list.length).toBeLessThanOrEqual(MAX_RECENT_PROJECTS);
      // Brak duplikatów (po normalizacji ścieżki)
      const paths = list.map((p) => path.resolve(p.path));
      expect(new Set(paths).size).toBe(paths.length);
      // Sortowanie malejące po dacie
      for (let i = 1; i < list.length; i++) {
        expect(list[i - 1]!.lastUsedAt >= list[i]!.lastUsedAt).toBe(true);
      }
    },
  );

  test('powtórne dodanie tej samej ścieżki aktualizuje datę, nie tworzy duplikatu', () => {
    let prefs = initialPrefs;
    prefs = applyRecentProject(prefs, {
      path: '/tmp/proj-a',
      name: 'A',
      lastUsedAt: '2024-01-01T00:00:00.000Z',
      hasStandards: false,
    });
    prefs = applyRecentProject(prefs, {
      path: '/tmp/proj-a',
      name: 'A (renamed)',
      lastUsedAt: '2024-06-15T12:00:00.000Z',
      hasStandards: true,
    });
    expect(prefs.recentProjects).toHaveLength(1);
    expect(prefs.recentProjects[0]!.lastUsedAt).toBe('2024-06-15T12:00:00.000Z');
    expect(prefs.recentProjects[0]!.name).toBe('A (renamed)');
    expect(prefs.recentProjects[0]!.hasStandards).toBe(true);
  });

  test('dodanie 15 unikalnych ścieżek zostawia tylko 10 najnowszych', () => {
    let prefs = initialPrefs;
    for (let i = 0; i < 15; i++) {
      prefs = applyRecentProject(prefs, {
        path: `/tmp/proj-${i}`,
        name: `Project ${i}`,
        // Najnowsze daty dla wyższych i — top 10 to indeksy 5..14
        lastUsedAt: new Date(2024, 0, 1 + i).toISOString(),
        hasStandards: false,
      });
    }
    expect(prefs.recentProjects).toHaveLength(MAX_RECENT_PROJECTS);
    // Pierwszy = najnowszy = proj-14
    expect(prefs.recentProjects[0]!.name).toBe('Project 14');
    // Ostatni = proj-5
    expect(prefs.recentProjects[9]!.name).toBe('Project 5');
  });
});
