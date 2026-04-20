---
agent: <agent-name>
scope: <one-line description of this agent's memory scope>
lastUpdated: 2026-04-20T00:00:00Z
---

# <agent-name> — persistent memory

Append-only log of durable knowledge produced by this agent across sessions.

## How to append

1. Never rewrite past entries. Always add a new dated section below.
2. Update the `lastUpdated` field in the frontmatter.
3. Keep entries tight: one paragraph max per finding.
4. If a prior heuristic was invalidated, do NOT delete it — write a new entry
   marking it invalidated and cite the new truth.

---

## 2026-04-20 — initial entry

- **Charter reminder**: <copy one sentence from the agent's .md definition>
- **Repo invariants confirmed**: <list the 2-3 things this agent takes for granted>
- **Open questions**: <what this agent still needs to validate>

<!-- append new dated sections below this line -->
