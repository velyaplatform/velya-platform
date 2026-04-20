---
id: collect-commits
name: Coletar commits de release
agent: commit-collector
execution: inline
model_tier: fast
---

# Step 01 — Coletar commits de release

## Objetivo
Produzir um brief estruturado dos commits entre duas tags de release do `velya-platform`.

## Inputs
- Tag de destino (opcional — default: última `chore(release): v*`)
- Tag de origem (opcional — default: release imediatamente anterior)

## Execução

1. Adotar a persona do `commit-collector.agent.md`.
2. Descobrir as duas tags de release relevantes usando git log.
3. Coletar commits entre elas com `git log <origem>..<destino> --oneline --no-merges`.
4. Classificar cada commit por tipo Conventional Commit.
5. Escrever o brief em `squads/release-notes/output/{run_id}/01-commit-brief.md` seguindo o formato da seção "Output Examples" do agent.
6. Apresentar resumo ao usuário: tags detectadas, contagem de commits, seções que terão conteúdo. Checkpoint via `AskUserQuestion` com opções: **Seguir**, **Ajustar range**, **Cancelar**.

## Output
- Arquivo: `squads/release-notes/output/{run_id}/01-commit-brief.md`
- State: atualizar `state.json` → `agents[commit-collector].status = "working"` no início, `= "done"` no fim.
