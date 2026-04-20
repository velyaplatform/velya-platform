import { avatarFor, blinkFrame } from "@/lib/avatarFor";
import {
  formatElapsedSince,
  productColor,
  productLabel,
  relativeTime,
} from "@/lib/dashboardModel";
import { useDashboardModel } from "@/hooks/useDashboardModel";
import { useSquadStore } from "@/store/useSquadStore";

export function AgentDetailPanel() {
  const selectedAgentId = useSquadStore((state) => state.selectedAgentId);
  const selectAgent = useSquadStore((state) => state.selectAgent);
  const { agents, activityLog } = useDashboardModel();

  const agent = agents.find((entry) => entry.id === selectedAgentId);
  if (!agent) return null;

  const avatar = avatarFor(agent.avatarId, agent.gender);
  const recentHistory = activityLog
    .filter((event) => agent.technicalIds.includes(event.agentId))
    .slice(0, 5);

  return (
    <>
      <button
        type="button"
        aria-label="Fechar detalhes do agente"
        className="agent-drawer__backdrop"
        onClick={() => selectAgent(null)}
      />
      <aside className="agent-drawer">
        <header className="agent-drawer__header">
          <img
            src={blinkFrame(avatar)}
            alt={agent.displayName}
            className="agent-drawer__avatar"
          />
          <div className="agent-drawer__identity">
            <div className="agent-drawer__name">{agent.displayName}</div>
            <div className="agent-drawer__role">{agent.primaryRole.title}</div>
            <span
              className="agents-badge"
              style={{
                color: agent.statusColor,
                background: `${agent.statusColor}16`,
                borderColor: `${agent.statusColor}33`,
              }}
            >
              {agent.statusLabel}
            </span>
          </div>
          <button
            type="button"
            className="dashboard-button dashboard-button--icon"
            onClick={() => selectAgent(null)}
          >
            ×
          </button>
        </header>

        <div className="agent-drawer__content">
          <section className="agent-drawer__section">
            <h3>Agora</h3>
            <div className="agent-drawer__grid">
              <div>
                <span className="agent-drawer__label">Tarefa</span>
                <p>{agent.currentTask ?? "Sem tarefa em execução agora."}</p>
              </div>
              <div>
                <span className="agent-drawer__label">Origem</span>
                <p>{agent.sourceLabel}</p>
              </div>
              <div>
                <span className="agent-drawer__label">Tempo decorrido</span>
                <p>{formatElapsedSince(agent.sinceIso)}</p>
              </div>
            </div>
          </section>

          <section className="agent-drawer__section">
            <h3>Papéis</h3>
            <div className="agent-drawer__roles">
              {agent.roles.map((role) => (
                <article key={`${agent.id}-${role.nucleusId}`} className="agent-drawer__role-card">
                  <div className="agent-drawer__role-head">
                    <strong>{role.title}</strong>
                    <span
                      className="agents-badge"
                      style={{
                        color: productColor(role.product),
                        background: `${productColor(role.product)}16`,
                        borderColor: `${productColor(role.product)}33`,
                      }}
                    >
                      {productLabel(role.product)}
                    </span>
                  </div>
                  <div className="agent-drawer__subline">{role.nucleusName}</div>
                  <p>{role.nucleusDescription}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="agent-drawer__section">
            <h3>Identificador</h3>
            <div className="agent-drawer__chips">
              {agent.technicalIds.map((technicalId) => (
                <span key={technicalId} className="agents-tag">
                  {technicalId}
                </span>
              ))}
            </div>
          </section>

          <section className="agent-drawer__section">
            <h3>Escritório</h3>
            <div className="agent-drawer__grid">
              <div>
                <span className="agent-drawer__label">Núcleo principal</span>
                <p>{agent.primaryRole.nucleusName}</p>
              </div>
              <div>
                <span className="agent-drawer__label">Descrição</span>
                <p>{agent.primaryRole.nucleusDescription}</p>
              </div>
            </div>
          </section>

          <section className="agent-drawer__section">
            <h3>Descrição</h3>
            <p>{agent.descriptionPtBr || "Sem bio cadastrada."}</p>
          </section>

          <section className="agent-drawer__section">
            <h3>Histórico recente</h3>
            {recentHistory.length === 0 ? (
              <p>Nenhuma ação recente para este agente.</p>
            ) : (
              <div className="agent-drawer__history">
                {recentHistory.map((event) => (
                  <article key={event.id} className="agent-drawer__history-item">
                    <strong>{event.message}</strong>
                    <span>
                      {event.squadName} · {relativeTime(event.timestamp)}
                    </span>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}
