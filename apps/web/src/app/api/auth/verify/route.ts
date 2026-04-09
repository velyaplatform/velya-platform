import { NextRequest, NextResponse } from 'next/server';
import { verifyUser, findUserByEmail, regenerateVerificationCode } from '@/lib/user-store';
import { audit } from '@/lib/audit-logger';
import { sendVerificationCode } from '@/lib/email-sender';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, code, resend } = body;

  if (!email) {
    return NextResponse.json(
      { error: 'Email obrigatorio' },
      { status: 400 }
    );
  }

  // Handle resend request
  if (resend) {
    const newCode = regenerateVerificationCode(email);
    if (!newCode) {
      return NextResponse.json(
        { error: 'Nao foi possivel reenviar o codigo. Verifique o email informado.' },
        { status: 400 }
      );
    }

    const user = findUserByEmail(email);
    const emailSent = await sendVerificationCode(email, newCode, user?.nome || email);
    console.log(`[VELYA-AUTH] Codigo reenviado para ${email}: ${newCode} (email: ${emailSent ? 'enviado' : 'na tela'})`);

    audit({
      category: 'system',
      action: 'verification_code_resent',
      description: `Codigo de verificacao reenviado para ${email}`,
      actor: email,
      resource: 'auth',
      result: 'success',
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json({
      success: true,
      message: emailSent ? 'Novo codigo enviado para seu email' : 'Novo codigo gerado',
      ...(!emailSent ? { devCode: newCode } : {}),
    });
  }

  if (!code) {
    return NextResponse.json(
      { error: 'Codigo de verificacao obrigatorio' },
      { status: 400 }
    );
  }

  const success = verifyUser(email, code);

  if (!success) {
    const user = findUserByEmail(email);
    const reason = !user
      ? 'usuario nao encontrado'
      : user.verified
        ? 'ja verificado'
        : 'codigo invalido ou expirado';

    audit({
      category: 'system',
      action: 'verification_failed',
      description: `Verificacao falhou para ${email}: ${reason}`,
      actor: email,
      resource: 'auth',
      result: 'failure',
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: request.headers.get('user-agent') || 'unknown',
    });

    return NextResponse.json(
      { error: 'Codigo invalido ou expirado. Tente novamente.' },
      { status: 400 }
    );
  }

  audit({
    category: 'system',
    action: 'user_verified',
    description: `Email verificado: ${email}`,
    actor: email,
    resource: 'auth',
    result: 'success',
    origin: request.headers.get('x-forwarded-for') || 'unknown',
    clientId: request.headers.get('user-agent') || 'unknown',
  });

  return NextResponse.json({
    success: true,
    message: 'Email verificado com sucesso. Voce ja pode fazer login.',
  });
}
