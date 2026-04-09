import { NextResponse } from 'next/server';
import { getStats } from '../../../lib/event-store';

export async function GET() {
  const stats = getStats();

  return NextResponse.json({
    stats,
    timestamp: new Date().toISOString(),
  });
}
