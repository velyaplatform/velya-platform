import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  AIProviderConfig,
  CompletionRequest,
  CompletionResponse,
  ProviderHealthStatus,
  StopReason,
} from './provider-registry.js';

const DEFAULT_ANTHROPIC_CONFIG: AIProviderConfig = {
  name: 'anthropic',
  type: 'anthropic',
  endpoint: 'https://api.anthropic.com',
  priority: 1,
  maxRetries: 2,
  timeoutMs: 120_000,
  enabled: true,
  costPerInputToken: 0.000003,
  costPerOutputToken: 0.000015,
  supportedModels: [
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
    'claude-haiku-3-20250307',
  ],
  maxConcurrentRequests: 50,
  rateLimitPerMinute: 1000,
};

@Injectable()
export class AnthropicProvider implements AIProvider, OnModuleInit {
  private readonly logger = new Logger(AnthropicProvider.name);
  private client!: Anthropic;

  readonly name = 'anthropic';
  readonly type = 'anthropic' as const;
  readonly config: AIProviderConfig;

  constructor() {
    this.config = { ...DEFAULT_ANTHROPIC_CONFIG };
  }

  onModuleInit(): void {
    this.client = new Anthropic({
      timeout: this.config.timeoutMs,
      maxRetries: 0, // We handle retries at the registry level
    });
    this.logger.log('Anthropic provider initialized');
  }

  async complete(request: CompletionRequest): Promise<CompletionResponse> {
    const startTime = Date.now();

    const systemMessages = request.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content);

    const systemPrompt = request.systemPrompt
      ? [request.systemPrompt, ...systemMessages].join('\n\n')
      : systemMessages.length > 0
        ? systemMessages.join('\n\n')
        : undefined;

    const conversationMessages = request.messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      stop_sequences: request.stopSequences,
      system: systemPrompt,
      messages: conversationMessages,
    });

    const latencyMs = Date.now() - startTime;

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const inputCost = inputTokens * this.config.costPerInputToken;
    const outputCost = outputTokens * this.config.costPerOutputToken;

    return {
      id: response.id,
      provider: this.name,
      model: response.model,
      content,
      inputTokens,
      outputTokens,
      latencyMs,
      stopReason: this.mapStopReason(response.stop_reason),
      cost: {
        inputCost,
        outputCost,
        totalCost: inputCost + outputCost,
        currency: 'USD',
      },
    };
  }

  async healthCheck(): Promise<ProviderHealthStatus> {
    const startTime = Date.now();

    try {
      await this.client.messages.create({
        model: 'claude-haiku-3-20250307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });

      return {
        provider: this.name,
        healthy: true,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        provider: this.name,
        healthy: false,
        latencyMs: Date.now() - startTime,
        lastChecked: new Date(),
        errorMessage,
      };
    }
  }

  private mapStopReason(reason: string | null): StopReason {
    switch (reason) {
      case 'end_turn':
        return 'end_turn';
      case 'max_tokens':
        return 'max_tokens';
      case 'stop_sequence':
        return 'stop_sequence';
      default:
        return 'end_turn';
    }
  }
}
