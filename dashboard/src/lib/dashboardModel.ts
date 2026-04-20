import { fullName, personaForAgent } from "@/lib/agentPersona";
import {
  deriveAgentStatuses,
  resolveActiveAgentId,
  type DerivedStatus,
} from "@/lib/deriveAgentStatus";
import type { ActivityEvent } from "@/store/useSquadStore";
import type {
  CompanyMapData,
  EngineeringAgent,
  Office,
  Product,
} from "@/types/company";
import type {
  AgentStatus,
  CoordinationHandoffEntry,
  DelegationEntry,
  SquadInfo,
  SquadState,
  SquadStatus,
} from "@/types/state";

const ROLE_HIERARCHY_ORDER: Record<Office["hierarchy"], number> = {
  executive: 0,
  council: 1,
  office: 2,
  "squad-ala": 3,
};

const STATUS_ORDER: Record<AgentStatus, number> = {
  working: 0,
  delivering: 1,
  checkpoint: 2,
  done: 3,
  idle: 4,
};

const ACTIVE_DELEGATION_STATUSES = new Set<
  DelegationEntry["status"]
>(["pending", "in-progress", "blocked"]);

const ACTIVE_HANDOFF_STATUSES = new Set<
  CoordinationHandoffEntry["status"]
>(["pending", "in-progress", "blocked", "awaiting-coordinator"]);

export interface DashboardRole {
  technicalId: string;
  title: string;
  nucleusId: string;
  nucleusName: string;
  nucleusDescription: string;
  hierarchy: Office["hierarchy"];
  product: Product;
  source: EngineeringAgent["source"];
  description: string;
}

export interface DashboardAgent {
  id: string;
  avatarId: string;
  displayName: string;
  primaryTechnicalId: string;
  technicalIds: string[];
  primaryRole: DashboardRole;
  roles: DashboardRole[];
  products: Product[];
  descriptionPtBr: string;
  gender: "m" | "f";
  leadership:
    | "ceo"
    | "conselheiro"
    | "gerente"
    | "coordenador"
    | "supervisor"
    | null;
}

export interface AgentDirectory {
  agents: DashboardAgent[];
  byId: Map<string, DashboardAgent>;
  knownAgentIds: Set<string>;
  offices: Array<{
    id: string;
    name: string;
    hierarchy: Office["hierarchy"];
    product: Product;
    count: number;
  }>;
}

export interface LiveAgentRow extends DashboardAgent {
  status: AgentStatus;
  statusLabel: string;
  statusColor: string;
  tone: "working" | "waiting" | "done" | "idle";
  currentTask?: string;
  sourceType: DerivedStatus["source"] | null;
  sourceLabel: string;
  sinceIso?: string;
  lastSeenAt: number;
}

export interface DashboardMetrics {
  working: number;
  waiting: number;
  done: number;
  idle: number;
  activeDelegations: number;
  inProgressDelegations: number;
  blockedDelegations: number;
  activeTriggers: number;
  liveAlas: number;
}

export interface LiveAlaSummary {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: SquadStatus;
  statusLabel: string;
  statusColor: string;
  currentStep: number;
  totalSteps: number;
  progress: number;
  stepLabel: string;
  participants: Array<{
    id: string;
    displayName: string;
    avatarId: string;
    gender: "m" | "f";
    status: AgentStatus;
  }>;
  lastActivityMessage: string;
  lastActivityAt?: string;
}

function roleRank(role: DashboardRole): number {
  return ROLE_HIERARCHY_ORDER[role.hierarchy];
}

function sortRoles(a: DashboardRole, b: DashboardRole): number {
  const rankDiff = roleRank(a) - roleRank(b);
  if (rankDiff !== 0) return rankDiff;
  return a.nucleusName.localeCompare(b.nucleusName, "pt-BR");
}

function dedupeProducts(products: Product[]): Product[] {
  return Array.from(new Set(products));
}

function toneFromStatus(status: AgentStatus): LiveAgentRow["tone"] {
  if (status === "working" || status === "delivering") return "working";
  if (status === "checkpoint") return "waiting";
  if (status === "done") return "done";
  return "idle";
}

export function agentStatusLabel(status: AgentStatus): string {
  switch (status) {
    case "working":
      return "Trabalhando";
    case "delivering":
      return "Entregando";
    case "checkpoint":
      return "Aguardando";
    case "done":
      return "Concluído";
    default:
      return "Ocioso";
  }
}

export function agentStatusColor(status: AgentStatus): string {
  switch (status) {
    case "working":
      return "#22c55e";
    case "delivering":
      return "#38bdf8";
    case "checkpoint":
      return "#f59e0b";
    case "done":
      return "#8b5cf6";
    default:
      return "#64748b";
  }
}

export function productLabel(product: Product): string {
  switch (product) {
    case "hospitalar":
      return "Velya";
    case "lince":
      return "Lince";
    default:
      return "Compartilhado";
  }
}

export function productColor(product: Product): string {
  switch (product) {
    case "hospitalar":
      return "#38bdf8";
    case "lince":
      return "#f87171";
    default:
      return "#94a3b8";
  }
}

export function sourceLabel(source: DerivedStatus["source"] | null): string {
  switch (source) {
    case "opensquad":
      return "Ala";
    case "coordination":
      return "Coordenação";
    case "delegation":
      return "Delegação";
    default:
      return "—";
  }
}

export function squadStatusLabel(status: SquadStatus): string {
  switch (status) {
    case "running":
      return "Rodando";
    case "checkpoint":
      return "Checkpoint";
    case "completed":
      return "Concluída";
    default:
      return "Ociosa";
  }
}

export function squadStatusColor(status: SquadStatus): string {
  switch (status) {
    case "running":
      return "#22c55e";
    case "checkpoint":
      return "#f59e0b";
    case "completed":
      return "#8b5cf6";
    default:
      return "#64748b";
  }
}

export function isActiveDelegation(entry: DelegationEntry): boolean {
  return ACTIVE_DELEGATION_STATUSES.has(entry.status);
}

export function isActiveHandoff(entry: CoordinationHandoffEntry): boolean {
  return ACTIVE_HANDOFF_STATUSES.has(entry.status);
}

export function buildAgentDirectory(company: CompanyMapData | null): AgentDirectory {
  if (!company) {
    return {
      agents: [],
      byId: new Map(),
      knownAgentIds: new Set(),
      offices: [],
    };
  }

  const agentsById = new Map<string, DashboardAgent>();

  for (const office of company.offices) {
    for (const rawAgent of office.agents) {
      const persona = personaForAgent(rawAgent.id, {
        displayName: rawAgent.displayName,
        role: rawAgent.role,
        descriptionPtBr: rawAgent.descriptionPtBr,
        gender: rawAgent.gender,
        leadership: rawAgent.leadership ?? null,
      });

      const role: DashboardRole = {
        technicalId: rawAgent.id,
        title: persona.role,
        nucleusId: office.id,
        nucleusName: office.name,
        nucleusDescription: office.description,
        hierarchy: office.hierarchy,
        product: office.product,
        source: rawAgent.source,
        description: rawAgent.descriptionPtBr ?? persona.descriptionPtBr,
      };

      const existing = agentsById.get(rawAgent.id);
      if (existing) {
        if (!existing.roles.some((item) => item.nucleusId === role.nucleusId)) {
          const roles = [...existing.roles, role].sort(sortRoles);
          agentsById.set(rawAgent.id, {
            ...existing,
            roles,
            primaryRole: roles[0],
            technicalIds: Array.from(
              new Set([...existing.technicalIds, rawAgent.id]),
            ),
            products: dedupeProducts([...existing.products, role.product]),
          });
        }
        continue;
      }

      agentsById.set(rawAgent.id, {
        id: rawAgent.id,
        avatarId: rawAgent.id,
        displayName: fullName(persona),
        primaryTechnicalId: rawAgent.id,
        technicalIds: [rawAgent.id],
        primaryRole: role,
        roles: [role],
        products: [role.product],
        descriptionPtBr: rawAgent.descriptionPtBr ?? persona.descriptionPtBr,
        gender: persona.gender,
        leadership: persona.leadership ?? null,
      });
    }
  }

  const agents = Array.from(agentsById.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName, "pt-BR"),
  );

  return {
    agents,
    byId: agentsById,
    knownAgentIds: new Set(agents.flatMap((agent) => agent.technicalIds)),
    offices: company.offices
      .filter((office) => office.agents.length > 0)
      .map((office) => ({
        id: office.id,
        name: office.name,
        hierarchy: office.hierarchy,
        product: office.product,
        count: office.agents.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

function pickBestStatus(
  technicalIds: string[],
  statuses: Map<string, DerivedStatus>,
): DerivedStatus | undefined {
  const candidates = technicalIds
    .map((technicalId) => statuses.get(technicalId))
    .filter((value): value is DerivedStatus => !!value)
    .sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      return (b.sinceIso ?? "").localeCompare(a.sinceIso ?? "");
    });

  return candidates[0];
}

export function buildLiveAgentRows(params: {
  directory: AgentDirectory;
  activeStates: Map<string, SquadState>;
  delegations: DelegationEntry[];
  handoffs: CoordinationHandoffEntry[];
  recentActivity: Map<string, number>;
}): LiveAgentRow[] {
  const { directory, activeStates, delegations, handoffs, recentActivity } = params;
  const derived = deriveAgentStatuses(
    activeStates,
    delegations,
    directory.knownAgentIds,
    handoffs,
  );

  return directory.agents
    .map((agent) => {
      const current = pickBestStatus(agent.technicalIds, derived);
      const status = current?.status ?? "idle";
      const lastSeenAt = Math.max(
        ...agent.technicalIds.map((technicalId) => recentActivity.get(technicalId) ?? 0),
        current?.sinceIso ? new Date(current.sinceIso).getTime() : 0,
      );

      return {
        ...agent,
        status,
        statusLabel: agentStatusLabel(status),
        statusColor: agentStatusColor(status),
        tone: toneFromStatus(status),
        currentTask: current?.currentTask,
        sourceType: current?.source ?? null,
        sourceLabel: sourceLabel(current?.source ?? null),
        sinceIso: current?.sinceIso,
        lastSeenAt,
      };
    })
    .sort((a, b) => {
      const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (statusDiff !== 0) return statusDiff;
      if (a.lastSeenAt !== b.lastSeenAt) return b.lastSeenAt - a.lastSeenAt;
      return a.displayName.localeCompare(b.displayName, "pt-BR");
    });
}

export function buildDashboardMetrics(params: {
  agents: LiveAgentRow[];
  delegations: DelegationEntry[];
  handoffs: CoordinationHandoffEntry[];
  activeStates: Map<string, SquadState>;
}): DashboardMetrics {
  const { agents, delegations, handoffs, activeStates } = params;

  return {
    working: agents.filter((agent) => agent.tone === "working").length,
    waiting: agents.filter((agent) => agent.tone === "waiting").length,
    done: agents.filter((agent) => agent.tone === "done").length,
    idle: agents.filter((agent) => agent.tone === "idle").length,
    activeDelegations: delegations.filter(isActiveDelegation).length,
    inProgressDelegations: delegations.filter(
      (entry) => entry.status === "in-progress",
    ).length,
    blockedDelegations: delegations.filter((entry) => entry.status === "blocked").length,
    activeTriggers: handoffs.filter(isActiveHandoff).length,
    liveAlas: activeStates.size,
  };
}

export function buildLiveAlaSummaries(params: {
  squads: Map<string, SquadInfo>;
  activeStates: Map<string, SquadState>;
  activityLog: ActivityEvent[];
  directory: AgentDirectory;
}): LiveAlaSummary[] {
  const { squads, activeStates, activityLog, directory } = params;
  const squadOrder: Record<SquadStatus, number> = {
    running: 0,
    checkpoint: 1,
    completed: 2,
    idle: 3,
  };

  return Array.from(activeStates.entries())
    .map(([squadCode, state]) => {
      const squad = squads.get(squadCode);
      const participants = state.agents
        .map((agent) => {
          const resolvedId = resolveActiveAgentId(
            squadCode,
            agent.id,
            directory.knownAgentIds,
          );
          const person = directory.byId.get(resolvedId);

          return {
            id: resolvedId,
            displayName: person?.displayName ?? agent.name,
            avatarId: person?.avatarId ?? resolvedId,
            gender: person?.gender ?? "m",
            status: agent.status,
          };
        })
        .sort((a, b) => {
          const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
          if (statusDiff !== 0) return statusDiff;
          return a.displayName.localeCompare(b.displayName, "pt-BR");
        });

      const lastEvent = activityLog.find((event) => event.squadCode === squadCode);

      return {
        id: squadCode,
        name: squad?.name ?? squadCode,
        description: squad?.description ?? "",
        icon: squad?.icon ?? "•",
        status: state.status,
        statusLabel: squadStatusLabel(state.status),
        statusColor: squadStatusColor(state.status),
        currentStep: state.step.current,
        totalSteps: state.step.total,
        progress:
          state.step.total > 0
            ? Math.min(100, Math.round((state.step.current / state.step.total) * 100))
            : 0,
        stepLabel: state.step.label,
        participants,
        lastActivityMessage:
          lastEvent?.message ??
          state.handoff?.message ??
          state.step.label ??
          "Sem atividade registrada ainda.",
        lastActivityAt: lastEvent?.timestamp ?? state.updatedAt,
      };
    })
    .sort((a, b) => {
      const statusDiff = squadOrder[a.status] - squadOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      return (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? "");
    });
}

export function relativeTime(iso?: string | null, now = Date.now()): string {
  if (!iso) return "sem dados";
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < 10_000) return "agora";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return `${Math.floor(diff / 86_400_000)}d`;
}

export function formatElapsedSince(iso?: string): string {
  if (!iso) return "sem relógio";
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s`;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMinutes}min`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}
