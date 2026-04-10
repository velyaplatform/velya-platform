/**
 * In-process cron scheduler.
 *
 * Singleton that starts on first /api/cron/start call (or auto-start on
 * first /api/cron/jobs GET when ENABLE_INPROCESS_CRON=true). Each registered
 * job has its own setInterval that calls the corresponding runner from
 * cron-runners.ts. The K8s CronJob YAML in
 * infra/kubernetes/bootstrap/velya-agent-cronjobs.yaml mirrors the same
 * schedule for production multi-replica deployments.
 *
 * The scheduler:
 *   1. Starts a run via cron-store.startRun()
 *   2. Calls the runner
 *   3. Finishes the run with success / partial / failed
 *   4. Triggers the agent loop on the produced findings (shadow mode)
 *
 * Concurrency guard: each job has an in-flight flag so a slow job doesn't
 * pile up. The next tick is skipped if the previous is still running.
 */

import { CRON_JOBS } from './cron-jobs';
import { getRunner } from './cron-runners';
import { finishRun, startRun } from './cron-store';
import { runAgentLoopForRun } from './agent-loop';
import { getAgentsForJob } from './agent-runtime';
import { recordAgentRun } from './agent-state';

interface SchedulerState {
  started: boolean;
  startedAt?: string;
  inFlight: Set<string>;
  intervals: Map<string, ReturnType<typeof setInterval>>;
}

const STATE: SchedulerState = {
  started: false,
  inFlight: new Set(),
  intervals: new Map(),
};

export async function executeJobOnce(jobId: string): Promise<{
  success: boolean;
  findingsCount: number;
  errorMessage?: string;
}> {
  const job = CRON_JOBS.find((j) => j.id === jobId);
  if (!job) {
    return { success: false, findingsCount: 0, errorMessage: 'Job não encontrado' };
  }
  if (STATE.inFlight.has(jobId)) {
    return { success: false, findingsCount: 0, errorMessage: 'Job já em execução' };
  }
  STATE.inFlight.add(jobId);
  const run = startRun(jobId);
  let findingsCount = 0;
  let errorMessage: string | undefined;
  let status: 'success' | 'partial' | 'failed' = 'success';
  try {
    const runner = getRunner(jobId);
    if (!runner) {
      throw new Error(`Sem runner registrado para ${jobId}`);
    }
    findingsCount = await runner({ jobId, runId: run.id });
    status = findingsCount > 0 ? 'partial' : 'success';
  } catch (err) {
    status = 'failed';
    errorMessage = err instanceof Error ? err.message : String(err);
  } finally {
    finishRun(
      run.id,
      status,
      `${findingsCount} achado(s) em ${jobId}`,
      errorMessage,
    );
    STATE.inFlight.delete(jobId);
  }

  // Run the agent loop on the new findings (shadow mode — never blocks the cron)
  void runAgentLoopForRun(run.id).catch(() => {
    // best effort
  });

  // Record the run against every agent that owns this job so the watchdog
  // scorecards stay current. Auto-quarantine kicks in inside recordAgentRun()
  // when scorecards drop below the thresholds in agent-governance.md.
  for (const agent of getAgentsForJob(jobId)) {
    recordAgentRun(agent.id, {
      success: status !== 'failed',
      correctionRecurred: false,
      evidenceComplete: status !== 'failed',
    });
  }

  return { success: status !== 'failed', findingsCount, errorMessage };
}

export function startScheduler(): { started: boolean; jobs: number } {
  if (STATE.started) {
    return { started: true, jobs: STATE.intervals.size };
  }
  STATE.started = true;
  STATE.startedAt = new Date().toISOString();
  for (const job of CRON_JOBS) {
    if (job.intervalMs == null) continue;
    const id = job.id;
    const handle = setInterval(() => {
      void executeJobOnce(id);
    }, job.intervalMs);
    STATE.intervals.set(id, handle);
  }
  return { started: true, jobs: STATE.intervals.size };
}

export function stopScheduler(): void {
  for (const handle of STATE.intervals.values()) {
    clearInterval(handle);
  }
  STATE.intervals.clear();
  STATE.started = false;
}

export function getSchedulerStatus(): {
  started: boolean;
  startedAt?: string;
  jobsScheduled: number;
  inFlight: string[];
} {
  return {
    started: STATE.started,
    startedAt: STATE.startedAt,
    jobsScheduled: STATE.intervals.size,
    inFlight: Array.from(STATE.inFlight),
  };
}
