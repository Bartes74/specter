'use client';

import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './Spinner';

type Variant = 'primary' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

/**
 * Button — editorial feel: niskie radius, warm tones, letterpress shadow.
 */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-sienna text-ink-on-accent shadow-sm hover:bg-sienna-hover hover:shadow active:scale-[0.985] focus-visible:shadow-glow-accent',
  secondary:
    'bg-bg-elevated text-ink border border-rule hover:bg-bg-inset hover:border-rule-strong active:scale-[0.985] shadow-letterpress',
  outline:
    'bg-transparent text-ink border border-rule-strong hover:bg-bg-inset active:scale-[0.985]',
  subtle:
    'bg-transparent text-ink hover:bg-bg-inset active:bg-rule/40',
  ghost:
    'bg-transparent text-ink-muted hover:text-ink hover:bg-bg-inset',
  danger:
    'bg-danger/95 text-white shadow-sm hover:bg-danger active:scale-[0.985] focus-visible:shadow-glow-danger',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'h-8  px-3   text-xs   rounded gap-1.5',
  md: 'h-10 px-4   text-sm   rounded-md gap-2',
  lg: 'h-12 px-5   text-base rounded-md gap-2.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    iconLeft,
    iconRight,
    fullWidth,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={cn(
        'inline-flex items-center justify-center font-medium tracking-tight select-none',
        'transition-all duration-200 ease-out-expo',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner size={size === 'lg' ? 'md' : 'sm'} className="-ml-0.5" />
      ) : (
        iconLeft && <span className="flex shrink-0 -ml-0.5">{iconLeft}</span>
      )}
      <span className="truncate">{children}</span>
      {iconRight && !loading && <span className="flex shrink-0 -mr-0.5">{iconRight}</span>}
    </button>
  );
});
