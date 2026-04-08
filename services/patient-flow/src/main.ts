import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { PatientFlowModule } from './patient-flow.module.js';

const PATIENT_FLOW_PORT = 3001;

async function bootstrap(): Promise<void> {
  const logger = new Logger('PatientFlow');

  const app = await NestFactory.create(PatientFlowModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(PATIENT_FLOW_PORT);
  logger.log(`Patient Flow service listening on port ${PATIENT_FLOW_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('PatientFlow');
  logger.error(`Failed to start Patient Flow service: ${error.message}`, error.stack);
  process.exit(1);
});
