import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module, Controller, Get, Logger } from '@nestjs/common';
import * as client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

const SERVICE_NAME = process.env.SERVICE_NAME || 'velya-service';
const PORT = parseInt(process.env.PORT || '3000', 10);

@Controller()
class AppController {
  private readonly logger = new Logger(SERVICE_NAME);

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: process.env.SERVICE_VERSION || '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  ready() {
    return { status: 'ready', service: SERVICE_NAME };
  }

  @Get('metrics')
  async metrics() {
    return register.metrics();
  }
}

@Module({
  controllers: [AppController],
})
class AppModule {}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  // Expose metrics at /metrics (outside prefix)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/metrics', async (_req: any, res: any) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });
  httpAdapter.get('/healthz', (_req: any, res: any) => {
    res.json({ status: 'ok', service: SERVICE_NAME });
  });

  await app.listen(PORT);
  logger.log(`${SERVICE_NAME} listening on port ${PORT}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});
