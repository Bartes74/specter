'use client';

import { forwardRef, useId } from 'react';
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type InputState = 'default' | 'success' | 'error';

const STATE_CLASSES: Record<InputState, string> = {
  default:
    'border-rule focus-within:border-sienna focus-within:shadow-glow-accent',
  success:
    'border-success focus-within:border-success focus-within:shadow-[0_0_0_4px_rgb(var(--success)/0.18)]',
  error:
    'border-danger focus-within:border-danger focus-within:shadow-glow-danger',
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  errorText?: string;
  successText?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  state?: InputState;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    label,
    hint,
    errorText,
    successText,
    iconLeft,
    iconRight,
    state = 'default',
    className,
    id,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const effectiveState: InputState = errorText ? 'error' : successText ? 'success' : state;
  const messageId = `${fieldId}-msg`;
  const message = errorText ?? successText ?? hint;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={fieldId} className="block eyebrow mb-2">
          {label}
        </label>
      )}
      <div
        className={cn(
          'flex items-center gap-2.5 px-3.5 h-11 rounded-md border bg-bg-elevated',
          'transition-all duration-200 ease-out-expo',
          STATE_CLASSES[effectiveState],
        )}
      >
        {iconLeft && <span className="text-ink-subtle shrink-0">{iconLeft}</span>}
        <input
          ref={ref}
          id={fieldId}
          aria-describedby={message ? messageId : undefined}
          aria-invalid={effectiveState === 'error'}
          className={cn(
            'flex-1 min-w-0 bg-transparent text-base text-ink placeholder:text-ink-subtle',
            'focus:outline-none border-0',
            className,
          )}
          {...rest}
        />
        {iconRight && <span className="text-ink-subtle shrink-0">{iconRight}</span>}
      </div>
      {message && (
        <p
          id={messageId}
          className={cn(
            'text-xs mt-2 transition-colors',
            effectiveState === 'error' && 'text-danger',
            effectiveState === 'success' && 'text-success',
            effectiveState === 'default' && 'text-ink-muted',
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  errorText?: string;
  successText?: string;
  state?: InputState;
  showCount?: boolean;
  minLength?: number;
  maxLength?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  {
    label,
    hint,
    errorText,
    successText,
    state = 'default',
    showCount,
    minLength,
    maxLength,
    className,
    id,
    value,
    ...rest
  },
  ref,
) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const effectiveState: InputState = errorText ? 'error' : successText ? 'success' : state;
  const messageId = `${fieldId}-msg`;
  const message = errorText ?? successText ?? hint;
  const length = typeof value === 'string' ? value.length : 0;

  return (
    <div className="w-full">
      {(label || showCount) && (
        <div className="flex items-baseline justify-between mb-2">
          {label && (
            <label htmlFor={fieldId} className="block eyebrow">
              {label}
            </label>
          )}
          {showCount && (
            <span
              className={cn(
                'text-xs font-mono tabular-nums',
                minLength && length < minLength ? 'text-ink-subtle' : 'text-ink-muted',
                maxLength && length > maxLength && 'text-danger',
              )}
            >
              {length}
              {maxLength ? ` / ${maxLength}` : ''}
            </span>
          )}
        </div>
      )}
      <div
        className={cn(
          'rounded-md border bg-bg-elevated transition-all duration-200 ease-out-expo',
          STATE_CLASSES[effectiveState],
        )}
      >
        <textarea
          ref={ref}
          id={fieldId}
          value={value}
          aria-describedby={message ? messageId : undefined}
          aria-invalid={effectiveState === 'error'}
          className={cn(
            'w-full min-h-[140px] px-4 py-3.5 bg-transparent rounded-md',
            'text-base text-ink placeholder:text-ink-subtle resize-y',
            'focus:outline-none border-0 leading-relaxed',
            className,
          )}
          {...rest}
        />
      </div>
      {message && (
        <p
          id={messageId}
          className={cn(
            'text-xs mt-2 transition-colors',
            effectiveState === 'error' && 'text-danger',
            effectiveState === 'success' && 'text-success',
            effectiveState === 'default' && 'text-ink-muted',
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
});
