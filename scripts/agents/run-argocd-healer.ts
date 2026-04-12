#!/usr/bin/env tsx
/**
 * run-argocd-healer.ts — Entry point for argocd-healer-agent.
 *
 * Detecta ArgoCD Applications em estado ruim (OutOfSync, Missing, Degraded,
 * SyncFailed, Unknown) e aplica remediações seguras:
 *   1. `argocd app refresh` (hard) — força reconciliação com Git
 *   2. `argocd app sync` — retriga sync quando drift detectado
 *   3. Correlaciona com alertas do Grafana/Prometheus quando `GRAFANA_URL` setado
 *   4. Em caso de falha persistente, escala com report estruturado
 *
 * Funciona de DOIS jeitos:
 *   - Via `argocd` CLI quando `ARGOCD_SERVER` + `ARGOCD_AUTH_TOKEN` estão no env
 *   - Via `kubectl` nos CRDs applications.argoproj.io quando roda in-cluster
 *
 * Designed to run as:
 *   - GitHub Actions workflow step (.github/workflows/argocd-healer.yaml)
 *   - Kubernetes CronJob (infra/kubernetes/autopilot/agents-cronjobs.yaml)
 *   - Local CLI: `npx tsx scripts/agents/run-argocd-healer.ts`
 *
 * Exit codes:
 *   0 — all healthy or successfully remediated
 *   1 — findings requiring human review
 *   2 — agent fatal error
 *
 * Envs:
 *   VELYA_AUDIT_OUT        default /data/velya-autopilot
 *   VELYA_DRY_RUN          default false
 *   ARGOCD_SERVER          optional — host:port of argocd server
 *   ARGOCD_AUTH_TOKEN      optional — JWT for argocd CLI
 *   ARGOCD_INSECURE        default false
 *   ARGOCD_PROJECT_FILTER  optional — only heal apps in this project
 *   ARGOCD_APP_FILTER      optional — regex; only heal matching app names
 *   GRAFANA_URL            optional — base URL to fetch firing alerts
 *   GRAFANA_TOKEN          optional — bearer token for Grafana
 *   KUBECTL_CONTEXT        optional — context when using kubectl fallback
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { withLock, type AgentSessionLock } from './shared/session-lock.js';

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  application: string;
  namespace?: string;
  syncStatus?: string;
  healthStatus?: string;
  message?: string;
  remediation?: 'applied' | 'pr' | 'escalated' | 'none';
  remediationDetail?: string;
  grafanaAlerts?: string[];
}

interface ArgoApp {
  metadata: { name: string; namespace: string };
  spec: {
    project?: string;
    // `destination.namespace` is the cluster namespace where the
    // Application's resources land. `destination.server` is the cluster
    // endpoint (or `in-cluster` alias). Both are optional in ArgoCD's
    // schema — an Application with only `name` relies on project
    // defaults. We treat missing destination as "unknown namespace" and
    // fall back to application-level locking only.
    destination?: { namespace?: string; server?: string; name?: string };
  };
  status: {
    sync?: { status?: string; revision?: string };
    health?: { status?: string; message?: string };
    operationState?: { phase?: string; message?: string };
    conditions?: Array<{ type: string; message: string }>;
  };
}

const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const DRY_RUN = process.env.VELYA_DRY_RUN === 'true';
// Feature flag: velya.autopilot.cooperative-locking (ADR-0016 follow-up #1).
// When true, every remediation on an ArgoCD Application takes an exclusive
// lock via scripts/agents/shared/session-lock.ts. Another agent (e.g.
// k8s-troubleshooter-agent) that tries to mutate the same target will see
// the lock and skip, avoiding the race where two healers undo each other.
// Default OFF so the migration is reversible; we enable per-environment
// via the VELYA_COOPERATIVE_LOCKING env var in the workflow.
const COOPERATIVE_LOCKING = process.env.VELYA_COOPERATIVE_LOCKING === 'true';
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes — longer than the longest sync we've observed
const ARGOCD_SERVER = process.env.ARGOCD_SERVER ?? '';
const ARGOCD_AUTH_TOKEN = process.env.ARGOCD_AUTH_TOKEN ?? '';
const ARGOCD_INSECURE = process.env.ARGOCD_INSECURE === 'true';
const PROJECT_FILTER = process.env.ARGOCD_PROJECT_FILTER ?? '';
const APP_FILTER = process.env.ARGOCD_APP_FILTER ?? '';
const GRAFANA_URL = process.env.GRAFANA_URL ?? '';
const GRAFANA_TOKEN = process.env.GRAFANA_TOKEN ?? '';
const KUBECTL_CONTEXT = process.env.KUBECTL_CONTEXT ?? '';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const useCli = Boolean(ARGOCD_SERVER && ARGOCD_AUTH_TOKEN);

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function run(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; input?: string } = {},
): { ok: boolean; stdout: string; stderr: string } {
  const result = spawnSync(cmd, args, {
    encoding: 'utf-8',
    timeout: opts.timeoutMs ?? 30_000,
    maxBuffer: 16 * 1024 * 1024,
    input: opts.input,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function argocd(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const base = [
    '--server',
    ARGOCD_SERVER,
    '--auth-token',
    ARGOCD_AUTH_TOKEN,
    '--grpc-web',
  ];
  if (ARGOCD_INSECURE) base.push('--insecure');
  return run('argocd', [...base, ...args]);
}

function kubectl(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const fullArgs = KUBECTL_CONTEXT
    ? ['--context', KUBECTL_CONTEXT, '--request-timeout=15s', ...args]
    : ['--request-timeout=15s', ...args];
  return run('kubectl', fullArgs);
}

function listApps(): ArgoApp[] {
  if (useCli) {
    const result = argocd(['app', 'list', '-o', 'json']);
    if (!result.ok) {
      console.error('[argocd-healer] argocd app list failed:', result.stderr);
      return [];
    }
    try {
      return JSON.parse(result.stdout) as ArgoApp[];
    } catch (e) {
      console.error('[argocd-healer] failed to parse argocd output:', e);
      return [];
    }
  }

  // Fallback: kubectl on the CRD
  const result = kubectl(['get', 'applications.argoproj.io', '-n', 'argocd', '-o', 'json']);
  if (!result.ok) {
    console.error('[argocd-healer] kubectl get applications failed:', result.stderr);
    return [];
  }
  try {
    const parsed = JSON.parse(result.stdout) as { items: ArgoApp[] };
    return parsed.items ?? [];
  } catch (e) {
    console.error('[argocd-healer] failed to parse kubectl output:', e);
    return [];
  }
}

function refreshApp(name: string): { ok: boolean; output: string } {
  if (DRY_RUN) return { ok: true, output: `[dry-run] would refresh ${name}` };
  if (useCli) {
    const r = argocd(['app', 'get', name, '--refresh', '--hard-refresh']);
    return { ok: r.ok, output: `${r.stdout}${r.stderr}` };
  }
  // Fallback via annotation
  const r = kubectl([
    'annotate',
    '-n',
    'argocd',
    `application.argoproj.io/${name}`,
    'argocd.argoproj.io/refresh=hard',
    '--overwrite',
  ]);
  return { ok: r.ok, output: `${r.stdout}${r.stderr}` };
}

function syncApp(name: string): { ok: boolean; output: string } {
  if (DRY_RUN) return { ok: true, output: `[dry-run] would sync ${name}` };
  if (useCli) {
    const r = argocd(['app', 'sync', name, '--prune=false', '--timeout', '180']);
    return { ok: r.ok, output: `${r.stdout}${r.stderr}` };
  }
  // Fallback: patch with sync operation
  const patch = JSON.stringify({
    operation: {
      sync: { revision: 'HEAD', prune: false, syncOptions: ['CreateNamespace=true'] },
    },
  });
  const r = kubectl([
    'patch',
    '-n',
    'argocd',
    `application.argoproj.io/${name}`,
    '--type=merge',
    '-p',
    patch,
  ]);
  return { ok: r.ok, output: `${r.stdout}${r.stderr}` };
}

interface GrafanaAlert {
  labels?: { alertname?: string; severity?: string };
  annotations?: { summary?: string };
  state?: string;
}

async function fetchGrafanaAlerts(): Promise<GrafanaAlert[]> {
  if (!GRAFANA_URL) return [];
  try {
    const url = `${GRAFANA_URL.replace(/\/$/, '')}/api/alertmanager/grafana/api/v2/alerts?active=true`;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (GRAFANA_TOKEN) headers.authorization = `Bearer ${GRAFANA_TOKEN}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`[argocd-healer] grafana fetch failed: ${res.status}`);
      return [];
    }
    return (await res.json()) as GrafanaAlert[];
  } catch (e) {
    console.error('[argocd-healer] grafana fetch error:', e);
    return [];
  }
}

function correlateAlerts(app: string, alerts: GrafanaAlert[]): string[] {
  const matches: string[] = [];
  for (const a of alerts) {
    const name = a.labels?.alertname ?? '';
    const summary = a.annotations?.summary ?? '';
    const blob = `${name} ${summary}`.toLowerCase();
    if (blob.includes(app.toLowerCase()) || blob.includes('argocd')) {
      matches.push(`${a.labels?.severity ?? 'info'}: ${name} — ${summary}`);
    }
  }
  return matches;
}

function severityFromStatus(sync: string, health: string): Finding['severity'] {
  if (health === 'Degraded' || health === 'Missing') return 'high';
  if (sync === 'OutOfSync' && health !== 'Healthy') return 'high';
  if (sync === 'OutOfSync') return 'medium';
  if (health === 'Unknown') return 'medium';
  return 'low';
}

/**
 * Detect webhook admission conflicts in ArgoCD operation messages.
 * Common case: KEDA ScaledObject + manual HPA targeting the same Deployment.
 * The KEDA webhook (vscaledobject.kb.io) rejects ScaledObjects when a manual
 * HPA already manages the same workload. This blocks ALL syncs on the app.
 *
 * Returns an array of { workload, hpa } pairs if a conflict is detected.
 */
function detectWebhookConflicts(
  opMsg: string,
  conditions: string,
): Array<{ workload: string; hpa: string }> {
  const combined = `${opMsg} ${conditions}`;
  const conflicts: Array<{ workload: string; hpa: string }> = [];
  // Pattern: "admission webhook ... denied ... workload 'X' ... already managed by the hpa 'Y'"
  const regex =
    /admission webhook.*?denied.*?workload '([^']+)'.*?already managed by the hpa '([^']+)'/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(combined)) !== null) {
    conflicts.push({ workload: m[1], hpa: m[2] });
  }
  return conflicts;
}

/**
 * Apply the refresh+sync remediation steps to a single finding, in place.
 * Extracted from main() so it can run under a cooperative lock or bare.
 * The lock scope is exactly this call — the minimum section that mutates
 * ArgoCD state for `finding.application`.
 */
function remediateApp(finding: Finding): void {
  const name = finding.application;
  const sync = finding.syncStatus ?? 'Unknown';
  const health = finding.healthStatus ?? 'Unknown';

  // Remediation step 1: hard refresh
  const refresh = refreshApp(name);
  if (!refresh.ok) {
    finding.remediation = 'escalated';
    finding.remediationDetail = `refresh failed: ${refresh.output.slice(0, 500)}`;
    return;
  }

  // Remediation step 2: if still OutOfSync after refresh, sync it
  if (sync === 'OutOfSync' || health === 'Missing') {
    const synced = syncApp(name);
    finding.remediation = synced.ok ? 'applied' : 'escalated';
    finding.remediationDetail = `refresh=ok sync=${synced.ok ? 'ok' : 'failed'}: ${synced.output.slice(0, 500)}`;
  } else if (health === 'Degraded') {
    // Degraded usually requires code/image/config fix — escalate
    finding.remediation = 'escalated';
    finding.remediationDetail = `refresh=ok; degraded state requires manual fix (likely image/config)`;
  } else {
    finding.remediation = 'applied';
    finding.remediationDetail = `refresh=ok`;
  }
}

async function main(): Promise<void> {
  console.log(
    `[argocd-healer] mode=${useCli ? 'cli' : 'kubectl'} dryRun=${DRY_RUN} cooperativeLocking=${COOPERATIVE_LOCKING}`,
  );
  const findings: Finding[] = [];

  const apps = listApps().filter((app) => {
    if (PROJECT_FILTER && app.spec.project !== PROJECT_FILTER) return false;
    if (APP_FILTER && !new RegExp(APP_FILTER).test(app.metadata.name)) return false;
    return true;
  });
  console.log(`[argocd-healer] ${apps.length} applications in scope`);

  const alerts = await fetchGrafanaAlerts();
  if (alerts.length) console.log(`[argocd-healer] ${alerts.length} grafana alerts active`);

  for (const app of apps) {
    const name = app.metadata.name;
    const sync = app.status.sync?.status ?? 'Unknown';
    const health = app.status.health?.status ?? 'Unknown';
    const opPhase = app.status.operationState?.phase ?? '';
    const opMsg = app.status.operationState?.message ?? '';
    const conditionMsgs = (app.status.conditions ?? [])
      .filter((c) => c.type.toLowerCase().includes('error'))
      .map((c) => `${c.type}: ${c.message}`)
      .join(' | ');

    const isHealthy = sync === 'Synced' && health === 'Healthy';
    if (isHealthy) {
      console.log(`  ✓ ${name} [${sync}/${health}]`);
      continue;
    }

    // Detect webhook admission conflicts (e.g. KEDA vs manual HPA)
    const webhookConflicts = detectWebhookConflicts(opMsg, conditionMsgs);
    const isWebhookConflict = webhookConflicts.length > 0;

    const severity = isWebhookConflict ? 'critical' : severityFromStatus(sync, health);
    const rule = isWebhookConflict ? 'argocd-webhook-conflict' : 'argocd-app-unhealthy';
    const grafanaMatches = correlateAlerts(name, alerts);

    const finding: Finding = {
      severity,
      rule,
      application: name,
      namespace: app.metadata.namespace,
      syncStatus: sync,
      healthStatus: health,
      message: [opPhase, opMsg, conditionMsgs, app.status.health?.message]
        .filter(Boolean)
        .join(' | '),
      remediation: 'none',
      grafanaAlerts: grafanaMatches.length ? grafanaMatches : undefined,
    };

    // Webhook conflicts cannot be fixed by refresh+sync — they require
    // removing conflicting resources from Git (e.g. deleting manual HPAs
    // when KEDA ScaledObjects exist for the same workloads).
    if (isWebhookConflict) {
      finding.remediation = 'escalated';
      const conflictList = webhookConflicts
        .map((c) => `workload=${c.workload} hpa=${c.hpa}`)
        .join('; ');
      finding.remediationDetail =
        `webhook admission conflict: ${conflictList}. ` +
        `Cannot auto-fix via sync — remove conflicting HPAs from bootstrap manifests ` +
        `(KEDA ScaledObjects create their own HPAs). See hpa-velya-services.yaml.`;
      console.log(`  ✗ ${name} [WEBHOOK CONFLICT] ${conflictList}`);
      findings.push(finding);
      continue;
    }

    console.log(`  ✗ ${name} [${sync}/${health}] ${opPhase ? `op=${opPhase}` : ''}`);

    if (COOPERATIVE_LOCKING) {
      // Cross-agent serialization (ADR-0016 follow-up #4):
      // Take TWO locks in strict order — application first, then the
      // destination namespace. The outer lock protects healer-vs-healer
      // races on the same ArgoCD application; the inner lock protects
      // healer-vs-troubleshooter races on the same cluster namespace.
      //
      // Lock ordering is important: always application → namespace.
      // Any other agent that takes namespace → application would risk
      // deadlock. We own both sides of this order (healer and
      // troubleshooter are the only agents that take these locks today)
      // so we can enforce the order by convention.
      //
      // When `spec.destination.namespace` is missing, we skip the
      // namespace lock and fall back to application-only locking —
      // same behaviour as before. This matches Applications that rely
      // on project defaults or multi-namespace renders.
      const destNs = app.spec.destination?.namespace;

      const result = await withLock(
        {
          agent: 'argocd-healer-agent',
          target: {
            kind: 'argocd-application',
            name,
            namespace: app.metadata.namespace,
          },
          ttlMs: LOCK_TTL_MS,
          reason: `refresh+sync for ${sync}/${health}`,
        },
        async (_appLock: AgentSessionLock) => {
          if (!destNs) {
            remediateApp(finding);
            return 'ok' as const;
          }
          const nsResult = await withLock(
            {
              agent: 'argocd-healer-agent',
              target: { kind: 'k8s-namespace', name: destNs },
              ttlMs: LOCK_TTL_MS,
              reason: `serialize with troubleshooter on ns ${destNs} while syncing ${name}`,
            },
            async (_nsLock: AgentSessionLock) => {
              remediateApp(finding);
              return 'ok' as const;
            },
          );
          if (nsResult === null) {
            finding.remediation = 'escalated';
            finding.remediationDetail =
              `skipped: k8s-troubleshooter holds the namespace lock for ${destNs}`;
            console.log(`    ↳ namespace ${destNs} locked by peer, deferring remediation`);
          }
          return 'ok' as const;
        },
      );
      if (result === null) {
        // Another healer instance holds the application lock — skip.
        finding.remediation = 'escalated';
        finding.remediationDetail =
          'skipped: another healer instance holds the application lock';
        console.log(`    ↳ app lock-held by peer, skipping remediation`);
      }
    } else {
      remediateApp(finding);
    }

    findings.push(finding);
  }

  // Output
  const severityRank: Record<Finding['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const report = {
    timestamp,
    agent: 'argocd-healer-agent',
    mode: useCli ? 'argocd-cli' : 'kubectl',
    dryRun: DRY_RUN,
    totalApps: apps.length,
    totalFindings: findings.length,
    bySeverity: {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    byRemediation: {
      applied: findings.filter((f) => f.remediation === 'applied').length,
      escalated: findings.filter((f) => f.remediation === 'escalated').length,
      none: findings.filter((f) => !f.remediation || f.remediation === 'none').length,
    },
    grafanaIntegration: Boolean(GRAFANA_URL),
    grafanaAlertsActive: alerts.length,
    findings,
  };

  ensureDir(join(OUT_DIR, 'argocd-audit'));
  const outFile = join(OUT_DIR, 'argocd-audit', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  // Also write a latest.json alias for dashboards
  writeFileSync(join(OUT_DIR, 'argocd-audit', 'latest.json'), JSON.stringify(report, null, 2));

  console.log(`[argocd-healer] ${findings.length} findings → ${outFile}`);
  console.log(
    `  severity: crit=${report.bySeverity.critical} high=${report.bySeverity.high} med=${report.bySeverity.medium} low=${report.bySeverity.low}`,
  );
  console.log(
    `  remediation: applied=${report.byRemediation.applied} escalated=${report.byRemediation.escalated} none=${report.byRemediation.none}`,
  );

  const escalated = findings.filter(
    (f) =>
      (f.remediation === 'escalated' || f.remediation === 'none') &&
      (f.severity === 'critical' || f.severity === 'high'),
  );
  if (escalated.length) {
    console.error(`[argocd-healer] ${escalated.length} high/critical findings require human review`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[argocd-healer] Fatal:', error);
  process.exit(2);
});
