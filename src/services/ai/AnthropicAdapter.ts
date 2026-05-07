/**
 * AnthropicAdapter — adapter dla modeli Claude (sonnet, haiku, opus).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AIAdapter, AIAdapterConfig, ChatMessage, CompleteOptions } from './types';
import { createTokenLimitError, mapErrorToAdapterError } from './types';

export class AnthropicAdapter implements AIAdapter {
  readonly provider = 'anthropic' as const;
  private client: Anthropic;

  constructor(private config: AIAdapterConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async complete(messages: ChatMessage[], options: CompleteOptions = {}): Promise<string> {
    const { system, conversation } = splitMessages(messages);
    try {
      const response = await this.client.messages.create(
        buildAnthropicMessageRequest(this.config.modelId, system, conversation, options),
        { signal: options.signal },
      );
      const content = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((b) => b.text)
        .join('');
      assertAnthropicStopReason(response.stop_reason, content);
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
    const { system, conversation } = splitMessages(messages);
    try {
      const stream = this.client.messages.stream(
        buildAnthropicMessageRequest(this.config.modelId, system, conversation, options),
        { signal: options.signal },
      );
      let full = '';
      let stopReason: string | null | undefined;
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const delta = event.delta.text;
          full += delta;
          onChunk(delta);
        }
        if (event.type === 'message_delta' && event.delta.stop_reason) {
          stopReason = event.delta.stop_reason;
        }
      }
      assertAnthropicStopReason(stopReason, full);
      return full;
    } catch (err) {
      throw mapErrorToAdapterError(err);
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Najtańsze możliwe wywołanie — 1 token output
      await this.client.messages.create({
        model: this.config.modelId,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }
}

function splitMessages(messages: ChatMessage[]): {
  system: string | undefined;
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const system = systemMsgs.length > 0 ? systemMsgs.map((m) => m.content).join('\n\n') : undefined;
  const conversation = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
  return { system, conversation };
}

type AnthropicMessageRequest = {
  model: string;
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  max_tokens: number;
};

export function buildAnthropicMessageRequest(
  modelId: string,
  system: string | undefined,
  conversation: Array<{ role: 'user' | 'assistant'; content: string }>,
  options: CompleteOptions,
): AnthropicMessageRequest {
  return {
    model: modelId,
    system,
    messages: conversation,
    max_tokens: options.maxTokens ?? 4096,
  };
}

export function assertAnthropicStopReason(
  stopReason: string | null | undefined,
  partialContent?: string,
): void {
  if (stopReason === 'max_tokens') {
    throw createTokenLimitError(partialContent);
  }
}
