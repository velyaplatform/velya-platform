#!/usr/bin/env tsx
/**
 * run-agent-runtime-supervisor.ts — Entry point for agent-runtime-supervisor
 * (Layer 2 operational hygiene manager).
 *
 * Prunes completed worker Jobs older than 24h, verifies PVC capacity, audits
 * image pinning, and reports suspended CronJobs. Does not handle failure
 * detection — that belongs to agent-health-manager.
 *
 * Runs as a Kubernetes CronJob using image `velya-autopilot-agents:v2`.
 * See .claude/agents/agent-runtime-supervisor.md.
 *
 * Exit codes:
 *   0 — clean or remediated
 *   1 — findings requiring human review (high/critical after remediation)
 *   2 — agent fatal error
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  description: string;
  namespace?: string;
  resource?: string;
  remediation?: 'applied' | 'pr' | 'escalated' | 'none';
  remediationDetail?: string;
}

interface JobItem {
  metadata: { name: string; namespace: string };
  status: { succeeded?: number; failed?: number; completionTime?: string };
}

interface ContainerSpec {
  image?: string;
}

interface CronJobItem {
  metadata: { name: string; namespace: string };
  spec: {
    suspend?: boolean;
    jobTemplate?: {
      spec?: { template?: { spec?: { containers?: ContainerSpec[] } } };
    };
  };
}

interface PvcItem {
  metadata: { name: string; namespace: string };
  spec: { resources?: { requests?: { storage?: string } } };
  status?: { phase?: string; capacity?: { storage?: string } };
}

const NAMESPACE = 'velya-dev-platform';
const LABEL_SELECTOR = 'velya.io/component=autopilot';
const PVC_NAME = 'velya-autopilot-data';
const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const DRY_RUN = process.env.VELYA_DRY_RUN === 'true';
const KUBECTL_CONTEXT = process.env.KUBECTL_CONTEXT ?? '';
const OFFLINE_MODE = process.env.VELYA_SMOKE_OFFLINE === 'true';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const PRUNE_THRESHOLD_MS = 24 * 60 * 60 * 1000;

/**
 * Detect whether kubectl can reach a cluster. Same contract as the matching
 * helper in run-agent-health-manager.ts so CI smoke can skip k8s-dependent
 * agents with VELYA_SMOKE_OFFLINE=true.
 */
function kubectlAvailable(): boolean {
  if (OFFLINE_MODE) return false;
  const probe = spawnSync(
    'kubectl',
    KUBECTL_CONTEXT
      ? ['--context', KUBECTL_CONTEXT, '--request-timeout=3s', 'version', '--output=json']
      : ['--request-timeout=3s', 'version', '--output=json'],
    { encoding: 'utf-8', timeout: 5000 },
  );
  if (probe.status !== 0) return false;
  try {
    const parsed = JSON.parse(probe.stdout ?? '{}') as { serverVersion?: unknown };
    return parsed.serverVersion !== undefined;
  } catch {
    return false;
  }
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function kubectl(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const fullArgs = KUBECTL_CONTEXT
    ? ['--context', KUBECTL_CONTEXT, '--request-timeout=15s', ...args]
    : ['--request-timeout=15s', ...args];
  const result = spawnSync('kubectl', fullArgs, {
    encoding: 'utf-8',
    timeout: 30_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function kubectlDeleteJob(name: string, namespace: string): { ok: boolean; output: string } {
  if (DRY_RUN) {
    return { ok: true, output: `[dry-run] would delete job/${name} in ${namespace}` };
  }
  const result = kubectl(['delete', 'job', name, '-n', namespace]);
  return { ok: result.ok, output: `${result.stdout}${result.stderr}` };
}

function isCompleted(job: JobItem): boolean {
  return (job.status.succeeded ?? 0) > 0 || (job.status.failed ?? 0) > 0;
}

function isUnpinnedImage(image: string | undefined): boolean {
  if (!image) return true;
  const tagIdx = image.lastIndexOf(':');
  const slashIdx = image.lastIndexOf('/');
  // If there is no colon after the last slash, there is no tag at all.
  if (tagIdx === -1 || tagIdx < slashIdx) return true;
  const tag = image.slice(tagIdx + 1);
  return tag === 'latest';
}

async function main(): Promise<void> {
  const findings: Finding[] = [];
  let prunedCount = 0;

  if (!kubectlAvailable()) {
    const reason = OFFLINE_MODE
      ? 'VELYA_SMOKE_OFFLINE=true'
      : 'kubectl not reachable (no cluster context)';
    console.log(
      `[agent-runtime-supervisor] offline mode (${reason}) — skipping cluster probes, writing empty report`,
    );
    ensureDir(join(OUT_DIR, 'supervisor-audit'));
    const outFile = join(OUT_DIR, 'supervisor-audit', `${timestamp}.offline.json`);
    writeFileSync(
      outFile,
      JSON.stringify(
        {
          timestamp,
          agent: 'agent-runtime-supervisor',
          layer: 2,
          mode: 'offline',
          reason,
          prunedCount: 0,
          totalFindings: 0,
          findings: [],
        },
        null,
        2,
      ),
    );
    console.log(`[agent-runtime-supervisor] offline report → ${outFile}`);
    return;
  }

  // 1. Prune completed Jobs older than 24h
  console.log('[agent-runtime-supervisor] Listing Jobs for prune…');
  const jobRes = kubectl([
    'get',
    'job',
    '-n',
    NAMESPACE,
    '-l',
    LABEL_SELECTOR,
    '-o',
    'json',
  ]);
  if (!jobRes.ok) {
    throw new Error(`failed listing jobs: ${jobRes.stderr}`);
  }
  const allJobs = (JSON.parse(jobRes.stdout) as { items: JobItem[] }).items;
  const now = Date.now();
  const pruneCandidates: JobItem[] = [];
  for (const j of allJobs) {
    if (!isCompleted(j)) continue;
    const completedAt = j.status.completionTime ? Date.parse(j.status.completionTime) : 0;
    if (completedAt && now - completedAt > PRUNE_THRESHOLD_MS) {
      pruneCandidates.push(j);
    }
  }
  console.log(`[agent-runtime-supervisor] ${pruneCandidates.length} Jobs to prune.`);
  for (const j of pruneCandidates) {
    const del = kubectlDeleteJob(j.metadata.name, j.metadata.namespace);
    if (del.ok) prunedCount += 1;
  }
  if (pruneCandidates.length > 0) {
    findings.push({
      severity: 'low',
      rule: 'pruned-completed-jobs',
      description: `Pruned ${prunedCount}/${pruneCandidates.length} completed Jobs older than 24h`,
      namespace: NAMESPACE,
      remediation: 'applied',
      remediationDetail: pruneCandidates.map((j) => j.metadata.name).join(', ').slice(0, 2000),
    });
  }

  // 2. PVC disk usage check — report requested storage; flag if unavailable
  console.log('[agent-runtime-supervisor] Inspecting PVC…');
  const pvcRes = kubectl(['get', 'pvc', PVC_NAME, '-n', NAMESPACE, '-o', 'json']);
  if (!pvcRes.ok) {
    findings.push({
      severity: 'low',
      rule: 'pvc-inspection-unavailable',
      description: `Unable to inspect PVC ${PVC_NAME}: ${pvcRes.stderr.trim().slice(0, 500)}`,
      namespace: NAMESPACE,
      resource: `pvc/${PVC_NAME}`,
      remediation: 'escalated',
    });
  } else {
    try {
      const pvc = JSON.parse(pvcRes.stdout) as PvcItem;
      const requested = pvc.spec.resources?.requests?.storage ?? 'unknown';
      const capacity = pvc.status?.capacity?.storage ?? 'unknown';
      console.log(
        `[agent-runtime-supervisor] PVC ${PVC_NAME} phase=${pvc.status?.phase ?? '?'} requested=${requested} capacity=${capacity}`,
      );
    } catch {
      findings.push({
        severity: 'low',
        rule: 'pvc-inspection-unavailable',
        description: `Failed to parse PVC ${PVC_NAME} JSON`,
        namespace: NAMESPACE,
        resource: `pvc/${PVC_NAME}`,
        remediation: 'escalated',
      });
    }
  }

  // 3. Image pinning + 4. Schedule integrity
  console.log('[agent-runtime-supervisor] Auditing CronJob images and schedules…');
  const cronRes = kubectl([
    'get',
    'cronjob',
    '-n',
    NAMESPACE,
    '-l',
    LABEL_SELECTOR,
    '-o',
    'json',
  ]);
  if (!cronRes.ok) {
    throw new Error(`failed listing cronjobs: ${cronRes.stderr}`);
  }
  const cronJobs = (JSON.parse(cronRes.stdout) as { items: CronJobItem[] }).items;
  for (const cj of cronJobs) {
    const containers = cj.spec.jobTemplate?.spec?.template?.spec?.containers ?? [];
    for (const c of containers) {
      if (isUnpinnedImage(c.image)) {
        findings.push({
          severity: 'medium',
          rule: 'unpinned-image',
          description: `CronJob ${cj.metadata.name} container image '${c.image ?? '<none>'}' is unpinned`,
          namespace: cj.metadata.namespace,
          resource: `cronjob/${cj.metadata.name}`,
          remediation: 'escalated',
        });
      }
    }
    if (cj.spec.suspend === true) {
      findings.push({
        severity: 'low',
        rule: 'agent-suspended',
        description: `CronJob ${cj.metadata.name} is suspended`,
        namespace: cj.metadata.namespace,
        resource: `cronjob/${cj.metadata.name}`,
        remediation: 'escalated',
      });
    }
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
    agent: 'agent-runtime-supervisor',
    layer: 2,
    watches: 'layer-1-workers',
    cluster: KUBECTL_CONTEXT || 'in-cluster',
    namespace: NAMESPACE,
    dryRun: DRY_RUN,
    prunedJobs: prunedCount,
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
    findings,
  };

  ensureDir(join(OUT_DIR, 'supervisor-audit'));
  const outFile = join(OUT_DIR, 'supervisor-audit', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`[agent-runtime-supervisor] ${findings.length} findings → ${outFile}`);
  console.log(
    `  severity: crit=${report.bySeverity.critical} high=${report.bySeverity.high} med=${report.bySeverity.medium} low=${report.bySeverity.low}`,
  );
  console.log(
    `  remediation: applied=${report.byRemediation.applied} escalated=${report.byRemediation.escalated} none=${report.byRemediation.none}`,
  );

  const nonRemediated = findings.filter(
    (f) => f.remediation === 'escalated' || f.remediation === 'none',
  );
  if (nonRemediated.some((f) => f.severity === 'critical' || f.severity === 'high')) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[agent-runtime-supervisor] Fatal:', error);
  if (OFFLINE_MODE) {
    console.error('[agent-runtime-supervisor] offline mode — swallowing error, exit 0');
    process.exit(0);
  }
  process.exit(2);
});
