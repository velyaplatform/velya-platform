import { Injectable, Logger } from '@nestjs/common';

export type ProviderType = 'anthropic' | 'openai' | 'self-hosted' | 'custom';

export interface AIProviderConfig {
  name: string;
  type: ProviderType;
  endpoint: string;
  priority: number;
  maxRetries: number;
  timeoutMs: number;
  enabled: boolean;
  costPerInputToken: number;
  costPerOutputToken: number;
  supportedModels: string[];
  maxConcurrentRequests: number;
  rateLimitPerMinute: number;
}

export interface CompletionRequest {
  model: string;
  messages: CompletionMessage[];
  maxTokens: number;
  temperature?: number;
  stopSequences?: string[];
  systemPrompt?: string;
  correlationId: string;
  metadata?: Record<string, string>;
}

export interface CompletionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface CompletionResponse {
  id: string;
  provider: string;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  stopReason: StopReason;
  cost: ProviderCost;
}

export type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'error';

export interface ProviderCost {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: 'USD';
}

export interface AIProvider {
  readonly name: string;
  readonly type: ProviderType;
  readonly config: AIProviderConfig;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  healthCheck(): Promise<ProviderHealthStatus>;
}

export interface ProviderHealthStatus {
  provider: string;
  healthy: boolean;
  latencyMs: number;
  lastChecked: Date;
  errorMessage?: string;
}

@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providers = new Map<string, AIProvider>();
  private readonly healthCache = new Map<string, ProviderHealthStatus>();

  register(provider: AIProvider): void {
    if (this.providers.has(provider.name)) {
      this.logger.warn(`Provider "${provider.name}" is already registered; overwriting`);
    }

    this.providers.set(provider.name, provider);
    this.logger.log(`Registered AI provider: ${provider.name} (${provider.type})`);
  }

  get(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getOrThrow(name: string): AIProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`AI provider "${name}" is not registered`);
    }
    return provider;
  }

  list(): AIProvider[] {
    return Array.from(this.providers.values());
  }

  listEnabled(): AIProvider[] {
    return this.list().filter((p) => p.config.enabled);
  }

  /**
   * Returns providers ordered by priority (lowest number = highest priority),
   * filtered to only enabled providers that support the requested model.
   */
  getFallbackChain(model: string): AIProvider[] {
    return this.listEnabled()
      .filter((p) => p.config.supportedModels.includes(model))
      .sort((a, b) => a.config.priority - b.config.priority);
  }

  /**
   * Attempts completion across the fallback chain, returning the first
   * successful result or throwing the last error encountered.
   */
  async completeWithFallback(request: CompletionRequest): Promise<CompletionResponse> {
    const chain = this.getFallbackChain(request.model);

    if (chain.length === 0) {
      throw new Error(`No enabled providers support model "${request.model}"`);
    }

    let lastError: Error | undefined;

    for (const provider of chain) {
      for (let attempt = 0; attempt <= provider.config.maxRetries; attempt++) {
        try {
          this.logger.debug(
            `Attempting completion with provider="${provider.name}" model="${request.model}" attempt=${attempt + 1}`,
          );
          const response = await provider.complete(request);
          return response;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          this.logger.warn(
            `Provider "${provider.name}" attempt ${attempt + 1} failed: ${lastError.message}`,
          );
        }
      }
    }

    throw new Error(
      `All providers exhausted for model "${request.model}". Last error: ${lastError?.message ?? 'unknown'}`,
    );
  }

  async checkHealth(): Promise<ProviderHealthStatus[]> {
    const results: ProviderHealthStatus[] = [];

    for (const provider of this.providers.values()) {
      try {
        const status = await provider.healthCheck();
        this.healthCache.set(provider.name, status);
        results.push(status);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const status: ProviderHealthStatus = {
          provider: provider.name,
          healthy: false,
          latencyMs: -1,
          lastChecked: new Date(),
          errorMessage,
        };
        this.healthCache.set(provider.name, status);
        results.push(status);
      }
    }

    return results;
  }

  getCachedHealth(providerName: string): ProviderHealthStatus | undefined {
    return this.healthCache.get(providerName);
  }

  unregister(name: string): boolean {
    const removed = this.providers.delete(name);
    if (removed) {
      this.healthCache.delete(name);
      this.logger.log(`Unregistered AI provider: ${name}`);
    }
    return removed;
  }
}
