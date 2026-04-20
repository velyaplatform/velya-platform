import { useMemo } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import { personaForAgent, fullName } from "@/lib/agentPersona";
import type { CompanyMapData } from "@/types/company";
import type { CoordinationHandoffEntry, ProductContext } from "@/types/state";

const STATUS_COLOR: Record<CoordinationHandoffEntry["status"], string> = {
  pending: "#f59e0b",
  "in-progress": "#22c55e",
  completed: "#8b5cf6",
  blocked: "#ef4444",
  rejected: "#6b7280",
  "awaiting-coordinator": "#3b82f6",
  unrouted: "#ef4444",
};

const STATUS_LABEL: Record<CoordinationHandoffEntry["status"], string> = {
  pending: "pendente",
  "in-progress": "em execução",
  completed: "concluído",
  blocked: "bloqueado",
  rejected: "rejeitado",
  "awaiting-coordinator": "aguardando coordinator",
  unrouted: "sem rota",
};

const PRODUCT_LABEL: Record<ProductContext, string> = {
  hospitalar: "Hospitalar",
  lince: "Lince SOC",
  shared: "Shared",
};

const SEVERITY_COLOR: Record<CoordinationHandoffEntry["severity"], string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#64748b",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10_000) return "agora";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

function actionLabel(handoff: CoordinationHandoffEntry): string {
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

function matchesProductFilter(
  productContext: ProductContext | undefined,
  filterProduct: ReturnType<typeof useSquadStore.getState>["filterProduct"],
): boolean {
  const context = productContext ?? "shared";
  if (filterProduct === "all") return true;
  if (filterProduct === "shared") return context === "shared";
  return context === filterProduct || context === "shared";
}

function agentDisplayName(id: string, company: CompanyMapData | null): string {
  if (id === "ceo") return "João Lucas (CEO)";
  if (id === "user") return "Usuário";
  for (const office of company?.offices ?? []) {
    const found = office.agents.find((agent) => agent.id === id || agent.id.endsWith(`/${id}`));
    if (found) {
      return fullName(
        personaForAgent(found.id, {
          displayName: found.displayName,
          role: found.role,
          descriptionPtBr: found.descriptionPtBr,
          gender: found.gender,
          leadership: found.leadership ?? null,
        }),
      );
    }
  }
  return fullName(personaForAgent(id));
}

function chainFor(handoff: CoordinationHandoffEntry): string[] {
  const chain = [handoff.fromAgent];
  if (
    handoff.coordinatorAgentId &&
    chain[chain.length - 1] !== handoff.coordinatorAgentId
  ) {
    chain.push(handoff.coordinatorAgentId);
  }
  const selectedSpecialist =
    handoff.selectedAgentId && handoff.selectedAgentId !== handoff.coordinatorAgentId
      ? handoff.selectedAgentId
      : null;
  if (selectedSpecialist && chain[chain.length - 1] !== selectedSpecialist) {
    chain.push(selectedSpecialist);
  } else if (
    handoff.toAgent &&
    handoff.toAgent !== handoff.coordinatorAgentId &&
    chain[chain.length - 1] !== handoff.toAgent
  ) {
    chain.push(handoff.toAgent);
  }
  return chain;
}

export function ContextRoutingPanel() {
  const company = useSquadStore((state) => state.company);
  const handoffs = useSquadStore((state) => state.handoffs);
  const filterProduct = useSquadStore((state) => state.filterProduct);
  const selectAgent = useSquadStore((state) => state.selectAgent);

  const visible = useMemo(
    () =>
      handoffs
        .filter((handoff) => matchesProductFilter(handoff.productContext, filterProduct))
        .slice(0, 8),
    [handoffs, filterProduct],
  );

  const summary = useMemo(() => {
    const scoped = handoffs.filter((handoff) =>
      matchesProductFilter(handoff.productContext, filterProduct),
    );
    return {
      active: scoped.filter((handoff) =>
        handoff.status === "pending" ||
        handoff.status === "in-progress" ||
        handoff.status === "blocked" ||
        handoff.status === "awaiting-coordinator",
      ).length,
      coordinated: scoped.filter((handoff) => handoff.routing?.decision === "coordinated").length,
      direct: scoped.filter((handoff) => handoff.routing?.decision === "direct").length,
      unrouted: scoped.filter((handoff) => handoff.status === "unrouted").length,
    };
  }, [handoffs, filterProduct]);

  return (
    <section
      style={{
        marginBottom: 16,
        borderRadius: 10,
        background: "linear-gradient(180deg, #101926 0%, #141418 100%)",
        border: "1px solid #3b82f644",
        boxShadow: "0 0 22px #3b82f622",
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
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#3b82f6",
            boxShadow: "0 0 8px #3b82f6",
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
          Encadeamento Contextual
        </h2>
        <span style={{ fontSize: 11, color: "var(--fg-dim, #8a8a92)", marginLeft: "auto" }}>
          {summary.active} ativo(s) · {summary.coordinated} coordenado(s) · {summary.direct} direto(s)
          {summary.unrouted > 0 ? ` · ${summary.unrouted} sem rota` : ""}
        </span>
      </header>

      {visible.length === 0 ? (
        <div
          style={{
            padding: "14px 16px",
            fontSize: 12,
            color: "var(--fg-dim, #8a8a92)",
          }}
        >
          Nenhum trigger contextual observado no snapshot atual. Quando um agent abrir um handoff,
          a cadeia real `origem → coordinator/especialista → execução` aparece aqui.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 10,
            padding: 12,
          }}
        >
          {visible.map((handoff) => {
            const statusColor = STATUS_COLOR[handoff.status];
            const chain = chainFor(handoff);
            const delegates = handoff.routing?.delegates ?? [];
            const selectedAgentId =
              handoff.selectedAgentId ?? handoff.toAgent ?? handoff.coordinatorAgentId ?? null;

            return (
              <article
                key={handoff.handoffId}
                style={{
                  borderRadius: 8,
                  border: `1px solid ${statusColor}33`,
                  background: "rgba(10, 14, 22, 0.72)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: statusColor,
                      background: `${statusColor}22`,
                      padding: "2px 6px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    {STATUS_LABEL[handoff.status]}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#93c5fd",
                      background: "#1d4ed822",
                      padding: "2px 6px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    {actionLabel(handoff)}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: SEVERITY_COLOR[handoff.severity],
                      background: `${SEVERITY_COLOR[handoff.severity]}22`,
                      padding: "2px 6px",
                      borderRadius: 4,
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    {handoff.severity}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: "var(--fg-dim, #8a8a92)",
                      marginLeft: "auto",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                    }}
                  >
                    {PRODUCT_LABEL[handoff.productContext ?? "shared"]} · {relativeTime(handoff.createdAt)}
                  </span>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: "var(--fg, #e5e5ea)",
                      lineHeight: 1.35,
                      marginBottom: 3,
                    }}
                  >
                    {handoff.reason}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-dim, #8a8a92)", lineHeight: 1.4 }}>
                    alvo {handoff.target.kind}:{handoff.target.name}
                    {handoff.target.namespace ? ` · ns ${handoff.target.namespace}` : ""}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {chain.map((agentId, index) => (
                    <div key={`${handoff.handoffId}-${agentId}-${index}`} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => selectAgent(agentId)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 999,
                          border: `1px solid ${
                            agentId === selectedAgentId ? statusColor : "var(--border, #2a2a30)"
                          }`,
                          background:
                            agentId === handoff.fromAgent
                              ? "#0f172a"
                              : agentId === handoff.coordinatorAgentId
                                ? "#172554"
                                : "#111827",
                          color: "var(--fg, #e5e5ea)",
                          fontSize: 10,
                          cursor: "pointer",
                        }}
                      >
                        {agentDisplayName(agentId, company)}
                      </button>
                      {index < chain.length - 1 && (
                        <span style={{ color: "#60a5fa", fontSize: 11, fontWeight: 700 }}>→</span>
                      )}
                    </div>
                  ))}
                </div>

                {delegates.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 10, color: "var(--fg-dim, #8a8a92)", textTransform: "uppercase", letterSpacing: 0.6 }}>
                      Specialists elegíveis
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {delegates.map((delegate) => {
                        const isSelected = delegate.agentId === handoff.selectedAgentId;
                        return (
                          <button
                            key={`${handoff.handoffId}-${delegate.agentId}`}
                            type="button"
                            onClick={() => selectAgent(delegate.agentId)}
                            style={{
                              padding: "4px 7px",
                              borderRadius: 6,
                              border: `1px solid ${isSelected ? "#22c55e" : "var(--border, #2a2a30)"}`,
                              background: isSelected ? "#052e16" : "var(--bg-tile, #1a1a1f)",
                              color: isSelected ? "#bbf7d0" : "var(--fg-dim, #c0c0c5)",
                              fontSize: 10,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                            title={delegate.rationale}
                          >
                            {agentDisplayName(delegate.agentId, company)}
                            {delegate.matchedContexts.length > 0
                              ? ` · ${delegate.matchedContexts.join(", ")}`
                              : ""}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {handoff.contextTags.slice(0, 6).map((tag) => (
                    <span
                      key={`${handoff.handoffId}-${tag}`}
                      style={{
                        fontSize: 9,
                        color: "#cbd5e1",
                        background: "#33415555",
                        padding: "2px 6px",
                        borderRadius: 999,
                        textTransform: "lowercase",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {handoff.suggestedNextSteps.length > 0 && (
                  <div style={{ fontSize: 11, color: "var(--fg-dim, #8a8a92)", lineHeight: 1.4 }}>
                    próximo: {handoff.suggestedNextSteps[0]}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
