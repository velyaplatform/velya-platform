import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents } from '../../../lib/event-store';
import { audit } from '../../../lib/audit-logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const stored = appendEvent('event', {
      timestamp: body.timestamp || new Date().toISOString(),
      source: body.source || 'unknown',
      type: 'event',
      severity: body.severity || 'info',
      data: {
        id: body.id,
        summary: body.summary,
        actionRequired: body.actionRequired || false,
        suggestedAction: body.suggestedAction,
        cluster: body.cluster,
        namespaces: body.namespaces,
        services: body.services,
        ...body.data,
      },
    });

    console.log(
      JSON.stringify({
        level:
          body.severity === 'critical' ? 'error' : body.severity === 'warning' ? 'warn' : 'info',
        service: 'velya-web',
        event: 'platform_event',
        source: body.source,
        severity: body.severity,
        actionRequired: body.actionRequired,
        summary: body.summary,
        eventId: stored.id,
        timestamp: body.timestamp,
      }),
    );

    audit({
      category: 'backend',
      action: 'platform_event',
      description: `Evento recebido: ${body.summary || body.source || 'unknown'}`,
      actor: body.source || 'unknown',
      resource: `event:${body.id || stored.id}`,
      result:
        body.severity === 'critical' ? 'error' : body.severity === 'warning' ? 'warning' : 'info',
      details: {
        severity: body.severity,
        actionRequired: body.actionRequired,
        cluster: body.cluster,
        eventId: stored.id,
      },
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ received: true, id: stored.id });
  } catch {
    audit({
      category: 'backend',
      action: 'platform_event',
      description: 'Falha ao processar evento da plataforma',
      actor: 'unknown',
      resource: 'event:unknown',
      result: 'error',
    });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const severity = searchParams.get('severity') || undefined;
  const source = searchParams.get('source') || undefined;
  const actionOnly = searchParams.get('actionRequired') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const since = searchParams.get('since') || undefined;
  const unackedOnly = searchParams.get('unackedOnly') === 'true';

  const { events, total } = getEvents('event', { severity, source, limit, since, unackedOnly });

  // Apply actionRequired filter on top of store filters
  let filtered = events;
  if (actionOnly) {
    filtered = filtered.filter((e) => (e.data as { actionRequired?: boolean }).actionRequired);
  }

  // Compute summary from all events (not just filtered)
  const allEvents = getEvents('event', {});

  return NextResponse.json({
    events: filtered,
    total: actionOnly ? filtered.length : total,
    lastUpdate: events[0]?.receivedAt || null,
    summary: {
      total: allEvents.total,
      critical: getEvents('event', { severity: 'critical' }).total,
      warning: getEvents('event', { severity: 'warning' }).total,
      actionRequired: allEvents.events.filter(
        (e) => (e.data as { actionRequired?: boolean }).actionRequired,
      ).length,
    },
  });
}
