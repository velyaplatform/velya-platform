#!/usr/bin/env tsx
/**
 * run-infra-health.ts — Entry point for infra-health-agent.
 *
 * Detects common infra drift issues in the Velya cluster and applies safe
 * auto-remediations (alias PriorityClass, missing ServiceAccounts, duplicate HPAs).
 *
 * Designed to run as a Kubernetes CronJob with service account
 * `velya-autopilot-sa` that has the minimum RBAC described in
 * .claude/agents/infra-health-agent.md.
 *
 * Exit codes:
 *   0 — clean or remediated
 *   1 — findings requiring human review
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

const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const DRY_RUN = process.env.VELYA_DRY_RUN === 'true';
const KUBECTL_CONTEXT = process.env.KUBECTL_CONTEXT ?? '';
// Smoke CI sets this to 'true' so agents skip their cluster probes. The
// backend health probes below honour it — otherwise smoke CI would emit a
// namespace-missing finding for every backend dep on every run.
const SMOKE_OFFLINE = process.env.VELYA_SMOKE_OFFLINE === 'true';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

// Backend health probes (ADR-0016 follow-up — brecha #7 from the validation
// landscape audit). The agent consults k8s directly for NATS JetStream,
// Temporal, and PostgreSQL by label, so it works with whichever operator
// the cluster uses without hard-coding resource names. Each env var below
// can be overridden to match the local operator.
const NATS_NAMESPACE = process.env.VELYA_NATS_NAMESPACE ?? 'velya-dev-core';
const NATS_LABEL = process.env.VELYA_NATS_LABEL ?? 'app.kubernetes.io/name=nats';
const TEMPORAL_NAMESPACE = process.env.VELYA_TEMPORAL_NAMESPACE ?? 'velya-dev-platform';
const TEMPORAL_LABEL = process.env.VELYA_TEMPORAL_LABEL ?? 'app.kubernetes.io/name=temporal';
const POSTGRES_NAMESPACE = process.env.VELYA_POSTGRES_NAMESPACE ?? 'velya-dev-core';
const POSTGRES_LABEL = process.env.VELYA_POSTGRES_LABEL ?? 'application=spilo';

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function kubectl(args: string[]): { ok: boolean; stdout: string; stderr: string } {
  const fullArgs = KUBECTL_CONTEXT
    ? ['--context', KUBECTL_CONTEXT, '--request-timeout=15s', ...args]
    : ['--request-timeout=15s', ...args];
  const result = spawnSync('kubectl', fullArgs, {
    encoding: 'utf-8',
    timeout: 30_000, // hard kill after 30s to avoid stuck pods
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function kubectlApply(manifest: string): { ok: boolean; output: string } {
  if (DRY_RUN) {
    return { ok: true, output: `[dry-run] would apply:\n${manifest}` };
  }
  try {
    const result = spawnSync('kubectl', KUBECTL_CONTEXT ? ['--context', KUBECTL_CONTEXT, 'apply', '-f', '-'] : ['apply', '-f', '-'], {
      encoding: 'utf-8',
      input: manifest,
    });
    return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
  } catch (error) {
    return { ok: false, output: String(error) };
  }
}

function kubectlDelete(kind: string, name: string, namespace: string): { ok: boolean; output: string } {
  if (DRY_RUN) {
    return { ok: true, output: `[dry-run] would delete ${kind}/${name} in ${namespace}` };
  }
  const result = kubectl(['delete', kind, name, '-n', namespace]);
  return { ok: result.ok, output: `${result.stdout}${result.stderr}` };
}

/**
 * Generic health probe for a stateful backend dependency (NATS, Temporal,
 * Postgres) selected by label. Reports one finding per unhealthy workload
 * with a descriptive message. No remediation is attempted — these services
 * need human or helm-level intervention.
 *
 * Checks, in order:
 *   1. Namespace exists — if not, `medium` finding (cluster may not be
 *      provisioned yet).
 *   2. Workloads (StatefulSet + Deployment) matching the label selector —
 *      if none found, `medium` finding (not deployed).
 *   3. For each workload, `readyReplicas >= spec.replicas` — if not,
 *      finding at the configured severity.
 *   4. For each pod in the selector, `status.phase == Running` and
 *      `containerStatuses[*].ready == true` — if not, finding with the
 *      most recent waiting reason / termination reason.
 */
interface BackendProbeOptions {
  kind: 'nats' | 'temporal' | 'postgres';
  namespace: string;
  label: string;
  severity: Finding['severity'];
}

function checkStatefulWorkload(findings: Finding[], opts: BackendProbeOptions): void {
  const { kind, namespace, label, severity } = opts;
  console.log(`[infra-health] probing ${kind} in ${namespace} by label ${label}`);

  // 1. Namespace sanity check
  const ns = kubectl(['get', 'ns', namespace, '-o', 'name']);
  if (!ns.ok) {
    findings.push({
      severity: 'medium',
      rule: `${kind}-namespace-missing`,
      description: `${kind} namespace ${namespace} not present — cluster may not be fully provisioned`,
      namespace,
      remediation: 'escalated',
    });
    return;
  }

  // 2. Workloads matching the label — check both StatefulSet and Deployment
  for (const kindArg of ['statefulset', 'deployment'] as const) {
    const wl = kubectl(['get', kindArg, '-n', namespace, '-l', label, '-o', 'json']);
    if (!wl.ok) continue;
    try {
      const parsed = JSON.parse(wl.stdout) as {
        items: Array<{
          metadata: { name: string };
          spec: { replicas?: number };
          status: { readyReplicas?: number; availableReplicas?: number };
        }>;
      };
      for (const w of parsed.items) {
        const desired = w.spec.replicas ?? 1;
        const ready = w.status.readyReplicas ?? 0;
        if (ready < desired) {
          findings.push({
            severity,
            rule: `${kind}-under-replicated`,
            description: `${kind} ${kindArg}/${w.metadata.name} has ${ready}/${desired} ready replicas`,
            namespace,
            resource: `${kindArg}/${w.metadata.name}`,
            remediation: 'escalated',
          });
        }
      }
    } catch (e) {
      console.error(`[infra-health] ${kind} ${kindArg} parse failed:`, e);
    }
  }

  // 3. Pods matching the label — look for non-Running / not-Ready
  const podsRes = kubectl(['get', 'pods', '-n', namespace, '-l', label, '-o', 'json']);
  if (!podsRes.ok) {
    findings.push({
      severity: 'medium',
      rule: `${kind}-not-deployed`,
      description: `${kind} workloads not found in ${namespace} (label ${label})`,
      namespace,
      remediation: 'escalated',
    });
    return;
  }
  try {
    const parsed = JSON.parse(podsRes.stdout) as {
      items: Array<{
        metadata: { name: string };
        status: {
          phase: string;
          containerStatuses?: Array<{
            name: string;
            ready: boolean;
            restartCount: number;
            state?: { waiting?: { reason?: string; message?: string } };
            lastState?: { terminated?: { reason?: string; message?: string } };
          }>;
        };
      }>;
    };
    if (parsed.items.length === 0) {
      findings.push({
        severity: 'medium',
        rule: `${kind}-no-pods`,
        description: `${kind} has 0 pods in ${namespace} (label ${label}) — not deployed or wrong selector`,
        namespace,
        remediation: 'escalated',
      });
      return;
    }
    for (const pod of parsed.items) {
      const allReady = (pod.status.containerStatuses ?? []).every((c) => c.ready);
      if (pod.status.phase === 'Running' && allReady) continue;
      const offender = (pod.status.containerStatuses ?? []).find((c) => !c.ready);
      const reason =
        offender?.state?.waiting?.reason ??
        offender?.lastState?.terminated?.reason ??
        pod.status.phase;
      const msg =
        offender?.state?.waiting?.message ?? offender?.lastState?.terminated?.message ?? '';
      findings.push({
        severity,
        rule: `${kind}-pod-unhealthy`,
        description: `${kind} pod/${pod.metadata.name} in ${namespace} — ${reason}`,
        namespace,
        resource: `pod/${pod.metadata.name}`,
        remediation: 'escalated',
        remediationDetail: msg.slice(0, 400),
      });
    }
  } catch (e) {
    console.error(`[infra-health] ${kind} pod parse failed:`, e);
  }
}

async function main(): Promise<void> {
  const findings: Finding[] = [];

  // 1. Check referenced PriorityClasses exist
  console.log('[infra-health] Checking PriorityClass references…');
  const pcList = kubectl(['get', 'priorityclass', '-o', 'name']);
  const existingPcs = new Set(
    pcList.stdout
      .split('\n')
      .filter(Boolean)
      .map((n) => n.replace('priorityclass.scheduling.k8s.io/', '')),
  );

  const cronJobs = kubectl(['get', 'cronjob', '-A', '-o', 'json']);
  if (cronJobs.ok) {
    try {
      const parsed = JSON.parse(cronJobs.stdout) as {
        items: Array<{
          metadata: { name: string; namespace: string };
          spec: {
            jobTemplate?: {
              spec?: {
                template?: {
                  spec?: { priorityClassName?: string; serviceAccountName?: string };
                };
              };
            };
          };
        }>;
      };

      for (const cj of parsed.items) {
        const spec = cj.spec.jobTemplate?.spec?.template?.spec;
        const pc = spec?.priorityClassName;
        if (pc && !existingPcs.has(pc)) {
          findings.push({
            severity: 'high',
            rule: 'missing-priority-class',
            description: `CronJob ${cj.metadata.namespace}/${cj.metadata.name} references missing PriorityClass '${pc}'`,
            namespace: cj.metadata.namespace,
            resource: `cronjob/${cj.metadata.name}`,
            remediation: 'none',
          });

          // Safe remediation: create alias if a `velya-batch-low` exists
          if (pc === 'velya-batch' && existingPcs.has('velya-batch-low')) {
            const manifest = `
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-batch
value: 10000
globalDefault: false
description: "Alias for velya-batch-low created by infra-health-agent"
`;
            const apply = kubectlApply(manifest);
            const last = findings[findings.length - 1];
            if (last) {
              last.remediation = apply.ok ? 'applied' : 'escalated';
              last.remediationDetail = apply.output;
              if (apply.ok) existingPcs.add('velya-batch');
            }
          }
        }
      }
    } catch (e) {
      console.error('[infra-health] failed parsing cronjobs JSON:', e);
    }
  }

  // 2. Check ServiceAccounts exist
  console.log('[infra-health] Checking ServiceAccount references…');
  if (cronJobs.ok) {
    try {
      const parsed = JSON.parse(cronJobs.stdout) as {
        items: Array<{
          metadata: { name: string; namespace: string };
          spec: {
            jobTemplate?: { spec?: { template?: { spec?: { serviceAccountName?: string } } } };
          };
        }>;
      };
      const checkedSas = new Set<string>();
      for (const cj of parsed.items) {
        const sa = cj.spec.jobTemplate?.spec?.template?.spec?.serviceAccountName;
        if (!sa || sa === 'default') continue;
        const key = `${cj.metadata.namespace}/${sa}`;
        if (checkedSas.has(key)) continue;
        checkedSas.add(key);

        const saCheck = kubectl(['get', 'sa', sa, '-n', cj.metadata.namespace, '-o', 'name']);
        if (!saCheck.ok) {
          findings.push({
            severity: 'high',
            rule: 'missing-service-account',
            description: `ServiceAccount ${sa} missing in namespace ${cj.metadata.namespace}`,
            namespace: cj.metadata.namespace,
            resource: `cronjob/${cj.metadata.name}`,
            remediation: 'none',
          });
          // Safe remediation: create empty SA with labels
          const saManifest = `
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ${sa}
  namespace: ${cj.metadata.namespace}
  labels:
    velya.io/owner: platform-ops
    velya.io/created-by: infra-health-agent
`;
          const apply = kubectlApply(saManifest);
          const last = findings[findings.length - 1];
          if (last) {
            last.remediation = apply.ok ? 'applied' : 'escalated';
            last.remediationDetail = apply.output;
          }
        }
      }
    } catch (e) {
      console.error('[infra-health] SA check parsing failed:', e);
    }
  }

  // 3. Detect duplicate HPAs (classic + KEDA targeting same deployment)
  console.log('[infra-health] Detecting duplicate HPAs…');
  const hpas = kubectl(['get', 'hpa', '-A', '-o', 'json']);
  if (hpas.ok) {
    try {
      const parsed = JSON.parse(hpas.stdout) as {
        items: Array<{
          metadata: { name: string; namespace: string };
          spec: { scaleTargetRef: { kind: string; name: string } };
        }>;
      };
      const byTarget = new Map<string, Array<{ ns: string; name: string }>>();
      for (const hpa of parsed.items) {
        const key = `${hpa.metadata.namespace}:${hpa.spec.scaleTargetRef.kind}/${hpa.spec.scaleTargetRef.name}`;
        const list = byTarget.get(key) ?? [];
        list.push({ ns: hpa.metadata.namespace, name: hpa.metadata.name });
        byTarget.set(key, list);
      }
      for (const [target, list] of byTarget) {
        if (list.length > 1) {
          // Keep the KEDA one (name starts with `keda-hpa-`), delete others
          const toDelete = list.filter((h) => !h.name.startsWith('keda-hpa-'));
          const toKeep = list.find((h) => h.name.startsWith('keda-hpa-'));
          if (toKeep) {
            for (const victim of toDelete) {
              findings.push({
                severity: 'medium',
                rule: 'duplicate-hpa',
                description: `Duplicate HPA targeting ${target} — keeping ${toKeep.name}, removing ${victim.name}`,
                namespace: victim.ns,
                resource: `hpa/${victim.name}`,
              });
              const del = kubectlDelete('hpa', victim.name, victim.ns);
              const last = findings[findings.length - 1];
              if (last) {
                last.remediation = del.ok ? 'applied' : 'escalated';
                last.remediationDetail = del.output;
              }
            }
          } else {
            // Both non-KEDA — escalate, we don't know which to keep
            findings.push({
              severity: 'medium',
              rule: 'duplicate-hpa-no-keda',
              description: `Multiple HPAs targeting ${target}: ${list.map((l) => l.name).join(', ')}`,
              remediation: 'escalated',
            });
          }
        }
      }
    } catch (e) {
      console.error('[infra-health] HPA check parsing failed:', e);
    }
  }

  // 4. Check for failing pods
  console.log('[infra-health] Scanning for failing pods…');
  const pods = kubectl([
    'get',
    'pods',
    '-A',
    '--field-selector=status.phase!=Running,status.phase!=Succeeded',
    '-o',
    'json',
  ]);
  if (pods.ok) {
    try {
      const parsed = JSON.parse(pods.stdout) as {
        items: Array<{
          metadata: { name: string; namespace: string };
          status: { phase: string; containerStatuses?: Array<{ state: { waiting?: { reason: string; message: string } } }> };
        }>;
      };
      for (const pod of parsed.items) {
        const waiting = pod.status.containerStatuses?.[0]?.state?.waiting;
        const reason = waiting?.reason ?? pod.status.phase;
        findings.push({
          severity: reason.includes('CrashLoop') || reason.includes('ImagePull') ? 'high' : 'medium',
          rule: 'pod-not-running',
          description: `Pod ${pod.metadata.namespace}/${pod.metadata.name} is ${reason}`,
          namespace: pod.metadata.namespace,
          resource: `pod/${pod.metadata.name}`,
          remediation: 'escalated',
          remediationDetail: waiting?.message ?? '',
        });
      }
    } catch (e) {
      console.error('[infra-health] pod check parsing failed:', e);
    }
  }

  // ── Backend dependency health probes ──────────────────────────────────
  // These checks are READ-ONLY. Every finding is `escalated` (never
  // auto-remediated) because the fix always requires either a config
  // change, a helm upgrade, or a human looking at the logs — none of
  // which this agent has the authority to do.
  if (SMOKE_OFFLINE) {
    console.log('[infra-health] VELYA_SMOKE_OFFLINE=true — skipping backend probes');
  } else {
    checkStatefulWorkload(findings, {
      kind: 'nats',
      namespace: NATS_NAMESPACE,
      label: NATS_LABEL,
      severity: 'high',
    });
    checkStatefulWorkload(findings, {
      kind: 'temporal',
      namespace: TEMPORAL_NAMESPACE,
      label: TEMPORAL_LABEL,
      severity: 'high',
    });
    checkStatefulWorkload(findings, {
      kind: 'postgres',
      namespace: POSTGRES_NAMESPACE,
      label: POSTGRES_LABEL,
      severity: 'critical',
    });
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
    agent: 'infra-health-agent',
    cluster: KUBECTL_CONTEXT || 'in-cluster',
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
      pr: findings.filter((f) => f.remediation === 'pr').length,
      escalated: findings.filter((f) => f.remediation === 'escalated').length,
      none: findings.filter((f) => !f.remediation || f.remediation === 'none').length,
    },
    findings,
  };

  ensureDir(join(OUT_DIR, 'infra-audit'));
  const outFile = join(OUT_DIR, 'infra-audit', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log(`[infra-health] ${findings.length} findings → ${outFile}`);
  console.log(
    `  severity: crit=${report.bySeverity.critical} high=${report.bySeverity.high} med=${report.bySeverity.medium} low=${report.bySeverity.low}`,
  );
  console.log(
    `  remediation: applied=${report.byRemediation.applied} escalated=${report.byRemediation.escalated} none=${report.byRemediation.none}`,
  );

  const nonRemediated = findings.filter((f) => f.remediation === 'escalated' || f.remediation === 'none');
  if (nonRemediated.some((f) => f.severity === 'critical' || f.severity === 'high')) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('[infra-health] Fatal:', error);
  process.exit(2);
});
