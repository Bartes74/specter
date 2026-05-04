/**
 * cn — bezpieczne łączenie klas Tailwind (clsx + tailwind-merge).
 *
 * Używaj zamiast string concatenation, żeby uniknąć konfliktów typu
 * `px-2 px-4` (które inaczej kasują się losowo).
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
