import { useMemo } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import { personaForAgent, fullName } from "@/lib/agentPersona";
import { avatarFor, blinkFrame } from "@/lib/avatarFor";
import { deriveAgentStatuses } from "@/lib/deriveAgentStatus";
import type { EngineeringAgent } from "@/types/company";

export function WorkingNowPanel() {
  const activeStates = useSquadStore((s) => s.activeStates);
  const delegations = useSquadStore((s) => s.delegations);
  const handoffs = useSquadStore((s) => s.handoffs);
  const company = useSquadStore((s) => s.company);
  const selectAgent = useSquadStore((s) => s.selectAgent);

  const rows = useMemo(() => {
    if (!company) return [];
    const knownAgentIds = new Set(
      company.offices.flatMap((office) => office.agents.map((agent) => agent.id)),
    );
    const statuses = deriveAgentStatuses(
      activeStates,
      delegations,
      knownAgentIds,
      handoffs,
    );
    const byId = new Map<string, EngineeringAgent>();
    for (const o of company.offices) {
      for (const a of o.agents) byId.set(a.id, a);
    }

    const out: Array<{
      agent: EngineeringAgent;
      status: string;
      task?: string;
      since?: string;
      source: "opensquad" | "delegation" | "coordination";
    }> = [];

    for (const [id, s] of statuses) {
      if (s.status !== "working" && s.status !== "checkpoint") continue;
      const agent = byId.get(id);
      if (!agent) continue;
      out.push({
        agent,
        status: s.status,
        task: s.currentTask,
        since: s.sinceIso,
        source: s.source,
      });
    }

    // ordena: working primeiro, depois checkpoint, depois por timestamp decrescente
    out.sort((a, b) => {
      if (a.status !== b.status) return a.status === "working" ? -1 : 1;
      return (b.since ?? "").localeCompare(a.since ?? "");
    });

    return out;
  }, [activeStates, delegations, handoffs, company]);

  const workingCount = rows.filter((r) => r.status === "working").length;
  const waitingCount = rows.filter((r) => r.status === "checkpoint").length;

  if (rows.length === 0) {
    return (
      <section
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          marginBottom: 16,
          borderRadius: 10,
          background: "var(--bg-panel, #141418)",
          border: "1px dashed var(--border, #2a2a30)",
          fontSize: 12,
          color: "var(--fg-dim, #8a8a92)",
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#6b7280" }} />
        <span>Nenhum funcionário ativo no momento. Rode uma ala ou registre uma delegação.</span>
      </section>
    );
  }

  return (
    <section
      style={{
        marginBottom: 16,
        borderRadius: 10,
        background: "linear-gradient(180deg, #0d1a0d 0%, #141418 100%)",
        border: "1px solid #22c55e44",
        boxShadow: "0 0 22px #22c55e22",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          borderBottom: "1px solid var(--border, #2a2a30)",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 8px #22c55e",
            animation: "pulse 1.4s infinite",
          }}
        />
        <h2
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 700,
            color: "var(--fg, #e5e5ea)",
            letterSpacing: 0.3,
          }}
        >
          Trabalhando agora
        </h2>
        <span
          style={{
            fontSize: 11,
            color: "var(--fg-dim, #8a8a92)",
            marginLeft: "auto",
          }}
        >
          {workingCount > 0 && <span style={{ color: "#22c55e", fontWeight: 700 }}>{workingCount} em execução</span>}
          {workingCount > 0 && waitingCount > 0 && " · "}
          {waitingCount > 0 && <span style={{ color: "#f59e0b", fontWeight: 700 }}>{waitingCount} aguardando</span>}
        </span>
      </header>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {rows.map(({ agent, status, task, source }) => {
          const persona = personaForAgent(agent.id, {
            displayName: agent.displayName,
            role: agent.role,
            descriptionPtBr: agent.descriptionPtBr,
            gender: agent.gender,
            leadership: agent.leadership ?? null,
          });
          const displayName = fullName(persona);
          const character = avatarFor(agent.id, persona.gender);
          const color = status === "working" ? "#22c55e" : "#f59e0b";
          const statusLabel = status === "working" ? "TRABALHANDO" : "AGUARDANDO";

          return (
            <li
              key={agent.id}
              onClick={() => selectAgent(agent.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 14px",
                borderBottom: "1px solid var(--border, #2a2a30)33",
                cursor: "pointer",
                transition: "background 120ms",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-tile, #1a1a1f)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div
                style={{
                  position: "relative",
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                }}
              >
                <img
                  src={blinkFrame(character)}
                  alt={displayName}
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: "contain",
                    imageRendering: "pixelated",
                  }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: color,
                    border: "2px solid var(--bg-panel, #141418)",
                    boxShadow: status === "working" ? `0 0 6px ${color}` : "none",
                    animation: status === "working" ? "pulse 1.4s infinite" : "none",
                  }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color,
                      background: `${color}22`,
                      padding: "1px 5px",
                      borderRadius: 3,
                      letterSpacing: 0.5,
                    }}
                  >
                    {statusLabel}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--fg, #e5e5ea)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {displayName}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--fg-dim, #8a8a92)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    · {persona.role}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--fg-dim, #c0c0c5)",
                    lineHeight: 1.3,
                    marginTop: 2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={task}
                >
                  {task ?? "(tarefa não informada)"}
                </div>
              </div>
              <span
                style={{
                  fontSize: 9,
                  color: "var(--fg-dim, #8a8a92)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                  flexShrink: 0,
                }}
              >
                {source === "opensquad" ? "ala" : source === "coordination" ? "coordenação" : "delegação"}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
