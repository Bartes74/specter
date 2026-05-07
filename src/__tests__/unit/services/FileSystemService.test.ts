/**
 * Testy jednostkowe FileSystemService — używają prawdziwego FS w katalogu tymczasowym.
 *
 * Validates: Wymagania 1.4, 1.7-1.10, 6.1, 15.6
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import os from 'node:os';
import {
  validatePath,
  readStandards,
  saveStandards,
  ensureDocsDirectory,
  saveDocument,
  readDocument,
  createProject,
  saveProjectSnapshot,
  deleteGeneratedProjectArtifacts,
  STANDARDS_FILENAME,
  DOCS_DIRNAME,
  OLD_DOCS_DIRNAME,
  PROJECT_STATE_DIRNAME,
} from '@/services/FileSystemService';
import type { ProjectSnapshot } from '@/types/project';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'specgen-fs-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('validatePath', () => {
  it('zwraca valid=true dla istniejącego, zapisywalnego katalogu', async () => {
    const result = await validatePath(tmpDir);
    expect(result.valid).toBe(true);
    expect(result.exists).toBe(true);
    expect(result.writable).toBe(true);
    expect(result.hasStandards).toBe(false);
  });

  it('wykrywa istniejący standards.md i zwraca preview', async () => {
    const content = 'a'.repeat(1000);
    await fs.writeFile(path.join(tmpDir, STANDARDS_FILENAME), content);
    const result = await validatePath(tmpDir);
    expect(result.hasStandards).toBe(true);
    expect(result.standardsPreview).toHaveLength(500);
  });

  it('zwraca path.notFound dla nieistniejącej ścieżki', async () => {
    const result = await validatePath('/this/path/does/not/exist/nowhere');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('path.notFound');
  });

  it('zwraca path.notDirectory gdy ścieżka wskazuje plik', async () => {
    const file = path.join(tmpDir, 'a-file.txt');
    await fs.writeFile(file, 'hi');
    const result = await validatePath(file);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('path.notDirectory');
  });

  it('odrzuca pustą ścieżkę', async () => {
    expect((await validatePath('')).error).toBe('path.empty');
    expect((await validatePath('   ')).error).toBe('path.empty');
  });

  it('rozwija ~ do katalogu domowego', async () => {
    const result = await validatePath('~');
    expect(result.exists).toBe(true);
    // Nie wymagamy writable=true (czasem $HOME ma restrykcje), ale exists na pewno
  });
});

describe('readStandards', () => {
  it('zwraca null gdy plik nie istnieje', async () => {
    expect(await readStandards(tmpDir)).toBeNull();
  });

  it('zwraca null gdy plik jest pusty (po trim)', async () => {
    await fs.writeFile(path.join(tmpDir, STANDARDS_FILENAME), '   \n\n  ');
    expect(await readStandards(tmpDir)).toBeNull();
  });

  it('zwraca pełną treść gdy plik niepusty', async () => {
    const content = '# Standardy\n\nWszystko po REST.';
    await fs.writeFile(path.join(tmpDir, STANDARDS_FILENAME), content);
    expect(await readStandards(tmpDir)).toBe(content);
  });
});

describe('saveStandards', () => {
  it('zapisuje plik standards.md w katalogu projektu', async () => {
    const content = '# Wygenerowane standardy';
    await saveStandards(tmpDir, content);
    const onDisk = await fs.readFile(path.join(tmpDir, STANDARDS_FILENAME), 'utf-8');
    expect(onDisk).toBe(content);
  });

  it('odrzuca pusty plik standards.md', async () => {
    await expect(saveStandards(tmpDir, '   \n\n')).rejects.toThrow('standards.empty');
  });
});

describe('ensureDocsDirectory + saveDocument + readDocument', () => {
  it('tworzy /docs i zapisuje dokument', async () => {
    const docsPath = await ensureDocsDirectory(tmpDir);
    expect(docsPath).toBe(path.join(tmpDir, DOCS_DIRNAME));
    const stat = await fs.stat(docsPath);
    expect(stat.isDirectory()).toBe(true);

    await saveDocument(tmpDir, 'requirements.md', '# Wymagania');
    const content = await readDocument(tmpDir, 'requirements.md');
    expect(content).toBe('# Wymagania');
  });

  it('odrzuca filename z separatorem ścieżki (path traversal)', async () => {
    await expect(saveDocument(tmpDir, '../escape.md', 'x')).rejects.toThrow('filename.illegal');
    await expect(saveDocument(tmpDir, 'sub/file.md', 'x')).rejects.toThrow('filename.illegal');
  });

  it('readDocument zwraca null dla nieistniejącego pliku', async () => {
    await ensureDocsDirectory(tmpDir);
    expect(await readDocument(tmpDir, 'nope.md')).toBeNull();
  });
});

describe('createProject', () => {
  it('tworzy nowy folder w lokalizacji rodzica', async () => {
    const projectPath = await createProject(tmpDir, 'moj-projekt');
    expect(projectPath).toBe(path.join(tmpDir, 'moj-projekt'));
    const stat = await fs.stat(projectPath);
    expect(stat.isDirectory()).toBe(true);
  });

  it('odrzuca nazwę z niedozwolonymi znakami', async () => {
    await expect(createProject(tmpDir, 'a/b')).rejects.toThrow();
    await expect(createProject(tmpDir, 'CON')).rejects.toThrow();
  });

  it('odrzuca gdy folder już istnieje (nie nadpisuje)', async () => {
    await fs.mkdir(path.join(tmpDir, 'existing'));
    await expect(createProject(tmpDir, 'existing')).rejects.toThrow('project.alreadyExists');
  });

  it('odrzuca gdy parent nie istnieje', async () => {
    await expect(createProject('/nonexistent/path/here', 'whatever')).rejects.toThrow(
      'parent.notFound',
    );
  });
});

describe('deleteGeneratedProjectArtifacts', () => {
  const snapshot = (overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot => ({
    schemaVersion: 1,
    updatedAt: '2026-05-05T10:00:00.000Z',
    locale: 'pl',
    projectDescription: 'Projekt testowy z wygenerowanymi artefaktami.',
    questions: [],
    answers: [],
    targetTool: null,
    toolRecommendation: null,
    aiProvider: null,
    aiModel: null,
    modelRecommendation: null,
    standards: '# Standards',
    standardsSource: 'generated',
    standardsGeneration: {
      selectedProfileId: 'webapp-react',
      followUpAnswers: [],
      draftContent: '# Standards',
    },
    generatedDocuments: { requirements: null, design: null, tasks: null },
    documentHistory: { requirements: [], design: [], tasks: [] },
    handledDocumentSuggestionKeys: [],
    documentSuggestions: [],
    documentSuggestionIteration: 0,
    ...overrides,
    currentStep: overrides.currentStep ?? 0,
    activeQuestionIndex: overrides.activeQuestionIndex ?? 0,
  });

  it('usuwa wygenerowane pliki i zostawia pliki użytkownika', async () => {
    await fs.mkdir(path.join(tmpDir, DOCS_DIRNAME), { recursive: true });
    await fs.mkdir(path.join(tmpDir, OLD_DOCS_DIRNAME), { recursive: true });
    await fs.writeFile(path.join(tmpDir, DOCS_DIRNAME, 'requirements.md'), '# Req');
    await fs.writeFile(path.join(tmpDir, DOCS_DIRNAME, 'notes.md'), '# Notatki użytkownika');
    await fs.writeFile(path.join(tmpDir, OLD_DOCS_DIRNAME, 'requirements_2026-01-01_10-00-00.md'), '# Old');
    await fs.writeFile(path.join(tmpDir, STANDARDS_FILENAME), '# Standards');
    await saveProjectSnapshot(tmpDir, snapshot());

    const deleted = await deleteGeneratedProjectArtifacts(tmpDir);

    expect(deleted.length).toBeGreaterThan(0);
    await expect(fs.access(path.join(tmpDir, DOCS_DIRNAME, 'requirements.md'))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, OLD_DOCS_DIRNAME))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, PROJECT_STATE_DIRNAME))).rejects.toThrow();
    await expect(fs.access(path.join(tmpDir, STANDARDS_FILENAME))).rejects.toThrow();
    await expect(fs.readFile(path.join(tmpDir, DOCS_DIRNAME, 'notes.md'), 'utf-8'))
      .resolves.toBe('# Notatki użytkownika');
    await expect(fs.access(tmpDir)).resolves.toBeUndefined();
  });

  it('usuwa pusty katalog projektu po skasowaniu artefaktów aplikacji', async () => {
    await fs.mkdir(path.join(tmpDir, DOCS_DIRNAME), { recursive: true });
    await fs.writeFile(path.join(tmpDir, DOCS_DIRNAME, 'tasks.md'), '# Tasks');
    await saveProjectSnapshot(tmpDir, snapshot({ standards: null, standardsSource: null, standardsGeneration: undefined }));

    await deleteGeneratedProjectArtifacts(tmpDir);

    await expect(fs.access(tmpDir)).rejects.toThrow();
  });

  it('nie usuwa istniejącego standards.md, jeśli snapshot oznacza go jako existing', async () => {
    await fs.writeFile(path.join(tmpDir, STANDARDS_FILENAME), '# Existing Standards');
    await saveProjectSnapshot(tmpDir, snapshot({
      standardsSource: 'existing',
      standardsGeneration: undefined,
    }));

    await deleteGeneratedProjectArtifacts(tmpDir);

    await expect(fs.readFile(path.join(tmpDir, STANDARDS_FILENAME), 'utf-8'))
      .resolves.toBe('# Existing Standards');
  });
});
