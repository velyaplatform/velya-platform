import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents } from '../../../lib/event-store';
import { audit } from '../../../lib/audit-logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const stored = appendEvent('sentinel', {
      timestamp: body.timestamp || new Date().toISOString(),
      source: body.sentinel || 'unknown',
      type: 'sentinel',
      severity:
        body.status === 'critical' ? 'critical' : body.status === 'warning' ? 'warning' : 'info',
      data: {
        sentinel: body.sentinel,
        status: body.status,
        findings: body.findings || [],
        cluster: body.cluster,
      },
    });

    // Log for observability
    console.log(
      JSON.stringify({
        level: 'info',
        service: 'velya-web',
        event: 'sentinel_report_received',
        sentinel: body.sentinel,
        status: body.status,
        findingsCount: body.findings?.length || 0,
        eventId: stored.id,
        timestamp: body.timestamp,
      }),
    );

    audit({
      category: 'infra',
      action: 'sentinel_report',
      description: `Relatorio sentinel recebido: ${body.sentinel}`,
      actor: body.sentinel || 'sentinel',
      resource: `sentinel:${body.sentinel}`,
      result: body.status === 'critical' ? 'warning' : 'success',
      details: body,
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ received: true, id: stored.id });
  } catch (error) {
    audit({
      category: 'infra',
      action: 'sentinel_report',
      description: 'Falha ao processar relatorio sentinel',
      actor: 'sentinel',
      resource: 'sentinel:unknown',
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

  const { events, total } = getEvents('sentinel', { severity, source, limit, since, unackedOnly });

  return NextResponse.json({
    reports: events,
    total,
    lastUpdate: events[0]?.receivedAt || null,
  });
}
