/**
 * Funkcje maskowania i sanityzacji kluczy API (Zadanie 2.4).
 *
 * Property 11: Maskowanie kluczy API — zwraca ciąg, w którym wszystkie znaki
 *              oprócz ostatnich 4 są zastąpione znakiem maskującym.
 * Property 12: Sanityzacja logów — usuwa lub maskuje wzorce kluczy 4 dostawców
 *              (OpenAI sk-..., Anthropic sk-ant-..., Google AIza..., GitHub ghp_/github_pat_/gho_/...).
 *
 * Wszystkie funkcje są pure — bez I/O, bez zależności od stanu.
 */

const MASK_CHAR = '•';

/**
 * Maskuje klucz API zostawiając tylko ostatnie `visibleSuffix` znaków.
 * Wymaganie 14.2, Property 11.
 *
 * @example
 *   maskApiKey('sk-1234567890abcd') → '••••••••••••abcd'
 *   maskApiKey('xy')                → '••' (jeśli krótszy niż próg, maskujemy całość)
 */
export function maskApiKey(key: unknown, visibleSuffix = 4): string {
  if (typeof key !== 'string') return '';
  if (key.length === 0) return '';
  if (key.length <= visibleSuffix) {
    // Zbyt krótki, żeby pokazać 4 znaki bez ujawniania niemal całego klucza —
    // maskujemy całość.
    return MASK_CHAR.repeat(key.length);
  }
  const masked = MASK_CHAR.repeat(key.length - visibleSuffix);
  return masked + key.slice(-visibleSuffix);
}

/**
 * Wzorce kluczy API 4 dostawców — używane przez sanitizeLogs.
 * Każdy wzorzec celuje w prefiks + dostatecznie długą część losową, żeby nie
 * łapać przypadkowych słów typu "sk-" w innych kontekstach.
 *
 * Aktualizowane razem z dostawcami w `src/types/providers.ts`.
 */
const API_KEY_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  // Anthropic najpierw, bo `sk-ant-` to nadzbiór `sk-`
  { name: 'anthropic', pattern: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { name: 'openai',    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g },
  { name: 'google',    pattern: /AIza[A-Za-z0-9_-]{20,}/g },
  // GitHub: ghp_, gho_, ghu_, ghs_ + github_pat_
  { name: 'github-token', pattern: /(?:ghp|gho|ghu|ghs)_[A-Za-z0-9]{20,}/g },
  { name: 'github-pat',   pattern: /github_pat_[A-Za-z0-9_]{20,}/g },
];

/**
 * Sanityzuje dowolny tekst, zastępując wykryte klucze API placeholderem.
 * Wymaganie 14.5, Property 12.
 *
 * Funkcja jest idempotentna: drugie wywołanie na zsanityzowanym tekście nic nie zmienia.
 *
 * @example
 *   sanitizeLogs('Klucz: sk-abc123...xyz') → 'Klucz: [REDACTED:openai]'
 */
export function sanitizeLogs(input: unknown): string {
  if (typeof input !== 'string') return '';
  let result = input;
  for (const { name, pattern } of API_KEY_PATTERNS) {
    result = result.replace(pattern, `[REDACTED:${name}]`);
  }
  return result;
}

/**
 * Wrapper na console.log/warn/error/debug — używaj wszędzie, gdzie logujesz coś,
 * co MOŻE zawierać klucz API (request body, error message z fetcha, response headers).
 *
 * @example
 *   safeLog.error('Auth failed for', { headers: req.headers });
 */
export const safeLog = {
  log: (...args: unknown[]) => console.log(...args.map((a) => sanitizeArg(a))),
  warn: (...args: unknown[]) => console.warn(...args.map((a) => sanitizeArg(a))),
  error: (...args: unknown[]) => console.error(...args.map((a) => sanitizeArg(a))),
  debug: (...args: unknown[]) => console.debug(...args.map((a) => sanitizeArg(a))),
};

function sanitizeArg(arg: unknown): unknown {
  if (typeof arg === 'string') return sanitizeLogs(arg);
  if (arg instanceof Error) {
    const e = new Error(sanitizeLogs(arg.message));
    e.stack = arg.stack ? sanitizeLogs(arg.stack) : undefined;
    return e;
  }
  if (arg && typeof arg === 'object') {
    try {
      return JSON.parse(sanitizeLogs(JSON.stringify(arg)));
    } catch {
      return '[unserializable]';
    }
  }
  return arg;
}
