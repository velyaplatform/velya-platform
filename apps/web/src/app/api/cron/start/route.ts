import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { isAiAdminEmail } from '@/lib/ai-permissions';
import { startScheduler, stopScheduler, getSchedulerStatus } from '@/lib/cron-scheduler';

/**
 * GET    /api/cron/start  → returns scheduler status
 * POST   /api/cron/start  → starts the in-process scheduler (admin only)
 * DELETE /api/cron/start  → stops it
 *
 * In production with K8s CronJobs configured, the in-process scheduler is
 * usually NOT started — the K8s CronJobs hit /api/cron/run/[jobId] on
 * schedule. The in-process scheduler exists for dev/single-replica setups.
 */

export async function GET() {
  return NextResponse.json(getSchedulerStatus());
}

export async function POST() {
  const session = await getSessionFromRequest();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!isAiAdminEmail(session.email) && session.professionalRole !== 'admin_system') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  const result = startScheduler();
  return NextResponse.json({ ...result, ...getSchedulerStatus() });
}

export async function DELETE() {
  const session = await getSessionFromRequest();
  if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  if (!isAiAdminEmail(session.email) && session.professionalRole !== 'admin_system') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }
  stopScheduler();
  return NextResponse.json(getSchedulerStatus());
}
