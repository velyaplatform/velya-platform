import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { isAiAdminEmail } from '@/lib/ai-permissions';
import { proposePromotions, summarizeLearnings } from '@/lib/learning-curator';

/**
 * /api/learning/curator
 *
 * SHADOW MODE endpoint for the learning curator loop.
 *
 * GET  — returns the current pattern summary. Any authenticated session.
 * POST — runs `proposePromotions()` (records advisory learnings for
 *        qualifying patterns). Restricted to admins. Never promotes an
 *        agent automatically — see .claude/rules/agents.md.
 */
export async function GET(_request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const patterns = summarizeLearnings();
  return NextResponse.json({ patterns });
}

export async function POST(_request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  if (!isAiAdminEmail(session.email) && session.professionalRole !== 'admin_system') {
    return NextResponse.json({ error: 'Sem permissão' }, { status: 403 });
  }

  const result = proposePromotions();
  return NextResponse.json({
    patternsScanned: result.patternsScanned,
    promotionsProposed: result.promotionsProposed,
    patternIds: result.patternIds,
  });
}
