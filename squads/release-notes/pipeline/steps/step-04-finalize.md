---
id: finalize
name: Aprovar e salvar
agent: technical-reviewer
execution: inline
model_tier: fast
checkpoint: true
---

# Step 04 — Aprovar e salvar (checkpoint humano)

## Objetivo
Checkpoint final com decisão humana antes de qualquer publicação.

## Execução

1. Apresentar ao usuário via `AskUserQuestion`:
   - **Aprovar e salvar no repo** — copia `02-changelog.md` para `CHANGELOG.md` (append) e abre PR.
   - **Aprovar só o draft** — mantém em `output/{run_id}/`, não mexe no repo.
   - **Revisar** — volta para o step 02 com os achados.
   - **Descartar** — registra no `runs.md` como cancelado e termina.
2. Aplicar a decisão.
3. Atualizar `squads/release-notes/_memory/runs.md` com a linha desta run.
4. Limpar `state.json` → `status = "idle"`, zerar `step.current`, agents voltam a `"idle"`.

## Regras de publicação

- **Nunca** push para origin sem confirmação explícita.
- **Nunca** force push.
- PR sempre contra `main`, branch `release-notes/v<versão>`.
- Se commits `clinical` no changelog: incluir reviewer do Clinical Safety Office (`clinical-safety-gap-hunter-agent`).
