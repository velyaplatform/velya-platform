import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/user-store';
import { UI_ROLE_MAP } from '@/lib/access-control';
import { audit } from '@/lib/audit-logger';
import { sendVerificationCode } from '@/lib/email-sender';

const VALID_ROLES = Object.keys(UI_ROLE_MAP);

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password, nome, role, setor, conselhoProfissional } = body;

  // Validate required fields
  if (!email || !password || !nome || !role || !setor) {
    return NextResponse.json(
      { error: 'Campos obrigatorios: email, senha, nome completo, profissao e setor' },
      { status: 400 },
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: 'Formato de email invalido' }, { status: 400 });
  }

  // Validate password strength
  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter no minimo 6 caracteres' }, { status: 400 });
  }

  // Validate role
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Profissao/funcao invalida' }, { status: 400 });
  }

  // Check if user already exists
  const existing = findUserByEmail(email);
  if (existing) {
    return NextResponse.json({ error: 'Ja existe uma conta com este email' }, { status: 409 });
  }

  // Create user
  const { user, verificationCode } = createUser({
    email,
    password,
    nome,
    role,
    setor,
    conselhoProfissional: conselhoProfissional || undefined,
  });

  // Enviar código por email (se Resend configurado) ou mostrar na tela
  const emailSent = await sendVerificationCode(email, verificationCode, nome);
  console.log(
    `[VELYA-AUTH] Codigo para ${email}: ${verificationCode} (email: ${emailSent ? 'enviado' : 'não enviado — mostrar na tela'})`,
  );

  audit({
    category: 'system',
    action: 'user_registered',
    description: `Novo cadastro: ${nome} (${role}) - ${email}`,
    actor: user.id,
    resource: 'auth',
    result: 'success',
    origin: request.headers.get('x-forwarded-for') || 'unknown',
    clientId: request.headers.get('user-agent') || 'unknown',
  });

  return NextResponse.json({
    success: true,
    message: 'Codigo de verificacao enviado para seu email',
    email: user.email,
    // Se email não foi enviado, incluir código na resposta para mostrar na tela
    ...(!emailSent ? { devCode: verificationCode, emailSent: false } : { emailSent: true }),
  });
}
