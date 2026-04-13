import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash, randomBytes } from 'crypto';
import { normalizeOwnerUserRecord } from './platform-owner';

const USER_DIR = process.env.VELYA_USER_STORE_PATH || '/tmp/velya-users';

if (!existsSync(USER_DIR)) {
  mkdirSync(USER_DIR, { recursive: true });
}

export interface VelyaUser {
  id: string;
  email: string;
  passwordHash: string;
  nome: string;
  role: string;
  setor: string;
  conselhoProfissional?: string;
  verified: boolean;
  verificationCode?: string;
  verificationExpiry?: string;
  createdAt: string;
  lastLogin?: string;
  active: boolean;
}

function hashPassword(password: string): string {
  return createHash('sha256')
    .update(password + 'velya-salt-2026')
    .digest('hex');
}

export function createUser(params: {
  email: string;
  password: string;
  nome: string;
  role: string;
  setor: string;
  conselhoProfissional?: string;
}): { user: VelyaUser; verificationCode: string } {
  const id = `user-${Date.now()}-${randomBytes(4).toString('hex')}`;
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const rawUser: VelyaUser = {
    id,
    email: params.email.toLowerCase().trim(),
    passwordHash: hashPassword(params.password),
    nome: params.nome,
    role: params.role,
    setor: params.setor,
    conselhoProfissional: params.conselhoProfissional,
    verified: false,
    verificationCode,
    verificationExpiry: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    active: true,
  };

  const user = normalizeOwnerUserRecord(rawUser);
  writeFileSync(join(USER_DIR, `${user.email}.json`), JSON.stringify(user, null, 2));
  return { user, verificationCode };
}

export function findUserByEmail(email: string): VelyaUser | null {
  const path = join(USER_DIR, `${email.toLowerCase().trim()}.json`);
  if (!existsSync(path)) return null;
  const user = normalizeOwnerUserRecord(JSON.parse(readFileSync(path, 'utf-8')));
  writeFileSync(path, JSON.stringify(user, null, 2));
  return user;
}

export function verifyUser(email: string, code: string): boolean {
  const user = findUserByEmail(email);
  if (!user) return false;
  if (user.verificationCode !== code) return false;
  if (user.verificationExpiry && new Date(user.verificationExpiry) < new Date()) return false;

  user.verified = true;
  user.verificationCode = undefined;
  user.verificationExpiry = undefined;
  writeFileSync(
    join(USER_DIR, `${email.toLowerCase().trim()}.json`),
    JSON.stringify(user, null, 2),
  );
  return true;
}

export function regenerateVerificationCode(email: string): string | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  if (user.verified) return null;

  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
  user.verificationCode = verificationCode;
  user.verificationExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  writeFileSync(
    join(USER_DIR, `${email.toLowerCase().trim()}.json`),
    JSON.stringify(user, null, 2),
  );
  return verificationCode;
}

export function authenticateUser(email: string, password: string): VelyaUser | null {
  const user = findUserByEmail(email);
  if (!user) return null;
  if (!user.verified) return null;
  if (!user.active) return null;
  if (user.passwordHash !== hashPassword(password)) return null;

  user.lastLogin = new Date().toISOString();
  writeFileSync(
    join(USER_DIR, `${email.toLowerCase().trim()}.json`),
    JSON.stringify(user, null, 2),
  );
  return user;
}

export function listUsers(): VelyaUser[] {
  if (!existsSync(USER_DIR)) return [];
  return readdirSync(USER_DIR)
    .filter((f: string) => f.endsWith('.json'))
    .map((f: string) => {
      const path = join(USER_DIR, f);
      const user = normalizeOwnerUserRecord(JSON.parse(readFileSync(path, 'utf-8')));
      writeFileSync(path, JSON.stringify(user, null, 2));
      return user;
    });
}
