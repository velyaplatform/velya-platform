import { useEffect } from "react";
import { AgentDetailPanel } from "@/components/AgentDetailPanel";
import { AgentsView } from "@/components/AgentsView";
import { ContextTriggerBanner } from "@/components/ContextTriggerBanner";
import { LiveAlasView } from "@/components/LiveAlasView";
import { Office2DView } from "@/components/Office2DView";
import { OperationsSidebar } from "@/components/OperationsSidebar";
import { StatusBar } from "@/components/StatusBar";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { useSquadSocket } from "@/hooks/useSquadSocket";
import { useSquadStore } from "@/store/useSquadStore";

export function App() {
  useSquadSocket();
  useActivityTracker();
  const viewMode = useSquadStore((state) => state.viewMode);
  const setViewMode = useSquadStore((state) => state.setViewMode);
  const selectedAgentId = useSquadStore((state) => state.selectedAgentId);
  const selectAgent = useSquadStore((state) => state.selectAgent);

  useEffect(() => {
    if (!selectedAgentId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") selectAgent(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedAgentId, selectAgent]);

  return (
    <div className="dashboard-app">
      <header className="dashboard-topbar">
        <div className="dashboard-topbar__brand">
          <span className="dashboard-topbar__logo">opensquad</span>
          <span className="dashboard-topbar__subtitle">
            Centro de Orquestração de Agentes IA
          </span>
        </div>
        <nav className="dashboard-topbar__nav">
          <button
            type="button"
            className={
              viewMode === "agents"
                ? "dashboard-nav__button dashboard-nav__button--active"
                : "dashboard-nav__button"
            }
            onClick={() => setViewMode("agents")}
          >
            Agentes
          </button>
          <button
            type="button"
            className={
              viewMode === "live-alas"
                ? "dashboard-nav__button dashboard-nav__button--active"
                : "dashboard-nav__button"
            }
            onClick={() => setViewMode("live-alas")}
          >
            Alas ao Vivo
          </button>
          <button
            type="button"
            className={
              viewMode === "office-2d"
                ? "dashboard-nav__button dashboard-nav__button--active"
                : "dashboard-nav__button"
            }
            onClick={() => setViewMode("office-2d")}
          >
            Escritório 2D
          </button>
        </nav>
      </header>

      <StatusBar />
      <ContextTriggerBanner />

      <div className="dashboard-workspace">
        <main className="dashboard-main">
          {viewMode === "agents" ? (
            <AgentsView />
          ) : viewMode === "live-alas" ? (
            <LiveAlasView />
          ) : (
            <Office2DView />
          )}
        </main>
        <OperationsSidebar />
      </div>

      {selectedAgentId && <AgentDetailPanel />}
    </div>
  );
}
