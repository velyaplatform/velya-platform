import fsp from "node:fs/promises";
import path from "node:path";

export interface DelegationEntry {
  id: string;
  ts: string;
  from: string;
  to: string;
  task: string;
  context: string;
  status: "pending" | "in-progress" | "completed" | "blocked" | "rejected";
  evidencePath?: string | null;
  blockReason?: string;
  origin?: "ledger" | "coordination";
}

export async function loadDelegations(projectRoot: string): Promise<DelegationEntry[]> {
  const file = path.join(projectRoot, ".claude", "ledger", "delegations.jsonl");
  let raw: string;
  try {
    raw = await fsp.readFile(file, "utf-8");
  } catch {
    return [];
  }
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  const byId = new Map<string, DelegationEntry>();
  for (const line of lines) {
    try {
      const obj = JSON.parse(line) as DelegationEntry;
      if (!obj.id) continue;
      byId.set(obj.id, { ...obj, origin: obj.origin ?? "ledger" }); // última linha por id ganha
    } catch {
      // skip malformed
    }
  }
  const items = Array.from(byId.values());
  items.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  return items;
}
