import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  createDelegation,
  listDelegations,
  type CreateDelegationInput,
  type DelegationStatus,
} from '@/lib/delegation-store';

/**
 * GET /api/delegations
 *
 * Query params:
 *   - inbox=true     → tarefas atribuídas ao usuário atual (recebidas)
 *   - sent=true      → tarefas criadas pelo usuário atual (enviadas)
 *   - status=open    → filtrar por status
 *   - patientMrn=... → filtrar por paciente
 */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const url = new URL(request.url);
  const inbox = url.searchParams.get('inbox') === 'true';
  const sent = url.searchParams.get('sent') === 'true';
  const status = url.searchParams.get('status') as DelegationStatus | null;
  const patientMrn = url.searchParams.get('patientMrn') ?? undefined;

  // Default: show inbox (tasks delegated TO me)
  const showInbox = inbox || (!inbox && !sent);

  const items = listDelegations({
    assignedToId: showInbox ? session.userId : undefined,
    createdById: sent ? session.userId : undefined,
    status: status ?? undefined,
    patientMrn,
    limit: 100,
  });

  return NextResponse.json({
    items,
    count: items.length,
    filter: { inbox: showInbox, sent, status, patientMrn },
  });
}

/**
 * POST /api/delegations
 *
 * Body: { title, description, category, priority, assignedToId, assignedToName,
 *         patientMrn?, dueAt?, deliverables?, acceptanceCriteria?, location? }
 */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: Partial<CreateDelegationInput>;
  try {
    body = (await request.json()) as Partial<CreateDelegationInput>;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (
    !body.title ||
    !body.description ||
    !body.assignedToId ||
    !body.assignedToName ||
    !body.category ||
    !body.priority
  ) {
    return NextResponse.json(
      {
        error:
          'title, description, category, priority, assignedToId e assignedToName são obrigatórios',
      },
      { status: 400 },
    );
  }

  const delegation = createDelegation({
    title: body.title,
    description: body.description,
    category: body.category,
    priority: body.priority,
    createdById: session.userId,
    createdByName: session.userName,
    assignedToId: body.assignedToId,
    assignedToName: body.assignedToName,
    patientMrn: body.patientMrn,
    relatedEntity: body.relatedEntity,
    dueAt: body.dueAt,
    deliverables: body.deliverables,
    acceptanceCriteria: body.acceptanceCriteria,
    location: body.location,
  });

  return NextResponse.json({ delegation }, { status: 201 });
}
