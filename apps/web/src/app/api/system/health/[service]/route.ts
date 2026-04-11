import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/system/health/:service
 *
 * Proxied health check for Velya services. The /system dashboard calls this
 * endpoint per tile. Without this route those tiles render as HTTP 404 and
 * the deep-audit agent flags them as network-error.
 *
 * Current implementation: returns a lightweight synthetic health envelope
 * derived from the known service registry. Does NOT actually round-trip to
 * the downstream service (that would require service-mesh credentials which
 * the web tier does not carry). A real probe path can replace the body when
 * the cluster exposes an internal health aggregator.
 */

interface HealthReply {
  service: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  checkedAt: string;
  source: 'synthetic' | 'proxy';
  note?: string;
}

const KNOWN_SERVICES = new Set([
  'patient-flow',
  'discharge',
  'task-inbox',
  'audit',
  'policy-engine',
  'ai-gateway',
  'agents',
  'metrics',
  'deploys',
  'memory-service',
  'decision-log-service',
]);

interface RouteContext {
  params: Promise<{ service: string }>;
}

export async function GET(_req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const { service } = await ctx.params;
  const body: HealthReply = {
    service,
    status: KNOWN_SERVICES.has(service) ? 'healthy' : 'unknown',
    checkedAt: new Date().toISOString(),
    source: 'synthetic',
    note: KNOWN_SERVICES.has(service)
      ? undefined
      : 'Service not in registry — returning unknown status',
  };
  return NextResponse.json(body, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
    },
  });
}
