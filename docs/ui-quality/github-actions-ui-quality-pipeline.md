# Pipeline GitHub Actions — UI Quality

Este documento descreve o workflow GitHub Actions que executa a esteira
completa de UI Quality da Velya: static guardrails, visual regression,
accessibility, geometry e Lighthouse.

Arquivo: `.github/workflows/ui-quality.yaml`.

## Triggers

| Evento             | Quando roda                              |
| ------------------ | ---------------------------------------- |
| `pull_request`     | PRs que tocam `apps/web/**`, `packages/**` |
| `push` em `main`   | Merges em main afetando `apps/web/**`    |
| `workflow_dispatch`| Execução manual                          |
| `schedule` (noturno)| `0 3 * * *` para matriz completa        |

## Concorrência

```yaml
concurrency:
  group: ui-quality-${{ github.ref }}
  cancel-in-progress: true
```

PRs cancelam runs anteriores do mesmo ref. Não cancela runs em `main`.

## Permissões

Mínimas:

```yaml
permissions:
  contents: read
  pull-requests: write
```

`pull-requests: write` permite postar comentários de triagem automática.

## Jobs

### 1. `static-guardrails`

**Timeout:** 5 minutos.
**Gate:** bloqueante.

Steps:

1. Checkout.
2. Setup Node 22 (cache npm).
3. `npm ci`.
4. `tsc --noEmit` — valida tipos.
5. `eslint apps/web --max-warnings 0` — lint rigoroso.

### 2. `visual-and-accessibility`

**Timeout:** 15 minutos.
**Gate:** bloqueante.

Steps:

1. Checkout.
2. Setup Node 22.
3. `npm ci`.
4. `npx playwright install --with-deps chromium`.
5. Build `apps/web` em modo standalone.
6. Sobe servidor na porta 3333.
7. Aguarda server ready com loop de curl.
8. Executa `scripts/visual-test.ts`:
   - Screenshots por viewport.
   - axe-core por página.
   - Geometry checks.
9. Upload de artifacts: `/tmp/velya-screenshots/` (retenção 14d).

### 3. `lighthouse`

**Timeout:** 10 minutos.
**Gate:** bloqueante.

Steps:

1. Checkout.
2. Setup Node 22.
3. `npm ci`.
4. Install `@lhci/cli` globalmente.
5. Build `apps/web`.
6. Sobe server na porta 3334.
7. Executa `lhci autorun` contra rotas definidas.
8. Upload para `temporary-public-storage`.

### 4. `summary`

**Needs:** todos os jobs anteriores.
**`if: always()`:** roda mesmo se outros jobs falharem.

Gera `$GITHUB_STEP_SUMMARY` com tabela de status de cada job. Útil para
revisão rápida no PR.

## Pinning de Actions

Todas as actions são pinadas por SHA completa:

- `actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11` (v4.1.1)
- `actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8` (v4.0.2)
- `actions/upload-artifact@5d5d22a31266ced268874388b861e4b58bb5c2f3` (v4.3.1)

Qualquer upgrade exige PR dedicado atualizando SHA + tag comentada.

## Matrix Strategy (futuro)

O workflow atual roda em `ubuntu-latest` apenas. Para cobertura completa da
matriz responsiva, o noturno usa matrix:

```yaml
strategy:
  matrix:
    project: [desktop-lg, desktop-md, tablet-portrait, mobile-iphone, mobile-android-md]
```

## Gates Bloqueantes

| Job                       | PR bloqueia | main bloqueia |
| ------------------------- | ----------- | ------------- |
| `static-guardrails`       | sim         | sim           |
| `visual-and-accessibility`| sim         | sim           |
| `lighthouse`              | sim         | sim           |
| `summary`                 | não (informativo) | não     |

Se `visual-and-accessibility` encontra violação critical de acessibilidade,
a linha `Visual + A11y + Geometry` sai como `failure` na summary e bloqueia
o merge (via branch protection rule).

## Artefatos

| Artifact                | Retenção | Origem                        |
| ----------------------- | -------- | ----------------------------- |
| `visual-test-results`   | 14 dias  | `/tmp/velya-screenshots/`     |
| `playwright-report`     | 14 dias  | `playwright-report/visual/`   |
| `lighthouse-reports`    | 30 dias  | `.lighthouseci/`              |
| `axe-reports`           | 14 dias  | `test-results/axe-*.json`     |
| `geometry-reports`      | 14 dias  | `test-results/geometry-*.json`|

## Comentário Automático em PR

Um job adicional (não incluído no workflow inicial, mas planejado) executa
`scripts/triage-ui-failures.ts`, que:

1. Lê artefatos do run.
2. Classifica falhas.
3. Posta comentário resumido no PR com tabela de tipos, severidade e donos.

## Noturno Estendido

Workflow `ui-quality-nightly.yaml` (separado) roda:

- Toda a matriz de viewports.
- Lighthouse em mobile + desktop.
- Testes de fluxo (`@flow`) completos.
- Testes `@flaky` em modo informativo.
- Geração de scorecard atualizado.

## Execução Local do Mesmo Fluxo

```bash
# Build
npm run build --workspace=apps/web

# Server
cd apps/web && PORT=3333 node .next/standalone/apps/web/server.js &

# Visual test
TEST_URL=http://localhost:3333 npx tsx scripts/visual-test.ts

# Lighthouse
lhci autorun --collect.url=http://localhost:3333/ --upload.target=temporary-public-storage
```

## Debug de Runs Falhados

1. Abrir o run na aba Actions.
2. Baixar artifact `visual-test-results`.
3. Comparar screenshots `*.png` com baselines em `tests/visual/__screenshots__/`.
4. Checar `axe-*.json` para violações específicas.
5. Checar `geometry-*.json` para problemas de layout.
6. Se for flaky, abrir trace com `npx playwright show-trace`.

## Não Fazer

- Não desabilitar `fail-fast` para ignorar falhas.
- Não aumentar `timeout-minutes` sem investigar lentidão.
- Não comitar secrets no workflow.
- Não rodar workflow contra backend real.
- Não usar `actions/checkout@v4` (tag mutável) — sempre SHA.
