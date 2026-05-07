/**
 * Integracja: POST /api/projects/delete
 * Usuwa wpis z ostatnich projektów i artefakty wygenerowane przez aplikację.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';

let tmpHome: string;
let tmpProject: string;
let originalHome: string | undefined;

let deleteRoute: typeof import('@/app/api/projects/delete/route');
let recentRoute: typeof import('@/app/api/projects/recent/route');

beforeEach(async () => {
  originalHome = process.env.HOME;
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-delete-prefs-'));
  tmpProject = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-delete-project-'));
  process.env.HOME = tmpHome;
  vi.spyOn(os, 'homedir').mockReturnValue(tmpHome);
  vi.resetModules();
  deleteRoute = await import('@/app/api/projects/delete/route');
  recentRoute = await import('@/app/api/projects/recent/route');
});

afterEach(async () => {
  vi.restoreAllMocks();
  process.env.HOME = originalHome;
  await fs.rm(tmpHome, { recursive: true, force: true });
  await fs.rm(tmpProject, { recursive: true, force: true });
});

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function seedProject() {
  await fs.mkdir(path.join(tmpProject, 'docs'), { recursive: true });
  await fs.mkdir(path.join(tmpProject, 'old_docs'), { recursive: true });
  await fs.mkdir(path.join(tmpProject, '.spec-generator'), { recursive: true });
  await fs.writeFile(path.join(tmpProject, 'docs', 'requirements.md'), '# Req');
  await fs.writeFile(path.join(tmpProject, 'docs', 'notes.md'), '# User note');
  await fs.writeFile(path.join(tmpProject, 'old_docs', 'requirements_2026-01-01_10-00-00.md'), '# Old');
  await fs.writeFile(path.join(tmpProject, 'standards.md'), '# Standards');
  await fs.writeFile(
    path.join(tmpProject, '.spec-generator', 'project.json'),
    JSON.stringify({
      schemaVersion: 1,
      updatedAt: '2026-05-05T10:00:00.000Z',
      locale: 'pl',
      projectDescription: 'Projekt testowy do kasowania.',
      questions: [],
      answers: [],
      targetTool: null,
      toolRecommendation: null,
      aiProvider: null,
      aiModel: null,
      modelRecommendation: null,
      standards: '# Standards',
      standardsSource: 'generated',
      standardsGeneration: { selectedProfileId: 'webapp-react', followUpAnswers: [], draftContent: '# Standards' },
      generatedDocuments: { requirements: '# Req', design: null, tasks: null },
      documentHistory: { requirements: [], design: [], tasks: [] },
      handledDocumentSuggestionKeys: [],
      documentSuggestions: [],
      documentSuggestionIteration: 0,
    }),
    'utf-8',
  );
}

describe('POST /api/projects/delete', () => {
  it('usuwa recent entry i wygenerowane artefakty, zostawiając pliki użytkownika', async () => {
    await seedProject();
    await recentRoute.POST(
      jsonRequest('http://localhost/api/projects/recent', {
        path: tmpProject,
        name: 'Delete me',
        hasStandards: true,
      }),
    );

    const res = await deleteRoute.POST(
      jsonRequest('http://localhost/api/projects/delete', { projectPath: tmpProject }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; deletedPaths: string[]; projects: unknown[] };
    expect(body.success).toBe(true);
    expect(body.projects).toEqual([]);
    expect(body.deletedPaths.length).toBeGreaterThan(0);

    await expect(fs.access(path.join(tmpProject, 'docs', 'requirements.md'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpProject, 'old_docs'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpProject, '.spec-generator'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpProject, 'standards.md'))).rejects.toThrow();
    await expect(fs.readFile(path.join(tmpProject, 'docs', 'notes.md'), 'utf-8')).resolves.toBe('# User note');
  });

  it('TRYB DEMO: nic nie usuwa i nie zmienia preferencji', async () => {
    await seedProject();
    const res = await deleteRoute.POST(
      jsonRequest(
        'http://localhost/api/projects/delete',
        { projectPath: tmpProject },
        { 'x-demo-mode': 'true' },
      ),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; demo: boolean; deletedPaths: unknown[] };
    expect(body.success).toBe(true);
    expect(body.demo).toBe(true);
    expect(body.deletedPaths).toEqual([]);
    await expect(fs.access(path.join(tmpProject, 'docs', 'requirements.md'))).resolves.toBeUndefined();
  });
});
