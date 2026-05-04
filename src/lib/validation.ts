/**
 * Funkcje walidacji danych wejściowych (Zadanie 2.1).
 *
 * Property 1: Walidacja długości opisu projektu — akceptuje str ⇔ 20 ≤ len(str) ≤ 10000.
 * Property 10: Pipeline walidacji — sesja jest valid ⇔ wszystkie wymagane pola są wypełnione i poprawne.
 *
 * Walidacja jest pure (no I/O), żeby property-based testy mogły iterować na losowych danych szybko.
 */
import { isAIProvider, isTargetTool } from '@/types/providers';
import type { AIProvider } from '@/types/providers';
import type { SessionState } from '@/types/session';

export const DESCRIPTION_MIN_LENGTH = 20;
export const DESCRIPTION_MAX_LENGTH = 10_000;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface SessionValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Walidacja opisu projektu — Wymaganie 2.2, 2.3.
 * Property 1.
 */
export function validateDescription(input: unknown): ValidationResult {
  if (typeof input !== 'string') {
    return { valid: false, error: 'description.notString' };
  }
  const len = input.length;
  if (len < DESCRIPTION_MIN_LENGTH) {
    return { valid: false, error: 'description.tooShort' };
  }
  if (len > DESCRIPTION_MAX_LENGTH) {
    return { valid: false, error: 'description.tooLong' };
  }
  return { valid: true };
}

/**
 * Walidacja kształtu klucza API (po stronie klienta — szybki sanity check).
 * Pełna weryfikacja odbywa się na serwerze przez wywołanie testowe.
 */
export function validateApiKey(key: unknown, provider: AIProvider): boolean {
  if (typeof key !== 'string' || key.length < 8) return false;
  // Brak białych znaków na brzegach
  if (key !== key.trim()) return false;
  // Wzorce per dostawca — luźne, żeby nie odrzucać kluczy o nieznanym formacie
  switch (provider) {
    case 'openai':
      return key.startsWith('sk-');
    case 'anthropic':
      return key.startsWith('sk-ant-');
    case 'google':
      // Google AI Studio: AIza...
      return /^AIza[a-zA-Z0-9_-]{20,}$/.test(key);
    case 'github':
      // GitHub: ghp_ / github_pat_ / gho_ / ghs_ / ghu_
      return /^(ghp|gho|ghu|ghs)_[A-Za-z0-9]{20,}$/.test(key) ||
             key.startsWith('github_pat_');
  }
}

/**
 * Walidacja nazwy projektu (Wymaganie 1.4).
 * Niedozwolone znaki dla bezpiecznego folderu na różnych OS.
 */
export function validateProjectName(name: unknown): ValidationResult {
  if (typeof name !== 'string') return { valid: false, error: 'name.notString' };
  const trimmed = name.trim();
  if (trimmed.length === 0) return { valid: false, error: 'name.empty' };
  if (trimmed.length > 200) return { valid: false, error: 'name.tooLong' };
  // Znaki nielegalne na Windows + ASCII control + path separators
  if (/[<>:"/\\|?*\x00-\x1f]/.test(trimmed)) {
    return { valid: false, error: 'name.illegalChars' };
  }
  // Zarezerwowane nazwy Windows
  const reserved = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i;
  if (reserved.test(trimmed)) {
    return { valid: false, error: 'name.reserved' };
  }
  // Kropki/spacje na końcu — niewspierane na Windows
  if (/[. ]+$/.test(trimmed)) {
    return { valid: false, error: 'name.trailingDotOrSpace' };
  }
  return { valid: true };
}

/**
 * Walidacja stanu sesji przed rozpoczęciem generowania — Wymaganie 12.4, Property 10.
 * Sprawdza kompletność wszystkich wymaganych pól.
 */
export function validateSessionState(state: SessionState): SessionValidationResult {
  const errors: Record<string, string> = {};

  // Krok 1: ścieżka
  if (!state.projectPath || state.projectPath.trim().length === 0) {
    errors.projectPath = 'session.projectPath.missing';
  } else if (!state.pathValidation || !state.pathValidation.valid) {
    errors.projectPath = 'session.projectPath.invalid';
  }

  // Krok 2: opis
  const desc = validateDescription(state.projectDescription);
  if (!desc.valid) {
    errors.projectDescription = `session.${desc.error}`;
  }

  // Krok 4: narzędzie
  if (!state.targetTool || !isTargetTool(state.targetTool)) {
    errors.targetTool = 'session.targetTool.missing';
  }

  // Krok 5: model + dostawca + klucz
  if (!state.aiProvider || !isAIProvider(state.aiProvider)) {
    errors.aiProvider = 'session.aiProvider.missing';
  }
  if (!state.aiModel) {
    errors.aiModel = 'session.aiModel.missing';
  }
  // Tryb demo nie wymaga klucza API
  if (!state.isDemoMode) {
    if (!state.apiKey) {
      errors.apiKey = 'session.apiKey.missing';
    } else if (state.aiProvider && !validateApiKey(state.apiKey, state.aiProvider)) {
      errors.apiKey = 'session.apiKey.invalidShape';
    } else if (state.apiKeyValid === false) {
      errors.apiKey = 'session.apiKey.rejectedByProvider';
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
