import { Injectable, Logger } from '@nestjs/common';
import { AIProvider, AIProviderConfig, CompletionRequest } from '../providers/provider-registry.js';

export type RoutingStrategy =
  | 'cost-optimized'
  | 'latency-optimized'
  | 'capability-match'
  | 'fallback-chain';

export interface RoutingPolicy {
  strategy: RoutingStrategy;
  constraints: RoutingConstraints;
}

export interface RoutingConstraints {
  maxCostPerRequest?: number;
  maxLatencyMs?: number;
  requiredCapabilities?: string[];
  preferredProviders?: string[];
  excludedProviders?: string[];
  modelOverride?: string;
}

export interface RoutingDecision {
  selectedProvider: string;
  selectedModel: string;
  strategy: RoutingStrategy;
  reason: string;
  alternativeProviders: string[];
  estimatedCost: number;
}

interface ScoredProvider {
  provider: AIProvider;
  score: number;
  reason: string;
}

@Injectable()
export class RoutingPolicyEvaluator {
  private readonly logger = new Logger(RoutingPolicyEvaluator.name);

  evaluate(
    request: CompletionRequest,
    policy: RoutingPolicy,
    availableProviders: AIProvider[],
  ): RoutingDecision {
    const filtered = this.applyConstraints(availableProviders, policy.constraints, request.model);

    if (filtered.length === 0) {
      throw new Error(
        `No providers available for model "${request.model}" matching policy constraints`,
      );
    }

    const scored = this.scoreProviders(filtered, policy, request);
    const best = scored[0];

    return {
      selectedProvider: best.provider.name,
      selectedModel: policy.constraints.modelOverride ?? request.model,
      strategy: policy.strategy,
      reason: best.reason,
      alternativeProviders: scored.slice(1).map((s) => s.provider.name),
      estimatedCost: this.estimateCost(best.provider.config, request.maxTokens),
    };
  }

  private applyConstraints(
    providers: AIProvider[],
    constraints: RoutingConstraints,
    model: string,
  ): AIProvider[] {
    let filtered = providers.filter((p) => p.config.enabled);

    filtered = filtered.filter((p) => p.config.supportedModels.includes(model));

    if (constraints.excludedProviders && constraints.excludedProviders.length > 0) {
      filtered = filtered.filter((p) => !constraints.excludedProviders!.includes(p.name));
    }

    if (constraints.preferredProviders && constraints.preferredProviders.length > 0) {
      const preferred = filtered.filter((p) =>
        constraints.preferredProviders!.includes(p.name),
      );
      if (preferred.length > 0) {
        filtered = preferred;
      }
    }

    if (constraints.maxCostPerRequest !== undefined) {
      filtered = filtered.filter(
        (p) => p.config.costPerOutputToken * 4096 <= constraints.maxCostPerRequest!,
      );
    }

    return filtered;
  }

  private scoreProviders(
    providers: AIProvider[],
    policy: RoutingPolicy,
    request: CompletionRequest,
  ): ScoredProvider[] {
    const scored: ScoredProvider[] = providers.map((provider) => {
      switch (policy.strategy) {
        case 'cost-optimized':
          return this.scoreByCost(provider, request);
        case 'latency-optimized':
          return this.scoreByLatency(provider);
        case 'capability-match':
          return this.scoreByCapability(provider, request);
        case 'fallback-chain':
          return this.scoreByPriority(provider);
      }
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  private scoreByCost(provider: AIProvider, request: CompletionRequest): ScoredProvider {
    const estimatedCost = this.estimateCost(provider.config, request.maxTokens);
    // Lower cost = higher score (invert with 1 / cost)
    const score = estimatedCost > 0 ? 1 / estimatedCost : Infinity;
    return {
      provider,
      score,
      reason: `Cost-optimized: estimated $${estimatedCost.toFixed(6)} per request`,
    };
  }

  private scoreByLatency(provider: AIProvider): ScoredProvider {
    // Lower timeout hint suggests lower latency configuration
    const score = 1 / provider.config.timeoutMs;
    return {
      provider,
      score,
      reason: `Latency-optimized: timeout=${provider.config.timeoutMs}ms`,
    };
  }

  private scoreByCapability(provider: AIProvider, request: CompletionRequest): ScoredProvider {
    const modelSupported = provider.config.supportedModels.includes(request.model);
    const score = modelSupported ? provider.config.supportedModels.length : 0;
    return {
      provider,
      score,
      reason: `Capability-match: supports ${provider.config.supportedModels.length} models`,
    };
  }

  private scoreByPriority(provider: AIProvider): ScoredProvider {
    // Lower priority number = higher priority = higher score
    const score = 1000 - provider.config.priority;
    return {
      provider,
      score,
      reason: `Fallback-chain: priority=${provider.config.priority}`,
    };
  }

  private estimateCost(config: AIProviderConfig, maxOutputTokens: number): number {
    // Estimate: assume input tokens roughly equal to output tokens as a heuristic
    const estimatedInputTokens = Math.floor(maxOutputTokens * 0.5);
    return (
      estimatedInputTokens * config.costPerInputToken +
      maxOutputTokens * config.costPerOutputToken
    );
  }
}
