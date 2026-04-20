import { useState, useMemo } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import { personaForAgent, fullName } from "@/lib/agentPersona";
import type { DelegationEntry } from "@/types/state";

const STATUS_COLOR: Record<DelegationEntry["status"], string> = {
  pending: "#f59e0b",
  "in-progress": "#22c55e",
  completed: "#8b5cf6",
  blocked: "#ef4444",
  rejected: "#6b7280",
};

const STATUS_LABEL: Record<DelegationEntry["status"], string> = {
  pending: "pendente",
  "in-progress": "em execução",
  completed: "concluído",
  blocked: "bloqueado",
  rejected: "rejeitado",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function originBadge(origin: DelegationEntry["origin"]) {
  if (origin === "coordination") {
    return { label: "coordenação", color: "#3b82f6" };
  }
  return { label: "ledger", color: "#64748b" };
}

function agentDisplayName(id: string, company: ReturnType<typeof useSquadStore.getState>["company"]): string {
  if (id === "ceo") return "João Lucas (CEO)";
  if (id === "user") return "Usuário";
  // tenta achar persona a partir do id direto
  for (const office of company?.offices ?? []) {
    const found = office.agents.find((a) => a.id === id || a.id.endsWith(`/${id}`));
    if (found) {
      const p = personaForAgent(found.id, {
        displayName: found.displayName,
        role: found.role,
        gender: found.gender,
        leadership: found.leadership ?? null,
      });
      return fullName(p);
    }
  }
  const p = personaForAgent(id);
  return fullName(p);
}

export function DelegationLedger() {
  const delegations = useSquadStore((s) => s.delegations);
  const company = useSquadStore((s) => s.company);
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "in-progress">("all");

  const visible = useMemo(() => {
    if (filter === "all") return delegations;
    return delegations.filter((d) => d.status === filter);
  }, [delegations, filter]);

  const pendingCount = delegations.filter((d) => d.status === "pending").length;
  const inProgressCount = delegations.filter((d) => d.status === "in-progress").length;

  return (
    <aside
      style={{
        position: "fixed",
        left: 16,
        bottom: 48,
        width: 380,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: open ? 400 : 36,
        background: "var(--bg-panel, #141418)",
        border: "1px solid var(--border, #2a2a30)",
        borderRadius: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 50,
        transition: "max-height 200ms ease-out",
      }}
    >
      <header
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          height: 36,
          background: "var(--bg-sidebar, #14141e)",
          borderBottom: open ? "1px solid var(--border, #2a2a30)" : "none",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ fontSize: 13 }}>📋</span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--fg, #e5e5ea)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            flex: 1,
          }}
        >
          Ledger de Delegações
        </span>
        {pendingCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#f59e0b",
              background: "#f59e0b22",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
          </span>
        )}
        {inProgressCount > 0 && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#22c55e",
              background: "#22c55e22",
              padding: "2px 6px",
              borderRadius: 4,
            }}
          >
            {inProgressCount} em curso
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            color: "var(--fg-dim, #8a8a92)",
            transform: open ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 180ms",
          }}
        >
          ›
        </span>
      </header>

      {open && (
        <>
          <div style={{ display: "flex", gap: 4, padding: "6px 10px", borderBottom: "1px solid var(--border, #2a2a30)" }}>
            {(["all", "pending", "in-progress"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilter(k);
                }}
                style={{
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 600,
                  background: filter === k ? "var(--bg-tile, #1a1a1f)" : "transparent",
                  color: filter === k ? "var(--fg, #e5e5ea)" : "var(--fg-dim, #8a8a92)",
                  border: "1px solid var(--border, #2a2a30)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {k === "all" ? "Todos" : k === "pending" ? "Pendentes" : "Em curso"}
              </button>
            ))}
          </div>
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "6px 0",
            }}
          >
            {visible.length === 0 && (
              <div
                style={{
                  padding: "16px 12px",
                  fontSize: 11,
                  color: "var(--fg-dim, #8a8a92)",
                  fontStyle: "italic",
                  textAlign: "center",
                }}
              >
                Nenhuma delegação registrada.
              </div>
            )}
            {visible.map((d) => (
              <div
                key={d.id}
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border, #2a2a30)33",
                  fontSize: 11,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: STATUS_COLOR[d.status],
                    }}
                  />
                  <span style={{ fontSize: 10, fontWeight: 700, color: STATUS_COLOR[d.status], textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {STATUS_LABEL[d.status]}
                  </span>
                  <span style={{ color: "var(--fg-dim, #8a8a92)", fontSize: 10, marginLeft: "auto" }}>
                    {relativeTime(d.ts)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: originBadge(d.origin).color,
                      background: `${originBadge(d.origin).color}22`,
                      padding: "1px 5px",
                      borderRadius: 3,
                      textTransform: "uppercase",
                      letterSpacing: 0.4,
                    }}
                  >
                    {originBadge(d.origin).label}
                  </span>
                  {d.blockReason && (
                    <span style={{ fontSize: 10, color: "#ef4444" }}>
                      {d.blockReason}
                    </span>
                  )}
                </div>
                <div style={{ color: "var(--fg, #e5e5ea)", lineHeight: 1.3, marginBottom: 4 }}>
                  {d.task}
                </div>
                <div style={{ color: "var(--fg-dim, #8a8a92)", fontSize: 10 }}>
                  {agentDisplayName(d.from, company)} → {agentDisplayName(d.to, company)}
                </div>
                {d.context && (
                  <div style={{ color: "var(--fg-dim, #8a8a92)", fontSize: 10, marginTop: 3, lineHeight: 1.3, fontStyle: "italic" }}>
                    {d.context.length > 120 ? d.context.slice(0, 117) + "…" : d.context}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
