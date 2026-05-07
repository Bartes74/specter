/**
 * GoogleAdapter — adapter dla Google Gemini API.
 */
import { GoogleGenerativeAI, type GenerativeModel, type Content } from '@google/generative-ai';
import type { AIAdapter, AIAdapterConfig, ChatMessage, CompleteOptions } from './types';
import { createTokenLimitError, mapErrorToAdapterError } from './types';

export class GoogleAdapter implements AIAdapter {
  readonly provider = 'google' as const;
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(private config: AIAdapterConfig) {
    this.client = new GoogleGenerativeAI(config.apiKey);
    this.model = this.client.getGenerativeModel({ model: config.modelId });
  }

  async complete(messages: ChatMessage[], options: CompleteOptions = {}): Promise<string> {
    try {
      const { systemInstruction, contents } = mapMessages(messages);
      const result = await this.model.generateContent({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: options.maxTokens,
          temperature: options.temperature ?? 0.4,
        },
      });
      const text = result.response.text();
      assertGoogleFinishReason(result.response.candidates?.[0]?.finishReason, text);
      return text;
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
      const { systemInstruction, contents } = mapMessages(messages);
      const result = await this.model.generateContentStream({
        contents,
        systemInstruction,
        generationConfig: {
          maxOutputTokens: options.maxTokens,
          temperature: options.temperature ?? 0.4,
        },
      });
      let full = '';
      let finishReason: string | null | undefined;
      for await (const part of result.stream) {
        const partFinishReason = part.candidates?.[0]?.finishReason;
        if (partFinishReason) finishReason = partFinishReason;
        const text = part.text();
        if (text) {
          full += text;
          onChunk(text);
        }
      }
      assertGoogleFinishReason(finishReason, full);
      return full;
    } catch (err) {
      throw mapErrorToAdapterError(err);
    }
  }

  async validateApiKey(): Promise<boolean> {
    try {
      await this.model.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
        generationConfig: { maxOutputTokens: 1 },
      });
      return true;
    } catch {
      return false;
    }
  }
}

function mapMessages(messages: ChatMessage[]): {
  systemInstruction: Content | undefined;
  contents: Content[];
} {
  const systemMsgs = messages.filter((m) => m.role === 'system');
  const systemInstruction: Content | undefined =
    systemMsgs.length > 0
      ? { role: 'system', parts: [{ text: systemMsgs.map((m) => m.content).join('\n\n') }] }
      : undefined;

  const contents: Content[] = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  return { systemInstruction, contents };
}

export function assertGoogleFinishReason(
  finishReason: string | null | undefined,
  partialContent?: string,
): void {
  if (finishReason === 'MAX_TOKENS') {
    throw createTokenLimitError(partialContent);
  }
}
