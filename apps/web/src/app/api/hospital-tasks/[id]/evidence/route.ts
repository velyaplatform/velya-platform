import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/auth-session';
import { attachEvidence } from '../../../../../lib/hospital-task-store';
import type { EvidenceType } from '../../../../../lib/hospital-task-types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
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

  if (!body.type || !body.value) {
    return NextResponse.json({ error: 'Campos "type" e "value" obrigatorios' }, { status: 400 });
  }

  const updated = attachEvidence({
    taskId: id,
    actor: {
      id: session.userId,
      name: session.userName,
      role: session.role ?? 'unknown',
    },
    type: body.type as EvidenceType,
    value: body.value as string,
    metadata: body.metadata as Record<string, unknown> | undefined,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Tarefa nao encontrada' }, { status: 404 });
  }

  return NextResponse.json({ task: updated }, { status: 201 });
}
