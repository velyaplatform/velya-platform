import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { DelegationEntry } from "./ledgerLoader";
import type {
  CoordinationHandoffEntry,
  HandoffLifecycleStatus,
  HandoffRoutePlan,
  ProductContext,
  TriggerActionType,
  HandoffSeverity,
} from "../types/state";

interface CoordinationAgentEntry {
  name: string;
  layer?: number;
  status?: "active" | "shadow" | "draft" | "deprecated" | "quarantined" | "unknown";
  lastReportAt?: string;
  lastReportSeverity?: "critical" | "high" | "medium" | "low" | "none";
  lifecycleStage?:
    | "draft"
    | "sandbox"
    | "shadow"
    | "probation"
    | "active"
    | "deprecated"
    | "retired";
}

interface CoordinationSnapshot {
  generatedAt: string;
  agents: CoordinationAgentEntry[];
  locks?: unknown[];
  handoffs?: unknown[];
  staleAgents?: string[];
}

interface CoordinationHandoffRouteDelegate {
  agentId: string;
  actionType?: TriggerActionType;
  productContext?: ProductContext;
  matchedContexts?: unknown[];
  rationale?: string;
  score?: number;
}

interface CoordinationHandoffRoute {
  actionType?: TriggerActionType;
  routingMode?: "contextual-specialist-only";
  decision?: "direct" | "coordinated" | "unrouted";
  selectedAgentId?: string;
  coordinatorAgentId?: string;
  contextTags?: unknown[];
  delegates?: CoordinationHandoffRouteDelegate[];
  explanation?: string;
}

interface CoordinationHandoffRecord {
  handoffId: string;
  createdAt: string;
  fromAgent: string;
  toAgent?: string;
  requestedAction?: TriggerActionType;
  productContext?: ProductContext;
  contextTags?: unknown[];
  severity?: HandoffSeverity;
  reason: string;
  context?: {
    target?: {
      kind?: string;
      name?: string;
      namespace?: string;
    };
  };
  suggestedNextSteps?: unknown[];
  routing?: CoordinationHandoffRoute;
}

export interface ResolvedCoordinationSnapshot {
  filePath: string;
  mtimeMs: number;
  snapshot: CoordinationSnapshot;
}

function isCoordinationSnapshot(data: unknown): data is CoordinationSnapshot {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return typeof record.generatedAt === "string" && Array.isArray(record.agents);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function isCoordinationHandoff(data: unknown): data is CoordinationHandoffRecord {
  if (!data || typeof data !== "object") return false;
  const record = data as Record<string, unknown>;
  return (
    typeof record.handoffId === "string" &&
    typeof record.createdAt === "string" &&
    typeof record.fromAgent === "string" &&
    typeof record.reason === "string"
  );
}

async function readJsonIfValid(filePath: string): Promise<ResolvedCoordinationSnapshot | null> {
  try {
    const raw = await fsp.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!isCoordinationSnapshot(parsed)) return null;
    const stat = await fsp.stat(filePath);
    return {
      filePath,
      mtimeMs: stat.mtimeMs,
      snapshot: parsed,
    };
  } catch {
    return null;
  }
}

async function hubCandidatePaths(): Promise<string[]> {
  const root = "/workspace/hub/autopilot/state/workspaces";
  try {
    const entries = await fsp.readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(root, entry.name, "agent-sync-status.json"));
  } catch {
    return [];
  }
}

async function candidatePaths(projectRoot: string): Promise<string[]> {
  const paths = new Set<string>();
  const configured = process.env.VELYA_AGENT_SYNC_SNAPSHOT;
  if (configured) paths.add(path.resolve(configured));
  paths.add(path.join(projectRoot, "ops", "state", "agent-sync-status.json"));
  paths.add("/data/velya-autopilot/agent-sync/status.json");
  for (const filePath of await hubCandidatePaths()) {
    paths.add(filePath);
  }
  return [...paths];
}

export async function resolveCoordinationSnapshot(
  projectRoot: string,
): Promise<ResolvedCoordinationSnapshot | null> {
  const candidates = await candidatePaths(projectRoot);
  const resolved = (
    await Promise.all(candidates.map((filePath) => readJsonIfValid(filePath)))
  ).filter((entry): entry is ResolvedCoordinationSnapshot => entry !== null);

  if (resolved.length === 0) return null;
  resolved.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return resolved[0];
}

export function coordinationWatchTargets(projectRoot: string): string[] {
  const targets = new Set<string>();
  const configured = process.env.VELYA_AGENT_SYNC_SNAPSHOT;
  if (configured) {
    targets.add(path.resolve(configured));
  }
  targets.add(path.join(projectRoot, "ops", "state"));
  targets.add("/data/velya-autopilot/agent-sync");
  targets.add("/workspace/hub/autopilot/state/workspaces");
  return [...targets];
}

function activeTargetsFromLedger(entries: DelegationEntry[]): Set<string> {
  return new Set(
    entries
      .filter((entry) =>
        entry.status === "pending" ||
        entry.status === "in-progress" ||
        entry.status === "blocked",
      )
      .map((entry) => entry.to),
  );
}

function coordinationStatusFor(agent: CoordinationAgentEntry, staleAgents: Set<string>) {
  if (staleAgents.has(agent.name)) return "blocked" as const;
  if (agent.status === "quarantined" || agent.status === "deprecated") {
    return "blocked" as const;
  }
  if (agent.lastReportAt) return "in-progress" as const;
  if (agent.status === "active" || agent.status === "shadow") return "in-progress" as const;
  return null;
}

function coordinationContext(
  agent: CoordinationAgentEntry,
  resolved: ResolvedCoordinationSnapshot,
  staleAgents: Set<string>,
) {
  const details = [
    `Coordination snapshot: ${resolved.filePath}`,
    `coordination generated at ${resolved.snapshot.generatedAt}`,
    `agent status ${agent.status ?? "unknown"}`,
  ];
  if (agent.layer != null) details.push(`layer ${agent.layer}`);
  if (agent.lifecycleStage) details.push(`lifecycle ${agent.lifecycleStage}`);
  if (agent.lastReportAt) details.push(`last report ${agent.lastReportAt}`);
  if (agent.lastReportSeverity && agent.lastReportSeverity !== "none") {
    details.push(`last severity ${agent.lastReportSeverity}`);
  }
  if (staleAgents.has(agent.name)) {
    details.push("agent is stale against expected cadence");
  }
  return details.join("; ");
}

function latestDelegationForHandoff(
  handoffId: string,
  existingDelegations: DelegationEntry[],
): DelegationEntry | null {
  let latest: DelegationEntry | null = null;
  const marker = `handoff:${handoffId}`;
  for (const delegation of existingDelegations) {
    const matchesContext =
      typeof delegation.context === "string" && delegation.context.includes(marker);
    const matchesId = delegation.id.startsWith(`handoff-${handoffId}-`);
    if (!matchesContext && !matchesId) continue;
    if (!latest || delegation.ts > latest.ts) {
      latest = delegation;
    }
  }
  return latest;
}

function normalizeRouting(
  routing: CoordinationHandoffRoute | undefined,
  requestedAction: TriggerActionType | undefined,
): HandoffRoutePlan | undefined {
  if (!routing) return undefined;
  const decision = routing.decision;
  if (
    decision !== "direct" &&
    decision !== "coordinated" &&
    decision !== "unrouted"
  ) {
    return undefined;
  }
  const actionType = routing.actionType ?? requestedAction ?? "validation";
  return {
    actionType,
    routingMode: "contextual-specialist-only",
    decision,
    selectedAgentId: routing.selectedAgentId,
    coordinatorAgentId: routing.coordinatorAgentId,
    contextTags: isStringArray(routing.contextTags) ? routing.contextTags : [],
    delegates: (routing.delegates ?? [])
      .filter((delegate): delegate is CoordinationHandoffRouteDelegate => !!delegate?.agentId)
      .map((delegate) => ({
        agentId: delegate.agentId,
        actionType: delegate.actionType ?? actionType,
        productContext: delegate.productContext ?? "shared",
        matchedContexts: isStringArray(delegate.matchedContexts)
          ? delegate.matchedContexts
          : [],
        rationale: delegate.rationale ?? "",
        score: typeof delegate.score === "number" ? delegate.score : 0,
      })),
    explanation: routing.explanation ?? "",
  };
}

function deriveHandoffStatus(
  handoff: CoordinationHandoffRecord,
  matchedDelegation: DelegationEntry | null,
): HandoffLifecycleStatus {
  if (matchedDelegation) return matchedDelegation.status;
  if (handoff.routing?.decision === "unrouted") return "unrouted";
  const selectedAgentId = handoff.routing?.selectedAgentId ?? handoff.toAgent;
  if (selectedAgentId === "delegation-coordinator-agent") {
    return "awaiting-coordinator";
  }
  return "pending";
}

function normalizeHandoff(
  handoff: CoordinationHandoffRecord,
  existingDelegations: DelegationEntry[],
): CoordinationHandoffEntry {
  const requestedAction = handoff.requestedAction;
  const routing = normalizeRouting(handoff.routing, requestedAction);
  const matchedDelegation = latestDelegationForHandoff(
    handoff.handoffId,
    existingDelegations,
  );
  const selectedAgentId = routing?.selectedAgentId ?? handoff.toAgent ?? null;
  const coordinatorAgentId =
    routing?.coordinatorAgentId ??
    (selectedAgentId === "delegation-coordinator-agent"
      ? "delegation-coordinator-agent"
      : null);
  const specialistAgentIds = [
    ...new Set(
      [
        ...(routing?.delegates.map((delegate) => delegate.agentId) ?? []),
        selectedAgentId && selectedAgentId !== coordinatorAgentId ? selectedAgentId : null,
        handoff.toAgent && handoff.toAgent !== coordinatorAgentId ? handoff.toAgent : null,
      ].filter((value): value is string => typeof value === "string" && value.length > 0),
    ),
  ];

  return {
    handoffId: handoff.handoffId,
    createdAt: handoff.createdAt,
    fromAgent: handoff.fromAgent,
    toAgent: handoff.toAgent,
    requestedAction,
    productContext: handoff.productContext,
    contextTags: isStringArray(handoff.contextTags)
      ? handoff.contextTags
      : routing?.contextTags ?? [],
    severity: handoff.severity ?? "medium",
    reason: handoff.reason,
    target: {
      kind: handoff.context?.target?.kind ?? "unknown",
      name: handoff.context?.target?.name ?? "unknown",
      namespace: handoff.context?.target?.namespace,
    },
    suggestedNextSteps: isStringArray(handoff.suggestedNextSteps)
      ? handoff.suggestedNextSteps
      : [],
    routing,
    selectedAgentId,
    coordinatorAgentId,
    specialistAgentIds,
    matchedDelegationId: matchedDelegation?.id ?? null,
    matchedDelegationStatus: matchedDelegation?.status ?? null,
    status: deriveHandoffStatus(handoff, matchedDelegation),
    evidencePath: matchedDelegation?.evidencePath ?? null,
  };
}

export async function loadCoordinationDelegations(
  projectRoot: string,
  existingDelegations: DelegationEntry[],
  resolvedSnapshot?: ResolvedCoordinationSnapshot | null,
): Promise<DelegationEntry[]> {
  const resolved = resolvedSnapshot ?? await resolveCoordinationSnapshot(projectRoot);
  if (!resolved) return [];

  const activeTargets = activeTargetsFromLedger(existingDelegations);
  const staleAgents = new Set(resolved.snapshot.staleAgents ?? []);

  const synthetic = resolved.snapshot.agents.flatMap((agent) => {
    if (!agent?.name || activeTargets.has(agent.name)) return [];
    const status = coordinationStatusFor(agent, staleAgents);
    if (!status) return [];

    return [
      {
        id: `coordination-${agent.name}`,
        ts: agent.lastReportAt ?? resolved.snapshot.generatedAt,
        from: "coordination-snapshot",
        to: agent.name,
        task: "Autopilot coordination heartbeat",
        context: coordinationContext(agent, resolved, staleAgents),
        status,
        evidencePath: resolved.filePath,
        origin: "coordination",
        blockReason:
          status === "blocked"
            ? staleAgents.has(agent.name)
              ? "Agent stale in coordination snapshot."
              : `Agent coordination status is ${agent.status ?? "unknown"}.`
            : undefined,
      } satisfies DelegationEntry,
    ];
  });

  synthetic.sort((left, right) => (left.ts < right.ts ? 1 : -1));
  return synthetic;
}

export async function loadCoordinationHandoffs(
  projectRoot: string,
  existingDelegations: DelegationEntry[],
  resolvedSnapshot?: ResolvedCoordinationSnapshot | null,
): Promise<CoordinationHandoffEntry[]> {
  const resolved = resolvedSnapshot ?? await resolveCoordinationSnapshot(projectRoot);
  if (!resolved) return [];

  const handoffs = (resolved.snapshot.handoffs ?? [])
    .filter(isCoordinationHandoff)
    .map((handoff) => normalizeHandoff(handoff, existingDelegations))
    .sort((left, right) => (left.createdAt < right.createdAt ? 1 : -1));

  return handoffs;
}

export function looksLikeCoordinationFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return (
    normalized.endsWith("/agent-sync-status.json") ||
    normalized.endsWith("/agent-sync/status.json")
  );
}

export function coordinationTargetExists(target: string): boolean {
  return fs.existsSync(target);
}
