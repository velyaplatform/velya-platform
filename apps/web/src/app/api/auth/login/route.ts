import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/auth-session';
import { resolveUiRole } from '@/lib/access-control';
import { authenticateUser } from '@/lib/user-store';
import { audit } from '@/lib/audit-logger';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: 'Email e senha sao obrigatorios' },
      { status: 400 }
    );
  }

  const user = authenticateUser(email, password);

  if (!user) {
    audit({
      category: 'system',
      action: 'login_failed',
      description: `Tentativa de login falhou: ${email}`,
      actor: email,
      resource: 'auth',
      result: 'failure',
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });
    return NextResponse.json(
      { error: 'Email ou senha incorretos, ou conta nao verificada' },
      { status: 401 }
    );
  }

  const professionalRole = resolveUiRole(user.role);

  const session = createSession({
    userId: user.id,
    userName: user.nome,
    role: user.role,
    professionalRole,
    email: user.email,
    setor: user.setor,
    conselhoProfissional: user.conselhoProfissional,
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
  });

  audit({
    category: 'system',
    action: 'login_success',
    description: `Login: ${user.nome} como ${user.role}`,
    actor: user.id,
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
      email: session.email,
      setor: session.setor,
      conselhoProfissional: session.conselhoProfissional,
      loginTime: session.loginTime,
    },
  });

  response.cookies.set('velya_session', session.sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 30 * 60,
    path: '/',
  });

  return response;
}
