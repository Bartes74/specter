/**
 * Testy jednostkowe PreferencesService — izolacja przez podmianę HOME na tmp.
 *
 * Validates: Wymagania 1.2, 1.3, 1.11, 17.1, 17.4
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import type * as PreferencesServiceModule from '@/services/PreferencesService';

let tmpHome: string;
let originalHome: string | undefined;

// Importujemy LAZY — PreferencesService czyta os.homedir() w czasie load modułu
let svc: typeof PreferencesServiceModule;

beforeEach(async () => {
  originalHome = process.env.HOME;
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-prefs-'));
  process.env.HOME = tmpHome;
  vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
  // Reset modułu, żeby PREFS_DIR/PREFS_FILE odczytały nowe HOME
  vi.resetModules();
  svc = await import('@/services/PreferencesService');
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env.HOME = originalHome;
  await fs.rm(tmpHome, { recursive: true, force: true });
});

describe('load + save', () => {
  it('zwraca defaulty gdy plik nie istnieje', async () => {
    const prefs = await svc.load();
    expect(prefs.firstRunComplete).toBe(false);
    expect(prefs.recentProjects).toEqual([]);
    expect(prefs.preferredLocale).toBe('pl');
    expect(prefs.tutorialsViewed).toEqual([]);
  });

  it('zapisuje i odczytuje preferencje', async () => {
    await svc.save({
      firstRunComplete: true,
      recentProjects: [],
      preferredLocale: 'en',
      tutorialsViewed: ['openai', 'anthropic'],
    });
    const prefs = await svc.load();
    expect(prefs.firstRunComplete).toBe(true);
    expect(prefs.preferredLocale).toBe('en');
    expect(prefs.tutorialsViewed).toEqual(['openai', 'anthropic']);
  });

  it('zwraca defaulty gdy plik jest uszkodzony', async () => {
    await fs.mkdir(svc.PREFS_DIR, { recursive: true });
    await fs.writeFile(svc.PREFS_FILE, '{ to nie jest JSON', 'utf-8');
    const prefs = await svc.load();
    expect(prefs.firstRunComplete).toBe(false);
  });
});

describe('addRecentProject', () => {
  it('dopisuje nowy projekt na początek listy', async () => {
    const prefs = await svc.addRecentProject({
      path: '/tmp/proj-a',
      name: 'A',
      lastUsedAt: '2024-01-01T00:00:00.000Z',
      hasStandards: false,
    });
    expect(prefs.recentProjects).toHaveLength(1);
    expect(prefs.recentProjects[0]!.name).toBe('A');
  });

  it('aktualizuje istniejący wpis zamiast tworzyć duplikat', async () => {
    await svc.addRecentProject({
      path: '/tmp/proj-a',
      name: 'A',
      lastUsedAt: '2024-01-01T00:00:00.000Z',
      hasStandards: false,
    });
    const prefs = await svc.addRecentProject({
      path: '/tmp/proj-a',
      name: 'A v2',
      lastUsedAt: '2024-06-01T00:00:00.000Z',
      hasStandards: true,
    });
    expect(prefs.recentProjects).toHaveLength(1);
    expect(prefs.recentProjects[0]!.name).toBe('A v2');
    expect(prefs.recentProjects[0]!.hasStandards).toBe(true);
  });

  it('utrzymuje maksymalnie 10 wpisów', async () => {
    for (let i = 0; i < 15; i++) {
      await svc.addRecentProject({
        path: `/tmp/proj-${i}`,
        name: `P${i}`,
        lastUsedAt: new Date(2024, 0, i + 1).toISOString(),
        hasStandards: false,
      });
    }
    const prefs = await svc.load();
    expect(prefs.recentProjects).toHaveLength(10);
  });
});

describe('markFirstRunComplete + markTutorialViewed', () => {
  it('markFirstRunComplete jest idempotentne', async () => {
    const a = await svc.markFirstRunComplete();
    const b = await svc.markFirstRunComplete();
    expect(a.firstRunComplete).toBe(true);
    expect(b.firstRunComplete).toBe(true);
  });

  it('markTutorialViewed nie tworzy duplikatów', async () => {
    await svc.markTutorialViewed('openai');
    await svc.markTutorialViewed('openai');
    const prefs = await svc.markTutorialViewed('anthropic');
    expect(prefs.tutorialsViewed).toEqual(['openai', 'anthropic']);
  });
});

describe('bezpieczeństwo: klucze API NIGDY nie trafiają do preferencji', () => {
  it('save zsanityzuje klucze API które przypadkiem trafiły do prefs', async () => {
    // Ten test pilnuje regresji: nawet gdy ktoś źle przebuduje typ UserPreferences,
    // sanitizeLogs pochwyci klucz przed zapisem na dysk.
    const prefsWithLeak: Record<string, unknown> = {
      firstRunComplete: true,
      recentProjects: [],
      preferredLocale: 'pl',
      tutorialsViewed: [],
      sneakyKey: ['sk', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234'].join('-'),
    };
    // Celowo łamiemy typ, żeby udowodnić że bezpiecznik działa nawet przy regresji
    await svc.save(prefsWithLeak as unknown as Parameters<typeof svc.save>[0]);
    const onDisk = await fs.readFile(svc.PREFS_FILE, 'utf-8');
    expect(onDisk).not.toContain(prefsWithLeak.sneakyKey);
    expect(onDisk).toContain('[REDACTED:openai]');
  });
});
