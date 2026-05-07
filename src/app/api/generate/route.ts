/**
 * POST /api/generate — generowanie 3 dokumentów ze streamingiem SSE
 * (Wymagania 7.1, 8.1, 8.4, 9.1, 11.6, 12.1, 12.2).
 *
 * Sekwencja: requirements → design (z kontekstem requirements) → tasks (z kontekstem requirements + design).
 * Property 6: kontekst sekwencyjny — każdy kolejny dokument otrzymuje wcześniejsze.
 *
 * W trybie demo używa mock-scenariusza zamiast prawdziwych wywołań AI.
 */
import { generateDocumentRobust } from '@/services/AIService';
import {
  parseBody,
  isDemoMode,
  createSSEStream,
  type SSEEvent,
} from '@/lib/api-helpers';
import { generateSchema, type GenerateInput } from '@/lib/api-schemas';
import { safeLog } from '@/lib/security';
import { AIAdapterError } from '@/services/ai/types';
import type { DocumentType } from '@/services/PromptTemplateService';

export const dynamic = 'force-dynamic';

const DEMO_FIXTURE = {
  pl: {
    requirements:
      '# Wymagania (Tryb Demo)\n\n## Wprowadzenie\nPrzykładowa aplikacja webowa dla zespołu.\n\n## Słownik\n- **Aplikacja**: System do zarządzania zadaniami\n\n## Wymagania\n\n### Wymaganie 1: Logowanie\n**User Story:** Jako użytkownik chcę się zalogować aby uzyskać dostęp.\n\n#### Kryteria Akceptacji\n1. Aplikacja SHALL wyświetlić formularz logowania.\n2. Aplikacja SHALL walidować email.\n3. Aplikacja SHALL przechowywać sesję.',
    design:
      '# Projekt (Tryb Demo)\n\n## Przegląd\nNext.js + PostgreSQL.\n\n## Architektura\n```mermaid\ngraph TD\n  Client --> API\n  API --> DB\n```\n\n## Komponenty\n- LoginForm\n- SessionStore\n\n## Modele danych\n```ts\ninterface User { id: string; email: string }\n```\n\n## Decyzje projektowe\n- Sesje JWT (krótka żywotność, refresh tokens)',
    tasks:
      '# Plan zadań (Tryb Demo)\n\n## Przegląd\nKolejność implementacji od backendu do UI.\n\n## Zadania\n\n- [ ] 1. Schemat bazy danych\n  - Tabela users z polami id, email, password_hash\n  - _Wymagania: 1.1, 1.2_\n- [ ] 2. Endpoint /api/login\n  - Walidacja email + bcrypt\n  - _Wymagania: 1.2, 1.3_\n- [ ] 3. Komponent LoginForm\n  - Pole email + hasło + przycisk\n  - _Wymagania: 1.1_',
  },
  en: {
    requirements:
      '# Requirements (Demo Mode)\n\n## Introduction\nSample team-collaboration web app.\n\n## Glossary\n- **App**: Task management system\n\n## Requirements\n\n### Requirement 1: Login\n**User Story:** As a user I want to log in to access the app.\n\n#### Acceptance Criteria\n1. The App SHALL display a login form.\n2. The App SHALL validate the email.\n3. The App SHALL persist the session.',
    design:
      '# Design (Demo Mode)\n\n## Overview\nNext.js + PostgreSQL.\n\n## Architecture\n```mermaid\ngraph TD\n  Client --> API\n  API --> DB\n```\n\n## Components\n- LoginForm\n- SessionStore\n\n## Data models\n```ts\ninterface User { id: string; email: string }\n```\n\n## Design decisions\n- JWT sessions (short-lived + refresh tokens)',
    tasks:
      '# Task plan (Demo Mode)\n\n## Overview\nBackend-first then UI.\n\n## Tasks\n\n- [ ] 1. Database schema\n  - users table with id, email, password_hash\n  - _Requirements: 1.1, 1.2_\n- [ ] 2. /api/login endpoint\n  - Validate email + bcrypt\n  - _Requirements: 1.2, 1.3_\n- [ ] 3. LoginForm component\n  - Email + password + submit\n  - _Requirements: 1.1_',
  },
};

const DOCUMENTS: ReadonlyArray<DocumentType> = ['requirements', 'design', 'tasks'];

export async function POST(req: Request) {
  const parsed = await parseBody(req, generateSchema);
  if (parsed.error) return parsed.error;

  const abortController = new AbortController();
  req.signal.addEventListener('abort', () => abortController.abort(), { once: true });
  const sse = createSSEStream({ onCancel: () => abortController.abort() });
  const demo = isDemoMode(req);
  const input = parsed.data;

  // Uruchom generowanie w tle (nie blokujemy zwrócenia Response)
  void runPipeline({ sse, demo, input, signal: abortController.signal }).catch((err) => {
    safeLog.error('[/api/generate] pipeline failed:', err);
  });

  return sse.response;
}

async function runPipeline(args: {
  sse: ReturnType<typeof createSSEStream>;
  demo: boolean;
  input: GenerateInput;
  signal: AbortSignal;
}): Promise<void> {
  const { sse, demo, input, signal } = args;
  const send = (e: SSEEvent) => sse.send(e);

  const accumulated: Record<DocumentType, string> = {
    requirements: '',
    design: '',
    tasks: '',
  };

  try {
    for (const docType of DOCUMENTS) {
      if (signal.aborted) return;
      send({
        type: 'progress',
        step: docType,
        message: `Generuję ${docType}.md`,
      });

      let full = '';

      if (demo) {
        // Tryb demo: stream-uj fixture w kawałkach, żeby UI poczuł "produkcyjny" feel
        const fixture = DEMO_FIXTURE[input.locale][docType];
        send({
          type: 'section_progress',
          document: docType,
          sectionId: 'demo-section',
          sectionTitle: docType,
          index: 1,
          total: 1,
          status: 'generating',
        });
        for (const chunk of streamFixture(fixture)) {
          if (signal.aborted) return;
          full += chunk;
          send({ type: 'content', document: docType, chunk });
          await sleep(20);
        }
        send({
          type: 'section_progress',
          document: docType,
          sectionId: 'demo-section',
          sectionTitle: docType,
          index: 1,
          total: 1,
          status: 'complete',
        });
      } else {
        full = await generateDocumentRobust(
          {
            provider: input.aiProvider,
            modelId: input.aiModel,
            apiKey: input.apiKey,
          },
          docType,
          {
            projectDescription: input.projectDescription,
            answers: input.answers,
            standards: input.standards ?? null,
            targetTool: input.targetTool,
            locale: input.locale,
            // Property 6: kontekst sekwencyjny
            previousDocuments:
              docType === 'design'
                ? { requirements: accumulated.requirements }
                : docType === 'tasks'
                  ? {
                      requirements: accumulated.requirements,
                      design: accumulated.design,
                    }
                  : undefined,
          },
          {
            onSectionProgress: (progress) => send({ type: 'section_progress', ...progress }),
            onSectionComplete: (document, chunk) => send({ type: 'content', document, chunk }),
            signal,
          },
        );
      }

      accumulated[docType] = full;
      send({ type: 'document_complete', document: docType, fullContent: full });
    }

    send({
      type: 'done',
      documents: { ...accumulated },
    });
  } catch (err) {
    if (signal.aborted) {
      return;
    }
    if (err instanceof AIAdapterError) {
      send({
        type: 'error',
        code: err.code,
        message: err.message,
        retryable: err.retryable,
      });
    } else {
      send({
        type: 'error',
        code: 'UNKNOWN',
        message: (err as Error).message,
        retryable: false,
      });
    }
  } finally {
    sse.close();
  }
}

/**
 * Dzieli fixture na kawałki, żeby symulować streaming w trybie demo.
 */
function* streamFixture(text: string): Generator<string> {
  const chunkSize = 60;
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
