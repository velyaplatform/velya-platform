import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  addFavorite,
  clearScope,
  listAllFavorites,
  listFavorites,
  removeFavorite,
  type FavoriteEntry,
} from '@/lib/favorites-store';

/**
 * GET    /api/favorites?scope=patients
 * POST   /api/favorites { scope, entry }
 * DELETE /api/favorites?scope=patients&id=MRN-EXAMPLE
 * DELETE /api/favorites?scope=patients&clear=true
 */

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  if (scope) {
    return NextResponse.json({
      scope,
      items: listFavorites(session.userId, scope),
    });
  }
  return NextResponse.json({
    scopes: listAllFavorites(session.userId),
  });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  let body: { scope?: string; entry?: Omit<FavoriteEntry, 'addedAt'> };
  try {
    body = (await request.json()) as { scope?: string; entry?: Omit<FavoriteEntry, 'addedAt'> };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.scope || !body.entry || !body.entry.id || !body.entry.label) {
    return NextResponse.json(
      { error: 'scope + entry.id + entry.label são obrigatórios' },
      { status: 400 },
    );
  }
  const items = addFavorite({
    userId: session.userId,
    userName: session.userName,
    scope: body.scope,
    entry: body.entry,
  });
  return NextResponse.json({ scope: body.scope, items }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const url = new URL(request.url);
  const scope = url.searchParams.get('scope');
  if (!scope) {
    return NextResponse.json({ error: 'scope é obrigatório' }, { status: 400 });
  }
  if (url.searchParams.get('clear') === 'true') {
    clearScope(session.userId, session.userName, scope);
    return NextResponse.json({ scope, items: [] });
  }
  const id = url.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id é obrigatório (ou clear=true)' }, { status: 400 });
  }
  const items = removeFavorite({
    userId: session.userId,
    userName: session.userName,
    scope,
    id,
  });
  return NextResponse.json({ scope, items });
}
