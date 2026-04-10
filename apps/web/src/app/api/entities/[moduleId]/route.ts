import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth-session';
import { getModuleById, canEditModule } from '@/lib/module-manifest';
import { listLiveRecords } from '@/lib/entity-resolver';
import { createEntityRecord } from '@/lib/entity-store';
import { randomBytes } from 'crypto';

interface RouteContext {
  params: Promise<{ moduleId: string }>;
}

/**
 * GET /api/entities/[moduleId]
 *
 * Returns the live list of records for a module: fixture seeds + edits +
 * brand-new records, with deleted entries hidden.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { moduleId } = await context.params;
  const module = getModuleById(moduleId);
  if (!module) {
    return NextResponse.json({ error: 'Módulo não encontrado' }, { status: 404 });
  }
  const includeDeleted = new URL(request.url).searchParams.get('includeDeleted') === 'true';
  const records = listLiveRecords(moduleId, { includeDeleted });
  return NextResponse.json({ moduleId, count: records.length, records });
}

/**
 * POST /api/entities/[moduleId]
 *
 * Creates a brand-new record in the override store. The fixture is not
 * touched. Body: { id?: string, data: Record<string, unknown> }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }
  const { moduleId } = await context.params;
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

  let body: { id?: string; data?: Record<string, unknown> };
  try {
    body = (await request.json()) as { id?: string; data?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!body.data || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'data é obrigatório' }, { status: 400 });
  }
  const recordId =
    body.id ?? `${moduleId.toUpperCase().slice(0, 4)}-NEW-${randomBytes(3).toString('hex')}`;

  const record = createEntityRecord({
    moduleId,
    recordId,
    data: { id: recordId, ...body.data },
    actorId: session.userId,
    actorName: session.userName,
  });

  return NextResponse.json({ recordId, record }, { status: 201 });
}
