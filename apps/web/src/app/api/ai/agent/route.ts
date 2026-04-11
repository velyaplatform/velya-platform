import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { resolveAiPolicy, hasAiCapability } from '@/lib/ai-permissions';
import { checkAiRateLimit } from '@/lib/ai-rate-limiter';
import { audit } from '@/lib/audit-logger';
import { runAgent } from '@/lib/ai-agent-orchestrator';
import { getTool } from '@/lib/ai-tools';
import { withErrorBoundary } from '@/lib/api-error-boundary';

/**
 * POST /api/ai/agent
 *
 * Natural-language entry point for the agent orchestrator. Accepts:
 *
 *   { query: string }                    → classify intent + execute tool
 *   { toolId: string, args: object }     → directly execute a registered tool
 *                                          (used for confirm-action callbacks
 *                                          when the orchestrator returned
 *                                          status='requires-approval')
 *
 * Auth + safety pipeline (mirrors /api/ai/chat):
 *   1. Session required
 *   2. Resolve AI policy → must have ai.search-knowledge-base capability
 *   3. Per-user rate limit
 *   4. Tool-level role check (admin tools refuse non-admins)
 *   5. Audit log every call
 *
 * The orchestrator NEVER throws — even on internal errors it returns an
 * AgentResponse with status='error'. This route therefore mostly handles
 * auth + audit; the response is forwarded as-is to the client.
 */

interface AgentRequestBody {
  query?: string;
  toolId?: string;
  args?: Record<string, unknown>;
}

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false;
  const list = (process.env.AI_ADMIN_EMAILS || 'lucaslima4132@gmail.com')
    .split(',')
    .map((e) => e.trim().toLowerCase());
  return list.includes(email.toLowerCase());
}

export const POST = withErrorBoundary(async (request: NextRequest) => {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  let body: AgentRequestBody;
  try {
    body = (await request.json()) as AgentRequestBody;
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!body.query && !body.toolId) {
    return NextResponse.json(
      { error: 'Informe `query` (linguagem natural) ou `toolId` + `args`' },
      { status: 400 },
    );
  }

  const policy = resolveAiPolicy({
    email: session.email,
    professionalRole: session.professionalRole,
  });

  // The agent orchestrator is gated behind ai.search-knowledge-base because
  // every tool it can dispatch is a search/lookup over the platform.
  if (!hasAiCapability(policy, 'ai.search-knowledge-base')) {
    audit({
      category: 'api',
      action: 'ai.agent.denied',
      description: 'Usuário sem permissão para o agente conversacional',
      actor: session.email || session.userId,
      resource: 'ai.agent',
      result: 'failure',
      details: { professionalRole: session.professionalRole },
    });
    return NextResponse.json(
      { error: 'Sua função não tem permissão para o agente conversacional' },
      { status: 403 },
    );
  }

  const rateLimit = checkAiRateLimit(session.userId, policy.maxRequestsPerHour);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Limite horário de IA atingido', rateLimit },
      { status: 429 },
    );
  }

  // Direct tool call path (used by the panel when the user clicks "confirm")
  if (body.toolId) {
    const tool = getTool(body.toolId);
    if (!tool) {
      return NextResponse.json({ error: `Ferramenta ${body.toolId} não existe` }, { status: 404 });
    }
    if (
      tool.requiredRole === 'admin' &&
      !isAdminEmail(session.email) &&
      session.professionalRole !== 'admin_system'
    ) {
      return NextResponse.json(
        { error: `Ferramenta ${body.toolId} requer permissão admin` },
        { status: 403 },
      );
    }
    audit({
      category: 'api',
      action: 'ai.agent.tool-direct',
      description: `Tool direto: ${body.toolId}`,
      actor: session.email || session.userId,
      resource: body.toolId,
      result: 'success',
      details: { args: body.args, requiresApproval: tool.requiresApproval },
    });
    let result;
    try {
      result = await tool.execute((body.args ?? {}) as Record<string, unknown>);
    } catch (err) {
      result = {
        status: 'error' as const,
        summary: 'Erro ao executar a ferramenta',
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
    return NextResponse.json({
      mode: 'direct-tool',
      toolId: body.toolId,
      result,
      rateLimit,
    });
  }

  // Natural-language path
  const query = body.query!.slice(0, 1000); // hard cap to prevent prompt-bomb
  const response = await runAgent(query);

  // Block admin tools from non-admins post-hoc (in case the classifier picked one)
  const dispatchedTool = getTool(response.intent.toolId);
  if (
    dispatchedTool?.requiredRole === 'admin' &&
    !isAdminEmail(session.email) &&
    session.professionalRole !== 'admin_system'
  ) {
    audit({
      category: 'api',
      action: 'ai.agent.admin-tool-blocked',
      description: `Bloqueado: ${response.intent.toolId}`,
      actor: session.email || session.userId,
      resource: response.intent.toolId,
      result: 'failure',
    });
    return NextResponse.json(
      { error: `O agente tentou usar ${response.intent.toolId} mas você não é admin` },
      { status: 403 },
    );
  }

  audit({
    category: 'api',
    action: 'ai.agent.invoked',
    description: `Agent: "${query.slice(0, 80)}" → ${response.intent.toolId} (${Math.round(response.intent.confidence * 100)}%)`,
    actor: session.email || session.userId,
    resource: response.intent.toolId,
    result: response.result.status === 'error' ? 'error' : 'success',
    details: {
      pattern: response.intent.matchedPattern,
      confidence: response.intent.confidence,
      resultStatus: response.result.status,
    },
  });

  return NextResponse.json({
    mode: 'orchestrated',
    ...response,
    rateLimit,
  });
});
