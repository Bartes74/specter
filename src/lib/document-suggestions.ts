import type { DocumentSuggestion, DocumentSuggestionDecision } from '@/types/session';

type ReviewDocuments = Record<'requirements' | 'design' | 'tasks', string | null | undefined>;

export const MAX_DOCUMENT_SUGGESTION_ITERATIONS = 2;

const TOPIC_STOPWORDS = new Set([
  'albo',
  'brak',
  'brakuje',
  'criteria',
  'dodaj',
  'document',
  'dokument',
  'jako',
  'jest',
  'kryteria',
  'missing',
  'nalezy',
  'oraz',
  'opisz',
  'powinna',
  'powinien',
  'requirements',
  'section',
  'suggestion',
  'this',
  'uzupelnij',
  'warto',
  'wymaganie',
  'zdefiniuj',
]);

export type SuggestionResponseQuality = {
  level: 'needs-detail' | 'usable' | 'strong' | 'delegated';
  score: number;
  label: string;
  helperText: string;
  missing: string[];
};

export function getDocumentSuggestionKey(suggestion: DocumentSuggestion): string {
  return [
    suggestion.documentType,
    normalizeSuggestionText(suggestion.message),
    normalizeSuggestionText(suggestion.suggestedAction),
  ].join('|');
}

export function getDocumentSuggestionHandledKeys(suggestion: DocumentSuggestion): string[] {
  return uniqueStrings([getDocumentSuggestionKey(suggestion), getDocumentSuggestionTopicKey(suggestion)]);
}

export function getDocumentsReviewKey(documents: ReviewDocuments): string {
  return (['requirements', 'design', 'tasks'] as const)
    .map((type) => `${type}:${hashText(documents[type] ?? '')}`)
    .join('|');
}

export function buildSuggestionRegenerationInstructions(
  suggestion: DocumentSuggestion,
  businessContext: string,
): string {
  const context = businessContext.trim();
  return [
    'Zaktualizuj dokument, uwzględniając zaakceptowaną sugestię AI.',
    `Dokument: ${suggestion.documentType}.md`,
    suggestion.sectionAnchor ? `Dotknięta sekcja: ${suggestion.sectionAnchor}` : null,
    `Sugestia: ${suggestion.message}`,
    `Oczekiwane działanie: ${suggestion.suggestedAction}`,
    context
      ? `Dodatkowe informacje od użytkownika biznesowego:\n${context}`
      : 'Użytkownik nie dodał dodatkowych informacji. Uzupełnij dokument konserwatywnie, bez wymyślania faktów; gdy brakuje decyzji biznesowej, oznacz ją jako otwartą decyzję.',
    'Zwróć pełną, spójną nową wersję dokumentu Markdown.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildSuggestionBatchRegenerationInstructions(
  documentType: DocumentSuggestion['documentType'],
  decisions: DocumentSuggestionDecision[],
): string {
  const accepted = decisions.filter(
    (decision) =>
      decision.suggestion.documentType === documentType && decision.decision === 'accepted',
  );
  const rejected = decisions.filter(
    (decision) =>
      decision.suggestion.documentType === documentType && decision.decision === 'rejected',
  );

  return [
    'Zaktualizuj dokument na podstawie decyzji użytkownika biznesowego z przeglądu sugestii AI.',
    `Dokument: ${documentType}.md`,
    accepted.length > 0
      ? [
          'Sugestie zaakceptowane do wdrożenia:',
          ...accepted.map((decision, index) => formatDecision(index, decision)),
        ].join('\n')
      : null,
    rejected.length > 0
      ? [
          'Sugestie odrzucone przez użytkownika. Nie dodawaj ich ponownie ani nie twórz równoważnych braków w tej wersji:',
          ...rejected.map((decision, index) => formatDecision(index, decision)),
        ].join('\n')
      : null,
    'Wygeneruj pełną, spójną nową wersję dokumentu Markdown. Nie dopisuj fikcyjnych decyzji. Jeśli użytkownik prosi o rekomendację aplikacji albo nie podał danych technicznych, zaproponuj bezpieczne, typowe rozwiązanie dla tego typu produktu i oznacz je jako założenie do późniejszego potwierdzenia.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

export function buildAutonomousSuggestionNote(suggestion: DocumentSuggestion): string {
  return [
    'Nie mam dodatkowej decyzji biznesowej ani technicznej.',
    `Dla tematu: ${suggestion.message}`,
    'Zaproponuj bezpieczne, typowe rozwiązanie dla tego typu aplikacji. Jeśli decyzja wymaga późniejszego potwierdzenia, oznacz ją w dokumencie jako założenie lub otwartą decyzję.',
  ].join(' ');
}

export function evaluateSuggestionDecision(
  suggestion: DocumentSuggestion,
  decision: DocumentSuggestionDecision['decision'] | undefined,
  note: string,
): SuggestionResponseQuality {
  if (!decision) {
    return {
      level: 'needs-detail',
      score: 0,
      label: 'Czeka na decyzję',
      helperText: 'Wybierz, czy sugestia ma trafić do dokumentów, czy ma zostać odrzucona.',
      missing: [],
    };
  }

  const normalized = normalizeSuggestionText(note);
  const trimmed = note.trim();
  const isDelegated =
    normalized.includes('zaproponuj bezpieczne') ||
    normalized.includes('nie mam dodatkowej decyzji') ||
    normalized.includes('aplikacja zaproponuje');

  if (decision === 'rejected') {
    if (trimmed.length >= 20) {
      return {
        level: 'strong',
        score: 100,
        label: 'Odrzucenie opisane',
        helperText: 'Ta decyzja wystarczy, żeby temat nie wracał po kolejnej analizie.',
        missing: [],
      };
    }
    return {
      level: 'usable',
      score: 75,
      label: 'Odrzucenie przyjęte',
      helperText: 'Sugestia zostanie zapamiętana jako odrzucona. Jedno zdanie powodu jeszcze lepiej ograniczy powroty podobnych tematów.',
      missing: ['Opcjonalnie dopisz, dlaczego ten temat nie dotyczy projektu.'],
    };
  }

  if (isDelegated || trimmed.length === 0) {
    return {
      level: 'delegated',
      score: 70,
      label: 'Aplikacja zaproponuje',
      helperText: 'To wystarczy dla tematów technicznych: generator dobierze rozsądny wariant i oznaczy go jako założenie.',
      missing: [],
    };
  }

  const hasDecisionSignal = /\b(tak|nie|musi|ma |bedzie|będzie|wymagamy|akceptujemy|wykluczamy|only|must|should|will|yes|no)\b/.test(
    normalized,
  );
  const hasConstraintSignal = /\b(limit|wyjatek|wyjątek|zakres|maks|minimum|rodo|gdpr|czas|dni|godzin|koszt|ryzyko|compliance|bezpieczen|security|privacy)\b/.test(
    normalized,
  );
  const hasExampleSignal = /\b(np|na przyklad|na przykład|przyklad|przykład|scenariusz|kiedy|gdy|example|scenario)\b/.test(
    normalized,
  );
  const specificitySignals = [hasDecisionSignal, hasConstraintSignal, hasExampleSignal].filter(Boolean).length;

  if (trimmed.length >= 140 && specificitySignals >= 2) {
    return {
      level: 'strong',
      score: 100,
      label: 'Bardzo precyzyjne',
      helperText: 'Odpowiedź jest wystarczająco konkretna, żeby ograniczyć kolejne pytania.',
      missing: [],
    };
  }

  if (trimmed.length >= 60 && specificitySignals >= 1) {
    return {
      level: 'usable',
      score: 82,
      label: 'Wystarczy',
      helperText: 'Generator ma dość kontekstu. Możesz dopisać ograniczenie albo przykład, jeśli chcesz zawęzić decyzję.',
      missing: buildMissingHints(specificitySignals, hasConstraintSignal, hasExampleSignal),
    };
  }

  return {
    level: 'needs-detail',
    score: Math.max(30, Math.min(60, Math.round(trimmed.length / 2))),
    label: 'Za mało konkretne',
    helperText: 'Dopisz prostą decyzję biznesową albo użyj opcji rekomendacji aplikacji.',
    missing: [
      'Jednoznaczna decyzja: tak/nie, zakres, priorytet albo wyjątek.',
      'Krótki przykład procesu, użytkownika lub sytuacji.',
    ],
  };

  function buildMissingHints(
    signals: number,
    hasConstraint: boolean,
    hasExample: boolean,
  ): string[] {
    if (signals >= 2) return [];
    return [
      !hasConstraint ? 'Możesz dopisać ograniczenie, zakres albo ryzyko.' : null,
      !hasExample ? 'Możesz dodać jeden przykład biznesowy.' : null,
    ].filter((item): item is string => item !== null);
  }
}

function normalizeSuggestionText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getDocumentSuggestionTopicKey(suggestion: DocumentSuggestion): string {
  const terms = normalizeSuggestionText(`${suggestion.message} ${suggestion.suggestedAction}`)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map((term) => term.replace(/^-+|-+$/g, ''))
    .filter((term) => term.length >= 5 && !TOPIC_STOPWORDS.has(term));
  const topic = uniqueStrings(terms).sort().slice(0, 10).join('-');
  return `${suggestion.documentType}|topic:${topic || normalizeSuggestionText(suggestion.message).slice(0, 80)}`;
}

function formatDecision(index: number, decision: DocumentSuggestionDecision): string {
  const suggestion = decision.suggestion;
  const note = decision.note.trim();
  return [
    `${index + 1}. ${suggestion.message}`,
    suggestion.sectionAnchor ? `   Sekcja: ${suggestion.sectionAnchor}` : null,
    `   Oczekiwane działanie: ${suggestion.suggestedAction}`,
    note
      ? `   Informacja od użytkownika: ${note}`
      : '   Informacja od użytkownika: brak dodatkowych danych.',
  ]
    .filter(Boolean)
    .join('\n');
}

function hashText(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
