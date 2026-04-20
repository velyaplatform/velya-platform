import { useSquadStore } from "@/store/useSquadStore";
import { SquadCard } from "./SquadCard";

export function SquadSelector() {
  const squads = useSquadStore((s) => s.squads);
  const activeStates = useSquadStore((s) => s.activeStates);
  const selectedSquad = useSquadStore((s) => s.selectedSquad);
  const selectSquad = useSquadStore((s) => s.selectSquad);

  // Sort: active squads first, then alphabetical
  const squadList = Array.from(squads.values()).sort((a, b) => {
    const aActive = activeStates.has(a.code) ? 0 : 1;
    const bActive = activeStates.has(b.code) ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return a.name.localeCompare(b.name);
  });

  return (
    <aside
      className="office-sidebar"
    >
      <div className="office-sidebar__header">
        <strong>Alas</strong>
        <span>Nome completo, status e progresso</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {squadList.length === 0 && (
          <div style={{ padding: "16px 12px", color: "var(--text-secondary)", fontSize: 12 }}>
            Nenhuma ala encontrada.
          </div>
        )}
        {squadList.map((squad) => (
          <SquadCard
            key={squad.code}
            squad={squad}
            state={activeStates.get(squad.code)}
            isSelected={selectedSquad === squad.code}
            onSelect={() => selectSquad(squad.code)}
          />
        ))}
      </div>
    </aside>
  );
}
