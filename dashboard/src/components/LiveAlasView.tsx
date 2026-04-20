import { avatarFor, blinkFrame } from "@/lib/avatarFor";
import { relativeTime } from "@/lib/dashboardModel";
import { useDashboardModel } from "@/hooks/useDashboardModel";
import { useSquadStore } from "@/store/useSquadStore";

export function LiveAlasView() {
  const { liveAlas } = useDashboardModel();
  const setViewMode = useSquadStore((state) => state.setViewMode);
  const selectSquad = useSquadStore((state) => state.selectSquad);
  const selectAgent = useSquadStore((state) => state.selectAgent);

  if (liveAlas.length === 0) {
    return (
      <section className="page-section page-section--center">
        <div className="dashboard-empty">
          Nenhuma ala em operação no momento. Rode `/opensquad run &lt;nome&gt;` para
          preencher esta visão.
        </div>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="live-alas">
        {liveAlas.map((ala) => (
          <article key={ala.id} className="live-ala-card">
            <header className="live-ala-card__header">
              <div>
                <div className="live-ala-card__eyebrow">
                  <span>{ala.icon}</span>
                  <span>{ala.id}</span>
                </div>
                <h2 className="live-ala-card__title">{ala.name}</h2>
                {ala.description && (
                  <p className="live-ala-card__description">{ala.description}</p>
                )}
              </div>
              <span
                className="agents-badge"
                style={{
                  color: ala.statusColor,
                  background: `${ala.statusColor}16`,
                  borderColor: `${ala.statusColor}33`,
                }}
              >
                {ala.statusLabel}
              </span>
            </header>

            <div className="live-ala-card__progress">
              <div className="live-ala-card__progress-head">
                <span>
                  Passos {ala.currentStep}/{ala.totalSteps}
                </span>
                <span>{ala.progress}%</span>
              </div>
              <div className="live-ala-card__progress-track">
                <div
                  className="live-ala-card__progress-fill"
                  style={{ width: `${ala.progress}%`, background: ala.statusColor }}
                />
              </div>
              <span className="live-ala-card__step">{ala.stepLabel || "Sem rótulo de etapa"}</span>
            </div>

            <div className="live-ala-card__participants">
              {ala.participants.map((participant) => (
                <button
                  key={`${ala.id}-${participant.id}`}
                  type="button"
                  className="live-ala-card__participant"
                  onClick={() => selectAgent(participant.id)}
                  title={participant.displayName}
                >
                  <img
                    src={blinkFrame(avatarFor(participant.avatarId, participant.gender))}
                    alt={participant.displayName}
                  />
                </button>
              ))}
            </div>

            <div className="live-ala-card__footer">
              <div>
                <strong>Último log:</strong> {ala.lastActivityMessage}
                {ala.lastActivityAt && ` · ${relativeTime(ala.lastActivityAt)}`}
              </div>
              <button
                type="button"
                className="dashboard-button dashboard-button--ghost"
                onClick={() => {
                  selectSquad(ala.id);
                  setViewMode("office-2d");
                }}
              >
                Abrir escritório 2D
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
