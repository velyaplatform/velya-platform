import { useEffect, useState } from "react";
import { relativeTime } from "@/lib/dashboardModel";
import { useDashboardModel } from "@/hooks/useDashboardModel";
import { useSquadStore } from "@/store/useSquadStore";

function connectionLabel(
  connected: boolean,
  mode: "websocket" | "polling" | "offline",
): string {
  if (!connected || mode === "offline") return "desconectado";
  if (mode === "polling") return "polling";
  return "conectado";
}

export function StatusBar() {
  const isConnected = useSquadStore((state) => state.isConnected);
  const connectionMode = useSquadStore((state) => state.connectionMode);
  const syncInfo = useSquadStore((state) => state.syncInfo);
  const { metrics, activityLog } = useDashboardModel();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const staleAgents = syncInfo?.coordination.staleAgents.length ?? 0;
  const issues: string[] = [];
  if (!isConnected || connectionMode === "offline") issues.push("WS desconectado");
  if (staleAgents > 0) {
    issues.push(`${staleAgents} heartbeat${staleAgents > 1 ? "s" : ""} stale`);
  }

  const tone =
    issues.length > 0 ? "critical" : connectionMode === "polling" ? "warning" : "normal";
  const latestActivity = activityLog[0];
  const syncAgents = syncInfo?.coordination.reportingAgents ?? 0;

  return (
    <div className={`dashboard-status dashboard-status--${tone}`}>
      <div className="dashboard-status__items">
        <span className="dashboard-status__item">
          <strong>WS:</strong> {connectionLabel(isConnected, connectionMode)}
        </span>
        <span className="dashboard-status__item">
          <strong>Agents:</strong> {syncAgents} sync
        </span>
        <span className="dashboard-status__item">
          <strong>Delegações:</strong> {metrics.activeDelegations} ativas
        </span>
        <span className="dashboard-status__item">
          <strong>Triggers:</strong> {metrics.activeTriggers}
        </span>
        <span className="dashboard-status__item">
          <strong>Alas:</strong> {metrics.liveAlas} ao vivo
        </span>
        {issues.length > 0 && (
          <span className="dashboard-status__item dashboard-status__item--alert">
            <strong>Problema:</strong> {issues.join(" · ")}
          </span>
        )}
        {latestActivity && (
          <span className="dashboard-status__item dashboard-status__item--activity">
            <strong>Última atividade:</strong> {latestActivity.message} ·{" "}
            {relativeTime(latestActivity.timestamp, now)}
          </span>
        )}
      </div>
    </div>
  );
}
