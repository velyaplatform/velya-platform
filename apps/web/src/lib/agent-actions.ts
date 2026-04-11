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
import {
  createFinding,
  recordLearning,
  updateFinding,
  type Severity,
  type Surface,
} from './cron-store';
import {
  getAgent,
  canExecuteAutonomously,
  type AgentDef,
  type ActionRiskClass,
} from './agent-runtime';
import {
  getAgentState,
  quarantineAgent as quarantineAgentState,
  recordAgentRun,
} from './agent-state';
import { pageOnCall as raiseOnCallPage } from './oncall-store';
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
  'rebalance-priorities': async (agent) => {
    // Records a learning entry so the rebalance is queryable in /cron and
    // can be correlated with subsequent finding-resolution velocity.
    // The actual ranking is computed at read-time by listFindings, so the
    // "rebalance" itself is a metadata bookmark, not a destructive write.
    const learning = recordLearning({
      patternId: `priorities-rebalanced:${agent.id}`,
      observation: `Manager ${agent.id} recalculou prioridades das findings abertas`,
      recommendation:
        'Próxima revisão deve focar nas findings críticas mais antigas. Métrica de sucesso: redução do tempo médio de resolução das críticas em 20%.',
    });
    return {
      ok: true,
      message: `Prioridades rebalanceadas (learning ${learning.id}, ${learning.occurrences} ciclos)`,
      rollbackHash: `priorities:${learning.id}`,
    };
  },
  'mark-finding-resolved': async (agent, payload) => {
    const findingId = String(payload.findingId ?? '');
    if (!findingId) return { ok: false, message: 'findingId obrigatório' };
    // The agent only marks SAFE-class findings — clinical findings are blocked
    // earlier by canExecuteAutonomously. We persist the resolution via the
    // cron-store so the /cron dashboard reflects it immediately.
    const updated = updateFinding(findingId, { status: 'resolved-auto' }, agent.id);
    if (!updated) return { ok: false, message: `Finding ${findingId} não encontrado` };
    return {
      ok: true,
      message: `Finding ${findingId} marcado como resolved-auto`,
      rollbackHash: `finding:${findingId}:resolved-auto`,
    };
  },
  'flag-flaky-endpoint': async (agent, payload) => {
    const endpoint = String(payload.endpoint ?? '');
    if (!endpoint) return { ok: false, message: 'endpoint obrigatório' };
    // Two-store write: a low-severity finding so /cron shows it, and a
    // learning so repeat flakiness against the same endpoint accumulates
    // (occurrences counter, used by the curator to propose escalation).
    const finding = createFinding({
      jobId: agent.ownedJobIds[0] ?? `agent:${agent.id}`,
      runId: `flag-flaky:${Date.now()}`,
      severity: 'low',
      surface: 'backend.api',
      target: endpoint,
      message: `Endpoint flaky detectado: ${endpoint}`,
      details: { detectedBy: agent.id, payload },
    });
    const learning = recordLearning({
      patternId: `flaky-endpoint:${endpoint}`,
      observation: `Endpoint ${endpoint} apresentou comportamento intermitente`,
      recommendation:
        'Verificar latência P95, restarts do pod servidor e logs do upstream. Se >5 ocorrências em 24h, escalar como crítico.',
    });
    return {
      ok: true,
      message: `Endpoint ${endpoint} flagged (finding ${finding.id}, learning ${learning.occurrences}x)`,
      rollbackHash: `flaky:${finding.id}`,
    };
  },

  // ---- UX office ----
  'suggest-link-to': async (agent, payload) => {
    // This handler RECORDS the suggestion as both a finding (so /cron shows
    // it) and a learning (so repeat suggestions for the same field bump
    // confidence). It NEVER edits the manifest — that's a critical action.
    const moduleId = String(payload.moduleId ?? '');
    const columnKey = String(payload.columnKey ?? '');
    if (!moduleId || !columnKey)
      return { ok: false, message: 'moduleId e columnKey são obrigatórios' };
    const target = `${moduleId}.${columnKey}`;
    const finding = createFinding({
      jobId: agent.ownedJobIds[0] ?? `agent:${agent.id}`,
      runId: `suggest-link:${Date.now()}`,
      severity: 'low',
      surface: 'compliance.field-link',
      target,
      message: `Sugestão de linkTo para ${target}`,
      details: { moduleId, columnKey, suggestedBy: agent.id, payload },
    });
    const learning = recordLearning({
      patternId: `link-policy:${target}`,
      observation: `Coluna ${target} sem linkTo no module-manifest`,
      recommendation: `Adicionar linkTo ao manifest para tornar ${columnKey} clicável e direcionar ao módulo correspondente.`,
    });
    return {
      ok: true,
      message: `Sugestão de linkTo para ${target} (finding ${finding.id}, ${learning.occurrences}x visto)`,
      rollbackHash: `suggestion:${finding.id}`,
    };
  },

  // ---- Learning office ----
  'increment-pattern-confidence': async (agent, payload) => {
    const patternId = String(payload.patternId ?? '');
    if (!patternId) return { ok: false, message: 'patternId obrigatório' };
    // recordLearning has built-in dedup: same patternId increments occurrences
    // and updates lastSeenAt. Confidence is derived at read-time as
    // occurrences / (1 + recentResolved) by the curator.
    const observation = String(
      payload.observation ?? `Padrão ${patternId} observado por ${agent.id}`,
    );
    const recommendation = String(
      payload.recommendation ?? `Acompanhar evolução do padrão ${patternId}.`,
    );
    const learning = recordLearning({ patternId, observation, recommendation });
    return {
      ok: true,
      message: `Padrão ${patternId} agora com ${learning.occurrences} ocorrência(s)`,
      rollbackHash: `pattern:${learning.id}`,
    };
  },

  // ---- Observability office ----
  'quarantine-agent': async (agent, payload) => {
    const targetId = String(payload.targetId ?? '');
    if (!targetId) return { ok: false, message: 'targetId obrigatório' };
    // Watchdog cannot quarantine itself — that would be a self-blessing path.
    if (targetId === agent.id) {
      return { ok: false, message: 'Watchdog não pode se auto-quarentenar' };
    }
    const reason = String(payload.reason ?? 'auto-quarantine via watchdog');
    const result = quarantineAgentState(targetId, reason, agent.id);
    if (!result.ok) {
      return { ok: false, message: result.error ?? 'falha ao quarentenar' };
    }
    return {
      ok: true,
      message: `Agente ${targetId} colocado em quarentena: ${reason}`,
      rollbackHash: `quarantine:${targetId}`,
    };
  },
  'page-on-call': async (agent, payload) => {
    const message = String(payload.message ?? 'finding crítico');
    // Persists the page in the dedicated oncall-store (immutable evidence,
    // queryable by the /agents dashboard) AND emits an audit entry. The
    // actual K8s alertmanager bridge consumes the audit log downstream.
    const severityRaw = String(payload.severity ?? 'warning');
    const severity = (
      ['info', 'warning', 'critical'].includes(severityRaw) ? severityRaw : 'warning'
    ) as 'info' | 'warning' | 'critical';
    const page = raiseOnCallPage({
      triggeredBy: agent.id,
      message,
      severity,
      context: payload as Record<string, unknown>,
    });
    return {
      ok: true,
      message: `On-call paged (${severity}): ${page.id}`,
      rollbackHash: `page:${page.id}`,
    };
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
  'log-security-finding': async (agent, payload) => {
    const detail = String(payload.detail ?? '');
    if (!detail) return { ok: false, message: 'detail obrigatório' };
    // Severity from payload (default high — security findings are not low).
    const severityRaw = String(payload.severity ?? 'high');
    const severity = (
      ['info', 'low', 'medium', 'high', 'critical'].includes(severityRaw) ? severityRaw : 'high'
    ) as Severity;
    const surfaceRaw = String(payload.surface ?? 'security.headers');
    const surface = surfaceRaw as Surface;
    const finding = createFinding({
      jobId: agent.ownedJobIds[0] ?? `agent:${agent.id}`,
      runId: `sec-finding:${Date.now()}`,
      severity,
      surface,
      target: String(payload.target ?? agent.id),
      message: detail,
      details: { loggedBy: agent.id, payload },
    });
    return {
      ok: true,
      message: `Finding de segurança ${finding.id} (${severity}) registrado`,
      rollbackHash: `sec-log:${finding.id}`,
    };
  },
  'flag-orphaned-record': async (agent, payload) => {
    const recordId = String(payload.recordId ?? '');
    if (!recordId) return { ok: false, message: 'recordId obrigatório' };
    const moduleId = String(payload.moduleId ?? 'unknown');
    // Medium severity because referential drift is more than cosmetic but
    // less than critical (no PHI corruption — just an orphaned reference).
    const finding = createFinding({
      jobId: agent.ownedJobIds[0] ?? `agent:${agent.id}`,
      runId: `flag-orphan:${Date.now()}`,
      severity: 'medium',
      surface: 'data.referential',
      target: `${moduleId}:${recordId}`,
      message: `Registro órfão detectado em ${moduleId}: ${recordId}`,
      details: { moduleId, recordId, detectedBy: agent.id, payload },
    });
    return {
      ok: true,
      message: `Registro órfão ${recordId} flagged (finding ${finding.id})`,
      rollbackHash: `orphan:${finding.id}`,
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
