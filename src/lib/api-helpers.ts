/**
 * Helpery wspólne dla API Routes — walidacja inputu, SSE, tryb demo.
 */
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { sanitizeLogs } from './security';

/**
 * Nagłówek wysyłany przez klienta gdy wizard działa w trybie demo.
 * API operujące na FS sprawdzają go i no-opują (Wymaganie 17.7, 17.9).
 */
export const DEMO_MODE_HEADER = 'x-demo-mode';

export function isDemoMode(req: Request): boolean {
  return req.headers.get(DEMO_MODE_HEADER) === 'true';
}

/**
 * Standardowa odpowiedź błędu — zsanityzowana, w formacie zgodnym z Profilem_Błędu.
 */
export function errorResponse(
  status: number,
  code: string,
  message: string,
  extras?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: { code, message: sanitizeLogs(message), ...extras } },
    { status },
  );
}

/**
 * Parsuje JSON body żądania z walidacją zod. Zwraca either {data} lub {error}.
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      error: errorResponse(400, 'BODY_INVALID_JSON', 'Body must be valid JSON'),
    };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      error: errorResponse(400, 'BODY_VALIDATION_FAILED', 'Body did not match expected schema', {
        issues: parsed.error.issues,
      }),
    };
  }
  return { data: parsed.data };
}

// --- SSE (Server-Sent Events) ---

/**
 * Typ event-u SSE dla generowania dokumentów (Wymaganie 7.1, 8.1, 9.1).
 */
export type SSEEvent =
  | { type: 'progress'; step: string; message: string }
  | {
      type: 'content';
      document: 'requirements' | 'design' | 'tasks' | 'standards';
      chunk: string;
    }
  | {
      type: 'document_complete';
      document: 'requirements' | 'design' | 'tasks' | 'standards';
      fullContent: string;
    }
  | { type: 'error'; code: string; message: string; retryable: boolean }
  | { type: 'done'; documents?: Record<string, string> };

export interface SSEStream {
  send(event: SSEEvent): void;
  close(): void;
  readonly response: Response;
}

/**
 * Tworzy odpowiedź SSE zwracającą Response oraz bramkę do wysyłania eventów.
 * Klient czyta przez `EventSource` lub `fetch + ReadableStream`.
 */
export function createSSEStream(): SSEStream {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
    cancel() {
      closed = true;
    },
  });

  const send = (event: SSEEvent) => {
    if (closed || !controllerRef) return;
    const sanitized = sanitizeEvent(event);
    const data = `data: ${JSON.stringify(sanitized)}\n\n`;
    try {
      controllerRef.enqueue(encoder.encode(data));
    } catch {
      closed = true;
    }
  };

  const close = () => {
    if (closed || !controllerRef) return;
    try {
      controllerRef.close();
    } catch {
      // już zamknięty
    }
    closed = true;
  };

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });

  return { send, close, response };
}

function sanitizeEvent(event: SSEEvent): SSEEvent {
  // Sanityzujemy treść stringową (chunk, message) — gdyby przypadkiem trafił klucz API
  if (event.type === 'content') {
    return { ...event, chunk: sanitizeLogs(event.chunk) };
  }
  if (event.type === 'document_complete') {
    return { ...event, fullContent: sanitizeLogs(event.fullContent) };
  }
  if (event.type === 'progress') {
    return { ...event, message: sanitizeLogs(event.message) };
  }
  if (event.type === 'error') {
    return { ...event, message: sanitizeLogs(event.message) };
  }
  return event;
}
