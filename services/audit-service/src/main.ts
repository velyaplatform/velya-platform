import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AuditServiceModule } from './audit-service.module.js';

const AUDIT_SERVICE_PORT = 3004;

async function bootstrap(): Promise<void> {
  const logger = new Logger('AuditService');

  const app = await NestFactory.create(AuditServiceModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(AUDIT_SERVICE_PORT);
  logger.log(`Audit Service listening on port ${AUDIT_SERVICE_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('AuditService');
  logger.error(`Failed to start Audit Service: ${error.message}`, error.stack);
  process.exit(1);
});
