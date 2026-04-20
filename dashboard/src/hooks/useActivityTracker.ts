import { useEffect } from "react";
import { useSquadStore, type ActivityEvent } from "@/store/useSquadStore";
import type { SquadState, CoordinationHandoffEntry } from "@/types/state";
import { personaForAgent } from "@/lib/agentPersona";
import { deriveAgentStatuses, resolveActiveAgentId } from "@/lib/deriveAgentStatus";
import type { EngineeringAgent } from "@/types/company";

function personaNameForAgent(
  agentId: string,
  agentLookup: Map<string, EngineeringAgent>,
): string {
  const agent = agentLookup.get(agentId);
  const persona = personaForAgent(agentId, agent
    ? {
        displayName: agent.displayName,
        role: agent.role,
        descriptionPtBr: agent.descriptionPtBr,
        gender: agent.gender,
        leadership: agent.leadership ?? null,
      }
    : undefined);
  return `${persona.firstName} ${persona.lastName}`;
}

function findAgentName(
  squadCode: string,
  state: SquadState,
  agentId: string,
  knownAgentIds: Set<string>,
  agentLookup: Map<string, EngineeringAgent>,
): string {
  const a = state.agents.find((ag) => ag.id === agentId);
  const resolvedAgentId = resolveActiveAgentId(squadCode, agentId, knownAgentIds);
  if (!a) return resolvedAgentId;
  return personaNameForAgent(resolvedAgentId, agentLookup);
}

function diffEvents(
  squadCode: string,
  squadName: string,
  prev: SquadState | undefined,
  next: SquadState,
  knownAgentIds: Set<string>,
  agentLookup: Map<string, EngineeringAgent>,
): ActivityEvent[] {
  const out: ActivityEvent[] = [];
  const now = new Date().toISOString();

  // Squad-level transitions
  if (prev?.status !== next.status) {
    if (next.status === "running" && prev?.status !== "running") {
      out.push({
        id: `${squadCode}-squad-start-${next.startedAt ?? next.updatedAt ?? now}`,
        timestamp: now,
        squadCode,
        squadName,
        agentId: "",
        agentName: "",
        kind: "squad-start",
        message: `Ala ${squadName} iniciou execução`,
      });
    }
    if (next.status === "completed") {
      out.push({
        id: `${squadCode}-squad-complete-${next.updatedAt}`,
        timestamp: now,
        squadCode,
        squadName,
        agentId: "",
        agentName: "",
        kind: "squad-complete",
        message: `Ala ${squadName} concluiu pipeline`,
      });
    }
    if (next.status === "checkpoint") {
      out.push({
        id: `${squadCode}-squad-checkpoint-${next.updatedAt}`,
        timestamp: now,
        squadCode,
        squadName,
        agentId: "",
        agentName: "",
        kind: "checkpoint",
        message: `Ala ${squadName} aguardando checkpoint humano`,
      });
    }
  }

  // Agent status transitions
  for (const agent of next.agents) {
    const prevAgent = prev?.agents.find((a) => a.id === agent.id);
    if (!prevAgent || prevAgent.status === agent.status) continue;
    const resolvedAgentId = resolveActiveAgentId(squadCode, agent.id, knownAgentIds);
    const name = findAgentName(squadCode, next, agent.id, knownAgentIds, agentLookup);
    if (agent.status === "working") {
      out.push({
        id: `${squadCode}-${resolvedAgentId}-work-${next.updatedAt}`,
        timestamp: now,
        squadCode,
        squadName,
        agentId: resolvedAgentId,
        agentName: name,
        kind: "agent-working",
        message: `${name} começou a trabalhar`,
      });
    } else if (agent.status === "done") {
      out.push({
        id: `${squadCode}-${resolvedAgentId}-done-${next.updatedAt}`,
        timestamp: now,
        squadCode,
        squadName,
        agentId: resolvedAgentId,
        agentName: name,
        kind: "agent-done",
        message: `${name} concluiu sua parte`,
      });
    }
  }

  // Handoff
  if (
    next.handoff &&
    (!prev?.handoff || prev.handoff.completedAt !== next.handoff.completedAt)
  ) {
    const toAgentId = resolveActiveAgentId(squadCode, next.handoff.to, knownAgentIds);
    const fromName = findAgentName(
      squadCode,
      next,
      next.handoff.from,
      knownAgentIds,
      agentLookup,
    );
    const toName = findAgentName(
      squadCode,
      next,
      next.handoff.to,
      knownAgentIds,
      agentLookup,
    );
    out.push({
      id: `${squadCode}-handoff-${next.handoff.completedAt}-${toAgentId}`,
      timestamp: now,
      squadCode,
      squadName,
      agentId: toAgentId,
      agentName: toName,
      kind: "handoff",
      message: `${fromName} → ${toName}: ${next.handoff.message}`,
    });
  }

  return out;
}

function diffDerivedStatusEvents(
  prevState: ReturnType<typeof useSquadStore.getState>,
  nextState: ReturnType<typeof useSquadStore.getState>,
): ActivityEvent[] {
  if (!nextState.company) return [];

  const agentLookup = new Map(
    nextState.company.offices.flatMap((office) =>
      office.agents.map((agent) => [agent.id, agent] as const),
    ),
  );
  const knownAgentIds = new Set(
    nextState.company.offices.flatMap((office) => office.agents.map((agent) => agent.id)),
  );
  const previous = deriveAgentStatuses(
    prevState.activeStates,
    prevState.delegations,
    knownAgentIds,
    prevState.handoffs,
  );
  const current = deriveAgentStatuses(
    nextState.activeStates,
    nextState.delegations,
    knownAgentIds,
    nextState.handoffs,
  );
  const events: ActivityEvent[] = [];
  const now = new Date().toISOString();

  for (const [agentId, nextStatus] of current) {
    const prevStatus = previous.get(agentId);
    if (
      prevStatus?.status === nextStatus.status &&
      prevStatus?.currentTask === nextStatus.currentTask &&
      prevStatus?.source === nextStatus.source
    ) {
      continue;
    }

    if (
      nextStatus.source === "coordination" &&
      nextStatus.status === "working" &&
      !prevStatus
    ) {
      continue;
    }

    const agentName = personaNameForAgent(agentId, agentLookup);
    const squadName = nextStatus.squadCode ?? "Empresa";

    if (nextStatus.status === "working") {
      events.push({
        id: `${agentId}-${nextStatus.sinceIso ?? now}-working`,
        timestamp: nextStatus.sinceIso ?? now,
        squadCode: nextStatus.squadCode ?? "company",
        squadName,
        agentId,
        agentName,
        kind: "agent-working",
        message:
          nextStatus.source === "coordination"
            ? `${agentName} reportou heartbeat de coordenação`
            : `${agentName} começou a trabalhar`,
      });
    } else if (nextStatus.status === "checkpoint") {
      events.push({
        id: `${agentId}-${nextStatus.sinceIso ?? now}-checkpoint`,
        timestamp: nextStatus.sinceIso ?? now,
        squadCode: nextStatus.squadCode ?? "company",
        squadName,
        agentId,
        agentName,
        kind: "checkpoint",
        message:
          nextStatus.source === "coordination"
            ? `${agentName} requer atenção da coordenação`
            : `${agentName} está aguardando próximo passo`,
      });
    }
  }

  return events;
}

function actionLabel(
  handoff: CoordinationHandoffEntry,
): string {
  switch (handoff.requestedAction ?? handoff.routing?.actionType) {
    case "testing":
      return "teste";
    case "monitoring":
      return "monitoria";
    case "correction":
      return "correção";
    case "improvement":
      return "melhoria";
    default:
      return "validação";
  }
}

function productLabel(handoff: CoordinationHandoffEntry): string {
  switch (handoff.productContext) {
    case "hospitalar":
      return "Velya Hospitalar";
    case "lince":
      return "Lince SOC";
    default:
      return "Empresa";
  }
}

function diffCoordinationHandoffEvents(
  prevHandoffs: CoordinationHandoffEntry[],
  nextHandoffs: CoordinationHandoffEntry[],
  agentLookup: Map<string, EngineeringAgent>,
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const previousById = new Map(prevHandoffs.map((handoff) => [handoff.handoffId, handoff]));

  for (const handoff of nextHandoffs) {
    const previous = previousById.get(handoff.handoffId);
    const fromName = personaNameForAgent(handoff.fromAgent, agentLookup);
    const selectedAgentId =
      handoff.selectedAgentId ?? handoff.toAgent ?? handoff.coordinatorAgentId ?? "";
    const selectedName = selectedAgentId
      ? personaNameForAgent(selectedAgentId, agentLookup)
      : "coordenação";
    const targetName = handoff.target.name !== "unknown"
      ? `${handoff.target.kind}:${handoff.target.name}`
      : handoff.reason;
    const baseEvent = {
      timestamp: handoff.createdAt,
      squadCode: handoff.productContext ?? "company",
      squadName: productLabel(handoff),
      agentId: selectedAgentId,
      agentName: selectedName,
      kind: "handoff" as const,
    };

    if (!previous) {
      events.push({
        id: `${handoff.handoffId}-${handoff.status}-opened`,
        ...baseEvent,
        message:
          handoff.routing?.decision === "coordinated"
            ? `${fromName} acionou coordenação contextual para ${actionLabel(handoff)} em ${targetName}`
            : `${fromName} trigou ${selectedName} para ${actionLabel(handoff)} em ${targetName}`,
      });
      continue;
    }

    if (previous.status === handoff.status) continue;

    let message = `${selectedName} atualizou o handoff ${targetName}`;
    if (handoff.status === "in-progress") {
      message = `${selectedName} assumiu ${actionLabel(handoff)} de ${targetName}`;
    } else if (handoff.status === "completed") {
      message = `${selectedName} concluiu ${actionLabel(handoff)} de ${targetName}`;
    } else if (handoff.status === "blocked") {
      message = `${selectedName} bloqueou ${actionLabel(handoff)} de ${targetName}`;
    } else if (handoff.status === "awaiting-coordinator") {
      message = `Coordenação contextual em fila para ${targetName}`;
    }

    events.push({
      id: `${handoff.handoffId}-${handoff.status}-status`,
      ...baseEvent,
      message,
    });
  }

  return events;
}

export function useActivityTracker() {
  const pushActivity = useSquadStore((s) => s.pushActivity);

  useEffect(() => {
    return useSquadStore.subscribe((state, prevState) => {
      // Ignore store updates that only touch UI state such as activityLog.
      if (
        state.activeStates === prevState.activeStates &&
        state.delegations === prevState.delegations &&
        state.handoffs === prevState.handoffs &&
        state.company === prevState.company
      ) {
        return;
      }

      const knownAgentIds = new Set(
        state.company?.offices.flatMap((office) => office.agents.map((agent) => agent.id)) ?? [],
      );
      const agentLookup = new Map(
        state.company?.offices.flatMap((office) =>
          office.agents.map((agent) => [agent.id, agent] as const),
        ) ?? [],
      );

      for (const [code, nextState] of state.activeStates) {
        const prev = prevState.activeStates.get(code);
        const squadInfo = state.squads.get(code);
        const squadName = squadInfo?.name ?? code;
        const events = diffEvents(
          code,
          squadName,
          prev,
          nextState,
          knownAgentIds,
          agentLookup,
        );
        for (const ev of events) {
          pushActivity(ev);
        }
      }

      for (const event of diffDerivedStatusEvents(prevState, state)) {
        pushActivity(event);
      }

      for (const event of diffCoordinationHandoffEvents(
        prevState.handoffs,
        state.handoffs,
        agentLookup,
      )) {
        pushActivity(event);
      }
    });
  }, [pushActivity]);
}
