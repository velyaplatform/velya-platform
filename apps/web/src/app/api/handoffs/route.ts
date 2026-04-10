import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  createHandoff,
  listHandoffs,
  type CreateHandoffInput,
  type HandoffStatus,
} from '@/lib/handoff-store';

/**
 * GET /api/handoffs?inbox=true|sent=true&status=...&ward=...
 * POST /api/handoffs (create new handoff)
 */

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const inbox = url.searchParams.get('inbox') === 'true';
  const sent = url.searchParams.get('sent') === 'true';
  const status = url.searchParams.get('status') as HandoffStatus | null;
  const ward = url.searchParams.get('ward') ?? undefined;

  const showInbox = inbox || (!inbox && !sent);
  const items = listHandoffs({
    toUserId: showInbox ? session.userId : undefined,
    fromUserId: sent ? session.userId : undefined,
    status: status ?? undefined,
    ward,
    limit: 100,
  });

  return NextResponse.json({ items, count: items.length });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: Partial<CreateHandoffInput>;
  try {
    body = (await request.json()) as Partial<CreateHandoffInput>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (
    !body.toUserId ||
    !body.toUserName ||
    !body.toRole ||
    !body.ward ||
    !body.shiftLabel ||
    !body.shiftBoundaryAt ||
    !Array.isArray(body.patients)
  ) {
    return NextResponse.json(
      { error: 'toUserId, toUserName, toRole, ward, shiftLabel, shiftBoundaryAt e patients são obrigatórios' },
      { status: 400 },
    );
  }

  const handoff = createHandoff({
    fromUserId: session.userId,
    fromUserName: session.userName,
    fromRole: session.professionalRole,
    toUserId: body.toUserId,
    toUserName: body.toUserName,
    toRole: body.toRole,
    ward: body.ward,
    shiftLabel: body.shiftLabel,
    shiftBoundaryAt: body.shiftBoundaryAt,
    patients: body.patients,
    unitNotes: body.unitNotes,
  });

  return NextResponse.json({ handoff }, { status: 201 });
}
