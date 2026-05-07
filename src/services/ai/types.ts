/**
 * Wspólny interfejs adapterów AI — używany przez 4 implementacje
 * (OpenAIAdapter, AnthropicAdapter, GoogleAdapter, GithubModelsAdapter).
 */
import type { AIProvider } from '@/types/providers';

export interface AIAdapterConfig {
  apiKey: string;
  modelId: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIAdapter {
  readonly provider: AIProvider;

  /**
   * Wywołuje model bez streamingu — zwraca pełną odpowiedź jednorazowo.
   * Używane przez `validateApiKey` (najtańsze możliwe wywołanie testowe).
   */
  complete(messages: ChatMessage[], options?: CompleteOptions): Promise<string>;

  /**
   * Wywołuje model ze streamingiem — wywołuje onChunk dla każdego fragmentu treści.
   * Zwraca finalną pełną treść (na wypadek gdy potrzebujesz oba).
   */
  completeStream(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    options?: CompleteOptions,
  ): Promise<string>;

  /**
   * Najtańsze możliwe wywołanie testowe — zwraca true gdy klucz działa.
   */
  validateApiKey(): Promise<boolean>;
}

export interface CompleteOptions {
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export class AIAdapterError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'NETWORK_ERROR'
      | 'AUTH_ERROR'
      | 'TOKEN_LIMIT'
      | 'PARSE_ERROR'
      | 'UNKNOWN',
    public readonly retryable: boolean = false,
    public readonly partialContent?: string,
  ) {
    super(message);
    this.name = 'AIAdapterError';
  }
}

export function createTokenLimitError(partialContent?: string): AIAdapterError {
  return new AIAdapterError(
    'Model osiągnął limit tokenów odpowiedzi. Generator automatycznie kontynuuje od ostatniego fragmentu.',
    'TOKEN_LIMIT',
    false,
    partialContent,
  );
}

/**
 * Mapuje błąd HTTP/SDK na wspólny `AIAdapterError`.
 */
export function mapErrorToAdapterError(err: unknown): AIAdapterError {
  if (err instanceof AIAdapterError) return err;
  const message = err instanceof Error ? err.message : String(err);
  // Heurystyki — rozpoznają typowe błędy bez wiązania się z konkretnym SDK
  if (/abort/i.test(message)) {
    return new AIAdapterError(message, 'NETWORK_ERROR', false);
  }
  if (/401|unauthor|invalid.*key|api.?key/i.test(message)) {
    return new AIAdapterError(message, 'AUTH_ERROR', false);
  }
  if (/429|rate|quota/i.test(message)) {
    return new AIAdapterError(message, 'NETWORK_ERROR', true);
  }
  if (/context.*length|token.*limit|too.*long/i.test(message)) {
    return new AIAdapterError(message, 'TOKEN_LIMIT', false);
  }
  if (/network|timeout|ECONN|ENOTFOUND|fetch.*failed/i.test(message)) {
    return new AIAdapterError(message, 'NETWORK_ERROR', true);
  }
  if (/parse|json|format/i.test(message)) {
    return new AIAdapterError(message, 'PARSE_ERROR', true);
  }
  return new AIAdapterError(message, 'UNKNOWN', false);
}
