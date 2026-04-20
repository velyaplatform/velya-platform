import { useMemo } from "react";
import { isActiveHandoff } from "@/lib/dashboardModel";
import { useSquadStore } from "@/store/useSquadStore";

export function ContextTriggerBanner() {
  const handoffs = useSquadStore((state) => state.handoffs);

  const active = useMemo(
    () => handoffs.filter((handoff) => isActiveHandoff(handoff)).slice(0, 2),
    [handoffs],
  );

  if (active.length === 0) return null;

  return (
    <div className="context-banner">
      <strong>Triggers ativos:</strong>
      {active.map((handoff) => (
        <span key={handoff.handoffId} className="context-banner__item">
          [{handoff.productContext ?? "shared"}] {handoff.reason}
        </span>
      ))}
    </div>
  );
}
