/**
 * Integracja: /api/projects/recent (GET, POST) + /api/projects/create
 * Validates: Wymagania 1.2, 1.4, 1.9, 1.11, 17.7
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';

let tmpHome: string;
let tmpParent: string;
let originalHome: string | undefined;

let recentRoute: typeof import('@/app/api/projects/recent/route');
let createRoute: typeof import('@/app/api/projects/create/route');

beforeEach(async () => {
  originalHome = process.env.HOME;
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-api-prefs-'));
  tmpParent = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-api-parent-'));
  process.env.HOME = tmpHome;
  vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
  vi.resetModules();
  recentRoute = await import('@/app/api/projects/recent/route');
  createRoute = await import('@/app/api/projects/create/route');
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env.HOME = originalHome;
  await fs.rm(tmpHome, { recursive: true, force: true });
  await fs.rm(tmpParent, { recursive: true, force: true });
});

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('GET/POST /api/projects/recent', () => {
  it('GET zwraca pustą listę gdy brak preferencji', async () => {
    const res = await recentRoute.GET(new Request('http://localhost/api/projects/recent'));
    const body = (await res.json()) as { projects: unknown[] };
    expect(body.projects).toEqual([]);
  });

  it('POST dopisuje projekt, GET go zwraca', async () => {
    const post = await recentRoute.POST(
      jsonRequest('http://localhost/api/projects/recent', {
        path: '/tmp/proj-x',
        name: 'X',
        hasStandards: false,
      }),
    );
    expect(post.status).toBe(200);

    const get = await recentRoute.GET(new Request('http://localhost/api/projects/recent'));
    const body = (await get.json()) as { projects: { name: string }[] };
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]!.name).toBe('X');
  });

  it('w trybie demo: GET zwraca pustą listę, POST nic nie zapisuje', async () => {
    const post = await recentRoute.POST(
      jsonRequest(
        'http://localhost/api/projects/recent',
        { path: '/tmp/x', name: 'X', hasStandards: false },
        { 'x-demo-mode': 'true' },
      ),
    );
    expect(post.status).toBe(200);

    const get = await recentRoute.GET(
      new Request('http://localhost/api/projects/recent', { headers: { 'x-demo-mode': 'true' } }),
    );
    const body = (await get.json()) as { projects: unknown[] };
    expect(body.projects).toEqual([]);

    // Plik preferencji NIE powstał
    const exists = await fs
      .access(path.join(tmpHome, '.spec-generator', 'preferences.json'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});

describe('POST /api/projects/create', () => {
  it('tworzy nowy folder w lokalizacji rodzica', async () => {
    const res = await createRoute.POST(
      jsonRequest('http://localhost/api/projects/create', {
        parentPath: tmpParent,
        projectName: 'nowy-projekt',
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; projectPath: string };
    expect(body.success).toBe(true);
    expect(body.projectPath).toBe(path.join(tmpParent, 'nowy-projekt'));
    const stat = await fs.stat(body.projectPath);
    expect(stat.isDirectory()).toBe(true);
  });

  it('zwraca 409 gdy folder już istnieje', async () => {
    await fs.mkdir(path.join(tmpParent, 'duplikat'));
    const res = await createRoute.POST(
      jsonRequest('http://localhost/api/projects/create', {
        parentPath: tmpParent,
        projectName: 'duplikat',
      }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('PROJECT_EXISTS');
  });

  it('zwraca 400 dla nielegalnej nazwy', async () => {
    const res = await createRoute.POST(
      jsonRequest('http://localhost/api/projects/create', {
        parentPath: tmpParent,
        projectName: 'a/b',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NAME_INVALID');
  });

  it('w trybie demo: zwraca syntetyczną ścieżkę bez tworzenia folderu', async () => {
    const res = await createRoute.POST(
      jsonRequest(
        'http://localhost/api/projects/create',
        { parentPath: '/totalnie/fake/path', projectName: 'demo-proj' },
        { 'x-demo-mode': 'true' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; demo: boolean; projectPath: string };
    expect(body.success).toBe(true);
    expect(body.demo).toBe(true);
    expect(body.projectPath).toBe('/totalnie/fake/path/demo-proj');
  });
});
