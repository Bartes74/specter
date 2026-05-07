/**
 * Integracja: POST /api/projects/save-state
 * Zapisuje edytowalne informacje istniejącego projektu bez generowania dokumentów.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { POST } from '@/app/api/projects/save-state/route';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-project-state-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/projects/save-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const projectState = {
  schemaVersion: 1,
  updatedAt: '2026-05-04T12:00:00.000Z',
  locale: 'pl',
  currentStep: 5,
  activeQuestionIndex: 1,
  projectDescription: 'Zmieniony opis istniejącego projektu.',
  questions: [{ id: 'q1', text: 'Kto używa systemu?', isRequired: true }],
  answers: [{ questionId: 'q1', answer: 'Dział sprzedaży', skipped: false }],
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
};

describe('POST /api/projects/save-state', () => {
  it('zapisuje project.json bez klucza API', async () => {
    const res = await POST(makeRequest({ projectPath: tmpDir, projectState }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; savedFile: string };
    expect(body.success).toBe(true);
    expect(body.savedFile).toBe(path.join(tmpDir, '.spec-generator', 'project.json'));

    const raw = await fs.readFile(body.savedFile, 'utf-8');
    expect(raw).toContain('Zmieniony opis');
    const saved = JSON.parse(raw) as typeof projectState;
    expect(saved.currentStep).toBe(5);
    expect(saved.activeQuestionIndex).toBe(1);
    expect(raw).not.toContain('apiKey');
  });

  it('TRYB DEMO: nie zapisuje nic na dysk', async () => {
    const res = await POST(makeRequest({ projectPath: tmpDir, projectState }, { 'x-demo-mode': 'true' }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; demo: boolean };
    expect(body.success).toBe(true);
    expect(body.demo).toBe(true);

    await expect(fs.access(path.join(tmpDir, '.spec-generator', 'project.json')))
      .rejects.toThrow();
  });
});
