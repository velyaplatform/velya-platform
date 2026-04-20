// state.json structure — matches Pipeline Runner output
export interface AgentDesk {
  col: number;
  row: number;
}

export type AgentStatus =
  | "idle"
  | "working"
  | "delivering"
  | "done"
  | "checkpoint";

export interface Agent {
  id: string;
  name: string;
  icon: string;
  status: AgentStatus;
  gender?: "male" | "female";
  desk: AgentDesk;
}

export interface Handoff {
  from: string;
  to: string;
  message: string;
  completedAt: string;
}

export type SquadStatus =
  | "idle"
  | "running"
  | "completed"
  | "checkpoint";

export interface SquadState {
  squad: string;
  status: SquadStatus;
  step: {
    current: number;
    total: number;
    label: string;
  };
  agents: Agent[];
  handoff: Handoff | null;
  startedAt: string | null;
  updatedAt: string;
}

// Squad metadata from squad.yaml
export interface SquadInfo {
  code: string;
  name: string;
  description: string;
  icon: string;
  agents: string[]; // agent file paths
}

import type { CompanyMapData } from "./company";

export interface DelegationEntry {
  id: string;
  ts: string;
  from: string;
  to: string;
  task: string;
  context: string;
  status: "pending" | "in-progress" | "completed" | "blocked" | "rejected";
  evidencePath?: string | null;
  blockReason?: string;
  origin?: "ledger" | "coordination";
}

export type TriggerActionType =
  | "validation"
  | "testing"
  | "monitoring"
  | "correction"
  | "improvement";

export type ProductContext = "hospitalar" | "lince" | "shared";
export type HandoffSeverity = "critical" | "high" | "medium" | "low";
export type HandoffLifecycleStatus =
  | DelegationEntry["status"]
  | "awaiting-coordinator"
  | "unrouted";

export interface HandoffRouteDelegate {
  agentId: string;
  actionType: TriggerActionType;
  productContext: ProductContext;
  matchedContexts: string[];
  rationale: string;
  score: number;
}

export interface HandoffRoutePlan {
  actionType: TriggerActionType;
  routingMode: "contextual-specialist-only";
  decision: "direct" | "coordinated" | "unrouted";
  selectedAgentId?: string;
  coordinatorAgentId?: string;
  contextTags: string[];
  delegates: HandoffRouteDelegate[];
  explanation: string;
}

export interface CoordinationHandoffEntry {
  handoffId: string;
  createdAt: string;
  fromAgent: string;
  toAgent?: string;
  requestedAction?: TriggerActionType;
  productContext?: ProductContext;
  contextTags: string[];
  severity: HandoffSeverity;
  reason: string;
  target: {
    kind: string;
    name: string;
    namespace?: string;
  };
  suggestedNextSteps: string[];
  routing?: HandoffRoutePlan;
  selectedAgentId?: string | null;
  coordinatorAgentId?: string | null;
  specialistAgentIds: string[];
  matchedDelegationId?: string | null;
  matchedDelegationStatus?: DelegationEntry["status"] | null;
  status: HandoffLifecycleStatus;
  evidencePath?: string | null;
}

export interface SyncInfo {
  snapshotGeneratedAt: string;
  activeSquads: {
    total: number;
    running: number;
    checkpoint: number;
    completed: number;
    updatedAt: string | null;
  };
  ledger: {
    total: number;
    active: number;
    pending: number;
    inProgress: number;
    blocked: number;
    updatedAt: string | null;
  };
  coordination: {
    available: boolean;
    filePath: string | null;
    generatedAt: string | null;
    observedAt: string | null;
    totalAgents: number;
    reportingAgents: number;
    staleAgents: string[];
  };
}

// WebSocket messages
export type WsMessage =
  | {
      type: "SNAPSHOT";
      squads: SquadInfo[];
      activeStates: Record<string, SquadState>;
      company?: CompanyMapData;
      delegations?: DelegationEntry[];
      handoffs?: CoordinationHandoffEntry[];
      sync?: SyncInfo;
    }
  | { type: "SQUAD_UPDATE"; squad: string; state: SquadState }
  | { type: "SQUAD_INACTIVE"; squad: string }
  | {
      type: "DELEGATIONS_UPDATE";
      delegations: DelegationEntry[];
      handoffs?: CoordinationHandoffEntry[];
      sync?: SyncInfo;
    };
