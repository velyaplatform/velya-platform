import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { PolicyEngine } from './engine.js';

const POLICY_ENGINE_PORT = 3030;

@Module({
  providers: [PolicyEngine],
  exports: [PolicyEngine],
})
class PolicyEngineModule {}

async function bootstrap(): Promise<void> {
  const logger = new Logger('PolicyEngine');

  const app = await NestFactory.create(PolicyEngineModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(POLICY_ENGINE_PORT);
  logger.log(`Policy Engine listening on port ${POLICY_ENGINE_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('PolicyEngine');
  logger.error(`Failed to start Policy Engine: ${error.message}`, error.stack);
  process.exit(1);
});
