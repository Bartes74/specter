/**
 * Integracja: POST /api/generate (SSE) — tylko tryb demo, bez prawdziwych wywołań AI.
 * Validates: Wymagania 7.1, 8.1, 9.1, 11.6, 17.6
 *
 * Sprawdzamy: stream SSE emituje progress → content → document_complete dla 3 dokumentów,
 * a na końcu event 'done' z 3 pełnymi treściami.
 */
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/generate/route';
import type { SSEEvent } from '@/lib/api-helpers';

function makeRequest(body: unknown, demo = true): Request {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(demo ? { 'x-demo-mode': 'true' } : {}),
    },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  projectPath: '/tmp/test',
  projectDescription: 'a'.repeat(100),
  answers: [],
  targetTool: 'claude-code' as const,
  aiProvider: 'openai' as const,
  aiModel: 'gpt-4o',
  apiKey: 'sk-test',
  standards: null,
  locale: 'pl' as const,
};

async function consumeSSE(res: Response): Promise<SSEEvent[]> {
  const body = res.body;
  if (!body) throw new Error('No response body');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: SSEEvent[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.replace(/^data: /, '').trim();
      if (line.length === 0) continue;
      events.push(JSON.parse(line) as SSEEvent);
    }
  }
  return events;
}

describe('POST /api/generate (SSE, demo)', () => {
  it('strumieniuje 3 dokumenty: requirements → design → tasks → done', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const events = await consumeSSE(res);

    // Co najmniej 3 progress + 3 document_complete + 1 done
    const progress = events.filter((e) => e.type === 'progress');
    const completes = events.filter((e) => e.type === 'document_complete');
    const dones = events.filter((e) => e.type === 'done');
    const contents = events.filter((e) => e.type === 'content');
    const sectionProgress = events.filter((e) => e.type === 'section_progress');

    expect(progress.length).toBe(3);
    expect(sectionProgress.length).toBeGreaterThanOrEqual(3);
    expect(completes.length).toBe(3);
    expect(dones.length).toBe(1);
    expect(contents.length).toBeGreaterThan(0);

    // Sprawdź sekwencję progress
    expect(progress.map((e) => (e.type === 'progress' ? e.step : ''))).toEqual([
      'requirements',
      'design',
      'tasks',
    ]);

    expect(sectionProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'section_progress',
          document: 'requirements',
          sectionId: 'demo-section',
        }),
      ]),
    );

    // Każdy document_complete ma niepustą treść
    for (const ev of completes) {
      if (ev.type === 'document_complete') {
        expect(ev.fullContent.length).toBeGreaterThan(50);
      }
    }

    // Done event zawiera wszystkie 3 dokumenty
    const doneEvent = dones[0]!;
    if (doneEvent.type === 'done') {
      expect(Object.keys(doneEvent.documents ?? {})).toEqual(
        expect.arrayContaining(['requirements', 'design', 'tasks']),
      );
    }
  });

  it('zwraca 400 gdy body niepoprawne (brak wymaganych pól)', async () => {
    const res = await POST(makeRequest({ wrong: 'shape' }));
    expect(res.status).toBe(400);
  });

  it('locale=en w demo zwraca dokumenty po angielsku', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, locale: 'en' }));
    const events = await consumeSSE(res);
    const completes = events.filter((e) => e.type === 'document_complete');
    const reqDoc = completes.find((e) => e.type === 'document_complete' && e.document === 'requirements');
    expect(reqDoc).toBeDefined();
    if (reqDoc?.type === 'document_complete') {
      expect(reqDoc.fullContent).toContain('Requirements');
    }
  });
});
