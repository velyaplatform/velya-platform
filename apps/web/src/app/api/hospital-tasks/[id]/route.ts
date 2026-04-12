import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../lib/auth-session';
import { getTaskById, updateTaskStatus } from '../../../../lib/hospital-task-store';
import type { TaskStatus, DeclineReason, BlockReason } from '../../../../lib/hospital-task-types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await context.params;
  const task = getTaskById(id);
  if (!task) {
    return NextResponse.json({ error: 'Tarefa nao encontrada' }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  if (!body.status) {
    return NextResponse.json({ error: 'Campo "status" obrigatorio' }, { status: 400 });
  }

  const updated = updateTaskStatus({
    taskId: id,
    actorId: session.userId,
    actorName: session.userName,
    actorRole: session.role ?? 'unknown',
    toStatus: body.status as TaskStatus,
    note: body.note as string | undefined,
    declineReason: body.declineReason as DeclineReason | undefined,
    declineReasonText: body.declineReasonText as string | undefined,
    blockReason: body.blockReason as BlockReason | undefined,
    blockReasonText: body.blockReasonText as string | undefined,
    estimatedUnblockAt: body.estimatedUnblockAt as string | undefined,
    newAssignedTo: body.newAssignedTo as { id: string; name: string; role: string } | undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Transicao invalida ou tarefa nao encontrada' }, { status: 400 });
  }

  return NextResponse.json({ task: updated });
}
