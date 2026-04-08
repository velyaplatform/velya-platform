import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DischargeOrchestratorModule } from './discharge-orchestrator.module.js';

const DISCHARGE_ORCHESTRATOR_PORT = 3002;

async function bootstrap(): Promise<void> {
  const logger = new Logger('DischargeOrchestrator');

  const app = await NestFactory.create(DischargeOrchestratorModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(DISCHARGE_ORCHESTRATOR_PORT);
  logger.log(`Discharge Orchestrator listening on port ${DISCHARGE_ORCHESTRATOR_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('DischargeOrchestrator');
  logger.error(`Failed to start Discharge Orchestrator: ${error.message}`, error.stack);
  process.exit(1);
});
