#!/usr/bin/env node

import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const auditRoot = process.env.VELYA_AUDIT_OUT ?? "/data/velya-autopilot";
const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

const outPath = path.resolve(getArg("out", path.join(repoRoot, "ops", "state", "agent-sync-status.json")));
const healthFile = getArg("health-file", null);
const intervalSeconds = Number.parseInt(getArg("interval", "60"), 10);
const runOnce = hasFlag("once");

const EXPECTED_CADENCE_MIN = {
  "delegation-coordinator-agent": 15,
  "argocd-healer-agent": 15,
  "k8s-troubleshooter-agent": 15,
  "infra-health-agent": 30,
  "agent-health-manager-agent": 30,
  "agent-runtime-supervisor-agent": 30,
  "backend-quality-agent": 60,
  "frontend-quality-agent": 60,
  "meta-governance-auditor-agent": 240,
  "pin-rot-agent": 360,
};

const LAYER = {
  "delegation-coordinator-agent": 2,
  "argocd-healer-agent": 1,
  "k8s-troubleshooter-agent": 1,
  "infra-health-agent": 1,
  "backend-quality-agent": 1,
  "frontend-quality-agent": 1,
  "pin-rot-agent": 1,
  "agent-health-manager-agent": 2,
  "agent-runtime-supervisor-agent": 2,
  "meta-governance-auditor-agent": 3,
};

const AUDIT_DIRS = {
  "delegation-coordinator-agent": "delegation-coordinator",
  "argocd-healer-agent": "argocd-audit",
  "k8s-troubleshooter-agent": "k8s-troubleshoot",
  "infra-health-agent": "infra-audit",
  "agent-health-manager-agent": "manager-audit",
  "agent-runtime-supervisor-agent": "runtime-supervisor",
  "backend-quality-agent": "backend-quality",
  "frontend-quality-agent": "frontend-quality",
  "meta-governance-auditor-agent": "governance-audit",
  "pin-rot-agent": "pin-rot",
};

function minutesSince(iso) {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.floor((Date.now() - parsed) / 60_000));
}

function worstSeverity(bySeverity = {}) {
  if ((bySeverity.critical ?? 0) > 0) return "critical";
  if ((bySeverity.high ?? 0) > 0) return "high";
  if ((bySeverity.medium ?? 0) > 0) return "medium";
  if ((bySeverity.low ?? 0) > 0) return "low";
  return "none";
}

function discoverAgents() {
  const dir = path.join(repoRoot, "scripts", "agents");
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }

  return files
    .filter((file) => /^run-.+\.ts$/.test(file))
    .map((script) => {
      const base = script.replace(/^run-/, "").replace(/\.ts$/, "");
      const name = `${base}-agent`;
      return {
        name,
        script: path.join("scripts", "agents", script),
        layer: LAYER[name] ?? 1,
        status: "active",
      };
    });
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function readLatestReport(agentName) {
  const dir = AUDIT_DIRS[agentName];
  if (!dir) return null;
  return readJson(path.join(auditRoot, dir, "latest.json"));
}

function readCollection(dirName, pattern) {
  const dir = path.join(auditRoot, dirName);
  let files = [];
  try {
    files = fs.readdirSync(dir);
  } catch {
    return [];
  }

  return files
    .filter((file) => pattern.test(file))
    .map((file) => readJson(path.join(dir, file)))
    .filter((entry) => entry != null);
}

function buildSnapshot() {
  const agents = discoverAgents();
  const staleAgents = [];

  for (const agent of agents) {
    const report = readLatestReport(agent.name);
    if (!report) continue;
    agent.lastReportAt = report.timestamp;
    agent.lastReportSeverity = worstSeverity(report.bySeverity);
    const cadence = EXPECTED_CADENCE_MIN[agent.name];
    const ageMin = minutesSince(agent.lastReportAt);
    if (cadence != null && ageMin != null && ageMin > cadence * 2) {
      staleAgents.push(agent.name);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    schemaVersion: 1,
    agents,
    locks: readCollection("locks", /\.lock\.json$/),
    handoffs: readCollection("handoffs", /\.json$/),
    staleAgents,
  };
}

async function writeJsonFile(filePath, data) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function syncOnce() {
  const snapshot = buildSnapshot();
  await writeJsonFile(outPath, snapshot);

  const summary = {
    generatedAt: snapshot.generatedAt,
    outPath,
    agents: snapshot.agents.length,
    staleAgents: snapshot.staleAgents.length,
  };

  if (healthFile) {
    await writeJsonFile(path.resolve(healthFile), summary);
  }

  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

async function main() {
  if (runOnce) {
    await syncOnce();
    return;
  }

  while (true) {
    try {
      await syncOnce();
    } catch (error) {
      const message = error instanceof Error ? error.stack ?? error.message : String(error);
      process.stderr.write(`[agent-coordination-sync] ${message}\n`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
