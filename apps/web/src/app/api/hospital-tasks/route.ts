import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '../../../lib/auth-session';
import {
  createTask,
  listTasks,
  countTasksByStatus,
  type CreateTaskInput,
} from '../../../lib/hospital-task-store';
import type { TaskCategory, TaskSubcategory, TaskPriority, TaskStatus } from '../../../lib/hospital-task-types';

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  const url = request.nextUrl;
  const assignedToId = url.searchParams.get('inbox') === 'true' ? session.userId : url.searchParams.get('assignedToId') ?? undefined;
  const createdById = url.searchParams.get('sent') === 'true' ? session.userId : url.searchParams.get('createdById') ?? undefined;
  const ward = url.searchParams.get('ward') ?? undefined;
  const status = url.searchParams.get('status') as TaskStatus | undefined;
  const priority = url.searchParams.get('priority') as TaskPriority | undefined;
  const category = url.searchParams.get('category') as TaskCategory | undefined;
  const patientMrn = url.searchParams.get('patientMrn') ?? undefined;
  const search = url.searchParams.get('search') ?? undefined;
  const limit = url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')!, 10) : undefined;

  const statusArray = status?.includes(',') ? status.split(',') as TaskStatus[] : status;

  const items = listTasks({
    assignedToId,
    createdById,
    ward,
    status: statusArray,
    priority,
    category,
    patientMrn,
    search,
    limit,
  });

  const counts = countTasksByStatus(ward);

  return NextResponse.json({ items, count: items.length, counts });
}

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest();
  if (!session) {
    return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'JSON invalido' }, { status: 400 });
  }

  const required = ['type', 'category', 'subcategory', 'priority', 'title', 'ward', 'assignedToId', 'assignedToName', 'assignedToRole'];
  for (const field of required) {
    if (!body[field]) {
      return NextResponse.json({ error: `Campo obrigatorio ausente: ${field}` }, { status: 400 });
    }
  }

  const input: CreateTaskInput = {
    type: body.type as string,
    category: body.category as TaskCategory,
    subcategory: body.subcategory as TaskSubcategory,
    priority: body.priority as TaskPriority,
    title: body.title as string,
    description: body.description as string | undefined,
    instructions: body.instructions as string | undefined,
    patientId: body.patientId as string | undefined,
    patientMrn: body.patientMrn as string | undefined,
    patientName: body.patientName as string | undefined,
    ward: body.ward as string,
    bed: body.bed as string | undefined,
    location: body.location as string | undefined,
    createdBy: {
      id: session.userId,
      name: session.userName,
      role: session.role ?? 'unknown',
      ward: body.ward as string,
    },
    assignedTo: {
      id: body.assignedToId as string,
      name: body.assignedToName as string,
      role: body.assignedToRole as string,
      ward: body.assignedToWard as string | undefined,
    },
    parentTaskId: body.parentTaskId as string | undefined,
    relatedEntityType: body.relatedEntityType as string | undefined,
    relatedEntityId: body.relatedEntityId as string | undefined,
    source: (body.source as CreateTaskInput['source']) ?? 'manual',
    tags: body.tags as string[] | undefined,
    shift: body.shift as string | undefined,
    checklistItems: body.checklistItems as { label: string }[] | undefined,
    completeByOverrideMs: body.completeByOverrideMs as number | undefined,
  };

  const task = createTask(input);

  return NextResponse.json({ task }, { status: 201 });
}
