/**
 * FileSystemService — operacje na systemie plików (Zadanie 4.1).
 *
 * Wymagania: 1.4, 1.7-1.10, 6.1, 6.3, 15.6
 *
 * Walidacja ścieżki zapobiega path traversal i sprawdza prawo zapisu.
 * Wszystkie operacje są asynchroniczne i odporne na typowe błędy I/O.
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { constants as fsConstants } from 'node:fs';
import os from 'node:os';
import { validateProjectName } from '@/lib/validation';
import { sanitizeLogs } from '@/lib/security';
import { projectSnapshotSchema } from '@/lib/api-schemas';
import type { ProjectSnapshotInput } from '@/lib/api-schemas';
import type { LoadedProjectWorkspace, ProjectSnapshot } from '@/types/project';

export interface PathValidationResult {
  valid: boolean;
  exists: boolean;
  writable: boolean;
  hasStandards: boolean;
  standardsPreview?: string;
  error?: string;
}

export const STANDARDS_FILENAME = 'standards.md';
export const DOCS_DIRNAME = 'docs';
export const OLD_DOCS_DIRNAME = 'old_docs';
export const PROJECT_STATE_DIRNAME = '.spec-generator';
export const PROJECT_STATE_FILENAME = 'project.json';
export const STANDARDS_PREVIEW_LENGTH = 500;

const SUSPICIOUS_PATH_SEGMENTS = ['..', '~'];

/**
 * Rozwija "~" do katalogu domowego użytkownika i normalizuje ścieżkę.
 */
function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

/**
 * Sprawdza czy ścieżka nie zawiera podejrzanych segmentów relatywnych.
 * Zwraca null jeśli OK, inaczej tekst błędu.
 */
function rejectPathTraversal(absolutePath: string): string | null {
  const segments = absolutePath.split(path.sep);
  for (const segment of segments) {
    if (SUSPICIOUS_PATH_SEGMENTS.includes(segment)) {
      return `path.suspiciousSegment:${segment}`;
    }
  }
  return null;
}

/**
 * Waliduje ścieżkę projektu — sprawdza istnienie i prawo zapisu.
 * Zwraca też informację o standards.md (jeśli istnieje).
 *
 * Wymaganie 1.7, 1.8, 1.9, 6.1, 6.4
 */
export async function validatePath(rawPath: string): Promise<PathValidationResult> {
  if (typeof rawPath !== 'string' || rawPath.trim().length === 0) {
    return {
      valid: false,
      exists: false,
      writable: false,
      hasStandards: false,
      error: 'path.empty',
    };
  }

  const expanded = expandHome(rawPath.trim());
  const absolute = path.resolve(expanded);

  const traversalError = rejectPathTraversal(absolute);
  if (traversalError) {
    return {
      valid: false,
      exists: false,
      writable: false,
      hasStandards: false,
      error: traversalError,
    };
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(absolute);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return {
        valid: false,
        exists: false,
        writable: false,
        hasStandards: false,
        error: 'path.notFound',
      };
    }
    return {
      valid: false,
      exists: false,
      writable: false,
      hasStandards: false,
      error: 'path.statFailed',
    };
  }

  if (!stat.isDirectory()) {
    return {
      valid: false,
      exists: true,
      writable: false,
      hasStandards: false,
      error: 'path.notDirectory',
    };
  }

  // Sprawdź prawo zapisu
  let writable = false;
  try {
    await fs.access(absolute, fsConstants.W_OK);
    writable = true;
  } catch {
    writable = false;
  }

  if (!writable) {
    return {
      valid: false,
      exists: true,
      writable: false,
      hasStandards: false,
      error: 'path.notWritable',
    };
  }

  // Sprawdź standards.md
  const standardsPath = path.join(absolute, STANDARDS_FILENAME);
  let hasStandards = false;
  let standardsPreview: string | undefined;
  try {
    const content = await fs.readFile(standardsPath, 'utf-8');
    if (content.trim().length > 0) {
      hasStandards = true;
      standardsPreview = content.slice(0, STANDARDS_PREVIEW_LENGTH);
    }
  } catch {
    // brak pliku — to OK
  }

  return {
    valid: true,
    exists: true,
    writable: true,
    hasStandards,
    standardsPreview,
  };
}

/**
 * Czyta pełną treść standards.md (Wymaganie 6.2).
 * Zwraca null jeśli brak lub pusty.
 */
export async function readStandards(projectPath: string): Promise<string | null> {
  const absolute = path.resolve(expandHome(projectPath));
  if (rejectPathTraversal(absolute)) return null;
  try {
    const content = await fs.readFile(path.join(absolute, STANDARDS_FILENAME), 'utf-8');
    return content.trim().length > 0 ? content : null;
  } catch {
    return null;
  }
}

/**
 * Zapisuje wygenerowany standards.md w katalogu projektu (Wymaganie 15.6).
 */
export async function saveStandards(projectPath: string, content: string): Promise<void> {
  if (content.trim().length === 0) {
    throw new Error('standards.empty');
  }
  const absolute = path.resolve(expandHome(projectPath));
  if (rejectPathTraversal(absolute)) {
    throw new Error('path.suspiciousSegment');
  }
  await fs.writeFile(path.join(absolute, STANDARDS_FILENAME), content, 'utf-8');
}

/**
 * Czyta metadane projektu zapisane przez Spec Generator.
 * Plik nie zawiera kluczy API; jeśli jest uszkodzony, zwracamy null.
 */
export async function readProjectSnapshot(projectPath: string): Promise<ProjectSnapshot | null> {
  const absolute = path.resolve(expandHome(projectPath));
  if (rejectPathTraversal(absolute)) return null;
  try {
    const raw = await fs.readFile(projectStatePath(absolute), 'utf-8');
    const parsed = projectSnapshotSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return normalizeProjectSnapshot(parsed.data);
  } catch {
    return null;
  }
}

/**
 * Zapisuje metadane projektu obok katalogu projektu, bez klucza API.
 */
export async function saveProjectSnapshot(
  projectPath: string,
  snapshot: ProjectSnapshot,
): Promise<string> {
  const absolute = path.resolve(expandHome(projectPath));
  if (rejectPathTraversal(absolute)) {
    throw new Error('path.suspiciousSegment');
  }
  const stateDir = path.join(absolute, PROJECT_STATE_DIRNAME);
  await fs.mkdir(stateDir, { recursive: true, mode: 0o700 });
  const content = sanitizeLogs(JSON.stringify(snapshot, null, 2));
  const filePath = projectStatePath(absolute);
  await fs.writeFile(filePath, content, { encoding: 'utf-8', mode: 0o600 });
  return filePath;
}

/**
 * Wczytuje pełny workspace projektu: snapshot, obecne docs/*.md i standards.md.
 */
export async function readProjectWorkspace(projectPath: string): Promise<LoadedProjectWorkspace> {
  return {
    projectState: await readProjectSnapshot(projectPath),
    documents: {
      requirements: await readDocument(projectPath, 'requirements.md'),
      design: await readDocument(projectPath, 'design.md'),
      tasks: await readDocument(projectPath, 'tasks.md'),
    },
    standards: await readStandards(projectPath),
  };
}

/**
 * Tworzy katalog /docs jeśli nie istnieje (Wymaganie 1.10).
 */
export async function ensureDocsDirectory(projectPath: string): Promise<string> {
  const absolute = path.resolve(expandHome(projectPath));
  if (rejectPathTraversal(absolute)) {
    throw new Error('path.suspiciousSegment');
  }
  const docsPath = path.join(absolute, DOCS_DIRNAME);
  await fs.mkdir(docsPath, { recursive: true });
  return docsPath;
}

/**
 * Zapisuje dokument w katalogu /docs projektu.
 * Zapobiega zapisom poza /docs (filename nie może zawierać "/" ani "..").
 */
export async function saveDocument(
  projectPath: string,
  filename: string,
  content: string,
): Promise<string> {
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    throw new Error('filename.illegal');
  }
  const docsPath = await ensureDocsDirectory(projectPath);
  const filePath = path.join(docsPath, filename);
  await fs.writeFile(filePath, content, 'utf-8');
  return filePath;
}

/**
 * Przenosi istniejące wersje dokumentów z /docs do /old_docs.
 * Nazwa archiwum zawiera datę modyfikacji oryginalnego pliku.
 */
export async function archiveExistingDocuments(
  projectPath: string,
  filenames: string[],
): Promise<string[]> {
  const absolute = path.resolve(expandHome(projectPath));
  if (rejectPathTraversal(absolute)) {
    throw new Error('path.suspiciousSegment');
  }
  const archived: string[] = [];
  const docsPath = path.join(absolute, DOCS_DIRNAME);
  const oldDocsPath = path.join(absolute, OLD_DOCS_DIRNAME);

  for (const filename of filenames) {
    if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
      throw new Error('filename.illegal');
    }
    const source = path.join(docsPath, filename);
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(source);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    await fs.mkdir(oldDocsPath, { recursive: true });
    const destination = await nextArchivePath(oldDocsPath, filename, stat.mtime);
    await fs.rename(source, destination);
    archived.push(destination);
  }

  return archived;
}

/**
 * Czyta dokument z katalogu /docs projektu (np. do pre-load przy edycji).
 */
export async function readDocument(
  projectPath: string,
  filename: string,
): Promise<string | null> {
  if (filename.includes('/') || filename.includes('\\') || filename.includes('..')) {
    return null;
  }
  const absolute = path.resolve(expandHome(projectPath));
  if (rejectPathTraversal(absolute)) return null;
  try {
    return await fs.readFile(path.join(absolute, DOCS_DIRNAME, filename), 'utf-8');
  } catch {
    return null;
  }
}

function projectStatePath(projectAbsolutePath: string): string {
  return path.join(projectAbsolutePath, PROJECT_STATE_DIRNAME, PROJECT_STATE_FILENAME);
}

async function nextArchivePath(
  oldDocsPath: string,
  filename: string,
  modifiedAt: Date,
): Promise<string> {
  const parsed = path.parse(filename);
  const timestamp = formatArchiveTimestamp(modifiedAt);
  const base = `${parsed.name}_${timestamp}${parsed.ext || '.md'}`;
  let candidate = path.join(oldDocsPath, base);
  let counter = 2;
  while (await exists(candidate)) {
    candidate = path.join(oldDocsPath, `${parsed.name}_${timestamp}_${counter}${parsed.ext || '.md'}`);
    counter += 1;
  }
  return candidate;
}

async function exists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(() => true).catch(() => false);
}

function formatArchiveTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + '_' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join('-');
}

function normalizeProjectSnapshot(raw: ProjectSnapshotInput): ProjectSnapshot {
  return {
    ...raw,
    schemaVersion: 1,
    questions: raw.questions ?? [],
    answers: raw.answers ?? [],
    standardsGeneration: raw.standardsGeneration
      ? {
          selectedProfileId: raw.standardsGeneration.selectedProfileId,
          followUpAnswers: raw.standardsGeneration.followUpAnswers ?? [],
          draftContent: raw.standardsGeneration.draftContent,
        }
      : undefined,
    documentHistory: {
      requirements: raw.documentHistory?.requirements ?? [],
      design: raw.documentHistory?.design ?? [],
      tasks: raw.documentHistory?.tasks ?? [],
    },
    handledDocumentSuggestionKeys: raw.handledDocumentSuggestionKeys ?? [],
    documentSuggestions: raw.documentSuggestions ?? [],
    documentSuggestionIteration: raw.documentSuggestionIteration ?? 0,
  };
}

/**
 * Tworzy nowy folder projektu (Wymaganie 1.4, 1.9).
 *
 * @returns absolutną ścieżkę do utworzonego projektu
 * @throws gdy nazwa nielegalna, brak uprawnień lub folder już istnieje
 */
export async function createProject(parentPath: string, projectName: string): Promise<string> {
  const nameValidation = validateProjectName(projectName);
  if (!nameValidation.valid) {
    throw new Error(nameValidation.error ?? 'name.invalid');
  }

  const parentAbsolute = path.resolve(expandHome(parentPath));
  if (rejectPathTraversal(parentAbsolute)) {
    throw new Error('path.suspiciousSegment');
  }

  // Sprawdź że parent istnieje i jest writable
  let parentStat;
  try {
    parentStat = await fs.stat(parentAbsolute);
  } catch {
    throw new Error('parent.notFound');
  }
  if (!parentStat.isDirectory()) throw new Error('parent.notDirectory');

  await fs.access(parentAbsolute, fsConstants.W_OK);

  const projectPath = path.join(parentAbsolute, projectName.trim());

  // Sprawdź że folder docelowy nie istnieje (mkdir z recursive nie zwraca błędu, ale chcemy odrzucić nadpisanie)
  try {
    await fs.access(projectPath);
    throw new Error('project.alreadyExists');
  } catch (err) {
    if ((err as Error).message === 'project.alreadyExists') throw err;
    // ENOENT = OK, folder nie istnieje
  }

  await fs.mkdir(projectPath, { recursive: false });
  return projectPath;
}
