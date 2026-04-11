#!/usr/bin/env tsx
/**
 * run-pin-rot.ts — Entry point for pin-rot-agent.
 *
 * Detecta SHAs de GitHub Actions e digests de imagens Docker pinados nos
 * workflows do velya-platform que sumiram do upstream — a classe #1 de
 * "esteira vermelha" no Velya, e que Dependabot NÃO cobre (Dependabot só
 * sobe versões novas, não detecta pino deletado).
 *
 * Roda em DOIS modos:
 *   - Online (default): verifica cada pino contra GitHub API e Docker Hub
 *   - Offline (VELYA_PIN_ROT_OFFLINE=true): só parseia. Usado no smoke do CI
 *     pra não depender de rede / rate-limit / token.
 *
 * Designed to run as:
 *   - Kubernetes CronJob (infra/kubernetes/autopilot/agents-cronjobs.yaml)
 *   - Local CLI: `npx tsx scripts/agents/run-pin-rot.ts`
 *   - GitHub Actions smoke (auto-discovered por autopilot-agents-ci.yaml)
 *
 * Exit codes:
 *   0 — clean run (zero pins rotted) or offline mode
 *   1 — findings (at least one rotted pin)
 *   2 — fatal error
 *
 * Envs:
 *   VELYA_AUDIT_OUT          default /data/velya-autopilot
 *   VELYA_DRY_RUN            default true (cosmetic — agent never writes to repo)
 *   VELYA_REPO_ROOT          default cwd
 *   VELYA_PIN_ROT_OFFLINE    default false (true skips all network checks)
 *   GH_TOKEN                 optional — bumps GitHub API rate limit to 5000/hr
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

interface Pin {
  kind: 'action' | 'image';
  raw: string;
  owner: string;
  repo: string;
  digest: string;
  file: string;
  line: number;
}

interface Finding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  rule: 'pin-rot' | 'pin-unverified';
  pin: Pin;
  message: string;
}

const REPO_ROOT = process.env.VELYA_REPO_ROOT ?? process.cwd();
const OUT_DIR = process.env.VELYA_AUDIT_OUT ?? '/data/velya-autopilot';
const OFFLINE = !!process.env.VELYA_PIN_ROT_OFFLINE;
const GH_TOKEN = process.env.GH_TOKEN ?? '';

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function walkYaml(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkYaml(full, out);
    } else if (name.endsWith('.yml') || name.endsWith('.yaml')) {
      out.push(full);
    }
  }
}

// uses: owner/repo[/path]@<sha40>  — comment after # is allowed
const ACTION_RE = /^\s*-?\s*uses:\s*([\w.-]+)\/([\w.-]+)(\/[\w./-]+)?@([0-9a-f]{40})/;
// image: registry/owner/image@sha256:<digest>  ou  image: image@sha256:<digest>
const IMAGE_RE = /^\s*image:\s*([\w./:-]+?)@sha256:([0-9a-f]{64})/;

function parseWorkflowFile(file: string): Pin[] {
  const pins: Pin[] = [];
  const content = readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const a = ACTION_RE.exec(line);
    if (a) {
      pins.push({
        kind: 'action',
        raw: line.trim(),
        owner: a[1],
        repo: a[2],
        digest: a[4],
        file,
        line: i + 1,
      });
      continue;
    }
    const im = IMAGE_RE.exec(line);
    if (im) {
      // Split owner/repo from "registry/owner/image" — last segment is image,
      // first is owner. We don't strictly need the registry for Docker Hub.
      const parts = im[1].split('/');
      const repo = parts[parts.length - 1];
      const owner = parts.length > 1 ? parts[parts.length - 2] : 'library';
      pins.push({
        kind: 'image',
        raw: line.trim(),
        owner,
        repo,
        digest: 'sha256:' + im[2],
        file,
        line: i + 1,
      });
    }
  }
  return pins;
}

async function checkActionPin(pin: Pin): Promise<Finding | null> {
  // GitHub: GET /repos/{owner}/{repo}/git/commits/{sha}
  const url = `https://api.github.com/repos/${pin.owner}/${pin.repo}/git/commits/${pin.digest}`;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'velya-pin-rot-agent',
  };
  if (GH_TOKEN) headers.Authorization = `Bearer ${GH_TOKEN}`;
  try {
    const res = await fetch(url, { headers });
    if (res.status === 200) return null;
    if (res.status === 404 || res.status === 422) {
      return {
        severity: 'critical',
        rule: 'pin-rot',
        pin,
        message: `GitHub API ${res.status} — SHA não existe mais em ${pin.owner}/${pin.repo}`,
      };
    }
    if (res.status === 403) {
      return {
        severity: 'medium',
        rule: 'pin-unverified',
        pin,
        message: `GitHub API 403 (rate limit ou auth) — verificação adiada`,
      };
    }
    return {
      severity: 'medium',
      rule: 'pin-unverified',
      pin,
      message: `GitHub API status ${res.status} — verificação adiada`,
    };
  } catch (err) {
    return {
      severity: 'medium',
      rule: 'pin-unverified',
      pin,
      message: `network error: ${(err as Error).message}`,
    };
  }
}

async function checkImagePin(pin: Pin): Promise<Finding | null> {
  // Docker Hub manifest: HEAD /v2/<owner>/<image>/manifests/<digest>
  // Anonymous tokens are required for Docker Hub.
  const repoPath = pin.owner === 'library' ? pin.repo : `${pin.owner}/${pin.repo}`;
  try {
    // Step 1: get an anonymous bearer token
    const tokenUrl = `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repoPath}:pull`;
    const tokenRes = await fetch(tokenUrl, { headers: { 'User-Agent': 'velya-pin-rot-agent' } });
    if (!tokenRes.ok) {
      return {
        severity: 'medium',
        rule: 'pin-unverified',
        pin,
        message: `docker auth ${tokenRes.status} — verificação adiada`,
      };
    }
    const tokenData = (await tokenRes.json()) as { token?: string };
    const token = tokenData.token;
    if (!token) {
      return {
        severity: 'medium',
        rule: 'pin-unverified',
        pin,
        message: `docker auth missing token — verificação adiada`,
      };
    }
    // Step 2: HEAD the manifest
    const manifestUrl = `https://registry-1.docker.io/v2/${repoPath}/manifests/${pin.digest}`;
    const manifestRes = await fetch(manifestUrl, {
      method: 'HEAD',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept:
          'application/vnd.oci.image.index.v1+json,application/vnd.docker.distribution.manifest.list.v2+json,application/vnd.docker.distribution.manifest.v2+json,application/vnd.oci.image.manifest.v1+json',
        'User-Agent': 'velya-pin-rot-agent',
      },
    });
    if (manifestRes.status === 200) return null;
    if (manifestRes.status === 404) {
      return {
        severity: 'critical',
        rule: 'pin-rot',
        pin,
        message: `Docker Hub 404 — digest não existe mais em ${repoPath}`,
      };
    }
    return {
      severity: 'medium',
      rule: 'pin-unverified',
      pin,
      message: `docker manifest status ${manifestRes.status} — verificação adiada`,
    };
  } catch (err) {
    return {
      severity: 'medium',
      rule: 'pin-unverified',
      pin,
      message: `network error: ${(err as Error).message}`,
    };
  }
}

async function main(): Promise<void> {
  console.log('[pin-rot] Scanning workflow pins…');
  console.log(`[pin-rot] REPO_ROOT=${REPO_ROOT}  OFFLINE=${OFFLINE}  TOKEN=${GH_TOKEN ? 'yes' : 'no'}`);

  const workflowDirs = [
    join(REPO_ROOT, '.github/workflows'),
    join(REPO_ROOT, '.github/actions'),
  ];
  const files: string[] = [];
  for (const d of workflowDirs) walkYaml(d, files);
  console.log(`[pin-rot] Discovered ${files.length} workflow file(s)`);

  const pins: Pin[] = [];
  for (const f of files) pins.push(...parseWorkflowFile(f));
  console.log(
    `[pin-rot] Parsed ${pins.length} pin(s) ` +
      `(${pins.filter((p) => p.kind === 'action').length} action, ${pins.filter((p) => p.kind === 'image').length} image)`,
  );

  const findings: Finding[] = [];

  if (OFFLINE) {
    console.log('[pin-rot] OFFLINE mode — skipping upstream verification.');
  } else {
    // Cap concurrency at 4 to be polite to upstream APIs.
    const queue = [...pins];
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length > 0) {
        const pin = queue.shift();
        if (!pin) break;
        const f =
          pin.kind === 'action' ? await checkActionPin(pin) : await checkImagePin(pin);
        if (f) {
          findings.push(f);
          const sev = f.severity.toUpperCase();
          console.log(
            `[pin-rot] ${sev}: ${pin.kind} ${pin.owner}/${pin.repo}@${pin.digest.slice(0, 12)}… (${pin.file}:${pin.line}) — ${f.message}`,
          );
        }
      }
    });
    await Promise.all(workers);
  }

  // Persist
  ensureDir(join(OUT_DIR, 'pin-rot'));
  const report = {
    timestamp: new Date().toISOString(),
    mode: OFFLINE ? 'offline' : 'online',
    repo_root: REPO_ROOT,
    files_scanned: files.length,
    pins_total: pins.length,
    pins_action: pins.filter((p) => p.kind === 'action').length,
    pins_image: pins.filter((p) => p.kind === 'image').length,
    findings_total: findings.length,
    findings_critical: findings.filter((f) => f.severity === 'critical').length,
    findings_high: findings.filter((f) => f.severity === 'high').length,
    findings_medium: findings.filter((f) => f.severity === 'medium').length,
    findings,
    pins,
  };
  const reportFile = join(OUT_DIR, 'pin-rot', `${timestamp}.json`);
  const latestFile = join(OUT_DIR, 'pin-rot', 'latest.json');
  writeFileSync(reportFile, JSON.stringify(report, null, 2));
  writeFileSync(latestFile, JSON.stringify(report, null, 2));
  console.log(`[pin-rot] Report written to ${reportFile}`);

  // Human-readable summary
  const summaryLines = [
    `Pin Rot Agent — ${report.timestamp}`,
    `Mode: ${report.mode}`,
    `Files scanned: ${report.files_scanned}`,
    `Pins parsed: ${report.pins_total} (${report.pins_action} action, ${report.pins_image} image)`,
    `Findings: ${report.findings_total} ` +
      `(${report.findings_critical} critical, ${report.findings_high} high, ${report.findings_medium} medium)`,
    '',
  ];
  for (const f of findings) {
    summaryLines.push(
      `[${f.severity.toUpperCase()}] ${f.pin.kind} ${f.pin.owner}/${f.pin.repo}@${f.pin.digest.slice(0, 12)}…`,
    );
    summaryLines.push(`  ${f.pin.file}:${f.pin.line}`);
    summaryLines.push(`  ${f.message}`);
  }
  writeFileSync(join(OUT_DIR, 'pin-rot', 'findings-summary.txt'), summaryLines.join('\n') + '\n');

  // Exit code
  const critical = findings.filter((f) => f.severity === 'critical' || f.severity === 'high');
  if (critical.length > 0) {
    console.log(`[pin-rot] ❌ ${critical.length} critical/high finding(s) — exit 1`);
    process.exit(1);
  }
  console.log('[pin-rot] ✅ no rotted pins detected');
  process.exit(0);
}

main().catch((err) => {
  console.error('[pin-rot] FATAL', err);
  process.exit(2);
});
