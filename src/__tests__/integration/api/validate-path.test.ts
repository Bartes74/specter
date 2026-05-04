/**
 * Integracja: POST /api/validate/path
 * Validates: Wymagania 1.7-1.10, 6.1, 17.7 (tryb demo no-op)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import { POST } from '@/app/api/validate/path/route';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-api-validate-'));
});
afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/validate/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/validate/path', () => {
  it('zwraca valid=true dla istniejącego folderu', async () => {
    const res = await POST(makeRequest({ projectPath: tmpDir }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { valid: boolean; exists: boolean; writable: boolean };
    expect(body.valid).toBe(true);
    expect(body.exists).toBe(true);
    expect(body.writable).toBe(true);
  });

  it('zwraca valid=false dla nieistniejącego folderu', async () => {
    const res = await POST(makeRequest({ projectPath: '/nope/does/not/exist/xyz123' }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { valid: boolean; error: string };
    expect(body.valid).toBe(false);
    expect(body.error).toBe('path.notFound');
  });

  it('zwraca 400 gdy body nie pasuje do schematu', async () => {
    const res = await POST(makeRequest({ wrong: 'field' }));
    expect(res.status).toBe(400);
  });

  it('ensureDocs=true tworzy katalog /docs dopiero przy finalnej walidacji', async () => {
    const res = await POST(makeRequest({ projectPath: tmpDir, ensureDocs: true }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { valid: boolean };
    expect(body.valid).toBe(true);

    const docsExists = await fs
      .access(path.join(tmpDir, 'docs'))
      .then(() => true)
      .catch(() => false);
    expect(docsExists).toBe(true);
  });

  it('w trybie demo zwraca valid=true bez dotykania FS', async () => {
    const res = await POST(
      makeRequest({ projectPath: '/totally/fake/demo/path/123' }, { 'x-demo-mode': 'true' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { valid: boolean };
    expect(body.valid).toBe(true);
  });
});
