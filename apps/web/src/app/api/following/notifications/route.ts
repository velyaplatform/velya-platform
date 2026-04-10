import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from '@/lib/following-store';

/**
 * GET    /api/following/notifications?unread=true&limit=50
 * PATCH  /api/following/notifications  { action: 'mark-read' | 'mark-all-read', notificationId? }
 */

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Math.max(0, Math.min(200, Number(limitParam))) : 50;
  const notifications = listNotifications(session.userId, {
    unreadOnly,
    limit: Number.isFinite(limit) ? limit : 50,
  });
  return NextResponse.json({
    notifications,
    unreadCount: unreadCount(session.userId),
  });
}

interface PatchBody {
  action?: 'mark-read' | 'mark-all-read';
  notificationId?: string;
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (body.action === 'mark-all-read') {
    markAllRead(session.userId);
    return NextResponse.json({
      ok: true,
      unreadCount: unreadCount(session.userId),
    });
  }
  if (body.action === 'mark-read') {
    if (!body.notificationId) {
      return NextResponse.json(
        { error: 'notificationId é obrigatório para mark-read' },
        { status: 400 },
      );
    }
    markRead(session.userId, body.notificationId);
    return NextResponse.json({
      ok: true,
      unreadCount: unreadCount(session.userId),
    });
  }
  return NextResponse.json(
    { error: 'action deve ser mark-read ou mark-all-read' },
    { status: 400 },
  );
}
