---
id: draft-notes
name: Redigir release notes
agent: release-writer
execution: subagent
model_tier: powerful
---

# Step 02 — Redigir release notes

## Objetivo
Transformar o brief do step 01 em changelog técnico + anúncio stakeholder em Português (Brasil).

## Inputs
- `squads/release-notes/output/{run_id}/01-commit-brief.md`
- `_opensquad/_memory/company.md`
- Agents definidos em `squad-party.csv`

## Execução

1. Adotar a persona do `release-writer.agent.md`.
2. Ler brief + company.md.
3. Gerar `02-changelog.md` — sempre.
4. Gerar `03-stakeholder-announcement.md` — somente se houver feature/fix/breaking change relevante.
5. Incluir seção "Cobertura" no changelog listando commits cobertos e ignorados (com razão).

## Output
- `squads/release-notes/output/{run_id}/02-changelog.md`
- `squads/release-notes/output/{run_id}/03-stakeholder-announcement.md` (condicional)
- State: `agents[release-writer].status = "working"` → `"done"`, `handoff` aponta para `technical-reviewer`.
