/**
 * Integracja: POST /api/generate/document
 * Validates: regeneracja dokumentu przez SSE w trybie demo.
 */
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/generate/document/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/generate/document', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

async function readSse(response: Response): Promise<unknown[]> {
  const text = await response.text();
  return text
    .split('\n\n')
    .filter(Boolean)
    .map((part) => part.split('\n').find((line) => line.startsWith('data: ')))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(6)) as unknown);
}

describe('POST /api/generate/document', () => {
  it('TRYB DEMO: streamuje regenerowany dokument i event done', async () => {
    const res = await POST(
      makeRequest(
        {
          documentType: 'requirements',
          mode: 'all',
          additionalInstructions: 'Dodaj sekcję bezpieczeństwa.',
          projectDescription: 'Aplikacja do zarządzania zadaniami zespołu i raportowania statusów.',
          answers: [],
          targetTool: 'codex',
          aiProvider: 'openai',
          aiModel: 'gpt-5-mini',
          apiKey: 'demo-key',
          standards: null,
          locale: 'pl',
        },
        { 'x-demo-mode': 'true' },
      ),
    );

    expect(res.status).toBe(200);
    const events = await readSse(res);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'progress', step: 'requirements' }),
        expect.objectContaining({ type: 'section_progress', document: 'requirements' }),
        expect.objectContaining({ type: 'document_complete', document: 'requirements' }),
        expect.objectContaining({ type: 'done' }),
      ]),
    );
  });
});
