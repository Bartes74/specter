'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Textarea } from './ui/Input';
import { Sparkles, Check } from './ui/Icon';
import { cn } from '@/lib/cn';
import {
  validateDescription,
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
} from '@/lib/validation';

export interface ProjectDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * ProjectDescriptionInput — Krok 2 wizarda.
 *
 * Editorial layout:
 *   - lewa kolumna (8 col): wielki Textarea bez ramki, italic placeholder
 *   - prawa kolumna (4 col): "Wskazówki" — numerowana lista z hairline rows
 *
 * Walidacja na żywo, licznik znaków w monospace, status pill.
 */
export function ProjectDescriptionInput({ value, onChange }: ProjectDescriptionInputProps) {
  const t = useTranslations('description');

  const validation = useMemo(() => validateDescription(value), [value]);
  const len = value.length;

  // Stan walidacji do feedbacku
  const state: 'pending' | 'tooShort' | 'valid' | 'tooLong' =
    len === 0 ? 'pending' :
    len < DESCRIPTION_MIN_LENGTH ? 'tooShort' :
    len > DESCRIPTION_MAX_LENGTH ? 'tooLong' :
    'valid';

  // Komunikat walidacyjny
  const errorText =
    state === 'tooShort' ? t('minLength') :
    state === 'tooLong'  ? t('maxLength') :
    undefined;

  const successText =
    state === 'valid' && validation.valid
      ? `Świetnie, opis ma ${len} znaków`
      : undefined;

  // Wskazówki w formacie listy
  const tips = useMemo(() => {
    try {
      return t.raw('tips.items') as string[];
    } catch {
      return [];
    }
  }, [t]);

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-12 lg:gap-16">
      {/* ─── Pole tekstowe — lewa kolumna ─── */}
      <section className="min-w-0">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('placeholder')}
          showCount
          minLength={DESCRIPTION_MIN_LENGTH}
          maxLength={DESCRIPTION_MAX_LENGTH}
          errorText={errorText}
          successText={successText}
          className="min-h-[260px] md:min-h-[320px] text-lg leading-relaxed font-display"
          autoFocus
        />

        {/* Pasek progresu walidacji — wizualne wsparcie minLength */}
        <ValidationMeter
          length={len}
          minLength={DESCRIPTION_MIN_LENGTH}
          maxLength={DESCRIPTION_MAX_LENGTH}
          state={state}
        />
      </section>

      {/* ─── Wskazówki — prawa kolumna, sticky ─── */}
      <aside className="min-w-0">
        <div className="sticky top-24">
          <div className="flex items-baseline gap-3 mb-5">
            <span className="step-numeral text-xl text-sienna">✶</span>
            <h2 className="font-display-italic text-xl text-ink leading-tight">
              {t('tips.title')}
            </h2>
          </div>
          <ol className="border-t border-rule">
            {tips.map((tip, idx) => (
              <li
                key={idx}
                className="flex items-start gap-4 py-3.5 border-b border-rule"
              >
                <span className="step-numeral text-base text-ink-subtle tabular-nums shrink-0 w-6 text-right pt-0.5">
                  {(idx + 1).toString().padStart(2, '0')}
                </span>
                <p className="text-sm text-ink-muted leading-relaxed">{tip}</p>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>
  );
}

/**
 * ValidationMeter — pasek pokazujący "ile mam do minimum" + ikona statusu.
 * Bardziej czytelny dla nietechnicznych niż sam licznik znaków.
 */
function ValidationMeter({
  length,
  minLength,
  maxLength,
  state,
}: {
  length: number;
  minLength: number;
  maxLength: number;
  state: 'pending' | 'tooShort' | 'valid' | 'tooLong';
}) {
  // Procent do minimum
  const pctToMin = Math.min(100, (length / minLength) * 100);

  return (
    <div className="mt-6 flex items-center gap-4">
      {/* Pasek (tylko do minimum, potem znika) */}
      {state !== 'valid' && state !== 'tooLong' && (
        <div className="flex-1 h-0.5 bg-rule/40 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-450 ease-out-expo',
              state === 'tooShort' ? 'bg-ink-subtle' : 'bg-sienna',
            )}
            style={{ width: `${pctToMin}%` }}
          />
        </div>
      )}

      {/* Status */}
      {state === 'valid' && (
        <div className="flex items-center gap-2 text-success animate-fade-in">
          <Check size={14} />
          <span className="font-mono text-2xs uppercase tracking-wider">Gotowe do dalej</span>
        </div>
      )}

      {state === 'tooShort' && length > 0 && (
        <span className="font-mono text-2xs text-ink-muted uppercase tracking-wider whitespace-nowrap">
          Jeszcze {minLength - length} znaków
        </span>
      )}

      {state === 'tooLong' && (
        <span className="font-mono text-2xs text-danger uppercase tracking-wider whitespace-nowrap">
          O {length - maxLength} znaków za dużo
        </span>
      )}

      {state === 'pending' && (
        <div className="flex items-center gap-2 text-ink-subtle">
          <Sparkles size={14} />
          <span className="font-mono text-2xs uppercase tracking-wider">
            Min. {minLength} znaków
          </span>
        </div>
      )}
    </div>
  );
}
