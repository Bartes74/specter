/**
 * OpenAIAdapter — adapter dla modeli OpenAI (gpt-4o, gpt-4o-mini itd.).
 */
import OpenAI from 'openai';
import type { AIAdapter, AIAdapterConfig, ChatMessage, CompleteOptions } from './types';
import { createTokenLimitError, mapErrorToAdapterError } from './types';

export class OpenAIAdapter implements AIAdapter {
  readonly provider = 'openai' as const;
  private client: OpenAI;

  constructor(private config: AIAdapterConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
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
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }
}

type OpenAIChatRequest = {
  model: string;
  messages: ChatMessage[];
  stream: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
};

export function buildChatCompletionRequest(
  modelId: string,
  messages: ChatMessage[],
  options: CompleteOptions,
  stream: boolean,
): OpenAIChatRequest {
  const request: OpenAIChatRequest = {
    model: modelId,
    messages,
    stream,
  };

  if (options.maxTokens !== undefined) {
    if (usesMaxCompletionTokens(modelId)) {
      request.max_completion_tokens = options.maxTokens;
    } else {
      request.max_tokens = options.maxTokens;
    }
  }

  if (supportsCustomTemperature(modelId)) {
    request.temperature = options.temperature ?? 0.4;
  }

  return request;
}

export function assertOpenAIFinishReason(
  finishReason: string | null | undefined,
  partialContent?: string,
): void {
  if (finishReason === 'length') {
    throw createTokenLimitError(partialContent);
  }
}

function usesMaxCompletionTokens(modelId: string): boolean {
  const normalized = normalizeModelId(modelId);
  return /^(?:gpt-5|o[134])(?:[.-]|$)/i.test(normalized);
}

function supportsCustomTemperature(modelId: string): boolean {
  return !usesMaxCompletionTokens(modelId);
}

function normalizeModelId(modelId: string): string {
  return (modelId.split('/').pop() ?? modelId).trim();
}
