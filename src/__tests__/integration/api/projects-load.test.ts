/**
 * Integracja: POST /api/projects/load
 * Wczytuje zapisane metadane projektu oraz obecne pliki docs/*.md.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { POST } from '@/app/api/projects/load/route';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-project-load-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/projects/load', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/projects/load', () => {
  it('zwraca snapshot, dokumenty i standards.md dla istniejącego projektu', async () => {
    await fs.mkdir(path.join(tmpDir, '.spec-generator'), { recursive: true });
    await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'docs', 'requirements.md'), '# Requirements v1', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'standards.md'), '# Standards', 'utf-8');
    await fs.writeFile(
      path.join(tmpDir, '.spec-generator', 'project.json'),
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: '2026-05-04T12:00:00.000Z',
        locale: 'pl',
        projectDescription: 'Aplikacja biznesowa do zarządzania zadaniami.',
        questions: [],
        answers: [{ questionId: 'q1', answer: 'Managerowie zespołów', skipped: false }],
        targetTool: 'universal',
        toolRecommendation: null,
        aiProvider: 'openai',
        aiModel: 'gpt-5.4-mini',
        modelRecommendation: null,
        standards: '# Standards',
        standardsSource: 'existing',
        generatedDocuments: { requirements: '# Requirements v1', design: null, tasks: null },
        documentHistory: { requirements: [], design: [], tasks: [] },
        handledDocumentSuggestionKeys: [],
        documentSuggestions: [],
        documentSuggestionIteration: 0,
      }),
      'utf-8',
    );

    const res = await POST(makeRequest({ projectPath: tmpDir }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projectState: { projectDescription: string; answers: unknown[] };
      documents: { requirements: string | null };
      standards: string | null;
    };
    expect(body.projectState.projectDescription).toContain('Aplikacja biznesowa');
    expect(body.projectState.answers).toHaveLength(1);
    expect(body.documents.requirements).toBe('# Requirements v1');
    expect(body.standards).toBe('# Standards');
  });

  it('TRYB DEMO: nie czyta projektu i zwraca pusty stan', async () => {
    await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'docs', 'requirements.md'), '# REAL', 'utf-8');

    const res = await POST(makeRequest({ projectPath: tmpDir }, { 'x-demo-mode': 'true' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      demo: boolean;
      projectState: unknown;
      documents: { requirements: string | null };
    };
    expect(body.demo).toBe(true);
    expect(body.projectState).toBeNull();
    expect(body.documents.requirements).toBeNull();
  });
});
