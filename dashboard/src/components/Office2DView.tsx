import { useEffect } from "react";
import { PhaserGame } from "@/office/PhaserGame";
import { useDashboardModel } from "@/hooks/useDashboardModel";
import { useSquadStore } from "@/store/useSquadStore";
import { SquadSelector } from "./SquadSelector";

export function Office2DView() {
  const { liveAlas } = useDashboardModel();
  const selectedSquad = useSquadStore((state) => state.selectedSquad);
  const selectSquad = useSquadStore((state) => state.selectSquad);

  useEffect(() => {
    if (!selectedSquad && liveAlas.length > 0) {
      selectSquad(liveAlas[0].id);
    }
  }, [liveAlas, selectedSquad, selectSquad]);

  return (
    <section className="page-section page-section--office">
      <SquadSelector />
      <div className="office-view">
        <div className="office-view__header">
          <h2>Escritório 2D</h2>
          <p>
            Visualização opcional da ala. Clique em qualquer agente para abrir o mesmo
            drawer de detalhes.
          </p>
        </div>
        <div className="office-view__canvas">
          <PhaserGame />
        </div>
      </div>
    </section>
  );
}
