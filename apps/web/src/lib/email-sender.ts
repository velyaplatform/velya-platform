import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.VELYA_FROM_EMAIL || 'onboarding@resend.dev';
const APP_NAME = 'Velya — Plataforma Hospitalar';

/**
 * Envia código de verificação por email.
 * Se RESEND_API_KEY não estiver configurada, retorna false (código aparece na tela).
 */
export async function sendVerificationCode(
  to: string,
  code: string,
  userName: string
): Promise<boolean> {
  if (!resend) {
    console.log(`[EMAIL] Resend não configurado — código ${code} para ${to} (mostrar na tela)`);
    return false;
  }

  try {
    const { error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject: `${code} — Código de verificação Velya`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 2rem;">
          <div style="background: #0f172a; border-radius: 12px; padding: 2rem; color: white; text-align: center;">
            <h1 style="font-size: 1.5rem; margin: 0 0 0.5rem;">Velya</h1>
            <p style="color: #94a3b8; margin: 0; font-size: 0.875rem;">Plataforma Hospitalar</p>
          </div>

          <div style="padding: 2rem 0;">
            <p style="color: #334155; font-size: 1rem;">Olá <strong>${userName}</strong>,</p>
            <p style="color: #334155; font-size: 1rem;">Seu código de verificação é:</p>

            <div style="background: #f1f5f9; border-radius: 12px; padding: 1.5rem; text-align: center; margin: 1.5rem 0;">
              <span style="font-size: 2.5rem; font-weight: 700; letter-spacing: 0.5rem; color: #0f172a;">${code}</span>
            </div>

            <p style="color: #64748b; font-size: 0.875rem;">Este código expira em <strong>30 minutos</strong>.</p>
            <p style="color: #64748b; font-size: 0.875rem;">Se você não solicitou este código, ignore este email.</p>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 1rem;">
            <p style="color: #94a3b8; font-size: 0.75rem; text-align: center;">
              Velya — Plataforma Hospitalar Inteligente<br>
              Este é um email automático, não responda.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error(`[EMAIL] Erro ao enviar para ${to}:`, error);
      return false;
    }

    console.log(`[EMAIL] Código enviado para ${to}`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Falha ao enviar para ${to}:`, err);
    return false;
  }
}
