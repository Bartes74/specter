import { describe, expect, it } from 'vitest';
import {
  appendWithOverlap,
  generateRobustDocument,
  validateGeneratedSection,
} from '@/services/SpecGenerationService';
import { AIAdapterError, type AIAdapter, type ChatMessage, type CompleteOptions } from '@/services/ai/types';
import type { DocumentSectionSpec } from '@/services/PromptTemplateService';

class ContinuationFakeAdapter implements AIAdapter {
  readonly provider = 'openai' as const;
  streamCalls = 0;

  async complete(): Promise<string> {
    return JSON.stringify({
      title: 'Wymagania',
      sections: [
        {
          id: 'core-requirements',
          title: 'Wymagania główne',
          kind: 'requirements',
          goal: 'Opisz główne wymagania',
          mustInclude: ['Konto użytkownika'],
        },
      ],
    });
  }

  async completeStream(
    _messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    _options?: CompleteOptions,
  ): Promise<string> {
    this.streamCalls++;
    if (this.streamCalls === 1) {
      const partial = [
        '<!-- section:core-requirements -->',
        '## Wymagania główne',
        '',
        '### Wymaganie 1: Konto użytkownika',
        '**User Story:** Jako użytkownik chcę utworzyć konto, aby zachować swoje dane.',
        '',
        '#### Kryteria Akceptacji',
        '1. Aplikacja SHALL umożliwiać rejestrację adresem email.',
      ].join('\n');
      onChunk(partial);
      throw new AIAdapterError('limit', 'TOKEN_LIMIT', false, partial);
    }
    const continuation = [
      '',
      '2. Aplikacja SHALL walidować unikalność adresu email.',
      '3. Aplikacja SHALL utworzyć sesję po poprawnej rejestracji.',
    ].join('\n');
    onChunk(continuation);
    return continuation;
  }

  async validateApiKey(): Promise<boolean> {
    return true;
  }
}

const context = {
  projectDescription: 'Aplikacja do zarządzania treningiem i dietą.',
  answers: [],
  standards: null,
  targetTool: 'universal' as const,
  locale: 'pl' as const,
};

const requirementSection: DocumentSectionSpec = {
  id: 'core-requirements',
  title: 'Wymagania główne',
  kind: 'requirements',
  goal: 'Opisz główne wymagania',
  mustInclude: [],
};

describe('SpecGenerationService', () => {
  it('kontynuuje sekcję po TOKEN_LIMIT i zwraca kompletny dokument bez duplikacji', async () => {
    const adapter = new ContinuationFakeAdapter();
    const completedSections: string[] = [];
    const progressStatuses: string[] = [];

    const document = await generateRobustDocument(adapter, 'requirements', context, {
      manifestOptions: { maxTokens: 1000 },
      sectionOptions: { maxTokens: 1000 },
      repairOptions: { maxTokens: 1000 },
      onSectionComplete: (_doc, content) => completedSections.push(content),
      onSectionProgress: (progress) => progressStatuses.push(progress.status),
    });

    expect(adapter.streamCalls).toBe(2);
    expect(document).toContain('# Wymagania');
    expect(document).toContain('3. Aplikacja SHALL utworzyć sesję');
    expect(document.match(/## Wymagania główne/g)).toHaveLength(1);
    expect(completedSections).toHaveLength(1);
    expect(progressStatuses).toEqual(expect.arrayContaining(['planning', 'generating', 'continuing', 'complete']));
  });

  it('deduplikuje nakładające się granice kontynuacji', () => {
    expect(appendWithOverlap('Ala ma kota', 'kota i psa')).toBe('Ala ma kota i psa');
  });

  it('nie dokleja ponownie nagłówka, gdy kontynuacja zaczyna sekcję od nowa', () => {
    const partial = [
      '<!-- section:core-requirements -->',
      '## Wymagania główne',
      '',
      '### Wymaganie 1: Konto użytkownika',
      '**User Story:** Jako użytkownik chcę utworzyć konto, aby zachować swoje dane.',
      '',
      '#### Kryteria Akceptacji',
      '1. Aplikacja SHALL umożliwiać rejestrację adresem email.',
    ].join('\n');
    const restartedContinuation = [
      '<!-- section:core-requirements -->',
      '## Wymagania główne',
      '',
      '2. Aplikacja SHALL walidować unikalność adresu email.',
      '3. Aplikacja SHALL utworzyć sesję po poprawnej rejestracji.',
    ].join('\n');

    const combined = appendWithOverlap(partial, restartedContinuation);

    expect(combined.match(/<!-- section:core-requirements -->/g)).toHaveLength(1);
    expect(combined.match(/## Wymagania główne/g)).toHaveLength(1);
    expect(combined).toContain('email.\n2. Aplikacja');
    expect(combined).toContain('3. Aplikacja SHALL utworzyć sesję');
  });

  it('waliduje urwane fence, brakujące kryteria i brak referencji w taskach', () => {
    expect(validateGeneratedSection('design', {
      ...requirementSection,
      kind: 'architecture',
      title: 'Architektura',
      id: 'architecture',
    }, '<!-- section:architecture -->\n## Architektura\n```mermaid\ngraph TD')).toContain('markdown.codeFenceUnclosed');

    expect(validateGeneratedSection('requirements', requirementSection, [
      '<!-- section:core-requirements -->',
      '## Wymagania główne',
      '### Wymaganie 1: Konto',
      '**User Story:** Jako użytkownik chcę konto.',
      '1. Tylko jedno kryterium.',
    ].join('\n'))).toContain('requirements.criteriaMissing');

    expect(validateGeneratedSection('tasks', {
      ...requirementSection,
      id: 'tasks',
      title: 'Zadania',
      kind: 'tasks',
    }, '<!-- section:tasks -->\n## Zadania\n- [ ] 1. Zbuduj ekran logowania')).toContain('tasks.requirementReferenceMissing');
  });

  it('odrzuca sekcję naprawioną do samego komentarza i nagłówka', () => {
    expect(validateGeneratedSection(
      'design',
      {
        ...requirementSection,
        kind: 'architecture',
        title: 'Architektura',
        id: 'architecture',
      },
      '<!-- section:architecture -->\n## Architektura',
    )).toContain('section.bodyTooShort');
  });
});
