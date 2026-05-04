import { cn } from '@/lib/cn';

/**
 * Kbd — wyświetla klawisz w stylu macOS (np. ⌘K, ↵).
 */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5',
        'rounded border border-border bg-bg-inset',
        'text-2xs font-mono font-medium text-fg-muted',
        'shadow-[inset_0_-1px_0_rgb(var(--border))]',
        className,
      )}
    >
      {children}
    </kbd>
  );
}
