import { NextResponse } from 'next/server';
import { getStats } from '../../../lib/event-store';

export async function GET() {
  const uptime = process.uptime();
  const mem = process.memoryUsage();
  const stats = getStats();

  const eventMetrics: string[] = [];
  for (const [type, data] of Object.entries(stats)) {
    eventMetrics.push(`velya_web_events_total{type="${type}"} ${data.total}`);
    eventMetrics.push(`velya_web_events_unacked{type="${type}"} ${data.unacked}`);
  }

  const metrics = [
    '# HELP velya_web_uptime_seconds Web app uptime in seconds',
    '# TYPE velya_web_uptime_seconds gauge',
    `velya_web_uptime_seconds ${Math.floor(uptime)}`,
    '',
    '# HELP velya_web_memory_rss_bytes Resident set size in bytes',
    '# TYPE velya_web_memory_rss_bytes gauge',
    `velya_web_memory_rss_bytes ${mem.rss}`,
    '',
    '# HELP velya_web_memory_heap_used_bytes Heap used in bytes',
    '# TYPE velya_web_memory_heap_used_bytes gauge',
    `velya_web_memory_heap_used_bytes ${mem.heapUsed}`,
    '',
    '# HELP velya_web_info Build information',
    '# TYPE velya_web_info gauge',
    `velya_web_info{version="${process.env.npm_package_version || '0.1.0'}"} 1`,
    '',
    '# HELP velya_web_events_total Total stored events by type',
    '# TYPE velya_web_events_total gauge',
    '# HELP velya_web_events_unacked Unacknowledged events by type',
    '# TYPE velya_web_events_unacked gauge',
    ...eventMetrics,
  ].join('\n');

  return new NextResponse(metrics, {
    headers: { 'Content-Type': 'text/plain; version=0.0.4' },
  });
}
