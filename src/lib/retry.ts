/**
 * Generyczny retry z exponential backoff dla wywołań AI.
 *
 * Wymaganie 12.1, 12.6 — max 3 próby, 1s bazowy delay, mnożnik 2x, max 10s.
 */

export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: ReadonlyArray<string>;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['NETWORK_ERROR', 'PARSE_ERROR'],
};

export interface RetryableError extends Error {
  code?: string;
  retryable?: boolean;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  onRetry?: (attempt: number, error: RetryableError) => void,
): Promise<T> {
  let lastError: RetryableError | null = null;
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (raw) {
      const err = raw as RetryableError;
      lastError = err;
      const retryable =
        err.retryable === true ||
        (err.code !== undefined && config.retryableErrors.includes(err.code));
      if (!retryable || attempt === config.maxAttempts) {
        throw err;
      }
      const delay = Math.min(
        config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1),
        config.maxDelayMs,
      );
      onRetry?.(attempt, err);
      await sleep(delay);
    }
  }
  throw lastError ?? new Error('retry.exhausted');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
