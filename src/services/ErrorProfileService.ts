/**
 * ErrorProfileService — buduje Profil_Błędu z 4 sekcjami i akcjami naprawczymi (Zadanie 16.1).
 *
 * Wymagania: 12.1, 12.2, 12.3, 12.4, 12.5
 *
 * Property 15: kompletność (każdy profil ma niepuste pola).
 * Property 16: powiązanie kodu błędu z akcją naprawczą (mapa zgodna z design.md).
 */
import * as crypto from 'node:crypto';
import { sanitizeLogs } from '@/lib/security';
import type { AIProvider } from '@/types/providers';
import type {
  ErrorCode,
  ErrorProfileData,
  FixAction,
  FixActionKind,
} from '@/lib/errors';
import type { AppLocale, SessionState } from '@/types/session';

export interface ErrorBuildContext {
  sessionState?: Partial<SessionState>;
  operation?: string;
  raw?: unknown;
  /** Provider którego dotyczy błąd (np. AUTH_ERROR otwiera tutorial dla TEGO providera) */
  provider?: AIProvider;
}

/**
 * Mapowanie kodu błędu na PRIMARY akcję naprawczą (Property 16).
 */
const PRIMARY_ACTION: Record<ErrorCode, FixActionKind> = {
  AUTH_ERROR: 'open-tutorial',
  PATH_NOT_FOUND: 'open-path-picker',
  FILE_ACCESS: 'open-path-picker',
  NETWORK_ERROR: 'retry',
  TOKEN_LIMIT: 'switch-model',
  PARSE_ERROR: 'retry',
  STANDARDS_ERROR: 'retry',
  PROJECT_EXISTS: 'open-path-picker',
  PARENT_NOT_FOUND: 'open-path-picker',
  NAME_INVALID: 'open-step',
  UNKNOWN: 'copy-report',
};

const RETRYABLE_CODES: ReadonlySet<ErrorCode> = new Set([
  'NETWORK_ERROR',
  'TOKEN_LIMIT',
  'PARSE_ERROR',
  'STANDARDS_ERROR',
]);

interface CopyForCode {
  whatHappened: string;
  whatItMeans: string;
  howToFix: string[];
  primaryLabel: string;
}

/**
 * Treść Profilu_Błędu per kod, per locale.
 */
const COPY: Record<AppLocale, Record<ErrorCode, CopyForCode>> = {
  pl: {
    AUTH_ERROR: {
      whatHappened: 'Klucz API nie zadziałał — dostawca odrzucił żądanie.',
      whatItMeans: 'Twoje dotychczasowe odpowiedzi i opis projektu nie zostały utracone.',
      howToFix: [
        'Sprawdź czy klucz został poprawnie skopiowany (bez spacji na końcach).',
        'Sprawdź saldo konta u dostawcy — być może wyczerpałeś środki.',
        'Sprawdź czy klucz nie wygasł (niektórzy dostawcy unieważniają stare klucze).',
      ],
      primaryLabel: 'Pokaż jak zdobyć nowy klucz',
    },
    PATH_NOT_FOUND: {
      whatHappened: 'Folder podany jako Katalog Projektu nie istnieje.',
      whatItMeans: 'Możemy go utworzyć w tej lokalizacji jednym kliknięciem.',
      howToFix: [
        'Wybierz inny istniejący folder, lub',
        'Pozwól nam utworzyć nowy folder w tej lokalizacji.',
      ],
      primaryLabel: 'Wróć do wyboru folderu',
    },
    FILE_ACCESS: {
      whatHappened: 'Brak uprawnień do zapisu w wybranym folderze.',
      whatItMeans: 'Nie możemy zapisać tam wygenerowanych dokumentów.',
      howToFix: [
        'Wybierz inny folder, w którym masz prawo zapisu.',
        'Lub zmień uprawnienia bieżącego folderu w ustawieniach systemu.',
      ],
      primaryLabel: 'Wybierz inny folder',
    },
    NETWORK_ERROR: {
      whatHappened: 'Połączenie z dostawcą AI zostało przerwane.',
      whatItMeans: 'Twoja sesja jest bezpieczna — żadne dane nie zostały utracone.',
      howToFix: [
        'Sprawdź połączenie z internetem.',
        'Spróbuj ponownie — automatycznie próbujemy 3 razy.',
        'Jeśli problem się powtarza, sprawdź status dostawcy.',
      ],
      primaryLabel: 'Spróbuj ponownie',
    },
    TOKEN_LIMIT: {
      whatHappened: 'Treść okazała się zbyt długa dla wybranego modelu.',
      whatItMeans: 'Twoje odpowiedzi są zachowane — możemy spróbować z innym modelem.',
      howToFix: [
        'Przełącz się na model z większym oknem kontekstu (np. Claude Sonnet — 200k tokenów).',
        'Lub skróć opis projektu i odpowiedzi na pytania.',
      ],
      primaryLabel: 'Zmień model',
    },
    PARSE_ERROR: {
      whatHappened: 'Model zwrócił odpowiedź w nieoczekiwanym formacie.',
      whatItMeans: 'Twoja sesja jest bezpieczna — możemy spróbować jeszcze raz.',
      howToFix: ['Spróbuj wygenerować ponownie.', 'Jeśli problem się powtarza, zmień model.'],
      primaryLabel: 'Spróbuj ponownie',
    },
    STANDARDS_ERROR: {
      whatHappened: 'Nie udało się wygenerować standardów dla wybranego profilu.',
      whatItMeans: 'Możesz spróbować ponownie lub kontynuować bez standardów.',
      howToFix: [
        'Spróbuj ponownie z tym samym profilem.',
        'Lub wybierz inny profil aplikacji.',
        'Lub pomiń ten krok i wygeneruj specyfikację bez standardów.',
      ],
      primaryLabel: 'Spróbuj ponownie',
    },
    PROJECT_EXISTS: {
      whatHappened: 'Folder o tej nazwie już istnieje w wybranej lokalizacji.',
      whatItMeans: 'Nie nadpisujemy istniejących folderów dla bezpieczeństwa.',
      howToFix: [
        'Wybierz inną nazwę dla projektu.',
        'Lub użyj istniejącego folderu jako Katalog Projektu zamiast tworzyć nowy.',
      ],
      primaryLabel: 'Wróć do wyboru folderu',
    },
    PARENT_NOT_FOUND: {
      whatHappened: 'Folder nadrzędny dla nowego projektu nie istnieje.',
      whatItMeans: 'Wybierz istniejącą lokalizację dla nowego projektu.',
      howToFix: ['Wybierz istniejący folder rodzica (np. ~/projekty).'],
      primaryLabel: 'Wróć do wyboru folderu',
    },
    NAME_INVALID: {
      whatHappened: 'Nazwa projektu zawiera niedozwolone znaki.',
      whatItMeans: 'Niektóre znaki (/ \\ : * ? " < > |) nie są dozwolone w nazwach folderów.',
      howToFix: ['Wybierz nazwę zawierającą tylko litery, cyfry, myślniki i podkreślenia.'],
      primaryLabel: 'Wróć do wyboru nazwy',
    },
    UNKNOWN: {
      whatHappened: 'Wystąpił nieoczekiwany błąd.',
      whatItMeans: 'Twoja sesja jest zachowana. Możesz skopiować raport błędu i zgłosić go.',
      howToFix: [
        'Spróbuj ponownie.',
        'Jeśli problem się powtarza, skopiuj raport błędu i zgłoś go w kanale wsparcia.',
      ],
      primaryLabel: 'Skopiuj raport błędu',
    },
  },
  en: {
    AUTH_ERROR: {
      whatHappened: 'The API key did not work — the provider rejected the request.',
      whatItMeans: 'Your previous answers and project description are preserved.',
      howToFix: [
        'Check that the key was copied correctly (no trailing spaces).',
        "Check your account balance with the provider — you may have run out of credits.",
        'Check whether the key expired (some providers invalidate old keys).',
      ],
      primaryLabel: 'Show how to get a new key',
    },
    PATH_NOT_FOUND: {
      whatHappened: 'The folder you provided does not exist.',
      whatItMeans: 'We can create it for you in that location with one click.',
      howToFix: ['Pick another existing folder, or', 'Let us create a new folder in this location.'],
      primaryLabel: 'Back to folder picker',
    },
    FILE_ACCESS: {
      whatHappened: "We don't have permission to write to the chosen folder.",
      whatItMeans: 'We cannot save the generated documents there.',
      howToFix: [
        'Pick another folder where you have write permission.',
        'Or change permissions of the current folder in your system settings.',
      ],
      primaryLabel: 'Pick another folder',
    },
    NETWORK_ERROR: {
      whatHappened: 'Connection to the AI provider was interrupted.',
      whatItMeans: 'Your session is safe — no data was lost.',
      howToFix: [
        'Check your internet connection.',
        'Try again — we automatically retry 3 times.',
        "If the problem persists, check the provider's status page.",
      ],
      primaryLabel: 'Try again',
    },
    TOKEN_LIMIT: {
      whatHappened: 'Content turned out to be too long for the selected model.',
      whatItMeans: 'Your answers are preserved — we can try a different model.',
      howToFix: [
        'Switch to a model with a larger context window (e.g. Claude Sonnet — 200k tokens).',
        'Or shorten the project description and answers.',
      ],
      primaryLabel: 'Switch model',
    },
    PARSE_ERROR: {
      whatHappened: 'The model returned a response in an unexpected format.',
      whatItMeans: 'Your session is safe — we can try again.',
      howToFix: ['Try generating again.', 'If the problem persists, switch to another model.'],
      primaryLabel: 'Try again',
    },
    STANDARDS_ERROR: {
      whatHappened: 'Could not generate standards for the selected profile.',
      whatItMeans: 'You can retry or continue without standards.',
      howToFix: [
        'Try again with the same profile.',
        'Or pick a different application profile.',
        'Or skip this step and generate the spec without standards.',
      ],
      primaryLabel: 'Try again',
    },
    PROJECT_EXISTS: {
      whatHappened: 'A folder with that name already exists at the chosen location.',
      whatItMeans: 'We do not overwrite existing folders for safety.',
      howToFix: [
        'Pick a different project name.',
        'Or use the existing folder as the project directory instead of creating a new one.',
      ],
      primaryLabel: 'Back to folder picker',
    },
    PARENT_NOT_FOUND: {
      whatHappened: 'The parent folder for the new project does not exist.',
      whatItMeans: 'Pick an existing location for the new project.',
      howToFix: ['Pick an existing parent folder (e.g. ~/projects).'],
      primaryLabel: 'Back to folder picker',
    },
    NAME_INVALID: {
      whatHappened: 'The project name contains illegal characters.',
      whatItMeans: 'Some characters (/ \\ : * ? " < > |) are not allowed in folder names.',
      howToFix: ['Pick a name containing only letters, digits, dashes and underscores.'],
      primaryLabel: 'Back to name input',
    },
    UNKNOWN: {
      whatHappened: 'An unexpected error occurred.',
      whatItMeans: 'Your session is preserved. You can copy the error report and submit it.',
      howToFix: [
        'Try again.',
        'If the problem persists, copy the error report and submit it via the support channel.',
      ],
      primaryLabel: 'Copy error report',
    },
  },
};

/**
 * Buduje Profil_Błędu z czterema sekcjami i akcjami naprawczymi.
 *
 * Property 15: zwraca strukturę z niepustymi polami i ≥ 1 akcją oznaczoną jako primary.
 * Property 16: primary action.kind zgodne z mapą PRIMARY_ACTION.
 */
export function build(
  code: ErrorCode,
  context: ErrorBuildContext = {},
  locale: AppLocale = 'pl',
): ErrorProfileData {
  const copy = COPY[locale][code];
  const primaryKind = PRIMARY_ACTION[code];
  const provider = context.provider ?? context.sessionState?.aiProvider ?? undefined;

  const fixActions: FixAction[] = [
    {
      label: copy.primaryLabel,
      kind: primaryKind,
      primary: true,
      ...(provider && primaryKind === 'open-tutorial' ? { payload: { provider } } : {}),
    },
  ];

  // Dodaj sekundarne akcje dla każdego kodu (zawsze "copy-report" jako wyjście awaryjne)
  if (primaryKind !== 'copy-report') {
    fixActions.push({
      label: locale === 'pl' ? 'Skopiuj raport błędu' : 'Copy error report',
      kind: 'copy-report',
    });
  }

  const profile: ErrorProfileData = {
    errorId: crypto.randomUUID(),
    code,
    whatHappened: copy.whatHappened,
    whatItMeans: copy.whatItMeans,
    howToFix: [...copy.howToFix],
    fixActions,
    retryable: RETRYABLE_CODES.has(code),
  };

  // Dla błędów retryable buduj fixPrompt do schowka
  if (profile.retryable || code === 'AUTH_ERROR') {
    profile.fixPrompt = buildFixPrompt(profile, context);
  }

  return profile;
}

/**
 * Generuje precyzyjny prompt diagnostyczny dla użytkownika "Skopiuj raport błędu".
 * Zawiera kontekst sesji (zsanityzowany) — bez kluczy API.
 */
export function buildFixPrompt(profile: ErrorProfileData, context: ErrorBuildContext): string {
  const lines: string[] = [
    `# Raport błędu: ${profile.code}`,
    `Error ID: ${profile.errorId}`,
    `Kiedy: ${new Date().toISOString()}`,
    '',
    `## Co się stało`,
    profile.whatHappened,
    '',
    `## Operacja`,
    context.operation ?? 'unknown',
  ];

  if (context.sessionState) {
    const s = context.sessionState;
    lines.push('', '## Stan sesji (zsanityzowany)');
    if (s.aiProvider) lines.push(`- Dostawca: ${s.aiProvider}`);
    if (s.aiModel) lines.push(`- Model: ${s.aiModel}`);
    if (s.targetTool) lines.push(`- Narzędzie docelowe: ${s.targetTool}`);
    if (s.locale) lines.push(`- Locale: ${s.locale}`);
    if (s.currentStep !== undefined) lines.push(`- Krok wizarda: ${s.currentStep}`);
    if (s.isDemoMode) lines.push(`- Tryb demo: true`);
  }

  if (context.raw) {
    lines.push('', '## Surowy błąd', '```');
    try {
      lines.push(typeof context.raw === 'string' ? context.raw : JSON.stringify(context.raw, null, 2));
    } catch {
      lines.push(String(context.raw));
    }
    lines.push('```');
  }

  // SANITYZACJA — usunie ewentualne klucze API
  return sanitizeLogs(lines.join('\n'));
}
