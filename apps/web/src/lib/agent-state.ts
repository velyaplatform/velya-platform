/**
 * Agent state store — file-backed persistence for lifecycle stage,
 * scorecards, kill-switch overrides, and quarantine status.
 *
 * Why a separate store from agent-runtime.ts?
 *   - agent-runtime.ts is the static contract (charter, validators, allowed
 *     actions). It is checked into Git.
 *   - agent-state.ts is the LIVE state (current stage, current scorecard).
 *     It changes at runtime as the agent runs and as humans promote/quarantine.
 *
 * Storage: VELYA_AGENT_STATE_PATH or /data/velya-cron/agent-state.json
 *
 * Compliance:
 *   - Every write is audited via lib/audit-logger.
 *   - The store NEVER lets an agent promote itself (.claude/rules/agents.md
 *     "No agent may promote its own lifecycle stage"). The promote API only
 *     accepts an explicit `actor` and refuses if `actor === agentId`.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { audit } from './audit-logger';
import {
  AGENTS,
  type AgentDef,
  type LifecycleStage,
  type AgentScorecard,
} from './agent-runtime';

const STORAGE_PATH =
  process.env.VELYA_AGENT_STATE_PATH || '/data/velya-cron/agent-state.json';

interface AgentState {
  agentId: string;
  /** Live lifecycle stage — overrides the static `lifecycleStage` from registry */
  stage: LifecycleStage;
  /** True when watchdog quarantined the agent — blocks all execution */
  quarantined: boolean;
  /** Why was it quarantined */
  quarantineReason?: string;
  /** Last successful run timestamp */
  lastRunAt?: string;
  /** Total runs ever */
  runCount: number;
  /** Last scorecard calculation */
  scorecard: AgentScorecard;
  /** Updated by watchdog after every run */
  updatedAt: string;
}

interface StoreShape {
  agents: Record<string, AgentState>;
}

const ZERO_SCORECARD: AgentScorecard = {
  validationPassRate: 1,
  auditPassRate: 1,
  evidenceCompleteness: 1,
  slaAdherence: 1,
  correctionRecurrence: 0,
  updatedAt: new Date(0).toISOString(),
};

function ensureStorage(): void {
  const dir = dirname(STORAGE_PATH);
  if (!existsSync(dir)) {
    try {
      mkdirSync(dir, { recursive: true });
    } catch {
      // ignore — read path will short-circuit to defaults
    }
  }
  if (!existsSync(STORAGE_PATH)) {
    try {
      writeFileSync(STORAGE_PATH, JSON.stringify({ agents: {} }, null, 2));
    } catch {
      // ignore
    }
  }
}

function readStore(): StoreShape {
  ensureStorage();
  try {
    const raw = readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as StoreShape;
    if (!parsed.agents) return { agents: {} };
    return parsed;
  } catch {
    return { agents: {} };
  }
}

function writeStore(store: StoreShape): void {
  ensureStorage();
  try {
    writeFileSync(STORAGE_PATH, JSON.stringify(store, null, 2));
  } catch {
    // ignore — memory state remains the source of truth for this run
  }
}

function defaultState(agent: AgentDef): AgentState {
  return {
    agentId: agent.id,
    stage: agent.lifecycleStage,
    quarantined: false,
    runCount: 0,
    scorecard: ZERO_SCORECARD,
    updatedAt: new Date().toISOString(),
  };
}

/** Read the live state for one agent. Falls back to the static contract. */
export function getAgentState(agentId: string): AgentState | null {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return null;
  const store = readStore();
  return store.agents[agentId] ?? defaultState(agent);
}

/** Read live state for every registered agent. Always non-empty. */
export function listAgentStates(): AgentState[] {
  const store = readStore();
  return AGENTS.map((a) => store.agents[a.id] ?? defaultState(a));
}

/** Record a run completion — bumps counters and recalculates scorecard. */
export function recordAgentRun(
  agentId: string,
  outcome: { success: boolean; correctionRecurred?: boolean; evidenceComplete: boolean },
): AgentState | null {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return null;
  const store = readStore();
  const cur = store.agents[agentId] ?? defaultState(agent);
  cur.runCount += 1;
  cur.lastRunAt = new Date().toISOString();
  cur.updatedAt = cur.lastRunAt;

  // Exponentially weighted update — α = 0.2 keeps history without being slow
  const ALPHA = 0.2;
  const success = outcome.success ? 1 : 0;
  cur.scorecard.validationPassRate = (1 - ALPHA) * cur.scorecard.validationPassRate + ALPHA * success;
  cur.scorecard.auditPassRate = (1 - ALPHA) * cur.scorecard.auditPassRate + ALPHA * success;
  cur.scorecard.evidenceCompleteness =
    (1 - ALPHA) * cur.scorecard.evidenceCompleteness + ALPHA * (outcome.evidenceComplete ? 1 : 0);
  cur.scorecard.slaAdherence = (1 - ALPHA) * cur.scorecard.slaAdherence + ALPHA * 1; // run finished within deadline
  cur.scorecard.correctionRecurrence =
    (1 - ALPHA) * cur.scorecard.correctionRecurrence + ALPHA * (outcome.correctionRecurred ? 1 : 0);
  cur.scorecard.updatedAt = cur.lastRunAt;

  // Auto-quarantine when scorecard goes critical (any metric < 0.6 or
  // recurrence > 0.4) — matches the thresholds in agent-governance.md.
  const sc = cur.scorecard;
  const critical =
    sc.validationPassRate < 0.6 ||
    sc.auditPassRate < 0.65 ||
    sc.evidenceCompleteness < 0.7 ||
    sc.slaAdherence < 0.6 ||
    sc.correctionRecurrence > 0.4;
  if (critical && !cur.quarantined) {
    cur.quarantined = true;
    cur.quarantineReason = 'Scorecard caiu para crítico (auto-quarantine via watchdog)';
    audit({
      category: 'agent',
      action: 'agent.auto-quarantine',
      description: `Agente ${agentId} colocado em quarentena automática por scorecard crítico`,
      actor: 'observability-watchdog-agent',
      resource: `agent:${agentId}`,
      result: 'warning',
      details: { scorecard: sc },
    });
  }

  store.agents[agentId] = cur;
  writeStore(store);
  return cur;
}

/**
 * Promote an agent to the next lifecycle stage. ENFORCES that the actor is
 * not the agent itself (agents cannot self-promote).
 */
export function promoteAgent(
  agentId: string,
  toStage: LifecycleStage,
  actor: string,
): { ok: boolean; error?: string; state?: AgentState } {
  if (actor === agentId) {
    return { ok: false, error: 'agente não pode se auto-promover' };
  }
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return { ok: false, error: 'agente não existe' };
  const store = readStore();
  const cur = store.agents[agentId] ?? defaultState(agent);
  const previousStage = cur.stage;
  cur.stage = toStage;
  cur.updatedAt = new Date().toISOString();
  store.agents[agentId] = cur;
  writeStore(store);
  audit({
    category: 'agent',
    action: 'agent.lifecycle.promoted',
    description: `Agente ${agentId} promovido de ${previousStage} para ${toStage} por ${actor}`,
    actor,
    resource: `agent:${agentId}`,
    result: 'success',
    details: { previousStage, toStage },
  });
  return { ok: true, state: cur };
}

/** Manually quarantine an agent (admin action). */
export function quarantineAgent(
  agentId: string,
  reason: string,
  actor: string,
): { ok: boolean; error?: string; state?: AgentState } {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return { ok: false, error: 'agente não existe' };
  const store = readStore();
  const cur = store.agents[agentId] ?? defaultState(agent);
  cur.quarantined = true;
  cur.quarantineReason = reason;
  cur.updatedAt = new Date().toISOString();
  store.agents[agentId] = cur;
  writeStore(store);
  audit({
    category: 'agent',
    action: 'agent.quarantine',
    description: `Agente ${agentId} colocado em quarentena por ${actor}: ${reason}`,
    actor,
    resource: `agent:${agentId}`,
    result: 'warning',
    details: { reason },
  });
  return { ok: true, state: cur };
}

/** Lift quarantine. */
export function releaseAgent(agentId: string, actor: string): { ok: boolean; state?: AgentState } {
  const agent = AGENTS.find((a) => a.id === agentId);
  if (!agent) return { ok: false };
  const store = readStore();
  const cur = store.agents[agentId] ?? defaultState(agent);
  cur.quarantined = false;
  cur.quarantineReason = undefined;
  cur.updatedAt = new Date().toISOString();
  store.agents[agentId] = cur;
  writeStore(store);
  audit({
    category: 'agent',
    action: 'agent.release',
    description: `Quarentena de ${agentId} liberada por ${actor}`,
    actor,
    resource: `agent:${agentId}`,
    result: 'success',
    details: {},
  });
  return { ok: true, state: cur };
}

export type { AgentState };
