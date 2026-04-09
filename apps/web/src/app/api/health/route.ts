import { NextResponse } from 'next/server';
import { existsSync } from 'fs';
import { audit } from '../../../lib/audit-logger';

const STORE_DIR = process.env.VELYA_EVENT_STORE_PATH || '/tmp/velya-events';

export async function GET() {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  // Check disk store health
  let storeHealthy = false;
  try {
    storeHealthy = existsSync(STORE_DIR);
  } catch {
    storeHealthy = false;
  }

  const status = storeHealthy ? 'ok' : 'degraded';

  audit({
    category: 'system',
    action: 'health_check',
    description: `Health check executado: ${status}`,
    actor: 'system',
    resource: 'health:velya-web',
    result: status === 'ok' ? 'success' : 'warning',
    details: {
      uptime: Math.floor(uptime),
      storeHealthy,
    },
  });

  return NextResponse.json({
    status,
    service: 'velya-web',
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    },
    eventStore: {
      path: STORE_DIR,
      healthy: storeHealthy,
    },
  });
}
