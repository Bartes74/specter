/**
 * PromptTemplateService — szablony promptów (Zadanie 4.2).
 *
 * Wymagania: 4.3, 7.3, 8.3, 9.3, 10.4, 6.2
 *
 * Property 3: dla dowolnej kombinacji (narzędzie, typ dokumentu) szablon zawiera
 *             instrukcje formatowania specyficzne dla narzędzia + typu dokumentu.
 * Property 4: niepuste standardy → prompt zawiera ich treść; puste → nie zawiera.
 * Property 8: szablon zawiera instrukcję generowania w wybranym języku.
 */
import type { TargetTool } from '@/types/providers';
import type { AppLocale, QuestionAnswer } from '@/types/session';

export type DocumentType = 'requirements' | 'design' | 'tasks';

export interface PromptTemplate {
  systemPrompt: string;
  userPromptTemplate: string;
  outputFormat: string;
}

export interface BuildContext {
  projectDescription: string;
  answers: QuestionAnswer[];
  standards?: string | null;
  targetTool: TargetTool;
  locale: AppLocale;
  previousDocuments?: {
    requirements?: string;
    design?: string;
  };
}

export interface BuiltPrompt {
  systemPrompt: string;
  userPrompt: string;
}

export type DocumentSectionKind =
  | 'intro'
  | 'glossary'
  | 'requirements'
  | 'architecture'
  | 'components'
  | 'data'
  | 'decisions'
  | 'tasks'
  | 'quality'
  | 'other';

export interface DocumentSectionSpec {
  id: string;
  title: string;
  kind: DocumentSectionKind;
  goal: string;
  mustInclude: string[];
}

export interface DocumentManifest {
  title: string;
  sections: DocumentSectionSpec[];
}

const LOCALE_INSTRUCTION: Record<AppLocale, string> = {
  pl: 'Generuj cały dokument w języku polskim. Wszystkie nagłówki, opisy i komentarze po polsku.',
  en: 'Generate the entire document in English. All headings, descriptions, and comments in English.',
};

const TOOL_HINTS: Record<TargetTool, { pl: string; en: string }> = {
  codex: {
    pl: 'Optymalizuj dla OpenAI Codex: dawaj jawne ścieżki plików, fragmenty kodu i kroki krok-po-kroku.',
    en: 'Optimize for OpenAI Codex: include explicit file paths, code snippets, and step-by-step instructions.',
  },
  'claude-code': {
    pl: 'Optymalizuj dla Claude Code: hierarchiczne nagłówki, sekcje rationale, dokładne kryteria akceptacji.',
    en: 'Optimize for Claude Code: hierarchical headings, rationale sections, precise acceptance criteria.',
  },
  gemini: {
    pl: 'Optymalizuj dla Google Gemini: zwięzłe sekcje, listy punktowane, jednoznaczne instrukcje.',
    en: 'Optimize for Google Gemini: concise sections, bulleted lists, unambiguous instructions.',
  },
  copilot: {
    pl: 'Optymalizuj dla GitHub Copilot: skupienie na kodzie, krótkie opisy, jawne nazwy funkcji i typów.',
    en: 'Optimize for GitHub Copilot: code-focused, short descriptions, explicit function and type names.',
  },
  universal: {
    pl: 'Format neutralny — czytelny dla dowolnego narzędzia AI. Standardowy Markdown bez egzotycznych konwencji.',
    en: 'Neutral format — readable by any AI tool. Standard Markdown, no exotic conventions.',
  },
};

const DOCUMENT_STRUCTURE: Record<DocumentType, { pl: string; en: string }> = {
  requirements: {
    pl: 'Struktura dokumentu requirements.md: # Tytuł, ## Wprowadzenie, ## Słownik (terminy z definicjami), ## Wymagania (każde wymaganie z User Story i numerowanymi Kryteriami Akceptacji). Każde wymaganie musi mieć minimum 3 kryteria.',
    en: 'Document structure for requirements.md: # Title, ## Introduction, ## Glossary (terms with definitions), ## Requirements (each requirement with a User Story and numbered Acceptance Criteria). Each requirement must have at least 3 criteria.',
  },
  design: {
    pl: 'Struktura dokumentu design.md: # Tytuł, ## Przegląd, ## Architektura (z diagramem mermaid), ## Komponenty (z interfejsami TypeScript), ## Modele danych, ## Decyzje projektowe.',
    en: 'Document structure for design.md: # Title, ## Overview, ## Architecture (with mermaid diagram), ## Components (with TypeScript interfaces), ## Data models, ## Design decisions.',
  },
  tasks: {
    pl: 'Struktura dokumentu tasks.md: # Tytuł, ## Przegląd, ## Zadania (numerowana lista zagnieżdżona, każde zadanie z opisem i odwołaniem do _Wymagania: X.Y_). Zadania uporządkowane topologicznie po zależnościach.',
    en: 'Document structure for tasks.md: # Title, ## Overview, ## Tasks (numbered nested list, each task with description and _Requirements: X.Y_ reference). Tasks ordered topologically by dependencies.',
  },
};

const QUESTIONS_SYSTEM: Record<AppLocale, string> = {
  pl: 'Jesteś analitykiem biznesowym pomagającym użytkownikowi nietechnicznemu doprecyzować wymagania projektu. Zadawaj precyzyjne, otwarte pytania w prostym języku. NIGDY nie używaj żargonu technicznego.',
  en: 'You are a business analyst helping a non-technical user refine project requirements. Ask precise, open-ended questions in plain language. NEVER use technical jargon.',
};

const QUESTIONS_USER_TEMPLATE: Record<AppLocale, string> = {
  pl: `Opis projektu od użytkownika:
"""
{description}
"""

{previousAnswersSection}

Wygeneruj 3-7 pytań doprecyzowujących, które pomogą zrozumieć: docelowych użytkowników, główne funkcjonalności, potrzebę logowania/ról, ograniczenia (czas, budżet, technologia, regulacje, dane wrażliwe, dostępność), kryteria sukcesu. Gdy typowe odpowiedzi są przewidywalne, dodaj 2-4 krótkie suggestedAnswers.
Zwróć JSON-em w formacie:
{ "questions": [ { "id": "q1", "text": "...", "hint": "...", "isRequired": true, "suggestedAnswers": [ { "id": "s1", "label": "...", "value": "..." } ] } ] }`,
  en: `User's project description:
"""
{description}
"""

{previousAnswersSection}

Generate 3-7 clarifying questions that help understand: target users, main features, authentication/roles needs, constraints (time, budget, technology, regulations, sensitive data, accessibility), success criteria. When common answers are predictable, include 2-4 short suggestedAnswers.
Return JSON in this format:
{ "questions": [ { "id": "q1", "text": "...", "hint": "...", "isRequired": true, "suggestedAnswers": [ { "id": "s1", "label": "...", "value": "..." } ] } ] }`,
};

/**
 * Buduje prompt dla generowania dokumentu (requirements / design / tasks).
 *
 * Property 4: gdy `standards` jest niepustym ciągiem → prompt zawiera sekcję
 *             standardów. Gdy null/undefined/empty → nie zawiera.
 * Property 8: prompt zawiera LOCALE_INSTRUCTION[locale].
 */
export function buildDocumentPrompt(
  documentType: DocumentType,
  context: BuildContext,
): BuiltPrompt {
  const localeInstruction = LOCALE_INSTRUCTION[context.locale];
  const toolHint = TOOL_HINTS[context.targetTool][context.locale];
  const structure = DOCUMENT_STRUCTURE[documentType][context.locale];

  const systemPrompt = [
    context.locale === 'pl'
      ? 'Jesteś ekspertem od pisania specyfikacji technicznych. Twórz dokumenty kompletne, jednoznaczne i gotowe do implementacji przez narzędzie AI.'
      : 'You are an expert at writing technical specifications. Create complete, unambiguous documents ready for implementation by an AI tool.',
    localeInstruction,
    toolHint,
    structure,
  ].join('\n\n');

  const sections = buildDocumentContextSections(documentType, context);

  sections.push(
    context.locale === 'pl'
      ? `Wygeneruj kompletny plik ${documentType}.md zgodny ze wszystkimi instrukcjami powyżej.`
      : `Generate a complete ${documentType}.md file following all instructions above.`,
  );

  return {
    systemPrompt,
    userPrompt: sections.join('\n\n'),
  };
}

export function buildDocumentManifestPrompt(
  documentType: DocumentType,
  context: BuildContext,
): BuiltPrompt {
  const localeInstruction = LOCALE_INSTRUCTION[context.locale];
  const structure = DOCUMENT_STRUCTURE[documentType][context.locale];
  const systemPrompt = [
    context.locale === 'pl'
      ? 'Jesteś architektem specyfikacji. Projektujesz manifest dokumentu zanim powstanie właściwy Markdown.'
      : 'You are a specification architect. You design a document manifest before the Markdown is generated.',
    localeInstruction,
    structure,
    context.locale === 'pl'
      ? 'Zwracaj wyłącznie poprawny JSON. Bez markdown, bez komentarzy, bez code fence.'
      : 'Return valid JSON only. No markdown, no comments, no code fence.',
  ].join('\n\n');

  const sections = buildDocumentContextSections(documentType, context);
  sections.push(
    context.locale === 'pl'
      ? `Zaprojektuj manifest dla ${documentType}.md. Sekcje mają być na tyle małe, żeby każda mogła zostać wygenerowana osobno. Dla dużych modułów rozbij wymagania/zadania na partie po 3-5 elementów.`
      : `Design a manifest for ${documentType}.md. Sections must be small enough to generate independently. For large modules, split requirements/tasks into batches of 3-5 items.`,
  );
  sections.push(
    `JSON schema:
{
  "title": "Document title without leading #",
  "sections": [
    {
      "id": "stable-kebab-case-id",
      "title": "Section heading without leading ##",
      "kind": "intro|glossary|requirements|architecture|components|data|decisions|tasks|quality|other",
      "goal": "What this section must accomplish",
      "mustInclude": ["specific item 1", "specific item 2"]
    }
  ]
}`,
  );

  return { systemPrompt, userPrompt: sections.join('\n\n') };
}

export function buildDocumentSectionPrompt(
  documentType: DocumentType,
  context: BuildContext,
  manifest: DocumentManifest,
  section: DocumentSectionSpec,
  completedDocument: string,
): BuiltPrompt {
  const localeInstruction = LOCALE_INSTRUCTION[context.locale];
  const toolHint = TOOL_HINTS[context.targetTool][context.locale];
  const structure = DOCUMENT_STRUCTURE[documentType][context.locale];
  const systemPrompt = [
    context.locale === 'pl'
      ? 'Jesteś ekspertem od pisania specyfikacji technicznych. Generujesz tylko jedną, kompletną sekcję dokumentu Markdown.'
      : 'You are an expert technical specification writer. You generate exactly one complete Markdown document section.',
    localeInstruction,
    toolHint,
    structure,
  ].join('\n\n');

  const sections = buildDocumentContextSections(documentType, context);
  sections.push(
    context.locale === 'pl'
      ? `Manifest całego dokumentu:\n${JSON.stringify(manifest, null, 2)}`
      : `Full document manifest:\n${JSON.stringify(manifest, null, 2)}`,
  );
  if (completedDocument.trim()) {
    sections.push(
      context.locale === 'pl'
        ? `Już ukończone wcześniejsze sekcje tego samego dokumentu (dla spójności; nie powtarzaj):\n"""\n${completedDocument.slice(-8000)}\n"""`
        : `Already completed earlier sections of this same document (for consistency; do not repeat):\n"""\n${completedDocument.slice(-8000)}\n"""`,
    );
  }

  sections.push(
    context.locale === 'pl'
      ? `Wygeneruj tylko tę sekcję:
${JSON.stringify(section, null, 2)}

Twarde zasady:
- Pierwsza linia musi brzmieć dokładnie: <!-- section:${section.id} -->
- Druga linia musi brzmieć dokładnie: ## ${section.title}
- Nie dodawaj nagłówka # dokumentu.
- Nie dodawaj innych sekcji z manifestu.
- Domknij wszystkie listy, tabele i bloki kodu.
- Zwróć wyłącznie Markdown tej sekcji.`
      : `Generate only this section:
${JSON.stringify(section, null, 2)}

Hard rules:
- The first line must be exactly: <!-- section:${section.id} -->
- The second line must be exactly: ## ${section.title}
- Do not add the top-level # document heading.
- Do not add other manifest sections.
- Close every list, table, and code block.
- Return only this section's Markdown.`,
  );

  sections.push(sectionKindInstruction(documentType, section, context.locale));

  return { systemPrompt, userPrompt: sections.join('\n\n') };
}

export function buildContinuationPrompt(
  context: Pick<BuildContext, 'locale'>,
  section: DocumentSectionSpec,
  generatedSoFar: string,
): BuiltPrompt {
  const systemPrompt =
    context.locale === 'pl'
      ? 'Kontynuujesz przerwaną sekcję Markdown. Twoim zadaniem jest dopisać dalszy ciąg, bez powtarzania już wygenerowanej treści.'
      : 'You continue an interrupted Markdown section. Your job is to append the missing continuation without repeating existing content.';

  const userPrompt =
    context.locale === 'pl'
      ? `Sekcja do kontynuacji:
${JSON.stringify(section, null, 2)}

Wygenerowano dotąd:
"""
${generatedSoFar.slice(-12000)}
"""

Kontynuuj dokładnie od następnego znaku. Nie powtarzaj nagłówka, komentarza section ani ostatnich zdań. Nie zaczynaj sekcji od nowa. Zwróć wyłącznie dalszy ciąg Markdown.`
      : `Section to continue:
${JSON.stringify(section, null, 2)}

Already generated:
"""
${generatedSoFar.slice(-12000)}
"""

Continue exactly from the next character. Do not repeat the heading, section comment, or last sentences. Do not restart the section. Return only the Markdown continuation.`;

  return { systemPrompt, userPrompt };
}

export function buildSectionRepairPrompt(
  context: Pick<BuildContext, 'locale'>,
  section: DocumentSectionSpec,
  invalidContent: string,
  validationErrors: string[],
): BuiltPrompt {
  const systemPrompt =
    context.locale === 'pl'
      ? 'Naprawiasz sekcję Markdown tak, żeby spełniała kontrakt manifestu i walidację.'
      : 'You repair a Markdown section so it satisfies the manifest contract and validation.';

  const userPrompt =
    context.locale === 'pl'
      ? `Sekcja:
${JSON.stringify(section, null, 2)}

Błędy walidacji:
${validationErrors.map((error) => `- ${error}`).join('\n')}

Aktualna treść:
"""
${invalidContent}
"""

Zwróć kompletną, poprawioną wersję tej jednej sekcji. Nie streszczaj i nie skracaj aktualnej treści; zachowaj wszystkie wygenerowane decyzje, wymagania, listy i szczegóły, domykając tylko urwane fragmenty. Pierwsza linia: <!-- section:${section.id} -->. Druga linia: ## ${section.title}.`
      : `Section:
${JSON.stringify(section, null, 2)}

Validation errors:
${validationErrors.map((error) => `- ${error}`).join('\n')}

Current content:
"""
${invalidContent}
"""

Return the complete corrected version of this single section. Do not summarize or shorten the current content; preserve all generated decisions, requirements, lists, and details while closing only interrupted fragments. First line: <!-- section:${section.id} -->. Second line: ## ${section.title}.`;

  return { systemPrompt, userPrompt };
}

function buildDocumentContextSections(documentType: DocumentType, context: BuildContext): string[] {
  const sections: string[] = [];

  sections.push(
    context.locale === 'pl'
      ? `Opis projektu:\n"""\n${context.projectDescription}\n"""`
      : `Project description:\n"""\n${context.projectDescription}\n"""`,
  );

  if (context.answers && context.answers.length > 0) {
    const answered = context.answers
      .filter((a) => !a.skipped && a.answer.trim().length > 0)
      .map((a) => {
        const question = a.questionText?.trim();
        return question ? `- (${a.questionId}) ${question}: ${a.answer}` : `- (${a.questionId}) ${a.answer}`;
      })
      .join('\n');
    if (answered.length > 0) {
      sections.push(
        context.locale === 'pl'
          ? `Odpowiedzi na pytania doprecyzowujące:\n${answered}`
          : `Clarifying answers:\n${answered}`,
      );
    }
  }

  if (context.standards && context.standards.trim().length > 0) {
    sections.push(
      context.locale === 'pl'
        ? `Standardy korporacyjne (uwzględnij każdą wskazówkę):\n"""\n${context.standards}\n"""`
        : `Corporate standards (incorporate every guideline):\n"""\n${context.standards}\n"""`,
    );
  }

  if (documentType === 'design' && context.previousDocuments?.requirements) {
    sections.push(
      context.locale === 'pl'
        ? `Wcześniej wygenerowane requirements.md (zachowaj spójność):\n"""\n${context.previousDocuments.requirements}\n"""`
        : `Previously generated requirements.md (maintain consistency):\n"""\n${context.previousDocuments.requirements}\n"""`,
    );
  }
  if (documentType === 'tasks') {
    if (context.previousDocuments?.requirements) {
      sections.push(
        context.locale === 'pl'
          ? `Wcześniej wygenerowane requirements.md:\n"""\n${context.previousDocuments.requirements}\n"""`
          : `Previously generated requirements.md:\n"""\n${context.previousDocuments.requirements}\n"""`,
      );
    }
    if (context.previousDocuments?.design) {
      sections.push(
        context.locale === 'pl'
          ? `Wcześniej wygenerowane design.md:\n"""\n${context.previousDocuments.design}\n"""`
          : `Previously generated design.md:\n"""\n${context.previousDocuments.design}\n"""`,
      );
    }
  }

  return sections;
}

function sectionKindInstruction(
  documentType: DocumentType,
  section: DocumentSectionSpec,
  locale: AppLocale,
): string {
  if (documentType === 'requirements' && section.kind === 'requirements') {
    return locale === 'pl'
      ? 'Każde wymaganie w tej sekcji zapisz jako ### Wymaganie N: Nazwa, dodaj **User Story:** oraz #### Kryteria Akceptacji z minimum 3 numerowanymi kryteriami.'
      : 'Write every requirement in this section as ### Requirement N: Name, include **User Story:** and #### Acceptance Criteria with at least 3 numbered criteria.';
  }
  if (documentType === 'tasks' && section.kind === 'tasks') {
    return locale === 'pl'
      ? 'Zadania zapisuj jako checklistę Markdown - [ ] z opisem i odwołaniem _Wymagania: X.Y_. Zachowaj numerację i kolejność zależności.'
      : 'Write tasks as a Markdown checklist - [ ] with a description and _Requirements: X.Y_ reference. Preserve numbering and dependency order.';
  }
  if (documentType === 'design' && section.kind === 'architecture') {
    return locale === 'pl'
      ? 'Jeśli opisujesz architekturę, dodaj poprawny diagram mermaid i domknij blok kodu.'
      : 'When describing architecture, include a valid mermaid diagram and close the code block.';
  }
  return locale === 'pl'
    ? 'Sekcja ma być kompletna, konkretna i gotowa do użycia w specyfikacji.'
    : 'The section must be complete, concrete, and ready to use in the specification.';
}

/**
 * Buduje prompt dla generowania pytań doprecyzowujących.
 */
export function buildQuestionsPrompt(
  description: string,
  previousAnswers: QuestionAnswer[],
  locale: AppLocale,
): BuiltPrompt {
  let previousAnswersSection = '';
  const answered = previousAnswers.filter((a) => !a.skipped && a.answer.trim().length > 0);
  if (answered.length > 0) {
    previousAnswersSection =
      (locale === 'pl' ? 'Dotychczasowe odpowiedzi:\n' : 'Previous answers:\n') +
      answered.map((a) => `- (${a.questionId}) ${a.answer}`).join('\n');
  }

  const userPrompt = QUESTIONS_USER_TEMPLATE[locale]
    .replace('{description}', description)
    .replace('{previousAnswersSection}', previousAnswersSection);

  return {
    systemPrompt: QUESTIONS_SYSTEM[locale],
    userPrompt,
  };
}

/**
 * Buduje prompt dla generatora standardów dla wybranego profilu aplikacji
 * (Wymaganie 15.4).
 */
export function buildStandardsPrompt(
  profileName: string,
  followUpAnswers: QuestionAnswer[],
  locale: AppLocale,
): BuiltPrompt {
  const systemPrompt =
    locale === 'pl'
      ? 'Jesteś ekspertem od dobrych praktyk inżynierskich. Generujesz pliki standards.md zawierające najlepsze praktyki dla konkretnego typu projektu.'
      : 'You are an expert in engineering best practices. You generate standards.md files containing best practices for a specific project type.';

  const answered = followUpAnswers
    .filter((a) => !a.skipped && a.answer.trim().length > 0)
    .map((a) => {
      const question = a.questionText?.trim();
      if (locale === 'pl') {
        return [
          `- ID: ${a.questionId}`,
          question ? `  Pytanie: ${question}` : null,
          `  Odpowiedź: ${a.answer}`,
        ].filter(Boolean).join('\n');
      }
      return [
        `- ID: ${a.questionId}`,
        question ? `  Question: ${question}` : null,
        `  Answer: ${a.answer}`,
      ].filter(Boolean).join('\n');
    })
    .join('\n');

  const sections =
    locale === 'pl' ? ['Architektura', 'Bezpieczeństwo', 'Testowanie', 'Jakość kodu', 'Dokumentacja', 'CI/CD', 'Dostępność (a11y)', 'Wydajność']
                    : ['Architecture', 'Security', 'Testing', 'Code quality', 'Documentation', 'CI/CD', 'Accessibility (a11y)', 'Performance'];

  const userPrompt =
    locale === 'pl'
      ? `Wygeneruj kompletny plik standards.md dla profilu "${profileName}" zawierający sekcje: ${sections.join(', ')}.

Odpowiedzi użytkownika (ID, pytanie, odpowiedź):
${answered || '(brak)'}

${LOCALE_INSTRUCTION.pl}

Jeżeli odpowiedź użytkownika mówi, że nie wie i prosi o optymalne rozwiązanie, wybierz najlepszą praktykę samodzielnie na podstawie profilu projektu, pozostałych odpowiedzi i aktualnych standardów inżynierskich. Zapisz decyzję konkretnie, bez zostawiania TODO.

Format: Markdown z nagłówkami # i ##, listami punktowymi, blokami kodu gdzie pasuje.`
      : `Generate a complete standards.md file for the "${profileName}" profile with sections: ${sections.join(', ')}.

User answers (ID, question, answer):
${answered || '(none)'}

${LOCALE_INSTRUCTION.en}

If a user answer says they do not know and asks for the optimal solution, choose the best practice yourself based on the project profile, the other answers, and current engineering standards. Write the decision concretely without leaving TODOs.

Format: Markdown with # and ## headings, bullet lists, code blocks where appropriate.`;

  return { systemPrompt, userPrompt };
}
