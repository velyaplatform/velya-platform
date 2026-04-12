import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  acquireLock,
  releaseLock,
  listLocks,
  withLock,
  type LockTarget,
} from './session-lock.js';

describe('session-lock', () => {
  let lockDir: string;

  beforeEach(() => {
    lockDir = mkdtempSync(join(tmpdir(), 'velya-lock-'));
  });
  afterEach(() => {
    rmSync(lockDir, { recursive: true, force: true });
  });

  const target: LockTarget = { kind: 'argocd-application', name: 'velya-api' };

  it('acquires an exclusive lock on first try', () => {
    const lock = acquireLock({
      agent: 'argocd-healer-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    expect(lock).not.toBeNull();
    expect(lock?.agent).toBe('argocd-healer-agent');
    expect(lock?.target.name).toBe('velya-api');
  });

  it('refuses a second acquire while the first is live', () => {
    const first = acquireLock({
      agent: 'argocd-healer-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    expect(first).not.toBeNull();
    const second = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    expect(second).toBeNull();
  });

  it('breaks a stale lock and grants a new one', () => {
    // Write a pre-expired lock directly
    const expired = {
      lockId: 'stale-1',
      agent: 'ghost-agent',
      target,
      acquiredAt: new Date(Date.now() - 3_600_000).toISOString(),
      expiresAt: new Date(Date.now() - 1_800_000).toISOString(),
      holder: { runner: 'local-cli', runId: 'ghost' },
    };
    writeFileSync(
      join(lockDir, 'argocd-application__velya-api.lock.json'),
      JSON.stringify(expired),
    );

    const fresh = acquireLock({
      agent: 'argocd-healer-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    expect(fresh).not.toBeNull();
    expect(fresh?.agent).toBe('argocd-healer-agent');
  });

  it('releases correctly and allows re-acquire', () => {
    const lock = acquireLock({
      agent: 'argocd-healer-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    expect(lock).not.toBeNull();
    releaseLock(lock!, lockDir);
    const next = acquireLock({
      agent: 'k8s-troubleshooter-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    expect(next).not.toBeNull();
  });

  it('listLocks returns live locks with age', () => {
    acquireLock({
      agent: 'argocd-healer-agent',
      target,
      ttlMs: 10_000,
      lockDir,
    });
    const live = listLocks(lockDir);
    expect(live).toHaveLength(1);
    expect(live[0].stale).toBe(false);
    expect(live[0].ageMs).toBeGreaterThanOrEqual(0);
  });

  it('withLock runs the fn when available and skips when busy', async () => {
    let count = 0;
    const r1 = await withLock(
      { agent: 'argocd-healer-agent', target, ttlMs: 10_000, lockDir },
      async () => {
        count++;
        // While inside, a second attempt must fail
        const r2 = await withLock(
          { agent: 'k8s-troubleshooter-agent', target, ttlMs: 10_000, lockDir },
          async () => {
            count++;
            return 'should-not-run';
          },
        );
        expect(r2).toBeNull();
        return 'ok';
      },
    );
    expect(r1).toBe('ok');
    expect(count).toBe(1);
  });
});
