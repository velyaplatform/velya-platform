import { NextRequest, NextResponse } from 'next/server';
import { ackEvent } from '../../../lib/event-store';

const VALID_TYPES = ['sentinel', 'alert', 'event', 'error', 'action'];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, id } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}` },
        { status: 400 },
      );
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const success = ackEvent(type, id);
    if (!success) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json({ acked: true, type, id });
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }
}
