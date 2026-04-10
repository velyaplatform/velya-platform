import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import {
  resolveAiPolicy,
  hasAiCapability,
  type AiCapability,
} from '@/lib/ai-permissions';
import { checkAiRateLimit } from '@/lib/ai-rate-limiter';
import { audit } from '@/lib/audit-logger';

/**
 * POST /api/ai/chat
 *
 * The single AI chat endpoint for the web app. Every AI conversation goes
 * through here. The endpoint:
 *
 *   1. Authenticates the request via the session cookie.
 *   2. Resolves the user's AI policy (admin allowlist OR professional role).
 *   3. Validates the requested capability is in the policy.
 *   4. Checks the per-user hourly rate limit.
 *   5. Audit-logs the request (with PHI redaction unless the role is exempt).
 *   6. Forwards to the AI gateway service in production. In dev/demo, returns
 *      a structured mock response so the UI is fully functional offline.
 *
 * The architecture rule (.claude/rules/ai-safety.md) is enforced here:
 * "No service or agent may call LLM APIs directly. All AI access goes
 * through packages/ai-gateway/." This route IS the gateway for the web tier.
 */

const AI_GATEWAY_URL = process.env.VELYA_AI_GATEWAY_URL || '';

interface ChatRequestBody {
  capability: AiCapability;
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  context?: {
    patientMrn?: string;
    encounterId?: string;
    moduleId?: string;
  };
}

interface ChatResponseBody {
  reply: string;
  capability: AiCapability;
  modelHint: string;
  citations?: { title: string; href: string }[];
  confidence?: 'low' | 'medium' | 'high';
  evidence?: string[];
  rateLimit: { remaining: number; resetAtMs: number; limit: number };
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.capability || !Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json(
      { error: 'capability e messages são obrigatórios' },
      { status: 400 },
    );
  }

  const policy = resolveAiPolicy({
    email: session.email,
    professionalRole: session.professionalRole,
  });

  if (!hasAiCapability(policy, body.capability)) {
    audit({
      category: 'api',
      action: 'ai.capability.denied',
      description: `Capacidade ${body.capability} negada — usuário sem permissão`,
      actor: session.email || session.userId,
      resource: body.capability,
      result: 'failure',
      details: {
        professionalRole: session.professionalRole,
        moduleId: body.context?.moduleId,
      },
    });
    return NextResponse.json(
      {
        error: 'Sua função não tem permissão para usar esta capacidade de IA',
        capability: body.capability,
        policyLabel: policy.label,
      },
      { status: 403 },
    );
  }

  const rateLimit = checkAiRateLimit(session.userId, policy.maxRequestsPerHour);
  if (!rateLimit.allowed) {
    audit({
      category: 'api',
      action: 'ai.rate-limit.exceeded',
      description: `Limite horário atingido para ${body.capability}`,
      actor: session.email || session.userId,
      resource: body.capability,
      result: 'failure',
      details: { remaining: rateLimit.remaining, resetAtMs: rateLimit.resetAtMs },
    });
    return NextResponse.json(
      {
        error: 'Limite horário de requisições de IA atingido',
        rateLimit,
      },
      { status: 429 },
    );
  }

  // Audit BEFORE calling the model so we never lose the trail.
  audit({
    category: 'api',
    action: 'ai.chat.invoked',
    description: `Chamada IA: ${body.capability}`,
    actor: session.email || session.userId,
    resource: body.capability,
    result: 'success',
    details: {
      professionalRole: session.professionalRole,
      moduleId: body.context?.moduleId,
      patientMrn: policy.redactPhiInLogs ? undefined : body.context?.patientMrn,
      messageCount: body.messages.length,
    },
  });

  // In production, forward to the ai-gateway service. In dev/demo, return
  // a structured mock so the UI is exercisable end-to-end without an LLM key.
  let result: ChatResponseBody;
  if (AI_GATEWAY_URL) {
    try {
      const upstream = await fetch(`${AI_GATEWAY_URL}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Velya-User': session.userId,
          'X-Velya-Role': session.professionalRole,
          'X-Velya-Capability': body.capability,
        },
        body: JSON.stringify({
          capability: body.capability,
          messages: body.messages,
          maxTokens: policy.maxTokensPerRequest,
          requireCitations: policy.requireCitations,
          context: body.context,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (!upstream.ok) {
        throw new Error(`Gateway responded ${upstream.status}`);
      }
      const upstreamData = (await upstream.json()) as Omit<ChatResponseBody, 'rateLimit'>;
      result = { ...upstreamData, rateLimit };
    } catch (err) {
      audit({
        category: 'api',
        action: 'ai.gateway.error',
        description: 'Falha ao chamar AI gateway upstream',
        actor: session.email || session.userId,
        resource: body.capability,
        result: 'error',
        details: { error: err instanceof Error ? err.message : String(err) },
      });
      return NextResponse.json(
        { error: 'AI gateway indisponível. Tente novamente em alguns instantes.' },
        { status: 502 },
      );
    }
  } else {
    result = mockResponse(body, policy.requireCitations, rateLimit);
  }

  return NextResponse.json(result);
}

function mockResponse(
  body: ChatRequestBody,
  requireCitations: boolean,
  rateLimit: { remaining: number; resetAtMs: number; limit: number },
): ChatResponseBody {
  const lastUserMessage = [...body.messages].reverse().find((m) => m.role === 'user');
  const userText = lastUserMessage?.content?.slice(0, 280) ?? '';

  const replies: Record<string, string> = {
    'ai.summarize-patient-record':
      'Resumo (modo demonstração): paciente em internação clínica, sem alergias críticas registradas, em uso de antibiótico empírico. Últimos sinais vitais estáveis. Recomenda-se reconciliação medicamentosa antes da alta. Verifique evidências citadas abaixo.',
    'ai.suggest-differential-diagnosis':
      'Diagnósticos diferenciais sugeridos (modo demonstração): 1) Pneumonia comunitária, 2) Embolia pulmonar, 3) Insuficiência cardíaca descompensada. Solicite radiografia de tórax e D-dímero para refinar a hipótese.',
    'ai.suggest-medication':
      'Sugestão (modo demonstração): considere Ceftriaxona 1g IV 24/24h por 7 dias para o cenário descrito, ajustando por função renal. Verifique alergia a betalactâmicos antes da prescrição.',
    'ai.suggest-icd10':
      'Códigos CID-10 sugeridos: J18.9 (Pneumonia, sem especificação), I50.9 (Insuficiência cardíaca, sem especificação), R06.0 (Dispneia). Confirme com o quadro clínico.',
    'ai.suggest-tuss-code':
      'Códigos TUSS prováveis: 10101012 (Consulta em consultório), 40901114 (Hemograma completo), 40802089 (Radiografia de tórax PA e perfil).',
    'ai.generate-discharge-summary-draft':
      'Rascunho de sumário de alta (modo demonstração): paciente admitido para investigação de quadro respiratório, manejado com antibioticoterapia, evolução favorável. Alta com prescrição de continuidade e retorno em 7 dias.',
    'ai.translate-medical-jargon':
      'Tradução para linguagem leiga (modo demonstração): "FA crônica" significa fibrilação atrial crônica — uma alteração do ritmo do coração que pode aumentar o risco de coágulos.',
    'ai.explain-lab-result':
      'Explicação (modo demonstração): valores de creatinina acima de 1.3 mg/dL podem indicar redução da função renal. Considere repetir em 24h e avaliar histórico do paciente.',
    'ai.suggest-cleaning-checklist':
      'Checklist sugerido (ANVISA RDC 63/2011): 1) Retirar resíduos, 2) Limpeza concorrente das superfícies horizontais, 3) Desinfecção com hipoclorito 0.5% se contaminação por matéria orgânica, 4) Liberação do leito após inspeção visual.',
    'ai.suggest-supplier-evaluation':
      'Avaliação sugerida: fornecedor com SLA de 4h e rating 4.6/5 nos últimos 90 dias. Recomendação: manter como ativo, próxima auditoria em 60 dias.',
    'ai.search-knowledge-base':
      'Resultados (modo demonstração): encontrei 3 documentos relevantes na base interna sobre o tópico solicitado. Veja as citações abaixo.',
    'ai.chat-clinical':
      'Resposta clínica (modo demonstração): entendi sua pergunta sobre o caso. Lembre-se de que toda recomendação de IA é advisória; a decisão final é do profissional habilitado.',
    'ai.chat-administrative':
      'Resposta administrativa (modo demonstração): sua solicitação foi compreendida. Posso ajudar com fluxos de autorização, glosas, contratos e relacionamento com convênios.',
    'ai.chat-unrestricted':
      'Modo administrador (modo demonstração): acesso completo ao escopo da plataforma. O que você precisa investigar?',
    'ai.execute-bulk-actions':
      'Ação em massa requisitada (modo demonstração): para segurança, este tipo de operação exige aprovação humana adicional antes da execução real.',
    'ai.modify-system-settings':
      'Modificação de configuração (modo demonstração): mudanças em configurações do sistema requerem aprovação dupla via painel administrativo.',
    'ai.access-audit-trail':
      'Trilha de auditoria (modo demonstração): última hora — 47 acessos a prontuário, 3 break-glass, 12 prescrições assinadas, 0 falhas de validação.',
  };

  const reply =
    replies[body.capability] ??
    `(modo demonstração) Sua mensagem foi recebida: "${userText}". Em produção, esta resposta viria do AI gateway com o modelo configurado.`;

  return {
    reply,
    capability: body.capability,
    modelHint: 'mock-claude-opus-4-6',
    confidence: 'medium',
    evidence: ['Modo demonstração — sem acesso a LLM real configurado'],
    citations: requireCitations
      ? [
          {
            title: 'Manual técnico Velya — guia de uso de IA clínica',
            href: '/docs/ai-clinical-usage-guide',
          },
        ]
      : undefined,
    rateLimit,
  };
}
