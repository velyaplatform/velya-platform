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

import { execSync, spawnSync } from 'node:child_process';
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
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

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
