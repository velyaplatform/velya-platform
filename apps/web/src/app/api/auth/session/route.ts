import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';

export async function GET() {
  const session = await getSessionFromRequest();

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    userName: session.userName,
    role: session.role,
    professionalRole: session.professionalRole,
    email: session.email,
    setor: session.setor,
    conselhoProfissional: session.conselhoProfissional,
    loginTime: session.loginTime,
    lastActivity: session.lastActivity,
    isBreakGlass: session.isBreakGlass,
  });
}
