import { readFileSync, appendFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const AUDIT_DIR = process.env.VELYA_AUDIT_PATH || '/tmp/velya-audit';

// Ensure audit directory exists
if (!existsSync(AUDIT_DIR)) {
  mkdirSync(AUDIT_DIR, { recursive: true });
}

/**
 * Registro de auditoria — imutavel, com hash chain para prova de integridade.
 * Cada registro e uma linha JSON no arquivo de audit log.
 * O hash de cada registro inclui o hash do registro anterior (chain).
 */
export interface AuditEntry {
  /** ID unico do registro */
  id: string;
  /** Timestamp ISO 8601 com timezone */
  timestamp: string;
  /** Timestamp Unix em milissegundos para ordenacao precisa */
  timestampMs: number;
  /** Categoria: frontend | api | backend | infra | agent | system */
  category: 'frontend' | 'api' | 'backend' | 'infra' | 'agent' | 'system';
  /** Acao executada (ex: "page_view", "api_call", "discharge_update", "pod_restart") */
  action: string;
  /** Descricao legivel em portugues */
  description: string;
  /** Quem executou (user role, system, agent name, cronjob name) */
  actor: string;
  /** Recurso afetado (ex: "patient:MRN-004", "deployment:velya-web", "page:/discharge") */
  resource: string;
  /** Resultado: success | failure | error | warning | info */
  result: 'success' | 'failure' | 'error' | 'warning' | 'info';
  /** Dados adicionais estruturados */
  details: Record<string, unknown>;
  /** IP ou origem da requisicao */
  origin: string;
  /** User-Agent ou identificador do cliente */
  clientId: string;
  /** Hash SHA-256 deste registro (inclui previousHash para chain) */
  hash: string;
  /** Hash do registro anterior (chain de integridade) */
  previousHash: string;
  /** Duracao da operacao em ms (quando aplicavel) */
  durationMs?: number;
  /** HTTP status code (quando aplicavel) */
  statusCode?: number;
  /** Request path (quando aplicavel) */
  requestPath?: string;
  /** Request method (quando aplicavel) */
  requestMethod?: string;
}

// Track the last hash for the chain
let lastHash = 'GENESIS';

// Load last hash from most recent log file
function loadLastHash(): string {
  try {
    const today = new Date().toISOString().split('T')[0];
    const logFile = join(AUDIT_DIR, `audit-${today}.jsonl`);
    if (!existsSync(logFile)) return 'GENESIS';
    const content = readFileSync(logFile, 'utf-8').trim();
    if (!content) return 'GENESIS';
    const lines = content.split('\n');
    const lastLine = lines[lines.length - 1];
    const lastEntry = JSON.parse(lastLine);
    return lastEntry.hash || 'GENESIS';
  } catch {
    return 'GENESIS';
  }
}

lastHash = loadLastHash();

function computeHash(entry: Omit<AuditEntry, 'hash'>): string {
  const payload = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    category: entry.category,
    action: entry.action,
    actor: entry.actor,
    resource: entry.resource,
    result: entry.result,
    previousHash: entry.previousHash,
  });
  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Registra uma entrada de auditoria — SINCRONO para garantir que nunca se perca.
 * Cada chamada appenda uma linha JSON ao arquivo do dia.
 */
export function audit(params: {
  category: AuditEntry['category'];
  action: string;
  description: string;
  actor: string;
  resource: string;
  result: AuditEntry['result'];
  details?: Record<string, unknown>;
  origin?: string;
  clientId?: string;
  durationMs?: number;
  statusCode?: number;
  requestPath?: string;
  requestMethod?: string;
}): AuditEntry {
  const now = new Date();
  const entry: Omit<AuditEntry, 'hash'> = {
    id: `audit-${now.getTime()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: now.toISOString(),
    timestampMs: now.getTime(),
    category: params.category,
    action: params.action,
    description: params.description,
    actor: params.actor,
    resource: params.resource,
    result: params.result,
    details: params.details || {},
    origin: params.origin || 'unknown',
    clientId: params.clientId || 'system',
    previousHash: lastHash,
    durationMs: params.durationMs,
    statusCode: params.statusCode,
    requestPath: params.requestPath,
    requestMethod: params.requestMethod,
  };

  const hash = computeHash(entry);
  const fullEntry: AuditEntry = { ...entry, hash };
  lastHash = hash;

  // Write to daily log file — APPEND, never overwrite
  const today = now.toISOString().split('T')[0];
  const logFile = join(AUDIT_DIR, `audit-${today}.jsonl`);
  appendFileSync(logFile, JSON.stringify(fullEntry) + '\n');

  // Also write to console for container log aggregation (Loki/Fluentd)
  console.log(JSON.stringify({
    level: params.result === 'error' ? 'error' : params.result === 'failure' ? 'warn' : 'info',
    service: 'velya-web',
    audit: true,
    ...fullEntry,
  }));

  return fullEntry;
}

/**
 * Busca registros de auditoria com filtros.
 */
export function queryAudit(params?: {
  date?: string; // YYYY-MM-DD
  category?: string;
  action?: string;
  actor?: string;
  resource?: string;
  result?: string;
  limit?: number;
  offset?: number;
  since?: string; // ISO timestamp
  until?: string; // ISO timestamp
}): { entries: AuditEntry[]; total: number; integrity: boolean } {
  const date = params?.date || new Date().toISOString().split('T')[0];
  const logFile = join(AUDIT_DIR, `audit-${date}.jsonl`);

  if (!existsSync(logFile)) {
    return { entries: [], total: 0, integrity: true };
  }

  const content = readFileSync(logFile, 'utf-8').trim();
  if (!content) return { entries: [], total: 0, integrity: true };

  let entries: AuditEntry[] = content.split('\n').map(line => {
    try { return JSON.parse(line); } catch { return null; }
  }).filter(Boolean);

  // Verify hash chain integrity
  let integrity = true;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].previousHash !== entries[i - 1].hash) {
      integrity = false;
      break;
    }
  }

  // Apply filters
  if (params?.category) entries = entries.filter(e => e.category === params.category);
  if (params?.action) entries = entries.filter(e => e.action.includes(params.action!));
  if (params?.actor) entries = entries.filter(e => e.actor.includes(params.actor!));
  if (params?.resource) entries = entries.filter(e => e.resource.includes(params.resource!));
  if (params?.result) entries = entries.filter(e => e.result === params.result);
  if (params?.since) entries = entries.filter(e => e.timestamp >= params.since!);
  if (params?.until) entries = entries.filter(e => e.timestamp <= params.until!);

  const total = entries.length;

  // Reverse to show newest first
  entries.reverse();

  const offset = params?.offset || 0;
  const limit = params?.limit || 100;
  entries = entries.slice(offset, offset + limit);

  return { entries, total, integrity };
}

/**
 * Lista datas disponiveis de audit logs.
 */
export function listAuditDates(): string[] {
  if (!existsSync(AUDIT_DIR)) return [];
  return readdirSync(AUDIT_DIR)
    .filter((f: string) => f.startsWith('audit-') && f.endsWith('.jsonl'))
    .map((f: string) => f.replace('audit-', '').replace('.jsonl', ''))
    .sort()
    .reverse();
}

/**
 * Verifica integridade completa do log de um dia.
 */
export function verifyIntegrity(date: string): {
  valid: boolean;
  totalEntries: number;
  brokenAt?: number;
  message: string;
} {
  const logFile = join(AUDIT_DIR, `audit-${date}.jsonl`);
  if (!existsSync(logFile)) {
    return { valid: true, totalEntries: 0, message: 'Nenhum registro encontrado para esta data' };
  }

  const content = readFileSync(logFile, 'utf-8').trim();
  if (!content) return { valid: true, totalEntries: 0, message: 'Arquivo vazio' };

  const lines = content.split('\n');
  const entries: AuditEntry[] = lines.map(l => JSON.parse(l));

  for (let i = 0; i < entries.length; i++) {
    // Recompute hash
    const { hash, ...rest } = entries[i];
    const recomputed = computeHash(rest);
    if (recomputed !== hash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAt: i,
        message: `Integridade violada no registro ${i} (${entries[i].id}). Hash esperado: ${recomputed}, encontrado: ${hash}. POSSIVEL ADULTERACAO.`,
      };
    }

    // Verify chain
    if (i > 0 && entries[i].previousHash !== entries[i - 1].hash) {
      return {
        valid: false,
        totalEntries: entries.length,
        brokenAt: i,
        message: `Cadeia quebrada no registro ${i}. previousHash nao corresponde ao hash do registro anterior. POSSIVEL INSERCAO OU DELECAO.`,
      };
    }
  }

  return {
    valid: true,
    totalEntries: entries.length,
    message: `${entries.length} registros verificados. Integridade confirmada. Nenhuma adulteracao detectada.`,
  };
}
