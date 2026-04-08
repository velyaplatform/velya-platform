import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { OrchestratorModule } from './orchestrator.module.js';

const ORCHESTRATOR_PORT = 3020;

async function bootstrap(): Promise<void> {
  const logger = new Logger('AgentOrchestrator');

  const app = await NestFactory.create(OrchestratorModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(ORCHESTRATOR_PORT);
  logger.log(`Agent Orchestrator listening on port ${ORCHESTRATOR_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('AgentOrchestrator');
  logger.error(`Failed to start Agent Orchestrator: ${error.message}`, error.stack);
  process.exit(1);
});
