import { describe, expect, it } from 'vitest';
import {
  assertAnthropicStopReason,
  buildAnthropicMessageRequest,
} from '@/services/ai/AnthropicAdapter';
import { AIAdapterError } from '@/services/ai/types';

describe('AnthropicAdapter request params', () => {
  it('pomija temperature, bo nowsze modele Claude odrzucają ten parametr', () => {
    const request = buildAnthropicMessageRequest(
      'claude-sonnet-4-6',
      'Jesteś pomocnym asystentem.',
      [{ role: 'user', content: 'Wygeneruj standards.md.' }],
      { maxTokens: 6000, temperature: 0.5 },
    );

    expect(request).toMatchObject({
      model: 'claude-sonnet-4-6',
      system: 'Jesteś pomocnym asystentem.',
      messages: [{ role: 'user', content: 'Wygeneruj standards.md.' }],
      max_tokens: 6000,
    });
    expect(request).not.toHaveProperty('temperature');
  });

  it('traktuje stop_reason=max_tokens jako błąd limitu tokenów', () => {
    expect(() => assertAnthropicStopReason('max_tokens', 'partial')).toThrow(/limit tokenów/i);
    try {
      assertAnthropicStopReason('max_tokens', 'partial');
    } catch (err) {
      expect(err).toBeInstanceOf(AIAdapterError);
      expect((err as AIAdapterError).partialContent).toBe('partial');
    }
    expect(() => assertAnthropicStopReason('end_turn')).not.toThrow();
  });
});
