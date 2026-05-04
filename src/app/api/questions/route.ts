/**
 * POST /api/questions — generowanie pytań doprecyzowujących (Wymagania 3.1, 3.3, 3.6).
 *
 * Klucz API jest w body — NIGDY nie loguj surowego body (sanitizeLogs przy każdym console).
 */
import { NextResponse } from 'next/server';
import { generateQuestions, QUESTION_MIN } from '@/services/AIService';
import { parseBody, isDemoMode, errorResponse } from '@/lib/api-helpers';
import { questionsSchema } from '@/lib/api-schemas';
import { safeLog } from '@/lib/security';
import { AIAdapterError } from '@/services/ai/types';

export const dynamic = 'force-dynamic';

// Stałe pytania dla Trybu_Demo (Wymaganie 17.6) — z plików w content/demo/
const DEMO_QUESTIONS = {
  pl: [
    {
      id: 'q1',
      text: 'Kto będzie głównym użytkownikiem aplikacji?',
      hint: 'Opisz grupy użytkowników i ich poziom doświadczenia.',
      isRequired: true,
      suggestedAnswers: [
        { id: 'q1s1', label: 'Zespół wewnętrzny', value: 'Głównymi użytkownikami będą pracownicy firmy pracujący codziennie nad zadaniami.' },
        { id: 'q1s2', label: 'Klienci końcowi', value: 'Głównymi użytkownikami będą klienci końcowi korzystający z aplikacji samodzielnie.' },
      ],
    },
    {
      id: 'q2',
      text: 'Jakie są 3 najważniejsze funkcje?',
      hint: 'Wymień funkcje, bez których pierwsza wersja nie ma sensu.',
      isRequired: true,
      suggestedAnswers: [
        { id: 'q2s1', label: 'Logowanie, dashboard, eksport', value: 'Najważniejsze funkcje to logowanie, czytelny dashboard oraz eksport danych.' },
        { id: 'q2s2', label: 'CRUD, role, powiadomienia', value: 'Najważniejsze funkcje to zarządzanie rekordami, role użytkowników i powiadomienia.' },
      ],
    },
    {
      id: 'q3',
      text: 'Czy projekt ma deadline lub budżet?',
      isRequired: false,
      suggestedAnswers: [
        { id: 'q3s1', label: 'Szybki MVP', value: 'Pierwsza wersja powinna być gotowa jak najszybciej, nawet kosztem mniej ważnych funkcji.' },
        { id: 'q3s2', label: 'Jakość ponad czas', value: 'Nie ma twardego deadline, ważniejsza jest solidna architektura i dopracowanie.' },
      ],
    },
    {
      id: 'q4',
      text: 'Czy są wymagania dotyczące zgodności (RODO, dostępność)?',
      isRequired: false,
      suggestedAnswers: [
        { id: 'q4s1', label: 'RODO', value: 'Aplikacja musi spełniać wymagania RODO dla danych osobowych.' },
        { id: 'q4s2', label: 'WCAG', value: 'Interfejs powinien spełniać podstawowe wymagania dostępności WCAG.' },
      ],
    },
  ],
  en: [
    {
      id: 'q1',
      text: 'Who is the primary user of the app?',
      hint: 'Describe user groups and their experience level.',
      isRequired: true,
      suggestedAnswers: [
        { id: 'q1s1', label: 'Internal team', value: 'The primary users are internal team members working with the app every day.' },
        { id: 'q1s2', label: 'End customers', value: 'The primary users are end customers using the app without assistance.' },
      ],
    },
    {
      id: 'q2',
      text: 'What are the top 3 features?',
      hint: 'List the features the first version cannot work without.',
      isRequired: true,
      suggestedAnswers: [
        { id: 'q2s1', label: 'Login, dashboard, export', value: 'The top features are login, a clear dashboard, and data export.' },
        { id: 'q2s2', label: 'CRUD, roles, alerts', value: 'The top features are record management, user roles, and notifications.' },
      ],
    },
    {
      id: 'q3',
      text: 'Is there a deadline or budget?',
      isRequired: false,
      suggestedAnswers: [
        { id: 'q3s1', label: 'Fast MVP', value: 'The first version should be ready quickly, even if lower-priority features wait.' },
        { id: 'q3s2', label: 'Quality first', value: 'There is no hard deadline; solid architecture and polish matter more.' },
      ],
    },
    {
      id: 'q4',
      text: 'Any compliance needs (GDPR, accessibility)?',
      isRequired: false,
      suggestedAnswers: [
        { id: 'q4s1', label: 'GDPR', value: 'The app must meet GDPR requirements for personal data.' },
        { id: 'q4s2', label: 'WCAG', value: 'The interface should meet basic WCAG accessibility requirements.' },
      ],
    },
  ],
};

export async function POST(req: Request) {
  const parsed = await parseBody(req, questionsSchema);
  if (parsed.error) return parsed.error;

  // Tryb demo — zwracamy gotowy zestaw pytań bez wywołania AI
  if (isDemoMode(req)) {
    return NextResponse.json({ questions: DEMO_QUESTIONS[parsed.data.locale] });
  }

  if (!parsed.data.aiProvider || !parsed.data.aiModel || !parsed.data.apiKey) {
    return NextResponse.json({
      questions: buildFallbackQuestions(parsed.data.locale, parsed.data.previousAnswers?.length ?? 0),
      source: 'heuristic',
    });
  }

  try {
    const questions = await generateQuestions(
      {
        provider: parsed.data.aiProvider,
        modelId: parsed.data.aiModel,
        apiKey: parsed.data.apiKey,
      },
      parsed.data.projectDescription,
      parsed.data.previousAnswers ?? [],
      parsed.data.locale,
    );

    if (questions.length < QUESTION_MIN) {
      // Property 2: gdy model zwrócił < 3, callsite może spróbować ponownie.
      return errorResponse(
        502,
        'PARSE_ERROR',
        `Model returned fewer than ${QUESTION_MIN} questions; please retry`,
      );
    }

    return NextResponse.json({ questions });
  } catch (err) {
    safeLog.error('[/api/questions] failed:', err);
    if (err instanceof AIAdapterError) {
      const status = err.code === 'AUTH_ERROR' ? 401 : err.code === 'TOKEN_LIMIT' ? 413 : 502;
      return errorResponse(status, err.code, err.message);
    }
    return errorResponse(500, 'UNKNOWN', (err as Error).message);
  }
}

function buildFallbackQuestions(locale: 'pl' | 'en', offset: number) {
  const questions = locale === 'pl'
    ? [
        {
          text: 'Kto będzie używał aplikacji na co dzień?',
          hint: 'Wystarczy krótki opis ról i poziomu doświadczenia.',
          suggestedAnswers: [
            { label: 'Zespół wewnętrzny', value: 'Aplikacji będzie używał zespół wewnętrzny w codziennej pracy.' },
            { label: 'Klienci', value: 'Aplikacji będą używać klienci końcowi bez wsparcia technicznego.' },
          ],
        },
        {
          text: 'Jakie trzy funkcje są konieczne w pierwszej wersji?',
          hint: 'Skup się na funkcjach, które definiują MVP.',
          suggestedAnswers: [
            { label: 'CRUD + role', value: 'Konieczne są zarządzanie danymi, role użytkowników i podstawowe raporty.' },
            { label: 'Workflow', value: 'Konieczny jest przepływ pracy od utworzenia sprawy do jej zamknięcia.' },
          ],
        },
        {
          text: 'Jak poznamy, że projekt zakończył się sukcesem?',
          hint: 'Możesz podać metrykę, zachowanie użytkowników albo stan biznesowy.',
          suggestedAnswers: [
            { label: 'Oszczędność czasu', value: 'Sukces oznacza wyraźne skrócenie czasu realizacji głównego procesu.' },
            { label: 'Mniej błędów', value: 'Sukces oznacza mniej ręcznych pomyłek i lepszą widoczność statusów.' },
          ],
        },
        {
          text: 'Czy istnieją ograniczenia technologiczne, prawne albo organizacyjne?',
          hint: 'Na przykład: istniejący stack, hosting, RODO, dostępność, integracje.',
          suggestedAnswers: [
            { label: 'Istniejący stack', value: 'Projekt powinien trzymać się obecnego stacku i konwencji repozytorium.' },
            { label: 'Brak ograniczeń', value: 'Nie ma twardych ograniczeń poza prostotą wdrożenia i utrzymania.' },
          ],
        },
      ]
    : [
        {
          text: 'Who will use the app day to day?',
          hint: 'A short description of roles and experience level is enough.',
          suggestedAnswers: [
            { label: 'Internal team', value: 'The app will be used by an internal team in daily operations.' },
            { label: 'Customers', value: 'The app will be used by end customers without technical support.' },
          ],
        },
        {
          text: 'Which three features are essential for the first version?',
          hint: 'Focus on features that define the MVP.',
          suggestedAnswers: [
            { label: 'CRUD + roles', value: 'The essentials are data management, user roles, and basic reports.' },
            { label: 'Workflow', value: 'The essential feature is a workflow from creating an item to closing it.' },
          ],
        },
        {
          text: 'How will we know the project succeeded?',
          hint: 'You can name a metric, user behavior, or business outcome.',
          suggestedAnswers: [
            { label: 'Time saved', value: 'Success means the main process takes noticeably less time.' },
            { label: 'Fewer errors', value: 'Success means fewer manual mistakes and better status visibility.' },
          ],
        },
        {
          text: 'Are there technical, legal, or organizational constraints?',
          hint: 'For example: current stack, hosting, GDPR, accessibility, integrations.',
          suggestedAnswers: [
            { label: 'Existing stack', value: 'The project should follow the current stack and repository conventions.' },
            { label: 'No hard limits', value: 'There are no hard constraints beyond simple deployment and maintenance.' },
          ],
        },
      ];

  return questions.map((question, index) => ({
    id: `hq${offset + index + 1}`,
    text: question.text,
    hint: question.hint,
    isRequired: index < 3,
    suggestedAnswers: question.suggestedAnswers.map((answer, answerIndex) => ({
      id: `hq${offset + index + 1}s${answerIndex + 1}`,
      ...answer,
    })),
  }));
}
