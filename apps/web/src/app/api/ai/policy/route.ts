import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { resolveAiPolicy } from '@/lib/ai-permissions';

/**
 * GET /api/ai/policy
 *
 * Returns the effective AI capability policy for the current user.
 * Frontend uses this to hide UI affordances the user can't activate.
 * The actual gate is enforced server-side in /api/ai/chat and friends.
 */
export async function GET() {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const policy = resolveAiPolicy({
    email: session.email,
    professionalRole: session.professionalRole,
  });

  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    professionalRole: session.professionalRole,
    email: session.email,
    policy: {
      label: policy.label,
      capabilities: policy.capabilities,
      maxTokensPerRequest: policy.maxTokensPerRequest,
      maxRequestsPerHour: policy.maxRequestsPerHour,
      requireCitations: policy.requireCitations,
    },
  });
}
