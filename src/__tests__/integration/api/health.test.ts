/**
 * Integracja: GET /api/health
 * Validates: Wymaganie 18.4 (używany przez start.sh / start.bat)
 */
import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('zwraca ok=true, pid procesu i version', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; pid: number; uptimeSeconds: number; version: string };
    expect(body.ok).toBe(true);
    expect(body.pid).toBe(process.pid);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(typeof body.version).toBe('string');
  });
});
