import { NextRequest, NextResponse } from 'next/server';

const alertHistory: AlertPayload[] = [];
const MAX_ALERTS = 200;

interface Alert {
  status: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  generatorURL: string;
  fingerprint: string;
}

interface AlertPayload {
  version: string;
  groupKey: string;
  status: string;
  receiver: string;
  alerts: Alert[];
  receivedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AlertPayload;
    body.receivedAt = new Date().toISOString();

    alertHistory.unshift(body);
    if (alertHistory.length > MAX_ALERTS) {
      alertHistory.length = MAX_ALERTS;
    }

    // Log structured alert
    const firingAlerts = body.alerts?.filter((a: Alert) => a.status === 'firing') || [];
    console.log(JSON.stringify({
      level: firingAlerts.length > 0 ? 'warn' : 'info',
      service: 'velya-web',
      event: 'alertmanager_webhook',
      status: body.status,
      receiver: body.receiver,
      alertCount: body.alerts?.length || 0,
      firingCount: firingAlerts.length,
      alerts: firingAlerts.map((a: Alert) => ({
        name: a.labels?.alertname,
        severity: a.labels?.severity,
        namespace: a.labels?.namespace,
      })),
      timestamp: body.receivedAt,
    }));

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function GET() {
  const firing = alertHistory.filter(a => a.status === 'firing');
  return NextResponse.json({
    alerts: alertHistory,
    total: alertHistory.length,
    firing: firing.length,
    lastUpdate: alertHistory[0]?.receivedAt || null,
  });
}
