# Politica de Zero Mudancas Nao Validadas - Velya Platform

## Principio Fundamental

**Nenhuma mudanca alcanca qualquer ambiente da Velya Platform sem passar pela cadeia completa de validacao.** "Nao validado" significa qualquer mudanca que pulou, contornou ou nao completou pelo menos um dos 10 passos obrigatorios da cadeia de validacao.

Esta politica se aplica a: codigo, infraestrutura (OpenTofu), configuracao (ConfigMaps, Secrets), politicas (Kyverno, ValidatingAdmissionPolicy), pipelines (GitHub Actions), dashboards (Grafana), e qualquer artefato que influencie o comportamento do sistema em producao.

---

## Definicao de "Mudanca Nao Validada"

Uma mudanca e considerada **nao validada** quando qualquer uma das seguintes condicoes e verdadeira:

| Condicao | Exemplo | Risco |
|---|---|---|
| Aplicada diretamente no cluster sem PR | `kubectl apply -f` manual em producao | Critico |
| PR mergeado sem checks CI verdes | Bypass de branch protection | Critico |
| Imagem sem scan de vulnerabilidades | Push direto para ECR sem pipeline | Alto |
| Imagem nao assinada em uso | Container sem cosign verify | Alto |
| Rollout sem analysis template | Deployment direto sem Argo Rollouts | Alto |
| Secret criado inline (nao via ESO) | `kubectl create secret` manual | Critico |
| ConfigMap alterado sem PR | Edicao direta via kubectl | Alto |
| Infra alterada sem plan/apply cycle | `tofu apply` sem PR review | Critico |
| Dashboard Grafana editado na UI sem export | Mudanca perdida no proximo redeploy | Medio |
| Pipeline CI alterada sem review | Potencial supply chain attack | Critico |

---

## Cadeia Obrigatoria de 10 Passos

### Diagrama da Cadeia

```
+============================================================================+
|              CADEIA DE VALIDACAO - 10 PASSOS OBRIGATORIOS                    |
+============================================================================+

  [1. OBJETIVO]
       |
       | "Qual o proposito desta mudanca?"
       v
  [2. CLASSIFICACAO DE RISCO]
       |
       | "Qual o impacto potencial?"
       v
  [3. VALIDACAO ESTATICA]
       |
       | "O codigo esta correto sintaticamente?"
       v
  [4. VALIDACAO SEMANTICA]
       |
       | "O codigo faz o que deveria?"
       v
  [5. TESTES AUTOMATIZADOS]
       |
       | "Os testes passam?"
       v
  [6. VERIFICACAO DE POLITICAS]
       |
       | "Atende as politicas de seguranca e compliance?"
       v
  [7. ENTREGA PROGRESSIVA]
       |
       | "Deploy gradual com analise de metricas"
       v
  [8. OBSERVACAO POS-MUDANCA]
       |
       | "O sistema esta saudavel apos a mudanca?"
       v
  [9. ACEITAR OU REVERTER]
       |
       | "Promover ou fazer rollback?"
       v
  [10. CONSOLIDACAO DE APRENDIZADO]
       |
       | "O que aprendemos?"
       v
  [MUDANCA CONCLUIDA]
```

---

### Passo 1: Definicao de Objetivo

**Descricao**: Toda mudanca deve ter um objetivo claro, documentado e rastreável.

**Requisitos**:
- Issue ou ticket associado (GitHub Issues)
- Descricao do problema que a mudanca resolve
- Criterios de aceite definidos
- Servicos Velya afetados identificados

**Template de PR**:

```markdown
## Objetivo
<!-- Descreva o que esta mudanca faz e por que e necessaria -->

## Servicos Afetados
- [ ] patient-flow
- [ ] discharge-orchestrator
- [ ] task-inbox
- [ ] ai-gateway
- [ ] velya-web
- [ ] agent-coordinator
- [ ] infraestrutura (OpenTofu)
- [ ] outro: ___

## Issue Relacionada
Closes #___

## Criterios de Aceite
- [ ] ___
- [ ] ___
```

**Gate**: PR sem objetivo documentado e automaticamente marcado como `needs-info` e nao pode ser revisado.

---

### Passo 2: Classificacao de Risco

**Descricao**: Toda mudanca e classificada em um dos 4 niveis de risco, determinando o rigor da validacao nas etapas seguintes.

#### Arvore de Decisao para Classificacao de Risco

```
                        [MUDANCA PROPOSTA]
                              |
                     Afeta dados de pacientes?
                        /              \
                      SIM               NAO
                       |                 |
                   [CRITICO]      Afeta fluxo principal
                                  de operacao hospitalar?
                                    /           \
                                  SIM            NAO
                                   |              |
                               [ALTO]       Afeta mais de
                                            1 servico?
                                             /        \
                                           SIM         NAO
                                            |           |
                                         [MEDIO]   Mudanca e
                                                   apenas visual
                                                   ou docs?
                                                    /       \
                                                  SIM        NAO
                                                   |          |
                                                [BAIXO]    [MEDIO]
```

#### Matriz de Risco Detalhada

| Nivel | Exemplos | Aprovacoes | Rollout | Observacao |
|---|---|---|---|---|
| **BAIXO** | Fix de typo, update de docs, ajuste de label | 1 reviewer | Canary rapido (10->100%) | 5 min |
| **MEDIO** | Nova feature nao-critica, refactoring, ajuste de config | 1 reviewer + CI verde | Canary padrao (10->25->50->100%) | 15 min |
| **ALTO** | Mudanca em servico critico, nova dependencia, schema migration | 2 reviewers + tech lead | Canary lento (5->10->25->50->100%) | 30 min |
| **CRITICO** | Mudanca em patient-flow, dados de pacientes, auth/authz, infra core | 2 reviewers + tech lead + SRE | Blue-green com validacao manual | 60 min + aprovacao manual |

#### Labels de risco no GitHub

```yaml
# .github/labels.yml
- name: risk/low
  color: "0e8a16"
  description: "Risco baixo - mudanca cosmética ou documentacao"
- name: risk/medium
  color: "fbca04"
  description: "Risco medio - feature nao-critica ou refactoring"
- name: risk/high
  color: "e99695"
  description: "Risco alto - servico critico ou nova dependencia"
- name: risk/critical
  color: "b60205"
  description: "Risco critico - dados de pacientes ou infra core"
```

**Gate**: PR sem label de risco nao pode ser mergeado. Bot automatico solicita classificacao.

---

### Passo 3: Validacao Estatica

**Descricao**: Verificacao automatizada da corretude sintatica e aderencia a padroes.

**Verificacoes por tipo de artefato**:

| Tipo | Ferramenta | Regras |
|---|---|---|
| TypeScript | ESLint + tsc | Strict mode, no-any, no-unused-vars |
| Go | golangci-lint | errcheck, gosec, govet, staticcheck |
| Python | Ruff + mypy | Type checking strict, PEP 8 |
| YAML (K8s) | kubeconform + yamllint | Schema validation contra K8s API |
| OpenTofu | `tofu validate` + `tofu fmt` | HCL syntax, format check |
| Dockerfile | hadolint | Best practices, no latest tag |
| OpenAPI | spectral | Velya style guide |
| Protobuf | buf lint | Buf style guide |

**Configuracao de lint unificada**:

```yaml
# .github/workflows/static-validation.yml
name: Static Validation (Step 3)
on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Detect changed files
        id: changes
        uses: dorny/paths-filter@v3
        with:
          filters: |
            typescript:
              - '**/*.ts'
              - '**/*.tsx'
            go:
              - '**/*.go'
            python:
              - '**/*.py'
            kubernetes:
              - 'k8s/**/*.yaml'
              - 'k8s/**/*.yml'
            terraform:
              - 'infra/**/*.tf'
            docker:
              - '**/Dockerfile'

      - name: Lint TypeScript
        if: steps.changes.outputs.typescript == 'true'
        run: |
          npm ci
          npx eslint --max-warnings 0 .
          npx tsc --noEmit

      - name: Lint Go
        if: steps.changes.outputs.go == 'true'
        uses: golangci/golangci-lint-action@v4
        with:
          version: latest
          args: --timeout=5m

      - name: Lint Python
        if: steps.changes.outputs.python == 'true'
        run: |
          pip install ruff mypy
          ruff check .
          mypy --strict .

      - name: Validate Kubernetes manifests
        if: steps.changes.outputs.kubernetes == 'true'
        run: |
          curl -sL https://github.com/yannh/kubeconform/releases/latest/download/kubeconform-linux-amd64.tar.gz | tar xz
          ./kubeconform -strict -summary k8s/

      - name: Validate OpenTofu
        if: steps.changes.outputs.terraform == 'true'
        run: |
          cd infra/
          tofu init -backend=false
          tofu validate
          tofu fmt -check -recursive

      - name: Lint Dockerfiles
        if: steps.changes.outputs.docker == 'true'
        run: |
          find . -name Dockerfile -exec hadolint {} \;
```

**Gate**: Qualquer falha de validacao estatica bloqueia o merge.

---

### Passo 4: Validacao Semantica

**Descricao**: Verificacao de que a mudanca faz o que deveria fazer, alem de estar sintaticamente correta.

**Verificacoes**:

| Verificacao | Ferramenta | Descricao |
|---|---|---|
| Breaking changes em API | buf breaking | Detecta mudancas incompativeis em Protobuf |
| Breaking changes em schema | schema-diff | Compara schemas de banco antes/depois |
| Compatibilidade de contrato | Pact/contract tests | Verifica contratos entre servicos |
| Validacao de migracao | goose dry-run | Executa migration em modo dry-run |
| Validacao de OpenTofu plan | `tofu plan` | Mostra o que sera alterado na infra |
| Validacao de Rollout spec | `kubectl-argo-rollouts lint` | Verifica spec do Rollout |

```yaml
# .github/workflows/semantic-validation.yml
name: Semantic Validation (Step 4)
on: [pull_request]

jobs:
  contract-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check API breaking changes
        run: |
          buf breaking --against '.git#branch=main'

      - name: Validate database migrations
        run: |
          for svc in patient-flow discharge-orchestrator task-inbox; do
            if [ -d "services/$svc/migrations" ]; then
              echo "Validating migrations for $svc..."
              # Dry-run contra banco de test
              goose -dir services/$svc/migrations postgres "$TEST_DB_URL" up --dry-run
            fi
          done

      - name: Validate OpenTofu plan
        if: contains(github.event.pull_request.labels.*.name, 'infra')
        run: |
          cd infra/
          tofu init
          tofu plan -no-color -out=plan.tfplan
          tofu show -no-color plan.tfplan > plan.txt
          # Postar plan como comentario no PR
          gh pr comment ${{ github.event.pull_request.number }} \
            --body "$(cat <<EOF
          ## OpenTofu Plan
          \`\`\`
          $(cat plan.txt)
          \`\`\`
          EOF
          )"
```

**Gate**: Breaking changes detectados requerem aprovacao explicita com label `breaking-change-approved`.

---

### Passo 5: Testes Automatizados

**Descricao**: Execucao completa da suite de testes relevante para a mudanca.

**Niveis de teste**:

| Nivel | Escopo | Tempo | Obrigatorio |
|---|---|---|---|
| Unitario | Funcao/metodo isolado | < 2 min | Sempre |
| Integracao | Servico + dependencias (Testcontainers) | < 5 min | Sempre |
| E2E | Fluxo completo multi-servico | < 15 min | Risco alto/critico |
| Performance | Benchmark de latencia/throughput | < 10 min | Risco alto/critico |
| Caos | Falha de dependencia simulada | < 10 min | Risco critico |

**Cobertura minima por servico**:

| Servico | Cobertura Unitaria | Cobertura Integracao |
|---|---|---|
| patient-flow | 85% | 70% |
| discharge-orchestrator | 80% | 75% |
| task-inbox | 80% | 65% |
| ai-gateway | 75% | 60% |
| velya-web | 70% | 50% |

```yaml
# .github/workflows/automated-tests.yml
name: Automated Tests (Step 5)
on: [pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [patient-flow, discharge-orchestrator, task-inbox, ai-gateway, velya-web]
    steps:
      - uses: actions/checkout@v4
      - name: Run unit tests
        run: |
          cd services/${{ matrix.service }}
          make test-unit
      - name: Check coverage
        run: |
          cd services/${{ matrix.service }}
          make test-coverage
          # Falha se cobertura abaixo do minimo
          COVERAGE=$(cat coverage.txt | grep total | awk '{print $NF}' | tr -d '%')
          MIN_COVERAGE=80
          if [ "$COVERAGE" -lt "$MIN_COVERAGE" ]; then
            echo "Coverage $COVERAGE% is below minimum $MIN_COVERAGE%"
            exit 1
          fi

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: velya_test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
      nats:
        image: nats:2.10-alpine
        ports: ['4222:4222']
    strategy:
      matrix:
        service: [patient-flow, discharge-orchestrator, task-inbox]
    steps:
      - uses: actions/checkout@v4
      - name: Run integration tests
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/velya_test
          NATS_URL: nats://localhost:4222
        run: |
          cd services/${{ matrix.service }}
          make test-integration

  e2e-tests:
    if: contains(github.event.pull_request.labels.*.name, 'risk/high') || contains(github.event.pull_request.labels.*.name, 'risk/critical')
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v4
      - name: Setup kind cluster
        uses: helm/kind-action@v1
      - name: Deploy test environment
        run: make deploy-test-env
      - name: Run E2E tests
        run: make test-e2e
```

**Gate**: Testes falhando bloqueiam o merge. Flaky tests devem ser marcados e resolvidos em 24h.

---

### Passo 6: Verificacao de Politicas

**Descricao**: Validacao de conformidade com politicas de seguranca, compliance e governanca.

**Politicas verificadas**:

| Politica | Ferramenta | Escopo |
|---|---|---|
| Imagem de registry permitido | Kyverno/VAP | Apenas ECR da Velya |
| Security context | Kyverno/VAP | runAsNonRoot, readOnlyRootFilesystem |
| Resource limits | Kyverno/VAP | Limits e requests obrigatorios |
| Labels obrigatorios | Kyverno/VAP | app, version, team, tier |
| Network policies | Kyverno/VAP | Egress restrito para agentes |
| Secrets via ESO | Kyverno/VAP | Proibido secret inline |
| RBAC minimo | Review manual | Principio do menor privilegio |
| LGPD compliance | Checklist | Dados de pacientes protegidos |

```yaml
# Validacao pre-deploy com conftest
# policy/deployment.rego
package main

deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.resources.limits
  msg := sprintf("Container '%s' deve ter resource limits definidos", [container.name])
}

deny[msg] {
  input.kind == "Deployment"
  container := input.spec.template.spec.containers[_]
  not container.securityContext.runAsNonRoot
  msg := sprintf("Container '%s' deve ter runAsNonRoot: true", [container.name])
}

deny[msg] {
  input.kind == "Deployment"
  not input.metadata.labels.app
  msg := "Deployment deve ter label 'app'"
}

deny[msg] {
  input.kind == "Deployment"
  not input.metadata.labels.team
  msg := "Deployment deve ter label 'team'"
}
```

**Gate**: Violacao de politica bloqueia o deploy. Excecoes requerem aprovacao de SRE + justificativa documentada.

---

### Passo 7: Entrega Progressiva

**Descricao**: Deploy gradual com analise automatizada de metricas em cada step.

**Estrategia baseada no risco**:

| Risco | Estrategia | Steps | Analise |
|---|---|---|---|
| Baixo | Canary rapido | 10% -> 100% | 3 min por step |
| Medio | Canary padrao | 10% -> 25% -> 50% -> 100% | 5 min por step |
| Alto | Canary lento | 5% -> 10% -> 25% -> 50% -> 100% | 10 min por step |
| Critico | Blue-green | Full switch com analise pre-switch | 15 min de analise |

**Condicoes de freeze (deploy bloqueado)**:

| Condicao | Duracao | Excecao |
|---|---|---|
| Incidente P1/P2 em andamento | Ate resolucao | Hotfix para o incidente |
| Sexta-feira apos 16h | Ate segunda 9h | Hotfix P1 aprovado por SRE |
| Feriado ou vespera | 24h antes ate 24h depois | Hotfix P1 aprovado por SRE |
| Change freeze programado | Conforme calendario | Nenhuma |
| Mais de 2 rollbacks no dia | Ate dia seguinte | Hotfix P1 aprovado por SRE |

**Gate**: Rollout so avanca se todas as metricas de analise estao dentro do threshold. Rollback automatico se degradar.

---

### Passo 8: Observacao Pos-Mudanca

**Descricao**: Periodo de observacao ativa apos a mudanca ser promovida para 100%.

**Checklist de observacao**:

```yaml
# Checklist pos-deploy automatizado
post_deploy_observation:
  duration_by_risk:
    low: 5m
    medium: 15m
    high: 30m
    critical: 60m

  metrics_to_watch:
    - name: error_rate
      query: "rate(http_requests_total{status=~'5..', service='{{ service }}'}[5m])"
      threshold: "< 0.01"  # menos de 1% de erro

    - name: latency_p99
      query: "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service='{{ service }}'}[5m]))"
      threshold: "< 2.0"  # menos de 2 segundos

    - name: pod_restarts
      query: "increase(kube_pod_container_status_restarts_total{namespace='velya-dev-core', container='{{ service }}'}[10m])"
      threshold: "== 0"  # zero restarts

    - name: nats_consumer_lag
      query: "nats_consumer_num_pending{stream=~'{{ service }}.*'}"
      threshold: "< 1000"  # lag abaixo de 1000 mensagens

    - name: temporal_workflow_failures
      query: "rate(temporal_workflow_failed_total{namespace='velya'}[5m])"
      threshold: "< 0.001"
```

**Gate**: Se qualquer metrica ultrapassar o threshold durante a observacao, alerta e disparado e rollback e considerado.

---

### Passo 9: Aceitar ou Reverter

**Descricao**: Decisao final sobre a mudanca com base na observacao pos-deploy.

#### Arvore de decisao

```
              [PERIODO DE OBSERVACAO CONCLUIDO]
                          |
                 Metricas dentro do threshold?
                    /              \
                  SIM               NAO
                   |                 |
              [ACEITAR]        Degradacao > 50%?
                   |              /         \
                   |            SIM          NAO
                   |             |            |
                   |        [ROLLBACK      [ROLLBACK
                   |         IMEDIATO]      GRADUAL]
                   |             |            |
                   v             v            v
              [REGISTRAR     [REGISTRAR    [REGISTRAR
               SUCESSO]       FALHA]        FALHA]
```

**Processo de rollback**:

```yaml
# Rollback via Argo Rollouts
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: patient-flow
  annotations:
    rollout.argoproj.io/revision-history-limit: "5"
spec:
  # Rollback automatico preserva as 5 ultimas revisoes
  revisionHistoryLimit: 5
  # Rollback pode ser acionado por:
  # 1. AnalysisRun falhando (automatico)
  # 2. kubectl argo rollouts undo (manual)
  # 3. ArgoCD sync para revisao anterior (GitOps)
```

**Gate**: Decisao deve ser tomada antes do timeout do periodo de observacao. Timeout sem decisao = rollback automatico.

---

### Passo 10: Consolidacao de Aprendizado

**Descricao**: Registro do resultado da mudanca e alimentacao do ciclo de melhoria continua.

**Registro obrigatorio**:

```yaml
# Exemplo de registro de mudanca
change_record:
  id: CHG-2026-0408-001
  service: patient-flow
  type: feature
  risk: high
  timestamp: "2026-04-08T14:30:00-03:00"
  result: success  # success | rollback | partial
  duration:
    total: 45m
    rollout: 30m
    observation: 15m
  metrics:
    error_rate_before: 0.002
    error_rate_after: 0.001
    latency_p99_before: 1.2s
    latency_p99_after: 1.1s
  lessons:
    - "Canary step de 10% foi suficiente para detectar regressao de latencia"
    - "Novo threshold de NATS consumer lag precisa ser calibrado"
  actions:
    - type: threshold_update
      description: "Ajustar threshold de NATS lag de 1000 para 500"
      assignee: "@sre-team"
      deadline: "2026-04-15"
```

**Gate**: Mudancas de risco alto/critico sem registro de aprendizado geram alerta para o Engineering Manager.

---

## Acoes Proibidas

As seguintes acoes sao **estritamente proibidas** na Velya Platform:

| Acao Proibida | Justificativa | Consequencia |
|---|---|---|
| `kubectl apply` direto em producao | Contorna todo o pipeline de validacao | Revogacao de acesso + incidente registrado |
| `kubectl delete` sem PR | Pode causar downtime nao planejado | Revogacao de acesso + incidente registrado |
| `kubectl edit` em qualquer ambiente | Drift entre GitOps e estado real | Alerta automatico + revert pelo ArgoCD |
| Merge com checks CI falhando | Bypass de validacao estatica/semantica | Revert automatico do merge |
| Push direto para main/develop | Contorna review de codigo | Branch protection deve impedir |
| Criacao de Secret inline no cluster | Segredos devem vir do External Secrets Operator | Kyverno bloqueia + alerta |
| Deploy fora do horario permitido | Risco de indisponibilidade sem suporte | Pipeline recusa + alerta |
| Uso de `latest` tag em imagens | Nao reproduzivel, nao rastreavel | Admission policy rejeita |
| Alteracao de RBAC sem PR | Escalacao de privilegio nao rastreada | Audit trail + alerta |
| Skip de testes com `[skip ci]` | Contorna validacao automatizada | Proibido em branch protection |

---

## Excecoes Controladas

Excecoes sao permitidas **apenas** nas seguintes condicoes:

1. **Hotfix P1**: Incidente critico em producao afetando pacientes
   - Requer: Aprovacao verbal de SRE Lead + registro posterior
   - Prazo para regularizacao: 24 horas (criar PR retroativo)

2. **Rollback emergencial**: Sistema instavel apos deploy
   - Requer: Evidencia de degradacao em metricas
   - Acao: ArgoCD sync para revisao anterior (GitOps-compliant)

3. **Incident response**: Resposta a incidente de seguranca
   - Requer: Aprovacao de Security Lead
   - Prazo para regularizacao: 48 horas

**Toda excecao deve ser registrada** em `docs/exceptions/` com:
- Data e hora
- Justificativa
- Aprovador
- Acoes tomadas
- Plano de regularizacao

---

## Referencia a CLAUDE.md

Esta politica complementa as regras definidas em `CLAUDE.md`:

- **Nao recriar ou referenciar diretorios removidos intencionalmente**
- **Nao armazenar credenciais ou estado de automacao em repositorios de aplicacao**
- **Usar o bundle Git-tracked para operacao independente de notebook**
- **Respeitar o arquivo `agent-sync-status.json` como visao de coordenacao**

O Claude Agent SDK utilizado na Velya deve seguir esta politica de zero mudancas nao validadas ao executar acoes automatizadas. Agentes Claude **nao podem**:
- Aplicar mudancas diretamente no cluster sem passar pelo pipeline
- Criar PRs que bypassem checks obrigatorios
- Alterar configuracoes de seguranca sem aprovacao humana
- Executar acoes de risco critico sem gate de aprovacao

---

## Metricas de Conformidade

| Metrica | Descricao | Meta | Alerta |
|---|---|---|---|
| Change Validation Rate | % de mudancas que passaram pela cadeia completa | 100% | < 100% |
| Mean Validation Time | Tempo medio da cadeia completa | < 30 min (baixo), < 2h (critico) | > 2x da meta |
| Rollback Rate | % de deploys que resultaram em rollback | < 5% | > 10% |
| Exception Rate | % de mudancas via excecao controlada | < 2% | > 5% |
| Policy Violation Attempts | Tentativas de violacao de politica bloqueadas | Monitorar tendencia | Aumento > 20% |
| Post-change Incidents | Incidentes causados por mudancas recentes | < 1 por semana | > 2 por semana |
