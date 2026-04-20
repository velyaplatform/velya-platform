---
id: review-notes
name: Revisar release notes
agent: technical-reviewer
execution: inline
model_tier: fast
---

# Step 03 — Revisar release notes

## Objetivo
Validar changelog + anúncio contra brief, vocabulário proibido e padrões de PHI/segredo.

## Execução

1. Adotar a persona do `technical-reviewer.agent.md`.
2. Ler `01-commit-brief.md`, `02-changelog.md` e `03-stakeholder-announcement.md` (se existir).
3. Rodar checagens:
   - Rastreabilidade commit ↔ changelog.
   - Vocabulário proibido.
   - PHI/segredos (nomes, MRN, CPF, tokens, API keys).
   - Clinical Safety disclaimer se commits `clinical` aparecerem.
4. Produzir relatório em `04-review.md` com achados classificados por severidade.

## Output
- `squads/release-notes/output/{run_id}/04-review.md`
- State: `agents[technical-reviewer].status = "working"` → `"done"`.
