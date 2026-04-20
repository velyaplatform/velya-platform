/**
 * Fleet Autonomy Audit — valida que cada agent declarado em .claude/agents/*.md
 * possui um mecanismo de execução autônoma (CronJob no cluster, workflow do
 * GitHub Actions com `schedule:`, script runner) ou marcação explícita de
 * "on-demand" em _autonomy-exempt.json.
 *
 * Saída:
 *   - stdout: relatório em texto
 *   - $GITHUB_STEP_SUMMARY (se definido): trecho markdown
 *   - ./out/fleet-autonomy-report.json: relatório estruturado
 *
 * Exit code:
 *   0 — todos os agents com runtime declarado ou exempt
 *   1 — há órfãos (agent .md sem runtime e sem exempt)
 */

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

type AgentStatus = "runtime" | "orphan" | "exempt";

interface AgentRecord {
  name: string;
  file: string;
  status: AgentStatus;
  runtimes: string[];
  rationale?: string;
}

const REPO_ROOT = resolve(__dirname, "..", "..");
const AGENTS_DIR = join(REPO_ROOT, ".claude", "agents");
const EXEMPT_FILE = join(REPO_ROOT, ".claude", "agents", "_autonomy-exempt.json");
const OUT_DIR = join(REPO_ROOT, "out");

const RUNTIME_SEARCH_DIRS = [
  join(REPO_ROOT, "infra", "kubernetes"),
  join(REPO_ROOT, ".github", "workflows"),
  join(REPO_ROOT, "scripts", "agents"),
];

function readFileSafe(path: string): string {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

function listAgentFiles(): string[] {
  return readdirSync(AGENTS_DIR)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();
}

function walk(dir: string, acc: string[] = []): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const entry of entries) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function toRelative(path: string): string {
  return path.startsWith(REPO_ROOT) ? path.slice(REPO_ROOT.length + 1) : path;
}

function findRuntimeRefs(agentName: string, files: string[]): string[] {
  const safe = agentName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![\\w-])${safe}(?![\\w-])`);
  const out: string[] = [];
  for (const f of files) {
    const body = readFileSafe(f);
    if (body && re.test(body)) out.push(toRelative(f));
  }
  return out;
}

function loadExempt(): Record<string, string> {
  try {
    return JSON.parse(readFileSafe(EXEMPT_FILE) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function buildRecords(): AgentRecord[] {
  const exempt = loadExempt();
  const runtimeFiles: string[] = [];
  for (const d of RUNTIME_SEARCH_DIRS) walk(d, runtimeFiles);

  const records: AgentRecord[] = [];
  for (const file of listAgentFiles()) {
    const name = file.replace(/\.md$/, "");
    const refs = findRuntimeRefs(name, runtimeFiles);
    if (refs.length > 0) {
      records.push({ name, file, status: "runtime", runtimes: refs });
    } else if (exempt[name]) {
      records.push({
        name,
        file,
        status: "exempt",
        runtimes: [],
        rationale: exempt[name],
      });
    } else {
      records.push({ name, file, status: "orphan", runtimes: [] });
    }
  }
  return records;
}

function appendStepSummary(lines: string[]): void {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) return;
  try {
    mkdirSync(dirname(summary), { recursive: true });
    writeFileSync(summary, `${lines.join("\n")}\n`, { flag: "a" });
  } catch {
    // best-effort — never fail the audit over the summary
  }
}

function main(): number {
  const records = buildRecords();
  const counts = {
    total: records.length,
    runtime: records.filter((r) => r.status === "runtime").length,
    exempt: records.filter((r) => r.status === "exempt").length,
    orphan: records.filter((r) => r.status === "orphan").length,
  };

  console.log("=========================================================");
  console.log("  Fleet Autonomy Audit");
  console.log("=========================================================");
  console.log(`Agents total     : ${counts.total}`);
  console.log(`  with runtime   : ${counts.runtime}`);
  console.log(`  exempt         : ${counts.exempt}`);
  console.log(`  ORPHAN         : ${counts.orphan}`);
  console.log("");
  if (counts.orphan > 0) {
    console.log("Orphan agents (no runtime + no exempt entry):");
    for (const r of records.filter((r) => r.status === "orphan")) {
      console.log(`  - ${r.name}`);
    }
    console.log("");
    console.log(
      "To clear an agent intentionally, add it to .claude/agents/_autonomy-exempt.json",
    );
    console.log('  { "agent-name": "reason this agent does not need a schedule" }');
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, "fleet-autonomy-report.json"),
    JSON.stringify(
      { generatedAt: new Date().toISOString(), counts, records },
      null,
      2,
    ),
    "utf8",
  );

  const md: string[] = [
    "## Fleet Autonomy Audit",
    "",
    `- Total agents: **${counts.total}**`,
    `- With runtime: **${counts.runtime}**`,
    `- Exempt: **${counts.exempt}**`,
    `- **Orphan: ${counts.orphan}**`,
    "",
  ];
  if (counts.orphan > 0) {
    md.push("### Orphan agents", "");
    md.push("| Agent | Action |", "| --- | --- |");
    for (const r of records.filter((r) => r.status === "orphan")) {
      md.push(
        `| \`${r.name}\` | Add CronJob/workflow or list in \`_autonomy-exempt.json\` |`,
      );
    }
  }
  appendStepSummary(md);

  return counts.orphan > 0 ? 1 : 0;
}

process.exit(main());
