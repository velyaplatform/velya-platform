/**
 * killswitch.ts — global stop primitive for the autopilot mesh.
 *
 * Every runner MUST call `assertNotKilled(agentName)` at the very top
 * of `main()` before doing any side-effecting work, and SHOULD re-check
 * with `isKilled(agentName)` between long-running phases. The idea is
 * that flipping a single ConfigMap key (or setting an env var) freezes
 * the mesh in seconds, without rebuilding any image.
 *
 * Sources of truth, in priority order:
 *
 *   1. Env var `VELYA_AUTOPILOT_KILL` set to a truthy value → all
 *      layers stop. The escape hatch when nothing else can be reached.
 *   2. Env var `VELYA_AUTOPILOT_KILL_<LAYER>` (e.g. L1, L2, L3, L4) →
 *      that layer stops. Used by the watchdog when L2 needs to halt L1.
 *   3. ConfigMap mounted at `/var/run/velya-autopilot/killswitch.yaml`
 *      (path overridable via `VELYA_KILLSWITCH_PATH`). Parsed loosely:
 *      we accept either YAML or JSON. Schema:
 *        {
 *          global: { enabled: boolean, reason?: string }
 *          layers: { l1: bool, l2: bool, l3: bool, l4: bool }
 *          agents: { "<agent-name>": bool }
 *          forbidden_targets: string[]   // path globs the runner must not touch
 *          blast_radius_caps: { ... }   // hints; primary enforcement is in memory-guardian
 *        }
 *
 * The file is read on every call (no caching) so flipping the ConfigMap
 * propagates within one CronJob tick. This is intentionally cheap —
 * a few hundred bytes per check, called O(once per phase).
 *
 * The function never throws on parse errors. If the file is missing or
 * unparseable, the killswitch is treated as OFF (fail-safe-on-availability),
 * because the alternative — refusing to run when the file is missing —
 * would brick a fresh cluster before the ConfigMap is applied.
 *
 * If you want strict mode (refuse to run without the file), set
 * `VELYA_KILLSWITCH_REQUIRE=true`. The CI smoke does NOT set this.
 */

import { existsSync, readFileSync } from 'node:fs';

export type AutopilotLayer = 'l1' | 'l2' | 'l3' | 'l4';

export interface KillswitchSnapshot {
  /** True when ANY input source says the mesh should halt for this scope. */
  killed: boolean;
  /** Source that triggered the kill — useful for the audit log. */
  source:
    | 'env-global'
    | 'env-layer'
    | 'configmap-global'
    | 'configmap-layer'
    | 'configmap-agent'
    | 'none';
  reason?: string;
  /** Forbidden target paths the agent must refuse to touch. */
  forbiddenTargets: string[];
}

export class KillswitchEngagedError extends Error {
  constructor(public readonly snapshot: KillswitchSnapshot) {
    super(
      `[killswitch] engaged source=${snapshot.source}${snapshot.reason ? ` reason=${snapshot.reason}` : ''}`,
    );
    this.name = 'KillswitchEngagedError';
  }
}

const DEFAULT_PATH = '/var/run/velya-autopilot/killswitch.yaml';

interface ConfigShape {
  global?: { enabled?: boolean; reason?: string };
  layers?: Partial<Record<AutopilotLayer, boolean | { enabled?: boolean; reason?: string }>>;
  agents?: Record<string, boolean | { enabled?: boolean; reason?: string }>;
  forbidden_targets?: string[];
}

function envFlag(name: string): boolean {
  const value = process.env[name];
  if (value === undefined) return false;
  return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function envFlagWithReason(name: string): { enabled: boolean; reason?: string } {
  const value = process.env[name];
  if (value === undefined) return { enabled: false };
  if (value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes') {
    return { enabled: true, reason: process.env[`${name}_REASON`] };
  }
  return { enabled: false };
}

/**
 * Parse the killswitch ConfigMap. Tries JSON first, then a tiny
 * hand-rolled YAML parser sufficient for our schema (no anchors, no
 * multi-line strings, no flow). Falls back to an empty config on any
 * error so a corrupted file never bricks the mesh.
 */
function parseConfig(text: string): ConfigShape {
  // JSON path: easiest, fastest, used by tests.
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed === 'object' && parsed !== null) return parsed as ConfigShape;
  } catch {
    /* fall through to YAML */
  }
  // Mini YAML — we only support `key: value`, nested by 2-space indent,
  // and flow `key: [a, b]` for forbidden_targets. Anything fancier should
  // use JSON. The ConfigMap manifest in `infra/kubernetes/autopilot/`
  // emits exactly this shape.
  const out: ConfigShape = {};
  const lines = text.split(/\r?\n/);
  type Frame = { container: Record<string, unknown>; indent: number };
  const stack: Frame[] = [{ container: out as unknown as Record<string, unknown>, indent: -1 }];
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').trimEnd();
    if (line.length === 0) continue;
    const indent = rawLine.match(/^ */)![0].length;
    while (stack.length > 1 && indent <= stack[stack.length - 1]!.indent) {
      stack.pop();
    }
    const trimmed = line.trim();
    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;
    const key = trimmed.slice(0, colon).trim();
    const rawValue = trimmed.slice(colon + 1).trim();
    const top = stack[stack.length - 1]!.container;
    if (rawValue.length === 0) {
      const child: Record<string, unknown> = {};
      top[key] = child;
      stack.push({ container: child, indent });
      continue;
    }
    if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
      top[key] = rawValue
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
        .filter((item) => item.length > 0);
      continue;
    }
    if (rawValue === 'true' || rawValue === 'false') {
      top[key] = rawValue === 'true';
      continue;
    }
    top[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function readConfig(): ConfigShape | null {
  const path = process.env.VELYA_KILLSWITCH_PATH ?? DEFAULT_PATH;
  if (!existsSync(path)) {
    if (envFlag('VELYA_KILLSWITCH_REQUIRE')) {
      throw new Error(
        `[killswitch] strict mode: file ${path} is required (VELYA_KILLSWITCH_REQUIRE=true) but missing`,
      );
    }
    return null;
  }
  try {
    return parseConfig(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function isLayerKilled(
  config: ConfigShape | null,
  layer: AutopilotLayer,
): { killed: boolean; reason?: string; source: KillswitchSnapshot['source'] } {
  const envLayer = envFlagWithReason(`VELYA_AUTOPILOT_KILL_${layer.toUpperCase()}`);
  if (envLayer.enabled) {
    return { killed: true, reason: envLayer.reason, source: 'env-layer' };
  }
  const layerEntry = config?.layers?.[layer];
  if (typeof layerEntry === 'boolean') {
    if (layerEntry) return { killed: true, source: 'configmap-layer' };
  } else if (typeof layerEntry === 'object' && layerEntry?.enabled) {
    return { killed: true, reason: layerEntry.reason, source: 'configmap-layer' };
  }
  return { killed: false, source: 'none' };
}

function agentKilled(
  config: ConfigShape | null,
  agentName: string,
): { killed: boolean; reason?: string } {
  const entry = config?.agents?.[agentName];
  if (entry === undefined) return { killed: false };
  if (typeof entry === 'boolean') return { killed: entry };
  return { killed: !!entry.enabled, reason: entry.reason };
}

/**
 * Snapshot the kill switch state for a given agent. Pure read; no side
 * effects. Returns a single record so the runner can attach it to the
 * audit log even on a clean run.
 */
export function killswitchSnapshot(agentName: string, layer: AutopilotLayer): KillswitchSnapshot {
  // 1. Global env var — escape hatch.
  const envGlobal = envFlagWithReason('VELYA_AUTOPILOT_KILL');
  if (envGlobal.enabled) {
    return {
      killed: true,
      source: 'env-global',
      reason: envGlobal.reason,
      forbiddenTargets: [],
    };
  }

  let config: ConfigShape | null;
  try {
    config = readConfig();
  } catch (e) {
    // Strict mode wanted us to fail closed — surface that.
    throw e;
  }

  // 2. ConfigMap global flag.
  if (config?.global?.enabled) {
    return {
      killed: true,
      source: 'configmap-global',
      reason: config.global.reason,
      forbiddenTargets: config.forbidden_targets ?? [],
    };
  }

  // 3. Layer scope.
  const layerState = isLayerKilled(config, layer);
  if (layerState.killed) {
    return {
      killed: true,
      source: layerState.source,
      reason: layerState.reason,
      forbiddenTargets: config?.forbidden_targets ?? [],
    };
  }

  // 4. Agent scope (the most surgical).
  const agentState = agentKilled(config, agentName);
  if (agentState.killed) {
    return {
      killed: true,
      source: 'configmap-agent',
      reason: agentState.reason,
      forbiddenTargets: config?.forbidden_targets ?? [],
    };
  }

  return {
    killed: false,
    source: 'none',
    forbiddenTargets: config?.forbidden_targets ?? [],
  };
}

/**
 * Convenience predicate. Useful for re-checking between phases inside a
 * long runner without raising.
 */
export function isKilled(agentName: string, layer: AutopilotLayer): boolean {
  return killswitchSnapshot(agentName, layer).killed;
}

/**
 * Hard guard: throw a typed error if the kill switch is engaged. The
 * runner's `installOfflineFatalHandler` (or the local catch) is expected
 * to translate the error into an audit record + clean exit code 4.
 */
export function assertNotKilled(agentName: string, layer: AutopilotLayer): KillswitchSnapshot {
  const snap = killswitchSnapshot(agentName, layer);
  if (snap.killed) {
    throw new KillswitchEngagedError(snap);
  }
  return snap;
}

/**
 * Check whether a target path matches any of the forbidden globs from
 * the killswitch config. Used by runners that propose patches before
 * applying them — the runner refuses to write the patch when this
 * returns true.
 */
export function isForbiddenTarget(targetPath: string, snap: KillswitchSnapshot): boolean {
  for (const pattern of snap.forbiddenTargets) {
    if (pattern === targetPath) return true;
    if (pattern.endsWith('/') && targetPath.startsWith(pattern)) return true;
    if (pattern.endsWith('**') && targetPath.startsWith(pattern.slice(0, -2))) return true;
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' +
          pattern
            .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*') +
          '$',
      );
      if (regex.test(targetPath)) return true;
    }
  }
  return false;
}
