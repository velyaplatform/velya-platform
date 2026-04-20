import type { SquadInfo, SquadState } from "@/types/state";
import { StatusBadge } from "./StatusBadge";

interface SquadCardProps {
  squad: SquadInfo;
  state: SquadState | undefined;
  isSelected: boolean;
  onSelect: () => void;
}

export function SquadCard({ squad, state, isSelected, onSelect }: SquadCardProps) {
  const isActive = !!state;
  const status = state?.status ?? "inactive";

  return (
    <button
      onClick={onSelect}
      style={{
        display: "grid",
        gridTemplateColumns: "auto auto minmax(0, 1fr) auto",
        alignItems: "start",
        gap: 8,
        width: "100%",
        padding: "12px",
        border: "none",
        borderLeft: isSelected ? "3px solid var(--accent-cyan)" : "3px solid transparent",
        background: isSelected ? "rgba(56, 189, 248, 0.08)" : "transparent",
        color: isActive ? "var(--text-primary)" : "var(--text-secondary)",
        cursor: "pointer",
        textAlign: "left",
        fontSize: 13,
        fontFamily: "inherit",
        transition: "all 0.15s ease",
        borderBottom: "1px solid rgba(148, 163, 184, 0.08)",
      }}
    >
      <StatusBadge status={status} />
      <span style={{ marginRight: 4 }}>{squad.icon}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{squad.name}</div>
        {squad.description && (
          <div
            style={{
              marginTop: 4,
              fontSize: 11,
              color: "var(--text-secondary)",
              lineHeight: 1.4,
            }}
          >
            {squad.description}
          </div>
        )}
      </div>
      {state?.step && (
        <span style={{ fontSize: 11, color: "var(--text-secondary)", paddingTop: 2 }}>
          {state.step.current}/{state.step.total}
        </span>
      )}
    </button>
  );
}
