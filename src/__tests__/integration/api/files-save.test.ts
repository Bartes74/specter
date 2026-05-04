/**
 * Integracja: POST /api/files/save
 * Validates: Wymagania 1.10, 7.1, 13.3, 17.7, 17.9 (Property 21 — zero zapisów w demo)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { POST } from '@/app/api/files/save/route';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-api-save-'));
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/files/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/files/save', () => {
  it('zapisuje 3 pliki do /docs', async () => {
    const res = await POST(
      makeRequest({
        projectPath: tmpDir,
        documents: [
          { filename: 'requirements.md', content: '# Wymagania' },
          { filename: 'design.md', content: '# Design' },
          { filename: 'tasks.md', content: '# Tasks' },
        ],
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; savedFiles: string[] };
    expect(body.success).toBe(true);
    expect(body.savedFiles).toHaveLength(3);

    // Pliki rzeczywiście istnieją
    const reqContent = await fs.readFile(path.join(tmpDir, 'docs', 'requirements.md'), 'utf-8');
    expect(reqContent).toBe('# Wymagania');
  });

  it('archiwizuje poprzednie dokumenty do old_docs i zapisuje snapshot projektu', async () => {
    await fs.mkdir(path.join(tmpDir, 'docs'), { recursive: true });
    const oldReqPath = path.join(tmpDir, 'docs', 'requirements.md');
    await fs.writeFile(oldReqPath, '# Stare wymagania', 'utf-8');
    const modifiedAt = new Date('2026-05-04T10:11:12.000Z');
    await fs.utimes(oldReqPath, modifiedAt, modifiedAt);

    const res = await POST(
      makeRequest({
        projectPath: tmpDir,
        archiveExisting: true,
        documents: [{ filename: 'requirements.md', content: '# Nowe wymagania' }],
        projectState: {
          schemaVersion: 1,
          updatedAt: '2026-05-04T12:00:00.000Z',
          locale: 'pl',
          projectDescription: 'Opis projektu zapisany przy generowaniu nowej wersji.',
          questions: [],
          answers: [{ questionId: 'q1', answer: 'Odpowiedź biznesowa', skipped: false }],
          targetTool: 'universal',
          toolRecommendation: null,
          aiProvider: 'openai',
          aiModel: 'gpt-5.4-mini',
          modelRecommendation: null,
          standards: null,
          standardsSource: null,
          generatedDocuments: {
            requirements: '# Nowe wymagania',
            design: null,
            tasks: null,
          },
          documentHistory: { requirements: [], design: [], tasks: [] },
          handledDocumentSuggestionKeys: [],
          documentSuggestions: [],
          documentSuggestionIteration: 0,
        },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      savedFiles: string[];
      archivedFiles: string[];
      projectStateFile: string;
    };
    expect(body.success).toBe(true);
    expect(body.savedFiles).toHaveLength(1);
    expect(body.archivedFiles).toHaveLength(1);
    expect(path.basename(body.archivedFiles[0]!)).toMatch(/^requirements_2026-05-04_/);

    await expect(fs.readFile(path.join(tmpDir, 'docs', 'requirements.md'), 'utf-8'))
      .resolves.toBe('# Nowe wymagania');
    await expect(fs.readFile(body.archivedFiles[0]!, 'utf-8'))
      .resolves.toBe('# Stare wymagania');

    const snapshotRaw = await fs.readFile(path.join(tmpDir, '.spec-generator', 'project.json'), 'utf-8');
    expect(snapshotRaw).toContain('Opis projektu zapisany');
    expect(snapshotRaw).not.toContain('apiKey');
  });

  it('odrzuca filename z separatorem ścieżki', async () => {
    const res = await POST(
      makeRequest({
        projectPath: tmpDir,
        documents: [{ filename: '../escape.md', content: 'x' }],
      }),
    );
    // Zwraca 200 z errors w odpowiedzi (jeden plik się nie udał, drugi też nie ma)
    const body = (await res.json()) as {
      success: boolean;
      savedFiles: string[];
      errors?: { error: string }[];
    };
    expect(body.success).toBe(false);
    expect(body.savedFiles).toHaveLength(0);
    expect(body.errors?.[0]?.error).toContain('filename.illegal');
  });

  // KRYTYCZNY test — Property 21
  it('TRYB DEMO: zero zapisów na dysk', async () => {
    const res = await POST(
      makeRequest(
        {
          projectPath: tmpDir,
          documents: [
            { filename: 'requirements.md', content: '# DEMO' },
            { filename: 'design.md', content: '# DEMO' },
          ],
        },
        { 'x-demo-mode': 'true' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; demo: boolean };
    expect(body.success).toBe(true);
    expect(body.demo).toBe(true);

    // /docs nie powstał, plików nie ma
    const docsExists = await fs
      .access(path.join(tmpDir, 'docs'))
      .then(() => true)
      .catch(() => false);
    expect(docsExists).toBe(false);
  });
});
