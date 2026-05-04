/**
 * Chunking (Zadanie 4.8) — dzielenie tekstu na fragmenty mieszczące się w limicie tokenów.
 *
 * Property 9: Konkatenacja chunków odtwarza oryginał; każdy chunk ≤ limit tokenów.
 *
 * Strategia tokenizera per dostawca:
 * - OpenAI: tiktoken (`cl100k_base` / `o200k_base` zależnie od modelu)
 * - Anthropic: aproksymacja chars/3.5 (oficjalny tokenizer JS jest WIP)
 * - Google: chars/4 (sensowne przybliżenie dla angielskiego)
 * - GitHub Models: chars/4 (fallback)
 *
 * Margines bezpieczeństwa: faktyczny limit = 80% deklarowanego (zostawiamy zapas na format response).
 */
import { encoding_for_model, get_encoding, type Tiktoken } from 'tiktoken';
import type { AIProvider } from '@/types/providers';

export const TOKEN_SAFETY_MARGIN = 0.8;

export interface TokenizerConfig {
  estimate: (text: string) => number;
  cleanup?: () => void;
}

/**
 * Zwraca funkcję estymującą liczbę tokenów dla danego dostawcy.
 * Wywołujący jest odpowiedzialny za wywołanie `cleanup()` jeśli zwrócono.
 */
export function getTokenizer(provider: AIProvider, modelId?: string): TokenizerConfig {
  if (provider === 'openai') {
    let encoder: Tiktoken | null = null;
    try {
      encoder = encoding_for_model((modelId ?? 'gpt-4o') as never);
    } catch {
      encoder = get_encoding('o200k_base');
    }
    return {
      estimate: (text: string) => encoder!.encode(text).length,
      cleanup: () => encoder!.free(),
    };
  }
  // GitHub Models używa OpenAI-podobnych modeli — można użyć tiktoken
  if (provider === 'github') {
    try {
      const encoder = get_encoding('o200k_base');
      return {
        estimate: (text: string) => encoder.encode(text).length,
        cleanup: () => encoder.free(),
      };
    } catch {
      return approximateTokenizer(4);
    }
  }
  // Anthropic: aproksymacja, około 3.5 znaków/token dla angielskiego
  if (provider === 'anthropic') {
    return approximateTokenizer(3.5);
  }
  // Google Gemini: aproksymacja, około 4 znaki/token
  return approximateTokenizer(4);
}

function approximateTokenizer(charsPerToken: number): TokenizerConfig {
  return {
    estimate: (text: string) => Math.ceil(text.length / charsPerToken),
  };
}

/**
 * Estymacja liczby tokenów (jednorazowa — z automatycznym cleanup).
 */
export function estimateTokens(text: string, provider: AIProvider, modelId?: string): number {
  const tokenizer = getTokenizer(provider, modelId);
  try {
    return tokenizer.estimate(text);
  } finally {
    tokenizer.cleanup?.();
  }
}

export interface SplitOptions {
  maxTokens: number;
  provider: AIProvider;
  modelId?: string;
  /** Minimalna liczba znaków, żeby uniknąć ataku "1 token = 1 chunk" przy bardzo agresywnym tokenizerze. */
  minChunkChars?: number;
}

/**
 * Dzieli tekst na fragmenty mieszczące się w (maxTokens × TOKEN_SAFETY_MARGIN).
 *
 * Property 9 (Wymaganie 12.2):
 *   - Konkatenacja chunków odtwarza oryginalny tekst
 *   - Każdy chunk ≤ limit tokenów (z marginesem bezpieczeństwa)
 *
 * Strategia: dwukrotny binarny ścisk od góry — najpierw szukamy największego prefiksu
 * mieszczącego się w limicie (przez bisekcję na granicach linii/zdań), potem
 * rekurencyjnie dla pozostałej części. Granice prefiksów wybieramy ostrożnie,
 * żeby nie ciąć w środku słowa.
 */
export function splitIntoChunks(text: string, options: SplitOptions): string[] {
  if (text.length === 0) return [];
  const { maxTokens, provider, modelId, minChunkChars = 50 } = options;
  const effectiveLimit = Math.floor(maxTokens * TOKEN_SAFETY_MARGIN);
  if (effectiveLimit < 1) {
    throw new Error('chunking.limitTooSmall');
  }

  const tokenizer = getTokenizer(provider, modelId);
  try {
    // Szybka ścieżka: cały tekst mieści się w limicie
    if (tokenizer.estimate(text) <= effectiveLimit) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (tokenizer.estimate(remaining) <= effectiveLimit) {
        chunks.push(remaining);
        break;
      }

      // Znajdź największy prefiks mieszczący się w limicie
      let lo = Math.max(minChunkChars, 1);
      let hi = remaining.length;
      let best = lo;

      // Bisekcja na długości (w znakach) — dla większości tokenizerów liniowa korelacja
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const candidate = remaining.slice(0, mid);
        if (tokenizer.estimate(candidate) <= effectiveLimit) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      // Wyrównaj do granicy linii / zdania / słowa, żeby nie ciąć w środku
      const breakpoint = findBreakpoint(remaining, best);
      const chunk = remaining.slice(0, breakpoint);
      // Bezpiecznik na patologie — gdyby breakpoint cofnął nas zbyt agresywnie
      if (chunk.length === 0) {
        chunks.push(remaining.slice(0, best));
        remaining = remaining.slice(best);
      } else {
        chunks.push(chunk);
        remaining = remaining.slice(breakpoint);
      }
    }

    return chunks;
  } finally {
    tokenizer.cleanup?.();
  }
}

/**
 * Znajduje "miły" punkt cięcia ≤ idealCut, preferując kolejno:
 * 1. koniec akapitu (\n\n)
 * 2. koniec linii (\n)
 * 3. koniec zdania (. ? !)
 * 4. koniec słowa (spacja)
 * 5. idealCut (twardy fallback — może ciąć w słowie)
 */
function findBreakpoint(text: string, idealCut: number): number {
  if (idealCut >= text.length) return text.length;

  const window = text.slice(0, idealCut);
  // Akapity
  const lastParagraph = window.lastIndexOf('\n\n');
  if (lastParagraph > idealCut * 0.5) return lastParagraph + 2;
  // Linie
  const lastNewline = window.lastIndexOf('\n');
  if (lastNewline > idealCut * 0.5) return lastNewline + 1;
  // Zdania
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('? '),
    window.lastIndexOf('! '),
  );
  if (sentenceEnd > idealCut * 0.5) return sentenceEnd + 2;
  // Słowa
  const lastSpace = window.lastIndexOf(' ');
  if (lastSpace > idealCut * 0.5) return lastSpace + 1;
  // Twardy fallback
  return idealCut;
}
