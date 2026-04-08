import type { AICapability } from './ai-request.js';

/**
 * Criticality level determines model selection and fallback behavior.
 */
export type CriticalityLevel = 'critical' | 'standard' | 'best-effort';

/**
 * A routing decision specifying which provider/model to use.
 */
export interface ModelRoutingDecision {
  /** Selected provider ID. */
  readonly providerId: string;

  /** Selected model identifier. */
  readonly model: string;

  /** Why this model was selected (for observability). */
  readonly reason: string;

  /** Fallback chain if the primary choice fails. */
  readonly fallbacks: ReadonlyArray<{
    readonly providerId: string;
    readonly model: string;
  }>;
}

/**
 * Context provided to the routing policy for decision-making.
 */
export interface RoutingContext {
  /** The capability being requested. */
  readonly capability: AICapability;

  /** How critical is this request to patient care/operations. */
  readonly criticality: CriticalityLevel;

  /** Estimated input size in tokens (for cost optimization). */
  readonly estimatedInputTokens: number;

  /** Whether the request needs HIPAA-compliant processing. */
  readonly requiresHipaaCompliance: boolean;

  /** Maximum acceptable latency in milliseconds. */
  readonly maxLatencyMs?: number;

  /** Optional: preferred provider override. */
  readonly preferredProvider?: string;
}

/**
 * Policy interface for routing AI requests to appropriate models.
 * Implementations can use cost optimization, latency requirements,
 * compliance needs, or load balancing strategies.
 */
export interface ModelRoutingPolicy {
  /**
   * Select the best provider and model for a given request context.
   */
  route(context: RoutingContext): Promise<ModelRoutingDecision>;

  /**
   * Report that a provider/model failed, so the policy can update its state
   * (e.g., circuit breaker, health tracking).
   */
  reportFailure(providerId: string, model: string, error: string): void;

  /**
   * Report a successful call for tracking latency/availability.
   */
  reportSuccess(providerId: string, model: string, latencyMs: number): void;
}
