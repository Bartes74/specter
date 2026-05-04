import { cn } from '@/lib/cn';

export interface ProgressBarProps {
  value: number;
  showLabel?: boolean;
  indeterminate?: boolean;
  className?: string;
  ariaLabel?: string;
  size?: 'xs' | 'sm' | 'md';
}

const SIZE_CLASSES = {
  xs: 'h-0.5',
  sm: 'h-1',
  md: 'h-1.5',
};

/**
 * ProgressBar — editorial: cienka linia (1-2 px), accent sienna.
 * Indeterminate ma "scanning" animation przesuwającą segment.
 */
export function ProgressBar({
  value,
  showLabel,
  indeterminate,
  className,
  ariaLabel = 'Postęp',
  size = 'sm',
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div
        role="progressbar"
        aria-label={ariaLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={indeterminate ? undefined : clamped}
        className={cn(
          'relative flex-1 bg-rule/40 overflow-hidden rounded-full',
          SIZE_CLASSES[size],
        )}
      >
        {indeterminate ? (
          <div
            className="absolute inset-y-0 w-1/3 rounded-full bg-sienna"
            style={{
              animation: 'progress-scan 1.6s cubic-bezier(0.65, 0, 0.35, 1) infinite',
            }}
          />
        ) : (
          <div
            className="h-full rounded-full bg-sienna transition-all duration-450 ease-out-expo"
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>
      {showLabel && (
        <span className="font-mono text-xs text-ink-muted tabular-nums w-10 text-right">
          {indeterminate ? '—' : `${Math.round(clamped)}%`}
        </span>
      )}
      <style>{`
        @keyframes progress-scan {
          0%   { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
