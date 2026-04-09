import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents, ackEvent } from '../../../lib/event-store';
import { audit } from '../../../lib/audit-logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const stored = appendEvent('error', {
      timestamp: body.timestamp || new Date().toISOString(),
      source: body.source || 'unknown',
      type: 'error',
      severity: body.severity || 'error',
      data: {
        message: body.message,
        stack: body.stack,
        component: body.component,
        userAgent: body.userAgent,
        url: body.url,
        metadata: body.metadata,
      },
    });

    console.log(JSON.stringify({
      level: 'error',
      service: 'velya-web',
      event: 'error_report_received',
      source: body.source,
      severity: body.severity,
      component: body.component,
      message: body.message,
      eventId: stored.id,
      timestamp: stored.receivedAt,
    }));

    audit({
      category: 'system',
      action: 'error_report',
      description: `Erro reportado: ${body.message || 'unknown'} em ${body.component || 'unknown'}`,
      actor: body.source || 'unknown',
      resource: `error:${body.component || 'unknown'}`,
      result: 'error',
      details: {
        component: body.component,
        url: body.url,
        severity: body.severity,
        eventId: stored.id,
      },
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ received: true, id: stored.id });
  } catch {
    audit({
      category: 'system',
      action: 'error_report',
      description: 'Falha ao processar relatorio de erro',
      actor: 'unknown',
      resource: 'error:unknown',
      result: 'error',
    });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const severity = searchParams.get('severity') || undefined;
  const source = searchParams.get('source') || undefined;
  const limit = parseInt(searchParams.get('limit') || '100', 10);
  const since = searchParams.get('since') || undefined;
  const unackedOnly = searchParams.get('unackedOnly') === 'true';

  const { events, total } = getEvents('error', { severity, source, limit, since, unackedOnly });

  return NextResponse.json({
    errors: events,
    total,
    lastUpdate: events[0]?.receivedAt || null,
  });
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const success = ackEvent('error', id);
    if (!success) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ acked: true, id });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
