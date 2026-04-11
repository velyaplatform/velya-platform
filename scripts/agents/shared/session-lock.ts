/**
 * session-lock.ts — cooperative file-based lock for autonomous agents.
 *
 * Why this exists: argocd-healer-agent, k8s-troubleshooter-agent and
 * meta-governance-auditor-agent all run on overlapping schedules. Without a
 * shared lock, two of them can race on the same ArgoCD application or k8s
 * namespace and produce inconsistent remediations (e.g. healer reverting a
 * change the troubleshooter just applied).
 *
 * Design:
 *   - Locks are JSON files written under VELYA_AUDIT_OUT/locks/.
 *   - Each lock conforms to schemas/agent-session-lock.schema.json.
 *   - A lock is considered *held* if its file exists AND `expiresAt > now`.
 *   - Stale locks (past `expiresAt`) may be broken by any agent. The
 *     breaker records the broken lock under locks/broken/ for audit.
 *   - No cross-process atomicity is assumed — the lock directory should
 *     live on a shared PVC in-cluster, or on the runner FS in CI. Either
 *     way, collisions are resolved by O_EXCL open and a final
 *     read-back check.
 *
 * Usage:
 *   const lock = await acquireLock({
 *     agent: 'argocd-healer-agent',
 *     target: { kind: 'argocd-application', name: 'velya-api' },
 *     ttlMs: 5 * 60 * 1000,
 *     reason: 'sync OutOfSync app',
 *   });
 *   if (!lock) return; // another agent holds it
 *   try {
 *     // ... do the work ...
 *   } finally {
 *     releaseLock(lock);
 *   }
 */

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

export type LockTargetKind =
  | 'k8s-namespace'
  | 'k8s-workload'
  | 'argocd-application'
  | 'memory-file'
  | 'pvc'
  | 'workflow'
  | 'fhir-resource';

export interface LockTarget {
  kind: LockTargetKind;
  name: string;
  namespace?: string;
}

export interface AgentSessionLock {
  lockId: string;
  agent: string;
  target: LockTarget;
  acquiredAt: string;
  expiresAt: string;
  holder: {
    runner: 'github-actions' | 'kubernetes-cronjob' | 'local-cli';
    runId: string;
    workflow?: string;
    jobUrl?: string;
    host?: string;
  };
  reason?: string;
  correlationId?: string;
}

export interface AcquireOptions {
  agent: string;
  target: LockTarget;
  ttlMs: number;
  reason?: string;
  correlationId?: string;
  /** Override the lock directory. Defaults to `${VELYA_AUDIT_OUT}/locks`. */
  lockDir?: string;
}

const DEFAULT_LOCK_DIR = (): string => {
  const base = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
  return join(base, 'locks');
};

function detectRunner(): AgentSessionLock['holder']['runner'] {
  if (process.env.GITHUB_ACTIONS === 'true') return 'github-actions';
  if (process.env.KUBERNETES_SERVICE_HOST) return 'kubernetes-cronjob';
  return 'local-cli';
}

function currentHolder(): AgentSessionLock['holder'] {
  return {
    runner: detectRunner(),
    runId: process.env.GITHUB_RUN_ID ?? process.env.VELYA_RUN_ID ?? randomUUID(),
    workflow: process.env.GITHUB_WORKFLOW,
    jobUrl:
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined,
    host: hostname(),
  };
}

function lockFilename(target: LockTarget): string {
  const ns = target.namespace ? `${target.namespace}__` : '';
  const safe = `${target.kind}__${ns}${target.name}`.replace(/[^a-z0-9-_.]/gi, '_');
  return `${safe}.lock.json`;
}

function readLockIfPresent(path: string): AgentSessionLock | null {
  try {
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as AgentSessionLock;
  } catch {
    return null;
  }
}

function isExpired(lock: AgentSessionLock, now: Date = new Date()): boolean {
  return new Date(lock.expiresAt).getTime() < now.getTime();
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

/**
 * Attempt to acquire an exclusive lock for the given target.
 * Returns the lock on success, or null if another agent holds it.
 * Stale locks are broken automatically.
 */
export function acquireLock(options: AcquireOptions): AgentSessionLock | null {
  const lockDir = options.lockDir ?? DEFAULT_LOCK_DIR();
  ensureDir(lockDir);
  const path = join(lockDir, lockFilename(options.target));

  // 1. check existing lock
  const existing = readLockIfPresent(path);
  if (existing && !isExpired(existing)) {
    return null; // held by someone alive
  }
  if (existing && isExpired(existing)) {
    // move to broken/ for audit
    const brokenDir = join(lockDir, 'broken');
    ensureDir(brokenDir);
    const brokenPath = join(
      brokenDir,
      `${existing.lockId}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    try {
      renameSync(path, brokenPath);
    } catch {
      // race: another process broke it first; keep going
    }
  }

  // 2. try to create exclusively (O_EXCL) — this is the atomic step
  const now = new Date();
  const lock: AgentSessionLock = {
    lockId: randomUUID(),
    agent: options.agent,
    target: options.target,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + options.ttlMs).toISOString(),
    holder: currentHolder(),
    reason: options.reason,
    correlationId: options.correlationId,
  };

  try {
    // 'wx' = O_WRONLY | O_CREAT | O_EXCL — fails if file exists
    const fd = openSync(path, 'wx');
    writeSync(fd, JSON.stringify(lock, null, 2));
    closeSync(fd);
  } catch (err) {
    // Someone beat us — re-read to confirm
    const winner = readLockIfPresent(path);
    if (winner && !isExpired(winner)) return null;
    // Lost race but lock is already stale again — fail closed rather than loop
    return null;
  }

  // 3. read-back sanity check — protect against FS quirks on shared PVCs
  const readBack = readLockIfPresent(path);
  if (!readBack || readBack.lockId !== lock.lockId) {
    return null;
  }
  return lock;
}

export function releaseLock(
  lock: AgentSessionLock,
  lockDir: string = DEFAULT_LOCK_DIR(),
): void {
  const path = join(lockDir, lockFilename(lock.target));
  const current = readLockIfPresent(path);
  if (!current || current.lockId !== lock.lockId) {
    // Someone else owns it now — do not touch
    return;
  }
  try {
    unlinkSync(path);
  } catch {
    // idempotent
  }
}

export interface HeldLockView {
  lock: AgentSessionLock;
  path: string;
  ageMs: number;
  stale: boolean;
}

/** List every live lock in the given directory (used by the sentinel). */
export function listLocks(lockDir: string = DEFAULT_LOCK_DIR()): HeldLockView[] {
  if (!existsSync(lockDir)) return [];
  const now = Date.now();
  const entries: HeldLockView[] = [];
  for (const file of readdirSync(lockDir)) {
    if (!file.endsWith('.lock.json')) continue;
    const path = join(lockDir, file);
    try {
      const stat = statSync(path);
      const lock = readLockIfPresent(path);
      if (!lock) continue;
      entries.push({
        lock,
        path,
        // Clamp at 0 — some filesystems report slightly future mtimes due
        // to clock skew between the runner and a shared PVC.
        ageMs: Math.max(0, now - stat.mtimeMs),
        stale: isExpired(lock, new Date(now)),
      });
    } catch {
      // transient FS errors are ignored — sentinel will retry
    }
  }
  return entries;
}

/**
 * Convenience wrapper: run `fn` under a lock. If the lock cannot be
 * acquired, `fn` is skipped and the function returns `null`.
 */
export async function withLock<T>(
  options: AcquireOptions,
  fn: (lock: AgentSessionLock) => Promise<T>,
): Promise<T | null> {
  const lock = acquireLock(options);
  if (!lock) return null;
  try {
    return await fn(lock);
  } finally {
    releaseLock(lock, options.lockDir);
  }
}

/** Used by tests and the sentinel to forcibly release all locks for a target. */
export function forceReleaseLocksForTarget(
  target: LockTarget,
  lockDir: string = DEFAULT_LOCK_DIR(),
): void {
  const path = join(lockDir, lockFilename(target));
  if (existsSync(path)) {
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  }
}

export function __internal__writeBrokenLockForTest(
  lock: AgentSessionLock,
  lockDir: string = DEFAULT_LOCK_DIR(),
): void {
  ensureDir(lockDir);
  writeFileSync(join(lockDir, lockFilename(lock.target)), JSON.stringify(lock));
}
