import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'editorial';
type BadgeSize = 'sm' | 'md';

const TONE_CLASSES: Record<Tone, string> = {
  neutral:   'bg-bg-inset text-ink-muted',
  accent:    'bg-sienna-subtle text-ink-accent',
  success:   'bg-success/10 text-success',
  warning:   'bg-warning/10 text-warning',
  danger:    'bg-danger/10 text-danger',
  // Editorial: monospace caps, hairline border, no fill
  editorial: 'bg-transparent text-ink-muted border border-rule font-mono uppercase tracking-wider',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-2xs h-5 px-1.5 rounded-sm',
  md: 'text-xs h-6 px-2.5 rounded',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: BadgeSize;
  iconLeft?: ReactNode;
}

export function Badge({
  tone = 'neutral',
  size = 'md',
  iconLeft,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-medium leading-none whitespace-nowrap',
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {iconLeft && <span className="shrink-0">{iconLeft}</span>}
      {children}
    </span>
  );
}
