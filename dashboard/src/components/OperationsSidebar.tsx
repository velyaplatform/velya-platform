import { useEffect, useMemo, useState } from "react";
import { fullName, personaForAgent } from "@/lib/agentPersona";
import {
  agentStatusColor,
  isActiveDelegation,
  productColor,
  productLabel,
  relativeTime,
} from "@/lib/dashboardModel";
import { useDashboardModel } from "@/hooks/useDashboardModel";
import { useSquadStore } from "@/store/useSquadStore";

type SidebarTab = "ledger" | "activity";

function agentDisplayName(
  id: string,
  company: ReturnType<typeof useSquadStore.getState>["company"],
): string {
  if (id === "user") return "Usuário";
  if (id === "ceo") return "João Lucas Lima Freire";
  const currentAgent = company?.offices
    .flatMap((office) => office.agents)
    .find((agent) => agent.id === id);
  return fullName(
    personaForAgent(id, {
      displayName: currentAgent?.displayName,
      role: currentAgent?.role,
      descriptionPtBr: currentAgent?.descriptionPtBr,
      gender: currentAgent?.gender,
      leadership: currentAgent?.leadership ?? null,
    }),
  );
}

export function OperationsSidebar() {
  const { delegations, activityLog } = useDashboardModel();
  const company = useSquadStore((state) => state.company);
  const selectAgent = useSquadStore((state) => state.selectAgent);
  const [tab, setTab] = useState<SidebarTab>("ledger");
  const [collapsed, setCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1200 : false,
  );

  useEffect(() => {
    const onResize = () => {
      setCollapsed(window.innerWidth < 1200);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const activeDelegations = useMemo(
    () => delegations.filter((entry) => isActiveDelegation(entry)),
    [delegations],
  );
  const ledgerCount = activeDelegations.length;
  const activityCount = activityLog.length;

  if (collapsed) {
    return (
      <aside className="operations-sidebar operations-sidebar--collapsed">
        <button
          type="button"
          className={tab === "ledger" ? "sidebar-rail__button sidebar-rail__button--active" : "sidebar-rail__button"}
          onClick={() => {
            setTab("ledger");
            setCollapsed(false);
          }}
        >
          📋
          <span>{ledgerCount}</span>
        </button>
        <button
          type="button"
          className={tab === "activity" ? "sidebar-rail__button sidebar-rail__button--active" : "sidebar-rail__button"}
          onClick={() => {
            setTab("activity");
            setCollapsed(false);
          }}
        >
          📡
          <span>{activityCount}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside className="operations-sidebar">
      <header className="operations-sidebar__header">
        <div className="operations-sidebar__tabs">
          <button
            type="button"
            className={tab === "ledger" ? "operations-sidebar__tab operations-sidebar__tab--active" : "operations-sidebar__tab"}
            onClick={() => setTab("ledger")}
          >
            📋 Ledger <span>{ledgerCount}</span>
          </button>
          <button
            type="button"
            className={tab === "activity" ? "operations-sidebar__tab operations-sidebar__tab--active" : "operations-sidebar__tab"}
            onClick={() => setTab("activity")}
          >
            📡 Atividade <span>{activityCount}</span>
          </button>
        </div>
        <button
          type="button"
          className="dashboard-button dashboard-button--icon"
          onClick={() => setCollapsed(true)}
          aria-label="Recolher sidebar"
        >
          →
        </button>
      </header>

      <div className="operations-sidebar__body">
        {tab === "ledger" ? (
          activeDelegations.length === 0 ? (
            <div className="dashboard-empty">Nenhuma delegação ativa.</div>
          ) : (
            activeDelegations.map((entry) => {
              const target = company?.offices
                .flatMap((office) => office.agents)
                .find((agent) => agent.id === entry.to)?.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className="sidebar-card"
                  onClick={() => target && selectAgent(target)}
                >
                  <div className="sidebar-card__topline">
                    <span
                      className="agents-badge"
                      style={{
                        color:
                          entry.status === "blocked"
                            ? "#ef4444"
                            : entry.status === "in-progress"
                              ? "#22c55e"
                              : "#f59e0b",
                        background:
                          entry.status === "blocked"
                            ? "#ef444416"
                            : entry.status === "in-progress"
                              ? "#22c55e16"
                              : "#f59e0b16",
                        borderColor:
                          entry.status === "blocked"
                            ? "#ef444433"
                            : entry.status === "in-progress"
                              ? "#22c55e33"
                              : "#f59e0b33",
                      }}
                    >
                      {entry.status}
                    </span>
                    <span>{relativeTime(entry.ts)}</span>
                  </div>
                  <div className="sidebar-card__title">{entry.task}</div>
                  <div className="sidebar-card__subcopy">
                    {agentDisplayName(entry.from, company)} →{" "}
                    {agentDisplayName(entry.to, company)}
                  </div>
                  {entry.context && (
                    <div className="sidebar-card__context" title={entry.context}>
                      {entry.context}
                    </div>
                  )}
                </button>
              );
            })
          )
        ) : activityLog.length === 0 ? (
          <div className="dashboard-empty">Sem atividade registrada.</div>
        ) : (
          activityLog.map((event) => {
            const color =
              event.kind === "agent-working"
                ? "#22c55e"
                : event.kind === "checkpoint"
                  ? "#f59e0b"
                  : event.kind === "agent-done" || event.kind === "squad-complete"
                    ? "#8b5cf6"
                    : "#38bdf8";
            const selectedAgent = event.agentId || null;

            return (
              <button
                key={event.id}
                type="button"
                className="sidebar-card"
                onClick={() => selectedAgent && selectAgent(selectedAgent)}
              >
                <div className="sidebar-card__topline">
                  <span
                    className="sidebar-card__dot"
                    style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                  />
                  <span>{event.squadName}</span>
                  <span>{relativeTime(event.timestamp)}</span>
                </div>
                <div className="sidebar-card__title">{event.message}</div>
                {event.agentId && (
                  <div
                    className="sidebar-card__subcopy"
                    style={{ color: agentStatusColor("working") }}
                  >
                    {event.agentName}
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>

      <footer className="operations-sidebar__footer">
        <span
          className="agents-badge"
          style={{
            color: productColor("shared"),
            background: `${productColor("shared")}16`,
            borderColor: `${productColor("shared")}33`,
          }}
        >
          {productLabel("shared")}
        </span>
        <span>Painel lateral colapsável</span>
      </footer>
    </aside>
  );
}
