/**
 * RecommendationService — rekomendacje narzędzia/modelu/sugestii (Zadanie 14.1).
 *
 * Wymagania: 4.2, 4.3, 5.2, 13.8
 *
 * Strategia: rekomendacje generowane przez AI z dedykowanym promptem zwracającym JSON.
 * Property 17: dla niepustego projectDescription serwis ZAWSZE zwraca rekomendację
 * narzędzia ORAZ modelu (z fallbackami gdy AI zawiedzie).
 */
import type { TargetTool } from '@/types/providers';
import { TARGET_TOOLS } from '@/types/providers';
import type { AppLocale, QuestionAnswer, DocumentSuggestion, Recommendation } from '@/types/session';
import { makeAdapter, type AIServiceConfig } from './AIService';
import type { ChatMessage } from './ai/types';
import { withRetry } from '@/lib/retry';
import { safeLog } from '@/lib/security';

export interface RecommendationContext {
  projectDescription: string;
  answers: QuestionAnswer[];
  standards?: string | null;
  locale: AppLocale;
}

const FALLBACK_TOOL: Record<AppLocale, Recommendation<TargetTool>> = {
  pl: {
    recommended: 'claude-code',
    reason: 'Claude Code dobrze radzi sobie z długim kontekstem i refaktoryzacją — bezpieczny domyślny wybór.',
    confidence: 'low',
  },
  en: {
    recommended: 'claude-code',
    reason: 'Claude Code handles long contexts and refactoring well — a safe default.',
    confidence: 'low',
  },
};

const FALLBACK_MODEL: Record<AppLocale, Recommendation<string>> = {
  pl: {
    recommended: 'gpt-5-mini',
    reason: 'GPT-5 mini oferuje dobry balans jakości, szybkości i kosztu.',
    confidence: 'low',
  },
  en: {
    recommended: 'gpt-5-mini',
    reason: 'GPT-5 mini offers a good balance of quality, speed, and cost.',
    confidence: 'low',
  },
};

/**
 * Rekomenduje narzędzie AI docelowe na podstawie opisu projektu.
 */
export async function recommendTool(
  config: AIServiceConfig,
  ctx: RecommendationContext,
): Promise<Recommendation<TargetTool>> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        ctx.locale === 'pl'
          ? 'Jesteś ekspertem od narzędzi AI dla programistów. Wybierasz najlepsze narzędzie pod konkretny projekt. Odpowiadasz tylko JSON.'
          : 'You are an expert on AI developer tools. You pick the best tool for a specific project. Respond with JSON only.',
    },
    {
      role: 'user',
      content: buildToolUserPrompt(ctx),
    },
  ];
  try {
    const adapter = makeAdapter(config);
    const raw = await withRetry(
      () => adapter.complete(messages, { temperature: 0.3, maxTokens: 500 }),
      undefined,
      (a, e) => safeLog.warn(`recommendTool retry ${a}:`, e.message),
    );
    return parseToolRecommendation(raw, ctx.locale);
  } catch (err) {
    safeLog.warn('recommendTool failed, fallback:', (err as Error).message);
    return FALLBACK_TOOL[ctx.locale];
  }
}

/**
 * Lokalna rekomendacja narzędzia, używana przed podaniem klucza API.
 * Daje użytkownikowi sensowną sugestię bez blokowania przepływu.
 */
export function recommendToolHeuristic(ctx: RecommendationContext): Recommendation<TargetTool> {
  const text = `${ctx.projectDescription}\n${ctx.answers.map((a) => a.answer).join('\n')}`.toLowerCase();
  if (/monorepo|refactor|legacy|duży|large|migration|migracja/.test(text)) {
    return {
      recommended: 'claude-code',
      reason:
        ctx.locale === 'pl'
          ? 'Claude Code jest dobrym wyborem przy długim kontekście, refaktoryzacjach i dużych repozytoriach.'
          : 'Claude Code is a strong fit for long context, refactors, and larger repositories.',
      confidence: 'medium',
    };
  }
  if (/github|copilot|pull request|pr |repo|repository/.test(text)) {
    return {
      recommended: 'copilot',
      reason:
        ctx.locale === 'pl'
          ? 'Copilot pasuje do pracy blisko GitHuba i codziennego przepływu pull requestów.'
          : 'Copilot fits GitHub-centered work and day-to-day pull request flows.',
      confidence: 'medium',
    };
  }
  if (/android|google|flutter|firebase|data|analytics|mobile/.test(text)) {
    return {
      recommended: 'gemini',
      reason:
        ctx.locale === 'pl'
          ? 'Gemini pasuje do projektów z ekosystemem Google, mobile i szerokim kontekstem danych.'
          : 'Gemini fits Google ecosystem, mobile, and broad data-context projects.',
      confidence: 'medium',
    };
  }
  if (/terminal|cli|agent|codex|skrypt|script|automation/.test(text)) {
    return {
      recommended: 'codex',
      reason:
        ctx.locale === 'pl'
          ? 'Codex dobrze pasuje do zadań kodowych, automatyzacji i pracy krok po kroku w repo.'
          : 'Codex fits coding tasks, automation, and step-by-step repo work.',
      confidence: 'medium',
    };
  }
  return FALLBACK_TOOL[ctx.locale];
}

/**
 * Rekomenduje model AI do generowania (uproszczone — wybór heurystyczny zależnie od długości kontekstu).
 * Odpowiedzi modelu nie potrzebujemy — heurystyka jest wystarczająco dobra.
 */
export function recommendModel(
  ctx: RecommendationContext,
): Recommendation<string> {
  const totalAnswerLength = ctx.answers.reduce((s, a) => s + a.answer.length, 0);
  const projectSize = ctx.projectDescription.length + totalAnswerLength;
  const hasStandards = !!ctx.standards && ctx.standards.length > 100;

  // Dla bardzo dużych kontekstów: Claude Sonnet (200k context)
  if (projectSize > 5000 || hasStandards) {
    return {
      recommended: 'claude-sonnet-4.6',
      reason:
        ctx.locale === 'pl'
          ? 'Claude Sonnet 4.6 ma bardzo długi kontekst i radzi sobie ze złożonymi specyfikacjami.'
          : 'Claude Sonnet 4.6 has a very long context window and handles complex specs well.',
      confidence: 'high',
    };
  }
  // Dla małych: szybszy model OpenAI albo Gemini Flash (taniej)
  if (projectSize < 1500) {
    return {
      recommended: 'gpt-5-mini',
      reason:
        ctx.locale === 'pl'
          ? 'GPT-5 mini jest szybki i tani dla niedużych projektów — dobry start.'
          : 'GPT-5 mini is fast and inexpensive for small projects — a good starting point.',
      confidence: 'medium',
    };
  }
  // Domyślnie: zbalansowany GPT-4o
  return FALLBACK_MODEL[ctx.locale];
}

/**
 * Generuje listę sugestii AI dla wygenerowanego dokumentu (Wymaganie 13.8).
 */
export async function analyzeDocument(
  config: AIServiceConfig,
  documentType: 'requirements' | 'design' | 'tasks',
  content: string,
  locale: AppLocale,
): Promise<DocumentSuggestion[]> {
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content:
        locale === 'pl'
          ? 'Jesteś recenzentem specyfikacji technicznych. Identyfikujesz braki i sugerujesz konkretne ulepszenia. Odpowiadasz tylko JSON.'
          : 'You are a technical spec reviewer. You identify gaps and suggest concrete improvements. Respond with JSON only.',
    },
    {
      role: 'user',
      content: buildDocumentSuggestionsPrompt(documentType, content, locale),
    },
  ];
  try {
    const adapter = makeAdapter(config);
    const raw = await withRetry(
      () => adapter.complete(messages, { temperature: 0.3, maxTokens: 1500 }),
      undefined,
      (a, e) => safeLog.warn(`analyzeDocument retry ${a}:`, e.message),
    );
    return parseDocumentSuggestions(raw, documentType);
  } catch (err) {
    safeLog.warn('analyzeDocument failed, returning []:', (err as Error).message);
    return [];
  }
}

// --- Helpery promptów ---

function buildToolUserPrompt(ctx: RecommendationContext): string {
  const tools = TARGET_TOOLS.join(', ');
  const answers = ctx.answers
    .filter((a) => !a.skipped && a.answer.trim())
    .map((a) => `- (${a.questionId}) ${a.answer}`)
    .join('\n');
  return ctx.locale === 'pl'
    ? `Opis projektu:
"""
${ctx.projectDescription}
"""

${answers ? `Odpowiedzi na pytania:\n${answers}\n` : ''}

Dostępne narzędzia: ${tools}

Wybierz JEDNO najlepsze narzędzie i krótko (1 zdanie) uzasadnij dlaczego pasuje do tego projektu.

Zwróć JSON:
{ "recommended": "<jedno z: ${tools}>", "reason": "<1 zdanie>", "confidence": "low|medium|high" }`
    : `Project description:
"""
${ctx.projectDescription}
"""

${answers ? `Answers:\n${answers}\n` : ''}

Available tools: ${tools}

Pick ONE best tool and briefly (1 sentence) justify why it fits this project.

Return JSON:
{ "recommended": "<one of: ${tools}>", "reason": "<1 sentence>", "confidence": "low|medium|high" }`;
}

function buildDocumentSuggestionsPrompt(
  documentType: string,
  content: string,
  locale: AppLocale,
): string {
  return locale === 'pl'
    ? `Przeanalizuj poniższy dokument ${documentType}.md i zidentyfikuj 0-2 najważniejsze braki.

Zasady:
- Sugestia ma dotyczyć decyzji biznesowej, brakujących danych, ryzyka produktowego albo kryteriów akceptacji.
- Nie sugeruj poprawek stylistycznych, ogólnych "warto doprecyzować" ani dodawania kolejnych sekcji bez konkretnej potrzeby.
- Jeśli temat jest już opisany w dokumencie, nie zgłaszaj go ponownie.
- Jeśli dokument jest wystarczająco użyteczny dla osoby biznesowej, zwróć pustą listę.

Dokument:
"""
${content}
"""

Dla każdej sugestii podaj:
- severity: "info" | "warning" | "critical"
- message: krótki opis problemu (1 zdanie po polsku)
- suggestedAction: co zrobić po akceptacji (1 zdanie po polsku)
- sectionAnchor: nagłówek dotkniętej sekcji (np. "## Wymaganie 5") lub null

Zwróć JSON: { "suggestions": [...] }
Jeśli dokument jest kompletny — zwróć pustą listę.`
    : `Analyze the ${documentType}.md document below and identify 0-2 most important gaps.

Rules:
- Suggestions must concern a business decision, missing data, product risk, or acceptance criteria.
- Do not suggest style tweaks, generic "clarify this" comments, or adding more sections without a concrete need.
- If the topic is already covered in the document, do not raise it again.
- If the document is useful enough for a business stakeholder, return an empty list.

Document:
"""
${content}
"""

For each suggestion provide:
- severity: "info" | "warning" | "critical"
- message: short problem description (1 sentence in English)
- suggestedAction: what to do on accept (1 sentence in English)
- sectionAnchor: heading of the affected section (e.g. "## Requirement 5") or null

Return JSON: { "suggestions": [...] }
If the document is complete — return an empty list.`;
}

// --- Parsery ---

export function parseToolRecommendation(
  raw: string,
  locale: AppLocale,
): Recommendation<TargetTool> {
  try {
    const obj = extractJsonObject(raw);
    if (!obj) return FALLBACK_TOOL[locale];
    const recommended = (obj as { recommended?: unknown }).recommended;
    const reason = (obj as { reason?: unknown }).reason;
    const confidence = (obj as { confidence?: unknown }).confidence;
    if (
      typeof recommended === 'string' &&
      (TARGET_TOOLS as readonly string[]).includes(recommended) &&
      typeof reason === 'string' &&
      reason.trim().length > 0
    ) {
      return {
        recommended: recommended as TargetTool,
        reason: reason.trim(),
        confidence: confidence === 'high' || confidence === 'medium' ? confidence : 'low',
      };
    }
  } catch {
    // fallback below
  }
  return FALLBACK_TOOL[locale];
}

export function parseDocumentSuggestions(
  raw: string,
  documentType: 'requirements' | 'design' | 'tasks',
): DocumentSuggestion[] {
  try {
    const obj = extractJsonObject(raw);
    if (!obj) return [];
    const list = (obj as { suggestions?: unknown }).suggestions;
    if (!Array.isArray(list)) return [];
    return list
      .map((s, i): DocumentSuggestion | null => {
        if (!s || typeof s !== 'object') return null;
        const r = s as Record<string, unknown>;
        const message = typeof r.message === 'string' ? r.message.trim() : '';
        const action = typeof r.suggestedAction === 'string' ? r.suggestedAction.trim() : '';
        if (message.length === 0) return null;
        const severity =
          r.severity === 'warning' || r.severity === 'critical' ? r.severity : 'info';
        return {
          id: `sugg-${documentType}-${i + 1}`,
          documentType,
          severity,
          message,
          suggestedAction: action || message,
          ...(typeof r.sectionAnchor === 'string' && r.sectionAnchor.length > 0
            ? { sectionAnchor: r.sectionAnchor }
            : {}),
        };
      })
      .filter((s): s is DocumentSuggestion => s !== null)
      .slice(0, 2);
  } catch {
    return [];
  }
}

function extractJsonObject(raw: string): unknown {
  if (!raw || raw.trim().length === 0) return null;
  // Wytnij ewentualne ```json ... ```
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? raw).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const objMatch = candidate.match(/\{[\s\S]*\}/);
    if (!objMatch?.[0]) return null;
    try {
      return JSON.parse(objMatch[0]);
    } catch {
      return null;
    }
  }
}

// Eksport fallbacków dla testów
export const _internal = { FALLBACK_TOOL, FALLBACK_MODEL };
