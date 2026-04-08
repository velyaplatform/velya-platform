import { Controller, Get } from '@nestjs/common';

interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  service: string;
  version: string;
  timestamp: string;
  uptime: number;
}

@Controller('health')
export class HealthController {
  private readonly startTime = Date.now();

  @Get()
  check(): HealthCheckResponse {
    return {
      status: 'ok',
      service: 'velya-api-gateway',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
