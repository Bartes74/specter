import { cn } from '@/lib/cn';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_CLASSES: Record<Size, string> = {
  xs: 'h-3 w-3 border-[1.5px]',
  sm: 'h-4 w-4 border-[1.5px]',
  md: 'h-5 w-5 border-2',
  lg: 'h-7 w-7 border-2',
};

export function Spinner({
  size = 'sm',
  className,
  label = 'Ładowanie',
}: {
  size?: Size;
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block rounded-full border-current border-t-transparent animate-spin',
        SIZE_CLASSES[size],
        className,
      )}
    />
  );
}
