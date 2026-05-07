import { describe, expect, it } from 'vitest';
import { assertGoogleFinishReason } from '@/services/ai/GoogleAdapter';
import { AIAdapterError } from '@/services/ai/types';

describe('GoogleAdapter finish reasons', () => {
  it('traktuje MAX_TOKENS jako błąd limitu tokenów', () => {
    expect(() => assertGoogleFinishReason('MAX_TOKENS', 'partial')).toThrow(/limit tokenów/i);
    try {
      assertGoogleFinishReason('MAX_TOKENS', 'partial');
    } catch (err) {
      expect(err).toBeInstanceOf(AIAdapterError);
      expect((err as AIAdapterError).partialContent).toBe('partial');
    }
    expect(() => assertGoogleFinishReason('STOP')).not.toThrow();
  });
});
