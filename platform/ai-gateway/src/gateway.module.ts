import { Module } from '@nestjs/common';
import { ProviderRegistry } from './providers/provider-registry.js';
import { AnthropicProvider } from './providers/anthropic-provider.js';
import { ModelRouter } from './routing/model-router.js';
import { RoutingPolicyEvaluator } from './routing/routing-policy.js';
import { RequestLogger } from './telemetry/request-logger.js';

@Module({
  providers: [
    ProviderRegistry,
    AnthropicProvider,
    ModelRouter,
    RoutingPolicyEvaluator,
    RequestLogger,
  ],
  exports: [ProviderRegistry, ModelRouter, RequestLogger],
})
export class GatewayModule {}
