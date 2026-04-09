import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents } from '../../../lib/event-store';
import { audit } from '../../../lib/audit-logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const firingAlerts = body.alerts?.filter((a: { status: string }) => a.status === 'firing') || [];
    const maxSeverity = firingAlerts.reduce((max: string, a: { labels?: { severity?: string } }) => {
      const sev = a.labels?.severity || 'info';
      if (sev === 'critical') return 'critical';
      if (sev === 'warning' && max !== 'critical') return 'warning';
      return max;
    }, 'info');

    const stored = appendEvent('alert', {
      timestamp: body.receivedAt || new Date().toISOString(),
      source: body.receiver || 'alertmanager',
      type: 'alert',
      severity: maxSeverity,
      data: {
        version: body.version,
        groupKey: body.groupKey,
        status: body.status,
        receiver: body.receiver,
        alerts: body.alerts || [],
      },
    });

    // Log structured alert
    console.log(JSON.stringify({
      level: firingAlerts.length > 0 ? 'warn' : 'info',
      service: 'velya-web',
      event: 'alertmanager_webhook',
      status: body.status,
      receiver: body.receiver,
      alertCount: body.alerts?.length || 0,
      firingCount: firingAlerts.length,
      eventId: stored.id,
      alerts: firingAlerts.map((a: { labels?: { alertname?: string; severity?: string; namespace?: string } }) => ({
        name: a.labels?.alertname,
        severity: a.labels?.severity,
        namespace: a.labels?.namespace,
      })),
      timestamp: stored.receivedAt,
    }));

    audit({
      category: 'infra',
      action: 'alert_received',
      description: `Alerta recebido: ${body.status} via ${body.receiver || 'alertmanager'} (${firingAlerts.length} firing)`,
      actor: body.receiver || 'alertmanager',
      resource: `alert:${body.groupKey || 'unknown'}`,
      result: firingAlerts.length > 0 ? 'warning' : 'info',
      details: {
        alertCount: body.alerts?.length || 0,
        firingCount: firingAlerts.length,
        maxSeverity,
        eventId: stored.id,
      },
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({ received: true, id: stored.id });
  } catch (error) {
    audit({
      category: 'infra',
      action: 'alert_received',
      description: 'Falha ao processar alerta',
      actor: 'alertmanager',
      resource: 'alert:unknown',
      result: 'error',
    });
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const severity = searchParams.get('severity') || undefined;
  const source = searchParams.get('source') || undefined;
  const limit = parseInt(searchParams.get('limit') || '200', 10);
  const since = searchParams.get('since') || undefined;
  const unackedOnly = searchParams.get('unackedOnly') === 'true';

  const { events, total } = getEvents('alert', { severity, source, limit, since, unackedOnly });

  const firing = events.filter(e => (e.data as { status?: string }).status === 'firing').length;

  return NextResponse.json({
    alerts: events,
    total,
    firing,
    lastUpdate: events[0]?.receivedAt || null,
  });
}
