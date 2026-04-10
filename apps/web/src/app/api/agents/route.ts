import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { AGENTS, buildTopology, OFFICE_LABELS, STAGE_LABELS } from '@/lib/agent-runtime';
import { listAgentStates } from '@/lib/agent-state';

/**
 * GET /api/agents
 *
 * Returns the static contract + live state for every agent in the platform.
 * Read-only — no auth required beyond an active session.
 */
export async function GET() {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const states = listAgentStates();
  const stateById = new Map(states.map((s) => [s.agentId, s]));
  return NextResponse.json({
    topology: buildTopology(),
    agents: AGENTS.map((a) => ({
      ...a,
      state: stateById.get(a.id),
    })),
    labels: { office: OFFICE_LABELS, stage: STAGE_LABELS },
  });
}
