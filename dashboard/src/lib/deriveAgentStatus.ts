import type {
  AgentStatus,
  SquadState,
  DelegationEntry,
  CoordinationHandoffEntry,
} from "@/types/state";

export interface DerivedStatus {
  agentId: string;
  status: AgentStatus;
  currentTask?: string;
  source: "opensquad" | "delegation" | "coordination";
  squadCode?: string;
  sinceIso?: string;
  origin?: "ledger" | "coordination";
}

export function resolveActiveAgentId(
  squadCode: string,
  localAgentId: string,
  knownAgentIds: Set<string>,
): string {
  const compositeId = `${squadCode}/${localAgentId}`;
  if (!knownAgentIds.has(compositeId) && knownAgentIds.has(localAgentId)) {
    return localAgentId;
  }
  return compositeId;
}

/**
 * Consolida status de TODOS os agents (engenharia + opensquad) a partir das duas
 * fontes de verdade: activeStates (state.json dos squads) e delegations (ledger).
 *
 * Engineering agents não têm state.json — deriva do ledger:
 *   - delegation in-progress cujo "to" é o agent → status = working
 *   - delegation pending cujo "to" é o agent → status = checkpoint (aguardando)
 *   - ausência de delegação ativa → status = idle
 *
 * Opensquad agents derivam do state.json do squad (prioridade sobre ledger).
 */
export function deriveAgentStatuses(
  activeStates: Map<string, SquadState>,
  delegations: DelegationEntry[],
  knownAgentIds: Set<string> = new Set(),
  handoffs: CoordinationHandoffEntry[] = [],
): Map<string, DerivedStatus> {
  const out = new Map<string, DerivedStatus>();

  // 1. Opensquad agents (prioridade)
  for (const [squadCode, state] of activeStates) {
    for (const a of state.agents) {
      if (a.status === "idle") continue;
      const id = resolveActiveAgentId(squadCode, a.id, knownAgentIds);
      out.set(id, {
        agentId: id,
        status: a.status,
        currentTask: state.step.label || undefined,
        source: "opensquad",
        squadCode,
        sinceIso: state.startedAt ?? undefined,
      });
    }
  }

  // 2. Engineering agents via ledger
  // Para cada agent "to", pega a delegação mais recente
  const latestByAgent = new Map<string, DelegationEntry>();
  for (const d of delegations) {
    const existing = latestByAgent.get(d.to);
    if (!existing || d.ts > existing.ts) {
      latestByAgent.set(d.to, d);
    }
  }

  for (const [agentId, d] of latestByAgent) {
    if (out.has(agentId)) continue; // opensquad já definiu
    const source = d.origin === "coordination" ? "coordination" : "delegation";
    if (d.status === "in-progress") {
      out.set(agentId, {
        agentId,
        status: "working",
        currentTask: d.task,
        source,
        sinceIso: d.ts,
        origin: d.origin,
      });
    } else if (d.status === "pending") {
      out.set(agentId, {
        agentId,
        status: "checkpoint",
        currentTask: d.task,
        source,
        sinceIso: d.ts,
        origin: d.origin,
      });
    } else if (d.status === "blocked") {
      out.set(agentId, {
        agentId,
        status: "checkpoint",
        currentTask: `BLOQUEADO: ${d.task}`,
        source,
        sinceIso: d.ts,
        origin: d.origin,
      });
    }
  }

  // 3. Handoffs contextuais ainda não materializados no ledger.
  const latestBySelectedAgent = new Map<string, CoordinationHandoffEntry>();
  for (const handoff of handoffs) {
    const selectedAgentId =
      handoff.selectedAgentId ?? handoff.toAgent ?? handoff.coordinatorAgentId ?? null;
    if (!selectedAgentId) continue;
    if (
      handoff.status === "completed" ||
      handoff.status === "rejected" ||
      handoff.status === "unrouted"
    ) {
      continue;
    }
    const existing = latestBySelectedAgent.get(selectedAgentId);
    if (!existing || handoff.createdAt > existing.createdAt) {
      latestBySelectedAgent.set(selectedAgentId, handoff);
    }
  }

  for (const [agentId, handoff] of latestBySelectedAgent) {
    if (out.has(agentId)) continue;
    const actionType =
      handoff.requestedAction ?? handoff.routing?.actionType ?? "validation";
    const status =
      handoff.status === "in-progress" ? "working" : "checkpoint";
    out.set(agentId, {
      agentId,
      status,
      currentTask:
        handoff.status === "blocked"
          ? `BLOQUEADO: [${actionType}] ${handoff.reason}`
          : `[${actionType}] ${handoff.reason}`,
      source: "coordination",
      sinceIso: handoff.createdAt,
      origin: "coordination",
    });
  }

  return out;
}
