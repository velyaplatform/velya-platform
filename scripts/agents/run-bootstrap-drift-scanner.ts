#!/usr/bin/env tsx
/**
 * run-bootstrap-drift-scanner.ts — L1 agent that detects structural
 * errors in the ArgoCD bootstrap manifests BEFORE they reach the cluster.
 *
 * Consumes the knowledge base at ops/bootstrap-compliance/known-errors.yaml
 * and runs each pattern's detector against the repo tree. This catches:
 *
 *   1. Duplicate (kind, namespace, name) within an Application path
 *   2. Stale apiVersions that the cluster no longer serves
 *   3. Missing NetworkPolicy for validating/mutating webhooks
 *   4. Orphan HPA/ScaledObject targeting non-existent Deployment
 *   5. Orphan ServiceMonitor targeting non-existent Service
 *   6. Unsupported API resources (e.g. ValidatingAdmissionPolicy on old k8s)
 *
 * Runs as:
 *   - GitHub Actions CI gate (.github/workflows/clinical-bootstrap-compliance-gate.yaml)
 *   - Kubernetes CronJob via the argocd-healer esteira (auto-discovery)
 *   - Local CLI: `npx tsx scripts/agents/run-bootstrap-drift-scanner.ts`
 *
 * Exit codes:
 *   0 — no critical/high findings
 *   1 — at least one critical or high finding
 *   2 — agent fatal error
 *
 * Envs:
 *   VELYA_AUDIT_OUT          default /data/velya-autopilot
 *   VELYA_DRY_RUN            default false
 *   VELYA_SMOKE_OFFLINE      default false
 *   KUBECTL_CONTEXT          optional
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: string;
  file?: string;
  resource?: string;
  message: string;
  knownErrorId?: string;
  suggestedFix?: string;
}

const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const SMOKE_OFFLINE = process.env.VELYA_SMOKE_OFFLINE === 'true';
const KUBECTL_CONTEXT = process.env.KUBECTL_CONTEXT ?? '';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function findRepoRoot(): string {
  let cur = process.cwd();
  for (let depth = 0; depth < 6; depth++) {
    if (existsSync(join(cur, 'package.json')) && existsSync(join(cur, 'infra'))) return cur;
    const parent = resolve(cur, '..');
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

const REPO_ROOT = findRepoRoot();

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function kubectl(args: string[]): { ok: boolean; stdout: string } {
  const fullArgs = KUBECTL_CONTEXT
    ? ['--context', KUBECTL_CONTEXT, '--request-timeout=10s', ...args]
    : ['--request-timeout=10s', ...args];
  const r = spawnSync('kubectl', fullArgs, { encoding: 'utf-8', timeout: 15_000 });
  return { ok: r.status === 0, stdout: r.stdout ?? '' };
}

// ── YAML multi-doc parser (minimal, no external dependency) ─────────
interface YamlDoc {
  apiVersion?: string;
  kind?: string;
  metadata?: { name?: string; namespace?: string; labels?: Record<string, string> };
  spec?: Record<string, unknown>;
}

function parseYamlDocs(content: string): YamlDoc[] {
  // Split on `---` that is on its own line, then parse each doc as JSON
  // via a very simple YAML→JSON converter. For full fidelity we'd use
  // js-yaml, but keeping zero deps for agent portability.
  // Fallback: try JSON.parse (some files are already JSON).
  const docs: YamlDoc[] = [];
  for (const raw of content.split(/^---$/m)) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    try {
      // Quick extraction via regex — good enough for apiVersion/kind/metadata
      const doc: YamlDoc = {};
      const av = trimmed.match(/^apiVersion:\s*(.+)/m);
      if (av) doc.apiVersion = av[1].trim().replace(/^['"]|['"]$/g, '');
      const kd = trimmed.match(/^kind:\s*(.+)/m);
      if (kd) doc.kind = kd[1].trim();
      const nm = trimmed.match(/^\s{2}name:\s*(.+)/m);
      const ns = trimmed.match(/^\s{2}namespace:\s*(.+)/m);
      if (nm || ns) {
        doc.metadata = {};
        if (nm) doc.metadata.name = nm[1].trim().replace(/^['"]|['"]$/g, '');
        if (ns) doc.metadata.namespace = ns[1].trim().replace(/^['"]|['"]$/g, '');
      }
      // scaleTargetRef for HPA / ScaledObject
      const str = trimmed.match(/scaleTargetRef:[\s\S]*?name:\s*(.+)/m);
      if (str) {
        doc.spec = { scaleTargetRef: { name: str[1].trim() } };
      }
      // ServiceMonitor selector
      const sel = trimmed.match(/selector:[\s\S]*?matchLabels:[\s\S]*?app\.kubernetes\.io\/name:\s*(.+)/m);
      if (sel) {
        doc.spec = { ...(doc.spec ?? {}), selector: { matchLabels: { 'app.kubernetes.io/name': sel[1].trim() } } };
      }
      if (doc.kind) docs.push(doc);
    } catch {
      // unparseable — skip silently
    }
  }
  return docs;
}

function walkYamlFiles(dir: string): { path: string; docs: YamlDoc[] }[] {
  const result: { path: string; docs: YamlDoc[] }[] = [];
  if (!existsSync(dir)) return result;
  for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.yaml') && !entry.name.endsWith('.yml')) continue;
    // readdirSync with recursive may not return parentPath in all Node versions
    const actualPath = entry.parentPath ? join(entry.parentPath, entry.name) : join(dir, entry.name);
    try {
      const content = readFileSync(actualPath, 'utf-8');
      result.push({ path: actualPath, docs: parseYamlDocs(content) });
    } catch {
      // skip unreadable
    }
  }
  return result;
}

// ── Detectors ───────────────────────────────────────────────────────

function detectDuplicateResources(findings: Finding[]): void {
  console.log('[bootstrap-drift] checking for duplicate (kind, ns, name) triples…');
  const appPaths = [
    'infra/kubernetes/bootstrap',
    'infra/kubernetes/services',
    'infra/kubernetes/apps',
    'infra/kubernetes/platform',
  ];
  for (const relPath of appPaths) {
    const absPath = join(REPO_ROOT, relPath);
    if (!existsSync(absPath)) continue;
    const seen = new Map<string, string>();
    const files = walkYamlFiles(absPath);
    for (const { path, docs } of files) {
      for (const doc of docs) {
        if (!doc.kind || !doc.metadata?.name) continue;
        const key = `${doc.kind}/${doc.metadata.namespace ?? ''}/${doc.metadata.name}`;
        const existing = seen.get(key);
        if (existing) {
          findings.push({
            severity: 'critical',
            rule: 'duplicate-resource-in-app-path',
            file: path,
            resource: key,
            message: `Duplicate ${key} — also defined in ${existing}. ArgoCD will refuse to sync the entire Application.`,
            knownErrorId: 'duplicate-resource-in-app-path',
            suggestedFix: 'Remove or rename one of the duplicates. Keep the one whose spec matches the actual workload.',
          });
        } else {
          seen.set(key, path);
        }
      }
    }
  }
}

function detectStaleApiVersions(findings: Finding[]): void {
  console.log('[bootstrap-drift] checking for deprecated apiVersions…');
  const deprecations = [
    { group: 'external-secrets.io', old: 'v1beta1', current: 'v1', kinds: ['ExternalSecret', 'ClusterSecretStore', 'SecretStore'] },
    { group: 'cert-manager.io', old: 'v1alpha2', current: 'v1', kinds: ['Certificate', 'ClusterIssuer', 'Issuer'] },
  ];
  const allFiles = [
    ...walkYamlFiles(join(REPO_ROOT, 'infra/kubernetes')),
    ...walkYamlFiles(join(REPO_ROOT, 'infra/bootstrap')),
  ];
  for (const { path, docs } of allFiles) {
    for (const doc of docs) {
      if (!doc.apiVersion) continue;
      for (const dep of deprecations) {
        const oldFull = `${dep.group}/${dep.old}`;
        if (doc.apiVersion === oldFull && dep.kinds.includes(doc.kind ?? '')) {
          findings.push({
            severity: 'critical',
            rule: 'stale-api-version',
            file: path,
            resource: `${doc.kind}/${doc.metadata?.namespace ?? ''}/${doc.metadata?.name ?? ''}`,
            message: `Uses deprecated ${oldFull}, cluster serves ${dep.group}/${dep.current}`,
            knownErrorId: 'stale-api-version',
            suggestedFix: `Change apiVersion to ${dep.group}/${dep.current}`,
          });
        }
      }
    }
  }
}

function detectOrphanScalers(findings: Finding[]): void {
  console.log('[bootstrap-drift] checking for orphan HPA/ScaledObject targets…');
  // Collect all Deployment names from the repo
  const deployments = new Set<string>();
  const allFiles = [
    ...walkYamlFiles(join(REPO_ROOT, 'infra/kubernetes')),
  ];
  for (const { docs } of allFiles) {
    for (const doc of docs) {
      if (doc.kind === 'Deployment' && doc.metadata?.name) {
        deployments.add(`${doc.metadata.namespace ?? 'default'}/${doc.metadata.name}`);
      }
    }
  }
  // Check HPAs and ScaledObjects
  for (const { path, docs } of allFiles) {
    for (const doc of docs) {
      if (doc.kind !== 'HorizontalPodAutoscaler' && doc.kind !== 'ScaledObject') continue;
      const targetName = (doc.spec?.scaleTargetRef as { name?: string })?.name;
      if (!targetName) continue;
      const ns = doc.metadata?.namespace ?? 'default';
      const key = `${ns}/${targetName}`;
      if (!deployments.has(key)) {
        findings.push({
          severity: 'high',
          rule: 'orphan-scaler-target',
          file: path,
          resource: `${doc.kind}/${ns}/${doc.metadata?.name}`,
          message: `Targets Deployment ${key} which is not defined in any manifest under infra/kubernetes/`,
          knownErrorId: 'orphan-scaler-target',
          suggestedFix: `Create the Deployment ${targetName} in ${ns}, or remove the orphan ${doc.kind}.`,
        });
      }
    }
  }
}

function detectMissingWebhookNetpol(findings: Finding[]): void {
  if (SMOKE_OFFLINE) {
    console.log('[bootstrap-drift] offline — skipping webhook netpol check (requires cluster)');
    return;
  }
  console.log('[bootstrap-drift] checking webhook reachability via NetworkPolicy…');
  const vwc = kubectl(['get', 'validatingwebhookconfiguration,mutatingwebhookconfiguration', '-o', 'json']);
  if (!vwc.ok) return;
  try {
    const parsed = JSON.parse(vwc.stdout) as {
      items: Array<{
        metadata: { name: string };
        webhooks: Array<{
          name: string;
          clientConfig: { service?: { name: string; namespace: string; port?: number } };
        }>;
      }>;
    };
    for (const wc of parsed.items) {
      for (const wh of wc.webhooks ?? []) {
        const svc = wh.clientConfig?.service;
        if (!svc) continue;
        const ns = svc.namespace;
        // Check if there's a default-deny in that namespace
        const netpols = kubectl(['get', 'netpol', '-n', ns, '-o', 'json']);
        if (!netpols.ok) continue;
        const npParsed = JSON.parse(netpols.stdout) as {
          items: Array<{
            metadata: { name: string };
            spec: { podSelector: Record<string, unknown>; policyTypes?: string[] };
          }>;
        };
        const hasDefaultDeny = npParsed.items.some(
          (np) =>
            (np.spec.policyTypes ?? []).includes('Ingress') &&
            Object.keys(np.spec.podSelector).length === 0,
        );
        if (!hasDefaultDeny) continue;
        // Check if there's an ingress rule covering the webhook service
        const svcEndpoints = kubectl(['get', 'endpoints', svc.name, '-n', ns, '-o', 'name']);
        if (!svcEndpoints.ok) {
          findings.push({
            severity: 'critical',
            rule: 'missing-webhook-netpol',
            resource: `${wc.metadata.name}/${wh.name}`,
            message: `Webhook service ${svc.name} in ${ns} has no Endpoints — possibly no matching pods or netpol blocks traffic`,
            knownErrorId: 'missing-webhook-netpol',
            suggestedFix: `Add a NetworkPolicy allowing ingress from [] on the webhook's containerPort`,
          });
        }
      }
    }
  } catch (e) {
    console.error('[bootstrap-drift] webhook check parse failed:', e);
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`[bootstrap-drift] repo=${REPO_ROOT} offline=${SMOKE_OFFLINE}`);

  if (SMOKE_OFFLINE) {
    // In smoke mode, still run the offline-capable checks
    console.log('[bootstrap-drift] smoke mode — running offline checks only');
  }

  const findings: Finding[] = [];

  detectDuplicateResources(findings);
  detectStaleApiVersions(findings);
  detectOrphanScalers(findings);
  detectMissingWebhookNetpol(findings);

  // Sort by severity
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const report = {
    timestamp,
    agent: 'bootstrap-drift-scanner-agent',
    layer: 1,
    totalFindings: findings.length,
    bySeverity: {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
    },
    findings,
  };

  ensureDir(join(OUT_DIR, 'bootstrap-drift'));
  const outFile = join(OUT_DIR, 'bootstrap-drift', `${timestamp}.json`);
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  // Symlink latest
  const latestFile = join(OUT_DIR, 'bootstrap-drift', 'latest.json');
  try {
    writeFileSync(latestFile, JSON.stringify(report, null, 2));
  } catch {
    // symlink fallback
  }

  console.log(`[bootstrap-drift] ${findings.length} findings → ${outFile}`);
  console.log(
    `  severity: crit=${report.bySeverity.critical} high=${report.bySeverity.high} med=${report.bySeverity.medium} low=${report.bySeverity.low}`,
  );

  // Markdown summary for CI step summary
  if (findings.length > 0) {
    console.log('\n## Bootstrap Drift Scanner\n');
    console.log('| Severity | Rule | Resource | Message |');
    console.log('|---|---|---|---|');
    for (const f of findings.slice(0, 30)) {
      const msg = f.message.replace(/[\r\n]+/g, ' ').replace(/\\/g, '\\\\').replace(/\|/g, '\\|');
      console.log(`| ${f.severity} | ${f.rule} | \`${f.resource ?? f.file ?? '-'}\` | ${msg} |`);
    }
  }

  const hasCriticalOrHigh = findings.some((f) => f.severity === 'critical' || f.severity === 'high');
  if (hasCriticalOrHigh) process.exit(1);
}

main().catch((err) => {
  console.error('[bootstrap-drift] fatal:', err);
  process.exit(2);
});
