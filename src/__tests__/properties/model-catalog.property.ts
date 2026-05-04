/**
 * Property: MODEL_CATALOG jest kompletnym źródłem prawdy dla selectorów modeli.
 */
import { describe, expect, it } from 'vitest';
import { AI_PROVIDERS } from '@/types/providers';
import { MODEL_CATALOG, getDefaultModelForProvider, getModelConfig } from '@/types/models';
import { buildChatCompletionRequest } from '@/services/ai/OpenAIAdapter';

describe('MODEL_CATALOG', () => {
  it('ma co najmniej jeden aktywny model dla każdego providera', () => {
    for (const provider of AI_PROVIDERS) {
      const models = MODEL_CATALOG.filter((model) => model.provider === provider && !model.disabledReason);
      expect(models.length).toBeGreaterThan(0);
      expect(getDefaultModelForProvider(provider).provider).toBe(provider);
    }
  });

  it('ma wymagane pola UI, kosztu, streamingu i źródła', () => {
    for (const model of MODEL_CATALOG) {
      expect(model.id).toBeTruthy();
      expect(model.modelId).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.description.pl).toBeTruthy();
      expect(model.description.en).toBeTruthy();
      expect(model.estimatedSeconds).toBeGreaterThan(0);
      expect(model.estimatedCostUsd).toBeGreaterThanOrEqual(0);
      expect(['fast', 'balanced', 'highest']).toContain(model.quality);
      expect(typeof model.supportsStreaming).toBe('boolean');
      expect(model.sourceUrl).toMatch(/^https:\/\//);
      expect(getModelConfig(model.id)).toBe(model);
      expect(getModelConfig(model.modelId)).toBe(model);
    }
  });

  it('modele GPT-5 z katalogu nie używają przestarzałego max_tokens', () => {
    const gpt5Models = MODEL_CATALOG.filter((model) =>
      /(?:^|\/)gpt-5(?:[.-]|$)/i.test(model.modelId),
    );

    expect(gpt5Models.length).toBeGreaterThan(0);
    for (const model of gpt5Models) {
      const request = buildChatCompletionRequest(
        model.modelId,
        [{ role: 'user', content: 'ping' }],
        { maxTokens: 1, temperature: 0.4 },
        false,
      );
      expect(request).toHaveProperty('max_completion_tokens', 1);
      expect(request).not.toHaveProperty('max_tokens');
      expect(request).not.toHaveProperty('temperature');
    }
  });
});
