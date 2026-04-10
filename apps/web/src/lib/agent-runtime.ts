/**
 * Multi-agent runtime — typed registry of every operational agent in Velya.
 *
 * This module is the SOURCE OF TRUTH for which agents exist, what they do,
 * who validates them, what their lifecycle stage is, and how they fail safe.
 * Each entry is enforced at runtime by `lib/agent-watchdog.ts` and surfaced
 * in `/agents` for human inspection.
 *
 * Compliance contracts (.claude/rules/agents.md + agent-governance.md):
 *   - Every agent has a charter, validators, auditor, lifecycle stage, KPIs.
 *   - No agent enters `active` without completing `shadow` mode.
 *   - No agent can modify its own scope, validators, or thresholds.
 *   - No agent can take clinical / financial / production-infra action
 *     without a human in the loop. The runtime enforces this by refusing
 *     to call `executeSafeAction` for any agent whose actions touch
 *     restricted scopes — those always go to the recommendation queue.
 *   - Kill switches are env-var driven so they can be triggered without
 *     a deploy: `VELYA_AGENT_<UPPER_ID>_DISABLED=1`.
 */

import type { Severity } from './cron-store';

export type LifecycleStage =
  | 'draft'
  | 'sandbox'
  | 'shadow'
  | 'probation'
  | 'active'
  | 'deprecated'
  | 'retired';

export type AgentOffice = 'quality' | 'security' | 'data' | 'ux' | 'learning' | 'observability';

export type AgentRole =
  | 'manager'
  | 'doctor' // fixes things
  | 'mapper' // discovers + indexes
  | 'auditor' // validates a doctor
  | 'watchdog' // monitors an office
  | 'curator'; // tends learnings

/**
 * Risk classes used to gate auto-correct. Only `safe` runs without review.
 *   safe        — non-clinical, non-financial, fully reversible (cache, rotation)
 *   review      — non-clinical but visible to users (UI labels, link fixes)
 *   critical    — touches PHI, billing, infra-prod, audit chain → ALWAYS human
 */
export type ActionRiskClass = 'safe' | 'review' | 'critical';

export interface AgentScorecard {
  validationPassRate: number; // 0..1
  auditPassRate: number; // 0..1
  evidenceCompleteness: number; // 0..1
  slaAdherence: number; // 0..1
  correctionRecurrence: number; // 0..1 — lower is better
  /** Last calculation timestamp */
  updatedAt: string;
}

export interface AgentDef {
  id: string;
  /** Conform to .claude/rules/naming.md: `{office}-{role}-agent` */
  fullName: string;
  office: AgentOffice;
  role: AgentRole;
  /** Plain PT-BR mission statement */
  charter: string;
  /** Cron job ids this agent owns (matches CRON_JOBS in cron-jobs.ts) */
  ownedJobIds: string[];
  /** Action types this agent CAN take if action is in its riskClass */
  allowedActions: { type: string; riskClass: ActionRiskClass }[];
  /** Lifecycle stage — only `safe`-class actions execute auto in `active` */
  lifecycleStage: LifecycleStage;
  /** Validators that review the agent's outputs (ids of other agents) */
  validatorIds: string[];
  /** Independent auditor (cannot be the same as a validator) */
  auditorId: string;
  /** Watchdog that monitors this agent's office */
  watchdogId: string;
  /** Owner email (human accountable for behavior) */
  ownerEmail: string;
  /** Worst severity this agent can produce */
  worstSeverity: Severity;
  /** Kill-switch env var. The runtime checks this before every execution. */
  killSwitchEnv: string;
}

const OWNER = 'lucaslima4132@gmail.com';

// ---------------------------------------------------------------------------
// Agent registry
// ---------------------------------------------------------------------------
//
// 8 agents organized into 5 offices. The id pattern is enforced by naming
// rules: `{office}-{role}-agent` (kebab-case throughout). Validators always
// reference an agent in a DIFFERENT office to avoid self-blessing.
//
// All agents start at `shadow` stage. Promotion to `active` is a separate
// admin-gated step performed via /agents UI; it persists in agent-state.json.
// ---------------------------------------------------------------------------

export const AGENTS: AgentDef[] = [
  // ========== QUALITY OFFICE ==========
  {
    id: 'quality-manager-agent',
    fullName: 'quality-manager-agent',
    office: 'quality',
    role: 'manager',
    charter:
      'Coordena os doctors de qualidade (route, api, fixture). Lê findings recentes, prioriza por severidade × frequência e despacha ações safe automaticamente; eleva tudo o resto para o /cron.',
    ownedJobIds: [],
    allowedActions: [
      { type: 'rebalance-priorities', riskClass: 'safe' },
      { type: 'mark-finding-resolved', riskClass: 'safe' },
    ],
    lifecycleStage: 'shadow',
    validatorIds: ['security-auditor-agent', 'data-auditor-agent'],
    auditorId: 'observability-watchdog-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'medium',
    killSwitchEnv: 'VELYA_AGENT_QUALITY_MANAGER_DISABLED',
  },
  {
    id: 'quality-route-doctor-agent',
    fullName: 'quality-route-doctor-agent',
    office: 'quality',
    role: 'doctor',
    charter:
      'Pinga as rotas frontend, detecta 4xx/5xx, e — quando o erro é claramente transient (1 falha em 3 retries) — invalida cache CDN. 5xx persistente vira finding crítico para humano.',
    ownedJobIds: ['frontend.route-health'],
    allowedActions: [
      { type: 'invalidate-cdn-cache', riskClass: 'safe' },
      { type: 'restart-pod', riskClass: 'critical' }, // touches infra-prod
    ],
    lifecycleStage: 'shadow',
    validatorIds: ['security-auditor-agent'],
    auditorId: 'observability-watchdog-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'critical',
    killSwitchEnv: 'VELYA_AGENT_QUALITY_ROUTE_DOCTOR_DISABLED',
  },
  {
    id: 'quality-api-doctor-agent',
    fullName: 'quality-api-doctor-agent',
    office: 'quality',
    role: 'doctor',
    charter:
      'Verifica contrato das /api/* (status code esperado, JSON parseável). Para falhas transientes, marca o endpoint como flaky e abre learning; falhas persistentes viram finding alto.',
    ownedJobIds: ['backend.api-contract'],
    allowedActions: [{ type: 'flag-flaky-endpoint', riskClass: 'safe' }],
    lifecycleStage: 'shadow',
    validatorIds: ['security-auditor-agent'],
    auditorId: 'observability-watchdog-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'critical',
    killSwitchEnv: 'VELYA_AGENT_QUALITY_API_DOCTOR_DISABLED',
  },

  // ========== DATA OFFICE ==========
  {
    id: 'data-integrity-doctor-agent',
    fullName: 'data-integrity-doctor-agent',
    office: 'data',
    role: 'doctor',
    charter:
      'Garante integridade referencial das fixtures (patientMrn, employeeId, etc.). Não corrige PHI automaticamente — apenas marca registros órfãos para revisão clínica.',
    ownedJobIds: ['data.referential-integrity', 'data.fixture-completeness'],
    allowedActions: [
      { type: 'flag-orphaned-record', riskClass: 'review' },
      // patient/clinical edits NEVER auto — they are critical
      { type: 'fix-patient-reference', riskClass: 'critical' },
    ],
    lifecycleStage: 'shadow',
    validatorIds: ['quality-manager-agent', 'security-auditor-agent'],
    auditorId: 'data-auditor-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'high',
    killSwitchEnv: 'VELYA_AGENT_DATA_INTEGRITY_DOCTOR_DISABLED',
  },
  {
    id: 'data-auditor-agent',
    fullName: 'data-auditor-agent',
    office: 'data',
    role: 'auditor',
    charter:
      'Auditor independente do data office. Verifica que toda ação tomada pelo data-integrity-doctor tem evidência completa, traceId e foi confirmada por um validator antes de executar.',
    ownedJobIds: [],
    allowedActions: [{ type: 'reject-action-no-evidence', riskClass: 'safe' }],
    lifecycleStage: 'shadow',
    validatorIds: ['security-auditor-agent'],
    auditorId: 'observability-watchdog-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'medium',
    killSwitchEnv: 'VELYA_AGENT_DATA_AUDITOR_DISABLED',
  },

  // ========== SECURITY OFFICE ==========
  {
    id: 'security-hardener-doctor-agent',
    fullName: 'security-hardener-doctor-agent',
    office: 'security',
    role: 'doctor',
    charter:
      'Verifica headers de segurança, sanidade do rate limiter, cobertura da matriz de permissões. Não modifica middleware automaticamente — qualquer mudança em policy é classe critical.',
    ownedJobIds: [
      'security.headers-check',
      'security.permission-matrix',
      'backend.rate-limit-sanity',
    ],
    allowedActions: [
      { type: 'log-security-finding', riskClass: 'safe' },
      { type: 'modify-middleware', riskClass: 'critical' },
    ],
    lifecycleStage: 'shadow',
    validatorIds: ['quality-manager-agent', 'data-auditor-agent'],
    auditorId: 'security-auditor-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'critical',
    killSwitchEnv: 'VELYA_AGENT_SECURITY_HARDENER_DISABLED',
  },
  {
    id: 'security-auditor-agent',
    fullName: 'security-auditor-agent',
    office: 'security',
    role: 'auditor',
    charter:
      'Auditor independente do security office. Garante que toda ação proposta pelos doctors tem revisor humano para classes review/critical e que kill-switches funcionam.',
    ownedJobIds: [],
    allowedActions: [{ type: 'block-unsafe-action', riskClass: 'safe' }],
    lifecycleStage: 'shadow',
    validatorIds: ['quality-manager-agent'],
    auditorId: 'observability-watchdog-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'critical',
    killSwitchEnv: 'VELYA_AGENT_SECURITY_AUDITOR_DISABLED',
  },

  // ========== UX OFFICE ==========
  {
    id: 'ux-mapper-agent',
    fullName: 'ux-mapper-agent',
    office: 'ux',
    role: 'mapper',
    charter:
      'Escaneia o module-manifest e detecta colunas de referência sem linkTo, módulos sem novo route, breadcrumbs faltando. Auto-corrige apenas labels visíveis (review class).',
    ownedJobIds: ['frontend.field-link-policy', 'function.module-manifest-consistency'],
    allowedActions: [
      { type: 'suggest-link-to', riskClass: 'safe' },
      { type: 'rename-column-label', riskClass: 'review' },
    ],
    lifecycleStage: 'shadow',
    validatorIds: ['quality-manager-agent'],
    auditorId: 'data-auditor-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'medium',
    killSwitchEnv: 'VELYA_AGENT_UX_MAPPER_DISABLED',
  },

  // ========== LEARNING OFFICE ==========
  {
    id: 'learning-curator-agent',
    fullName: 'learning-curator-agent',
    office: 'learning',
    role: 'curator',
    charter:
      'Lê o store de findings históricos, agrupa por padrão, e quando o mesmo padrão aparece N vezes propõe (não aplica) elevar a confidence do classificador. Promoções de stage exigem admin.',
    ownedJobIds: [],
    allowedActions: [
      { type: 'increment-pattern-confidence', riskClass: 'safe' },
      { type: 'propose-promotion', riskClass: 'review' },
    ],
    lifecycleStage: 'shadow',
    validatorIds: ['security-auditor-agent', 'data-auditor-agent'],
    auditorId: 'observability-watchdog-agent',
    watchdogId: 'observability-watchdog-agent',
    ownerEmail: OWNER,
    worstSeverity: 'low',
    killSwitchEnv: 'VELYA_AGENT_LEARNING_CURATOR_DISABLED',
  },

  // ========== OBSERVABILITY OFFICE ==========
  {
    id: 'observability-watchdog-agent',
    fullName: 'observability-watchdog-agent',
    office: 'observability',
    role: 'watchdog',
    charter:
      'Monitor de toda a malha. Detecta agente silencioso (>30 min sem run), correção em loop (>3 ciclos), scorecard caindo no vermelho. Pode disparar quarentena automática.',
    ownedJobIds: [],
    allowedActions: [
      { type: 'quarantine-agent', riskClass: 'safe' },
      { type: 'page-on-call', riskClass: 'safe' },
    ],
    lifecycleStage: 'shadow',
    // The root watchdog is independently validated by security-auditor-agent
    // (different office). It is NEVER its own validator/auditor/watchdog —
    // .claude/rules/agent-governance.md forbids self-blessing.
    validatorIds: ['security-auditor-agent', 'data-auditor-agent'],
    auditorId: 'security-auditor-agent',
    watchdogId: 'security-auditor-agent',
    ownerEmail: OWNER,
    worstSeverity: 'critical',
    killSwitchEnv: 'VELYA_AGENT_OBSERVABILITY_WATCHDOG_DISABLED',
  },
];

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export function getAgent(id: string): AgentDef | undefined {
  return AGENTS.find((a) => a.id === id);
}

export function getAgentsByOffice(office: AgentOffice): AgentDef[] {
  return AGENTS.filter((a) => a.office === office);
}

export function getAgentsForJob(jobId: string): AgentDef[] {
  return AGENTS.filter((a) => a.ownedJobIds.includes(jobId));
}

/**
 * True if the agent is allowed to execute autonomously right now. Three
 * gates: kill-switch env var, lifecycle stage, action risk class.
 */
export function canExecuteAutonomously(
  agent: AgentDef,
  actionType: string,
): { allowed: boolean; reason?: string } {
  if (process.env[agent.killSwitchEnv] === '1') {
    return { allowed: false, reason: `kill switch ${agent.killSwitchEnv} ativo` };
  }
  if (agent.lifecycleStage !== 'active') {
    return { allowed: false, reason: `agente em stage ${agent.lifecycleStage}` };
  }
  const action = agent.allowedActions.find((a) => a.type === actionType);
  if (!action) {
    return { allowed: false, reason: `ação ${actionType} não declarada` };
  }
  if (action.riskClass !== 'safe') {
    return {
      allowed: false,
      reason: `ação é classe ${action.riskClass} — exige humano (.claude/rules/agents.md)`,
    };
  }
  return { allowed: true };
}

/**
 * Topology view of the agent network — used by the /agents page to render
 * the office layout and validation chain.
 */
export interface OfficeTopology {
  office: AgentOffice;
  manager?: AgentDef;
  agents: AgentDef[];
  /** Total cron jobs covered by this office's agents */
  jobCoverage: number;
}

export function buildTopology(): OfficeTopology[] {
  const offices: AgentOffice[] = ['quality', 'security', 'data', 'ux', 'learning', 'observability'];
  return offices.map((office) => {
    const agents = getAgentsByOffice(office);
    return {
      office,
      manager: agents.find((a) => a.role === 'manager'),
      agents,
      jobCoverage: agents.reduce((acc, a) => acc + a.ownedJobIds.length, 0),
    };
  });
}

export const OFFICE_LABELS: Record<AgentOffice, string> = {
  quality: 'Qualidade',
  security: 'Segurança',
  data: 'Dados',
  ux: 'Experiência',
  learning: 'Aprendizado',
  observability: 'Observabilidade',
};

export const STAGE_LABELS: Record<LifecycleStage, string> = {
  draft: 'Rascunho',
  sandbox: 'Sandbox',
  shadow: 'Shadow',
  probation: 'Probação',
  active: 'Ativo',
  deprecated: 'Depreciado',
  retired: 'Aposentado',
};
