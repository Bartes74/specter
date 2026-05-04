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

Wygeneruj 3-7 pytań doprecyzowujących, które pomogą zrozumieć: docelowych użytkowników, główne funkcjonalności, ograniczenia (czas, budżet, technologia), kryteria sukcesu. Gdy typowe odpowiedzi są przewidywalne, dodaj 2-4 krótkie suggestedAnswers.
Zwróć JSON-em w formacie:
{ "questions": [ { "id": "q1", "text": "...", "hint": "...", "isRequired": true, "suggestedAnswers": [ { "id": "s1", "label": "...", "value": "..." } ] } ] }`,
  en: `User's project description:
"""
{description}
"""

{previousAnswersSection}

Generate 3-7 clarifying questions that help understand: target users, main features, constraints (time, budget, technology), success criteria. When common answers are predictable, include 2-4 short suggestedAnswers.
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

  const sections: string[] = [];

  sections.push(
    context.locale === 'pl'
      ? `Opis projektu:\n"""\n${context.projectDescription}\n"""`
      : `Project description:\n"""\n${context.projectDescription}\n"""`,
  );

  if (context.answers && context.answers.length > 0) {
    const answered = context.answers
      .filter((a) => !a.skipped && a.answer.trim().length > 0)
      .map((a) => `- (${a.questionId}) ${a.answer}`)
      .join('\n');
    if (answered.length > 0) {
      sections.push(
        context.locale === 'pl'
          ? `Odpowiedzi na pytania doprecyzowujące:\n${answered}`
          : `Clarifying answers:\n${answered}`,
      );
    }
  }

  // Property 4 — standardy włączane warunkowo
  if (context.standards && context.standards.trim().length > 0) {
    sections.push(
      context.locale === 'pl'
        ? `Standardy korporacyjne (uwzględnij każdą wskazówkę):\n"""\n${context.standards}\n"""`
        : `Corporate standards (incorporate every guideline):\n"""\n${context.standards}\n"""`,
    );
  }

  // Sekwencyjne generowanie: design otrzymuje requirements, tasks otrzymuje requirements + design
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
    .map((a) => `- (${a.questionId}) ${a.answer}`)
    .join('\n');

  const sections =
    locale === 'pl' ? ['Architektura', 'Bezpieczeństwo', 'Testowanie', 'Jakość kodu', 'Dokumentacja', 'CI/CD', 'Dostępność (a11y)', 'Wydajność']
                    : ['Architecture', 'Security', 'Testing', 'Code quality', 'Documentation', 'CI/CD', 'Accessibility (a11y)', 'Performance'];

  const userPrompt =
    locale === 'pl'
      ? `Wygeneruj kompletny plik standards.md dla profilu "${profileName}" zawierający sekcje: ${sections.join(', ')}.

Odpowiedzi użytkownika:
${answered || '(brak)'}

${LOCALE_INSTRUCTION.pl}

Format: Markdown z nagłówkami # i ##, listami punktowymi, blokami kodu gdzie pasuje.`
      : `Generate a complete standards.md file for the "${profileName}" profile with sections: ${sections.join(', ')}.

User answers:
${answered || '(none)'}

${LOCALE_INSTRUCTION.en}

Format: Markdown with # and ## headings, bullet lists, code blocks where appropriate.`;

  return { systemPrompt, userPrompt };
}
