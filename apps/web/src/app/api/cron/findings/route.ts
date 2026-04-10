import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  listFindings,
  updateFinding,
  type FindingStatus,
  type Severity,
  type Surface,
} from '@/lib/cron-store';

/**
 * GET    /api/cron/findings?status=&severity=&surface=&jobId=
 * PATCH  /api/cron/findings { findingId, action: 'dismiss'|'resolve-manual'|'promote', note? }
 */

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get('status') as FindingStatus | null;
  const severity = url.searchParams.get('severity') as Severity | null;
  const surface = url.searchParams.get('surface') as Surface | null;
  const jobId = url.searchParams.get('jobId') ?? undefined;
  const items = listFindings({
    status: status ?? undefined,
    severity: severity ?? undefined,
    surface: surface ?? undefined,
    jobId,
    limit: 200,
  });
  return NextResponse.json({ items, count: items.length });
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: { findingId?: string; action?: string; note?: string };
  try {
    body = (await request.json()) as { findingId?: string; action?: string; note?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.findingId || !body.action) {
    return NextResponse.json({ error: 'findingId e action são obrigatórios' }, { status: 400 });
  }

  let nextStatus: FindingStatus | null = null;
  if (body.action === 'dismiss') nextStatus = 'dismissed';
  else if (body.action === 'resolve-manual') nextStatus = 'resolved-manual';
  else if (body.action === 'promote') {
    // For now, promote = resolved-auto. In a future iteration this would
    // actually execute the shadowAction (only for safe scopes).
    nextStatus = 'resolved-auto';
  }
  if (!nextStatus) {
    return NextResponse.json({ error: 'action inválida' }, { status: 400 });
  }

  const updated = updateFinding(
    body.findingId,
    { status: nextStatus, resolutionNote: body.note },
    session.userName,
  );
  if (!updated) {
    return NextResponse.json({ error: 'Finding não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ finding: updated });
}
