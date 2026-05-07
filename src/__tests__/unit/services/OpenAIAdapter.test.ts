import { describe, expect, it } from 'vitest';
import { assertOpenAIFinishReason, buildChatCompletionRequest } from '@/services/ai/OpenAIAdapter';
import { AIAdapterError } from '@/services/ai/types';

const messages = [{ role: 'user' as const, content: 'Napisz specyfikację.' }];

describe('OpenAIAdapter request params', () => {
  it('dla GPT-5 używa max_completion_tokens i pomija temperature', () => {
    const request = buildChatCompletionRequest(
      'gpt-5-mini',
      messages,
      { maxTokens: 8000, temperature: 0.4 },
      true,
    );

    expect(request).toMatchObject({
      model: 'gpt-5-mini',
      stream: true,
      max_completion_tokens: 8000,
    });
    expect(request).not.toHaveProperty('max_tokens');
    expect(request).not.toHaveProperty('temperature');
  });

  it('dla GPT-5 z wersją po kropce też używa max_completion_tokens', () => {
    const request = buildChatCompletionRequest(
      'gpt-5.2',
      messages,
      { maxTokens: 6000, temperature: 0.5 },
      true,
    );

    expect(request).toMatchObject({
      model: 'gpt-5.2',
      stream: true,
      max_completion_tokens: 6000,
    });
    expect(request).not.toHaveProperty('max_tokens');
    expect(request).not.toHaveProperty('temperature');
  });

  it('dla OpenAI-compatible modelu z prefiksem providera rozpoznaje GPT-5', () => {
    const request = buildChatCompletionRequest(
      'openai/gpt-5.2',
      messages,
      { maxTokens: 1 },
      false,
    );

    expect(request).toMatchObject({
      model: 'openai/gpt-5.2',
      stream: false,
      max_completion_tokens: 1,
    });
    expect(request).not.toHaveProperty('max_tokens');
  });

  it('dla starszych modeli OpenAI zachowuje max_tokens i temperature', () => {
    const request = buildChatCompletionRequest(
      'gpt-4o',
      messages,
      { maxTokens: 2000, temperature: 0.5 },
      false,
    );

    expect(request).toMatchObject({
      model: 'gpt-4o',
      stream: false,
      max_tokens: 2000,
      temperature: 0.5,
    });
    expect(request).not.toHaveProperty('max_completion_tokens');
  });

  it('traktuje finish_reason=length jako błąd limitu tokenów', () => {
    expect(() => assertOpenAIFinishReason('length', 'partial')).toThrow(/limit tokenów/i);
    try {
      assertOpenAIFinishReason('length', 'partial');
    } catch (err) {
      expect(err).toBeInstanceOf(AIAdapterError);
      expect((err as AIAdapterError).partialContent).toBe('partial');
    }
    expect(() => assertOpenAIFinishReason('stop')).not.toThrow();
  });
});
