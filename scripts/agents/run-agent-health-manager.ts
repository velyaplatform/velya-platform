#!/usr/bin/env tsx
/**
 * run-agent-health-manager.ts — Entry point for agent-health-manager (Layer 2).
 *
 * Watches Layer 1 worker CronJobs labeled `velya.io/component=autopilot` in
 * namespace `velya-dev-platform`. Detects failed/stuck/silent agents and
 * applies safe remediations (deletes stuck Jobs running > 30 min).
 *
 * Designed to run as a Kubernetes CronJob using image
 * `velya-autopilot-agents:v2`. See .claude/agents/agent-health-manager.md.
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
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
    ownerReferences?: Array<{ kind: string; name: string }>;
  };
  status: {
    startTime?: string;
    completionTime?: string;
    succeeded?: number;
    failed?: number;
    active?: number;
  };
}

interface CronJobItem {
  metadata: { name: string; namespace: string; labels?: Record<string, string> };
  spec: {
    schedule: string;
    suspend?: boolean;
    startingDeadlineSeconds?: number;
    jobTemplate?: {
      spec?: { template?: { spec?: { containers?: Array<{ image?: string }> } } };
    };
  };
}

const NAMESPACE = 'velya-dev-platform';
const LABEL_SELECTOR = 'velya.io/component=autopilot';
const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const DRY_RUN = process.env.VELYA_DRY_RUN === 'true';
const KUBECTL_CONTEXT = process.env.KUBECTL_CONTEXT ?? '';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const DEFAULT_BASELINE_MS = 10 * 60 * 1000; // 10 minutes
const STUCK_REMEDIATE_MS = 30 * 60 * 1000; // 30 minutes

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

function parseScheduleIntervalMs(schedule: string): number {
  // Rough parser for common cron patterns like */N * * * * or N * * * *.
  const parts = schedule.trim().split(/\s+/);
  if (parts.length < 5) return 15 * 60 * 1000;
  const minuteField = parts[0] ?? '*';
  const hourField = parts[1] ?? '*';
  const stepMatch = minuteField.match(/^\*\/(\d+)$/);
  if (stepMatch && stepMatch[1]) return parseInt(stepMatch[1], 10) * 60 * 1000;
  if (minuteField === '*') return 60 * 1000;
  const hourStep = hourField.match(/^\*\/(\d+)$/);
  if (hourStep && hourStep[1]) return parseInt(hourStep[1], 10) * 60 * 60 * 1000;
  if (/^\d+$/.test(minuteField) && hourField === '*') return 60 * 60 * 1000;
  return 60 * 60 * 1000;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

function jobsOwnedBy(jobs: JobItem[], cronJobName: string): JobItem[] {
  return jobs.filter((j) =>
    (j.metadata.ownerReferences ?? []).some(
      (ref) => ref.kind === 'CronJob' && ref.name === cronJobName,
    ),
  );
}

async function main(): Promise<void> {
  const findings: Finding[] = [];

  console.log('[agent-health-manager] Listing worker CronJobs…');
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
  console.log(`[agent-health-manager] ${cronJobs.length} worker CronJobs found.`);

  console.log('[agent-health-manager] Listing Jobs…');
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

  for (const cj of cronJobs) {
    const owned = jobsOwnedBy(allJobs, cj.metadata.name).sort((a, b) => {
      const ta = a.status.startTime ? Date.parse(a.status.startTime) : 0;
      const tb = b.status.startTime ? Date.parse(b.status.startTime) : 0;
      return tb - ta;
    });
    const recent = owned.slice(0, 5);

    // 1. Repeated failures — 3+ consecutive
    let consecutiveFailures = 0;
    for (const j of recent) {
      if ((j.status.failed ?? 0) > 0 && (j.status.succeeded ?? 0) === 0) {
        consecutiveFailures += 1;
      } else {
        break;
      }
    }
    if (consecutiveFailures >= 3) {
      findings.push({
        severity: 'high',
        rule: 'agent-repeated-failure',
        description: `CronJob ${cj.metadata.name} has ${consecutiveFailures} consecutive Job failures`,
        namespace: cj.metadata.namespace,
        resource: `cronjob/${cj.metadata.name}`,
        remediation: 'escalated',
      });
    }

    // 2. Missed schedule — if newest Job has no startTime after schedule + 2*deadline
    const intervalMs = parseScheduleIntervalMs(cj.spec.schedule);
    const deadlineMs = (cj.spec.startingDeadlineSeconds ?? 0) * 1000;
    const expectedWindowMs = intervalMs + 2 * deadlineMs;
    const newest = recent[0];
    const newestStart = newest?.status.startTime ? Date.parse(newest.status.startTime) : 0;
    if (!newestStart || now - newestStart > expectedWindowMs + intervalMs) {
      findings.push({
        severity: 'medium',
        rule: 'agent-missed-schedule',
        description: `CronJob ${cj.metadata.name} newest Job older than expected window (${Math.round(expectedWindowMs / 1000)}s)`,
        namespace: cj.metadata.namespace,
        resource: `cronjob/${cj.metadata.name}`,
        remediation: 'escalated',
      });
    }

    // 3. Stuck Jobs — running > 2x baseline median duration
    const successDurations = recent
      .filter((j) => (j.status.succeeded ?? 0) > 0 && j.status.startTime && j.status.completionTime)
      .map((j) => Date.parse(j.status.completionTime!) - Date.parse(j.status.startTime!));
    const baselineMs = successDurations.length > 0 ? median(successDurations) : DEFAULT_BASELINE_MS;

    for (const j of owned) {
      if ((j.status.active ?? 0) > 0 && j.status.startTime) {
        const runningMs = now - Date.parse(j.status.startTime);
        if (runningMs > 2 * baselineMs) {
          const finding: Finding = {
            severity: 'medium',
            rule: 'agent-stuck-job',
            description: `Job ${j.metadata.name} running for ${Math.round(runningMs / 1000)}s (baseline ${Math.round(baselineMs / 1000)}s)`,
            namespace: cj.metadata.namespace,
            resource: `job/${j.metadata.name}`,
            remediation: 'escalated',
          };
          findings.push(finding);

          if (runningMs > STUCK_REMEDIATE_MS) {
            const del = kubectlDeleteJob(j.metadata.name, cj.metadata.namespace);
            finding.remediation = del.ok ? 'applied' : 'escalated';
            finding.remediationDetail = del.output;
          }
        }
      }
    }

    // 4. Silent agents — proxy check: newest successful completion too old
    const lastSuccess = owned.find((j) => (j.status.succeeded ?? 0) > 0);
    const lastSuccessTime = lastSuccess?.status.completionTime
      ? Date.parse(lastSuccess.status.completionTime)
      : 0;
    if (lastSuccessTime && now - lastSuccessTime > 2 * intervalMs) {
      findings.push({
        severity: 'high',
        rule: 'agent-silence',
        description: `CronJob ${cj.metadata.name} last successful completion was ${Math.round((now - lastSuccessTime) / 1000)}s ago (2x interval=${Math.round((2 * intervalMs) / 1000)}s)`,
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
    agent: 'agent-health-manager',
    layer: 2,
    watches: 'layer-1-workers',
    cluster: KUBECTL_CONTEXT || 'in-cluster',
    namespace: NAMESPACE,
    dryRun: DRY_RUN,
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

  ensureDir(join(OUT_DIR, 'manager-audit'));
  const outFile = join(OUT_DIR, 'manager-audit', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`[agent-health-manager] ${findings.length} findings → ${outFile}`);
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
  console.error('[agent-health-manager] Fatal:', error);
  process.exit(2);
});
