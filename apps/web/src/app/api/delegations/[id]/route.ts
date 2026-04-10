import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  getDelegationById,
  updateDelegationStatus,
  type DelegationStatus,
} from '@/lib/delegation-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/delegations/[id]
 * Returns a single delegation if the user is the creator or assignee.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { id } = await context.params;
  const delegation = getDelegationById(id);
  if (!delegation) {
    return NextResponse.json({ error: 'Delegação não encontrada' }, { status: 404 });
  }
  if (
    delegation.createdById !== session.userId &&
    delegation.assignedToId !== session.userId
  ) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  return NextResponse.json({ delegation });
}

/**
 * PATCH /api/delegations/[id]
 * Body: { status: DelegationStatus, note?: string }
 *
 * Allowed only for the assignee or the creator. Every transition is
 * audit-logged in the delegation history and in the global audit chain.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { id } = await context.params;
  let body: { status?: DelegationStatus; note?: string };
  try {
    body = (await request.json()) as { status?: DelegationStatus; note?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.status) {
    return NextResponse.json({ error: 'status é obrigatório' }, { status: 400 });
  }

  const updated = updateDelegationStatus({
    delegationId: id,
    actorId: session.userId,
    actorName: session.userName,
    toStatus: body.status,
    note: body.note,
  });

  if (!updated) {
    return NextResponse.json(
      { error: 'Delegação não encontrada ou sem permissão' },
      { status: 404 },
    );
  }

  return NextResponse.json({ delegation: updated });
}
