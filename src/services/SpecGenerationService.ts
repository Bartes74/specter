import type { AIAdapter, ChatMessage, CompleteOptions } from './ai/types';
import { AIAdapterError } from './ai/types';
import {
  buildContinuationPrompt,
  buildDocumentManifestPrompt,
  buildDocumentSectionPrompt,
  buildSectionRepairPrompt,
  type BuildContext,
  type DocumentManifest,
  type DocumentSectionKind,
  type DocumentSectionSpec,
  type DocumentType,
} from './PromptTemplateService';

export type SectionProgressStatus = 'planning' | 'generating' | 'continuing' | 'repairing' | 'complete';

export interface SectionProgress {
  document: DocumentType;
  sectionId: string;
  sectionTitle: string;
  index: number;
  total: number;
  status: SectionProgressStatus;
}

export interface RobustDocumentCallbacks {
  onSectionProgress?: (progress: SectionProgress) => void;
  onSectionComplete?: (document: DocumentType, content: string) => void;
}

interface GenerateRobustDocumentOptions extends RobustDocumentCallbacks {
  manifestOptions: CompleteOptions;
  sectionOptions: CompleteOptions;
  repairOptions: CompleteOptions;
  maxContinuations?: number;
}

const ALLOWED_SECTION_KINDS = new Set<DocumentSectionKind>([
  'intro',
  'glossary',
  'requirements',
  'architecture',
  'components',
  'data',
  'decisions',
  'tasks',
  'quality',
  'other',
]);

const DEFAULT_MAX_CONTINUATIONS = 6;
const MAX_MANIFEST_SECTIONS = 24;
const MIN_SECTION_BODY_CHARS = 120;

export async function generateRobustDocument(
  adapter: AIAdapter,
  documentType: DocumentType,
  context: BuildContext,
  options: GenerateRobustDocumentOptions,
): Promise<string> {
  const manifest = await generateManifest(adapter, documentType, context, options);
  let completedDocument = '';
  const completedSections: string[] = [];

  for (let i = 0; i < manifest.sections.length; i++) {
    const section = manifest.sections[i]!;
    const progressBase = {
      document: documentType,
      sectionId: section.id,
      sectionTitle: section.title,
      index: i + 1,
      total: manifest.sections.length,
    };
    options.onSectionProgress?.({ ...progressBase, status: 'generating' });

    const sectionPrompt = buildDocumentSectionPrompt(
      documentType,
      context,
      manifest,
      section,
      completedDocument,
    );
    let content = await completeWithContinuation(
      adapter,
      promptToMessages(sectionPrompt),
      options.sectionOptions,
      {
        maxContinuations: options.maxContinuations,
        onContinue: () => options.onSectionProgress?.({ ...progressBase, status: 'continuing' }),
        locale: context.locale,
        section,
      },
    );
    content = cleanMarkdownResponse(content);

    let validationErrors = validateGeneratedSection(documentType, section, content);
    if (validationErrors.length > 0) {
      options.onSectionProgress?.({ ...progressBase, status: 'repairing' });
      const repairPrompt = buildSectionRepairPrompt(context, section, content, validationErrors);
      const repaired = cleanMarkdownResponse(
        await completeWithContinuation(
          adapter,
          promptToMessages(repairPrompt),
          options.repairOptions,
          {
            maxContinuations: options.maxContinuations,
            onContinue: () => options.onSectionProgress?.({ ...progressBase, status: 'continuing' }),
            locale: context.locale,
            section,
          },
        ),
      );
      if (isTruncatedRepair(content, repaired)) {
        throw new AIAdapterError(
          `${documentType}.md: naprawa sekcji "${section.title}" skróciła wygenerowaną treść zamiast ją domknąć.`,
          'PARSE_ERROR',
          true,
          content,
        );
      }
      content = repaired;
      validationErrors = validateGeneratedSection(documentType, section, content);
    }

    if (validationErrors.length > 0) {
      throw new AIAdapterError(
        `${documentType}.md: sekcja "${section.title}" nie przeszła walidacji: ${validationErrors.join('; ')}`,
        'PARSE_ERROR',
        true,
      );
    }

    const normalized = content.trim();
    completedSections.push(normalized);
    completedDocument = joinDocument(manifest.title, completedSections);
    options.onSectionComplete?.(documentType, `${normalized}\n\n`);
    options.onSectionProgress?.({ ...progressBase, status: 'complete' });
  }

  return joinDocument(manifest.title, completedSections);
}

export async function completeWithContinuation(
  adapter: AIAdapter,
  initialMessages: ChatMessage[],
  requestOptions: CompleteOptions,
  options: {
    maxContinuations?: number;
    onContinue?: () => void;
    locale: BuildContext['locale'];
    section: DocumentSectionSpec;
  },
): Promise<string> {
  const maxContinuations = options.maxContinuations ?? DEFAULT_MAX_CONTINUATIONS;
  let full = '';
  let messages = initialMessages;

  for (let attempt = 0; attempt <= maxContinuations; attempt++) {
    let attemptContent = '';
    try {
      const result = await adapter.completeStream(
        messages,
        (chunk) => {
          attemptContent += chunk;
        },
        requestOptions,
      );
      const addition = result || attemptContent;
      const combined = appendWithOverlap(full, addition);
      if (full && combined === full && addition.trim().length > 0) {
        if (attempt === maxContinuations) {
          throw new AIAdapterError(
            'Model zakończył kontynuację bez dopisania nowej treści.',
            'TOKEN_LIMIT',
            false,
            full,
          );
        }
        options.onContinue?.();
        messages = buildContinuationMessages(initialMessages, options, options.section, full, true);
        continue;
      }
      return combined;
    } catch (err) {
      if (!(err instanceof AIAdapterError) || err.code !== 'TOKEN_LIMIT') {
        throw err;
      }
      const partial = err.partialContent ?? attemptContent;
      if (!partial.trim()) {
        throw new AIAdapterError(
          'Model osiągnął limit tokenów, ale nie zwrócił treści do kontynuacji.',
          'TOKEN_LIMIT',
          false,
          full,
        );
      }
      const before = full;
      full = appendWithOverlap(full, partial);
      if (full === before) {
        throw new AIAdapterError(
          'Model osiągnął limit tokenów bez postępu w kontynuacji.',
          'TOKEN_LIMIT',
          false,
          full,
        );
      }
      if (attempt === maxContinuations) {
        throw new AIAdapterError(
          'Generator przekroczył limit automatycznych kontynuacji dla jednej sekcji.',
          'TOKEN_LIMIT',
          false,
          full,
        );
      }
      options.onContinue?.();
      messages = buildContinuationMessages(initialMessages, options, options.section, full);
    }
  }

  return full;
}

export function appendWithOverlap(existing: string, addition: string): string {
  if (!existing) return addition;
  if (!addition) return existing;
  const normalizedExisting = normalizeNewlines(existing);
  let normalizedAddition = normalizeNewlines(addition);
  if (normalizedAddition.trim().length > 80 && normalizedExisting.includes(normalizedAddition.trim())) {
    return existing;
  }

  const strippedRestart = stripRepeatedSectionStart(normalizedExisting, normalizedAddition);
  if (strippedRestart !== normalizedAddition) {
    normalizedAddition = strippedRestart;
    if (!normalizedAddition) return existing;
    if (!normalizedExisting.endsWith('\n') && !normalizedAddition.startsWith('\n')) {
      normalizedAddition = `\n${normalizedAddition}`;
    }
  }

  const maxOverlap = Math.min(4000, normalizedExisting.length, normalizedAddition.length);
  for (let length = maxOverlap; length > 0; length--) {
    if (normalizedExisting.endsWith(normalizedAddition.slice(0, length))) {
      return normalizedExisting + normalizedAddition.slice(length);
    }
  }

  for (let length = maxOverlap; length >= 80; length--) {
    const needle = normalizedExisting.slice(-length);
    const index = normalizedAddition.indexOf(needle);
    if (index >= 0) {
      return normalizedExisting + normalizedAddition.slice(index + length);
    }
  }

  return normalizedExisting + normalizedAddition;
}

export function validateGeneratedSection(
  documentType: DocumentType,
  section: DocumentSectionSpec,
  content: string,
): string[] {
  const errors: string[] = [];
  const trimmed = content.trim();
  if (!trimmed) {
    return ['section.empty'];
  }
  if (!trimmed.includes(`<!-- section:${section.id} -->`)) {
    errors.push('section.idMissing');
  }
  if (countOccurrences(trimmed, `<!-- section:${section.id} -->`) > 1) {
    errors.push('section.idDuplicated');
  }
  const headingPattern = new RegExp(`^##\\s+${escapeRegExp(section.title)}\\s*$`, 'mi');
  if (!headingPattern.test(trimmed)) {
    errors.push('section.headingMissing');
  }
  const headingCount = (trimmed.match(new RegExp(`^##\\s+${escapeRegExp(section.title)}\\s*$`, 'gmi')) ?? []).length;
  if (headingCount > 1) {
    errors.push('section.headingDuplicated');
  }
  if (!hasBalancedCodeFences(trimmed)) {
    errors.push('markdown.codeFenceUnclosed');
  }
  if (sectionBody(trimmed, section).replace(/\s+/g, ' ').trim().length < MIN_SECTION_BODY_CHARS) {
    errors.push('section.bodyTooShort');
  }

  if (documentType === 'requirements' && section.kind === 'requirements') {
    const requirementCount = (trimmed.match(/^###\s+(Wymaganie|Requirement)\b/gim) ?? []).length;
    const storyCount = (trimmed.match(/\*\*User Story:\*\*|User Story:|Historia użytkownika:/gi) ?? []).length;
    const criteriaCount = (trimmed.match(/^\s*\d+\.\s+\S/gm) ?? []).length;
    if (requirementCount < 1) errors.push('requirements.headingMissing');
    if (storyCount < requirementCount) errors.push('requirements.userStoryMissing');
    if (criteriaCount < Math.max(3, requirementCount * 3)) errors.push('requirements.criteriaMissing');
  }

  if (documentType === 'tasks' && section.kind === 'tasks') {
    const taskCount = (trimmed.match(/^\s*-\s+\[\s?\]\s+/gm) ?? []).length;
    const referenceCount = (trimmed.match(/_Wymagania:\s*[^_]+_|_Requirements:\s*[^_]+_/gi) ?? []).length;
    if (taskCount < 1) errors.push('tasks.checklistMissing');
    if (referenceCount < 1) errors.push('tasks.requirementReferenceMissing');
  }

  return errors;
}

function buildContinuationMessages(
  initialMessages: ChatMessage[],
  context: Pick<BuildContext, 'locale'>,
  section: DocumentSectionSpec,
  generatedSoFar: string,
  strict = false,
): ChatMessage[] {
  const continuationPrompt = buildContinuationPrompt(context, section, generatedSoFar);
  const systemMessages = initialMessages.filter((message) => message.role === 'system');
  const conversation = initialMessages.filter((message) => message.role !== 'system');
  const instruction =
    context.locale === 'pl'
      ? [
          'Kontynuuj dokładnie od następnego znaku poprzedniej wiadomości asystenta.',
          'Nie zaczynaj sekcji od nowa, nie powtarzaj komentarza section, nagłówka ani wcześniejszych zdań.',
          'Jeżeli poprzednia wiadomość urywa zdanie, listę, tabelę albo blok kodu, dokończ go i dopiero potem kontynuuj.',
          'Zwróć wyłącznie brakujący dalszy ciąg Markdown.',
          strict ? 'Poprzednia próba nie dopisała nowej treści; tym razem zacznij od realnego dalszego fragmentu, nie od nagłówka.' : '',
        ]
          .filter(Boolean)
          .join(' ')
      : [
          'Continue exactly from the next character after the previous assistant message.',
          'Do not restart the section, do not repeat the section comment, heading, or prior sentences.',
          'If the previous message cuts off a sentence, list, table, or code block, finish it and then continue.',
          'Return only the missing Markdown continuation.',
          strict ? 'The previous attempt added no new content; start with the real next fragment, not the heading.' : '',
        ]
          .filter(Boolean)
          .join(' ');

  return [
    {
      role: 'system',
      content: [
        systemMessages.map((message) => message.content).join('\n\n'),
        continuationPrompt.systemPrompt,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
    ...conversation,
    { role: 'assistant', content: generatedSoFar.slice(-12000) },
    { role: 'user', content: instruction },
  ];
}

function sectionBody(content: string, section: DocumentSectionSpec): string {
  const lines = normalizeNewlines(content).split('\n');
  let index = 0;
  while (index < lines.length && lines[index]?.trim() === '') index++;
  if (lines[index]?.trim() === `<!-- section:${section.id} -->`) index++;
  while (index < lines.length && lines[index]?.trim() === '') index++;
  if (lines[index]?.trim() === `## ${section.title}`) index++;
  return lines.slice(index).join('\n');
}

function isTruncatedRepair(original: string, repaired: string): boolean {
  const originalBody = original.replace(/\s+/g, ' ').trim();
  const repairedBody = repaired.replace(/\s+/g, ' ').trim();
  if (originalBody.length < 500) return false;
  if (repairedBody.length < MIN_SECTION_BODY_CHARS) return true;
  return repairedBody.length < originalBody.length * 0.55;
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, '\n');
}

function stripRepeatedSectionStart(existing: string, addition: string): string {
  const existingStart = firstSectionStart(existing);
  if (!existingStart) return addition;

  const lines = addition.split('\n');
  let index = 0;
  while (index < lines.length && lines[index]?.trim() === '') index++;

  let stripped = false;
  if (existingStart.marker && lines[index]?.trim() === existingStart.marker) {
    index++;
    stripped = true;
  }
  while (index < lines.length && lines[index]?.trim() === '') index++;
  if (existingStart.heading && lines[index]?.trim() === existingStart.heading) {
    index++;
    stripped = true;
  }
  while (stripped && index < lines.length && lines[index]?.trim() === '') index++;

  return stripped ? lines.slice(index).join('\n') : addition;
}

function firstSectionStart(content: string): { marker: string | null; heading: string | null } | null {
  const lines = content.split('\n');
  let index = 0;
  while (index < lines.length && lines[index]?.trim() === '') index++;
  const marker = lines[index]?.trim().match(/^<!--\s*section:[^>]+-->$/) ? lines[index]!.trim() : null;
  if (marker) index++;
  while (index < lines.length && lines[index]?.trim() === '') index++;
  const heading = lines[index]?.trim().startsWith('## ') ? lines[index]!.trim() : null;
  if (!marker && !heading) return null;
  return { marker, heading };
}

async function generateManifest(
  adapter: AIAdapter,
  documentType: DocumentType,
  context: BuildContext,
  options: Pick<GenerateRobustDocumentOptions, 'manifestOptions' | 'onSectionProgress'>,
): Promise<DocumentManifest> {
  options.onSectionProgress?.({
    document: documentType,
    sectionId: 'manifest',
    sectionTitle: 'Manifest',
    index: 0,
    total: 0,
    status: 'planning',
  });

  const prompt = buildDocumentManifestPrompt(documentType, context);
  let raw = '';
  try {
    raw = await adapter.complete(promptToMessages(prompt), options.manifestOptions);
  } catch (err) {
    if (err instanceof AIAdapterError && err.code === 'TOKEN_LIMIT' && err.partialContent) {
      raw = err.partialContent;
    } else {
      throw err;
    }
  }

  const parsed = parseManifest(raw);
  return normalizeManifest(documentType, parsed ?? fallbackManifest(documentType, context.locale), context.locale);
}

function promptToMessages(prompt: { systemPrompt: string; userPrompt: string }): ChatMessage[] {
  return [
    { role: 'system', content: prompt.systemPrompt },
    { role: 'user', content: prompt.userPrompt },
  ];
}

function parseManifest(raw: string): DocumentManifest | null {
  const candidate = extractJson(raw);
  if (!candidate) return null;
  try {
    const parsed = JSON.parse(candidate) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.sections)) return null;
    return {
      title: typeof record.title === 'string' ? record.title : '',
      sections: record.sections
        .map((section) => normalizeSectionCandidate(section))
        .filter((section): section is DocumentSectionSpec => section !== null),
    };
  } catch {
    return null;
  }
}

function normalizeManifest(
  documentType: DocumentType,
  manifest: DocumentManifest,
  locale: BuildContext['locale'],
): DocumentManifest {
  const fallback = fallbackManifest(documentType, locale);
  const title = manifest.title.trim() || fallback.title;
  const sections = manifest.sections
    .map((section, index) => ({
      ...section,
      id: sanitizeSectionId(section.id || section.title || `section-${index + 1}`),
      title: section.title.trim() || `Sekcja ${index + 1}`,
      goal: section.goal.trim() || section.title.trim(),
      mustInclude: section.mustInclude.filter((item) => item.trim().length > 0),
    }))
    .filter((section) => section.title.length > 0)
    .slice(0, MAX_MANIFEST_SECTIONS);

  return {
    title,
    sections: sections.length >= 1 ? sections : fallback.sections,
  };
}

function normalizeSectionCandidate(raw: unknown): DocumentSectionSpec | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const kind = typeof record.kind === 'string' && ALLOWED_SECTION_KINDS.has(record.kind as DocumentSectionKind)
    ? record.kind as DocumentSectionKind
    : 'other';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const id = typeof record.id === 'string' ? record.id.trim() : title;
  if (!title && !id) return null;
  return {
    id: sanitizeSectionId(id || title),
    title: title || id,
    kind,
    goal: typeof record.goal === 'string' ? record.goal.trim() : title,
    mustInclude: Array.isArray(record.mustInclude)
      ? record.mustInclude.filter((item): item is string => typeof item === 'string')
      : [],
  };
}

function fallbackManifest(documentType: DocumentType, locale: BuildContext['locale']): DocumentManifest {
  if (documentType === 'requirements') {
    return {
      title: locale === 'pl' ? 'Wymagania' : 'Requirements',
      sections: [
        section('introduction', locale === 'pl' ? 'Wprowadzenie' : 'Introduction', 'intro'),
        section('glossary', locale === 'pl' ? 'Słownik' : 'Glossary', 'glossary'),
        section('core-requirements', locale === 'pl' ? 'Wymagania główne' : 'Core Requirements', 'requirements'),
        section('operational-requirements', locale === 'pl' ? 'Wymagania operacyjne' : 'Operational Requirements', 'requirements'),
        section('quality-requirements', locale === 'pl' ? 'Wymagania jakościowe' : 'Quality Requirements', 'requirements'),
      ],
    };
  }
  if (documentType === 'design') {
    return {
      title: locale === 'pl' ? 'Projekt techniczny' : 'Technical Design',
      sections: [
        section('overview', locale === 'pl' ? 'Przegląd' : 'Overview', 'intro'),
        section('architecture', locale === 'pl' ? 'Architektura' : 'Architecture', 'architecture'),
        section('components', locale === 'pl' ? 'Komponenty' : 'Components', 'components'),
        section('data-models', locale === 'pl' ? 'Modele danych' : 'Data Models', 'data'),
        section('design-decisions', locale === 'pl' ? 'Decyzje projektowe' : 'Design Decisions', 'decisions'),
      ],
    };
  }
  return {
    title: locale === 'pl' ? 'Plan zadań' : 'Task Plan',
    sections: [
      section('overview', locale === 'pl' ? 'Przegląd' : 'Overview', 'intro'),
      section('foundation-tasks', locale === 'pl' ? 'Zadania fundamentów' : 'Foundation Tasks', 'tasks'),
      section('feature-tasks', locale === 'pl' ? 'Zadania funkcjonalne' : 'Feature Tasks', 'tasks'),
      section('quality-tasks', locale === 'pl' ? 'Zadania jakościowe' : 'Quality Tasks', 'tasks'),
    ],
  };
}

function section(id: string, title: string, kind: DocumentSectionKind): DocumentSectionSpec {
  return {
    id,
    title,
    kind,
    goal: title,
    mustInclude: [],
  };
}

function joinDocument(title: string, sections: string[]): string {
  return [`# ${title.trim()}`, ...sections].join('\n\n').trim() + '\n';
}

function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]?.trim()) return fenced[1].trim();
  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return raw.slice(objectStart, objectEnd + 1);
  }
  return null;
}

function cleanMarkdownResponse(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

function hasBalancedCodeFences(content: string): boolean {
  const fences = content
    .split('\n')
    .filter((line) => line.trim().startsWith('```')).length;
  return fences % 2 === 0;
}

function sanitizeSectionId(input: string): string {
  const normalized = input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'section';
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = 0;
  while (index >= 0) {
    index = haystack.indexOf(needle, index);
    if (index >= 0) {
      count++;
      index += needle.length;
    }
  }
  return count;
}
