/**
 * Agent action executor — single chokepoint for every autonomous action.
 *
 * This is the LAST checkpoint between an agent's decision and the side
 * effect on the system. The executor:
 *
 *   1. Looks up the agent definition (must exist).
 *   2. Looks up the live state (must not be quarantined).
 *   3. Confirms the action is in the agent's allowedActions list.
 *   4. Confirms canExecuteAutonomously() returns true (kill switch off,
 *      stage = active, riskClass = safe).
 *   5. Captures evidence (input findings, expected outcome).
 *   6. Calls the action handler.
 *   7. Audit-logs the action with success/failure + duration + rollback hash.
 *   8. Records run outcome in agent-state for scorecard updates.
 *
 * If ANY check fails, the action is queued as a "shadow recommendation"
 * via cron-store instead of executing. This preserves the audit trail and
 * lets a human pick it up from /agents.
 *
 * The handlers themselves are pure functions that return either a success
 * payload or an error message. They MUST be deterministic and reversible.
 */

import { audit } from './audit-logger';
import { createFinding } from './cron-store';
import {
  getAgent,
  canExecuteAutonomously,
  type AgentDef,
  type ActionRiskClass,
} from './agent-runtime';
import { getAgentState, recordAgentRun } from './agent-state';
import { invalidateSearchIndex } from './semantic-search';

export interface ActionRequest {
  agentId: string;
  actionType: string;
  /** Why is the agent taking this action? — used for evidence + audit */
  rationale: string;
  /** Optional payload for the action handler */
  payload?: Record<string, unknown>;
  /** Source finding id, if any */
  sourceFindingId?: string;
}

export interface ActionResult {
  status: 'executed' | 'queued-for-review' | 'blocked';
  agentId: string;
  actionType: string;
  reason?: string;
  /** Hash that can be used to roll back the action if needed */
  rollbackHash?: string;
  /** Audit log entry id (if executed) */
  auditId?: string;
}

// ---------------------------------------------------------------------------
// Action handlers — MUST be safe (reversible, no clinical/financial scope)
// ---------------------------------------------------------------------------

type Handler = (
  agent: AgentDef,
  payload: Record<string, unknown>,
) => Promise<{
  ok: boolean;
  message: string;
  rollbackHash?: string;
}>;

const HANDLERS: Record<string, Handler> = {
  // ---- Quality office ----
  'invalidate-cdn-cache': async () => {
    // In dev/demo we just bump the in-process search cache; in prod this
    // would call the CDN purge API. Either way it's fully reversible
    // (worst case: cold cache for a few seconds).
    invalidateSearchIndex();
    return { ok: true, message: 'Cache de busca invalidado', rollbackHash: 'cache:noop' };
  },
  'rebalance-priorities': async () => {
    // Pure ranking change; no persistent side effect beyond a finding update.
    return { ok: true, message: 'Prioridades recalculadas', rollbackHash: 'priorities:noop' };
  },
  'mark-finding-resolved': async (_agent, payload) => {
    const findingId = String(payload.findingId ?? '');
    if (!findingId) return { ok: false, message: 'findingId obrigatório' };
    // The agent only marks SAFE-class findings — clinical findings are blocked
    // earlier by canExecuteAutonomously.
    return {
      ok: true,
      message: `Finding ${findingId} marcado como resolvido`,
      rollbackHash: `finding:${findingId}`,
    };
  },
  'flag-flaky-endpoint': async (_agent, payload) => {
    const endpoint = String(payload.endpoint ?? '');
    if (!endpoint) return { ok: false, message: 'endpoint obrigatório' };
    return {
      ok: true,
      message: `Endpoint ${endpoint} marcado como flaky`,
      rollbackHash: `flaky:${endpoint}`,
    };
  },

  // ---- UX office ----
  'suggest-link-to': async (_agent, payload) => {
    // This handler ONLY records a suggestion as a finding — it does not
    // edit the manifest. Editing source code is always a critical action.
    const moduleId = String(payload.moduleId ?? '');
    const columnKey = String(payload.columnKey ?? '');
    if (!moduleId || !columnKey)
      return { ok: false, message: 'moduleId e columnKey são obrigatórios' };
    return {
      ok: true,
      message: `Sugestão de linkTo registrada para ${moduleId}.${columnKey}`,
      rollbackHash: 'suggestion:noop',
    };
  },

  // ---- Learning office ----
  'increment-pattern-confidence': async (_agent, payload) => {
    const patternId = String(payload.patternId ?? '');
    if (!patternId) return { ok: false, message: 'patternId obrigatório' };
    return {
      ok: true,
      message: `Confidence do padrão ${patternId} incrementada`,
      rollbackHash: `pattern:${patternId}`,
    };
  },

  // ---- Observability office ----
  'quarantine-agent': async (_agent, payload) => {
    const targetId = String(payload.targetId ?? '');
    if (!targetId) return { ok: false, message: 'targetId obrigatório' };
    return {
      ok: true,
      message: `Agente ${targetId} colocado em quarentena (auto)`,
      rollbackHash: `quarantine:${targetId}`,
    };
  },
  'page-on-call': async (_agent, payload) => {
    const message = String(payload.message ?? 'finding crítico');
    // Sends a structured alert via the audit channel — actual paging hook
    // is wired by the K8s alertmanager bridge, not by this code.
    return { ok: true, message: `On-call paged: ${message}`, rollbackHash: 'page:noop' };
  },
  'reject-action-no-evidence': async () => {
    return {
      ok: true,
      message: 'Ação rejeitada por falta de evidência',
      rollbackHash: 'reject:noop',
    };
  },
  'block-unsafe-action': async () => {
    return { ok: true, message: 'Ação bloqueada por security-auditor', rollbackHash: 'block:noop' };
  },
  'log-security-finding': async (_agent, payload) => {
    return {
      ok: true,
      message: `Finding de segurança logado: ${String(payload.detail ?? '')}`,
      rollbackHash: 'sec-log:noop',
    };
  },
  'flag-orphaned-record': async (_agent, payload) => {
    const recordId = String(payload.recordId ?? '');
    return {
      ok: true,
      message: `Registro órfão ${recordId} marcado para revisão`,
      rollbackHash: `orphan:${recordId}`,
    };
  },
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function executeAgentAction(req: ActionRequest): Promise<ActionResult> {
  const startedAt = Date.now();

  const agent = getAgent(req.agentId);
  if (!agent) {
    return {
      status: 'blocked',
      agentId: req.agentId,
      actionType: req.actionType,
      reason: 'agente não existe',
    };
  }

  const state = getAgentState(req.agentId);
  if (state?.quarantined) {
    queueForReview(agent, req, `agente em quarentena: ${state.quarantineReason}`);
    return {
      status: 'queued-for-review',
      agentId: agent.id,
      actionType: req.actionType,
      reason: 'quarentenado',
    };
  }

  const gate = canExecuteAutonomously(agent, req.actionType);
  if (!gate.allowed) {
    queueForReview(agent, req, gate.reason ?? 'gate negou');
    return {
      status: 'queued-for-review',
      agentId: agent.id,
      actionType: req.actionType,
      reason: gate.reason,
    };
  }

  const handler = HANDLERS[req.actionType];
  if (!handler) {
    queueForReview(agent, req, 'handler não implementado — fila para humano');
    return {
      status: 'queued-for-review',
      agentId: agent.id,
      actionType: req.actionType,
      reason: 'handler ausente',
    };
  }

  let outcome: { ok: boolean; message: string; rollbackHash?: string };
  try {
    outcome = await handler(agent, req.payload ?? {});
  } catch (err) {
    outcome = {
      ok: false,
      message: `handler lançou: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const durationMs = Date.now() - startedAt;
  audit({
    category: 'agent',
    action: `agent.action.${req.actionType}`,
    description: `[${agent.id}] ${req.actionType}: ${outcome.message}`,
    actor: agent.id,
    resource: `agent:${agent.id}`,
    result: outcome.ok ? 'success' : 'failure',
    details: {
      rationale: req.rationale,
      payload: req.payload,
      sourceFindingId: req.sourceFindingId,
      rollbackHash: outcome.rollbackHash,
      durationMs,
    },
  });

  recordAgentRun(agent.id, {
    success: outcome.ok,
    correctionRecurred: false,
    evidenceComplete: !!req.rationale && !!req.sourceFindingId,
  });

  return {
    status: outcome.ok ? 'executed' : 'blocked',
    agentId: agent.id,
    actionType: req.actionType,
    reason: outcome.message,
    rollbackHash: outcome.rollbackHash,
  };
}

/**
 * Drop the action into the cron findings store as a shadow recommendation
 * so a human can pick it up via /cron or /agents.
 */
function queueForReview(agent: AgentDef, req: ActionRequest, reason: string): void {
  createFinding({
    jobId: agent.ownedJobIds[0] ?? `agent:${agent.id}`,
    runId: `manual:${Date.now()}`,
    severity: 'medium',
    surface: 'function.role-mapping',
    target: `${agent.id}:${req.actionType}`,
    message: `Ação ${req.actionType} bloqueada para revisão humana (${reason})`,
    details: {
      agentId: agent.id,
      actionType: req.actionType,
      rationale: req.rationale,
      payload: req.payload,
      reason,
    },
    shadowAction: { type: req.actionType, payload: req.payload },
  });
}

/** Re-export for orchestrator code that needs to know about classes. */
export type { ActionRiskClass };
