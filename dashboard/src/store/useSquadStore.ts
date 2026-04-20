import { create } from "zustand";
import type {
  SquadInfo,
  SquadState,
  AgentStatus,
  DelegationEntry,
  CoordinationHandoffEntry,
  SyncInfo,
} from "@/types/state";
import type { CompanyMapData, Product } from "@/types/company";

export type ViewMode = "agents" | "live-alas" | "office-2d";
export type ConnectionMode = "websocket" | "polling" | "offline";

export interface ActivityEvent {
  id: string;
  timestamp: string;
  squadCode: string;
  squadName: string;
  agentId: string;
  agentName: string;
  kind:
    | "squad-start"
    | "agent-working"
    | "agent-done"
    | "handoff"
    | "squad-complete"
    | "checkpoint";
  message: string;
}

const VIEW_MODE_KEY = "velya:dashboard:viewMode";
const FILTER_OFFICE_KEY = "velya:dashboard:filterOffice";
const FILTER_PRODUCT_KEY = "velya:dashboard:filterProduct";

export type ProductFilter = Product | "all";

function readStoredViewMode(): ViewMode {
  if (typeof window === "undefined") return "agents";
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY);
    if (v === "agents" || v === "live-alas" || v === "office-2d") return v;
    if (v === "empresa") return "agents";
    if (v === "ala-ativa") return "office-2d";
  } catch {
    // Storage unavailable
  }
  return "agents";
}

function readStoredFilterOffice(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(FILTER_OFFICE_KEY);
    return v || null;
  } catch {
    return null;
  }
}

function readStoredProductFilter(): ProductFilter {
  if (typeof window === "undefined") return "all";
  try {
    const v = window.localStorage.getItem(FILTER_PRODUCT_KEY);
    if (v === "hospitalar" || v === "lince" || v === "shared" || v === "all") return v;
  } catch {
    // noop
  }
  return "all";
}

const MAX_ACTIVITY_EVENTS = 40;

interface SquadStore {
  // State
  squads: Map<string, SquadInfo>;
  activeStates: Map<string, SquadState>;
  selectedSquad: string | null;
  isConnected: boolean;
  connectionMode: ConnectionMode;
  company: CompanyMapData | null;
  syncInfo: SyncInfo | null;
  viewMode: ViewMode;
  selectedAgentId: string | null;
  activityLog: ActivityEvent[];
  /** agentId -> last "working" timestamp (ms) */
  recentActivity: Map<string, number>;
  searchTerm: string;
  filterOfficeId: string | null;
  filterProduct: ProductFilter;
  delegations: DelegationEntry[];
  handoffs: CoordinationHandoffEntry[];

  // Actions
  selectSquad: (name: string | null) => void;
  setConnectionStatus: (connected: boolean, mode: ConnectionMode) => void;
  setSnapshot: (
    squads: SquadInfo[],
    activeStates: Record<string, SquadState>,
    company?: CompanyMapData,
    delegations?: DelegationEntry[],
    handoffs?: CoordinationHandoffEntry[],
    syncInfo?: SyncInfo,
  ) => void;
  setDelegations: (
    delegations: DelegationEntry[],
    handoffs?: CoordinationHandoffEntry[],
    syncInfo?: SyncInfo,
  ) => void;
  setSquadActive: (squad: string, state: SquadState) => void;
  updateSquadState: (squad: string, state: SquadState) => void;
  setSquadInactive: (squad: string) => void;
  setViewMode: (mode: ViewMode) => void;
  selectAgent: (compositeId: string | null) => void;
  pushActivity: (event: ActivityEvent) => void;
  clearActivity: () => void;
  setSearchTerm: (term: string) => void;
  setFilterOffice: (officeId: string | null) => void;
  setFilterProduct: (p: ProductFilter) => void;
}

function markRecent(
  prev: Map<string, number>,
  squadCode: string,
  agentStatus: AgentStatus,
  agentId: string,
): Map<string, number> {
  if (agentStatus === "working" || agentStatus === "done") {
    const next = new Map(prev);
    next.set(`${squadCode}/${agentId}`, Date.now());
    return next;
  }
  return prev;
}

function markRecentDelegation(
  prev: Map<string, number>,
  delegation: DelegationEntry,
): Map<string, number> {
  if (
    delegation.status !== "in-progress" &&
    delegation.status !== "completed" &&
    delegation.status !== "blocked"
  ) {
    return prev;
  }

  const ts = new Date(delegation.ts).getTime();
  if (Number.isNaN(ts)) return prev;

  const next = new Map(prev);
  const previousTs = next.get(delegation.to) ?? 0;
  if (ts > previousTs) {
    next.set(delegation.to, ts);
  }
  return next;
}

function markRecentDelegations(
  prev: Map<string, number>,
  delegations: DelegationEntry[],
): Map<string, number> {
  let next = prev;
  for (const delegation of delegations) {
    next = markRecentDelegation(next, delegation);
  }
  return next;
}

function markRecentHandoff(
  prev: Map<string, number>,
  handoff: CoordinationHandoffEntry,
): Map<string, number> {
  const ts = new Date(handoff.createdAt).getTime();
  if (Number.isNaN(ts)) return prev;

  let next = prev;
  for (const agentId of [
    handoff.fromAgent,
    handoff.selectedAgentId,
    handoff.coordinatorAgentId,
  ]) {
    if (!agentId) continue;
    if (next === prev) next = new Map(prev);
    const previousTs = next.get(agentId) ?? 0;
    if (ts > previousTs) {
      next.set(agentId, ts);
    }
  }
  return next;
}

function markRecentHandoffs(
  prev: Map<string, number>,
  handoffs: CoordinationHandoffEntry[],
): Map<string, number> {
  let next = prev;
  for (const handoff of handoffs) {
    next = markRecentHandoff(next, handoff);
  }
  return next;
}

export const useSquadStore = create<SquadStore>((set) => ({
  squads: new Map(),
  activeStates: new Map(),
  selectedSquad: null,
  isConnected: false,
  connectionMode: "offline",
  company: null,
  syncInfo: null,
  viewMode: readStoredViewMode(),
  selectedAgentId: null,
  activityLog: [],
  recentActivity: new Map(),
  searchTerm: "",
  filterOfficeId: readStoredFilterOffice(),
  filterProduct: readStoredProductFilter(),
  delegations: [],
  handoffs: [],

  selectSquad: (name) => set({ selectedSquad: name }),

  setConnectionStatus: (connected, mode) =>
    set({ isConnected: connected, connectionMode: mode }),

  setSnapshot: (squads, activeStates, company, delegations, handoffs, syncInfo) =>
    set((prev) => {
      let recent = prev.recentActivity;
      for (const [code, state] of Object.entries(activeStates)) {
        for (const a of state.agents) {
          recent = markRecent(recent, code, a.status, a.id);
        }
      }
      if (delegations) {
        recent = markRecentDelegations(recent, delegations);
      }
      if (handoffs) {
        recent = markRecentHandoffs(recent, handoffs);
      }
      return {
        squads: new Map(squads.map((s) => [s.code, s])),
        activeStates: new Map(Object.entries(activeStates)),
        company: company ?? null,
        syncInfo: syncInfo ?? prev.syncInfo,
        recentActivity: recent,
        delegations: delegations ?? prev.delegations,
        handoffs: handoffs ?? prev.handoffs,
      };
    }),

  setDelegations: (delegations, handoffs, syncInfo) =>
    set((prev) => ({
      delegations,
      handoffs: handoffs ?? prev.handoffs,
      syncInfo: syncInfo ?? prev.syncInfo,
      recentActivity: markRecentHandoffs(
        markRecentDelegations(prev.recentActivity, delegations),
        handoffs ?? prev.handoffs,
      ),
    })),

  setSquadActive: (squad, state) =>
    set((prev) => {
      let recent = prev.recentActivity;
      for (const a of state.agents) {
        recent = markRecent(recent, squad, a.status, a.id);
      }
      return {
        activeStates: new Map(prev.activeStates).set(squad, state),
        recentActivity: recent,
      };
    }),

  updateSquadState: (squad, state) =>
    set((prev) => {
      let recent = prev.recentActivity;
      for (const a of state.agents) {
        recent = markRecent(recent, squad, a.status, a.id);
      }
      return {
        activeStates: new Map(prev.activeStates).set(squad, state),
        recentActivity: recent,
      };
    }),

  setSquadInactive: (squad) =>
    set((prev) => {
      const next = new Map(prev.activeStates);
      next.delete(squad);
      return {
        activeStates: next,
        selectedSquad: prev.selectedSquad === squad ? null : prev.selectedSquad,
      };
    }),

  setViewMode: (mode) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(VIEW_MODE_KEY, mode);
      } catch {
        // noop
      }
    }
    set({ viewMode: mode });
  },

  selectAgent: (compositeId) => set({ selectedAgentId: compositeId }),

  pushActivity: (event) =>
    set((prev) => {
      if (prev.activityLog.some((existing) => existing.id === event.id)) {
        return prev;
      }
      return {
        activityLog: [event, ...prev.activityLog].slice(0, MAX_ACTIVITY_EVENTS),
      };
    }),

  clearActivity: () => set({ activityLog: [] }),

  setSearchTerm: (term) => set({ searchTerm: term }),

  setFilterOffice: (officeId) => {
    if (typeof window !== "undefined") {
      try {
        if (officeId) window.localStorage.setItem(FILTER_OFFICE_KEY, officeId);
        else window.localStorage.removeItem(FILTER_OFFICE_KEY);
      } catch {
        // noop
      }
    }
    set({ filterOfficeId: officeId });
  },

  setFilterProduct: (p) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(FILTER_PRODUCT_KEY, p);
      } catch {
        // noop
      }
    }
    set({ filterProduct: p });
  },
}));
