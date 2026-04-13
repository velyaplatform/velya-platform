/**
 * Autonomous agent loop — SHADOW MODE only.
 *
 * Reads the unresolved findings from cron-store, classifies them, and
 * generates a structured recommendation for each. The recommendation is
 * stored on the finding via updateFinding(). A human reviews via /cron
 * and decides to dismiss or "promote" (apply the suggested action).
 *
 * Safety constraints (per .claude/rules/agents.md and ai-safety.md):
 *   - SHADOW MODE is mandatory before any agent enters active stage.
 *   - No autonomous clinical action (anything tagged "clinical" is
 *     blocked from auto-apply).
 *   - Every recommendation is audit-logged.
 *   - The agent NEVER modifies clinical, financial, or PHI data.
 *   - The agent has a kill switch via env var VELYA_AGENT_LOOP_DISABLED.
 *
 * The agent uses a rule-based classifier first (deterministic and free)
 * and falls back to /api/ai/chat (with capability ai.chat-administrative)
 * only when the finding doesn't match a known pattern.
 */

import { getJobDef, type CronJobDef } from './cron-jobs';
import {
  listFindings,
  recordLearning,
  updateFinding,
  type CronFinding,
  type Severity,
} from './cron-store';

const KILL_SWITCH = process.env.VELYA_AGENT_LOOP_DISABLED === 'true';

/** Max findings fetched when processing a single cron run (per-run mode). */
const MAX_FINDINGS_PER_RUN = 200;
/** Max findings fetched in catch-up mode (all surfaces, no runId filter). */
const MAX_FINDINGS_CATCHUP = 500;

interface Recommendation {
  /** Markdown-friendly summary in PT-BR */
  text: string;
  /** Whether the agent thinks this is safe to auto-correct in active mode */
  safeToAutoCorrect: boolean;
  /** Action verb the agent would take */
  actionType: string;
  /** Pattern id used for the learnings store (so repeated findings get higher confidence) */
  patternId: string;
}

/**
 * Rule-based classifier mapping (jobId, surface, severity) to a
 * deterministic recommendation. Covers ~80% of common findings without
 * needing an LLM call.
 */
function classify(finding: CronFinding, _job: CronJobDef): Recommendation | null {
  const surface = finding.surface;
  const sev = finding.severity;

  // Frontend route 4xx/5xx
  if (surface === 'frontend.route') {
    return {
      text: `A rota ${finding.target} está retornando erro. Verifique o último deploy via /system, o log do pod via kubectl logs e a página /audit para mudanças recentes em layout.tsx ou middleware.ts. Se o problema for transiente, o pod-restart resolve; se persistente, abra ticket no /quality/incidents.`,
      safeToAutoCorrect: false,
      actionType: 'investigate-route',
      patternId: `frontend.route:${finding.target}`,
    };
  }

  // Backend API contract failure
  if (surface === 'backend.api') {
    return {
      text: `O endpoint ${finding.target} retornou status inesperado. Verifique se há um deploy pendente, se o handler tem try/catch adequado e se o session middleware está consistente. Considere adicionar este endpoint à lista de smoke-tests do CI.`,
      safeToAutoCorrect: false,
      actionType: 'investigate-api',
      patternId: `backend.api:${finding.target}`,
    };
  }

  // Audit chain breakage — never auto-correct, escalate
  if (surface === 'backend.audit-chain') {
    return {
      text: `Quebra na hash chain de auditoria detectada. Esta é uma violação do compliance SBIS NGS2 e pode invalidar a integridade do log. NÃO APLIQUE qualquer correção automática. Acionar Red Team Office imediatamente, preservar o arquivo, abrir incidente SEV-1 em /quality/incidents.`,
      safeToAutoCorrect: false,
      actionType: 'escalate-incident',
      patternId: 'backend.audit-chain:break',
    };
  }

  // Referential integrity — orphan record
  if (surface === 'data.referential') {
    const refField = (finding.details?.field as string) ?? 'unknown';
    return {
      text: `Registro órfão: ${finding.message}. Recomendação: investigar se o ${refField} foi renomeado, se o paciente/funcionário foi removido sem cascata, ou se o registro deveria ser arquivado. Em modo ativo o agente flagaria o registro como "orphaned" e notificaria o owner do módulo.`,
      safeToAutoCorrect: false,
      actionType: 'flag-orphaned',
      patternId: `data.referential:${refField}`,
    };
  }

  // Field link policy
  if (surface === 'compliance.field-link') {
    const moduleId = (finding.details?.moduleId as string) ?? '?';
    const columnKey = (finding.details?.columnKey as string) ?? '?';
    return {
      text: `Coluna ${moduleId}.${columnKey} parece referência mas não tem linkTo configurado. Adicione no module-manifest: \`linkTo: '/<rota>/$\{row.${columnKey}}'\`. Em modo ativo o agente abriria PR com a alteração.`,
      safeToAutoCorrect: true,
      actionType: 'add-linkto-to-manifest',
      patternId: `compliance.field-link:${moduleId}:${columnKey}`,
    };
  }

  // Disk usage rotation candidates
  if (surface === 'infra.disk') {
    return {
      text: `${finding.target} está acumulando arquivos. Recomendação: criar CronJob de rotação que move arquivos > 30 dias para um bucket de arquivamento ou compacta em .tar.gz mensal. Em modo ativo, o agente moveria arquivos > 90 dias para /data/velya-archive automaticamente.`,
      safeToAutoCorrect: true,
      actionType: 'rotate-archive-old-files',
      patternId: `infra.disk:rotate:${finding.target}`,
    };
  }

  // Security headers missing
  if (surface === 'security.headers') {
    return {
      text: `Header de segurança ${finding.target} ausente em /. Verificar se middleware.ts está sendo executado (matcher correto) e se o build atual contém as últimas mudanças. Esta é uma regressão de segurança SEV-2.`,
      safeToAutoCorrect: false,
      actionType: 'investigate-middleware',
      patternId: `security.headers:${finding.target}`,
    };
  }

  // Rate limit drift
  if (surface === 'security.rate-limit') {
    return {
      text: `Sanidade do rate limiter falhou. Verificar se o middleware.ts foi modificado, se o token bucket está com capacidade incorreta, ou se o pod foi reiniciado (em-memory store é resetado). Considere migrar para Redis em produção.`,
      safeToAutoCorrect: false,
      actionType: 'investigate-rate-limit',
      patternId: 'security.rate-limit:drift',
    };
  }

  // Permission matrix mismatch
  if (surface === 'function.permission') {
    return {
      text: `Mismatch entre access-control.ts e ai-permissions.ts. Adicione o papel faltante em AI_ROLE_POLICIES com o conjunto mínimo de capacidades, ou remova-o de ROLE_DEFINITIONS se não é mais necessário. Esta é uma regressão de governança.`,
      safeToAutoCorrect: false,
      actionType: 'sync-permission-matrix',
      patternId: 'function.permission:mismatch',
    };
  }

  // Module manifest consistency
  if (surface === 'function.role-mapping') {
    return {
      text: `Manifesto inconsistente em ${finding.target}. Verifique route, columns, allowedRoles e fixturePath. Se o módulo foi removido, remova também a entrada em FIXTURE_REGISTRY do entity-resolver. Em modo ativo o agente criaria um stub de fixture vazio.`,
      safeToAutoCorrect: true,
      actionType: 'fix-manifest',
      patternId: `function.role-mapping:${finding.target}`,
    };
  }

  // Duplication (live data)
  if (surface === 'data.duplication') {
    return {
      text: `${finding.message}. Investigue se o id duplicado vem de um deploy recente que adicionou registros sem cuidado. O agente sugere inspecionar o entity-store em /data/velya-entities/${finding.target}.json e remover o duplicate via /api/entities/${finding.target}/<id> DELETE.`,
      safeToAutoCorrect: false,
      actionType: 'remove-duplicate',
      patternId: `data.duplication:${finding.target}`,
    };
  }

  // Severity-based fallback
  if (sev === 'critical' || sev === 'high') {
    return {
      text: `Achado de severidade ${sev} em ${surface}/${finding.target}. Não há padrão pré-mapeado — escalar para revisão humana. Em modo ativo o agente abriria automaticamente um incidente em /quality/incidents.`,
      safeToAutoCorrect: false,
      actionType: 'open-incident',
      patternId: `${surface}:${sev}`,
    };
  }

  return null;
}

/**
 * Process a single finding: classify, store recommendation, learn.
 */
async function processFinding(finding: CronFinding): Promise<void> {
  if (KILL_SWITCH) return;
  if (finding.status !== 'new') return; // already processed

  const job = getJobDef(finding.jobId);
  if (!job) return;

  const recommendation = classify(finding, job);

  if (recommendation) {
    updateFinding(
      finding.id,
      {
        suggestion: recommendation.text,
        status: 'shadow-recommendation-ready',
      },
      'agent-loop',
    );
    recordLearning({
      patternId: recommendation.patternId,
      observation: finding.message,
      recommendation: recommendation.text,
    });
    return;
  }

  // No deterministic match — leave as 'new' so the human sees it.
  // In a future iteration, the agent would call /api/ai/chat with capability
  // ai.chat-administrative to generate a free-form recommendation. We do NOT
  // do that here because the cron runs server-side without a user session;
  // the AI gateway requires an authenticated user for audit purposes. The
  // /cron page exposes a "Pedir sugestão à IA" button on each finding that
  // calls /api/ai/chat with the current user's session.
}

/**
 * Run the agent loop over all findings produced by a specific run.
 */
export async function runAgentLoopForRun(runId: string): Promise<{ processed: number }> {
  if (KILL_SWITCH) return { processed: 0 };
  const findings = listFindings({ status: 'new', limit: MAX_FINDINGS_PER_RUN }).filter((f) => f.runId === runId);
  for (const f of findings) {
    await processFinding(f);
  }
  return { processed: findings.length };
}

/**
 * Run the agent loop over ALL unresolved findings (catch-up mode).
 */
export async function runAgentLoopAll(): Promise<{ processed: number }> {
  if (KILL_SWITCH) return { processed: 0 };
  const findings = listFindings({ status: 'new', limit: MAX_FINDINGS_CATCHUP });
  for (const f of findings) {
    await processFinding(f);
  }
  return { processed: findings.length };
}

/** Returns true when the agent loop is disabled via VELYA_AGENT_LOOP_DISABLED env var. */
export function isAgentLoopDisabled(): boolean {
  return KILL_SWITCH;
}

/** Re-exported for the API endpoints */
export type { CronFinding, Severity };
