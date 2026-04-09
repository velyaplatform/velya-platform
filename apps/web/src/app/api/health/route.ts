import { NextResponse } from 'next/server';

export async function GET() {
  const uptime = process.uptime();
  const memUsage = process.memoryUsage();

  return NextResponse.json({
    status: 'ok',
    service: 'velya-web',
    version: process.env.npm_package_version || '0.1.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
    },
  });
}
