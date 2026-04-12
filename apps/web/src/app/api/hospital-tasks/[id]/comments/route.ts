import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../../../lib/auth-session';
import { addComment } from '../../../../../lib/hospital-task-store';

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

  if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
    return NextResponse.json({ error: 'Campo "text" obrigatorio' }, { status: 400 });
  }

  const updated = addComment({
    taskId: id,
    author: {
      id: session.userId,
      name: session.userName,
      role: session.role ?? 'unknown',
    },
    text: body.text as string,
  });

  if (!updated) {
    return NextResponse.json({ error: 'Tarefa nao encontrada' }, { status: 404 });
  }

  return NextResponse.json({ task: updated }, { status: 201 });
}
