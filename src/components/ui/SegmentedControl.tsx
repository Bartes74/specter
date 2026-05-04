'use client';

import { useId } from 'react';
import { cn } from '@/lib/cn';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  options: ReadonlyArray<SegmentedOption<T>>;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZE_CLASSES = {
  sm: { container: 'h-8 p-0.5 text-xs', segment: 'h-7 px-2.5 rounded-sm' },
  md: { container: 'h-10 p-1 text-sm', segment: 'h-8 px-3 rounded' },
};

/**
 * SegmentedControl — editorial: tło inset, aktywny segment paper-elevated z hairline.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  const groupId = useId();
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center bg-bg-inset border border-rule rounded',
        SIZE_CLASSES[size].container,
        className,
      )}
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-controls={`${groupId}-panel-${opt.value}`}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 font-medium select-none',
              'transition-all duration-200 ease-out-expo',
              SIZE_CLASSES[size].segment,
              isActive
                ? 'bg-bg-elevated text-ink shadow-sm border border-rule'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {opt.icon}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
