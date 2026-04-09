# Criterios de Entrega Assertiva - Velya Platform

> Documento 14 da serie Layered Assurance + Self-Healing  
> Ultima atualizacao: 2026-04-08

---

## 1. Definicao Operacional de "Assertivo"

No contexto da Velya Platform, **entrega assertiva** significa:

| Principio                       | Definicao Operacional                                                      | Evidencia Exigida                                                   |
| ------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Resultados consistentes         | O mesmo deploy em condicoes equivalentes produz o mesmo resultado          | Historico de deploys com taxa de sucesso >= 99% no ultimo trimestre |
| Acoes baseadas em evidencia     | Nenhuma acao de promocao, rollback ou correcao sem dados que a justifiquem | Link para query Prometheus/Loki que motivou a decisao               |
| Criterios de promocao claros    | Gates definidos antes do deploy, nao inventados durante                    | Spec do Rollout com `analysis` preenchido                           |
| Classificacao antes de correcao | Erros sao categorizados antes de qualquer remediation                      | Label `error-class/*` no issue tracker antes do fix                 |
| Rollback quando necessario      | Reverter e seguro, rapido e sem perda de dados                             | Rollback testado em staging na ultima sprint                        |
| Rastreabilidade total           | Todo artefato conectado a commit, PR, pipeline, deploy, metricas           | Chain: commit SHA -> image tag -> rollout revision -> dashboard     |
| Sem passos invisiveis           | Nenhuma acao manual fora do GitOps flow                                    | Audit log do ArgoCD sem `sync --force` manual                       |
| Erros viram prevencao           | Todo incidente gera pelo menos 1 teste ou 1 alerta novo                    | Issue de follow-up linkado ao postmortem                            |

---

## 2. Tipos de Entrega e Criterios

### 2.1 Application Deploy

**Escopo:** Deploy de servicos da Velya (API Gateway, Patient Service, Scheduling, Billing, etc.)

#### Criterios de Aceitacao

```yaml
# velya-platform/policies/deploy-acceptance.yaml
apiVersion: velya.io/v1alpha1
kind: DeliveryPolicy
metadata:
  name: application-deploy-acceptance
spec:
  deliveryType: application-deploy
  preConditions:
    - name: image-scan-passed
      check: 'trivy scan sem vulnerabilidades CRITICAL'
      blocking: true
    - name: unit-tests-passed
      check: 'cobertura >= 80% e 0 falhas'
      blocking: true
    - name: integration-tests-passed
      check: 'suite de integracao com 0 falhas'
      blocking: true
    - name: staging-validation
      check: 'deploy em staging por >= 30min sem alertas'
      blocking: true
    - name: rollout-strategy-defined
      check: 'AnalysisTemplate referenciado no Rollout'
      blocking: true
  promotionGates:
    canary:
      - weight: 10
        duration: 5m
        metrics:
          - name: error-rate
            query: |
              sum(rate(http_requests_total{status=~"5..",app="{{ .args.service }}"}[2m]))
              /
              sum(rate(http_requests_total{app="{{ .args.service }}"}[2m]))
            threshold: '< 0.01'
          - name: p99-latency
            query: |
              histogram_quantile(0.99,
                sum(rate(http_request_duration_seconds_bucket{app="{{ .args.service }}"}[2m])) by (le)
              )
            threshold: '< 2.0'
      - weight: 30
        duration: 10m
        metrics:
          - name: error-rate
            threshold: '< 0.005'
          - name: p99-latency
            threshold: '< 1.5'
      - weight: 70
        duration: 15m
        metrics:
          - name: error-rate
            threshold: '< 0.005'
          - name: saturation
            query: |
              avg(container_memory_working_set_bytes{pod=~"{{ .args.service }}.*"})
              /
              avg(kube_pod_container_resource_limits{resource="memory",pod=~"{{ .args.service }}.*"})
            threshold: '< 0.85'
  observationPeriod:
    active: 30m
    passive: 4h
  successMetrics:
    - 'zero alertas P1/P2 no periodo de observacao'
    - 'metricas de negocio (agendamentos, consultas) sem degradacao > 5%'
    - 'nenhum rollback automatico disparado'
```

#### Evidencia Minima

| Fase          | Evidencia                               | Formato                      | Retencao |
| ------------- | --------------------------------------- | ---------------------------- | -------- |
| Pre-deploy    | Scan de imagem, testes, aprovacao PR    | CI artifacts + GitHub checks | 90 dias  |
| During-deploy | Metricas do canary, logs de analise     | Prometheus + ArgoCD events   | 30 dias  |
| Post-deploy   | Dashboard snapshot, ausencia de alertas | Grafana snapshot URL         | 90 dias  |

---

### 2.2 Infrastructure Change

**Escopo:** Mudancas em EKS, networking, storage, KEDA scalers, HPA/VPA configs, External Secrets, NATS JetStream.

#### Criterios de Aceitacao

```yaml
apiVersion: velya.io/v1alpha1
kind: DeliveryPolicy
metadata:
  name: infra-change-acceptance
spec:
  deliveryType: infrastructure-change
  preConditions:
    - name: tofu-plan-reviewed
      check: 'OpenTofu plan aprovado por >= 2 engenheiros'
      blocking: true
    - name: blast-radius-assessed
      check: 'documento de blast radius preenchido'
      blocking: true
    - name: rollback-plan-documented
      check: 'procedimento de rollback testado em sandbox'
      blocking: true
    - name: change-window-approved
      check: 'janela de mudanca aprovada (fora de horario de pico)'
      blocking: true
    - name: backup-verified
      check: 'snapshot/backup do estado anterior confirmado'
      blocking: true
  promotionGates:
    apply:
      - stage: plan-review
        check: 'diff do plan sem surpresas (sem destroys inesperados)'
      - stage: apply-sandbox
        check: 'apply em sandbox/staging sem erros'
        duration: 15m
      - stage: apply-production
        check: 'apply em producao com monitoramento ativo'
  observationPeriod:
    active: 1h
    passive: 24h
  successMetrics:
    - 'zero pods em CrashLoopBackOff'
    - 'zero PVCs em Pending'
    - 'kube-state-metrics sem anomalias'
    - 'latencia de rede sem degradacao > 10%'
    - 'NATS JetStream consumers sem lag crescente'
```

#### Blast Radius Assessment Template

```yaml
# Template para avaliar blast radius de mudancas infra
blastRadiusAssessment:
  changeDescription: 'Atualizar KEDA scaler do patient-service'
  affectedComponents:
    direct:
      - 'patient-service HPA'
      - 'patient-service pods'
    indirect:
      - 'scheduling-service (depende de patient-service)'
      - 'billing-service (consulta patient-service)'
  worstCase: 'patient-service escala para 0 replicas durante horario de pico'
  mitigations:
    - 'minReplicaCount >= 2 sempre'
    - 'PDB configurado com minAvailable: 1'
  rollbackProcedure: 'Reverter commit no Git, ArgoCD sync automatico'
  estimatedRollbackTime: '< 3 minutos'
```

---

### 2.3 Agent Promotion

**Escopo:** Promocao de agentes autonomos (Claude Agent SDK) para novos niveis de permissao ou novos dominios operacionais.

#### Criterios de Aceitacao

```yaml
apiVersion: velya.io/v1alpha1
kind: DeliveryPolicy
metadata:
  name: agent-promotion-acceptance
spec:
  deliveryType: agent-promotion
  preConditions:
    - name: shadow-period-complete
      check: 'agente operou em modo shadow por >= 7 dias'
      blocking: true
    - name: accuracy-threshold
      check: 'taxa de acerto em decisoes >= 95% vs baseline humano'
      blocking: true
    - name: false-positive-rate
      check: 'taxa de falsos positivos < 3%'
      blocking: true
    - name: blast-radius-limited
      check: 'permissoes de escrita limitadas ao dominio aprovado'
      blocking: true
    - name: kill-switch-tested
      check: 'kill-switch testado e funcional'
      blocking: true
    - name: peer-review
      check: 'revisao por >= 2 engenheiros do dominio'
      blocking: true
  promotionGates:
    levels:
      - level: observer
        description: 'Le metricas e logs, gera relatorios'
        requirements: ['shadow 3 dias', '0 falsos positivos criticos']
      - level: advisor
        description: 'Sugere acoes, humano executa'
        requirements: ['observer por 7 dias', 'acuracia >= 90%']
      - level: executor-low
        description: 'Executa acoes de baixo risco autonomamente'
        requirements: ['advisor por 14 dias', 'acuracia >= 95%']
      - level: executor-medium
        description: 'Executa acoes de medio risco com aprovacao automatica'
        requirements: ['executor-low por 30 dias', 'acuracia >= 98%']
  observationPeriod:
    active: 2h # apos cada acao do agente
    passive: 7d # monitoramento continuo do agente
  successMetrics:
    - 'zero acoes destrutivas nao autorizadas'
    - 'tempo medio de resposta a incidentes reduzido em >= 20%'
    - 'taxa de escalacao para humanos estavel ou decrescente'
    - 'nenhum alerta de seguranca gerado pelo agente'
```

#### Matriz de Permissoes por Nivel

| Capacidade                         | Observer | Advisor | Executor-Low | Executor-Medium |
| ---------------------------------- | -------- | ------- | ------------ | --------------- |
| Ler metricas/logs                  | Sim      | Sim     | Sim          | Sim             |
| Gerar relatorios                   | Sim      | Sim     | Sim          | Sim             |
| Sugerir acoes                      | Nao      | Sim     | Sim          | Sim             |
| Restart pods (non-critical)        | Nao      | Nao     | Sim          | Sim             |
| Scale replicas (dentro de limites) | Nao      | Nao     | Sim          | Sim             |
| Abrir PRs de correcao              | Nao      | Nao     | Sim          | Sim             |
| Rollback canary deploy             | Nao      | Nao     | Nao          | Sim             |
| Modificar KEDA scalers             | Nao      | Nao     | Nao          | Sim             |
| Alterar network policies           | Nao      | Nao     | Nao          | Nao             |
| Modificar secrets/credentials      | Nao      | Nao     | Nao          | Nao             |

---

### 2.4 Workflow Update (Temporal)

**Escopo:** Mudancas em workflows Temporal (patient intake, scheduling, billing, lab results).

#### Criterios de Aceitacao

```yaml
apiVersion: velya.io/v1alpha1
kind: DeliveryPolicy
metadata:
  name: workflow-update-acceptance
spec:
  deliveryType: workflow-update
  preConditions:
    - name: versioning-strategy
      check: 'nova versao do workflow registrada (nao sobrescreve a anterior)'
      blocking: true
    - name: replay-test-passed
      check: 'replay de historico existente com nova versao sem erros'
      blocking: true
    - name: backward-compatible
      check: 'workflows em execucao nao sao afetados'
      blocking: true
    - name: compensation-tested
      check: 'saga compensation testada para cada novo step'
      blocking: true
    - name: timeout-configured
      check: 'timeouts definidos para cada activity (start-to-close, schedule-to-start)'
      blocking: true
  promotionGates:
    stages:
      - stage: unit-test
        check: 'testes unitarios de workflow com mock de activities'
      - stage: integration-test
        check: 'teste com Temporal test server'
      - stage: staging-deploy
        check: 'deploy em staging com execucao de workflows de teste'
        duration: 30m
      - stage: production-canary
        check: '10% do trafego na nova versao do workflow'
        duration: 1h
      - stage: production-full
        check: '100% do trafego na nova versao'
  observationPeriod:
    active: 1h
    passive: 24h
  successMetrics:
    - 'zero workflows stuck (> 2x do SLA esperado)'
    - 'zero compensation failures'
    - 'latencia de workflow sem degradacao > 15%'
    - 'DLQ do workflow vazia'
    - 'taxa de retry < baseline + 10%'
```

#### Checklist de Compatibilidade Temporal

```markdown
- [ ] Nova versao registrada com `workflow.GetVersion()`
- [ ] Workflow existente em execucao pode completar na versao anterior
- [ ] Novos signals/queries sao opcionais (nao quebram versao anterior)
- [ ] Activities novas tem retry policy definida
- [ ] Activities novas tem timeout definido
- [ ] Saga compensation implementada para activities com side effects
- [ ] Search attributes atualizados para queries operacionais
- [ ] Metricas custom emitidas via OpenTelemetry
```

---

### 2.5 Configuration Change

**Escopo:** Mudancas em ConfigMaps, ExternalSecrets, feature flags, environment variables.

#### Criterios de Aceitacao

```yaml
apiVersion: velya.io/v1alpha1
kind: DeliveryPolicy
metadata:
  name: config-change-acceptance
spec:
  deliveryType: config-change
  preConditions:
    - name: schema-validated
      check: 'configuracao validada contra JSON Schema'
      blocking: true
    - name: diff-reviewed
      check: 'diff de configuracao revisado por owner do servico'
      blocking: true
    - name: secret-rotation-safe
      check: 'se secret, rotacao nao quebra conexoes ativas'
      blocking: true
    - name: restart-strategy-defined
      check: 'definido se requer restart (rolling) ou hot-reload'
      blocking: true
  promotionGates:
    stages:
      - stage: staging-apply
        check: 'aplicado em staging, servico healthy'
        duration: 10m
      - stage: production-apply
        check: 'aplicado em producao, pods reiniciam sem erro'
  observationPeriod:
    active: 15m
    passive: 2h
  successMetrics:
    - 'zero pods em CrashLoopBackOff apos apply'
    - 'zero erros de parsing de configuracao nos logs'
    - 'servico responde ao healthcheck em < 30s apos restart'
    - 'conexoes com dependencias restabelecidas (DB, NATS, Redis)'
```

---

## 3. Checklists de Entrega

### 3.1 Checklist Pre-Deploy

```yaml
# Template: copiar e preencher para cada deploy
preDeployChecklist:
  metadata:
    service: '' # nome do servico
    version: '' # tag da imagem
    deployer: '' # quem esta fazendo o deploy
    date: '' # data/hora
    changeType: '' # app-deploy | infra | agent | workflow | config
    ticketRef: '' # referencia ao ticket/PR

  items:
    codeQuality:
      - id: PRE-001
        check: 'PR aprovado por >= 1 reviewer'
        status: pending # pending | passed | failed | na
        evidence: ''
      - id: PRE-002
        check: 'CI pipeline verde (build, test, lint, scan)'
        status: pending
        evidence: ''
      - id: PRE-003
        check: 'Cobertura de testes >= 80%'
        status: pending
        evidence: ''
      - id: PRE-004
        check: 'Nenhuma vulnerabilidade CRITICAL no scan'
        status: pending
        evidence: ''

    deployReadiness:
      - id: PRE-010
        check: 'Rollout strategy definida (canary weights e metricas)'
        status: pending
        evidence: ''
      - id: PRE-011
        check: 'AnalysisTemplate configurado com queries Prometheus'
        status: pending
        evidence: ''
      - id: PRE-012
        check: 'Rollback automatico configurado'
        status: pending
        evidence: ''
      - id: PRE-013
        check: 'PodDisruptionBudget configurado'
        status: pending
        evidence: ''
      - id: PRE-014
        check: 'Resource requests/limits definidos'
        status: pending
        evidence: ''

    observability:
      - id: PRE-020
        check: 'Metricas custom emitidas via OpenTelemetry'
        status: pending
        evidence: ''
      - id: PRE-021
        check: 'Dashboard Grafana atualizado para nova versao'
        status: pending
        evidence: ''
      - id: PRE-022
        check: 'Alertas configurados para SLOs do servico'
        status: pending
        evidence: ''
      - id: PRE-023
        check: 'Tracing configurado com propagacao de contexto'
        status: pending
        evidence: ''

    operacional:
      - id: PRE-030
        check: 'Runbook atualizado para o servico'
        status: pending
        evidence: ''
      - id: PRE-031
        check: 'Janela de deploy aprovada (nao e sexta pos 14h)'
        status: pending
        evidence: ''
      - id: PRE-032
        check: 'Equipe de plantao ciente do deploy'
        status: pending
        evidence: ''
      - id: PRE-033
        check: 'Canal de comunicacao definido para incidentes'
        status: pending
        evidence: ''
```

### 3.2 Checklist During-Deploy

```yaml
duringDeployChecklist:
  items:
    canaryPhase:
      - id: DUR-001
        check: 'Canary 10%: error rate < 1% por 5 min'
        status: pending
        evidence: ''
      - id: DUR-002
        check: 'Canary 10%: p99 latencia < 2s'
        status: pending
        evidence: ''
      - id: DUR-003
        check: 'Canary 30%: error rate < 0.5% por 10 min'
        status: pending
        evidence: ''
      - id: DUR-004
        check: 'Canary 30%: saturacao de memoria < 85%'
        status: pending
        evidence: ''
      - id: DUR-005
        check: 'Canary 70%: todas as metricas estaveis por 15 min'
        status: pending
        evidence: ''

    systemHealth:
      - id: DUR-010
        check: 'Nenhum pod em CrashLoopBackOff'
        status: pending
        evidence: ''
      - id: DUR-011
        check: 'ArgoCD sync status: Synced + Healthy'
        status: pending
        evidence: ''
      - id: DUR-012
        check: 'NATS JetStream consumers sem lag crescente'
        status: pending
        evidence: ''
      - id: DUR-013
        check: 'Temporal workflows completando dentro do SLA'
        status: pending
        evidence: ''

    rollbackReadiness:
      - id: DUR-020
        check: 'Rollback automatico ativo e monitorado'
        status: pending
        evidence: ''
      - id: DUR-021
        check: 'Versao anterior da imagem disponivel no registry'
        status: pending
        evidence: ''
      - id: DUR-022
        check: 'Database migration reversivel (se aplicavel)'
        status: pending
        evidence: ''
```

### 3.3 Checklist Post-Deploy

```yaml
postDeployChecklist:
  items:
    observacaoAtiva: # primeiros 30 minutos
      - id: POS-001
        check: 'Error rate estavel e < SLO (99.9%)'
        status: pending
        evidence: ''
        query: |
          sum(rate(http_requests_total{status=~"5..",app="SERVICE"}[5m]))
          / sum(rate(http_requests_total{app="SERVICE"}[5m]))
      - id: POS-002
        check: 'Latencia p99 estavel e < SLO'
        status: pending
        evidence: ''
        query: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{app="SERVICE"}[5m])) by (le))
      - id: POS-003
        check: 'Saturacao de recursos < 80%'
        status: pending
        evidence: ''
      - id: POS-004
        check: 'Zero alertas disparados'
        status: pending
        evidence: ''
      - id: POS-005
        check: 'Logs sem erros inesperados'
        status: pending
        evidence: ''
        query: |
          {app="SERVICE"} |= "error" |= "panic" |= "fatal" | count_over_time([5m])

    observacaoPassiva: # 4 horas seguintes
      - id: POS-010
        check: 'Metricas de negocio sem degradacao > 5%'
        status: pending
        evidence: ''
      - id: POS-011
        check: 'Nenhum rollback automatico disparado'
        status: pending
        evidence: ''
      - id: POS-012
        check: 'Usuarios nao reportaram problemas'
        status: pending
        evidence: ''

    documentacao:
      - id: POS-020
        check: 'Deploy registrado no changelog'
        status: pending
        evidence: ''
      - id: POS-021
        check: 'Grafana snapshot salvo'
        status: pending
        evidence: ''
      - id: POS-022
        check: 'Post-deploy report gerado'
        status: pending
        evidence: ''
```

---

## 4. Arvore de Decisao de Promocao

```
Deploy iniciado
    |
    v
[Canary 10% - 5min]
    |
    +-- error_rate > 1%? ---------> ROLLBACK AUTOMATICO
    |                                   |
    +-- p99_latency > 2s? -------->     +-> Gerar incidente
    |                                   +-> Notificar equipe
    +-- OK                              +-> Coletar evidencia
    |
    v
[Canary 30% - 10min]
    |
    +-- error_rate > 0.5%? -------> ROLLBACK AUTOMATICO
    |
    +-- memory_saturation > 85%? -> PAUSE + INVESTIGAR
    |                                   |
    |                                   +-- resolve em 10min? -> continuar
    |                                   +-- nao resolve? -----> ROLLBACK
    +-- OK
    |
    v
[Canary 70% - 15min]
    |
    +-- qualquer metrica fora do SLO? -> ROLLBACK
    |
    +-- OK
    |
    v
[Promocao 100%]
    |
    v
[Observacao Ativa - 30min]
    |
    +-- alerta disparado? ---------> INVESTIGAR
    |                                   |
    |                                   +-- impacto > P2? -> ROLLBACK
    |                                   +-- impacto <= P3? -> MONITORAR
    +-- OK
    |
    v
[Observacao Passiva - 4h]
    |
    +-- degradacao detectada? -----> INVESTIGAR
    |
    +-- OK
    |
    v
[DEPLOY COMPLETO - Gerar evidencia final]
```

---

## 5. Metricas de Sucesso Agregadas

### Dashboard de Assertividade (Scorecard Mensal)

| Metrica                                 | Meta    | Formula                                  |
| --------------------------------------- | ------- | ---------------------------------------- |
| Taxa de deploy sem rollback             | >= 95%  | deploys_success / deploys_total          |
| Tempo medio de deploy (canary completo) | < 45min | avg(deploy_duration_seconds)             |
| Cobertura de evidencia                  | 100%    | deploys_com_evidencia / deploys_total    |
| Incidentes pos-deploy                   | < 2/mes | count(incidents where trigger=deploy)    |
| Tempo medio de deteccao pos-deploy      | < 5min  | avg(time_to_detect where trigger=deploy) |
| Rollbacks bem sucedidos                 | 100%    | rollbacks_success / rollbacks_total      |
| PRs com checklist completo              | >= 90%  | prs_checklist_complete / prs_total       |

### PromQL para Scorecard

```promql
# Taxa de deploys sem rollback (ultimos 30 dias)
1 - (
  sum(increase(argocd_app_rollback_total[30d]))
  /
  sum(increase(argocd_app_sync_total{phase="Succeeded"}[30d]))
)

# Tempo medio de deploy canary
avg(
  argocd_app_sync_duration_seconds{phase="Succeeded"}
) by (application)

# Incidentes disparados por deploy
count(
  ALERTS{alertstate="firing", trigger="deployment"}
) by (alertname)
```

---

## 6. Integracao com ArgoCD e Argo Rollouts

### AnalysisTemplate Padrao Velya

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: velya-assertive-analysis
  namespace: velya
spec:
  args:
    - name: service-name
    - name: canary-hash
  metrics:
    - name: error-rate
      interval: 60s
      successCondition: result[0] < 0.01
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{status=~"5..",
              app="{{args.service-name}}",
              rollouts_pod_template_hash="{{args.canary-hash}}"}[2m]))
            /
            sum(rate(http_requests_total{
              app="{{args.service-name}}",
              rollouts_pod_template_hash="{{args.canary-hash}}"}[2m]))
    - name: p99-latency
      interval: 60s
      successCondition: result[0] < 2.0
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                app="{{args.service-name}}",
                rollouts_pod_template_hash="{{args.canary-hash}}"}[2m]))
              by (le))
    - name: memory-saturation
      interval: 120s
      successCondition: result[0] < 0.85
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            avg(container_memory_working_set_bytes{
              pod=~"{{args.service-name}}.*",
              container!="istio-proxy"})
            /
            avg(kube_pod_container_resource_limits{
              resource="memory",
              pod=~"{{args.service-name}}.*"})
    - name: nats-consumer-lag
      interval: 120s
      successCondition: result[0] < 1000
      failureLimit: 3
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            max(nats_jetstream_consumer_num_pending{
              stream=~".*{{args.service-name}}.*"})
```

### Rollout Padrao Velya

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: patient-service
  namespace: velya
spec:
  replicas: 3
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: patient-service
  strategy:
    canary:
      canaryService: patient-service-canary
      stableService: patient-service-stable
      analysis:
        templates:
          - templateName: velya-assertive-analysis
        args:
          - name: service-name
            value: patient-service
          - name: canary-hash
            valueFrom:
              podTemplateHashValue: Latest
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - setWeight: 30
        - pause: { duration: 10m }
        - setWeight: 70
        - pause: { duration: 15m }
      maxSurge: 1
      maxUnavailable: 0
      abortScaleDownDelaySeconds: 30
```

---

## 7. Automacao de Validacao de Criterios

### CronJob de Auditoria de Assertividade

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: assertive-delivery-audit
  namespace: velya-ops
spec:
  schedule: '0 8 * * 1' # toda segunda as 8h
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: delivery-auditor
          containers:
            - name: auditor
              image: velya/delivery-auditor:latest
              env:
                - name: PROMETHEUS_URL
                  value: 'http://prometheus.monitoring:9090'
                - name: ARGOCD_URL
                  value: 'https://argocd.velya.internal'
                - name: GRAFANA_URL
                  value: 'http://grafana.monitoring:3000'
                - name: SLACK_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: slack-webhooks
                      key: delivery-channel
              command:
                - /bin/sh
                - -c
                - |
                  # Verificar deploys da ultima semana
                  python3 /scripts/audit_deliveries.py \
                    --period=7d \
                    --check-evidence \
                    --check-observation-windows \
                    --check-rollback-readiness \
                    --output=slack \
                    --output=grafana-annotation
          restartPolicy: OnFailure
```

---

## 8. Glossario

| Termo              | Definicao                                                |
| ------------------ | -------------------------------------------------------- |
| Observacao Ativa   | Periodo onde engenheiro monitora dashboards ativamente   |
| Observacao Passiva | Periodo onde alertas automaticos cobrem a observacao     |
| Gate de Promocao   | Criterio que deve ser atendido para avancar o canary     |
| Evidencia          | Dados verificaveis que comprovam o estado de um criterio |
| Blast Radius       | Conjunto de componentes afetados por uma mudanca         |
| Scorecard          | Relatorio agregado de metricas de assertividade          |
| Kill-switch        | Mecanismo de desativacao imediata de um agente/feature   |
