import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { canEditModule, getModuleById } from '@/lib/module-manifest';
import { resolveRecord, getRecordHistory } from '@/lib/entity-resolver';
import { patchEntityRecord, softDeleteRecord, restoreRecord } from '@/lib/entity-store';

interface RouteContext {
  params: Promise<{ moduleId: string; recordId: string }>;
}

/**
 * GET /api/entities/[moduleId]/[recordId]
 *
 * Returns the merged record (fixture + overrides) plus the change history.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { moduleId, recordId } = await context.params;
  const module = getModuleById(moduleId);
  if (!module) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 });
  }
  const record = resolveRecord(moduleId, recordId);
  if (!record) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }
  const history = getRecordHistory(moduleId, recordId);
  return NextResponse.json({
    moduleId,
    recordId,
    record,
    history,
    canEdit: canEditModule(module, session.professionalRole, session.email),
  });
}

/**
 * PATCH /api/entities/[moduleId]/[recordId]
 *
 * Body: { patch: Record<string, unknown>, note?: string }
 *
 * Applies the patch on top of the current merged record. Every changed
 * field is recorded in the per-record history AND in the global audit
 * chain. Only authorized roles may patch.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { moduleId, recordId } = await context.params;
  const module = getModuleById(moduleId);
  if (!module) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 });
  }
  if (!canEditModule(module, session.professionalRole, session.email)) {
    return NextResponse.json(
      { error: 'Sua função não tem permissão para editar este módulo' },
      { status: 403 },
    );
  }

  let body: { patch?: Record<string, unknown>; note?: string };
  try {
    body = (await request.json()) as { patch?: Record<string, unknown>; note?: string };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.patch || typeof body.patch !== 'object') {
    return NextResponse.json({ error: 'patch é obrigatório' }, { status: 400 });
  }

  const current = resolveRecord(moduleId, recordId);
  if (!current) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }

  const result = patchEntityRecord({
    moduleId,
    recordId,
    baseRecord: current.data,
    patch: body.patch,
    actorId: session.userId,
    actorName: session.userName,
    note: body.note,
  });

  return NextResponse.json({
    moduleId,
    recordId,
    record: result.record,
    fieldChanges: result.fieldChanges,
  });
}

/**
 * DELETE /api/entities/[moduleId]/[recordId]
 *
 * Soft delete: hides the record from list endpoints but preserves it in
 * the audit chain. POST /restore would be the inverse — pass `?restore=true`.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { moduleId, recordId } = await context.params;
  const module = getModuleById(moduleId);
  if (!module) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 });
  }
  if (!canEditModule(module, session.professionalRole, session.email)) {
    return NextResponse.json(
      { error: 'Sua função não tem permissão para editar este módulo' },
      { status: 403 },
    );
  }

  const restore = new URL(request.url).searchParams.get('restore') === 'true';
  const note = new URL(request.url).searchParams.get('note') ?? undefined;

  if (restore) {
    const restored = restoreRecord(moduleId, recordId, session.userId, session.userName);
    if (!restored) {
      return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
    }
    return NextResponse.json({ moduleId, recordId, record: restored });
  }

  const deleted = softDeleteRecord(moduleId, recordId, session.userId, session.userName, note);
  if (!deleted) {
    return NextResponse.json({ error: 'Registro não encontrado' }, { status: 404 });
  }
  return NextResponse.json({ moduleId, recordId, record: deleted });
}
