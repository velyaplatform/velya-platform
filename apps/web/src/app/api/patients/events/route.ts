import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents } from '@/lib/event-store';
import { audit } from '@/lib/audit-logger';
import { getSessionFromRequest } from '@/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromRequest();
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const { patientId, category, title, description, timestamp, location, priority } = body;

    if (!patientId || !category || !title) {
      return NextResponse.json(
        { error: 'patientId, category e title sao obrigatorios' },
        { status: 400 },
      );
    }

    const validCategories = [
      'emergencia',
      'admissao',
      'avaliacao',
      'medicacao',
      'exame',
      'evolucao',
      'handoff',
      'alerta',
      'chamada',
      'alta',
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json({ error: 'Categoria invalida' }, { status: 400 });
    }

    const validPriorities = ['normal', 'urgente', 'critico'];
    const eventPriority = priority && validPriorities.includes(priority) ? priority : 'normal';

    const eventTimestamp = timestamp || new Date().toISOString();

    const stored = appendEvent('patient-event', {
      timestamp: eventTimestamp,
      source: 'web-patient-journey',
      type: 'patient-event',
      severity: eventPriority === 'critico' ? 'critical' : eventPriority === 'urgente' ? 'warning' : 'info',
      data: {
        patientId,
        category,
        title,
        description: description || '',
        timestamp: eventTimestamp,
        location: location || '',
        priority: eventPriority,
        author: session.userName,
        role: session.role,
      },
    });

    audit({
      category: 'frontend',
      action: 'patient_event_registered',
      description: `Evento registrado para paciente ${patientId}: "${title}"`,
      actor: `${session.userName} (${session.role})`,
      resource: `patient-event:${stored.id}`,
      result: 'success',
      details: {
        patientId,
        category,
        title,
        priority: eventPriority,
        eventId: stored.id,
      },
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: 'velya-web',
      requestPath: '/api/patients/events',
      requestMethod: 'POST',
    });

    return NextResponse.json({
      success: true,
      event: {
        id: stored.id,
        patientId,
        category,
        title,
        description: description || '',
        timestamp: eventTimestamp,
        location: location || '',
        priority: eventPriority,
        author: session.userName,
        role: session.role,
      },
    });
  } catch (error) {
    console.error('Erro ao registrar evento do paciente:', error);
    audit({
      category: 'frontend',
      action: 'patient_event_registered',
      description: 'Falha ao registrar evento do paciente',
      actor: 'unknown',
      resource: 'patient-event:unknown',
      result: 'error',
    });
    return NextResponse.json({ error: 'Erro interno ao registrar evento' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromRequest();
    if (!session) {
      return NextResponse.json({ error: 'Nao autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    const limit = parseInt(searchParams.get('limit') || '200', 10);

    const { events } = getEvents('patient-event', { limit: 10000 });

    let filtered = events;
    if (patientId) {
      filtered = filtered.filter(
        (e) => (e.data as Record<string, unknown>).patientId === patientId,
      );
    }

    const result = filtered.slice(0, limit).map((e) => ({
      id: e.id,
      patientId: e.data.patientId as string,
      category: e.data.category as string,
      title: e.data.title as string,
      description: (e.data.description as string) || '',
      timestamp: (e.data.timestamp as string) || e.timestamp,
      location: (e.data.location as string) || '',
      priority: (e.data.priority as string) || 'normal',
      author: (e.data.author as string) || 'unknown',
      role: (e.data.role as string) || '',
      createdAt: e.receivedAt,
    }));

    audit({
      category: 'frontend',
      action: 'patient_events_queried',
      description: `Consulta de eventos do paciente ${patientId || 'todos'}`,
      actor: `${session.userName} (${session.role})`,
      resource: `patient-events:${patientId || 'all'}`,
      result: 'info',
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: 'velya-web',
      requestPath: '/api/patients/events',
      requestMethod: 'GET',
    });

    return NextResponse.json({
      events: result,
      total: result.length,
    });
  } catch (error) {
    console.error('Erro ao buscar eventos do paciente:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar eventos' }, { status: 500 });
  }
}
