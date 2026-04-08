import { NestFactory } from '@nestjs/core';
import { Logger, Module } from '@nestjs/common';
import { MemoryStore } from './memory-store.js';

const MEMORY_SERVICE_PORT = 3040;

@Module({
  providers: [MemoryStore],
  exports: [MemoryStore],
})
class MemoryServiceModule {}

async function bootstrap(): Promise<void> {
  const logger = new Logger('MemoryService');

  const app = await NestFactory.create(MemoryServiceModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api/v1');

  await app.listen(MEMORY_SERVICE_PORT);
  logger.log(`Memory Service listening on port ${MEMORY_SERVICE_PORT}`);
}

bootstrap().catch((error: Error) => {
  const logger = new Logger('MemoryService');
  logger.error(`Failed to start Memory Service: ${error.message}`, error.stack);
  process.exit(1);
});
