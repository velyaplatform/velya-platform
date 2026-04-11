import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';

type CronStoreModule = typeof import('../cron-store');
type CuratorModule = typeof import('../learning-curator');
type Severity = import('../cron-store').Severity;
type Surface = import('../cron-store').Surface;

let cronStore: CronStoreModule;
let curator: CuratorModule;
let storagePath: string;

async function freshModules(): Promise<void> {
  vi.resetModules();
  storagePath = join(tmpdir(), `velya-test-cron-${randomBytes(6).toString('hex')}.json`);
  process.env.VELYA_CRON_PATH = storagePath;
  process.env.VELYA_AUDIT_PATH = join(
    tmpdir(),
    `velya-test-audit-${randomBytes(6).toString('hex')}`,
  );
  cronStore = (await import('../cron-store')) as CronStoreModule;
  curator = (await import('../learning-curator')) as CuratorModule;
}

interface SeedOverrides {
  surface?: Surface;
  target?: string;
  severity?: Severity;
}

function seedFindings(
  store: CronStoreModule,
  jobId: string,
  count: number,
  overrides: SeedOverrides = {},
): void {
  const run = store.startRun(jobId);
  for (let i = 0; i < count; i += 1) {
    store.createFinding({
      jobId,
      runId: run.id,
      severity: overrides.severity ?? 'high',
      surface: overrides.surface ?? 'backend.api',
      target: overrides.target ?? '/api/patients',
      message: `falha ${i}`,
    });
  }
}

beforeEach(async () => {
  await freshModules();
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

describe('learning-curator / summarizeLearnings', () => {
  it('returns an empty array when no findings exist', () => {
    const patterns = curator.summarizeLearnings();
    expect(patterns).toEqual([]);
  });

  it('groups findings by (surface + target) into a single pattern', () => {
    seedFindings(cronStore, 'job.one', 3, {
      surface: 'backend.api',
      target: '/api/x',
      severity: 'medium',
    });
    const patterns = curator.summarizeLearnings();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].occurrences).toBe(3);
    expect(patterns[0].surface).toBe('backend.api');
    expect(patterns[0].targetSample).toBe('/api/x');
    expect(patterns[0].severities.medium).toBe(3);
  });

  it('groups by details.field when present instead of by target', () => {
    const run = cronStore.startRun('job.field');
    cronStore.createFinding({
      jobId: 'job.field',
      runId: run.id,
      severity: 'low',
      surface: 'compliance.field-link',
      target: 'module-a',
      message: 'missing',
      details: { field: 'patientMrn' },
    });
    cronStore.createFinding({
      jobId: 'job.field',
      runId: run.id,
      severity: 'low',
      surface: 'compliance.field-link',
      target: 'module-b',
      message: 'missing',
      details: { field: 'patientMrn' },
    });
    const patterns = curator.summarizeLearnings();
    expect(patterns).toHaveLength(1);
    expect(patterns[0].patternId).toContain('field::patientMrn');
    expect(patterns[0].occurrences).toBe(2);
  });

  it('sets qualifiesForPromotion=false when occurrences < 5', () => {
    seedFindings(cronStore, 'job.low', 3, { target: '/low' });
    const patterns = curator.summarizeLearnings();
    expect(patterns[0].qualifiesForPromotion).toBe(false);
  });

  it('sets qualifiesForPromotion=true when occurrences >= 5 and confidence > 0.7', () => {
    seedFindings(cronStore, 'job.qual', 8, { target: '/q' });
    const patterns = curator.summarizeLearnings();
    expect(patterns[0].occurrences).toBe(8);
    expect(patterns[0].confidence).toBeGreaterThan(0.7);
    expect(patterns[0].qualifiesForPromotion).toBe(true);
  });

  it('sorts patterns by occurrences descending', () => {
    seedFindings(cronStore, 'job.top', 5, { target: '/top' });
    seedFindings(cronStore, 'job.bot', 2, { target: '/bot' });
    const patterns = curator.summarizeLearnings();
    expect(patterns.length).toBeGreaterThanOrEqual(2);
    expect(patterns[0].occurrences).toBeGreaterThanOrEqual(patterns[1].occurrences);
  });
});

describe('learning-curator / proposePromotions', () => {
  it('records learnings for qualifying patterns and returns their ids', () => {
    seedFindings(cronStore, 'job.q', 8, { target: '/qual' });
    const result = curator.proposePromotions();
    expect(result.patternsScanned).toBeGreaterThanOrEqual(1);
    expect(result.promotionsProposed).toBe(1);
    expect(result.patternIds).toHaveLength(1);

    const learnings = cronStore.listLearnings();
    expect(learnings.length).toBe(1);
    expect(learnings[0].patternId).toBe(result.patternIds[0]);
  });

  it('does not propose promotions when no pattern qualifies', () => {
    seedFindings(cronStore, 'job.small', 3, { target: '/tiny' });
    const result = curator.proposePromotions();
    expect(result.promotionsProposed).toBe(0);
    expect(result.patternIds).toEqual([]);
    expect(cronStore.listLearnings()).toHaveLength(0);
  });
});
