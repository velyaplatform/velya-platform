const PLATFORM_OWNER_NAME = 'Joao Lucas Lima Freire';
const PLATFORM_OWNER_ROLE = 'Administrador';
const PLATFORM_OWNER_PROFESSIONAL_ROLE = 'admin_system';
const PLATFORM_OWNER_FALLBACK_SECTOR = 'Administracao';
const PLATFORM_OWNER_EMAILS = new Set<string>(['lucaslima4132@gmail.com']);
const PLATFORM_OWNER_NAMES = new Set<string>([
  normalizeIdentity('Joao Lucas Lima Freire'),
  normalizeIdentity('João Lucas Lima Freire'),
]);

function normalizeIdentity(value: string | null | undefined): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPlatformOwnerIdentity(input: {
  email?: string | null;
  userName?: string | null;
  nome?: string | null;
}): boolean {
  const email = normalizeIdentity(input.email);
  if (email && PLATFORM_OWNER_EMAILS.has(email)) {
    return true;
  }

  const name = normalizeIdentity(input.userName || input.nome);
  return name ? PLATFORM_OWNER_NAMES.has(name) : false;
}

export function normalizeOwnerUserRecord<T extends {
  email?: string;
  nome?: string;
  role?: string;
  setor?: string;
  conselhoProfissional?: string;
}>(record: T): T {
  if (!isPlatformOwnerIdentity(record)) {
    return record;
  }

  return {
    ...record,
    nome: PLATFORM_OWNER_NAME,
    role: PLATFORM_OWNER_ROLE,
    setor: record.setor || PLATFORM_OWNER_FALLBACK_SECTOR,
    conselhoProfissional: undefined,
  };
}

export function normalizeOwnerSessionRecord<T extends {
  email?: string;
  userName?: string;
  role?: string;
  professionalRole?: string;
  setor?: string;
  conselhoProfissional?: string;
}>(record: T): T {
  if (!isPlatformOwnerIdentity(record)) {
    return record;
  }

  return {
    ...record,
    userName: PLATFORM_OWNER_NAME,
    role: PLATFORM_OWNER_ROLE,
    professionalRole: PLATFORM_OWNER_PROFESSIONAL_ROLE,
    setor: record.setor || PLATFORM_OWNER_FALLBACK_SECTOR,
    conselhoProfissional: undefined,
  };
}
