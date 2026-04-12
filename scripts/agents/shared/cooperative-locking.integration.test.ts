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

  // ADR-0016 follow-up #4: cross-agent namespace serialization.
  // The healer takes TWO locks in order — application then destination
  // namespace. This is the contract that prevents healer-vs-troubleshooter
  // races on the same cluster resource.
  it('troubleshooter cannot enter a namespace the healer is syncing into', () => {
    const destNs = 'velya-prod-clinical';

    // Healer enters — takes app lock + ns lock.
    const healerApp = acquireLock({
      agent: 'argocd-healer-agent',
      target: { kind: 'argocd-application', name: 'velya-api' },
      ttlMs: 10_000,
      lockDir,
    });
    const healerNs = acquireLock({
      agent: 'argocd-healer-agent',
      target: { kind: 'k8s-namespace', name: destNs },
      ttlMs: 10_000,
      lockDir,
    });
    expect(healerApp).not.toBeNull();
    expect(healerNs).not.toBeNull();

    // Troubleshooter tries to restart a deployment in the same ns — denied.
    const troubleshooterNs = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target: { kind: 'k8s-namespace', name: destNs },
      ttlMs: 10_000,
      lockDir,
    });
    expect(troubleshooterNs).toBeNull();

    // A troubleshooter mutation on a DIFFERENT namespace is still fine.
    const troubleshooterOther = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target: { kind: 'k8s-namespace', name: 'velya-prod-billing' },
      ttlMs: 10_000,
      lockDir,
    });
    expect(troubleshooterOther).not.toBeNull();
  });

  it('healer falls back to app-only locking when destination namespace is missing', () => {
    // When the ArgoCD Application has no `spec.destination.namespace`
    // (project-default or multi-ns render), only the application lock
    // is taken. The healer's behaviour in that path is exercised by
    // the production code — here we only verify the lock helper lets
    // a troubleshooter touch any namespace because the healer never
    // took a namespace lock.
    const app = acquireLock({
      agent: 'argocd-healer-agent',
      target: { kind: 'argocd-application', name: 'multi-ns-app' },
      ttlMs: 10_000,
      lockDir,
    });
    expect(app).not.toBeNull();

    const trouble = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target: { kind: 'k8s-namespace', name: 'velya-dev-core' },
      ttlMs: 10_000,
      lockDir,
    });
    expect(trouble).not.toBeNull();
  });
});
