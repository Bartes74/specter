/**
 * Validates: Wymaganie 12.1, 12.6
 */
import { describe, it, expect, vi } from 'vitest';
import { withRetry, DEFAULT_RETRY_CONFIG, type RetryableError } from '@/lib/retry';

describe('withRetry', () => {
  it('zwraca wynik gdy operacja przeszła za pierwszym razem', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(op, { ...DEFAULT_RETRY_CONFIG, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('próbuje 3 razy gdy błąd jest retryable', async () => {
    let attempts = 0;
    const op = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        const e = new Error('siec') as RetryableError;
        e.code = 'NETWORK_ERROR';
        throw e;
      }
      return 'ok';
    });
    const result = await withRetry(op, { ...DEFAULT_RETRY_CONFIG, baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('rzuca błąd nieretryable bez powtarzania', async () => {
    const op = vi.fn(async () => {
      const e = new Error('auth') as RetryableError;
      e.code = 'AUTH_ERROR';
      throw e;
    });
    await expect(withRetry(op, { ...DEFAULT_RETRY_CONFIG, baseDelayMs: 1 })).rejects.toThrow('auth');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('nie powtarza TOKEN_LIMIT, bo ponowna próba nie zwiększa budżetu odpowiedzi', async () => {
    const op = vi.fn(async () => {
      const e = new Error('limit') as RetryableError;
      e.code = 'TOKEN_LIMIT';
      throw e;
    });
    await expect(withRetry(op, { ...DEFAULT_RETRY_CONFIG, baseDelayMs: 1 })).rejects.toThrow('limit');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('rzuca po wyczerpaniu prób', async () => {
    const op = vi.fn(async () => {
      const e = new Error('boom') as RetryableError;
      e.code = 'NETWORK_ERROR';
      throw e;
    });
    await expect(withRetry(op, { ...DEFAULT_RETRY_CONFIG, baseDelayMs: 1 })).rejects.toThrow('boom');
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('callback onRetry jest wywoływany przy każdej kolejnej próbie', async () => {
    const onRetry = vi.fn();
    const op = vi.fn(async () => {
      const e = new Error('x') as RetryableError;
      e.code = 'NETWORK_ERROR';
      throw e;
    });
    await expect(
      withRetry(op, { ...DEFAULT_RETRY_CONFIG, baseDelayMs: 1 }, onRetry),
    ).rejects.toThrow();
    // 3 próby = 2 wywołania onRetry (po 1. i 2. nieudanej, przed 3. i finalną)
    expect(onRetry).toHaveBeenCalledTimes(2);
  });
});
