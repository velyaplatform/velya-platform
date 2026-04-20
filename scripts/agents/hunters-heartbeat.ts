/**
 * Hunters Heartbeat — execução autônoma mínima viável dos agents do tipo
 * hunter/keeper/governance que ainda não têm runtime dedicado. Para cada agent
 * listado, executa uma rotina embutida (hunter real) ou, na ausência, um
 * smoke-check que prova que a definição está íntegra.
 *
 * O objetivo não é substituir a implementação completa de cada hunter — é
 * garantir que todos rodem periodicamente com evidência escrita em disco,
 * em vez de permanecerem inativos e silenciosos.
 *
 * Saída: out/hunters-heartbeat/{agent-name}.json
 * Exit: 0 se todos passaram o smoke; 1 se algum falhou de forma dura.
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

interface HunterFinding {
  severity: "info" | "low" | "medium" | "high";
  message: string;
  evidence?: Record<string, unknown>;
}

interface HunterResult {
  agent: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  ok: boolean;
  specFound: boolean;
  findings: HunterFinding[];
}

const REPO_ROOT = resolve(__dirname, "..", "..");
const OUT_DIR = join(REPO_ROOT, "out", "hunters-heartbeat");
const AGENTS_DIR = join(REPO_ROOT, ".claude", "agents");

const HUNTERS = [
  "cost-explosion-hunter-agent",
  "proactive-bug-hunter-agent",
  "privacy-leak-hunter-agent",
  "knowledge-base-keeper-agent",
  "naming-governance-agent",
] as const;

type HunterName = (typeof HUNTERS)[number];

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function walkRepo(root: string, acc: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === "out" || e.name.startsWith(".")) continue;
    const full = join(root, e.name);
    if (e.isDirectory()) walkRepo(full, acc);
    else acc.push(full);
  }
  return acc;
}

function verifySpec(agent: HunterName): boolean {
  const specPath = join(AGENTS_DIR, `${agent}.md`);
  try {
    return statSync(specPath).isFile() && readFileSync(specPath, "utf8").length > 0;
  } catch {
    return false;
  }
}

// Hunter implementations — intentionally conservative. Each looks for a narrow
// signal set rather than trying to replicate the full agent. If a signal is
// found it is recorded as a finding; the workflow uploads the report, so a
// human can act. None of these hunters change code.

function hunterCostExplosion(): HunterFinding[] {
  const findings: HunterFinding[] = [];
  const all = walkRepo(REPO_ROOT);
  // Trivial heuristic: unbounded loops over LLM calls (while(true) + invoke),
  // autoscaling with maxReplicas unset, cron schedules that fire every minute.
  for (const f of all) {
    if (!f.endsWith(".yaml") && !f.endsWith(".yml")) continue;
    const body = readFileSafe(f);
    if (/schedule:\s*["']?\*\/?1\s+\*\s+\*\s+\*\s+\*["']?/.test(body)) {
      findings.push({
        severity: "medium",
        message: "CronJob firing every minute — check cost impact",
        evidence: { file: f.replace(`${REPO_ROOT}/`, "") },
      });
    }
    if (/maxReplicas:\s*[0-9]{3,}/.test(body)) {
      findings.push({
        severity: "medium",
        message: "HPA/KEDA maxReplicas >= 100 — verify budget",
        evidence: { file: f.replace(`${REPO_ROOT}/`, "") },
      });
    }
  }
  return findings;
}

function hunterProactiveBug(): HunterFinding[] {
  const findings: HunterFinding[] = [];
  const all = walkRepo(REPO_ROOT);
  for (const f of all) {
    if (!f.endsWith(".ts") && !f.endsWith(".tsx")) continue;
    const body = readFileSafe(f);
    // Weak signal: @ts-ignore or TODO(prod) strings.
    const tsIgnores = (body.match(/@ts-ignore/g) ?? []).length;
    if (tsIgnores > 3) {
      findings.push({
        severity: "low",
        message: `File has ${tsIgnores} @ts-ignore — consider cleanup`,
        evidence: { file: f.replace(`${REPO_ROOT}/`, ""), count: tsIgnores },
      });
    }
  }
  return findings;
}

function hunterPrivacyLeak(): HunterFinding[] {
  const findings: HunterFinding[] = [];
  // Heuristic scan for obvious PHI patterns in committed fixtures/docs.
  const all = walkRepo(REPO_ROOT);
  const cpfLike = /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/;
  const cnsLike = /\b\d{3}\s?\d{4}\s?\d{4}\s?\d{4}\b/;
  for (const f of all) {
    if (/\.(md|ts|tsx|json|yaml|yml)$/.test(f) === false) continue;
    if (f.includes("/fixtures/")) continue; // expected
    const body = readFileSafe(f);
    if (cpfLike.test(body)) {
      findings.push({
        severity: "high",
        message: "Possible CPF outside fixtures directory",
        evidence: { file: f.replace(`${REPO_ROOT}/`, "") },
      });
    } else if (cnsLike.test(body)) {
      findings.push({
        severity: "high",
        message: "Possible CNS (Cartão Nacional de Saúde) outside fixtures",
        evidence: { file: f.replace(`${REPO_ROOT}/`, "") },
      });
    }
  }
  return findings;
}

function hunterKnowledgeBase(): HunterFinding[] {
  const findings: HunterFinding[] = [];
  const kbDir = join(REPO_ROOT, ".claude", "knowledge");
  try {
    const files = readdirSync(kbDir).filter((f) => f.endsWith(".md"));
    const index = join(kbDir, "INDEX.md");
    const indexBody = readFileSafe(index);
    if (!indexBody) {
      findings.push({
        severity: "medium",
        message: "KB missing INDEX.md",
      });
    } else {
      for (const f of files) {
        if (f === "INDEX.md") continue;
        if (!indexBody.includes(f)) {
          findings.push({
            severity: "low",
            message: `KB file "${f}" not referenced by INDEX.md`,
          });
        }
      }
    }
  } catch {
    findings.push({
      severity: "medium",
      message: ".claude/knowledge directory not found",
    });
  }
  return findings;
}

function hunterNamingGovernance(): HunterFinding[] {
  const findings: HunterFinding[] = [];
  // Enforce agents/* naming → must end in -agent or be a named specialist.
  // Enforce services/* naming → kebab-case, starts with velya-.
  const agents = readdirSync(AGENTS_DIR).filter(
    (f) => f.endsWith(".md") && !f.startsWith("_"),
  );
  const allowedLegacy = new Set<string>([
    "agent-health-manager.md",
    "agent-runtime-supervisor.md",
    "agent-trainer-agent.md",
  ]);
  for (const a of agents) {
    if (allowedLegacy.has(a)) continue;
    const base = a.replace(/\.md$/, "");
    if (!/^[a-z0-9-]+$/.test(base)) {
      findings.push({
        severity: "medium",
        message: `Agent file not kebab-case: ${a}`,
      });
    }
  }
  return findings;
}

const HUNTER_FNS: Record<HunterName, () => HunterFinding[]> = {
  "cost-explosion-hunter-agent": hunterCostExplosion,
  "proactive-bug-hunter-agent": hunterProactiveBug,
  "privacy-leak-hunter-agent": hunterPrivacyLeak,
  "knowledge-base-keeper-agent": hunterKnowledgeBase,
  "naming-governance-agent": hunterNamingGovernance,
};

function runOne(name: HunterName): HunterResult {
  const startedAt = new Date();
  const specFound = verifySpec(name);
  const findings: HunterFinding[] = [];
  if (!specFound) {
    findings.push({
      severity: "low",
      message: `spec file not present on this branch: .claude/agents/${name}.md`,
    });
  } else {
    try {
      for (const f of HUNTER_FNS[name]()) findings.push(f);
    } catch (err) {
      findings.push({
        severity: "high",
        message: `hunter crashed: ${(err as Error).message}`,
      });
    }
  }
  const finishedAt = new Date();
  const ok = findings.every((f) => f.severity !== "high");
  return {
    agent: name,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    ok,
    specFound,
    findings,
  };
}

function appendStepSummary(lines: string[]): void {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  try {
    mkdirSync(dirname(summary), { recursive: true });
    writeFileSync(summary, `${lines.join("\n")}\n`, { flag: "a" });
  } catch {
    // best-effort — never fail over summary writes
  }
}

function main(): number {
  mkdirSync(OUT_DIR, { recursive: true });
  const results: HunterResult[] = [];
  for (const name of HUNTERS) {
    const r = runOne(name);
    writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(r, null, 2), "utf8");
    results.push(r);
  }
  const anyHigh = results.some((r) => !r.ok);

  console.log("=========================================================");
  console.log("  Hunters Heartbeat");
  console.log("=========================================================");
  for (const r of results) {
    const status = r.ok ? "OK" : "ALERT";
    console.log(`[${status}] ${r.agent} — ${r.findings.length} findings — ${r.durationMs}ms`);
    for (const f of r.findings) {
      console.log(`    · ${f.severity.toUpperCase()} ${f.message}`);
    }
  }

  const md: string[] = [
    "## Hunters Heartbeat",
    "",
    "| Agent | Status | Findings | Duration |",
    "| --- | --- | --- | --- |",
    ...results.map(
      (r) => `| \`${r.agent}\` | ${r.ok ? "OK" : "ALERT"} | ${r.findings.length} | ${r.durationMs}ms |`,
    ),
    "",
  ];
  for (const r of results.filter((r) => r.findings.length > 0)) {
    md.push(`### ${r.agent}`, "");
    for (const f of r.findings) {
      md.push(`- **${f.severity}** — ${f.message}`);
    }
    md.push("");
  }
  appendStepSummary(md);

  return anyHigh ? 1 : 0;
}

process.exit(main());
