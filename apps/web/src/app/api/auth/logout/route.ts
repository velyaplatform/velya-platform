import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, destroySession } from '@/lib/auth-session';
import { audit } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();

  if (session) {
    audit({
      category: 'system',
      action: 'logout',
      description: `Logout: ${session.userName} (${session.role})`,
      actor: session.userId,
      resource: 'auth',
      result: 'success',
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });
    destroySession(session.sessionId);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete('velya_session');
  return response;
}
