import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { TaskInboxModule } from './task-inbox.module.js';

const TASK_INBOX_PORT = 3003;

async function bootstrap(): Promise<void> {
  const logger = new Logger('TaskInbox');

  const app = await NestFactory.create(TaskInboxModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(TASK_INBOX_PORT);
  logger.log(`Task Inbox service listening on port ${TASK_INBOX_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('TaskInbox');
  logger.error(`Failed to start Task Inbox service: ${error.message}`, error.stack);
  process.exit(1);
});
