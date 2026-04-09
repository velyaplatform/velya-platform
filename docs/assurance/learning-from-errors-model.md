# Modelo de Aprendizado a Partir de Erros - Velya Platform

> Documento 17 da serie Layered Assurance + Self-Healing  
> Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

Todo erro na Velya Platform e uma oportunidade de aprendizado. Este documento define o pipeline estruturado para transformar incidentes em prevencao, garantindo que nenhum erro se repita sem que as defesas tenham sido fortalecidas.

### Pipeline de Aprendizado

```
Incidente detectado
    |
    v
[1. Classificar Erro] -------> Categoria, severidade, dominio
    |
    v
[2. Documentar Causa] -------> Root cause analysis
    |
    v
[3. Avaliar Impacto] --------> Metricas afetadas, usuarios impactados, duracao
    |
    v
[4. Analisar Lacunas] -------> O que faltou (teste, alerta, doc, policy)
    |
    v
[5. Atualizar Playbooks] ----> Runbooks de resposta
    |
    v
[6. Atualizar Policies] -----> OPA/Gatekeeper, deploy gates
    |
    v
[7. Atualizar Testes] -------> Unit, integration, e2e, chaos
    |
    v
[8. Atualizar Alertas] ------> PrometheusRules, LogQL alerts
    |
    v
[9. Atualizar Dashboards] ---> Grafana dashboards
    |
    v
[10. Atualizar Scorecards] --> Metricas de qualidade
    |
    v
[11. Atualizar CronJobs] ----> Watchdogs, auditoria
    |
    v
[12. Atualizar Docs] --------> Catalogo de falhas, docs de arquitetura
    |
    v
[13. Atualizar Agentes] -----> Instrucoes, prompts, skills
    |
    v
[14. Validar Prevencao] -----> Teste do cenario em staging
    |
    v
[APRENDIZADO COMPLETO]
```

---

## 2. Classificacao de Erros

### Taxonomia

```yaml
errorClassification:
  categories:
    - id: DEPLOY
      label: "Erro de Deploy"
      subcategories:
        - "config-error"       # configuracao incorreta
        - "image-error"        # imagem corrompida/ausente
        - "migration-error"    # migration de banco falha
        - "canary-failure"     # canary detecta problema
        - "rollback-failure"   # rollback nao funciona
    - id: INFRA
      label: "Erro de Infraestrutura"
      subcategories:
        - "node-failure"       # node do EKS falha
        - "network-error"      # conectividade entre servicos
        - "storage-error"      # volume cheio/inacessivel
        - "scaling-error"      # KEDA/HPA mal configurado
        - "secret-sync-error"  # External Secrets falha
    - id: APP
      label: "Erro de Aplicacao"
      subcategories:
        - "logic-error"        # bug de logica de negocio
        - "performance-error"  # degradacao de performance
        - "integration-error"  # falha de integracao com dependencia
        - "data-error"         # inconsistencia de dados
        - "concurrency-error"  # race condition, deadlock
    - id: WORKFLOW
      label: "Erro de Workflow"
      subcategories:
        - "timeout-error"      # activity ou workflow timeout
        - "compensation-error" # saga compensation falha
        - "version-error"      # incompatibilidade de versao
        - "dlq-overflow"       # DLQ acumula
    - id: AGENT
      label: "Erro de Agente"
      subcategories:
        - "false-positive"     # agente detecta problema inexistente
        - "false-negative"     # agente nao detecta problema real
        - "wrong-action"       # agente executa acao incorreta
        - "loop-error"         # agente entra em loop
    - id: SECURITY
      label: "Erro de Seguranca"
      subcategories:
        - "auth-failure"       # autenticacao/autorizacao
        - "secret-exposure"    # credenciais expostas
        - "rbac-error"         # permissao inadequada
        - "compliance-error"   # violacao de compliance (LGPD, HIPAA)

  severities:
    - id: P1
      label: "Critico"
      criteria: "Servico indisponivel OU dados em risco OU seguranca comprometida"
      sla_response: "5 min"
      sla_resolution: "4 h"
    - id: P2
      label: "Alto"
      criteria: "Funcionalidade comprometida OU degradacao significativa"
      sla_response: "15 min"
      sla_resolution: "8 h"
    - id: P3
      label: "Medio"
      criteria: "Degradacao menor OU workaround disponivel"
      sla_response: "1 h"
      sla_resolution: "24 h"
    - id: P4
      label: "Baixo"
      criteria: "Impacto minimo OU cosmetic"
      sla_response: "24 h"
      sla_resolution: "1 sprint"
```

---

## 3. Template de Post-Incident Review (PIR)

```yaml
postIncidentReview:
  metadata:
    id: "PIR-YYYY-NNN"
    title: ""
    date: ""
    severity: ""          # P1|P2|P3|P4
    category: ""          # DEPLOY|INFRA|APP|WORKFLOW|AGENT|SECURITY
    subcategory: ""
    duration: ""          # tempo total do incidente
    impactedServices: []
    impactedUsers: ""     # numero estimado
    authors: []           # quem participou do PIR
    reviewers: []         # quem revisou

  timeline:
    - time: ""
      event: "Primeiro sinal do problema"
      source: ""          # alerta, usuario, agente, manual
    - time: ""
      event: "Incidente detectado"
      detectedBy: ""      # alerta|agente|humano|usuario
      detectionDelay: ""  # tempo entre primeiro sinal e deteccao
    - time: ""
      event: "Resposta iniciada"
      responder: ""
    - time: ""
      event: "Causa raiz identificada"
    - time: ""
      event: "Mitigacao aplicada"
      action: ""
    - time: ""
      event: "Servico restaurado"
    - time: ""
      event: "Incidente encerrado"

  rootCause:
    description: ""
    type: ""              # human-error|system-failure|external|design-flaw
    fiveWhys:
      - why: "Por que o servico ficou indisponivel?"
        answer: ""
      - why: "Por que isso aconteceu?"
        answer: ""
      - why: "Por que isso nao foi prevenido?"
        answer: ""
      - why: "Por que o sistema de prevencao falhou?"
        answer: ""
      - why: "Por que essa lacuna existia?"
        answer: ""

  impact:
    availability: ""      # % de downtime
    dataLoss: ""          # sim/nao, descricao
    financialImpact: ""   # estimativa
    userImpact: ""        # numero de usuarios, tipo de impacto
    slaViolation: ""      # quais SLAs foram violados
    complianceImpact: ""  # LGPD, HIPAA implicacoes

  whatWasMissing:
    tests: []             # quais testes teriam prevenido
    alerts: []            # quais alertas teriam detectado mais cedo
    documentation: []     # qual documentacao teria ajudado
    policies: []          # quais policies teriam bloqueado
    monitoring: []        # qual monitoramento teria antecipado
    automation: []        # qual automacao teria respondido mais rapido
    training: []          # qual treinamento teria evitado erro humano

  actionItems:
    - id: "AI-001"
      type: "playbook"    # playbook|test|alert|dashboard|policy|doc|agent|cronjob
      description: ""
      owner: ""
      deadline: ""        # baseado nos SLAs de aprendizado
      status: "todo"      # todo|in-progress|done|validated
      prLink: ""
      validationMethod: ""

  lessonsLearned:
    whatWentWell: []
    whatWentPoorly: []
    whereWeGotLucky: []

  preventionScore:
    beforeIncident: ""    # quantas camadas de prevencao existiam
    afterActions: ""      # quantas camadas existirao apos action items
    improvementDelta: ""  # delta de melhoria
```

---

## 4. SLAs de Aprendizado

### Prazos por Tipo de Action Item

| Tipo de Action | SLA | Responsavel | Validacao |
|---|---|---|---|
| Playbook update | 48 horas | Engenheiro de plantao | Review por SRE lead |
| Alerta novo/atualizado | 48 horas | SRE | Teste em staging |
| Dashboard atualizado | 72 horas | SRE | Screenshot aprovado |
| Teste (unit/integration) | 1 sprint | Engenheiro do servico | CI verde + cobertura |
| Teste (e2e/chaos) | 1 sprint | QA + SRE | Execucao em staging |
| Policy (OPA/gates) | 1 sprint | Platform team | Teste de bloqueio em staging |
| Documentacao | 1 sprint | Autor do PIR | Review por tech lead |
| Instrucoes de agente | 1 sprint | Platform team | Validacao em shadow mode |
| CronJob de watchdog | 2 sprints | SRE | Execucao em producao por 1 semana |
| Mudanca arquitetural | 2 sprints | Tech lead + equipe | Design review + implementacao |

### Monitoramento de SLAs

```promql
# Action items em atraso
velya_pir_action_item_overdue_total > 0

# Tempo medio para fechar action items
avg(velya_pir_action_item_close_time_seconds) by (type)

# PIRs sem action items (indica PIR incompleto)
velya_pir_total - velya_pir_with_actions_total > 0
```

---

## 5. Workflow Temporal para Propagacao de Aprendizado

### Definicao do Workflow

```go
package learning

import (
    "context"
    "time"

    "go.temporal.io/sdk/workflow"
    "go.temporal.io/sdk/activity"
)

// LearningPropagationWorkflow orquestra a propagacao de aprendizado
// apos um Post-Incident Review ser finalizado.
func LearningPropagationWorkflow(ctx workflow.Context, pir PIRInput) error {
    logger := workflow.GetLogger(ctx)
    logger.Info("Iniciando propagacao de aprendizado", "pir_id", pir.ID)

    // Opcoes padrao para activities
    actOpts := workflow.ActivityOptions{
        StartToCloseTimeout: 10 * time.Minute,
        RetryPolicy: &temporal.RetryPolicy{
            InitialInterval:    time.Second,
            BackoffCoefficient: 2.0,
            MaximumInterval:    time.Minute,
            MaximumAttempts:    3,
        },
    }
    ctx = workflow.WithActivityOptions(ctx, actOpts)

    // 1. Classificar e registrar o erro
    var classification ErrorClassification
    err := workflow.ExecuteActivity(ctx, ClassifyError, pir).Get(ctx, &classification)
    if err != nil {
        return err
    }

    // 2. Criar action items baseados na analise de lacunas
    var actionItems []ActionItem
    err = workflow.ExecuteActivity(ctx, CreateActionItems, pir, classification).Get(ctx, &actionItems)
    if err != nil {
        return err
    }

    // 3. Propagar atualizacoes em paralelo (onde possivel)
    propagationCtx := workflow.WithActivityOptions(ctx, workflow.ActivityOptions{
        StartToCloseTimeout: 30 * time.Minute,
        HeartbeatTimeout:    5 * time.Minute,
        RetryPolicy: &temporal.RetryPolicy{
            MaximumAttempts: 2,
        },
    })

    // Grupo de atividades paralelas
    futures := make([]workflow.Future, 0)

    for _, item := range actionItems {
        switch item.Type {
        case "alert":
            f := workflow.ExecuteActivity(propagationCtx, PropagateAlertUpdate, item)
            futures = append(futures, f)
        case "dashboard":
            f := workflow.ExecuteActivity(propagationCtx, PropagateDashboardUpdate, item)
            futures = append(futures, f)
        case "playbook":
            f := workflow.ExecuteActivity(propagationCtx, PropagatePlaybookUpdate, item)
            futures = append(futures, f)
        case "test":
            f := workflow.ExecuteActivity(propagationCtx, PropagateTestCreation, item)
            futures = append(futures, f)
        case "policy":
            f := workflow.ExecuteActivity(propagationCtx, PropagatePolicyUpdate, item)
            futures = append(futures, f)
        case "doc":
            f := workflow.ExecuteActivity(propagationCtx, PropagateDocUpdate, item)
            futures = append(futures, f)
        case "agent":
            f := workflow.ExecuteActivity(propagationCtx, PropagateAgentUpdate, item)
            futures = append(futures, f)
        case "cronjob":
            f := workflow.ExecuteActivity(propagationCtx, PropagateCronJobUpdate, item)
            futures = append(futures, f)
        }
    }

    // Aguardar todas as propagacoes
    var propagationResults []PropagationResult
    for _, f := range futures {
        var result PropagationResult
        if err := f.Get(ctx, &result); err != nil {
            logger.Warn("Falha na propagacao", "error", err)
            // Nao falha o workflow inteiro, registra e continua
            propagationResults = append(propagationResults, PropagationResult{
                Status: "failed",
                Error:  err.Error(),
            })
        } else {
            propagationResults = append(propagationResults, result)
        }
    }

    // 4. Atualizar catalogo de falhas
    err = workflow.ExecuteActivity(ctx, UpdateFailureCatalog, pir, classification).Get(ctx, nil)
    if err != nil {
        logger.Warn("Falha ao atualizar catalogo de falhas", "error", err)
    }

    // 5. Atualizar scorecard de recorrencia
    err = workflow.ExecuteActivity(ctx, UpdateRecurrenceScorecard, pir).Get(ctx, nil)
    if err != nil {
        logger.Warn("Falha ao atualizar scorecard de recorrencia", "error", err)
    }

    // 6. Agendar verificacao de SLA dos action items
    for _, item := range actionItems {
        deadline := item.Deadline
        err = workflow.ExecuteActivity(ctx, ScheduleSLACheck, item, deadline).Get(ctx, nil)
        if err != nil {
            logger.Warn("Falha ao agendar SLA check", "item", item.ID, "error", err)
        }
    }

    // 7. Notificar equipe
    var summary LearningReport
    summary.PIRID = pir.ID
    summary.Classification = classification
    summary.ActionItems = actionItems
    summary.PropagationResults = propagationResults
    err = workflow.ExecuteActivity(ctx, NotifyLearningComplete, summary).Get(ctx, nil)
    if err != nil {
        logger.Warn("Falha ao notificar", "error", err)
    }

    // 8. Agendar validacao de prevencao (em 2 sprints)
    validationDelay := 4 * 7 * 24 * time.Hour // 4 semanas
    err = workflow.NewTimer(ctx, validationDelay).Get(ctx, nil)
    if err != nil {
        return err
    }

    // Verificar se todos os action items foram concluidos
    var validationResult ValidationResult
    err = workflow.ExecuteActivity(ctx, ValidatePreventionComplete, pir.ID, actionItems).
        Get(ctx, &validationResult)
    if err != nil {
        return err
    }

    if !validationResult.AllComplete {
        // Escalar items pendentes
        err = workflow.ExecuteActivity(ctx, EscalateOverdueItems,
            validationResult.PendingItems).Get(ctx, nil)
        if err != nil {
            logger.Warn("Falha ao escalar items pendentes", "error", err)
        }
    }

    logger.Info("Propagacao de aprendizado completa", "pir_id", pir.ID)
    return nil
}
```

### Activities

```go
package learning

import (
    "context"
    "fmt"
)

// ClassifyError classifica o erro baseado no PIR
func ClassifyError(ctx context.Context, pir PIRInput) (ErrorClassification, error) {
    classification := ErrorClassification{
        Category:    pir.Category,
        Subcategory: pir.Subcategory,
        Severity:    pir.Severity,
        RootCauseType: pir.RootCause.Type,
    }

    // Buscar incidentes similares para detectar recorrencia
    similar, err := findSimilarIncidents(ctx, classification)
    if err != nil {
        return classification, fmt.Errorf("erro ao buscar incidentes similares: %w", err)
    }
    classification.IsRecurring = len(similar) > 0
    classification.RecurrenceCount = len(similar)
    classification.PreviousIncidents = similar

    return classification, nil
}

// CreateActionItems cria action items baseados na analise de lacunas
func CreateActionItems(ctx context.Context, pir PIRInput, cls ErrorClassification) ([]ActionItem, error) {
    items := make([]ActionItem, 0)

    // Para cada lacuna identificada, criar action item com SLA
    for _, missing := range pir.WhatWasMissing.Tests {
        items = append(items, ActionItem{
            ID:          generateActionItemID(),
            Type:        "test",
            Description: fmt.Sprintf("Criar teste: %s", missing),
            Owner:       pir.ServiceOwner,
            Deadline:    calculateDeadline("test"),  // 1 sprint
            Status:      "todo",
        })
    }

    for _, missing := range pir.WhatWasMissing.Alerts {
        items = append(items, ActionItem{
            ID:          generateActionItemID(),
            Type:        "alert",
            Description: fmt.Sprintf("Criar/atualizar alerta: %s", missing),
            Owner:       "sre-team",
            Deadline:    calculateDeadline("alert"),  // 48h
            Status:      "todo",
        })
    }

    for _, missing := range pir.WhatWasMissing.Policies {
        items = append(items, ActionItem{
            ID:          generateActionItemID(),
            Type:        "policy",
            Description: fmt.Sprintf("Implementar policy: %s", missing),
            Owner:       "platform-team",
            Deadline:    calculateDeadline("policy"),  // 1 sprint
            Status:      "todo",
        })
    }

    for _, missing := range pir.WhatWasMissing.Documentation {
        items = append(items, ActionItem{
            ID:          generateActionItemID(),
            Type:        "doc",
            Description: fmt.Sprintf("Atualizar documentacao: %s", missing),
            Owner:       pir.Authors[0],
            Deadline:    calculateDeadline("doc"),  // 1 sprint
            Status:      "todo",
        })
    }

    // Sempre atualizar playbook apos incidente P1/P2
    if pir.Severity == "P1" || pir.Severity == "P2" {
        items = append(items, ActionItem{
            ID:          generateActionItemID(),
            Type:        "playbook",
            Description: fmt.Sprintf("Atualizar runbook para %s", pir.Category),
            Owner:       "sre-team",
            Deadline:    calculateDeadline("playbook"),  // 48h
            Status:      "todo",
        })
    }

    // Se recorrente, criar prevencao reforçada
    if cls.IsRecurring {
        items = append(items, ActionItem{
            ID:          generateActionItemID(),
            Type:        "policy",
            Description: fmt.Sprintf("Prevencao reforçada para erro recorrente (%dx): %s",
                cls.RecurrenceCount+1, cls.Subcategory),
            Owner:       "platform-team",
            Deadline:    calculateDeadline("policy"),
            Status:      "todo",
            Priority:    "high",
        })
    }

    return items, nil
}

// PropagateAlertUpdate cria PR com alerta novo/atualizado
func PropagateAlertUpdate(ctx context.Context, item ActionItem) (PropagationResult, error) {
    // Gerar arquivo de PrometheusRule
    alertYAML := generateAlertYAML(item)

    // Criar branch e PR via GitHub API
    prURL, err := createPRWithContent(ctx, CreatePRInput{
        Branch:      fmt.Sprintf("learning/%s-alert", item.ID),
        FilePath:    fmt.Sprintf("k8s/monitoring/alerts/%s.yaml", item.ID),
        Content:     alertYAML,
        Title:       fmt.Sprintf("[Learning] Novo alerta: %s", item.Description),
        Body:        fmt.Sprintf("Action item do PIR. Ref: %s", item.PIRRef),
        Labels:      []string{"learning", "alert", "auto-generated"},
    })
    if err != nil {
        return PropagationResult{Status: "failed", Error: err.Error()}, err
    }

    return PropagationResult{
        Status: "pr-created",
        PRURL:  prURL,
        ItemID: item.ID,
    }, nil
}

// UpdateFailureCatalog adiciona o cenario ao catalogo de falhas
func UpdateFailureCatalog(ctx context.Context, pir PIRInput, cls ErrorClassification) error {
    newScenario := FailureScenario{
        ID:          fmt.Sprintf("%s-%03d", cls.Category, getNextScenarioNumber(cls.Category)),
        Title:       pir.Title,
        Severity:    pir.Severity,
        Category:    cls.Category,
        Trigger:     pir.RootCause.Description,
        Detection:   extractDetectionFromPIR(pir),
        Impact:      pir.Impact.UserImpact,
        Response:    extractResponseFromTimeline(pir.Timeline),
        Prevention:  extractPreventionFromActions(pir.ActionItems),
        TestMethod:  "Reproduzir cenario em staging pos-implementacao de prevencao",
        AddedDate:   time.Now().Format("2006-01-02"),
        AddedBy:     "learning-workflow",
        SourcePIR:   pir.ID,
    }

    return appendToFailureCatalog(ctx, newScenario)
}
```

### Tipos

```go
package learning

import "time"

type PIRInput struct {
    ID              string
    Title           string
    Date            string
    Severity        string
    Category        string
    Subcategory     string
    ServiceOwner    string
    Authors         []string
    Timeline        []TimelineEvent
    RootCause       RootCause
    Impact          Impact
    WhatWasMissing  WhatWasMissing
    ActionItems     []ActionItem
}

type ErrorClassification struct {
    Category          string
    Subcategory       string
    Severity          string
    RootCauseType     string
    IsRecurring       bool
    RecurrenceCount   int
    PreviousIncidents []string
}

type ActionItem struct {
    ID               string
    Type             string // playbook|test|alert|dashboard|policy|doc|agent|cronjob
    Description      string
    Owner            string
    Deadline         time.Time
    Status           string // todo|in-progress|done|validated
    PRLink           string
    ValidationMethod string
    Priority         string
    PIRRef           string
}

type PropagationResult struct {
    Status string
    PRURL  string
    ItemID string
    Error  string
}

type TimelineEvent struct {
    Time  string
    Event string
}

type RootCause struct {
    Description string
    Type        string
}

type Impact struct {
    Availability    string
    DataLoss        string
    UserImpact      string
    SLAViolation    string
}

type WhatWasMissing struct {
    Tests         []string
    Alerts        []string
    Documentation []string
    Policies      []string
    Monitoring    []string
    Automation    []string
}

type LearningReport struct {
    PIRID              string
    Classification     ErrorClassification
    ActionItems        []ActionItem
    PropagationResults []PropagationResult
}

type ValidationResult struct {
    AllComplete  bool
    PendingItems []ActionItem
}

type FailureScenario struct {
    ID         string
    Title      string
    Severity   string
    Category   string
    Trigger    string
    Detection  string
    Impact     string
    Response   string
    Prevention string
    TestMethod string
    AddedDate  string
    AddedBy    string
    SourcePIR  string
}
```

---

## 6. Metricas de Aprendizado

### Dashboard de Aprendizado Organizacional

| Metrica | Formula | Meta |
|---|---|---|
| PIRs concluidos no prazo | pir_completed_on_time / pir_total | >= 95% |
| Action items concluidos no SLA | items_completed_on_time / items_total | >= 90% |
| Tempo medio PIR (deteccao -> aprendizado completo) | avg(pir_completion_time) | < 2 sprints |
| Taxa de recorrencia (mesmo erro em 90 dias) | recurrent_incidents / total_incidents | < 5% |
| Cobertura de testes pos-incidente | incidents_with_new_tests / incidents_total | >= 80% |
| Cobertura de alertas pos-incidente | incidents_with_new_alerts / incidents_total | >= 90% |
| Eficacia de prevencao | prevented_incidents / (prevented + recurrent) | >= 95% |

### PromQL

```promql
# PIRs com action items em atraso
sum(velya_pir_action_items{status="overdue"}) by (pir_id, type)

# Tempo medio de conclusao de action items (por tipo)
avg(velya_pir_action_item_completion_seconds) by (type)

# Taxa de recorrencia (ultimos 90 dias)
sum(increase(velya_incident_recurrence_total[90d]))
/ sum(increase(velya_incident_total[90d]))

# PIRs sem nenhum action item de teste
velya_pir_total
- on() velya_pir_with_test_action_total
```

---

## 7. CronJob de Auditoria de Aprendizado

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: learning-audit
  namespace: velya-ops
spec:
  schedule: "0 9 * * 1"  # toda segunda as 9h
  jobTemplate:
    spec:
      template:
        spec:
          serviceAccountName: learning-auditor
          containers:
            - name: auditor
              image: velya/learning-auditor:latest
              env:
                - name: PROMETHEUS_URL
                  value: "http://prometheus.monitoring:9090"
                - name: GITHUB_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: github-tokens
                      key: learning-bot
                - name: SLACK_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: slack-webhooks
                      key: learning-channel
              command:
                - python3
                - -c
                - |
                  import requests
                  import json
                  import os
                  from datetime import datetime, timedelta

                  PROM = os.environ["PROMETHEUS_URL"]
                  SLACK = os.environ["SLACK_WEBHOOK"]

                  # 1. Verificar action items em atraso
                  r = requests.get(f"{PROM}/api/v1/query", params={
                      "query": 'sum(velya_pir_action_items{status="overdue"}) by (pir_id, type, owner)'
                  })
                  overdue = r.json()["data"]["result"]

                  # 2. Verificar PIRs sem action items
                  r = requests.get(f"{PROM}/api/v1/query", params={
                      "query": 'velya_pir_total - on() velya_pir_with_actions_total'
                  })
                  incomplete = r.json()["data"]["result"]

                  # 3. Verificar taxa de recorrencia
                  r = requests.get(f"{PROM}/api/v1/query", params={
                      "query": 'sum(increase(velya_incident_recurrence_total[90d])) / sum(increase(velya_incident_total[90d]))'
                  })
                  recurrence = r.json()["data"]["result"]

                  # 4. Gerar relatorio
                  report = {
                      "text": f"*Relatorio Semanal de Aprendizado*\n"
                              f"Action items em atraso: {len(overdue)}\n"
                              f"PIRs incompletos: {len(incomplete)}\n"
                              f"Taxa de recorrencia (90d): {recurrence[0]['value'][1] if recurrence else 'N/A'}%\n"
                  }

                  # Detalhar items em atraso
                  if overdue:
                      report["text"] += "\n*Items em atraso:*\n"
                      for item in overdue:
                          labels = item["metric"]
                          report["text"] += f"- PIR {labels.get('pir_id')}: {labels.get('type')} (owner: {labels.get('owner')})\n"

                  requests.post(SLACK, json=report)
          restartPolicy: OnFailure
```

---

## 8. Integracao com Ciclo de Desenvolvimento

### Fluxo Completo

```
Incidente Ocorre
    |
    v
[Resposta (SRE)]
    |
    v
[Mitigacao]
    |
    v
[PIR agendado (< 72h pos-incidente para P1/P2)]
    |
    v
[PIR realizado (blameless)]
    |
    v
[PIR registrado no sistema]
    |
    v
[Workflow Temporal: LearningPropagation inicia]
    |
    +---> [Classificar erro]
    +---> [Criar action items]
    +---> [Propagar alertas (PR)]
    +---> [Propagar testes (PR)]
    +---> [Propagar policies (PR)]
    +---> [Propagar docs (PR)]
    +---> [Atualizar catalogo de falhas]
    +---> [Atualizar scorecard]
    +---> [Notificar equipe]
    |
    v
[Sprint planning: action items priorizados]
    |
    v
[Implementacao (equipe de desenvolvimento)]
    |
    v
[Validacao em staging]
    |
    v
[Deploy de prevencao]
    |
    v
[Workflow Temporal: ValidationCheck (apos 4 semanas)]
    |
    +---> Todos completos? --> APRENDIZADO VALIDADO
    +---> Pendentes? -------> Escalar para tech lead
```

---

## 9. Principios do PIR (Blameless Postmortem)

1. **Sem culpa individual** - O foco e no sistema, nao nas pessoas
2. **Transparencia total** - Timeline completa e publica para a equipe
3. **Foco em prevencao** - Cada PIR deve gerar pelo menos 1 acao de prevencao
4. **SLA de aprendizado** - Action items tem prazo e sao rastreados
5. **Validacao de eficacia** - Prevencao e testada, nao apenas implementada
6. **Recorrencia e inaceitavel** - Erro recorrente indica falha no aprendizado
7. **Automacao de propagacao** - Workflow Temporal garante que nenhuma etapa seja esquecida
8. **Melhoria continua** - O proprio processo de PIR e revisado trimestralmente

---

## 10. Checklist de Completude do PIR

```yaml
pirCompletenessChecklist:
  - id: PIR-CK-01
    check: "Timeline completa (deteccao, resposta, mitigacao, resolucao)"
    required: true
  - id: PIR-CK-02
    check: "Root cause identificada com 5 Whys"
    required: true
  - id: PIR-CK-03
    check: "Impacto quantificado (usuarios, duracao, SLA)"
    required: true
  - id: PIR-CK-04
    check: "Analise de lacunas preenchida (o que faltou)"
    required: true
  - id: PIR-CK-05
    check: "Pelo menos 1 action item de prevencao"
    required: true
  - id: PIR-CK-06
    check: "Todos os action items tem owner e deadline"
    required: true
  - id: PIR-CK-07
    check: "Lessons learned preenchido"
    required: true
  - id: PIR-CK-08
    check: "Revisado por pelo menos 1 pessoa nao envolvida no incidente"
    required: true
  - id: PIR-CK-09
    check: "Workflow de propagacao iniciado"
    required: true
  - id: PIR-CK-10
    check: "Cenario adicionado ao catalogo de falhas"
    required: true
```
