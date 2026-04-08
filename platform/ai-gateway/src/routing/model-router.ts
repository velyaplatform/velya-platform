import { Injectable, Logger } from '@nestjs/common';
import {
  CompletionRequest,
  CompletionResponse,
  ProviderRegistry,
} from '../providers/provider-registry.js';
import {
  RoutingPolicy,
  RoutingPolicyEvaluator,
  RoutingDecision,
  RoutingStrategy,
} from './routing-policy.js';
import { RequestLogger, RequestLogEntry } from '../telemetry/request-logger.js';

export interface RouteResult {
  response: CompletionResponse;
  routingDecision: RoutingDecision;
}

const DEFAULT_POLICY: RoutingPolicy = {
  strategy: 'fallback-chain',
  constraints: {},
};

@Injectable()
export class ModelRouter {
  private readonly logger = new Logger(ModelRouter.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly policyEvaluator: RoutingPolicyEvaluator,
    private readonly requestLogger: RequestLogger,
  ) {}

  async route(
    request: CompletionRequest,
    policy: RoutingPolicy = DEFAULT_POLICY,
  ): Promise<RouteResult> {
    const availableProviders = this.providerRegistry.listEnabled();

    const decision = this.policyEvaluator.evaluate(request, policy, availableProviders);

    this.logger.debug(
      `Routing request correlationId="${request.correlationId}" to provider="${decision.selectedProvider}" ` +
        `model="${decision.selectedModel}" strategy="${decision.strategy}"`,
    );

    const routedRequest: CompletionRequest = {
      ...request,
      model: decision.selectedModel,
    };

    const startTime = Date.now();
    let logEntry: RequestLogEntry | undefined;

    try {
      const provider = this.providerRegistry.getOrThrow(decision.selectedProvider);
      const response = await provider.complete(routedRequest);

      logEntry = {
        correlationId: request.correlationId,
        provider: decision.selectedProvider,
        model: decision.selectedModel,
        strategy: decision.strategy,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
        cost: response.cost.totalCost,
        status: 'success',
        timestamp: new Date(),
        metadata: request.metadata,
      };

      this.requestLogger.log(logEntry);

      return { response, routingDecision: decision };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      logEntry = {
        correlationId: request.correlationId,
        provider: decision.selectedProvider,
        model: decision.selectedModel,
        strategy: decision.strategy,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Date.now() - startTime,
        cost: 0,
        status: 'error',
        errorMessage,
        timestamp: new Date(),
        metadata: request.metadata,
      };

      this.requestLogger.log(logEntry);

      // Attempt fallback if the primary provider failed
      return this.attemptFallback(routedRequest, decision, policy.strategy);
    }
  }

  private async attemptFallback(
    request: CompletionRequest,
    originalDecision: RoutingDecision,
    strategy: RoutingStrategy,
  ): Promise<RouteResult> {
    const alternativeProviders = originalDecision.alternativeProviders;

    if (alternativeProviders.length === 0) {
      throw new Error(
        `Provider "${originalDecision.selectedProvider}" failed and no fallback providers available`,
      );
    }

    this.logger.warn(
      `Primary provider "${originalDecision.selectedProvider}" failed. ` +
        `Attempting fallback to: ${alternativeProviders.join(', ')}`,
    );

    for (const providerName of alternativeProviders) {
      const startTime = Date.now();

      try {
        const provider = this.providerRegistry.getOrThrow(providerName);
        const response = await provider.complete(request);

        const fallbackDecision: RoutingDecision = {
          selectedProvider: providerName,
          selectedModel: request.model,
          strategy,
          reason: `Fallback from "${originalDecision.selectedProvider}"`,
          alternativeProviders: alternativeProviders.filter((p) => p !== providerName),
          estimatedCost: response.cost.totalCost,
        };

        this.requestLogger.log({
          correlationId: request.correlationId,
          provider: providerName,
          model: request.model,
          strategy,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          latencyMs: response.latencyMs,
          cost: response.cost.totalCost,
          status: 'success',
          timestamp: new Date(),
          metadata: {
            ...request.metadata,
            fallbackFrom: originalDecision.selectedProvider,
          },
        });

        return { response, routingDecision: fallbackDecision };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Fallback provider "${providerName}" also failed: ${errorMessage}`);

        this.requestLogger.log({
          correlationId: request.correlationId,
          provider: providerName,
          model: request.model,
          strategy,
          inputTokens: 0,
          outputTokens: 0,
          latencyMs: Date.now() - startTime,
          cost: 0,
          status: 'error',
          errorMessage,
          timestamp: new Date(),
          metadata: {
            ...request.metadata,
            fallbackFrom: originalDecision.selectedProvider,
          },
        });
      }
    }

    throw new Error(
      `All providers exhausted for model "${request.model}". ` +
        `Tried: ${originalDecision.selectedProvider}, ${alternativeProviders.join(', ')}`,
    );
  }
}
