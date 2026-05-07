/**
 * Feature: spec-generator
 * Property 21: Brak efektów ubocznych w Trybie Demo
 *
 * Validates: Wymagania 17.7, 17.9
 *
 * Sprawdzamy holistycznie: dla DOWOLNEJ kombinacji wywołań API w trybie demo
 * (POST /api/files/save, POST /api/projects/create, POST /api/projects/recent,
 *  POST /api/projects/save-state, POST /api/projects/delete), liczba zapisów na dysk = 0.
 *
 * Test sprawdza endpointy plikowe oraz preferencje, które w demo muszą być no-op.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { POST as filesSavePOST } from '@/app/api/files/save/route';
import { POST as projectsCreatePOST } from '@/app/api/projects/create/route';
import { POST as projectsSaveStatePOST } from '@/app/api/projects/save-state/route';
import { POST as projectsDeletePOST } from '@/app/api/projects/delete/route';

let tmpHome: string;
let tmpProject: string;
let originalHome: string | undefined;

let recentRoute: typeof import('@/app/api/projects/recent/route');

beforeEach(async () => {
  originalHome = process.env.HOME;
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-prop21-home-'));
  tmpProject = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-prop21-proj-'));
  process.env.HOME = tmpHome;
  vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
  vi.resetModules();
  recentRoute = await import('@/app/api/projects/recent/route');
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env.HOME = originalHome;
  await fs.rm(tmpHome, { recursive: true, force: true });
  await fs.rm(tmpProject, { recursive: true, force: true });
});

function jsonReq(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function listAllFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(p: string) {
    let entries;
    try {
      entries = await fs.readdir(p, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isDirectory()) await walk(full);
      else result.push(full);
    }
  }
  await walk(dir);
  return result;
}

describe('Property 21: Tryb Demo NIGDY nie zapisuje na dysk', () => {
  it('files/save + projects/create + projects/recent + projects/save-state + projects/delete w trybie demo: ZERO plików na dysku', async () => {
    const beforeProj = await listAllFiles(tmpProject);
    const beforeHome = await listAllFiles(tmpHome);

    const demoHeaders = { 'x-demo-mode': 'true' };

    // 1. files/save z 3 dokumentami
    await filesSavePOST(
      jsonReq(
        'http://localhost/api/files/save',
        {
          projectPath: tmpProject,
          documents: [
            { filename: 'requirements.md', content: '# DEMO REQ' },
            { filename: 'design.md', content: '# DEMO DES' },
            { filename: 'tasks.md', content: '# DEMO TASKS' },
          ],
        },
        demoHeaders,
      ),
    );

    // 2. projects/create
    await projectsCreatePOST(
      jsonReq(
        'http://localhost/api/projects/create',
        { parentPath: tmpProject, projectName: 'demo-new-project' },
        demoHeaders,
      ),
    );

    // 3. projects/recent (POST + GET)
    await recentRoute.POST(
      jsonReq(
        'http://localhost/api/projects/recent',
        { path: '/tmp/demo-x', name: 'X', hasStandards: false },
        demoHeaders,
      ),
    );
    await recentRoute.GET(
      new Request('http://localhost/api/projects/recent', { headers: demoHeaders }),
    );

    // 4. projects/save-state
    await projectsSaveStatePOST(
      jsonReq(
        'http://localhost/api/projects/save-state',
        {
          projectPath: tmpProject,
          projectState: {
            schemaVersion: 1,
            updatedAt: '2026-05-04T12:00:00.000Z',
            locale: 'pl',
            projectDescription: 'Demo bez zapisu na dysk.',
            questions: [],
            answers: [],
            targetTool: 'universal',
            toolRecommendation: null,
            aiProvider: 'openai',
            aiModel: 'gpt-5.4-mini',
            modelRecommendation: null,
            standards: null,
            standardsSource: null,
            generatedDocuments: { requirements: null, design: null, tasks: null },
            documentHistory: { requirements: [], design: [], tasks: [] },
            handledDocumentSuggestionKeys: [],
            documentSuggestions: [],
            documentSuggestionIteration: 0,
          },
        },
        demoHeaders,
      ),
    );

    // 5. projects/delete
    await projectsDeletePOST(
      jsonReq(
        'http://localhost/api/projects/delete',
        { projectPath: tmpProject },
        demoHeaders,
      ),
    );

    const afterProj = await listAllFiles(tmpProject);
    const afterHome = await listAllFiles(tmpHome);

    // Property 21: liczba plików IDENTYCZNA jak przed wywołaniami
    expect(afterProj).toEqual(beforeProj);
    expect(afterHome).toEqual(beforeHome);
  });

  it('files/save w trybie demo zwraca success=true i syntetyczne ścieżki', async () => {
    const res = await filesSavePOST(
      jsonReq(
        'http://localhost/api/files/save',
        {
          projectPath: tmpProject,
          documents: [{ filename: 'requirements.md', content: 'x' }],
        },
        { 'x-demo-mode': 'true' },
      ),
    );
    const body = (await res.json()) as { success: boolean; demo: boolean; savedFiles: string[] };
    expect(body.success).toBe(true);
    expect(body.demo).toBe(true);
    expect(body.savedFiles[0]).toContain('[demo]');
  });

  it('w trybie NIE-demo: pliki RZECZYWIŚCIE są zapisywane (sanity check)', async () => {
    await filesSavePOST(
      jsonReq('http://localhost/api/files/save', {
        projectPath: tmpProject,
        documents: [{ filename: 'requirements.md', content: '# REAL' }],
      }),
    );
    const after = await listAllFiles(tmpProject);
    expect(after.some((p) => p.endsWith('requirements.md'))).toBe(true);
  });
});
