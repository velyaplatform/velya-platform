import { NextRequest, NextResponse } from 'next/server';

interface PlatformEvent {
  id: string;
  timestamp: string;
  source: string;
  severity: string;
  summary: string;
  data: Record<string, unknown>;
  actionRequired: boolean;
  suggestedAction?: string;
  cluster: string;
  namespaces?: string[];
  services?: string[];
  receivedAt?: string;
}

const eventBuffer: PlatformEvent[] = [];
const MAX_EVENTS = 500;

export async function POST(request: NextRequest) {
  try {
    const event = await request.json() as PlatformEvent;
    event.receivedAt = new Date().toISOString();

    eventBuffer.unshift(event);
    if (eventBuffer.length > MAX_EVENTS) {
      eventBuffer.length = MAX_EVENTS;
    }

    console.log(JSON.stringify({
      level: event.severity === 'critical' ? 'error' : event.severity === 'warning' ? 'warn' : 'info',
      service: 'velya-web',
      event: 'platform_event',
      source: event.source,
      severity: event.severity,
      actionRequired: event.actionRequired,
      summary: event.summary,
      timestamp: event.timestamp,
    }));

    return NextResponse.json({ received: true, id: event.id });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const severity = searchParams.get('severity');
  const source = searchParams.get('source');
  const actionOnly = searchParams.get('actionRequired') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  let filtered = eventBuffer;

  if (severity) {
    filtered = filtered.filter(e => e.severity === severity);
  }
  if (source) {
    filtered = filtered.filter(e => e.source === source);
  }
  if (actionOnly) {
    filtered = filtered.filter(e => e.actionRequired);
  }

  return NextResponse.json({
    events: filtered.slice(0, limit),
    total: filtered.length,
    lastUpdate: eventBuffer[0]?.receivedAt || null,
    summary: {
      total: eventBuffer.length,
      critical: eventBuffer.filter(e => e.severity === 'critical').length,
      warning: eventBuffer.filter(e => e.severity === 'warning').length,
      actionRequired: eventBuffer.filter(e => e.actionRequired).length,
    },
  });
}
