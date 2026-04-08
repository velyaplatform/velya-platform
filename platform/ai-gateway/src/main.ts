import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { GatewayModule } from './gateway.module.js';

const AI_GATEWAY_PORT = 3010;

async function bootstrap(): Promise<void> {
  const logger = new Logger('AIGateway');

  const app = await NestFactory.create(GatewayModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(AI_GATEWAY_PORT);
  logger.log(`AI Gateway listening on port ${AI_GATEWAY_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('AIGateway');
  logger.error(`Failed to start AI Gateway: ${error.message}`, error.stack);
  process.exit(1);
});
