import { useEffect, useState } from "react";
import { useSquadStore } from "@/store/useSquadStore";

function relativeTime(iso?: string | null, now = Date.now()): string {
  if (!iso) return "sem dados";
  const diff = now - new Date(iso).getTime();
  if (diff < 10_000) return "agora";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export function OperationsPulsePanel() {
  const syncInfo = useSquadStore((s) => s.syncInfo);
  const isConnected = useSquadStore((s) => s.isConnected);
  const connectionMode = useSquadStore((s) => s.connectionMode);
  const handoffs = useSquadStore((s) => s.handoffs);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  if (!syncInfo) return null;

  const transportColor = !isConnected
    ? "#ef4444"
    : connectionMode === "polling"
      ? "#f59e0b"
      : "#22c55e";
  const staleCount = syncInfo.coordination.staleAgents.length;
  const activeHandoffs = handoffs.filter((handoff) =>
    handoff.status === "pending" ||
    handoff.status === "in-progress" ||
    handoff.status === "blocked" ||
    handoff.status === "awaiting-coordinator",
  ).length;
  const coordinatedHandoffs = handoffs.filter(
    (handoff) => handoff.routing?.decision === "coordinated",
  ).length;
  const directHandoffs = handoffs.filter(
    (handoff) => handoff.routing?.decision === "direct",
  ).length;
  const unroutedHandoffs = handoffs.filter((handoff) => handoff.status === "unrouted").length;

  const cards = [
    {
      title: "Transporte",
      value: isConnected ? connectionMode : "offline",
      detail: `snapshot ${relativeTime(syncInfo.snapshotGeneratedAt, now)}`,
      accent: transportColor,
    },
    {
      title: "Coordenação",
      value: syncInfo.coordination.available
        ? `${syncInfo.coordination.totalAgents} agents`
        : "sem snapshot",
      detail: syncInfo.coordination.available
        ? `${syncInfo.coordination.reportingAgents} com heartbeat · ${staleCount} stale · ${relativeTime(syncInfo.coordination.generatedAt, now)}`
        : "nenhum snapshot encontrado",
      accent: staleCount > 0 ? "#ef4444" : "#3b82f6",
      titleHint: syncInfo.coordination.filePath ?? undefined,
    },
    {
      title: "Delegações",
      value: `${syncInfo.ledger.active} ativas`,
      detail: `${syncInfo.ledger.inProgress} em execução · ${syncInfo.ledger.blocked} bloqueadas · ${relativeTime(syncInfo.ledger.updatedAt, now)}`,
      accent: syncInfo.ledger.blocked > 0 ? "#ef4444" : "#22c55e",
    },
    {
      title: "Triggers",
      value: `${activeHandoffs} contextuais`,
      detail: `${coordinatedHandoffs} coordenados · ${directHandoffs} diretos${unroutedHandoffs > 0 ? ` · ${unroutedHandoffs} sem rota` : ""}`,
      accent: unroutedHandoffs > 0 ? "#ef4444" : activeHandoffs > 0 ? "#3b82f6" : "#64748b",
    },
    {
      title: "Alas",
      value: `${syncInfo.activeSquads.running} rodando`,
      detail: `${syncInfo.activeSquads.checkpoint} checkpoint · ${syncInfo.activeSquads.completed} concluídas · ${relativeTime(syncInfo.activeSquads.updatedAt, now)}`,
      accent: syncInfo.activeSquads.running > 0 ? "#22c55e" : "#64748b",
    },
  ];

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 10,
        marginBottom: 16,
      }}
    >
      {cards.map((card) => (
        <article
          key={card.title}
          title={card.titleHint}
          style={{
            borderRadius: 10,
            padding: "12px 14px",
            background: "var(--bg-panel, #141418)",
            border: `1px solid ${card.accent}33`,
            boxShadow: `0 0 18px ${card.accent}11`,
            minHeight: 84,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.7,
              textTransform: "uppercase",
              color: card.accent,
              marginBottom: 8,
            }}
          >
            {card.title}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--fg, #e5e5ea)",
              marginBottom: 4,
            }}
          >
            {card.value}
          </div>
          <div
            style={{
              fontSize: 11,
              lineHeight: 1.4,
              color: "var(--fg-dim, #8a8a92)",
            }}
          >
            {card.detail}
          </div>
        </article>
      ))}
    </section>
  );
}
