import { cookies } from 'next/headers';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { normalizeOwnerSessionRecord } from './platform-owner';

const SESSION_DIR = process.env.VELYA_SESSION_PATH || '/tmp/velya-sessions';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

if (!existsSync(SESSION_DIR)) {
  mkdirSync(SESSION_DIR, { recursive: true });
}

export interface VelyaSession {
  sessionId: string;
  userId: string;
  userName: string;
  role: string;
  professionalRole: string;
  email: string;
  setor: string;
  conselhoProfissional?: string;
  loginTime: string;
  lastActivity: string;
  workstationId: string;
  ipAddress: string;
  expiresAt: string;
  isBreakGlass: boolean;
}

export function createSession(params: {
  userId: string;
  userName: string;
  role: string;
  professionalRole: string;
  email?: string;
  setor?: string;
  conselhoProfissional?: string;
  workstationId?: string;
  ipAddress?: string;
}): VelyaSession {
  const sessionId = randomBytes(32).toString('hex');
  const now = new Date();
  const rawSession: VelyaSession = {
    sessionId,
    userId: params.userId,
    userName: params.userName,
    role: params.role,
    professionalRole: params.professionalRole,
    email: params.email || '',
    setor: params.setor || '',
    conselhoProfissional: params.conselhoProfissional,
    loginTime: now.toISOString(),
    lastActivity: now.toISOString(),
    workstationId: params.workstationId || 'unknown',
    ipAddress: params.ipAddress || 'unknown',
    expiresAt: new Date(now.getTime() + SESSION_TIMEOUT_MS).toISOString(),
    isBreakGlass: false,
  };

  const session = normalizeOwnerSessionRecord(rawSession);

  writeFileSync(join(SESSION_DIR, `${sessionId}.json`), JSON.stringify(session));
  return session;
}

export function getSession(sessionId: string): VelyaSession | null {
  const path = join(SESSION_DIR, `${sessionId}.json`);
  if (!existsSync(path)) return null;

  const session: VelyaSession = normalizeOwnerSessionRecord(
    JSON.parse(readFileSync(path, 'utf-8')),
  );

  // Check expiry
  if (new Date(session.expiresAt) < new Date()) {
    // Session expired — delete it
    unlinkSync(path);
    return null;
  }

  // Update last activity
  session.lastActivity = new Date().toISOString();
  session.expiresAt = new Date(Date.now() + SESSION_TIMEOUT_MS).toISOString();
  writeFileSync(path, JSON.stringify(session));

  return session;
}

export function destroySession(sessionId: string): void {
  const path = join(SESSION_DIR, `${sessionId}.json`);
  if (existsSync(path)) unlinkSync(path);
}

export async function getSessionFromRequest(): Promise<VelyaSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('velya_session');
    if (!sessionCookie) return null;
    return getSession(sessionCookie.value);
  } catch {
    return null;
  }
}
