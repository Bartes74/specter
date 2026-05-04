import { forwardRef } from 'react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type CardVariant = 'default' | 'elevated' | 'glass' | 'inset' | 'ghost' | 'naked';
type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

const VARIANT_CLASSES: Record<CardVariant, string> = {
  default:  'bg-bg-elevated border border-rule shadow-xs',
  elevated: 'bg-bg-elevated border border-rule shadow-md',
  glass:    'surface-glass',
  inset:    'bg-bg-inset border border-transparent',
  ghost:    'bg-transparent border border-rule',
  naked:    'bg-transparent border-0 shadow-none',
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-5',
  lg: 'p-6',
  xl: 'p-8',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: CardPadding;
  interactive?: boolean;
  selected?: boolean;
  /** Editorial: zaokrąglenie. Domyślnie 'md' (8px) — bardziej drukowane niż Apple-soft. */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
}

const RADIUS_CLASSES = {
  none: 'rounded-none',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'md', radius = 'md', interactive, selected, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-250 ease-out-expo',
        RADIUS_CLASSES[radius],
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        interactive && [
          'cursor-pointer select-none',
          'hover:shadow-md hover:border-rule-strong hover:-translate-y-px',
          'active:translate-y-0 active:shadow-sm',
        ],
        selected && 'border-sienna shadow-glow-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-5', className)}>
      <div className="min-w-0 flex-1">
        <h3 className="font-display text-xl text-ink leading-tight">{title}</h3>
        {subtitle && <p className="text-sm text-ink-muted mt-1.5 leading-snug">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
