'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { LanguageSwitcher } from './LanguageSwitcher';
import { ThemeToggle } from './ThemeToggle';
import { ProgressBar } from './ui/ProgressBar';
import { Asterisk } from './ui/Icon';
import { cn } from '@/lib/cn';

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  active: boolean;
}

export interface WizardLayoutProps {
  steps: WizardStep[];
  currentStepIndex: number;
  children: ReactNode;
  footer?: ReactNode;
  banner?: ReactNode;
  onHome?: () => void;
  hideSteps?: boolean;
  customHeader?: ReactNode;
}

/**
 * WizardLayout — editorial direction.
 *
 * Cechy charakterystyczne:
 *  - DRAMATIC numeracja kroków w sidebarze: wielki Fraunces italic ("01", "02", "03")
 *  - Eyebrow nad H1: monospace caps ("ETAP 01 / 08")
 *  - Display H1: Fraunces, soft+wonk axis, ink-underline na akcent
 *  - Asymetryczny grid: sidebar wąski + content wide, lewy margines większy
 *  - Frosted glass header z paper warmth
 *  - Footer akcji wpuszczony, mocny hairline
 */
export function WizardLayout({
  steps,
  currentStepIndex,
  children,
  footer,
  banner,
  onHome,
  hideSteps = false,
  customHeader,
}: WizardLayoutProps) {
  const t = useTranslations('wizard');
  const totalSteps = steps.length;
  const progressPercent = hideSteps ? 100 : totalSteps > 0 ? ((currentStepIndex + 1) / totalSteps) * 100 : 0;
  const currentStep = steps[currentStepIndex];

  return (
    <div className="min-h-screen flex flex-col">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-30 surface-glass">
        <div className="mx-auto max-w-[1320px] px-8 lg:px-12 h-16 flex items-center justify-between">
          {/* Logo / wordmark */}
          <Link
            href="/"
            className="group flex items-center gap-2.5 -ml-1 px-1 py-1 rounded"
            onClick={(event) => handleHomeClick(event, onHome)}
          >
            <span className="grid place-items-center h-7 w-7 bg-sienna text-ink-on-accent rounded-sm shadow-sm group-hover:rotate-12 transition-transform duration-450 ease-out-expo">
              <Asterisk size={14} />
            </span>
            <span className="font-display text-lg leading-none text-ink tracking-tight">
              spec<span className="font-display-italic text-sienna">/</span>generator
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <span className="h-5 w-px bg-rule" />
            <LanguageSwitcher />
          </div>
        </div>
        <ProgressBar value={progressPercent} size="xs" ariaLabel={t('progressBar')} />
      </header>

      {banner && (
        <div className="bg-warning/10 border-b border-warning/30 text-warning text-xs">
          <div className="mx-auto max-w-[1320px] px-8 lg:px-12 py-2 font-mono uppercase tracking-wider">
            {banner}
          </div>
        </div>
      )}

      {/* ─── Body ─── */}
      <div className="flex-1">
        <div className="mx-auto max-w-[1320px] px-8 lg:px-12 py-12 md:py-20">
          <div className={cn(
            'grid gap-12 lg:gap-20',
            hideSteps ? 'lg:grid-cols-1' : 'lg:grid-cols-[280px_1fr]',
          )}>
            {/* ─── Sidebar — editorial step list ─── */}
            {!hideSteps && (
            <aside className="hidden lg:block">
              <p className="eyebrow mb-6">Spis treści</p>
              <ol className="space-y-0">
                {steps.map((step, idx) => (
                  <StepRow
                    key={step.id}
                    step={step}
                    index={idx}
                    isLast={idx === steps.length - 1}
                  />
                ))}
              </ol>
            </aside>
            )}

            {/* ─── Content ─── */}
            <main className="min-w-0 animate-fade-in">
              {customHeader !== undefined ? customHeader : currentStep && (
                <header className="mb-12">
                  <p className="eyebrow mb-6">
                    {t('step', { current: currentStepIndex + 1, total: totalSteps })}
                  </p>
                  <h1 className="font-display text-5xl md:text-6xl text-ink leading-[0.95] tracking-tight max-w-3xl">
                    {/* Pierwsze słowo italikiem dla dramatyzmu */}
                    {dramatize(currentStep.title)}
                  </h1>
                  {currentStep.description && (
                    <p className="mt-6 text-lg text-ink-muted max-w-2xl leading-relaxed">
                      {currentStep.description}
                    </p>
                  )}
                </header>
              )}

              <div>{children}</div>
            </main>
          </div>
        </div>
      </div>

      {/* ─── Footer ─── */}
      {footer && (
        <footer className="sticky bottom-0 z-20 surface-glass border-t border-rule">
          <div className="mx-auto max-w-[1320px] px-8 lg:px-12 py-3.5 flex items-center justify-end gap-2">
            {footer}
          </div>
        </footer>
      )}
    </div>
  );
}

function handleHomeClick(event: MouseEvent<HTMLAnchorElement>, onHome?: () => void) {
  if (!onHome) return;
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return;
  }
  event.preventDefault();
  onHome();
}

/**
 * Pierwsze słowo nagłówka kursywą (Fraunces italic) dla editorial dramatyzmu.
 */
function dramatize(title: string): ReactNode {
  const idx = title.indexOf(' ');
  if (idx === -1) {
    return <span className="font-display-italic">{title}</span>;
  }
  const first = title.slice(0, idx);
  const rest = title.slice(idx);
  return (
    <>
      <span className="font-display-italic">{first}</span>
      <span>{rest}</span>
    </>
  );
}

/**
 * Wiersz spisu treści — duże numery serif italic, lewy słupek-marker przy aktywnym.
 */
function StepRow({
  step,
  index,
}: {
  step: WizardStep;
  index: number;
  isLast: boolean;
}) {
  return (
    <li className="relative">
      <div
        className={cn(
          'group flex items-baseline gap-4 py-3 pl-3 -ml-3 transition-colors',
          step.active && 'border-l-2 border-sienna pl-[10px]',
        )}
      >
        <span
          className={cn(
            'step-numeral text-2xl tabular-nums shrink-0 transition-all duration-350',
            step.completed
              ? 'text-sienna'
              : step.active
                ? 'text-ink'
                : 'text-ink-subtle',
          )}
          aria-hidden
        >
          {step.completed ? '✓' : (index + 1).toString().padStart(2, '0')}
        </span>
        <div className="min-w-0 pt-0.5">
          <p
            className={cn(
              'text-sm leading-tight transition-colors',
              step.active ? 'text-ink font-medium' : 'text-ink-muted',
            )}
          >
            {step.title}
          </p>
        </div>
      </div>
    </li>
  );
}
