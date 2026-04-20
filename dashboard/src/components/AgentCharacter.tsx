import { useEffect, useMemo, useState } from "react";
import type { EngineeringAgent } from "@/types/company";
import type { AgentStatus } from "@/types/state";
import { avatarFor, blinkFrame, waveFrames } from "@/lib/avatarFor";
import { personaForAgent, fullName, type LeadershipRank } from "@/lib/agentPersona";
import { useSquadStore } from "@/store/useSquadStore";

interface AgentCharacterProps {
  agent: EngineeringAgent;
  liveStatus?: AgentStatus;
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: "#6b7280",
  working: "#22c55e",
  delivering: "#3b82f6",
  done: "#8b5cf6",
  checkpoint: "#f59e0b",
};

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "ocioso",
  working: "trabalhando",
  delivering: "entregando",
  done: "concluído",
  checkpoint: "aguardando aprovação",
};

const LEADERSHIP_BADGE: Record<NonNullable<LeadershipRank>, { icon: string; color: string; label: string }> = {
  ceo: { icon: "♕", color: "#eab308", label: "CEO" },
  conselheiro: { icon: "★", color: "#f59e0b", label: "Conselheiro" },
  gerente: { icon: "◆", color: "#8b5cf6", label: "Gerente" },
  coordenador: { icon: "▲", color: "#3b82f6", label: "Coordenador" },
  supervisor: { icon: "●", color: "#06b6d4", label: "Supervisor" },
};

const AFTERGLOW_WINDOW_MS = 5 * 60 * 1000;

export function AgentCharacter({ agent, liveStatus }: AgentCharacterProps) {
  const status: AgentStatus = liveStatus ?? "idle";
  const persona = personaForAgent(agent.id, {
    displayName: agent.displayName,
    role: agent.role,
    descriptionPtBr: agent.descriptionPtBr,
    gender: agent.gender,
    leadership: agent.leadership ?? null,
  });
  const displayName = fullName(persona);
  const character = useMemo(() => avatarFor(agent.id, persona.gender), [agent.id, persona.gender]);
  const frames = status === "working" ? waveFrames(character) : [blinkFrame(character)];
  const [frameIdx, setFrameIdx] = useState(0);
  const [, tickRerender] = useState(0);
  const selectAgent = useSquadStore((s) => s.selectAgent);
  const selectedAgentId = useSquadStore((s) => s.selectedAgentId);
  const recentActivity = useSquadStore((s) => s.recentActivity);

  const lastActive = recentActivity.get(agent.id);
  const afterglowActive =
    status === "idle" &&
    lastActive !== undefined &&
    Date.now() - lastActive < AFTERGLOW_WINDOW_MS;

  useEffect(() => {
    if (frames.length <= 1) {
      setFrameIdx(0);
      return;
    }
    const t = setInterval(() => {
      setFrameIdx((i) => (i + 1) % frames.length);
    }, 450);
    return () => clearInterval(t);
  }, [frames.length]);

  useEffect(() => {
    if (!afterglowActive) return;
    const t = setInterval(() => tickRerender((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, [afterglowActive]);

  const src = frames[frameIdx] ?? frames[0];
  const baseColor = STATUS_COLOR[status];
  const effectiveColor = afterglowActive ? STATUS_COLOR.done : baseColor;
  const isLive = agent.source === "opensquad" && liveStatus !== undefined;
  const isSelected = selectedAgentId === agent.id;
  const leadershipBadge = persona.leadership ? LEADERSHIP_BADGE[persona.leadership] : null;
  const isCeo = persona.leadership === "ceo";

  const borderColor =
    status !== "idle"
      ? effectiveColor + "88"
      : afterglowActive
        ? effectiveColor + "55"
        : isSelected
          ? "#e5e5ea66"
          : "transparent";

  const bgColor =
    status !== "idle"
      ? `${effectiveColor}14`
      : afterglowActive
        ? `${effectiveColor}0a`
        : "transparent";

  const tooltip = [
    `${displayName} — ${persona.role}`,
    leadershipBadge ? `[${leadershipBadge.label}]` : "",
    `Status: ${STATUS_LABEL[status]}`,
    afterglowActive && lastActive ? `Ativo há ${Math.round((Date.now() - lastActive) / 60000)} min` : "",
    persona.descriptionPtBr ? `\n${persona.descriptionPtBr}` : "",
  ].filter(Boolean).join("\n");

  return (
    <button
      type="button"
      onClick={() => selectAgent(agent.id)}
      title={tooltip}
      style={{
        all: "unset",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        width: isCeo ? 120 : 96,
        padding: "6px 4px",
        borderRadius: 8,
        background: isCeo ? "linear-gradient(180deg, #3a2e0a 0%, #1f1707 100%)" : bgColor,
        border: `${isCeo ? 2 : 1}px solid ${isCeo ? "#eab30888" : borderColor}`,
        boxShadow: isCeo ? "0 0 18px #eab30833" : "none",
        transition: "background 200ms, border-color 200ms, transform 120ms",
        cursor: "pointer",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      <div
        style={{
          position: "relative",
          width: isCeo ? 72 : 56,
          height: isCeo ? 72 : 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {leadershipBadge && (
          <span
            style={{
              position: "absolute",
              top: -10,
              right: -4,
              fontSize: isCeo ? 18 : 13,
              color: leadershipBadge.color,
              textShadow: `0 0 6px ${leadershipBadge.color}88`,
              lineHeight: 1,
              pointerEvents: "none",
              zIndex: 2,
            }}
            aria-label={leadershipBadge.label}
            title={leadershipBadge.label}
          >
            {leadershipBadge.icon}
          </span>
        )}
        <img
          src={src}
          alt={displayName}
          draggable={false}
          style={{
            width: isCeo ? 72 : 56,
            height: isCeo ? 72 : 56,
            objectFit: "contain",
            imageRendering: "pixelated",
            filter: status === "idle" && !afterglowActive ? "saturate(0.7)" : "none",
            transition: "filter 200ms",
          }}
        />
        <span
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: status === "working" ? 16 : 12,
            height: status === "working" ? 16 : 12,
            borderRadius: "50%",
            background: baseColor,
            border: "2px solid var(--bg-panel, #141418)",
            boxShadow: status === "working" ? `0 0 10px ${baseColor}` : "none",
            animation: status === "working" ? "pulse 1.4s infinite" : "none",
          }}
        />
        {status === "working" && (
          <span
            style={{
              position: "absolute",
              top: -14,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 8,
              fontWeight: 800,
              color: "#0a0a0e",
              background: baseColor,
              padding: "2px 6px",
              borderRadius: 3,
              letterSpacing: 0.6,
              whiteSpace: "nowrap",
              boxShadow: `0 0 8px ${baseColor}88`,
              zIndex: 3,
            }}
          >
            TRABALHANDO
          </span>
        )}
        {status === "checkpoint" && (
          <span
            style={{
              position: "absolute",
              top: -14,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 8,
              fontWeight: 800,
              color: "#0a0a0e",
              background: baseColor,
              padding: "2px 6px",
              borderRadius: 3,
              letterSpacing: 0.6,
              whiteSpace: "nowrap",
              zIndex: 3,
            }}
          >
            AGUARDANDO
          </span>
        )}
        {isLive && (
          <span
            style={{
              position: "absolute",
              top: -2,
              left: -2,
              fontSize: 8,
              fontWeight: 700,
              color: baseColor,
              background: "var(--bg-panel, #141418)",
              border: `1px solid ${baseColor}`,
              padding: "1px 4px",
              borderRadius: 3,
              letterSpacing: 0.4,
            }}
          >
            AO VIVO
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: "var(--fg, #e5e5ea)",
          textAlign: "center",
          lineHeight: 1.1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "100%",
          letterSpacing: 0.1,
        }}
      >
        {displayName}
      </div>
      <div
        style={{
          fontSize: 9,
          color: "var(--fg-dim, #8a8a92)",
          textAlign: "center",
          lineHeight: 1.15,
          maxWidth: "100%",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          padding: "0 2px",
        }}
      >
        {persona.role}
      </div>
    </button>
  );
}
