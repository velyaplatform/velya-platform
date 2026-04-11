/**
 * Integration test for the cooperative-locking migration (ADR-0016 follow-up #1).
 *
 * Verifies that when `run-argocd-healer-agent` holds a session lock for an
 * ArgoCD application, a second caller cannot acquire the same lock — and
 * that releasing it lets a peer proceed. These guarantees are the
 * contract both `run-argocd-healer.ts` and `run-k8s-troubleshooter.ts`
 * rely on when `VELYA_COOPERATIVE_LOCKING=true`.
 *
 * We do not exercise the agents' full main() here because they require
 * kubectl/argocd CLI. The goal is to prove the lock primitive behaves as
 * the migration assumes: acquire → hold → peer denied → release → peer OK.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { acquireLock, releaseLock, type LockTarget } from './session-lock.js';

describe('cooperative-locking contract for migration', () => {
  let lockDir: string;

  beforeEach(() => {
    lockDir = mkdtempSync(join(tmpdir(), 'velya-coop-'));
  });
  afterEach(() => {
    rmSync(lockDir, { recursive: true, force: true });
  });

  it('healer and troubleshooter serialize on the same argocd-application target', () => {
    const target: LockTarget = {
      kind: 'argocd-application',
      name: 'velya-api',
      namespace: 'argocd',
    };

    const healer = acquireLock({
      agent: 'argocd-healer-agent',
      target,
      ttlMs: 10_000,
      reason: 'sync OutOfSync app',
      lockDir,
    });
    expect(healer).not.toBeNull();

    // Troubleshooter attempts the same target — denied.
    const troubleshooter = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target,
      ttlMs: 10_000,
      reason: 'rollout restart velya-api',
      lockDir,
    });
    expect(troubleshooter).toBeNull();

    // Healer finishes and releases.
    releaseLock(healer!, lockDir);

    // Peer can now acquire.
    const second = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target,
      ttlMs: 10_000,
      reason: 'rollout restart velya-api',
      lockDir,
    });
    expect(second).not.toBeNull();
    expect(second?.agent).toBe('k8s-troubleshooter-agent');
  });

  it('namespace-level locks for troubleshooter are independent per namespace', () => {
    const a = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target: { kind: 'k8s-namespace', name: 'velya-dev-core' },
      ttlMs: 10_000,
      lockDir,
    });
    const b = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target: { kind: 'k8s-namespace', name: 'velya-dev-platform' },
      ttlMs: 10_000,
      lockDir,
    });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
  });

  it('healer refuses when a peer instance holds the same application lock', () => {
    const target: LockTarget = { kind: 'argocd-application', name: 'velya-clinical' };

    const instance1 = acquireLock({
      agent: 'argocd-healer-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    const instance2 = acquireLock({
      agent: 'argocd-healer-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    expect(instance1).not.toBeNull();
    expect(instance2).toBeNull();
  });
});
