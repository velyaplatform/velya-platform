import { useMemo } from "react";
import type { Office, EngineeringAgent } from "@/types/company";
import type { AgentStatus, SquadState } from "@/types/state";
import { AgentCharacter } from "./AgentCharacter";
import { personaForAgent } from "@/lib/agentPersona";
import { useSquadStore } from "@/store/useSquadStore";
import { deriveAgentStatuses } from "@/lib/deriveAgentStatus";

interface OfficeSectionProps {
  office: Office;
  liveStates: Map<string, SquadState>;
}

const HIERARCHY_BADGE: Record<
  Office["hierarchy"],
  { label: string; color: string; floorColor: string }
> = {
  executive: { label: "Executivo", color: "#eab308", floorColor: "#2e2508" },
  council: { label: "Conselho", color: "#f59e0b", floorColor: "#2a1f0c" },
  office: { label: "Escritório", color: "#3b82f6", floorColor: "#11192a" },
  "squad-ala": { label: "Ala Operacional", color: "#22c55e", floorColor: "#0c2415" },
};

const PRODUCT_BADGE: Record<Office["product"], { label: string; color: string; short: string }> = {
  hospitalar: { label: "Velya Hospitalar", color: "#0ea5e9", short: "HOSP" },
  lince: { label: "Lince SOC", color: "#ef4444", short: "LINCE" },
  shared: { label: "Compartilhado", color: "#64748b", short: "SHARED" },
};

function pickLiveStatus(
  agentId: string,
  source: EngineeringAgent["source"],
  liveStates: Map<string, SquadState>,
  derivedStatuses: Map<string, { status: AgentStatus }>,
): AgentStatus | undefined {
  if (source === "opensquad") {
    const [squadCode, localId] = agentId.split("/");
    if (!squadCode || !localId) return undefined;
    const state = liveStates.get(squadCode);
    if (!state) return undefined;
    const found = state.agents.find((a) => a.id === localId);
    return found?.status;
  }
  // Engineering / executive: status vem do ledger de delegações.
  return derivedStatuses.get(agentId)?.status;
}

function matchesSearch(agent: EngineeringAgent, term: string): boolean {
  if (!term) return true;
  const persona = personaForAgent(agent.id, {
    displayName: agent.displayName,
    role: agent.role,
    descriptionPtBr: agent.descriptionPtBr,
    gender: agent.gender,
    leadership: agent.leadership ?? null,
  });
  const lower = term.toLowerCase();
  return (
    `${persona.firstName} ${persona.lastName}`.toLowerCase().includes(lower) ||
    persona.role.toLowerCase().includes(lower) ||
    agent.id.toLowerCase().includes(lower) ||
    (agent.description ?? "").toLowerCase().includes(lower)
  );
}

export function OfficeSection({ office, liveStates }: OfficeSectionProps) {
  const searchTerm = useSquadStore((s) => s.searchTerm);
  const delegations = useSquadStore((s) => s.delegations);
  const handoffs = useSquadStore((s) => s.handoffs);
  const badge = HIERARCHY_BADGE[office.hierarchy];
  const productBadge = PRODUCT_BADGE[office.product];

  const knownAgentIds = useMemo(
    () => new Set(office.agents.map((agent) => agent.id)),
    [office.agents],
  );
  const derivedStatuses = useMemo(
    () => deriveAgentStatuses(liveStates, delegations, knownAgentIds, handoffs),
    [liveStates, delegations, knownAgentIds, handoffs],
  );

  const filteredAgents = useMemo(
    () => office.agents.filter((a) => matchesSearch(a, searchTerm)),
    [office.agents, searchTerm],
  );

  const hasActive = useMemo(() => {
    for (const agent of office.agents) {
      const st = pickLiveStatus(agent.id, agent.source, liveStates, derivedStatuses);
      if (st && st !== "idle") return true;
    }
    return false;
  }, [office.agents, liveStates, derivedStatuses]);

  if (searchTerm && filteredAgents.length === 0) return null;

  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        borderRadius: 10,
        background: badge.floorColor,
        border: `1px solid ${hasActive ? badge.color : badge.color + "44"}`,
        boxShadow: hasActive ? `0 0 18px ${badge.color}44` : "none",
        transition: "border-color 200ms, box-shadow 200ms",
        backgroundImage: `repeating-linear-gradient(
          45deg,
          transparent 0 12px,
          ${badge.color}06 12px 14px
        )`,
        borderLeft: `4px solid ${productBadge.color}`,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          paddingBottom: 8,
          borderBottom: `1px solid ${badge.color}33`,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.8,
            padding: "2px 6px",
            borderRadius: 3,
            background: `${productBadge.color}28`,
            color: productBadge.color,
            textTransform: "uppercase",
          }}
          title={productBadge.label}
        >
          {productBadge.short}
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.8,
            padding: "2px 8px",
            borderRadius: 4,
            background: `${badge.color}22`,
            color: badge.color,
            textTransform: "uppercase",
          }}
        >
          {badge.label}
        </span>
        <h2
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 600,
            color: "var(--fg, #e5e5ea)",
          }}
        >
          {office.name}
        </h2>
        {hasActive && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 10,
              fontWeight: 700,
              color: badge.color,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: badge.color,
                boxShadow: `0 0 6px ${badge.color}`,
                animation: "pulse 1.4s infinite",
              }}
            />
            em atividade
          </span>
        )}
        <span
          style={{
            fontSize: 11,
            color: "var(--fg-dim, #8a8a92)",
            marginLeft: "auto",
          }}
        >
          {searchTerm ? `${filteredAgents.length}/${office.agents.length}` : office.agents.length}
        </span>
      </header>
      {filteredAgents.length === 0 ? (
        <div
          style={{
            padding: "12px 8px",
            textAlign: "center",
            fontSize: 11,
            color: "var(--fg-dim, #8a8a92)",
            fontStyle: "italic",
          }}
        >
          sem funcionários alocados
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            padding: "4px 0",
          }}
        >
          {filteredAgents.map((agent) => (
            <AgentCharacter
              key={agent.id}
              agent={agent}
              liveStatus={pickLiveStatus(agent.id, agent.source, liveStates, derivedStatuses)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
