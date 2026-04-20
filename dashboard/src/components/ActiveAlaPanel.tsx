import { useEffect, useMemo } from "react";
import { useSquadStore } from "@/store/useSquadStore";
import { PhaserGame } from "@/office/PhaserGame";

export function ActiveAlaPanel() {
  const activeStates = useSquadStore((s) => s.activeStates);
  const squads = useSquadStore((s) => s.squads);
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const selectSquad = useSquadStore((s) => s.selectSquad);

  const orderedActive = useMemo(() => {
    return Array.from(activeStates.values()).sort((a, b) => {
      const rank = (s: string) =>
        s === "running" ? 0 : s === "checkpoint" ? 1 : s === "completed" ? 2 : 3;
      return rank(a.status) - rank(b.status);
    });
  }, [activeStates]);

  // Auto-seleciona a primeira ala viva quando nada estiver selecionado
  useEffect(() => {
    if (!selectedSquad && orderedActive.length > 0) {
      selectSquad(orderedActive[0].squad);
    }
  }, [selectedSquad, orderedActive, selectSquad]);

  const selected = selectedSquad ? activeStates.get(selectedSquad) : null;
  const selectedInfo = selectedSquad ? squads.get(selectedSquad) : null;

  if (orderedActive.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 24px",
          color: "var(--fg-dim, #8a8a92)",
          fontSize: 12,
          fontStyle: "italic",
          background: "var(--bg-panel, #141418)",
          border: "1px dashed var(--border, #2a2a30)",
          borderRadius: 10,
          marginBottom: 16,
        }}
      >
        Nenhuma ala operacional em execução — rode <code style={{ margin: "0 4px" }}>/opensquad run &lt;nome&gt;</code> para ver uma ala trabalhando em 2D aqui.
      </div>
    );
  }

  return (
    <section
      style={{
        marginBottom: 16,
        borderRadius: 10,
        border: "1px solid var(--border, #2a2a30)",
        background: "var(--bg-panel, #141418)",
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
          background: "linear-gradient(90deg, #0d1a0d 0%, #141418 100%)",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
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
          Ala em operação ao vivo
        </h2>
        {orderedActive.length > 1 && (
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {orderedActive.map((s) => (
              <button
                key={s.squad}
                type="button"
                onClick={() => selectSquad(s.squad)}
                style={{
                  padding: "4px 10px",
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 5,
                  border: `1px solid ${selectedSquad === s.squad ? "#22c55e" : "var(--border, #2a2a30)"}`,
                  background: selectedSquad === s.squad ? "#22c55e22" : "transparent",
                  color: selectedSquad === s.squad ? "#22c55e" : "var(--fg-dim, #8a8a92)",
                  cursor: "pointer",
                }}
              >
                {squads.get(s.squad)?.name ?? s.squad}
              </button>
            ))}
          </div>
        )}
        {selected && selectedInfo && orderedActive.length === 1 && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--fg-dim, #8a8a92)",
            }}
          >
            {selectedInfo.name} · passo {selected.step.current}/{selected.step.total}
            {selected.step.label ? ` · ${selected.step.label}` : ""}
          </span>
        )}
      </header>
      <div style={{ height: 360, display: "flex" }}>
        <PhaserGame />
      </div>
    </section>
  );
}
