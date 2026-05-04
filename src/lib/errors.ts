/**
 * Wspólne typy błędów aplikacji (Zadanie 10.1, 16.1).
 *
 * Wymaganie 12: każdy błąd jest mapowany na Profil_Błędu z 4 sekcjami i akcjami naprawczymi.
 */

export const ERROR_CODES = [
  'NETWORK_ERROR',
  'TOKEN_LIMIT',
  'AUTH_ERROR',
  'FILE_ACCESS',
  'PATH_NOT_FOUND',
  'PARSE_ERROR',
  'STANDARDS_ERROR',
  'PROJECT_EXISTS',
  'PARENT_NOT_FOUND',
  'NAME_INVALID',
  'UNKNOWN',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type FixActionKind =
  | 'open-tutorial'
  | 'open-path-picker'
  | 'retry'
  | 'switch-model'
  | 'copy-prompt'
  | 'copy-report'
  | 'open-step';

export interface FixAction {
  label: string;
  kind: FixActionKind;
  primary?: boolean;
  payload?: Record<string, unknown>;
}

export interface ErrorProfileData {
  errorId: string;
  code: ErrorCode;
  whatHappened: string;
  whatItMeans: string;
  howToFix: string[];
  fixActions: FixAction[];
  fixPrompt?: string;
  retryable: boolean;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}
