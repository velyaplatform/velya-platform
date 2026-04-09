import { NextRequest, NextResponse } from 'next/server';
import { audit, queryAudit, listAuditDates, verifyIntegrity } from '@/lib/audit-logger';

// POST: register an audit entry from frontend or external systems
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const entry = audit({
      category: body.category || 'system',
      action: body.action || 'unknown',
      description: body.description || '',
      actor: body.actor || 'unknown',
      resource: body.resource || 'unknown',
      result: body.result || 'info',
      details: body.details || {},
      origin:
        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
      durationMs: body.durationMs,
      statusCode: body.statusCode,
      requestPath: body.requestPath,
      requestMethod: body.requestMethod,
    });

    return NextResponse.json({ registered: true, id: entry.id, hash: entry.hash });
  } catch {
    return NextResponse.json({ error: 'Falha ao registrar auditoria' }, { status: 500 });
  }
}

// GET: query audit log with filters
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Special endpoints
  const action = searchParams.get('action');

  if (action === 'dates') {
    return NextResponse.json({ dates: listAuditDates() });
  }

  if (action === 'verify') {
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const result = verifyIntegrity(date);
    return NextResponse.json(result);
  }

  const result = queryAudit({
    date: searchParams.get('date') || undefined,
    category: searchParams.get('category') || undefined,
    action: searchParams.get('filter_action') || undefined,
    actor: searchParams.get('actor') || undefined,
    resource: searchParams.get('resource') || undefined,
    result: searchParams.get('result') || undefined,
    limit: parseInt(searchParams.get('limit') || '100', 10),
    offset: parseInt(searchParams.get('offset') || '0', 10),
    since: searchParams.get('since') || undefined,
    until: searchParams.get('until') || undefined,
  });

  // Log this query itself as an audit entry
  audit({
    category: 'system',
    action: 'audit_query',
    description: 'Consulta ao log de auditoria',
    actor: 'system',
    resource: 'audit-log',
    result: 'info',
    origin: request.headers.get('x-forwarded-for') || 'unknown',
    clientId: request.headers.get('user-agent') || 'unknown',
  });

  return NextResponse.json(result);
}
