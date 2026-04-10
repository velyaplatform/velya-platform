import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  getHandoffById,
  receiveHandoff,
  setHandoffAiSummary,
} from '@/lib/handoff-store';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { id } = await context.params;
  const handoff = getHandoffById(id);
  if (!handoff) {
    return NextResponse.json({ error: 'Handoff não encontrado' }, { status: 404 });
  }
  if (handoff.fromUserId !== session.userId && handoff.toUserId !== session.userId) {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  return NextResponse.json({ handoff });
}

/**
 * PATCH /api/handoffs/[id]
 * Body:
 *   { action: 'receive', readback: string }     → receiver acks the handoff
 *   { action: 'set-ai-summary', summary: string } → set AI summary (any party)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { id } = await context.params;

  let body: { action?: string; readback?: string; summary?: string };
  try {
    body = (await request.json()) as { action?: string; readback?: string; summary?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (body.action === 'receive') {
    if (!body.readback || body.readback.trim().length < 5) {
      return NextResponse.json(
        { error: 'O read-back é obrigatório e precisa ter pelo menos 5 caracteres' },
        { status: 400 },
      );
    }
    const updated = receiveHandoff({
      handoffId: id,
      receiverId: session.userId,
      receiverName: session.userName,
      readback: body.readback,
    });
    if (!updated) {
      return NextResponse.json(
        { error: 'Handoff não encontrado ou você não é o receptor designado' },
        { status: 404 },
      );
    }
    return NextResponse.json({ handoff: updated });
  }

  if (body.action === 'set-ai-summary') {
    if (!body.summary) {
      return NextResponse.json({ error: 'summary é obrigatório' }, { status: 400 });
    }
    const handoff = getHandoffById(id);
    if (!handoff) {
      return NextResponse.json({ error: 'Handoff não encontrado' }, { status: 404 });
    }
    if (handoff.fromUserId !== session.userId && handoff.toUserId !== session.userId) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    const updated = setHandoffAiSummary(id, body.summary);
    return NextResponse.json({ handoff: updated });
  }

  return NextResponse.json({ error: 'action inválido' }, { status: 400 });
}
