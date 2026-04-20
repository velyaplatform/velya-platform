#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const parsed = {};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (!arg.startsWith("--")) continue;
  const key = arg.slice(2);
  const value = args[i + 1];
  if (value == null || value.startsWith("--")) {
    parsed[key] = "true";
    i -= 1;
    continue;
  }
  parsed[key] = value;
}

const required = ["id", "from", "to", "task", "context", "status"];
const missing = required.filter((key) => !parsed[key]);

if (missing.length > 0) {
  console.error(`Missing required args: ${missing.join(", ")}`);
  process.exit(1);
}

const allowedStatuses = new Set([
  "pending",
  "in-progress",
  "completed",
  "blocked",
  "rejected",
]);

if (!allowedStatuses.has(parsed.status)) {
  console.error(`Invalid status: ${parsed.status}`);
  process.exit(1);
}

const projectRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const ledgerPath = path.join(projectRoot, ".claude", "ledger", "delegations.jsonl");
const entry = {
  id: parsed.id,
  ts: parsed.ts ?? new Date().toISOString(),
  from: parsed.from,
  to: parsed.to,
  task: parsed.task,
  context: parsed.context,
  status: parsed.status,
};

if (parsed["evidence-path"]) {
  entry.evidencePath = parsed["evidence-path"];
}
if (parsed["block-reason"]) {
  entry.blockReason = parsed["block-reason"];
}

fs.mkdirSync(path.dirname(ledgerPath), { recursive: true });
fs.appendFileSync(ledgerPath, `${JSON.stringify(entry)}\n`, "utf8");
process.stdout.write(`${ledgerPath}\n`);
