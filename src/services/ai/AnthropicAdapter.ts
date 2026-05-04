/**
 * AnthropicAdapter — adapter dla modeli Claude (sonnet, haiku, opus).
 */
import Anthropic from '@anthropic-ai/sdk';
import type { AIAdapter, AIAdapterConfig, ChatMessage, CompleteOptions } from './types';
import { mapErrorToAdapterError } from './types';

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
        {
          model: this.config.modelId,
          system,
          messages: conversation,
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.4,
        },
        { signal: options.signal },
      );
      return response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((b) => b.text)
        .join('');
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
        {
          model: this.config.modelId,
          system,
          messages: conversation,
          max_tokens: options.maxTokens ?? 4096,
          temperature: options.temperature ?? 0.4,
        },
        { signal: options.signal },
      );
      let full = '';
      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          const delta = event.delta.text;
          full += delta;
          onChunk(delta);
        }
      }
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
