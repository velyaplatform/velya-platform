import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { DecisionLog } from './decision-log.js';

const DECISION_LOG_PORT = 3050;

@Module({
  providers: [DecisionLog],
  exports: [DecisionLog],
})
class DecisionLogModule {}

async function bootstrap(): Promise<void> {
  const logger = new Logger('DecisionLogService');

  const app = await NestFactory.create(DecisionLogModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(DECISION_LOG_PORT);
  logger.log(`Decision Log Service listening on port ${DECISION_LOG_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('DecisionLogService');
  logger.error(`Failed to start Decision Log Service: ${error.message}`, error.stack);
  process.exit(1);
});
