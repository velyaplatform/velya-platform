import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { CRON_JOBS } from '@/lib/cron-jobs';
import { listRuns } from '@/lib/cron-store';
import { getSchedulerStatus } from '@/lib/cron-scheduler';

/**
 * GET /api/cron/jobs
 * Returns the registry of cron jobs + the most recent run per job + scheduler status.
 */
export async function GET() {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const allRuns = listRuns({ limit: 200 });
  const lastRunByJob: Record<string, ReturnType<typeof listRuns>[number] | undefined> = {};
  for (const r of allRuns) {
    if (!lastRunByJob[r.jobId]) lastRunByJob[r.jobId] = r;
  }
  return NextResponse.json({
    jobs: CRON_JOBS.map((j) => ({
      ...j,
      lastRun: lastRunByJob[j.id] ?? null,
    })),
    scheduler: getSchedulerStatus(),
  });
}
