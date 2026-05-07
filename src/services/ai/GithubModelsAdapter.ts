/**
 * GithubModelsAdapter — adapter dla GitHub Models (https://models.inference.ai.azure.com).
 *
 * Endpoint jest kompatybilny z OpenAI Chat Completions API, więc używamy SDK OpenAI
 * z innym `baseURL`. Token to GitHub PAT (ghp_..., github_pat_...).
 */
import OpenAI from 'openai';
import type { AIAdapter, AIAdapterConfig, ChatMessage, CompleteOptions } from './types';
import { mapErrorToAdapterError } from './types';
import { assertOpenAIFinishReason, buildChatCompletionRequest } from './OpenAIAdapter';

const GITHUB_MODELS_BASE_URL = 'https://models.inference.ai.azure.com';

export class GithubModelsAdapter implements AIAdapter {
  readonly provider = 'github' as const;
  private client: OpenAI;

  constructor(private config: AIAdapterConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: GITHUB_MODELS_BASE_URL,
    });
  }

  async complete(messages: ChatMessage[], options: CompleteOptions = {}): Promise<string> {
    try {
      const completion = await this.client.chat.completions.create(
        buildChatCompletionRequest(this.config.modelId, messages, options, false) as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        { signal: options.signal },
      );
      const choice = completion.choices[0];
      const content = choice?.message?.content ?? '';
      assertOpenAIFinishReason(choice?.finish_reason, content);
      return content;
    } catch (err) {
      throw mapErrorToAdapterError(err);
    }
  }

  async completeStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options: CompleteOptions = {},
  ): Promise<string> {
    try {
      const stream = await this.client.chat.completions.create(
        buildChatCompletionRequest(this.config.modelId, messages, options, true) as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
        { signal: options.signal },
      );
      let full = '';
      let finishReason: string | null | undefined;
      for await (const part of stream) {
        const partFinishReason = part.choices[0]?.finish_reason;
        if (partFinishReason) finishReason = partFinishReason;
        const delta = part.choices[0]?.delta?.content ?? '';
        if (delta) {
          full += delta;
          onChunk(delta);
        }
      }
      assertOpenAIFinishReason(finishReason, full);
      return full;
    } catch (err) {
      throw mapErrorToAdapterError(err);
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Najtańsze wywołanie testowe — 1 token output
      await this.client.chat.completions.create(
        buildChatCompletionRequest(
          this.config.modelId,
          [{ role: 'user', content: 'hi' }],
          { maxTokens: 1 },
          false,
        ) as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
      );
      return true;
    } catch {
      return false;
    }
  }
}
