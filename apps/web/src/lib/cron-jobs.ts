/**
 * Cron job registry — all surfaces (frontend, backend, infra, data, functions).
 *
 * Each job has:
 *   - id: stable slug
 *   - label: PT-BR display name
 *   - surface: the layer it scans
 *   - intervalMs: how often the in-process scheduler should run it (when no
 *                 K8s CronJob is active for the same id)
 *   - cron: the equivalent crontab spec for the K8s manifest
 *   - description: what it does
 *   - severity: the worst severity it can produce
 *
 * The handler function lives in `cron-runners.ts` and is matched by id.
 *
 * IMPORTANT: every job runs in SHADOW MODE by default. Findings are
 * recorded but no remediation is applied automatically. The agent loop
 * (lib/agent-loop.ts) reads the findings and produces recommendations
 * via /api/ai/chat. A human must promote a finding via /cron to apply
 * a remediation. This satisfies .claude/rules/agents.md and ai-safety.md.
 */

import type { Severity, Surface } from './cron-store';

export interface CronJobDef {
  id: string;
  label: string;
  description: string;
  surface: Surface;
  /** In-process scheduler interval (ms). Use null to disable in-process scheduling. */
  intervalMs: number | null;
  /** K8s crontab spec (mirrored in infra/kubernetes/bootstrap/velya-agent-cronjobs.yaml) */
  cron: string;
  worstSeverity: Severity;
  /** True if this job is allowed to "auto-correct" safe issues. Always FALSE for clinical/financial scopes. */
  autoCorrectAllowed: boolean;
}

export const CRON_JOBS: CronJobDef[] = [
  // ========== FRONTEND ==========
  {
    id: 'frontend.route-health',
    label: 'Saúde de rotas frontend',
    description:
      'Pinga toda rota declarada no module-manifest e em rotas custom (/me, /handoffs, /delegations, /specialties, /wards, /tools/sepsis, /inbox, /search) e reporta status diferente de 200.',
    surface: 'frontend.route',
    intervalMs: 15 * 60 * 1000,
    cron: '*/15 * * * *',
    worstSeverity: 'high',
    autoCorrectAllowed: false,
  },
  {
    id: 'frontend.component-imports',
    label: 'Imports de componentes',
    description:
      'Lista todos os arquivos em src/app/components/ e verifica se cada export nomeado é importado pelo menos uma vez. Componentes mortos viram findings de severidade baixa (limpeza).',
    surface: 'frontend.component',
    intervalMs: 60 * 60 * 1000,
    cron: '0 * * * *',
    worstSeverity: 'low',
    autoCorrectAllowed: false,
  },
  {
    id: 'frontend.field-link-policy',
    label: 'Política de campos clicáveis',
    description:
      'Verifica se toda coluna do module-manifest cujo nome termina em Mrn, Id, Ref, employeeId, supplierId, assetId, claimId etc tem `linkTo` apontando para a entidade certa. Findings de severidade média.',
    surface: 'compliance.field-link',
    intervalMs: 30 * 60 * 1000,
    cron: '*/30 * * * *',
    worstSeverity: 'medium',
    autoCorrectAllowed: false,
  },

  // ========== BACKEND ==========
  {
    id: 'backend.api-contract',
    label: 'Contrato de APIs',
    description:
      'Pinga GET de toda /api/* registrada (com sessão de service account) e valida que devolve JSON parseável + status code esperado. Reporta endpoints quebrados.',
    surface: 'backend.api',
    intervalMs: 10 * 60 * 1000,
    cron: '*/10 * * * *',
    worstSeverity: 'critical',
    autoCorrectAllowed: false,
  },
  {
    id: 'backend.audit-chain',
    label: 'Integridade da hash chain de auditoria',
    description:
      'Lê o arquivo de auditoria do dia atual e do dia anterior, recomputa o SHA-256 de cada linha e compara com previousHash da próxima. Quebra na chain = finding crítico.',
    surface: 'backend.audit-chain',
    intervalMs: 5 * 60 * 1000,
    cron: '*/5 * * * *',
    worstSeverity: 'critical',
    autoCorrectAllowed: false,
  },
  {
    id: 'backend.session-store',
    label: 'Saúde do session store',
    description:
      'Lista os arquivos de sessão em /tmp/velya-sessions e remove os expirados (lastActivity > 30 min). Reporta sessões corrompidas (JSON inválido).',
    surface: 'backend.auth',
    intervalMs: 5 * 60 * 1000,
    cron: '*/5 * * * *',
    worstSeverity: 'medium',
    autoCorrectAllowed: true,
  },
  {
    id: 'backend.rate-limit-sanity',
    label: 'Sanidade do rate limiter',
    description:
      'Faz 70 requisições rápidas para /api/health e verifica que ≥ 1 retorna 429 (gate de 60 req/min está ativo). Falha = config drift.',
    surface: 'security.rate-limit',
    intervalMs: 60 * 60 * 1000,
    cron: '0 * * * *',
    worstSeverity: 'high',
    autoCorrectAllowed: false,
  },

  // ========== DADOS / FIXTURES ==========
  {
    id: 'data.referential-integrity',
    label: 'Integridade referencial de fixtures',
    description:
      'Para todo campo patientMrn em prescriptions/lab-orders/imaging-orders/charges/etc, verifica se o MRN existe em PATIENTS. Para employeeId, asset, supplier idem.',
    surface: 'data.referential',
    intervalMs: 30 * 60 * 1000,
    cron: '*/30 * * * *',
    worstSeverity: 'high',
    autoCorrectAllowed: false,
  },
  {
    id: 'data.duplication-scan',
    label: 'Detecção de duplicações',
    description:
      'Replica o duplication-gate (URLs externas + MRN literais + títulos page-title) sobre o código-fonte e reporta findings.',
    surface: 'data.duplication',
    intervalMs: 60 * 60 * 1000,
    cron: '0 * * * *',
    worstSeverity: 'medium',
    autoCorrectAllowed: false,
  },
  {
    id: 'data.fixture-completeness',
    label: 'Completude de campos obrigatórios',
    description:
      'Para cada fixture, verifica se todos os campos marcados required: true no manifest têm valor. Findings de severidade média.',
    surface: 'data.fixture',
    intervalMs: 60 * 60 * 1000,
    cron: '0 * * * *',
    worstSeverity: 'medium',
    autoCorrectAllowed: false,
  },
  {
    id: 'data.stale-records',
    label: 'Detecção de registros parados',
    description:
      'Encontra registros do entity-store que não foram atualizados em > 30 dias E ainda têm status open/in-progress. Sugere encerramento ou reatribuição.',
    surface: 'data.fixture',
    intervalMs: 24 * 60 * 60 * 1000,
    cron: '0 6 * * *',
    worstSeverity: 'low',
    autoCorrectAllowed: false,
  },

  // ========== INFRA ==========
  {
    id: 'infra.k8s-pod-health',
    label: 'Saúde dos pods Kubernetes',
    description:
      'Lê o /api/health (interno) que reporta restart count e ready state do pod. Restart > 3 nos últimos 30 min = finding alto.',
    surface: 'infra.k8s',
    intervalMs: 5 * 60 * 1000,
    cron: '*/5 * * * *',
    worstSeverity: 'high',
    autoCorrectAllowed: false,
  },
  {
    id: 'infra.disk-usage',
    label: 'Uso de disco PVC',
    description:
      'Reporta uso dos PVCs /data/velya-* (audit, events, users, delegations, handoffs, entities, favorites, following, cron). > 80% = finding alto.',
    surface: 'infra.disk',
    intervalMs: 60 * 60 * 1000,
    cron: '0 * * * *',
    worstSeverity: 'high',
    autoCorrectAllowed: false,
  },
  {
    id: 'infra.tls-cert-expiry',
    label: 'Validade do certificado TLS',
    description:
      'Lê a validade do certificado servindo velyahospitalar.com via cert-manager. < 14 dias = finding alto. < 7 dias = crítico.',
    surface: 'infra.tls',
    intervalMs: 24 * 60 * 60 * 1000,
    cron: '0 7 * * *',
    worstSeverity: 'critical',
    autoCorrectAllowed: false,
  },

  // ========== SECURITY ==========
  {
    id: 'security.headers-check',
    label: 'Headers de segurança',
    description:
      'Pinga / e verifica se Content-Security-Policy, Strict-Transport-Security, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy estão presentes na resposta.',
    surface: 'security.headers',
    intervalMs: 30 * 60 * 1000,
    cron: '*/30 * * * *',
    worstSeverity: 'high',
    autoCorrectAllowed: false,
  },
  {
    id: 'security.permission-matrix',
    label: 'Matriz de permissões',
    description:
      'Cruza ROLE_DEFINITIONS de access-control.ts com AI_ROLE_POLICIES de ai-permissions.ts e reporta papéis sem capacidade ou capacidade sem papel mapeado.',
    surface: 'function.permission',
    intervalMs: 60 * 60 * 1000,
    cron: '0 * * * *',
    worstSeverity: 'medium',
    autoCorrectAllowed: false,
  },

  // ========== FUNCTION VALIDATIONS ==========
  {
    id: 'function.module-manifest-consistency',
    label: 'Consistência do module-manifest',
    description:
      'Para cada módulo do MODULES, verifica: route único, fixturePath aponta para arquivo existente, fixtureExport existe no fixture, allowedRoles tem ao menos 1 valor, columns tem ao menos 1 entry.',
    surface: 'function.role-mapping',
    intervalMs: 60 * 60 * 1000,
    cron: '0 * * * *',
    worstSeverity: 'high',
    autoCorrectAllowed: false,
  },
  {
    id: 'function.fixture-registry-coverage',
    label: 'Cobertura do FIXTURE_REGISTRY',
    description:
      'Verifica que todo módulo declarado em MODULES tem entrada no FIXTURE_REGISTRY do entity-resolver e vice-versa.',
    surface: 'function.role-mapping',
    intervalMs: 60 * 60 * 1000,
    cron: '0 * * * *',
    worstSeverity: 'high',
    autoCorrectAllowed: false,
  },

  // ========== ACCESSIBILITY ==========
  {
    id: 'compliance.contrast-spotcheck',
    label: 'Contraste WCAG (spot check)',
    description:
      'Repete uma verificação rápida de contraste em uma rota aleatória entre as 23 listadas. Resultado completo é via audit-contrast-all-pages.ts no CI; este job é um canary contínuo em runtime.',
    surface: 'compliance.contrast',
    intervalMs: 6 * 60 * 60 * 1000,
    cron: '0 */6 * * *',
    worstSeverity: 'medium',
    autoCorrectAllowed: false,
  },
];

export function getJobDef(id: string): CronJobDef | undefined {
  return CRON_JOBS.find((j) => j.id === id);
}
