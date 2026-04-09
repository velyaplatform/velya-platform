import { NextRequest, NextResponse } from 'next/server';

// In-memory buffer of last N sentinel reports (production: use Redis/PostgreSQL)
const sentinelReports: SentinelReport[] = [];
const MAX_REPORTS = 100;

interface SentinelReport {
  sentinel: string;
  timestamp: string;
  status: string;
  findings: Array<{ type: string; message: string; severity: string }>;
  cluster: string;
  receivedAt: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SentinelReport;
    body.receivedAt = new Date().toISOString();

    sentinelReports.unshift(body);
    if (sentinelReports.length > MAX_REPORTS) {
      sentinelReports.length = MAX_REPORTS;
    }

    // Log for observability
    console.log(JSON.stringify({
      level: 'info',
      service: 'velya-web',
      event: 'sentinel_report_received',
      sentinel: body.sentinel,
      status: body.status,
      findingsCount: body.findings?.length || 0,
      timestamp: body.timestamp,
    }));

    return NextResponse.json({ received: true, id: sentinelReports.length });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    reports: sentinelReports,
    total: sentinelReports.length,
    lastUpdate: sentinelReports[0]?.receivedAt || null,
  });
}
