/**
 * audit-signature.ts — HMAC-SHA256 chain over autopilot audit records.
 *
 * The validation chain `execution → self-check → validator → auditor →
 * acceptance` from .claude/rules/agent-governance.md becomes a
 * cryptographic protocol here, not a social convention.
 *
 * Each step writes a signed audit record. The next step refuses to run
 * when the previous signature is missing or invalid. `validator.office
 * != execution.office` is enforced by callers (this lib only verifies
 * the cryptography; office independence is checked at the runner layer).
 *
 * Key management:
 *   - In production the HMAC key lives in AWS Secrets Manager under
 *     `autopilot/audit-signing/<layer>` and is mounted via External
 *     Secrets Operator into pods at `/var/run/velya-autopilot/keys/`.
 *     Weekly rotation; old keys retained 90 days for retroactive verify.
 *   - In dev/CI the key comes from env `VELYA_AUDIT_SIGNING_KEY`. The
 *     smoke job sets a fixed test key so signatures verify deterministically.
 *   - When neither is available, the lib enters DEGRADED mode: it still
 *     signs (with a process-local random key) but emits a warning. This
 *     keeps developer flow alive without bypassing the API. Records
 *     produced in degraded mode are flagged `keyId: 'degraded:<sha>'`
 *     so the validator-of-validators can quarantine them.
 *
 * No external libraries. Uses only Node's built-in `crypto`.
 */

import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

const KEY_PATH_ENV = 'VELYA_AUDIT_SIGNING_KEY_PATH';
const KEY_VALUE_ENV = 'VELYA_AUDIT_SIGNING_KEY';
const DEFAULT_KEY_PATH = '/var/run/velya-autopilot/keys/audit-signing-key';

let cachedKey: { material: string; keyId: string; degraded: boolean } | null = null;

/**
 * Resolve the active signing key. Order:
 *   1. Env var VELYA_AUDIT_SIGNING_KEY (used by tests + smoke).
 *   2. File at $VELYA_AUDIT_SIGNING_KEY_PATH or DEFAULT_KEY_PATH (ESO).
 *   3. Process-local random key + degraded flag.
 *
 * Cached for the lifetime of the process. Rotation requires a process
 * restart; in CronJobs that's natural (every tick is a fresh pod).
 */
export function getActiveSigningKey(): { material: string; keyId: string; degraded: boolean } {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env[KEY_VALUE_ENV];
  if (fromEnv && fromEnv.length >= 32) {
    cachedKey = { material: fromEnv, keyId: keyIdFromMaterial(fromEnv), degraded: false };
    return cachedKey;
  }

  const path = process.env[KEY_PATH_ENV] ?? DEFAULT_KEY_PATH;
  if (existsSync(path)) {
    try {
      const fileContents = readFileSync(path, 'utf-8').trim();
      if (fileContents.length >= 32) {
        cachedKey = {
          material: fileContents,
          keyId: keyIdFromMaterial(fileContents),
          degraded: false,
        };
        return cachedKey;
      }
    } catch {
      /* fall through to degraded */
    }
  }

  // Degraded — process-local random key. Records signed with this key
  // never survive a process restart and are flagged for quarantine
  // downstream. The lib still works so dev iteration stays smooth.
  const ephemeral = randomBytes(32).toString('hex');
  cachedKey = {
    material: ephemeral,
    keyId: `degraded:${keyIdFromMaterial(ephemeral)}`,
    degraded: true,
  };
  console.warn(
    '[audit-signature] degraded mode: no signing key found in env or file system; ' +
      'records will be signed with a process-local key and flagged.',
  );
  return cachedKey;
}

function keyIdFromMaterial(material: string): string {
  // The keyId is a short fingerprint of the key material so verifiers
  // can pick the right historical key on rotation. NOT the key itself.
  const hmac = createHmac('sha256', 'velya-autopilot-keyid-v1');
  hmac.update(material);
  return hmac.digest('hex').slice(0, 16);
}

export interface SignedRecord {
  /** The original payload, untouched. */
  payload: Record<string, unknown>;
  /** Hex HMAC-SHA256(payload-canonical-json). */
  signature: string;
  /** Identifier of the key used. Lets verifiers pick the right key on rotation. */
  keyId: string;
  /** ISO timestamp of the signature event. */
  signedAt: string;
}

/**
 * Canonical JSON encoder — sorts keys alphabetically at every level so
 * the signature is stable regardless of key insertion order. JSON.stringify
 * does NOT do this by default and would otherwise produce different
 * signatures for the same logical payload.
 */
export function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => canonicalise(item)).join(',') + ']';
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return '{' + entries.map(([k, v]) => JSON.stringify(k) + ':' + canonicalise(v)).join(',') + '}';
}

/**
 * Sign an audit record. Pure function: same payload + same key always
 * produces the same signature.
 */
export function signRecord(payload: Record<string, unknown>): SignedRecord {
  const key = getActiveSigningKey();
  const canonical = canonicalise(payload);
  const signature = createHmac('sha256', key.material).update(canonical).digest('hex');
  return {
    payload,
    signature,
    keyId: key.keyId,
    signedAt: new Date().toISOString(),
  };
}

/**
 * Verify a signed record against the current key. Used by the validator
 * before it agrees to validate, and by the auditor before it agrees to
 * audit. Returns false on any mismatch — never throws on bad input.
 */
export function verifyRecord(record: SignedRecord): boolean {
  if (!record || typeof record !== 'object') return false;
  if (typeof record.signature !== 'string' || record.signature.length < 32) return false;
  const key = getActiveSigningKey();
  // Allow legacy keyIds during rotation: if the record's keyId starts
  // with 'degraded:' we never trust it (intentional). Otherwise we trust
  // the current key only — historical key lookup is the responsibility
  // of the validator-of-validators agent which has access to S3 archive.
  if (record.keyId.startsWith('degraded:')) return false;
  if (record.keyId !== key.keyId) return false;

  const canonical = canonicalise(record.payload);
  const expected = createHmac('sha256', key.material).update(canonical).digest('hex');
  return timingSafeEqualHex(record.signature, expected);
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Build the next link in a validation chain. Each link references the
 * previous link's signature (forming a hash chain) so any tampering
 * with an earlier step invalidates every step downstream of it.
 *
 * Callers MUST refuse to proceed when the previous link is missing or
 * fails verification. The runner translates that refusal into exit code
 * 2 (fatal) plus an audit-broken finding emitted by the watchdog.
 */
export function chainNext(
  step: 'self-check' | 'validator' | 'auditor' | 'acceptance',
  payload: Record<string, unknown>,
  previous: SignedRecord | null,
): SignedRecord {
  if (previous && !verifyRecord(previous)) {
    throw new Error(
      `[audit-signature] previous step ${step} found a broken signature on the prior link; refusing to chain`,
    );
  }
  return signRecord({
    ...payload,
    step,
    previousSignature: previous?.signature ?? null,
    previousKeyId: previous?.keyId ?? null,
  });
}

/**
 * Reset the cached key — only used by tests. Real callers should never
 * touch this; the cache is per-process and gets fresh each runner tick.
 */
export function __resetSigningKeyCacheForTests(): void {
  cachedKey = null;
}
