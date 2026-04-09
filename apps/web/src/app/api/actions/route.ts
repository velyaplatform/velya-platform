import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents } from '../../../lib/event-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const stored = appendEvent('action', {
      timestamp: body.timestamp || new Date().toISOString(),
      source: body.source || 'unknown',
      type: 'action',
      severity: body.severity || 'info',
      data: {
        action: body.action,
        target: body.target,
        reason: body.reason,
        result: body.result,
        triggeredBy: body.triggeredBy,
        relatedEventId: body.relatedEventId,
        metadata: body.metadata,
      },
    });

    console.log(
      JSON.stringify({
        level: 'info',
        service: 'velya-web',
        event: 'remediation_action_logged',
        action: body.action,
        target: body.target,
        result: body.result,
        triggeredBy: body.triggeredBy,
        eventId: stored.id,
        timestamp: stored.receivedAt,
      }),
    );

    return NextResponse.json({ received: true, id: stored.id });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const since = searchParams.get('since') || undefined;

  const { events, total } = getEvents('action', { source, limit, since });

  return NextResponse.json({
    actions: events,
    total,
    lastUpdate: events[0]?.receivedAt || null,
  });
}
