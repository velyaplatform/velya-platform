/**
 * offline-guard.ts — shared primitives for agents that must degrade to
 * a no-op when their external dependency is unreachable.
 *
 * Contract:
 *   - CI smoke sets VELYA_SMOKE_OFFLINE=true. Any agent that shells out
 *     to kubectl, argocd, aws, gh, docker, etc. must detect this and
 *     write an empty "offline" report instead of crashing (exit 2 is a
 *     contract violation in smoke mode — see autopilot-agents-ci.yaml).
 *   - Production CronJobs run without the flag and do the real work.
 *   - Missing kubeconfig is treated the same as offline mode, so devs
 *     can run agents on their laptop without auth.
 *
 * Extracted from the original triplicate implementations in
 * run-agent-health-manager.ts, run-agent-runtime-supervisor.ts and
 * run-frontend-quality.ts.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const OFFLINE_MODE = process.env.VELYA_SMOKE_OFFLINE === 'true';

/**
 * Probe whether kubectl can reach a cluster. Short-circuits to false
 * when VELYA_SMOKE_OFFLINE is set so CI smoke pays zero startup cost.
 * Result is cached per process so callers can invoke multiple times.
 */
let cachedKubectlReachable: boolean | null = null;
export function kubectlAvailable(context = process.env.KUBECTL_CONTEXT ?? ''): boolean {
  if (OFFLINE_MODE) return false;
  if (cachedKubectlReachable !== null) return cachedKubectlReachable;
  const probe = spawnSync(
    'kubectl',
    context
      ? ['--context', context, '--request-timeout=3s', 'version', '--output=json']
      : ['--request-timeout=3s', 'version', '--output=json'],
    { encoding: 'utf-8', timeout: 5000 },
  );
  if (probe.status !== 0) {
    cachedKubectlReachable = false;
    return false;
  }
  try {
    const parsed = JSON.parse(probe.stdout ?? '{}') as { serverVersion?: unknown };
    cachedKubectlReachable = parsed.serverVersion !== undefined;
  } catch {
    cachedKubectlReachable = false;
  }
  return cachedKubectlReachable;
}

interface OfflineReportOptions {
  agent: string;
  layer: number;
  outRoot: string;
  outSubdir: string;
  timestamp: string;
  reason: string;
  extra?: Record<string, unknown>;
}

/**
 * Write a uniform empty "offline" report and log its path. Callers
 * typically `return;` right after so main() exits 0.
 */
export function writeOfflineReport(opts: OfflineReportOptions): string {
  const dir = join(opts.outRoot, opts.outSubdir);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const file = join(dir, `${opts.timestamp}.offline.json`);
  writeFileSync(
    file,
    JSON.stringify(
      {
        timestamp: opts.timestamp,
        agent: opts.agent,
        layer: opts.layer,
        mode: 'offline',
        reason: opts.reason,
        totalFindings: 0,
        findings: [],
        ...opts.extra,
      },
      null,
      2,
    ),
  );
  console.log(`[${opts.agent}] offline report → ${file}`);
  return file;
}

/**
 * Wraps `main().catch(...)` with the offline-aware fatal handler every
 * agent needs: swallow errors with exit 0 in smoke mode, exit 2
 * otherwise so CronJobs alert on real failures.
 */
export function installOfflineFatalHandler(agent: string): (error: unknown) => never {
  return (error: unknown) => {
    console.error(`[${agent}] Fatal:`, error);
    if (OFFLINE_MODE) {
      console.error(`[${agent}] offline mode — swallowing error, exit 0`);
      process.exit(0);
    }
    process.exit(2);
  };
}

/**
 * Helper: resolve a human-readable reason for the offline report, so
 * logs clearly distinguish CI smoke from "dev forgot to set KUBECONFIG".
 */
export function offlineReason(): string {
  return OFFLINE_MODE
    ? 'VELYA_SMOKE_OFFLINE=true'
    : 'kubectl not reachable (no cluster context)';
}
