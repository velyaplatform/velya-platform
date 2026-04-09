import { NextRequest, NextResponse } from 'next/server';
import { appendEvent } from '@/lib/event-store';
import { audit } from '@/lib/audit-logger';
import {
  ROLE_DEFINITIONS,
  isAllowed,
  canAccessDataClass,
  getAuditLevel,
  resolveUiRole,
  type AuthContext,
  type AccessAction,
  type DataClass,
  type ProfessionalRole,
} from '@/lib/access-control';

/**
 * GET /api/access?role=<uiRole|professionalRole>
 *
 * Returns the full permission set for a given role:
 * - allowed actions, data classes, navigation sections
 * - access level, audit level, break-glass eligibility
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role');

    if (!roleParam) {
      return NextResponse.json({ error: 'Parametro "role" e obrigatorio' }, { status: 400 });
    }

    let professionalRole: ProfessionalRole;
    if (roleParam in ROLE_DEFINITIONS) {
      professionalRole = roleParam as ProfessionalRole;
    } else {
      professionalRole = resolveUiRole(roleParam);
    }

    const roleDef = ROLE_DEFINITIONS[professionalRole];
    if (!roleDef) {
      return NextResponse.json({ error: 'Funcao nao encontrada' }, { status: 404 });
    }

    audit({
      category: 'api',
      action: 'access.permissions.read',
      description: `Permissoes consultadas para funcao ${roleDef.displayName}`,
      actor: professionalRole,
      resource: `role:${professionalRole}`,
      result: 'success',
    });

    return NextResponse.json({
      role: professionalRole,
      displayName: roleDef.displayName,
      professionalCouncil: roleDef.professionalCouncil ?? null,
      accessLevel: roleDef.accessLevel,
      auditLevel: roleDef.auditLevel,
      allowedDataClasses: roleDef.allowedDataClasses,
      allowedActions: roleDef.allowedActions,
      allowedNavSections: roleDef.allowedNavSections,
      breakGlassEligible: roleDef.breakGlassEligible,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/access
 *
 * Check if a specific action or data class access is allowed for a given context.
 *
 * Body:
 * {
 *   role: string,
 *   action?: AccessAction,
 *   dataClass?: DataClass,
 *   unit?: string,
 *   shift?: string,
 *   patientRelationship?: string,
 *   isBreakGlass?: boolean,
 *   workstationId?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      role: roleParam,
      action,
      dataClass,
      unit,
      shift,
      patientRelationship,
      isBreakGlass,
      workstationId,
    } = body;

    if (!roleParam || typeof roleParam !== 'string') {
      return NextResponse.json({ error: 'Campo "role" e obrigatorio' }, { status: 400 });
    }

    if (!action && !dataClass) {
      return NextResponse.json(
        { error: 'Informe "action" ou "dataClass" para verificar' },
        { status: 400 },
      );
    }

    let professionalRole: ProfessionalRole;
    if (roleParam in ROLE_DEFINITIONS) {
      professionalRole = roleParam as ProfessionalRole;
    } else {
      professionalRole = resolveUiRole(roleParam);
    }

    const context: AuthContext = {
      role: professionalRole,
      unit,
      shift,
      patientRelationship,
      isBreakGlass: isBreakGlass === true,
      workstationId,
    };

    const result: {
      role: ProfessionalRole;
      actionAllowed?: boolean;
      dataClassAllowed?: boolean;
      action?: string;
      dataClass?: string;
      isBreakGlass: boolean;
    } = {
      role: professionalRole,
      isBreakGlass: isBreakGlass === true,
    };

    if (action) {
      result.action = action;
      result.actionAllowed = isAllowed(context, action as AccessAction);
    }

    if (dataClass) {
      result.dataClass = dataClass;
      result.dataClassAllowed = canAccessDataClass(context, dataClass as DataClass);
    }

    const auditLevel = getAuditLevel(professionalRole);

    audit({
      category: 'api',
      action: 'access.check',
      description: `Verificacao de acesso: ${action ?? ''} ${dataClass ?? ''} para ${professionalRole}`,
      actor: professionalRole,
      resource: action ? `action:${action}` : `dataClass:${dataClass}`,
      result: 'info',
      details: { ...result, auditLevel },
    });

    if (isBreakGlass) {
      appendEvent('access.break_glass.check', {
        timestamp: new Date().toISOString(),
        source: 'access-control-api',
        type: 'event',
        severity: 'critical',
        data: { ...result },
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
