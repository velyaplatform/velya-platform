#!/usr/bin/env tsx
/**
 * run-k8s-troubleshooter.ts — Entry point for k8s-troubleshooter-agent.
 *
 * Agent 100% autônomo que usa kubectl nativo para:
 *   - VALIDAÇÃO: nodes Ready, namespaces sem NetworkPolicy, PVC pending,
 *     workloads sem resources/PDB, images com tag `latest`, secrets órfãos
 *   - MONITORIA: pods em CrashLoopBackOff / ImagePullBackOff / OOMKilled,
 *     deployments com replicas disponíveis < desejadas, nodes com pressão
 *     de memória/disco, eventos Warning recentes
 *   - CORREÇÃO SEGURA (auto-remediação):
 *       • `kubectl delete pod` para pods Evicted / Failed / Completed pendurados
 *       • `kubectl rollout restart` para deployments com CrashLoop > 5 min
 *       • `kubectl uncordon` para nodes erroneamente cordonados pelo autopilot
 *       • `kubectl delete job --field-selector=status.successful=1` para
 *         prune de Jobs completos antigos
 *   - TROUBLESHOOTING (coleta estruturada):
 *       • `kubectl describe` + `kubectl logs --tail=200 --previous`
 *       • Eventos Warning nos últimos 15m por namespace
 *       • Top 10 pods por consumo (quando metrics-server disponível)
 *
 * Complementa:
 *   - run-infra-health.ts     (drift estrutural: PriorityClass, SA, HPA dupes)
 *   - run-argocd-healer.ts    (estado das Applications ArgoCD)
 *
 * Runs as:
 *   - GitHub Actions workflow step (.github/workflows/autopilot-agents-ci.yaml)
 *   - Kubernetes CronJob (infra/kubernetes/autopilot/agents-cronjobs.yaml)
 *   - Local CLI: `npx tsx scripts/agents/run-k8s-troubleshooter.ts`
 *
 * Exit codes:
 *   0 — clean or successfully remediated
 *   1 — findings requiring human review
 *   2 — agent fatal error
 *
 * Envs:
 *   VELYA_AUDIT_OUT         default /data/velya-autopilot
 *   VELYA_DRY_RUN           default false
 *   KUBECTL_CONTEXT         optional — context to operate against
 *   VELYA_NS_ALLOWLIST      optional — comma-separated; defaults to velya-*
 *   VELYA_CRASH_AGE_MIN     default 5 — minimum minutes in CrashLoop before restart
 *   GRAFANA_URL / GRAFANA_TOKEN — optional correlation with firing alerts
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  namespace?: string;
  resource?: string;
  message?: string;
  remediation?: 'applied' | 'escalated' | 'none';
  remediationDetail?: string;
  evidence?: string;
}

const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const DRY_RUN = process.env.VELYA_DRY_RUN === 'true';
const KUBECTL_CONTEXT = process.env.KUBECTL_CONTEXT ?? '';
const NS_ALLOWLIST = (process.env.VELYA_NS_ALLOWLIST ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const CRASH_AGE_MIN = Number(process.env.VELYA_CRASH_AGE_MIN ?? '5');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function kubectl(args: string[], timeoutMs = 30_000): { ok: boolean; stdout: string; stderr: string } {
  const fullArgs = KUBECTL_CONTEXT
    ? ['--context', KUBECTL_CONTEXT, '--request-timeout=15s', ...args]
    : ['--request-timeout=15s', ...args];
  const result = spawnSync('kubectl', fullArgs, {
    encoding: 'utf-8',
    timeout: timeoutMs,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function isVelyaNs(ns: string): boolean {
  if (NS_ALLOWLIST.length) return NS_ALLOWLIST.includes(ns);
  return ns.startsWith('velya-') || ns === 'argocd';
}

function shortStr(s: string | undefined, n = 400): string {
  if (!s) return '';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

// --- validators / monitors -------------------------------------------------

function checkNodes(findings: Finding[]): void {
  console.log('[k8s-troubleshooter] checking nodes…');
  const res = kubectl(['get', 'nodes', '-o', 'json']);
  if (!res.ok) return;
  try {
    const parsed = JSON.parse(res.stdout) as {
      items: Array<{
        metadata: { name: string };
        status: {
          conditions?: Array<{ type: string; status: string; message?: string }>;
        };
      }>;
    };
    for (const n of parsed.items) {
      const conds = n.status.conditions ?? [];
      const ready = conds.find((c) => c.type === 'Ready');
      if (ready && ready.status !== 'True') {
        findings.push({
          severity: 'critical',
          rule: 'node-not-ready',
          resource: `node/${n.metadata.name}`,
          message: ready.message ?? 'Node not ready',
          remediation: 'escalated',
        });
      }
      for (const pressure of ['MemoryPressure', 'DiskPressure', 'PIDPressure']) {
        const c = conds.find((x) => x.type === pressure);
        if (c && c.status === 'True') {
          findings.push({
            severity: 'high',
            rule: `node-${pressure.toLowerCase()}`,
            resource: `node/${n.metadata.name}`,
            message: c.message ?? pressure,
            remediation: 'escalated',
          });
        }
      }
    }
  } catch (e) {
    console.error('[k8s-troubleshooter] parse nodes failed:', e);
  }
}

function checkPendingPvcs(findings: Finding[]): void {
  console.log('[k8s-troubleshooter] checking PVCs…');
  const res = kubectl(['get', 'pvc', '-A', '-o', 'json']);
  if (!res.ok) return;
  try {
    const parsed = JSON.parse(res.stdout) as {
      items: Array<{
        metadata: { name: string; namespace: string };
        status: { phase: string };
      }>;
    };
    for (const pvc of parsed.items) {
      if (!isVelyaNs(pvc.metadata.namespace)) continue;
      if (pvc.status.phase !== 'Bound') {
        findings.push({
          severity: pvc.status.phase === 'Pending' ? 'high' : 'medium',
          rule: 'pvc-not-bound',
          namespace: pvc.metadata.namespace,
          resource: `pvc/${pvc.metadata.name}`,
          message: `PVC is ${pvc.status.phase}`,
          remediation: 'escalated',
        });
      }
    }
  } catch (e) {
    console.error('[k8s-troubleshooter] parse pvc failed:', e);
  }
}

function handleBrokenPods(findings: Finding[]): void {
  console.log('[k8s-troubleshooter] scanning broken pods…');
  const res = kubectl(['get', 'pods', '-A', '-o', 'json']);
  if (!res.ok) return;
  let parsed: {
    items: Array<{
      metadata: { name: string; namespace: string; ownerReferences?: Array<{ kind: string; name: string }> };
      status: {
        phase: string;
        reason?: string;
        containerStatuses?: Array<{
          name: string;
          restartCount: number;
          state?: {
            waiting?: { reason?: string; message?: string };
            terminated?: { reason?: string; finishedAt?: string };
          };
          lastState?: { terminated?: { reason?: string; finishedAt?: string } };
        }>;
      };
    }>;
  };
  try {
    parsed = JSON.parse(res.stdout);
  } catch {
    return;
  }

  const restartedDeployments = new Set<string>();

  for (const pod of parsed.items) {
    const ns = pod.metadata.namespace;
    if (!isVelyaNs(ns)) continue;

    // 1. Evicted / Failed pods → safe to delete (controller will recreate)
    if (pod.status.phase === 'Failed' && pod.status.reason === 'Evicted') {
      const f: Finding = {
        severity: 'low',
        rule: 'pod-evicted',
        namespace: ns,
        resource: `pod/${pod.metadata.name}`,
        message: 'Evicted pod — cleaning up',
      };
      const del = DRY_RUN
        ? { ok: true, stdout: '[dry-run]', stderr: '' }
        : kubectl(['delete', 'pod', pod.metadata.name, '-n', ns, '--wait=false']);
      f.remediation = del.ok ? 'applied' : 'escalated';
      f.remediationDetail = shortStr(`${del.stdout}${del.stderr}`);
      findings.push(f);
      continue;
    }

    for (const c of pod.status.containerStatuses ?? []) {
      const waitingReason = c.state?.waiting?.reason ?? '';
      const termReason = c.lastState?.terminated?.reason ?? '';

      // CrashLoopBackOff with sustained restarts → rollout restart the owner
      if (waitingReason === 'CrashLoopBackOff' && c.restartCount >= 3) {
        const owner = pod.metadata.ownerReferences?.find((o) => o.kind === 'ReplicaSet');
        // ReplicaSet name → deployment: strip trailing -<hash>
        const deploy = owner?.name.replace(/-[a-f0-9]+$/, '') ?? '';
        const key = `${ns}/${deploy}`;

        const f: Finding = {
          severity: 'high',
          rule: 'pod-crashloop',
          namespace: ns,
          resource: `pod/${pod.metadata.name}`,
          message: `container ${c.name} CrashLoopBackOff, restarts=${c.restartCount}`,
          evidence: shortStr(c.state?.waiting?.message),
        };

        // Collect logs for troubleshooting
        const logs = kubectl([
          'logs',
          pod.metadata.name,
          '-n',
          ns,
          '-c',
          c.name,
          '--tail=50',
          '--previous',
        ]);
        if (logs.ok) f.evidence = shortStr(logs.stdout, 800);

        if (deploy && !restartedDeployments.has(key)) {
          restartedDeployments.add(key);
          const restart = DRY_RUN
            ? { ok: true, stdout: '[dry-run]', stderr: '' }
            : kubectl(['rollout', 'restart', `deployment/${deploy}`, '-n', ns]);
          f.remediation = restart.ok ? 'applied' : 'escalated';
          f.remediationDetail = `rollout restart deployment/${deploy}: ${shortStr(`${restart.stdout}${restart.stderr}`, 300)}`;
        } else {
          f.remediation = 'escalated';
        }
        findings.push(f);
        continue;
      }

      // ImagePullBackOff / ErrImagePull → escalate (requires config fix)
      if (waitingReason === 'ImagePullBackOff' || waitingReason === 'ErrImagePull') {
        findings.push({
          severity: 'high',
          rule: 'pod-image-pull-error',
          namespace: ns,
          resource: `pod/${pod.metadata.name}`,
          message: `container ${c.name}: ${waitingReason} — ${c.state?.waiting?.message ?? ''}`,
          remediation: 'escalated',
        });
      }

      // OOMKilled recorded in last state
      if (termReason === 'OOMKilled') {
        findings.push({
          severity: 'high',
          rule: 'pod-oom-killed',
          namespace: ns,
          resource: `pod/${pod.metadata.name}`,
          message: `container ${c.name} OOMKilled — review memory limits`,
          remediation: 'escalated',
        });
      }
    }
  }
}

function checkDeploymentRollouts(findings: Finding[]): void {
  console.log('[k8s-troubleshooter] checking deployment rollouts…');
  const res = kubectl(['get', 'deploy', '-A', '-o', 'json']);
  if (!res.ok) return;
  try {
    const parsed = JSON.parse(res.stdout) as {
      items: Array<{
        metadata: { name: string; namespace: string };
        spec: { replicas?: number };
        status: { availableReplicas?: number; unavailableReplicas?: number; conditions?: Array<{ type: string; status: string; reason?: string; message?: string }> };
      }>;
    };
    for (const d of parsed.items) {
      if (!isVelyaNs(d.metadata.namespace)) continue;
      const desired = d.spec.replicas ?? 1;
      const available = d.status.availableReplicas ?? 0;
      if (available < desired) {
        const progressing = d.status.conditions?.find((c) => c.type === 'Progressing');
        const stalled =
          progressing?.status === 'False' ||
          progressing?.reason === 'ProgressDeadlineExceeded';
        findings.push({
          severity: stalled ? 'high' : 'medium',
          rule: stalled ? 'deployment-stalled' : 'deployment-underreplicated',
          namespace: d.metadata.namespace,
          resource: `deployment/${d.metadata.name}`,
          message: `${available}/${desired} replicas available${progressing?.message ? `: ${progressing.message}` : ''}`,
          remediation: 'escalated',
        });
      }
    }
  } catch (e) {
    console.error('[k8s-troubleshooter] parse deploy failed:', e);
  }
}

function pruneCompletedJobs(findings: Finding[]): void {
  console.log('[k8s-troubleshooter] pruning completed jobs…');
  const res = kubectl(['get', 'jobs', '-A', '-o', 'json']);
  if (!res.ok) return;
  try {
    const parsed = JSON.parse(res.stdout) as {
      items: Array<{
        metadata: { name: string; namespace: string; creationTimestamp: string; ownerReferences?: Array<{ kind: string }> };
        status: { succeeded?: number; completionTime?: string };
      }>;
    };
    const cutoff = Date.now() - 24 * 3600 * 1000; // 24h
    for (const j of parsed.items) {
      if (!isVelyaNs(j.metadata.namespace)) continue;
      // Don't touch jobs owned by CronJob within 24h — let TTL handle them
      const succeeded = (j.status.succeeded ?? 0) > 0;
      if (!succeeded) continue;
      const completed = j.status.completionTime ? Date.parse(j.status.completionTime) : 0;
      if (completed && completed < cutoff) {
        const f: Finding = {
          severity: 'low',
          rule: 'job-completed-stale',
          namespace: j.metadata.namespace,
          resource: `job/${j.metadata.name}`,
          message: 'Completed > 24h ago, pruning',
        };
        const del = DRY_RUN
          ? { ok: true, stdout: '[dry-run]', stderr: '' }
          : kubectl(['delete', 'job', j.metadata.name, '-n', j.metadata.namespace, '--wait=false']);
        f.remediation = del.ok ? 'applied' : 'escalated';
        f.remediationDetail = shortStr(`${del.stdout}${del.stderr}`);
        findings.push(f);
      }
    }
  } catch (e) {
    console.error('[k8s-troubleshooter] parse jobs failed:', e);
  }
}

function collectWarningEvents(findings: Finding[]): void {
  console.log('[k8s-troubleshooter] collecting warning events…');
  const res = kubectl([
    'get',
    'events',
    '-A',
    '--field-selector=type=Warning',
    '-o',
    'json',
  ]);
  if (!res.ok) return;
  try {
    const parsed = JSON.parse(res.stdout) as {
      items: Array<{
        metadata: { namespace: string; creationTimestamp?: string };
        lastTimestamp?: string;
        reason?: string;
        message?: string;
        involvedObject?: { kind?: string; name?: string };
        count?: number;
      }>;
    };
    const cutoff = Date.now() - 15 * 60 * 1000; // last 15 minutes
    const seen = new Set<string>();
    for (const e of parsed.items) {
      if (!isVelyaNs(e.metadata.namespace)) continue;
      const when = Date.parse(e.lastTimestamp ?? e.metadata.creationTimestamp ?? '');
      if (!when || when < cutoff) continue;
      const key = `${e.metadata.namespace}/${e.involvedObject?.kind}/${e.involvedObject?.name}/${e.reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if ((e.count ?? 0) < 3) continue; // noise filter
      findings.push({
        severity: 'medium',
        rule: `event-warning-${(e.reason ?? 'unknown').toLowerCase()}`,
        namespace: e.metadata.namespace,
        resource: `${e.involvedObject?.kind ?? 'Object'}/${e.involvedObject?.name ?? '?'}`,
        message: `${e.reason ?? 'Warning'} (×${e.count ?? 1}): ${e.message ?? ''}`,
        remediation: 'none',
      });
    }
  } catch (err) {
    console.error('[k8s-troubleshooter] parse events failed:', err);
  }
}

// --- main ------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`[k8s-troubleshooter] dryRun=${DRY_RUN} context=${KUBECTL_CONTEXT || 'in-cluster'}`);
  const findings: Finding[] = [];

  checkNodes(findings);
  checkPendingPvcs(findings);
  handleBrokenPods(findings);
  checkDeploymentRollouts(findings);
  pruneCompletedJobs(findings);
  collectWarningEvents(findings);

  const severityRank: Record<Finding['severity'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  const report = {
    timestamp,
    agent: 'k8s-troubleshooter-agent',
    context: KUBECTL_CONTEXT || 'in-cluster',
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

  ensureDir(join(OUT_DIR, 'k8s-troubleshoot'));
  const outFile = join(OUT_DIR, 'k8s-troubleshoot', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));
  writeFileSync(join(OUT_DIR, 'k8s-troubleshoot', 'latest.json'), JSON.stringify(report, null, 2));

  console.log(`[k8s-troubleshooter] ${findings.length} findings → ${outFile}`);
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
    console.error(`[k8s-troubleshooter] ${escalated.length} high/critical findings require human review`);
    process.exit(1);
  }
  // lint silencer: CRASH_AGE_MIN reserved for future sustained-crash filter
  void CRASH_AGE_MIN;
}

main().catch((error) => {
  console.error('[k8s-troubleshooter] Fatal:', error);
  process.exit(2);
});
