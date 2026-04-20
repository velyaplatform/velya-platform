import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";
import type { DelegationEntry, SquadInfo, SquadState, SyncInfo, WsMessage } from "../types/state";
import { buildCompanyMap } from "../plugin/companyLoader";
import { loadCoordinationDelegations, loadCoordinationHandoffs, resolveCoordinationSnapshot } from "../plugin/coordinationLoader";
import { loadDelegations } from "../plugin/ledgerLoader";

export function resolveSquadsDir(cwd = process.cwd()): string {
  const candidates = [
    path.resolve(cwd, "../squads"),
    path.resolve(cwd, "squads"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.resolve(cwd, "../squads");
}

export async function discoverSquads(squadsDir: string): Promise<SquadInfo[]> {
  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(squadsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const squads: SquadInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;

    const yamlPath = path.join(squadsDir, entry.name, "squad.yaml");
    try {
      const raw = await fsp.readFile(yamlPath, "utf-8");
      const parsed = parseYaml(raw);
      const squad = parsed?.squad;
      if (squad) {
        squads.push({
          code: typeof squad.code === "string" ? squad.code : entry.name,
          name: typeof squad.name === "string" ? squad.name : entry.name,
          description: typeof squad.description === "string" ? squad.description : "",
          icon: typeof squad.icon === "string" ? squad.icon : "\u{1F4CB}",
          agents: Array.isArray(squad.agents)
            ? (squad.agents as unknown[]).filter(
                (agent): agent is string => typeof agent === "string",
              )
            : [],
        });
        continue;
      }
    } catch {
      // Fallback below if squad.yaml is absent or malformed.
    }

    squads.push({
      code: entry.name,
      name: entry.name,
      description: "",
      icon: "\u{1F4CB}",
      agents: [],
    });
  }

  return squads;
}

export function isValidState(data: unknown): data is SquadState {
  if (!data || typeof data !== "object") return false;
  const state = data as Record<string, unknown>;
  return (
    typeof state.status === "string" &&
    state.step != null &&
    typeof state.step === "object" &&
    Array.isArray(state.agents)
  );
}

export async function readActiveStates(
  squadsDir: string,
): Promise<Record<string, SquadState>> {
  const states: Record<string, SquadState> = {};

  let entries: fs.Dirent[];
  try {
    entries = await fsp.readdir(squadsDir, { withFileTypes: true });
  } catch {
    return states;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const statePath = path.join(squadsDir, entry.name, "state.json");

    try {
      const raw = await fsp.readFile(statePath, "utf-8");
      const parsed = JSON.parse(raw);
      if (isValidState(parsed)) {
        states[entry.name] = parsed;
      }
    } catch {
      // Skip missing or invalid JSON
    }
  }

  return states;
}

function latestIso(values: Array<string | null | undefined>): string | null {
  let latest: string | null = null;
  for (const value of values) {
    if (!value) continue;
    if (!latest || value > latest) latest = value;
  }
  return latest;
}

function activeDelegationEntries(delegations: DelegationEntry[]) {
  return delegations.filter(
    (entry) =>
      entry.status === "pending" ||
      entry.status === "in-progress" ||
      entry.status === "blocked",
  );
}

export function buildSyncInfo(
  activeStates: Record<string, SquadState>,
  ledgerDelegations: DelegationEntry[],
  coordinationSnapshot: Awaited<ReturnType<typeof resolveCoordinationSnapshot>>,
): SyncInfo {
  const squads = Object.values(activeStates);
  const activeLedger = activeDelegationEntries(ledgerDelegations);
  const staleAgents = coordinationSnapshot?.snapshot.staleAgents ?? [];
  const reportingAgents =
    coordinationSnapshot?.snapshot.agents.filter(
      (agent) =>
        !!agent.lastReportAt ||
        agent.status === "active" ||
        agent.status === "shadow",
    ).length ?? 0;

  return {
    snapshotGeneratedAt: new Date().toISOString(),
    activeSquads: {
      total: squads.length,
      running: squads.filter((state) => state.status === "running").length,
      checkpoint: squads.filter((state) => state.status === "checkpoint").length,
      completed: squads.filter((state) => state.status === "completed").length,
      updatedAt: latestIso(squads.map((state) => state.updatedAt)),
    },
    ledger: {
      total: ledgerDelegations.length,
      active: activeLedger.length,
      pending: ledgerDelegations.filter((entry) => entry.status === "pending").length,
      inProgress: ledgerDelegations.filter((entry) => entry.status === "in-progress").length,
      blocked: ledgerDelegations.filter((entry) => entry.status === "blocked").length,
      updatedAt: latestIso(ledgerDelegations.map((entry) => entry.ts)),
    },
    coordination: {
      available: coordinationSnapshot !== null,
      filePath: coordinationSnapshot?.filePath ?? null,
      generatedAt: coordinationSnapshot?.snapshot.generatedAt ?? null,
      observedAt:
        coordinationSnapshot != null
          ? new Date(coordinationSnapshot.mtimeMs).toISOString()
          : null,
      totalAgents: coordinationSnapshot?.snapshot.agents.length ?? 0,
      reportingAgents,
      staleAgents,
    },
  };
}

export async function buildDelegationsUpdate(
  squadsDir: string,
): Promise<Extract<WsMessage, { type: "DELEGATIONS_UPDATE" }>> {
  const projectRoot = path.dirname(squadsDir);
  const delegations = await loadDelegations(projectRoot);
  const activeStates = await readActiveStates(squadsDir);
  const coordinationSnapshot = await resolveCoordinationSnapshot(projectRoot);
  const coordinationDelegations = await loadCoordinationDelegations(
    projectRoot,
    delegations,
    coordinationSnapshot,
  );
  const coordinationHandoffs = await loadCoordinationHandoffs(
    projectRoot,
    delegations,
    coordinationSnapshot,
  );

  return {
    type: "DELEGATIONS_UPDATE",
    delegations: [...coordinationDelegations, ...delegations].sort((left, right) =>
      left.ts < right.ts ? 1 : -1,
    ),
    handoffs: coordinationHandoffs,
    sync: buildSyncInfo(activeStates, delegations, coordinationSnapshot),
  };
}

export async function buildSnapshot(squadsDir: string): Promise<WsMessage> {
  const squads = await discoverSquads(squadsDir);
  const company = await buildCompanyMap(squadsDir, squads);
  const projectRoot = path.dirname(squadsDir);
  const activeStates = await readActiveStates(squadsDir);
  const delegations = await loadDelegations(projectRoot);
  const coordinationSnapshot = await resolveCoordinationSnapshot(projectRoot);
  const coordinationDelegations = await loadCoordinationDelegations(
    projectRoot,
    delegations,
    coordinationSnapshot,
  );
  const coordinationHandoffs = await loadCoordinationHandoffs(
    projectRoot,
    delegations,
    coordinationSnapshot,
  );

  return {
    type: "SNAPSHOT",
    squads,
    activeStates,
    company,
    delegations: [...coordinationDelegations, ...delegations].sort((left, right) =>
      left.ts < right.ts ? 1 : -1,
    ),
    handoffs: coordinationHandoffs,
    sync: buildSyncInfo(activeStates, delegations, coordinationSnapshot),
  };
}
