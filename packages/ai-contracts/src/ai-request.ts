/**
 * Supported AI capability types.
 */
export type AICapability = 'complete' | 'summarize' | 'classify' | 'embed';

/**
 * Token usage information for cost tracking and rate limiting.
 */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * A message in a conversation context.
 */
export interface AIMessage {
  readonly role: 'system' | 'user' | 'assistant';
  readonly content: string;
}

/**
 * Request to an AI provider.
 */
export interface AIRequest {
  /** Unique request ID for tracing. */
  readonly requestId: string;

  /** The capability being invoked. */
  readonly capability: AICapability;

  /** Model identifier (e.g. "claude-sonnet-4-20250514", "gpt-4o"). */
  readonly model: string;

  /** Conversation messages for completion requests. */
  readonly messages: ReadonlyArray<AIMessage>;

  /** Plain text input for summarize/classify/embed. */
  readonly input?: string;

  /** Classification labels for classify capability. */
  readonly classificationLabels?: ReadonlyArray<string>;

  /** Maximum tokens to generate. */
  readonly maxTokens?: number;

  /** Temperature for generation (0-2). */
  readonly temperature?: number;

  /** Optional metadata for logging and audit. */
  readonly metadata?: Readonly<Record<string, string>>;

  /** Timeout in milliseconds. */
  readonly timeoutMs?: number;
}

/**
 * Response from an AI provider.
 */
export interface AIResponse {
  /** Echoed request ID. */
  readonly requestId: string;

  /** The model that actually handled the request. */
  readonly model: string;

  /** Generated text content (for complete/summarize). */
  readonly content: string | null;

  /** Classification result (for classify). */
  readonly classification: AIClassificationResult | null;

  /** Embedding vector (for embed). */
  readonly embedding: ReadonlyArray<number> | null;

  /** Token usage. */
  readonly usage: TokenUsage;

  /** Processing time in milliseconds. */
  readonly latencyMs: number;

  /** Provider-specific finish reason. */
  readonly finishReason: 'stop' | 'max_tokens' | 'error';
}

/**
 * Classification result with label and confidence.
 */
export interface AIClassificationResult {
  readonly label: string;
  readonly confidence: number;
  readonly allScores: ReadonlyArray<{ readonly label: string; readonly score: number }>;
}
