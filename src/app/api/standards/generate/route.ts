/**
 * POST /api/standards/generate — Generator standardów (SSE).
 *
 * Wymagania: 15.4
 *
 * W trybie demo: stream-uje statyczny przykład (bez wywołania AI, bez zapisu).
 */
import {
  generateStandards,
  getProfile,
} from '@/services/StandardsGeneratorService';
import {
  parseBody,
  isDemoMode,
  createSSEStream,
  type SSEEvent,
} from '@/lib/api-helpers';
import { generateStandardsSchema, type GenerateStandardsInput } from '@/lib/api-schemas';
import { safeLog } from '@/lib/security';
import { AIAdapterError } from '@/services/ai/types';

export const dynamic = 'force-dynamic';

const DEMO_FIXTURE = {
  pl: `# Standardy projektu (Tryb Demo)

## Architektura
- Trzymaj logikę domenową w warstwie niezależnej od framework'a.
- Komunikacja przez interfejsy, nie konkretne implementacje.

## Bezpieczeństwo
- Nigdy nie commituj sekretów do repo (.env w .gitignore).
- Wszystkie inputy walidowane na serwerze (zod / yup / pydantic).

## Testowanie
- Testy jednostkowe dla logiki biznesowej (cel pokrycia ≥ 80%).
- Testy integracyjne dla każdego endpointu API.
- Testy E2E dla krytycznych ścieżek użytkownika.

## Jakość kodu
- Linter (eslint / ruff) i formatter (prettier / black) w pre-commit hook.
- Code review dla każdego PR przez przynajmniej jedną osobę.

## Dokumentacja
- README z instrukcją uruchomienia w 3 krokach.
- ADR (Architecture Decision Records) dla każdej znaczącej decyzji.

## CI/CD
- Pipeline na każdy PR: lint → test → build → security scan.
- Deploy na środowisko stage tylko z main, na prod tylko z taga.

## Dostępność (a11y)
- WCAG 2.1 AA jako minimum.
- Wszystkie interaktywne elementy dostępne z klawiatury.

## Wydajność
- Pierwsze ładowanie strony < 3s na 3G.
- Time to Interactive < 5s.
`,
  en: `# Project standards (Demo Mode)

## Architecture
- Keep domain logic in a layer independent of the framework.
- Communicate through interfaces, not concrete implementations.

## Security
- Never commit secrets to the repo (.env in .gitignore).
- Validate all inputs on the server (zod / yup / pydantic).

## Testing
- Unit tests for business logic (coverage target ≥ 80%).
- Integration tests for every API endpoint.
- E2E tests for critical user paths.

## Code quality
- Linter (eslint / ruff) and formatter (prettier / black) in pre-commit hook.
- Code review for every PR by at least one person.

## Documentation
- README with a 3-step run guide.
- ADRs (Architecture Decision Records) for every significant decision.

## CI/CD
- Pipeline on every PR: lint → test → build → security scan.
- Deploy to stage only from main, to prod only from a tag.

## Accessibility (a11y)
- WCAG 2.1 AA as a minimum.
- All interactive elements reachable by keyboard.

## Performance
- First page load < 3s on 3G.
- Time to Interactive < 5s.
`,
};

export async function POST(req: Request) {
  const parsed = await parseBody(req, generateStandardsSchema);
  if (parsed.error) return parsed.error;

  const sse = createSSEStream();
  const demo = isDemoMode(req);
  const input = parsed.data;

  void runStandardsPipeline({ sse, demo, input }).catch((err) => {
    safeLog.error('[/api/standards/generate] failed:', err);
  });

  return sse.response;
}

async function runStandardsPipeline(args: {
  sse: ReturnType<typeof createSSEStream>;
  demo: boolean;
  input: GenerateStandardsInput;
}): Promise<void> {
  const { sse, demo, input } = args;
  const send = (e: SSEEvent) => sse.send(e);

  try {
    send({
      type: 'progress',
      step: 'standards',
      message: input.locale === 'pl' ? 'Generuję standardy…' : 'Generating standards…',
    });

    let full = '';

    if (demo) {
      const fixture = DEMO_FIXTURE[input.locale];
      const chunkSize = 80;
      for (let i = 0; i < fixture.length; i += chunkSize) {
        const chunk = fixture.slice(i, i + chunkSize);
        full += chunk;
        send({ type: 'content', document: 'standards', chunk });
        await sleep(15);
      }
    } else {
      const apiKey = input.apiKey?.trim();
      if (!apiKey) {
        send({
          type: 'error',
          code: 'AUTH_ERROR',
          message:
            input.locale === 'pl'
              ? 'Brakuje klucza API. Wróć do wyboru modelu i wklej klucz ponownie.'
              : 'Missing API key. Go back to model selection and paste the key again.',
          retryable: false,
        });
        return;
      }

      // Walidacja istnienia profilu (lepszy błąd niż AI hallucination)
      const profile = await getProfile(input.profileId);
      if (!profile) {
        send({
          type: 'error',
          code: 'PROFILE_NOT_FOUND',
          message: `Profile not found: ${input.profileId}`,
          retryable: false,
        });
        return;
      }
      full = await generateStandards(
        input.profileId,
        input.followUpAnswers,
        {
          provider: input.aiProvider,
          modelId: input.aiModel,
          apiKey,
        },
        input.locale,
        (chunk) => send({ type: 'content', document: 'standards', chunk }),
      );
    }

    send({ type: 'document_complete', document: 'standards', fullContent: full });
    send({ type: 'done', documents: { standards: full } });
  } catch (err) {
    if (err instanceof AIAdapterError) {
      send({ type: 'error', code: err.code, message: err.message, retryable: err.retryable });
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
