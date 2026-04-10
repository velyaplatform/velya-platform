import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  listSubscriptions,
  subscribe,
  unsubscribe,
  unreadCount,
} from '@/lib/following-store';

/**
 * GET    /api/following              → { subscriptions, unreadCount }
 * POST   /api/following              { scope, id, label, href }
 * DELETE /api/following?scope=&id=
 */

export async function GET(_request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  return NextResponse.json({
    subscriptions: listSubscriptions(session.userId),
    unreadCount: unreadCount(session.userId),
  });
}

interface SubscribeBody {
  scope?: string;
  id?: string;
  label?: string;
  href?: string;
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  let body: SubscribeBody;
  try {
    body = (await request.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.scope || !body.id || !body.label) {
    return NextResponse.json(
      { error: 'scope, id e label são obrigatórios' },
      { status: 400 },
    );
  }
  const subscriptions = subscribe(session.userId, session.userName, {
    id: body.id,
    scope: body.scope,
    label: body.label,
    href: body.href,
  });
  return NextResponse.json({ subscriptions }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  const id = url.searchParams.get('id');
  if (!scope || !id) {
    return NextResponse.json(
      { error: 'scope e id são obrigatórios' },
      { status: 400 },
    );
  }
  const subscriptions = unsubscribe(session.userId, session.userName, scope, id);
  return NextResponse.json({ subscriptions });
}
