import { describe, expect, it } from 'vitest';
import {
  buildSuggestionBatchRegenerationInstructions,
  buildSuggestionRegenerationInstructions,
  buildAutonomousSuggestionNote,
  evaluateSuggestionDecision,
  getDocumentSuggestionHandledKeys,
  getDocumentsReviewKey,
  getDocumentSuggestionKey,
  MAX_DOCUMENT_SUGGESTION_ITERATIONS,
} from '@/lib/document-suggestions';
import type { DocumentSuggestion } from '@/types/session';

const suggestion: DocumentSuggestion = {
  id: 'requirements-sugg-1',
  documentType: 'requirements',
  severity: 'warning',
  message: 'Dodaj kryteria akceptacji dla logowania.',
  suggestedAction: 'Uzupełnij requirements.md o scenariusze sukcesu i błędu.',
};

describe('document suggestions', () => {
  it('ogranicza przepływ sugestii do dwóch iteracji', () => {
    expect(MAX_DOCUMENT_SUGGESTION_ITERATIONS).toBe(2);
  });

  it('buduje instrukcje regeneracji z zaakceptowanej sugestii i odpowiedzi użytkownika', () => {
    const instructions = buildSuggestionRegenerationInstructions(
      suggestion,
      'Logowanie ma wspierać SSO i reset hasła.',
    );

    expect(instructions).toContain('Zaktualizuj dokument');
    expect(instructions).toContain('Dodaj kryteria akceptacji dla logowania.');
    expect(instructions).toContain('Logowanie ma wspierać SSO i reset hasła.');
  });

  it('buduje zbiorcze instrukcje z akceptacjami i odrzuceniami', () => {
    const rejectedSuggestion: DocumentSuggestion = {
      id: 'requirements-sugg-2',
      documentType: 'requirements',
      severity: 'info',
      message: 'Dodaj osobny moduł rozliczeń.',
      suggestedAction: 'Opisz rozliczenia w requirements.md.',
    };

    const instructions = buildSuggestionBatchRegenerationInstructions('requirements', [
      {
        suggestion,
        decision: 'accepted',
        note: 'Logowanie ma wspierać SSO i reset hasła.',
      },
      {
        suggestion: rejectedSuggestion,
        decision: 'rejected',
        note: 'Rozliczenia nie są częścią zakresu v1.',
      },
    ]);

    expect(instructions).toContain('Sugestie zaakceptowane do wdrożenia');
    expect(instructions).toContain('Logowanie ma wspierać SSO i reset hasła.');
    expect(instructions).toContain('Sugestie odrzucone przez użytkownika');
    expect(instructions).toContain('Rozliczenia nie są częścią zakresu v1.');
  });

  it('klucz wersji dokumentów zmienia się po zmianie treści', () => {
    const first = getDocumentsReviewKey({
      requirements: '# A',
      design: '# B',
      tasks: '# C',
    });
    const second = getDocumentsReviewKey({
      requirements: '# A updated',
      design: '# B',
      tasks: '# C',
    });

    expect(second).not.toBe(first);
  });

  it('klucz sugestii jest stabilny mimo różnic whitespace i wielkości liter', () => {
    const sameSuggestion = {
      ...suggestion,
      message: '  DODAJ   kryteria akceptacji dla logowania. ',
      suggestedAction: 'Uzupełnij requirements.md  o scenariusze sukcesu i błędu.',
    };

    expect(getDocumentSuggestionKey(sameSuggestion)).toBe(getDocumentSuggestionKey(suggestion));
  });

  it('tworzy dodatkowy klucz tematu do filtrowania ponownych sugestii', () => {
    const keys = getDocumentSuggestionHandledKeys(suggestion);

    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(getDocumentSuggestionKey(suggestion));
    expect(keys[1]).toContain('requirements|topic:');
  });

  it('ocenia odpowiedź użytkownika i wspiera delegowanie decyzji do aplikacji', () => {
    const weak = evaluateSuggestionDecision(suggestion, 'accepted', 'OK');
    const delegated = evaluateSuggestionDecision(
      suggestion,
      'accepted',
      buildAutonomousSuggestionNote(suggestion),
    );
    const strong = evaluateSuggestionDecision(
      suggestion,
      'accepted',
      'Tak, logowanie musi wspierać SSO dla firm oraz reset hasła e-mail. Wyjątek: konta testowe mogą używać hasła lokalnego przez 7 dni. Przykład: menedżer loguje się przez Google Workspace.',
    );

    expect(weak.level).toBe('needs-detail');
    expect(delegated.level).toBe('delegated');
    expect(strong.level).toBe('strong');
  });
});
