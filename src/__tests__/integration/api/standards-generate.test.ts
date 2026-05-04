/**
 * Integracja: POST /api/standards/generate
 * Validates: demo bez klucza API oraz czytelny błąd przy utraconym kluczu.
 */
import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/standards/generate/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/standards/generate', {
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

const VALID_BODY = {
  profileId: 'webapp-react',
  profileName: 'Aplikacja webowa (React/Next.js)',
  followUpAnswers: [
    { questionId: 'routing', answer: 'Next.js App Router', skipped: false },
    { questionId: 'state-management', answer: 'React state', skipped: false },
  ],
  locale: 'pl',
  aiProvider: 'openai',
  aiModel: 'gpt-5-mini',
};

describe('POST /api/standards/generate', () => {
  it('TRYB DEMO: generuje standards.md bez klucza API w body', async () => {
    const res = await POST(
      makeRequest(
        { ...VALID_BODY, demo: true },
        { 'x-demo-mode': 'true' },
      ),
    );

    expect(res.status).toBe(200);
    const events = await readSse(res);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'progress', step: 'standards' }),
        expect.objectContaining({ type: 'document_complete', document: 'standards' }),
        expect.objectContaining({ type: 'done' }),
      ]),
    );
  });

  it('zwraca czytelny event AUTH_ERROR, gdy klucz API zniknął po odświeżeniu', async () => {
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const events = await readSse(res);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'error',
          code: 'AUTH_ERROR',
          message: expect.stringContaining('Brakuje klucza API'),
        }),
      ]),
    );
  });
});
