/**
 * Integracja: POST /api/questions (tylko tryb demo — bez prawdziwych wywołań AI)
 * Validates: Wymagania 3.1, 3.3, 17.6
 */
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/questions/route';

function makeRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/questions (demo mode)', () => {
  it('zwraca 4 polskie pytania w trybie demo', async () => {
    const res = await POST(
      makeRequest(
        {
          projectDescription: 'a'.repeat(100),
          locale: 'pl',
          aiProvider: 'openai',
          aiModel: 'gpt-5-mini',
          apiKey: 'demo-openai-key',
        },
        { 'x-demo-mode': 'true' },
      ),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      questions: { id: string; text: string; suggestedAnswers?: unknown[] }[];
    };
    expect(body.questions).toHaveLength(4);
    expect(body.questions[0]!.text).toContain('użytkownikiem');
    expect(body.questions[0]!.suggestedAnswers?.length).toBeGreaterThan(0);
  });

  it('zwraca 4 angielskie pytania w trybie demo', async () => {
    const res = await POST(
      makeRequest(
        {
          projectDescription: 'a'.repeat(100),
          locale: 'en',
          aiProvider: 'anthropic',
          aiModel: 'claude-sonnet-4-6',
          apiKey: 'sk-ant-fake',
        },
        { 'x-demo-mode': 'true' },
      ),
    );
    const body = (await res.json()) as { questions: { text: string }[] };
    expect(body.questions[0]!.text).toContain('user');
  });

  it('zwraca 400 dla zbyt krótkiego opisu', async () => {
    const res = await POST(
      makeRequest(
        {
          projectDescription: 'krótki', // < 20
          locale: 'pl',
          aiProvider: 'openai',
          aiModel: 'gpt-5-mini',
          apiKey: 'sk-x',
        },
        { 'x-demo-mode': 'true' },
      ),
    );
    expect(res.status).toBe(400);
  });

  it('bez klucza API zwraca pytania heurystyczne z suggestedAnswers', async () => {
    const res = await POST(
      makeRequest({
        projectDescription: 'Aplikacja do planowania pracy zespołu z dashboardem i eksportem raportów.',
        locale: 'pl',
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      source: string;
      questions: { suggestedAnswers?: { id: string; label: string; value: string }[] }[];
    };
    expect(body.source).toBe('heuristic');
    expect(body.questions.length).toBeGreaterThanOrEqual(3);
    expect(body.questions[0]!.suggestedAnswers?.[0]).toEqual(
      expect.objectContaining({ id: expect.any(String), label: expect.any(String), value: expect.any(String) }),
    );
  });
});
