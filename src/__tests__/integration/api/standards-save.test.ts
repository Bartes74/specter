/**
 * Integracja: POST /api/standards/save
 * Validates: zapis standards.md oraz brak efektów ubocznych w trybie demo.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { POST } from '@/app/api/standards/save/route';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-standards-save-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/standards/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/standards/save', () => {
  it('zapisuje standards.md w katalogu projektu', async () => {
    const res = await POST(makeRequest({ projectPath: tmpDir, content: '# Standardy' }));
    expect(res.status).toBe(200);

    const content = await fs.readFile(path.join(tmpDir, 'standards.md'), 'utf-8');
    expect(content).toBe('# Standardy');
  });

  it('TRYB DEMO: nie zapisuje standards.md', async () => {
    const res = await POST(
      makeRequest({ projectPath: tmpDir, content: '# Demo' }, { 'x-demo-mode': 'true' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; demo: boolean };
    expect(body.success).toBe(true);
    expect(body.demo).toBe(true);

    const exists = await fs
      .access(path.join(tmpDir, 'standards.md'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });

  it('odrzuca pustą treść standards.md', async () => {
    const res = await POST(makeRequest({ projectPath: tmpDir, content: '   \n' }));
    expect(res.status).toBe(400);

    const exists = await fs
      .access(path.join(tmpDir, 'standards.md'))
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(false);
  });
});
