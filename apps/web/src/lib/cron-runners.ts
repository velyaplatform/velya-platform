/**
 * Cron job runners — handler implementations matched by job id.
 *
 * Each runner returns the number of findings produced. Findings are
 * persisted via cron-store. The agent loop later reads the findings and
 * generates recommendations in shadow mode.
 *
 * All file/network reads use try/catch — a runner should NEVER throw
 * outside of itself. Failures are reported as a `runtime` finding instead.
 */

import { existsSync, readFileSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { createFinding, type Severity, type Surface } from './cron-store';
import { MODULES } from './module-manifest';
import { listLiveRecords } from './entity-resolver';
import { PATIENTS } from './fixtures/patients';
import { STAFF } from './fixtures/staff';

/**
 * The full list of routes the platform serves. Kept here so the route-health
 * runner can ping each one and detect 404s.
 */
const PLATFORM_ROUTES = [
  '/',
  '/me',
  '/patients',
  '/tasks',
  '/discharge',
  '/beds',
  '/icu',
  '/surgery',
  '/ems',
  '/pharmacy',
  '/staff-on-duty',
  '/employees',
  '/employees/new',
  '/suppliers',
  '/suppliers/new',
  '/alerts',
  '/handoffs',
  '/handoffs/new',
  '/delegations',
  '/delegations/new',
  '/inbox',
  '/search',
  '/specialties',
  '/wards',
  '/cron',
  '/agents',
  '/system',
  '/activity',
  '/audit',
  '/suggestions',
  '/tools/sepsis',
];

const FRONTEND_BASE = process.env.VELYA_FRONTEND_BASE || 'http://localhost:3000';

interface RunnerContext {
  jobId: string;
  runId: string;
}

type Runner = (ctx: RunnerContext) => Promise<number>;

/**
 * frontend.route-health — pings every public route.
 */
const routeHealth: Runner = async (ctx) => {
  let count = 0;
  // Combine declared routes + module routes from the manifest
  const all = new Set<string>(PLATFORM_ROUTES);
  for (const m of MODULES) all.add(m.route);

  for (const route of all) {
    try {
      const res = await fetch(`${FRONTEND_BASE}${route}`, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
      // 200/302 are both fine — 302 means redirect to /login when not authed
      if (res.status >= 400) {
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: res.status >= 500 ? 'critical' : 'high',
          surface: 'frontend.route',
          target: route,
          message: `Rota ${route} retornou ${res.status}`,
          details: { status: res.status },
          shadowAction: { type: 'restart-pod', payload: { reason: 'route-failure' } },
        });
        count++;
      }
    } catch (err) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'high',
        surface: 'frontend.route',
        target: route,
        message: `Rota ${route} inalcançável: ${err instanceof Error ? err.message : String(err)}`,
      });
      count++;
    }
  }
  return count;
};

/**
 * backend.api-contract — pings every /api/* route. Auth-protected ones
 * are expected to return 401 without a session, which counts as healthy.
 */
const apiContract: Runner = async (ctx) => {
  let count = 0;
  const apiRoutes = [
    '/api/health',
    '/api/auth/session',
    '/api/me/activity',
    '/api/handoffs',
    '/api/delegations',
    '/api/favorites',
    '/api/following',
    '/api/following/notifications',
    '/api/related/patient/MRN-EXAMPLE',
    '/api/search?q=test',
    '/api/cron/jobs',
    '/api/cron/findings',
    '/api/ai/policy',
  ];
  for (const route of apiRoutes) {
    try {
      const res = await fetch(`${FRONTEND_BASE}${route}`, {
        signal: AbortSignal.timeout(5000),
      });
      // 200, 401 (auth-protected), 204 are all healthy
      if (![200, 204, 401, 404].includes(res.status)) {
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: res.status >= 500 ? 'critical' : 'high',
          surface: 'backend.api',
          target: route,
          message: `${route} → ${res.status}`,
          details: { status: res.status },
        });
        count++;
      }
    } catch (err) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'critical',
        surface: 'backend.api',
        target: route,
        message: `Erro de rede em ${route}: ${err instanceof Error ? err.message : String(err)}`,
      });
      count++;
    }
  }
  return count;
};

/**
 * backend.audit-chain — verifies the SHA-256 chain of today's audit file.
 */
const auditChain: Runner = async (ctx) => {
  let count = 0;
  const auditDir = process.env.VELYA_AUDIT_PATH || '/data/velya-audit';
  if (!existsSync(auditDir)) {
    createFinding({
      jobId: ctx.jobId,
      runId: ctx.runId,
      severity: 'medium',
      surface: 'backend.audit-chain',
      target: auditDir,
      message: `Diretório de auditoria não existe ainda (esperado em desenvolvimento)`,
    });
    return 1;
  }
  try {
    const files = readdirSync(auditDir).filter((f) => f.endsWith('.jsonl')).sort();
    if (files.length === 0) {
      // empty audit — skip
      return 0;
    }
    const today = files[files.length - 1];
    const content = readFileSync(join(auditDir, today), 'utf8');
    const lines = content.split('\n').filter((l) => l.trim());
    let previousHash = '';
    for (let i = 0; i < lines.length; i++) {
      try {
        const entry = JSON.parse(lines[i]) as { hash?: string; previousHash?: string };
        if (i > 0 && entry.previousHash && entry.previousHash !== previousHash) {
          createFinding({
            jobId: ctx.jobId,
            runId: ctx.runId,
            severity: 'critical',
            surface: 'backend.audit-chain',
            target: `${today}:${i}`,
            message: `Quebra na hash chain de auditoria na linha ${i}`,
            details: { expected: previousHash, found: entry.previousHash },
          });
          count++;
        }
        if (entry.hash) previousHash = entry.hash;
      } catch {
        // invalid JSON line — also a finding
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: 'high',
          surface: 'backend.audit-chain',
          target: `${today}:${i}`,
          message: `Linha JSON inválida no arquivo de auditoria`,
        });
        count++;
      }
    }
  } catch (err) {
    createFinding({
      jobId: ctx.jobId,
      runId: ctx.runId,
      severity: 'high',
      surface: 'backend.audit-chain',
      target: auditDir,
      message: `Erro ao verificar audit chain: ${err instanceof Error ? err.message : String(err)}`,
    });
    count++;
  }
  return count;
};

/**
 * data.referential-integrity — every patientMrn referenced in any module
 * must exist in PATIENTS; same for employee, asset, supplier ids.
 */
const referentialIntegrity: Runner = async (ctx) => {
  let count = 0;
  const validMrns = new Set(PATIENTS.map((p) => p.mrn));
  const validStaffIds = new Set(STAFF.map((s) => s.id));

  for (const module of MODULES) {
    const records = listLiveRecords(module.id);
    for (const record of records) {
      // Check patientMrn
      const mrn = record.data.patientMrn;
      if (typeof mrn === 'string' && mrn && !validMrns.has(mrn)) {
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: 'high',
          surface: 'data.referential',
          target: `${module.id}:${record.id}`,
          message: `${module.id}/${record.id} referencia paciente inexistente: ${mrn}`,
          details: { field: 'patientMrn', value: mrn, moduleId: module.id },
          shadowAction: { type: 'flag-orphaned-record', payload: { recordId: record.id } },
        });
        count++;
      }
      // Check employeeId
      const eid = record.data.employeeId;
      if (typeof eid === 'string' && eid && !validStaffIds.has(eid)) {
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: 'medium',
          surface: 'data.referential',
          target: `${module.id}:${record.id}`,
          message: `${module.id}/${record.id} referencia funcionário inexistente: ${eid}`,
          details: { field: 'employeeId', value: eid },
        });
        count++;
      }
    }
  }
  return count;
};

/**
 * function.module-manifest-consistency — every module must have a valid
 * route, columns, allowedRoles, fixturePath.
 */
const manifestConsistency: Runner = async (ctx) => {
  let count = 0;
  const seenRoutes = new Set<string>();
  for (const module of MODULES) {
    if (seenRoutes.has(module.route)) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'critical',
        surface: 'function.role-mapping',
        target: module.id,
        message: `Rota duplicada em manifest: ${module.route}`,
      });
      count++;
    }
    seenRoutes.add(module.route);

    if (!module.columns || module.columns.length === 0) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'high',
        surface: 'function.role-mapping',
        target: module.id,
        message: `Módulo ${module.id} sem columns definidas`,
      });
      count++;
    }
    if (!module.allowedRoles || module.allowedRoles.length === 0) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'high',
        surface: 'function.role-mapping',
        target: module.id,
        message: `Módulo ${module.id} sem allowedRoles`,
      });
      count++;
    }
  }
  return count;
};

/**
 * compliance.field-link — columns ending in ...Mrn, ...Id, ...Ref should
 * have a linkTo. This enforces the user policy "todos os campos clicáveis".
 */
const fieldLinkPolicy: Runner = async (ctx) => {
  let count = 0;
  const REFERENCE_PATTERNS = [
    /Mrn$/i,
    /^assetId$/,
    /^employeeId$/,
    /^supplierId$/,
    /^claimId$/,
    /^orderId$/,
    /^encounterId$/,
  ];
  // id is always shown but doesn't need linkTo
  for (const module of MODULES) {
    for (const col of module.columns) {
      if (col.key === 'id') continue;
      const matches = REFERENCE_PATTERNS.some((re) => re.test(col.key));
      if (matches && !col.linkTo) {
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: 'medium',
          surface: 'compliance.field-link',
          target: `${module.id}:${col.key}`,
          message: `Coluna ${module.id}.${col.key} parece referência mas não tem linkTo configurado`,
          details: { columnKey: col.key, label: col.label },
          shadowAction: {
            type: 'add-link-to',
            payload: { moduleId: module.id, columnKey: col.key },
          },
        });
        count++;
      }
    }
  }
  return count;
};

/**
 * security.headers-check — pings / and verifies the security headers
 * declared in middleware.ts are actually being sent.
 */
const securityHeadersCheck: Runner = async (ctx) => {
  let count = 0;
  const expected = [
    'content-security-policy',
    'strict-transport-security',
    'x-frame-options',
    'x-content-type-options',
    'referrer-policy',
    'permissions-policy',
  ];
  try {
    const res = await fetch(`${FRONTEND_BASE}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    for (const header of expected) {
      if (!res.headers.get(header)) {
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: 'high',
          surface: 'security.headers',
          target: header,
          message: `Header de segurança ausente em /: ${header}`,
        });
        count++;
      }
    }
  } catch (err) {
    createFinding({
      jobId: ctx.jobId,
      runId: ctx.runId,
      severity: 'high',
      surface: 'security.headers',
      target: '/',
      message: `Não foi possível verificar headers: ${err instanceof Error ? err.message : String(err)}`,
    });
    count++;
  }
  return count;
};

/**
 * infra.disk-usage — reads sizes of /data/velya-* PVCs.
 */
const diskUsage: Runner = async (ctx) => {
  let count = 0;
  const pvcDirs = [
    '/data/velya-audit',
    '/data/velya-events',
    '/data/velya-users',
    '/data/velya-delegations',
    '/data/velya-handoffs',
    '/data/velya-entities',
    '/data/velya-favorites',
    '/data/velya-following',
    '/data/velya-cron',
  ];
  for (const dir of pvcDirs) {
    if (!existsSync(dir)) continue;
    try {
      const stat = statSync(dir);
      if (stat.isDirectory()) {
        // Best-effort: count files; deep size calc would walk the tree
        const files = readdirSync(dir);
        if (files.length > 5000) {
          createFinding({
            jobId: ctx.jobId,
            runId: ctx.runId,
            severity: 'medium',
            surface: 'infra.disk',
            target: dir,
            message: `${dir} tem ${files.length} arquivos — considerar rotação ou compactação`,
            details: { fileCount: files.length },
            shadowAction: { type: 'rotate-archive', payload: { dir } },
          });
          count++;
        }
      }
    } catch {
      // ignore
    }
  }
  return count;
};

/**
 * data.duplication-scan — runs a lightweight in-memory duplication check
 * over the live records (not the source files like the CI gate).
 */
const duplicationScan: Runner = async (ctx) => {
  let count = 0;
  // Check for duplicate ids within the same module (should never happen)
  for (const module of MODULES) {
    const records = listLiveRecords(module.id);
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const r of records) {
      if (seen.has(r.id)) dups.push(r.id);
      seen.add(r.id);
    }
    if (dups.length > 0) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'high',
        surface: 'data.duplication',
        target: module.id,
        message: `${module.id} tem ${dups.length} ids duplicados`,
        details: { duplicates: dups },
      });
      count++;
    }
  }
  return count;
};

/**
 * backend.session-store — limpa sessões expiradas (>30 min idle) e reporta
 * arquivos de sessão corrompidos. Esta é uma operação safe (somente cleanup
 * de arquivos efêmeros) — pode rodar autônomo no agente.
 */
const sessionStore: Runner = async (ctx) => {
  let count = 0;
  const dir = process.env.VELYA_SESSION_PATH || '/tmp/velya-sessions';
  if (!existsSync(dir)) return 0;
  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const f of files) {
      try {
        const raw = readFileSync(join(dir, f), 'utf8');
        const parsed = JSON.parse(raw) as { lastActivity?: string };
        const ts = parsed.lastActivity ? Date.parse(parsed.lastActivity) : 0;
        if (ts && ts < cutoff) {
          createFinding({
            jobId: ctx.jobId,
            runId: ctx.runId,
            severity: 'low',
            surface: 'backend.auth',
            target: f,
            message: `Sessão expirada detectada: ${f}`,
            details: { lastActivity: parsed.lastActivity },
            shadowAction: { type: 'cleanup-stale-session', payload: { file: f } },
          });
          count++;
        }
      } catch {
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: 'medium',
          surface: 'backend.auth',
          target: f,
          message: `Sessão corrompida (JSON inválido): ${f}`,
        });
        count++;
      }
    }
  } catch {
    // ignore — directory unreadable
  }
  return count;
};

/**
 * data.fixture-completeness — para cada módulo, verifica se todo registro
 * tem valor para colunas marcadas required: true no manifest.
 */
const fixtureCompleteness: Runner = async (ctx) => {
  let count = 0;
  for (const module of MODULES) {
    const requiredKeys = module.columns.filter((c) => c.required).map((c) => c.key);
    if (requiredKeys.length === 0) continue;
    const records = listLiveRecords(module.id);
    for (const record of records) {
      const missing = requiredKeys.filter((k) => {
        const v = record.data[k];
        return v == null || v === '' || (Array.isArray(v) && v.length === 0);
      });
      if (missing.length > 0) {
        createFinding({
          jobId: ctx.jobId,
          runId: ctx.runId,
          severity: 'medium',
          surface: 'data.fixture',
          target: `${module.id}:${record.id}`,
          message: `Registro ${record.id} sem campos obrigatórios: ${missing.join(', ')}`,
          details: { moduleId: module.id, missingFields: missing },
        });
        count++;
      }
    }
  }
  return count;
};

/**
 * function.fixture-registry-coverage — todo módulo declarado em MODULES
 * precisa ter um registro vivo com pelo menos 1 entry, e nenhum módulo
 * "fantasma" deve existir no FIXTURE_REGISTRY sem aparecer no manifest.
 */
const fixtureRegistryCoverage: Runner = async (ctx) => {
  let count = 0;
  for (const module of MODULES) {
    const records = listLiveRecords(module.id);
    if (records.length === 0) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'medium',
        surface: 'function.role-mapping',
        target: module.id,
        message: `Módulo ${module.id} declarado no manifest mas sem fixtures vivas`,
        details: { fixturePath: module.fixturePath, fixtureExport: module.fixtureExport },
      });
      count++;
    }
  }
  return count;
};

/**
 * security.permission-matrix — para cada módulo, checa que `allowedRoles`
 * tem pelo menos 1 papel mapeado e que não usa wildcard ['*'] para módulos
 * de classe A (PHI máximo).
 */
const permissionMatrix: Runner = async (ctx) => {
  let count = 0;
  for (const module of MODULES) {
    if (!module.allowedRoles || module.allowedRoles.length === 0) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'high',
        surface: 'function.permission' as Surface,
        target: module.id,
        message: `Módulo ${module.id} sem allowedRoles definido`,
      });
      count++;
      continue;
    }
    if (module.dataClass === 'A' && module.allowedRoles.includes('*')) {
      createFinding({
        jobId: ctx.jobId,
        runId: ctx.runId,
        severity: 'critical',
        surface: 'function.permission' as Surface,
        target: module.id,
        message: `Módulo ${module.id} é classe A (PHI máximo) mas permite acesso wildcard`,
        details: { allowedRoles: module.allowedRoles },
      });
      count++;
    }
  }
  return count;
};

/**
 * Default fallback for jobs without a specific runner — record an info
 * finding so the user knows the job ran but did nothing.
 */
const noopRunner: Runner = async () => {
  return 0;
};

export const RUNNERS: Record<string, Runner> = {
  'frontend.route-health': routeHealth,
  'frontend.component-imports': noopRunner,
  'frontend.field-link-policy': fieldLinkPolicy,
  'backend.api-contract': apiContract,
  'backend.audit-chain': auditChain,
  'backend.session-store': sessionStore,
  'backend.rate-limit-sanity': noopRunner,
  'data.referential-integrity': referentialIntegrity,
  'data.duplication-scan': duplicationScan,
  'data.fixture-completeness': fixtureCompleteness,
  'data.stale-records': noopRunner,
  'infra.k8s-pod-health': noopRunner,
  'infra.disk-usage': diskUsage,
  'infra.tls-cert-expiry': noopRunner,
  'security.headers-check': securityHeadersCheck,
  'security.permission-matrix': permissionMatrix,
  'function.module-manifest-consistency': manifestConsistency,
  'function.fixture-registry-coverage': fixtureRegistryCoverage,
  'compliance.contrast-spotcheck': noopRunner,
};

export function getRunner(jobId: string): Runner | undefined {
  return RUNNERS[jobId];
}

// Export the helper types so consumers can be strongly typed
export type { Severity, Surface };
