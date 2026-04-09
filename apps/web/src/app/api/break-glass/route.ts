import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents } from '@/lib/event-store';
import { audit } from '@/lib/audit-logger';
import { ROLE_DEFINITIONS, resolveUiRole, type ProfessionalRole } from '@/lib/access-control';

const BREAK_GLASS_EVENT_TYPE = 'break_glass.session';
const BREAK_GLASS_DURATION_MS = 30 * 60 * 1000; // 30 minutes

interface BreakGlassSession {
  id: string;
  role: ProfessionalRole;
  displayName: string;
  patientId: string;
  justification: string;
  activatedAt: string;
  expiresAt: string;
  status: 'active' | 'expired' | 'revoked';
}

function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `bg-${timestamp}-${random}`;
}

/**
 * POST /api/break-glass
 *
 * Activate a break-glass session for emergency access.
 *
 * Body:
 * {
 *   role: string,           // UI role name or ProfessionalRole
 *   patientId: string,      // patient identifier
 *   justification: string,  // mandatory justification text (min 10 chars)
 * }
 *
 * Returns a temporary session with expiry (30 minutes).
 * Logged at MAXIMUM audit level. Creates notification event for supervisors.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role: roleParam, patientId, justification } = body;

    if (!roleParam || typeof roleParam !== 'string') {
      return NextResponse.json({ error: 'Campo "role" e obrigatorio' }, { status: 400 });
    }

    if (!patientId || typeof patientId !== 'string' || patientId.trim().length === 0) {
      return NextResponse.json({ error: 'Campo "patientId" e obrigatorio' }, { status: 400 });
    }

    if (!justification || typeof justification !== 'string' || justification.trim().length < 10) {
      return NextResponse.json(
        { error: 'Campo "justification" e obrigatorio (minimo 10 caracteres)' },
        { status: 400 },
      );
    }

    let professionalRole: ProfessionalRole;
    if (roleParam in ROLE_DEFINITIONS) {
      professionalRole = roleParam as ProfessionalRole;
    } else {
      professionalRole = resolveUiRole(roleParam);
    }

    const roleDef = ROLE_DEFINITIONS[professionalRole];

    // Only break-glass eligible roles can activate
    if (!roleDef || !roleDef.breakGlassEligible) {
      audit({
        category: 'api',
        action: 'break_glass.denied',
        description: `Tentativa de break-glass negada para ${professionalRole} — funcao nao elegivel`,
        actor: professionalRole,
        resource: `patient:${patientId.trim()}`,
        result: 'failure',
        details: { reason: 'Funcao nao elegivel para break-glass' },
      });

      return NextResponse.json(
        { error: 'Esta funcao nao e elegivel para acesso de emergencia (break-glass)' },
        { status: 403 },
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + BREAK_GLASS_DURATION_MS);
    const sessionId = generateSessionId();

    const session: BreakGlassSession = {
      id: sessionId,
      role: professionalRole,
      displayName: roleDef.displayName,
      patientId: patientId.trim(),
      justification: justification.trim(),
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'active',
    };

    // Log at MAXIMUM audit level
    audit({
      category: 'api',
      action: 'break_glass.activated',
      description: `Break-glass ativado por ${roleDef.displayName} para paciente ${patientId.trim()}`,
      actor: professionalRole,
      resource: `patient:${patientId.trim()}`,
      result: 'warning',
      details: {
        sessionId,
        displayName: roleDef.displayName,
        justification: justification.trim(),
        activatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        auditLevel: 'maximum',
      },
    });

    // Store session event
    appendEvent(BREAK_GLASS_EVENT_TYPE, {
      timestamp: now.toISOString(),
      source: 'break-glass-api',
      type: 'action',
      severity: 'critical',
      data: session as unknown as Record<string, unknown>,
    });

    // Create notification event for supervisors
    appendEvent('notification.break_glass', {
      timestamp: now.toISOString(),
      source: 'break-glass-api',
      type: 'alert',
      severity: 'critical',
      data: {
        title: 'Acesso de emergencia ativado',
        message: `${roleDef.displayName} ativou break-glass para paciente ${patientId.trim()}`,
        sessionId,
        role: professionalRole,
        patientId: patientId.trim(),
        justification: justification.trim(),
      },
    });

    return NextResponse.json({
      sessionId,
      role: professionalRole,
      patientId: patientId.trim(),
      activatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      durationMinutes: BREAK_GLASS_DURATION_MS / 60000,
      message: 'Acesso de emergencia ativado. Todas as acoes serao auditadas no nivel maximo.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/break-glass?role=<role>
 *
 * List active and recent break-glass sessions.
 * Only accessible to roles with view_audit_log permission.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');

    if (!roleParam) {
      return NextResponse.json(
        { error: 'Parametro "role" e obrigatorio para visualizar sessoes' },
        { status: 400 },
      );
    }

    let professionalRole: ProfessionalRole;
    if (roleParam in ROLE_DEFINITIONS) {
      professionalRole = roleParam as ProfessionalRole;
    } else {
      professionalRole = resolveUiRole(roleParam);
    }

    const roleDef = ROLE_DEFINITIONS[professionalRole];
    if (!roleDef || !roleDef.allowedActions.includes('view_audit_log')) {
      audit({
        category: 'api',
        action: 'break_glass.list.denied',
        description: `Acesso negado a lista de break-glass para ${professionalRole}`,
        actor: professionalRole,
        resource: 'break_glass.sessions',
        result: 'failure',
        details: { reason: 'Permissao view_audit_log ausente' },
      });

      return NextResponse.json(
        { error: 'Permissao insuficiente para visualizar sessoes break-glass' },
        { status: 403 },
      );
    }

    const { events: allEvents } = getEvents(BREAK_GLASS_EVENT_TYPE);
    const now = new Date();

    const sessions: BreakGlassSession[] = allEvents.map((event) => {
      const session = event.data as unknown as BreakGlassSession;
      if (session.status === 'active' && new Date(session.expiresAt) < now) {
        return { ...session, status: 'expired' as const };
      }
      return session;
    });

    // Sort most recent first
    sessions.sort((a, b) => new Date(b.activatedAt).getTime() - new Date(a.activatedAt).getTime());

    audit({
      category: 'api',
      action: 'break_glass.list.viewed',
      description: `Lista de sessoes break-glass consultada por ${professionalRole}`,
      actor: professionalRole,
      resource: 'break_glass.sessions',
      result: 'success',
      details: { sessionCount: sessions.length },
    });

    const activeSessions = sessions.filter((s) => s.status === 'active');
    const recentSessions = sessions.slice(0, 50);

    return NextResponse.json({
      active: activeSessions,
      recent: recentSessions,
      totalCount: sessions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
