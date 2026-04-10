# Política de Atualização de Baselines Visuais

Baselines de visual regression são um contrato visual. Quando atualizadas,
elas declaram "esse é o novo visual correto". Por isso, atualizá-las sem
revisão é o caminho mais rápido para regressões visuais passarem despercebidas.

Este documento define a política da Velya para atualização de baselines.

## Princípios

1. **Baselines só são atualizadas em PRs dedicados.** Nunca em PRs de feature.
2. **Toda atualização de baseline exige revisão visual humana** obrigatória.
3. **Baselines são geradas em CI**, nunca localmente. O ambiente local tem
   fontes, escala e GPU diferentes e produz imagens não-determinísticas.
4. **Atualização sem justificativa é bloqueada.** O PR descreve qual mudança
   visual motiva o update.

## Fluxo Padrão

### Cenário 1: Atualização planejada (mudança de design)

1. Desenvolvedor abre PR normal de feature com a mudança de UI.
2. CI roda visual regression e **falha** nos screenshots afetados.
3. Desenvolvedor:
   a. Valida que a falha é esperada (nova UI).
   b. Faz merge do PR de feature sem as baselines novas — o teste continua
      falhando. **Esse é o estado correto temporariamente.**
4. Desenvolvedor dispara workflow `ui-quality-baseline.yaml` manualmente
   apontando para a branch main.
5. Workflow:
   a. Executa testes visuais com `--update-snapshots`.
   b. Cria branch `baseline-update/<sha>-<timestamp>`.
   c. Comita novas baselines.
   d. Abre PR automático.
6. PR de baseline:
   a. Tem label `visual-baseline`.
   b. Tem descrição automatizada listando cada arquivo alterado.
   c. Exibe `git diff --stat` das imagens.
   d. **Requer revisão humana dedicada** — revisor abre cada imagem e valida
      que a mudança é a esperada.
7. Aprovado e mergeado → baselines atualizadas.

### Cenário 2: Ambiente mudou (browser, OS)

1. Upgrade do Playwright ou imagem Docker → screenshots ficam pixel-off.
2. Abrir PR específico `chore(visual): update baselines for playwright X.Y.Z`.
3. Descrição inclui: nova versão, digest Docker, motivo.
4. Revisão visual humana obrigatória.

### Cenário 3: Baseline nova para componente novo

1. Componente criado em PR de feature.
2. Testes visuais novos criados sem baseline correspondente.
3. CI roda e **falha** porque a baseline não existe.
4. Disparar workflow `ui-quality-baseline.yaml` contra a branch da feature.
5. Workflow gera baselines, abre sub-PR contra a branch da feature.
6. Dev mergeia sub-PR na branch de feature.
7. Feature PR volta a passar.

## Comandos

### Atualização local (NÃO usar em baselines comitadas)

Apenas para debugging. Resultado **não deve** ser comitado.

```bash
npx playwright test --config=playwright.visual.config.ts --update-snapshots
```

### Atualização oficial via Docker (reproduz CI)

```bash
docker run --rm \
  -v $PWD:/app \
  -w /app \
  mcr.microsoft.com/playwright:v1.59.1-jammy@sha256:<digest> \
  sh -c "npm ci && npx playwright test --config=playwright.visual.config.ts --update-snapshots"
```

### Atualização via workflow

```bash
gh workflow run ui-quality-baseline.yaml --ref <branch>
```

## Proibido

- Comitar baselines geradas na máquina local.
- Misturar atualização de baseline com mudanças de código no mesmo PR.
- Atualizar baselines "para passar o teste" sem entender a mudança.
- Aprovar PR de baseline sem abrir cada imagem alterada.
- Atualizar baselines em rebase ou merge — sempre em commit dedicado.
- Usar `--force-overwrite` sem revisão.

## Quem Pode Aprovar

| Tipo de atualização           | Aprovador                          |
| ----------------------------- | ---------------------------------- |
| Componente novo               | Dono do componente + revisor       |
| Mudança de design pequena     | Designer responsável + tech lead   |
| Redesign de página            | Designer + tech lead + produto     |
| Upgrade de ferramenta         | Plataforma + tech lead             |
| Fluxo crítico clínico         | Clinical Safety Office + tech lead |

## Rastreamento de Atualizações

Cada PR de baseline é registrado no scorecard (ver `ui-quality-scorecards.md`):

- Número de baselines atualizadas por semana
- Ratio de "baselines atualizadas" / "PRs que tocam UI"
- Outliers: PRs que atualizam mais de 50 baselines recebem escrutínio extra

Se um PR atualiza muitos baselines de uma vez, é sinal de que:

1. Houve redesign legítimo (aceitável)
2. OU detecção de regressão foi atrasada (problema de processo)
3. OU thresholds de tolerância estão errados (problema de configuração)

## Rollback

Se uma baseline foi atualizada incorretamente e uma regressão passou:

1. Abrir hotfix PR revertendo a baseline específica.
2. Re-rodar visual regression — deve falhar na mudança regressora.
3. Corrigir o código da feature.
4. Atualizar baseline novamente via fluxo padrão.

## Não Fazer

- Não usar `git checkout` de baselines de outra branch sem revisão.
- Não bater `-u` em testes que falham por razões não-visuais.
- Não atualizar baselines de testes flaky sem corrigir o flake primeiro.
- Não atualizar baselines em CI sem intervenção humana explícita.
