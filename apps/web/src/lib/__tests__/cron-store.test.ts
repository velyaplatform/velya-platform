import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

type CronStoreModule = typeof import('../cron-store');

let store: CronStoreModule;
let storagePath: string;

async function freshStore(): Promise<CronStoreModule> {
  vi.resetModules();
  storagePath = join(tmpdir(), `velya-test-cron-${randomBytes(6).toString('hex')}.json`);
  process.env.VELYA_CRON_PATH = storagePath;
  // Ensure audit-logger (imported transitively) writes to /tmp too
  process.env.VELYA_AUDIT_PATH = join(
    tmpdir(),
    `velya-test-audit-${randomBytes(6).toString('hex')}`,
  );
  return (await import('../cron-store')) as CronStoreModule;
}

beforeEach(async () => {
  store = await freshStore();
});

afterEach(() => {
  if (storagePath && existsSync(storagePath)) {
    try {
      unlinkSync(storagePath);
    } catch {
      // best effort
    }
  }
  delete process.env.VELYA_CRON_PATH;
  delete process.env.VELYA_AUDIT_PATH;
});

describe('cron-store / runs', () => {
  it('startRun creates a run with status running and zero findings', () => {
    const run = store.startRun('frontend.route-health');
    expect(run.jobId).toBe('frontend.route-health');
    expect(run.status).toBe('running');
    expect(run.findingsCount).toBe(0);
    expect(run.id).toMatch(/^RUN-/);
    expect(typeof run.startedAt).toBe('string');
    expect(run.finishedAt).toBeUndefined();
  });

  it('finishRun sets finishedAt, duration and summary', () => {
    const run = store.startRun('job.a');
    const updated = store.finishRun(run.id, 'success', 'tudo ok');
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('success');
    expect(updated?.summary).toBe('tudo ok');
    expect(updated?.finishedAt).toBeDefined();
    expect(typeof updated?.durationMs).toBe('number');
    expect(updated?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('finishRun returns null for an unknown run id', () => {
    const updated = store.finishRun('RUN-missing', 'failed', 'noop');
    expect(updated).toBeNull();
  });

  it('finishRun stores the error message when provided', () => {
    const run = store.startRun('job.b');
    const updated = store.finishRun(run.id, 'failed', 'crashed', 'ECONNREFUSED');
    expect(updated?.errorMessage).toBe('ECONNREFUSED');
    expect(updated?.status).toBe('failed');
  });
});

describe('cron-store / findings', () => {
  it('createFinding increments findingsCount on its parent run', () => {
    const run = store.startRun('job.findings');
    store.createFinding({
      jobId: 'job.findings',
      runId: run.id,
      severity: 'high',
      surface: 'backend.api',
      target: '/api/patients',
      message: 'status 500 intermitente',
    });
    store.createFinding({
      jobId: 'job.findings',
      runId: run.id,
      severity: 'low',
      surface: 'backend.api',
      target: '/api/staff',
      message: 'lento',
    });
    const [latestRun] = store.listRuns({ jobId: 'job.findings' });
    expect(latestRun.findingsCount).toBe(2);
  });

  it('listFindings filters by severity, surface, jobId, status and limit', () => {
    const run = store.startRun('job.filter');
    store.createFinding({
      jobId: 'job.filter',
      runId: run.id,
      severity: 'critical',
      surface: 'backend.api',
      target: '/api/x',
      message: 'x',
    });
    store.createFinding({
      jobId: 'job.filter',
      runId: run.id,
      severity: 'low',
      surface: 'frontend.route',
      target: '/dashboard',
      message: 'y',
    });
    store.createFinding({
      jobId: 'job.other',
      runId: run.id,
      severity: 'critical',
      surface: 'backend.api',
      target: '/api/z',
      message: 'z',
    });

    const critical = store.listFindings({ severity: 'critical' });
    expect(critical).toHaveLength(2);

    const apiFindings = store.listFindings({ surface: 'backend.api' });
    expect(apiFindings.length).toBe(2);

    const byJob = store.listFindings({ jobId: 'job.filter' });
    expect(byJob).toHaveLength(2);

    const limited = store.listFindings({ limit: 1 });
    expect(limited).toHaveLength(1);

    const newStatus = store.listFindings({ status: 'new' });
    expect(newStatus.length).toBe(3);
  });

  it('updateFinding sets resolvedBy and resolvedAt when status changes', () => {
    const run = store.startRun('job.resolve');
    const finding = store.createFinding({
      jobId: 'job.resolve',
      runId: run.id,
      severity: 'medium',
      surface: 'data.fixture',
      target: 'mrn-001',
      message: 'órfão',
    });
    const updated = store.updateFinding(
      finding.id,
      { status: 'resolved-manual', resolutionNote: 'corrigido' },
      'joao@velya',
    );
    expect(updated).not.toBeNull();
    expect(updated?.status).toBe('resolved-manual');
    expect(updated?.resolvedBy).toBe('joao@velya');
    expect(updated?.resolvedAt).toBeDefined();
  });

  it('updateFinding returns null for unknown id', () => {
    const result = store.updateFinding('FND-missing', { status: 'dismissed' }, 'actor');
    expect(result).toBeNull();
  });

  it('getFinding retrieves a finding by id or returns null', () => {
    const run = store.startRun('job.get');
    const f = store.createFinding({
      jobId: 'job.get',
      runId: run.id,
      severity: 'info',
      surface: 'backend.api',
      target: 'x',
      message: 'y',
    });
    expect(store.getFinding(f.id)?.id).toBe(f.id);
    expect(store.getFinding('FND-missing')).toBeNull();
  });
});

describe('cron-store / learnings', () => {
  it('recordLearning creates a new learning on first call', () => {
    const learning = store.recordLearning({
      patternId: 'pattern-1',
      observation: 'obs',
      recommendation: 'rec',
    });
    expect(learning.occurrences).toBe(1);
    expect(learning.patternId).toBe('pattern-1');
    expect(learning.id).toMatch(/^LRN-/);
  });

  it('recordLearning increments occurrences when the pattern already exists', () => {
    store.recordLearning({ patternId: 'dup', observation: 'a', recommendation: 'b' });
    const again = store.recordLearning({
      patternId: 'dup',
      observation: 'a2',
      recommendation: 'b2',
    });
    expect(again.occurrences).toBe(2);
    expect(again.observation).toBe('a2');
    expect(again.recommendation).toBe('b2');
    expect(store.listLearnings().filter((l) => l.patternId === 'dup')).toHaveLength(1);
  });
});
