'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardHeader } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import {
  Folder,
  FolderPlus,
  Upload,
  ChevronRight,
  AlertCircle,
  Trash,
} from './ui/Icon';
import { cn } from '@/lib/cn';
import type { PathValidationResult, ProjectSource } from '@/types/session';
import type { RecentProjectWithSummary } from '@/types/project';

export interface ProjectPickerProps {
  recentProjects: RecentProjectWithSummary[];
  loadingRecent: boolean;
  deletingProjectPath?: string | null;
  onProjectReady: (
    projectPath: string,
    source: 'recent' | 'picker' | 'drop' | 'created' | 'manual',
    validation: PathValidationResult,
  ) => void;
  onProjectDelete?: (project: RecentProjectWithSummary) => void;
}

export function ProjectPicker({
  recentProjects,
  loadingRecent,
  deletingProjectPath,
  onProjectReady,
  onProjectDelete,
}: ProjectPickerProps) {
  return (
    <div className="space-y-16">
      <FolderActionsSection index="01" onProjectReady={onProjectReady} />

      <RecentProjectsSection
        index="02"
        recentProjects={recentProjects}
        loading={loadingRecent}
        deletingProjectPath={deletingProjectPath}
        onSelect={(p) => void validateAndReport(p.path, 'recent', onProjectReady)}
        onDelete={onProjectDelete}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Sekcja 2: Ostatnie projekty — editorial: lista z numeracją, hairline rows
// ─────────────────────────────────────────────────────────

function RecentProjectsSection({
  index,
  recentProjects,
  loading,
  deletingProjectPath,
  onSelect,
  onDelete,
}: {
  index: string;
  recentProjects: RecentProjectWithSummary[];
  loading: boolean;
  deletingProjectPath?: string | null;
  onSelect: (p: RecentProjectWithSummary) => void;
  onDelete?: (p: RecentProjectWithSummary) => void;
}) {
  const t = useTranslations();

  return (
    <section className="animate-rise" style={{ animationDelay: '120ms' }}>
      <SectionLabel index={index} label={t('projectPicker.recentProjects')} />

      {loading ? (
        <div className="space-y-0">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 border-b border-rule animate-pulse" />
          ))}
        </div>
      ) : recentProjects.length === 0 ? (
        <p className="font-display-italic text-2xl text-ink-subtle py-6">
          {t('projectPicker.noRecent')}
        </p>
      ) : (
        <ul className="border-t border-rule">
          {recentProjects.map((project, idx) => (
            <RecentProjectRow
              key={project.path}
              project={project}
              index={idx}
              onSelect={() => onSelect(project)}
              onDelete={onDelete ? () => onDelete(project) : undefined}
              isDeleting={deletingProjectPath === project.path}
              deleteLabel={t('projectPicker.deleteProject')}
              deletingLabel={t('projectPicker.deletingProject')}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function RecentProjectRow({
  project,
  index,
  onSelect,
  onDelete,
  isDeleting,
  deleteLabel,
  deletingLabel,
}: {
  project: RecentProjectWithSummary;
  index: number;
  onSelect: () => void;
  onDelete?: () => void;
  isDeleting: boolean;
  deleteLabel: string;
  deletingLabel: string;
}) {
  const summary = project.summary;
  return (
    <li className="border-b border-rule">
      <div
        className={cn(
          'group -mx-2 flex items-stretch gap-2',
          'hover:bg-bg-inset/60 transition-colors duration-200 rounded-sm',
        )}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <button
          type="button"
          onClick={onSelect}
          disabled={isDeleting}
          className="flex min-w-0 flex-1 items-center gap-6 py-5 pl-2 text-left disabled:cursor-wait disabled:opacity-60"
        >
          {/* Numeracja editorial */}
          <span
            className="step-numeral text-3xl text-ink-subtle group-hover:text-sienna transition-colors w-12 shrink-0 text-right tabular-nums"
            aria-hidden
          >
            {(index + 1).toString().padStart(2, '0')}
          </span>

          {/* Treść */}
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-2xl text-ink leading-tight tracking-tight">
              {project.name}
            </h3>
            <p className="mt-1 font-mono text-xs text-ink-subtle truncate" title={project.path}>
              {project.path}
            </p>
            {summary?.descriptionPreview ? (
              <p className="mt-3 max-w-2xl text-sm text-ink-muted leading-relaxed line-clamp-2">
                {summary.descriptionPreview}
              </p>
            ) : (
              <p className="mt-3 text-sm text-ink-subtle">
                Brak zapisanych informacji projektu. Otwórz projekt, żeby je uzupełnić.
              </p>
            )}
          </div>

          {/* Meta */}
          <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
            <span className="font-mono text-2xs text-ink-muted uppercase tracking-wider">
              {formatRelativeTime(project.lastUsedAt)}
            </span>
            {summary?.updatedAt && (
              <span className="font-mono text-2xs text-ink-subtle uppercase tracking-wider">
                zapis: {formatRelativeTime(summary.updatedAt)}
              </span>
            )}
          </div>

          {/* Strzałka */}
          <ChevronRight
            size={20}
            className="text-ink-subtle group-hover:text-sienna group-hover:translate-x-1 transition-all duration-300 shrink-0"
          />
        </button>

        {onDelete && (
          <div className="flex items-center py-5 pr-2 shrink-0">
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={isDeleting}
              disabled={isDeleting}
              iconLeft={<Trash size={14} />}
              aria-label={`${deleteLabel}: ${project.name}`}
              title={`${deleteLabel}: ${project.name}`}
              onClick={onDelete}
            >
              {isDeleting ? deletingLabel : deleteLabel}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────
// Sekcja 1: Wybierz folder / Nowy projekt — dwie wielkie karty
// ─────────────────────────────────────────────────────────

function FolderActionsSection({
  index,
  onProjectReady,
}: {
  index: string;
  onProjectReady: ProjectPickerProps['onProjectReady'];
}) {
  const t = useTranslations();
  const [creating, setCreating] = useState(false);

  return (
    <section className="animate-rise">
      <SectionLabel index={index} label={t('projectPicker.newProjectSpecification')} />
      <div className="grid md:grid-cols-2 gap-6">
        <NewProjectCard
          isOpen={creating}
          onToggle={() => setCreating((v) => !v)}
          onCreated={(path) => void validateAndReport(path, 'created', onProjectReady)}
          labels={{
            title: t('projectPicker.createNew'),
            subtitle: t('projectPicker.createNewSubtitle'),
            name: t('projectPicker.newProjectName'),
            parent: t('projectPicker.newProjectParent'),
            create: t('projectPicker.createNew'),
          }}
        />
        <FolderDropZone
          onPicked={(p) => void validateAndReport(p, 'drop', onProjectReady)}
          onClickPick={(p) => void validateAndReport(p, 'picker', onProjectReady)}
          labels={{
            title: t('projectPicker.selectFolder'),
            drop: t('projectPicker.dropFolderHere'),
          }}
        />
      </div>
    </section>
  );
}

function FolderDropZone({
  onPicked,
  onClickPick,
  labels,
}: {
  onPicked: (path: string) => void;
  onClickPick: (path: string) => void;
  labels: { title: string; drop: string };
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const item = items[0];
      const entry = (item as DataTransferItem & {
        webkitGetAsEntry?: () => FileSystemEntry | null;
      })?.webkitGetAsEntry?.();
      if (entry?.isDirectory) {
        const file = e.dataTransfer.files[0];
        const path = (file as unknown as { path?: string })?.path;
        if (path) {
          setPickerError(null);
          onPicked(path);
        } else {
          setPickerError('Przeglądarka nie udostępniła pełnej ścieżki folderu. Użyj przycisku wyboru folderu albo wpisz ścieżkę ręcznie.');
        }
      }
    }
  };

  const onPick = async () => {
    setPickerError(null);
    const picked = await pickFolder();
    if (picked.path) {
      onClickPick(picked.path);
      return;
    }
    setPickerError(picked.error ?? 'Nie udało się otworzyć natywnego wyboru folderu.');
    inputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const path = (file as unknown as { path?: string })?.path;
    if (path) {
      setPickerError(null);
      onClickPick(path);
    } else if (file.webkitRelativePath) {
      setPickerError('Przeglądarka pokazała tylko nazwę folderu. Wpisz pełną ścieżkę ręcznie, żeby ją zweryfikować.');
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={onPick}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={cn(
          'group relative flex min-h-[220px] w-full flex-col items-start text-left p-8',
          'rounded-md border bg-bg-elevated transition-all duration-300',
          isDragOver
            ? 'border-sienna bg-sienna-subtle scale-[1.01] shadow-md'
            : 'border-rule hover:border-rule-strong hover:-translate-y-0.5 hover:shadow-md',
        )}
      >
        <div
          className={cn(
            'h-11 w-11 grid place-items-center rounded-sm mb-auto transition-all',
            isDragOver
              ? 'bg-sienna text-ink-on-accent rotate-6 scale-110'
              : 'bg-bg-inset text-ink-muted group-hover:bg-sienna group-hover:text-ink-on-accent',
          )}
        >
          <Upload size={20} />
        </div>
        <div className="mt-8">
          <h3 className="font-display text-3xl text-ink leading-tight">{labels.title}</h3>
          <p className="text-sm text-ink-muted mt-2">{labels.drop}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          // @ts-expect-error — webkitdirectory niestandardowy atrybut
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={onFileSelected}
          aria-hidden
        />
      </button>
      {pickerError && <p className="mt-2 text-xs text-ink-muted">{pickerError}</p>}
    </div>
  );
}

function NewProjectCard({
  isOpen,
  onToggle,
  onCreated,
  labels,
}: {
  isOpen: boolean;
  onToggle: () => void;
  onCreated: (path: string) => void;
  labels: { title: string; subtitle: string; name: string; parent: string; create: string };
}) {
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectingParent, setSelectingParent] = useState(false);
  const [errorText, setErrorText] = useState<string | undefined>();

  const pickParent = async () => {
    setSelectingParent(true);
    setErrorText(undefined);
    try {
      const picked = await pickFolder();
      if (picked.path) {
        setParent(picked.path);
      } else if (picked.error) {
        setErrorText(picked.error);
      }
    } finally {
      setSelectingParent(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setErrorText(undefined);
    try {
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentPath: parent, projectName: name }),
      });
      const body = (await res.json()) as
        | { success: true; projectPath: string }
        | { error: { code: string; message: string } };
      if ('success' in body && body.success) {
        onCreated(body.projectPath);
      } else if ('error' in body) {
        setErrorText(body.error.message);
      }
    } catch (err) {
      setErrorText((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="group relative flex flex-col items-start text-left p-8 min-h-[220px] rounded-md border border-rule bg-bg-elevated hover:border-rule-strong hover:-translate-y-0.5 hover:shadow-md transition-all duration-300"
      >
        <div className="h-11 w-11 grid place-items-center rounded-sm bg-sienna-subtle text-sienna mb-auto transition-transform group-hover:rotate-6 group-hover:scale-110">
          <FolderPlus size={20} />
        </div>
        <div className="mt-8">
          <h3 className="font-display text-3xl text-ink leading-tight">{labels.title}</h3>
          <p className="text-sm text-ink-muted mt-2">{labels.subtitle}</p>
        </div>
      </button>
    );
  }

  return (
    <Card padding="lg" className="animate-scale-soft min-h-[220px]">
      <CardHeader title={labels.title} subtitle={labels.subtitle} />
      <div className="space-y-4">
        <Input
          label={labels.name}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="moj-projekt"
          autoFocus
        />
        <FolderPickerField
          label={labels.parent}
          value={parent}
          placeholder="Wybierz katalog nadrzędny"
          loading={selectingParent}
          onPick={() => void pickParent()}
        />
        {errorText && (
          <div className="flex items-start gap-2 text-xs text-danger">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{errorText}</span>
          </div>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button variant="primary" onClick={submit} loading={submitting} disabled={!name || !parent}>
            {labels.create}
          </Button>
          <Button variant="ghost" onClick={onToggle}>
            ✕
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────
// Helpery
// ─────────────────────────────────────────────────────────

function FolderPickerField({
  label,
  value,
  placeholder,
  loading,
  onPick,
}: {
  label: string;
  value: string;
  placeholder: string;
  loading: boolean;
  onPick: () => void;
}) {
  return (
    <div className="w-full">
      <p className="block eyebrow mb-2">{label}</p>
      <button
        type="button"
        onClick={onPick}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-md border border-rule bg-bg-elevated px-3.5 text-left',
          'transition-all duration-200 ease-out-expo hover:border-sienna hover:shadow-glow-accent',
        )}
      >
        <Folder size={14} className="shrink-0 text-ink-subtle" />
        <span className={cn('min-w-0 flex-1 truncate text-base', value ? 'text-ink' : 'text-ink-subtle')}>
          {value || placeholder}
        </span>
        <span className="shrink-0 font-mono text-2xs uppercase tracking-wider text-ink-subtle">
          {loading ? '...' : 'Wybierz'}
        </span>
      </button>
    </div>
  );
}

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <div className="flex items-baseline gap-3 mb-6">
      <span className="step-numeral text-2xl text-sienna tabular-nums">{index}</span>
      <h2 className="font-display-italic text-2xl text-ink leading-tight">{label}</h2>
    </div>
  );
}

async function validateAndReport(
  path: string,
  source: ProjectSource,
  onReady: ProjectPickerProps['onProjectReady'],
): Promise<void> {
  try {
    const body = await validatePath(path, true);
    if (body.valid) {
      onReady(path, source, body);
    }
  } catch {
    // ignore
  }
}

async function validatePath(path: string, ensureDocs: boolean): Promise<PathValidationResult> {
  const res = await fetch('/api/validate/path', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectPath: path, ensureDocs }),
  });
  return (await res.json()) as PathValidationResult;
}

async function pickFolder(): Promise<{ path?: string; error?: string }> {
  try {
    const res = await fetch('/api/projects/pick-folder', { method: 'POST' });
    const body = (await res.json()) as
      | { projectPath: string }
      | { error?: { message?: string } };
    if (res.ok && 'projectPath' in body && body.projectPath) {
      return { path: body.projectPath };
    }
    return {
      error:
        ('error' in body ? body.error?.message : undefined) ??
        'Nie udało się otworzyć wyboru katalogu.',
    };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'przed chwilą';
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} godz. temu`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} dni temu`;
  return date.toLocaleDateString();
}
