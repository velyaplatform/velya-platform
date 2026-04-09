import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth-session';
import { resolveUiRole } from '@/lib/access-control';
import { audit } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { userId, userName, role, pin } = body;

  if (!userId || !userName || !role) {
    return NextResponse.json({ error: 'Campos obrigatórios: userId, userName, role' }, { status: 400 });
  }

  // For now: simple PIN validation (in production: SSO/IdP integration)
  // Default PIN for dev: "1234"
  if (pin !== '1234' && pin !== process.env.VELYA_DEV_PIN) {
    audit({
      category: 'system',
      action: 'login_failed',
      description: `Tentativa de login falhou: ${userName} (${role})`,
      actor: userId,
      resource: 'auth',
      result: 'failure',
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });
    return NextResponse.json({ error: 'PIN inválido' }, { status: 401 });
  }

  const professionalRole = resolveUiRole(role);

  const session = createSession({
    userId,
    userName,
    role,
    professionalRole,
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  audit({
    category: 'system',
    action: 'login_success',
    description: `Login: ${userName} como ${role}`,
    actor: userId,
    resource: 'auth',
    result: 'success',
    origin: request.headers.get('x-forwarded-for') || 'unknown',
    clientId: request.headers.get('user-agent') || 'unknown',
  });

  const response = NextResponse.json({
    success: true,
    session: {
      userName: session.userName,
      role: session.role,
      professionalRole: session.professionalRole,
      loginTime: session.loginTime,
    },
  });

  // Set HTTP-only cookie
  response.cookies.set('velya_session', session.sessionId, {
    httpOnly: true,
    secure: false, // dev mode; true in production
    sameSite: 'lax',
    maxAge: 30 * 60, // 30 min
    path: '/',
  });

  return response;
}
