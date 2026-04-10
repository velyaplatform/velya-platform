import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { isAiAdminEmail } from '@/lib/ai-permissions';
import { executeJobOnce } from '@/lib/cron-scheduler';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

/**
 * POST /api/cron/run/[jobId]
 *
 * Manually triggers a single cron job. Restricted to admins (admin allowlist
 * via ai-permissions or professionalRole = admin_system). The K8s CronJob
 * YAMLs in infra/kubernetes/bootstrap/velya-agent-cronjobs.yaml ALSO call
 * this endpoint with a service token (HEADER X-Velya-Cron-Token) on schedule.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { jobId } = await context.params;

  // Allow service token bypass (for K8s CronJobs hitting the endpoint)
  const cronToken = request.headers.get('x-velya-cron-token');
  const expectedToken = process.env.VELYA_CRON_TOKEN;
  let actor = 'service-account';
  if (!cronToken || cronToken !== expectedToken) {
    const session = await getSessionFromRequest();
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }
    if (
      !isAiAdminEmail(session.email) &&
      session.professionalRole !== 'admin_system'
    ) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
    }
    actor = session.email || session.userName || session.userId;
  }

  const result = await executeJobOnce(jobId);
  return NextResponse.json({ jobId, actor, ...result });
}
