# Per-Agent Memory

Persistent, agent-scoped memory that survives across sessions. Complements the project-level
`.claude/ledger/delegations.jsonl` (which tracks *work in flight*) and the user-level
`~/.claude/projects/-home-jfreire-velya/memory/` (which tracks *user/session* context).

## Why a separate per-agent store

The existing persistence layers do NOT cover:

| Need                                        | Ledger | User memory | Per-agent memory (this dir) |
| ------------------------------------------- | :----: | :---------: | :-------------------------: |
| "What did this specialist learn last run?"  |   no   |     no      |             yes             |
| "What are this agent's validated heuristics?" |   no   |     no      |             yes             |
| "What did the previous instance decide?"    |   no   |     no      |             yes             |
| "Which repo-wide invariants did it confirm?" |   no   |     no      |             yes             |

Each specialist (backend-quality-agent, security-reviewer, ui-audit-agent, etc.) accumulates
knowledge that is too durable for the ledger but too agent-specific for the user memory.

## File convention

- One file per agent: `<agent-name>.md`
- Frontmatter required:
  ```yaml
  ---
  agent: <agent-name>
  scope: <short description>
  lastUpdated: <ISO-8601>
  ---
  ```
- Body is append-only. Never rewrite past entries — add a new dated section.
- Entries follow the template in `_template.md`.

## How agents use it

1. **On invocation**: agent reads `.claude/agents/_memory/<own-name>.md` as part of its context.
2. **During work**: records novel findings, validated heuristics, or corrected mistakes.
3. **On completion**: appends a new dated entry (only if new durable knowledge was produced).

## What to write

- Validated heuristics: `"confirmed 2026-04-20: apps/web/app/(app)/layout.tsx owns sidebar width"`
- Corrected mistakes: `"do NOT edit MEMORY.md as a memory file — it is an index"`
- Repo-specific invariants: `"external-secrets CRD lives in observability ns, not kube-system"`
- Cross-session decisions that affect future runs of *this same agent*

## What NOT to write

- Ephemeral task state → that belongs in the delegation ledger
- User preferences → those belong in user memory (`~/.claude/projects/.../memory/`)
- Code conventions already documented in `.claude/rules/`
- Secrets, tokens, PHI — ever

## Size limits

- Target: < 200 lines per agent file
- When a file exceeds 300 lines, compress older entries into a `## Consolidated heuristics` section
- Stale entries (>90 days, no longer applicable) are moved to `_archive/<agent-name>-<date>.md`

## Read/write permissions

- Every agent may **read any** file in this directory
- An agent may **write only to its own** file (`<own-name>.md`)
- Cross-agent lessons are proposed via the ledger (`status: "pending"`, target
  `delegation-coordinator-agent`) — no direct cross-writes
