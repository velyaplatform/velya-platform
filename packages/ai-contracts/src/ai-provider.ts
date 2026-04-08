import type { AIRequest, AIResponse, AICapability } from './ai-request.js';

/**
 * Abstract interface for AI providers (Claude, GPT, local models, etc.).
 * Implementations handle authentication, retries, and provider-specific mapping.
 */
export interface AIProvider {
  /** Unique provider identifier, e.g. "anthropic", "openai", "local-llama". */
  readonly providerId: string;

  /** Human-readable provider name. */
  readonly displayName: string;

  /** Capabilities this provider supports. */
  readonly supportedCapabilities: ReadonlyArray<AICapability>;

  /**
   * Generate a text completion from a conversation.
   */
  complete(request: AIRequest): Promise<AIResponse>;

  /**
   * Summarize a text input.
   */
  summarize(request: AIRequest): Promise<AIResponse>;

  /**
   * Classify text input into one of the provided labels.
   */
  classify(request: AIRequest): Promise<AIResponse>;

  /**
   * Generate an embedding vector for the input text.
   */
  embed(request: AIRequest): Promise<AIResponse>;

  /**
   * Check if the provider is currently available and healthy.
   */
  healthCheck(): Promise<AIProviderHealthStatus>;
}

/**
 * Health status of an AI provider.
 */
export interface AIProviderHealthStatus {
  readonly providerId: string;
  readonly available: boolean;
  readonly latencyMs: number | null;
  readonly message: string;
  readonly checkedAt: string;
}
