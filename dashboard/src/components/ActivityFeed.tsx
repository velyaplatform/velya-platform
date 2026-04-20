import { useState } from "react";
import { useSquadStore, type ActivityEvent } from "@/store/useSquadStore";

const KIND_COLOR: Record<ActivityEvent["kind"], string> = {
  "squad-start": "#22c55e",
  "agent-working": "#22c55e",
  "agent-done": "#8b5cf6",
  handoff: "#3b82f6",
  "squad-complete": "#8b5cf6",
  checkpoint: "#f59e0b",
};

const KIND_ICON: Record<ActivityEvent["kind"], string> = {
  "squad-start": "▶",
  "agent-working": "✎",
  "agent-done": "✓",
  handoff: "→",
  "squad-complete": "★",
  checkpoint: "⏸",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 10_000) return "agora";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export function ActivityFeed() {
  const activityLog = useSquadStore((s) => s.activityLog);
  const clearActivity = useSquadStore((s) => s.clearActivity);
  const [open, setOpen] = useState(true);

  const visibleCount = activityLog.length;

  return (
    <aside
      style={{
        position: "fixed",
        right: 16,
        bottom: 48,
        width: 320,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: open ? 360 : 36,
        background: "var(--bg-panel, #141418)",
        border: "1px solid var(--border, #2a2a30)",
        borderRadius: 10,
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        zIndex: 50,
        transition: "max-height 200ms ease-out",
      }}
    >
      <header
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          height: 36,
          background: "var(--bg-sidebar, #14141e)",
          borderBottom: open ? "1px solid var(--border, #2a2a30)" : "none",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: visibleCount > 0 ? "#22c55e" : "#6b7280",
            boxShadow: visibleCount > 0 ? "0 0 6px #22c55e" : "none",
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--fg, #e5e5ea)",
            letterSpacing: 0.5,
            textTransform: "uppercase",
            flex: 1,
          }}
        >
          Atividade da empresa
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--fg-dim, #8a8a92)",
          }}
        >
          {visibleCount} {visibleCount === 1 ? "evento" : "eventos"}
        </span>
        <span
          style={{
            fontSize: 10,
            color: "var(--fg-dim, #8a8a92)",
            transform: open ? "rotate(90deg)" : "rotate(0)",
            transition: "transform 180ms",
          }}
        >
          ›
        </span>
      </header>

      {open && (
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "6px 0",
          }}
        >
          {visibleCount === 0 && (
            <div
              style={{
                padding: "16px 12px",
                fontSize: 11,
                color: "var(--fg-dim, #8a8a92)",
                fontStyle: "italic",
                textAlign: "center",
              }}
            >
              Nada aconteceu ainda. Rode uma ala para ver o histórico.
            </div>
          )}
          {activityLog.map((ev) => (
            <div
              key={ev.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                padding: "6px 12px",
                fontSize: 11,
                lineHeight: 1.4,
              }}
            >
              <span
                style={{
                  color: KIND_COLOR[ev.kind],
                  fontFamily: "monospace",
                  fontWeight: 700,
                  width: 12,
                  flexShrink: 0,
                  textAlign: "center",
                }}
              >
                {KIND_ICON[ev.kind]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "var(--fg, #e5e5ea)" }}>{ev.message}</div>
                <div
                  style={{
                    fontSize: 10,
                    color: "var(--fg-dim, #8a8a92)",
                    marginTop: 2,
                  }}
                >
                  {ev.squadName} · {relativeTime(ev.timestamp)}
                </div>
              </div>
            </div>
          ))}
          {visibleCount > 0 && (
            <div style={{ padding: "4px 12px 8px", textAlign: "right" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clearActivity();
                }}
                style={{
                  background: "transparent",
                  border: "1px solid var(--border, #2a2a30)",
                  color: "var(--fg-dim, #8a8a92)",
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                limpar
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
