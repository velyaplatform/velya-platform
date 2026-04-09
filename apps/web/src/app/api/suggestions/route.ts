import { NextRequest, NextResponse } from 'next/server';
import { appendEvent, getEvents } from '@/lib/event-store';
import { audit } from '@/lib/audit-logger';

type SuggestionStatus = 'pending' | 'reviewing' | 'implementing' | 'done' | 'rejected';
type SuggestionPriority = 'low' | 'medium' | 'high';

const HIGH_KEYWORDS = ['urgente', 'crítico', 'grave', 'emergência', 'perigo', 'risco', 'falha crítica'];
const MEDIUM_KEYWORDS = ['importante', 'necessário', 'melhorar', 'problema', 'erro', 'bug', 'lento', 'demora'];

function detectPriority(text: string): SuggestionPriority {
  const lower = text.toLowerCase();
  if (HIGH_KEYWORDS.some((kw) => lower.includes(kw))) return 'high';
  if (MEDIUM_KEYWORDS.some((kw) => lower.includes(kw))) return 'medium';
  return 'low';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, author } = body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'Texto da sugestão é obrigatório' }, { status: 400 });
    }

    if (!author || typeof author !== 'string') {
      return NextResponse.json({ error: 'Autor é obrigatório' }, { status: 400 });
    }

    const priority = detectPriority(text);
    const status: SuggestionStatus = 'pending';
    const timestamp = new Date().toISOString();

    const stored = appendEvent('suggestion', {
      timestamp,
      source: 'web-sidebar',
      type: 'suggestion',
      severity: priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'low',
      data: {
        text: text.trim(),
        author,
        status,
        priority,
      },
    });

    audit({
      category: 'frontend',
      action: 'suggestion_created',
      description: `Nova sugestão criada por ${author}: "${text.trim().slice(0, 80)}"`,
      actor: author,
      resource: `suggestion:${stored.id}`,
      result: 'success',
      details: { suggestionId: stored.id, priority, text: text.trim() },
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: 'velya-web',
      requestPath: '/api/suggestions',
      requestMethod: 'POST',
    });

    return NextResponse.json({
      success: true,
      suggestion: {
        id: stored.id,
        text: text.trim(),
        author,
        timestamp: stored.receivedAt,
        status,
        priority,
      },
    });
  } catch (error) {
    console.error('Erro ao salvar sugestão:', error);
    return NextResponse.json({ error: 'Erro interno ao salvar sugestão' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as SuggestionStatus | null;
    const priorityFilter = searchParams.get('priority') as SuggestionPriority | null;
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const { events } = getEvents('suggestion', { limit: 10000 });

    let suggestions = events.map((event) => ({
      id: event.id,
      text: event.data.text as string,
      author: event.data.author as string,
      timestamp: event.receivedAt,
      status: (event.data.status as SuggestionStatus) || 'pending',
      priority: (event.data.priority as SuggestionPriority) || 'low',
    }));

    if (statusFilter) {
      suggestions = suggestions.filter((s) => s.status === statusFilter);
    }
    if (priorityFilter) {
      suggestions = suggestions.filter((s) => s.priority === priorityFilter);
    }

    const pendingCount = events.filter((e) => (e.data.status as string) === 'pending').length;

    return NextResponse.json({
      suggestions: suggestions.slice(0, limit),
      total: suggestions.length,
      pendingCount,
    });
  } catch (error) {
    console.error('Erro ao buscar sugestões:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar sugestões' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status, actor } = body;

    if (!id || !status || !actor) {
      return NextResponse.json({ error: 'id, status e actor são obrigatórios' }, { status: 400 });
    }

    const validStatuses: SuggestionStatus[] = ['pending', 'reviewing', 'implementing', 'done', 'rejected'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Status inválido' }, { status: 400 });
    }

    // Read all events, find and update the target
    const { events } = getEvents('suggestion', { limit: 10000 });
    const target = events.find((e) => e.id === id);

    if (!target) {
      return NextResponse.json({ error: 'Sugestão não encontrada' }, { status: 404 });
    }

    const previousStatus = target.data.status as string;

    // Append a status-change event
    appendEvent('suggestion-status-change', {
      timestamp: new Date().toISOString(),
      source: 'admin-panel',
      type: 'suggestion-status-change',
      severity: 'low',
      data: {
        suggestionId: id,
        previousStatus,
        newStatus: status,
        changedBy: actor,
      },
    });

    // Update the original event data in-store (re-append with updated status)
    // Since the event store is append-only, we record a new event with the update
    // and the GET endpoint reads the latest status from status-change events
    target.data.status = status;

    // Write updated events back
    const { writeFileSync } = await import('fs');
    const { join } = await import('path');
    const STORE_DIR = process.env.VELYA_EVENT_STORE_PATH || '/tmp/velya-events';
    const storePath = join(STORE_DIR, 'suggestion.json');
    writeFileSync(storePath, JSON.stringify(events, null, 2));

    audit({
      category: 'api',
      action: 'suggestion_status_changed',
      description: `Status da sugestão ${id} alterado de "${previousStatus}" para "${status}" por ${actor}`,
      actor,
      resource: `suggestion:${id}`,
      result: 'success',
      details: { suggestionId: id, previousStatus, newStatus: status },
      origin: request.headers.get('x-forwarded-for') || 'unknown',
      clientId: 'velya-web',
      requestPath: '/api/suggestions',
      requestMethod: 'PATCH',
    });

    return NextResponse.json({
      success: true,
      id,
      previousStatus,
      newStatus: status,
    });
  } catch (error) {
    console.error('Erro ao atualizar sugestão:', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar sugestão' }, { status: 500 });
  }
}
