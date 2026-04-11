import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { isAiAdminEmail } from '@/lib/ai-permissions';
import { getAgent, type LifecycleStage } from '@/lib/agent-runtime';
import { promoteAgent, quarantineAgent, releaseAgent, getAgentState } from '@/lib/agent-state';
import { withErrorBoundary } from '@/lib/api-error-boundary';

interface RouteCtx {
  params: Promise<{ agentId: string }>;
}

const STAGES: LifecycleStage[] = [
  'draft',
  'sandbox',
  'shadow',
  'probation',
  'active',
  'deprecated',
  'retired',
];

export const GET = withErrorBoundary(async (_request: NextRequest, ctx?: unknown) => {
  const routeCtx = ctx as RouteCtx;
  const session = await getSessionFromRequest();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  const { agentId } = await routeCtx.params;
  const agent = getAgent(agentId);
  if (!agent) return NextResponse.json({ error: 'Agente não existe' }, { status: 404 });
  const state = getAgentState(agentId);
  return NextResponse.json({ agent, state });
});

/**
 * PATCH /api/agents/:agentId
 * Body: { action: 'promote' | 'quarantine' | 'release', stage?, reason? }
 *
 * All operations are admin-gated. Even though promotions are pivotal, we
 * never let an agent promote itself — promoteAgent() blocks that internally.
 */
export const PATCH = withErrorBoundary(async (request: NextRequest, ctx?: unknown) => {
  const routeCtx = ctx as RouteCtx;
  const session = await getSessionFromRequest();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!isAiAdminEmail(session.email) && session.professionalRole !== 'admin_system') {
    return NextResponse.json({ error: 'Apenas admin pode operar agentes' }, { status: 403 });
  }
  const { agentId } = await routeCtx.params;
  if (!getAgent(agentId)) {
    return NextResponse.json({ error: 'Agente não existe' }, { status: 404 });
  }

  let body: { action?: string; stage?: string; reason?: string };
  try {
    body = (await request.json()) as { action?: string; stage?: string; reason?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const actor = session.email || session.userId;

  if (body.action === 'promote') {
    if (!body.stage || !STAGES.includes(body.stage as LifecycleStage)) {
      return NextResponse.json({ error: 'stage inválido' }, { status: 400 });
    }
    const result = promoteAgent(agentId, body.stage as LifecycleStage, actor);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, state: result.state });
  }

  if (body.action === 'quarantine') {
    const result = quarantineAgent(agentId, body.reason ?? 'manual', actor);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true, state: result.state });
  }

  if (body.action === 'release') {
    const result = releaseAgent(agentId, actor);
    if (!result.ok) return NextResponse.json({ error: 'falha ao liberar' }, { status: 400 });
    return NextResponse.json({ ok: true, state: result.state });
  }

  return NextResponse.json({ error: 'action desconhecida' }, { status: 400 });
});
