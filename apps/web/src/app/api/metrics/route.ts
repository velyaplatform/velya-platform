import { NextResponse } from 'next/server';

export async function GET() {
  const uptime = process.uptime();
  const mem = process.memoryUsage();

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
  ].join('\n');

  return new NextResponse(metrics, {
    headers: { 'Content-Type': 'text/plain; version=0.0.4' },
  });
}
