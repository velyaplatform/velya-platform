# Politica de Zero Mudancas Nao Validadas - Velya Platform

> Toda mudanca na plataforma Velya deve ser validada em 10 etapas obrigatorias antes de atingir producao.
> Classificacao: Interno | Ultima atualizacao: 2026-04-08

---

## 1. Definicao de "Mudanca Nao Validada"

Uma mudanca e considerada **nao validada** quando qualquer uma das seguintes condicoes e verdadeira:

| Condicao | Exemplo |
|---|---|
| Sem revisao de codigo | Push direto para main sem PR |
| Sem testes automatizados | Merge com testes falhando ou sem cobertura minima |
| Sem scan de seguranca | Imagem nao escaneada por Trivy |
| Sem assinatura de artefato | Imagem OCI sem assinatura Cosign |
| Sem politica de admission | Manifest aplicado sem passar por ValidatingAdmissionPolicy |
| Sem delivery progressiva | Deploy direto 100% sem canary/blue-green |
| Sem observacao pos-deploy | Sem analysis template ou periodo de observacao |
| Sem classificacao de risco | Mudanca sem risk assessment previo |
| Sem rastreabilidade | Mudanca sem link para ticket/issue/ADR |
| Sem owner identificado | Mudanca sem autor/reviewer rastreavel |

**Principio fundamental:** Se uma mudanca nao pode ser rastreada desde sua origem (ticket) ate
sua validacao final (observacao pos-deploy), ela e nao validada e deve ser bloqueada ou revertida.

---

## 2. Cadeia Obrigatoria de 10 Etapas

### Diagrama de Fluxo

```
  MUDANCA PROPOSTA
       |
       v
  [1. OBJETIVO] --> Qual problema resolve? Tem ticket?
       |
       v
  [2. CLASSIFICACAO DE RISCO] --> Low / Medium / High / Critical
       |
       v
  [3. VALIDACAO ESTATICA] --> Lint, format, type-check
       |
       v
  [4. VALIDACAO SEMANTICA] --> Testes unitarios, integracao, contrato
       |
       v
  [5. TESTES AUTOMATIZADOS] --> Cobertura minima, regressao
       |
       v
  [6. VERIFICACAO DE POLITICAS] --> SAST, secrets, imagem, admission
       |
       v
  [7. ENTREGA PROGRESSIVA] --> Canary / Blue-green com analysis
       |
       v
  [8. OBSERVACAO POS-MUDANCA] --> Metricas, logs, traces por N minutos
       |
       v
  [9. ACEITAR OU ROLLBACK] --> Decisao baseada em dados
       |
       v
  [10. CONSOLIDACAO DE APRENDIZADO] --> Atualizar runbooks, politicas
       |
       v
  MUDANCA VALIDADA E COMPLETA
```

---

### Etapa 1: Objetivo

**Pergunta:** "Por que essa mudanca existe?"

Toda mudanca deve ter:

```yaml
objective_requirements:
  mandatory:
    - ticket_or_issue: "Link para GitHub Issue, Jira ticket ou ADR"
    - description: "Descricao clara do problema que resolve"
    - scope: "Lista de servicos e componentes afetados"
  
  for_high_critical:
    - adr: "Architecture Decision Record aprovado"
    - impact_analysis: "Analise de impacto em servicos dependentes"
    - rollback_plan: "Plano de rollback documentado"
```

**Servicos Velya e seus owners para aprovacao:**

```yaml
service_owners:
  patient-flow:
    team: "squad-clinical"
    approvers: ["@tech-lead-clinical", "@product-clinical"]
  discharge-orchestrator:
    team: "squad-clinical"
    approvers: ["@tech-lead-clinical"]
  task-inbox:
    team: "squad-clinical"
    approvers: ["@tech-lead-clinical"]
  ai-gateway:
    team: "squad-ai"
    approvers: ["@tech-lead-ai", "@ml-lead"]
  agent-coordinator:
    team: "squad-ai"
    approvers: ["@tech-lead-ai"]
  velya-web:
    team: "squad-frontend"
    approvers: ["@tech-lead-frontend"]
  auth-service:
    team: "squad-platform"
    approvers: ["@tech-lead-platform", "@security-lead"]
  notification-hub:
    team: "squad-platform"
    approvers: ["@tech-lead-platform"]
```

---

### Etapa 2: Classificacao de Risco

**Arvore de decisao:**

```
  A mudanca afeta dados de paciente ou seguranca clinica?
  |
  +-- SIM --> CRITICAL
  |
  +-- NAO --> A mudanca afeta autenticacao, autorizacao ou dados sensiveis?
              |
              +-- SIM --> HIGH
              |
              +-- NAO --> A mudanca afeta fluxo clinico ou integracao com sistemas externos?
                          |
                          +-- SIM --> A mudanca e facilmente reversivel?
                          |           |
                          |           +-- SIM --> MEDIUM
                          |           +-- NAO --> HIGH
                          |
                          +-- NAO --> A mudanca afeta apenas UI, documentacao ou config nao critica?
                                      |
                                      +-- SIM --> LOW
                                      +-- NAO --> MEDIUM
```

**Requisitos por nivel de risco:**

| Requisito | Low | Medium | High | Critical |
|---|:---:|:---:|:---:|:---:|
| PR review | 1 reviewer | 1 reviewer | 2 reviewers | 2 reviewers + tech lead |
| Testes unitarios | Obrigatorio | Obrigatorio | Obrigatorio | Obrigatorio |
| Testes de integracao | Opcional | Obrigatorio | Obrigatorio | Obrigatorio |
| Testes E2E | Opcional | Opcional | Obrigatorio | Obrigatorio |
| ADR | Opcional | Opcional | Obrigatorio | Obrigatorio |
| Threat model | Nao | Nao | Recomendado | Obrigatorio |
| Plano de rollback | Implicito | Documentado | Documentado + testado | Documentado + testado + aprovado |
| Delivery progressiva | Canary rapido | Canary padrao | Canary lento | Blue-green com promocao manual |
| Observacao pos-deploy | 5 minutos | 15 minutos | 30 minutos | 60 minutos |
| Freeze check | Nao | Sim | Sim | Sim (bloqueado durante freeze) |

**Exemplos concretos por servico Velya:**

```yaml
risk_examples:
  critical:
    - "Mudanca no schema de dados de patient-flow que afeta registros de paciente"
    - "Alteracao no fluxo de autenticacao de auth-service"
    - "Novo modelo de IA no ai-gateway que toma decisoes clinicas"
    - "Mudanca na logica de discharge-orchestrator que afeta alta de paciente"

  high:
    - "Nova integracao HL7/FHIR no patient-flow"
    - "Mudanca nos guardrails de agentes no agent-coordinator"
    - "Alteracao nas permissoes de RBAC no auth-service"
    - "Mudanca na logica de roteamento do api-gateway"

  medium:
    - "Novo tipo de notificacao no notification-hub"
    - "Adição de campo nao critico em task-inbox"
    - "Mudanca de dependencia com breaking change no velya-web"
    - "Alteracao em workflow do Temporal no discharge-orchestrator"

  low:
    - "Correcao de typo na UI do velya-web"
    - "Atualizacao de dependencia sem breaking change"
    - "Melhoria de log no notification-hub"
    - "Atualizacao de documentacao"
```

---

### Etapa 3: Validacao Estatica

Ferramentas e configuracao por linguagem/servico:

```yaml
static_validation:
  typescript_services:  # patient-flow, discharge-orchestrator, task-inbox, ai-gateway
    tools:
      - name: "Biome"
        config: "biome.json"
        rules: "recommended + velya-custom"
        fail_on: "error"
      - name: "TypeScript Compiler"
        config: "tsconfig.json"
        strict: true
        fail_on: "any type error"
    
  frontend:  # velya-web
    tools:
      - name: "Biome"
        config: "biome.json"
      - name: "TypeScript Compiler"
        strict: true
      - name: "Stylelint"
        config: ".stylelintrc"

  infrastructure:  # OpenTofu/Terraform
    tools:
      - name: "tofu validate"
        fail_on: "any validation error"
      - name: "tofu fmt"
        check: true
      - name: "tflint"
        config: ".tflint.hcl"
      - name: "checkov"
        framework: "terraform"
        fail_on: "HIGH,CRITICAL"

  kubernetes_manifests:
    tools:
      - name: "kubeconform"
        kubernetes_version: "1.29"
        strict: true
      - name: "kustomize build --enable-helm | kubeconform"
      - name: "pluto"  # deprecated API detection
        target_versions: "k8s=v1.30"
```

---

### Etapa 4: Validacao Semantica

```yaml
semantic_validation:
  contract_tests:
    description: "Verificar que contratos de API nao foram quebrados"
    tools:
      - name: "Pact"
        provider_verification: true
        consumer_contracts:
          - "velya-web -> patient-flow"
          - "velya-web -> task-inbox"
          - "discharge-orchestrator -> patient-flow"
          - "agent-coordinator -> ai-gateway"
          - "notification-hub -> patient-flow"
    fail_on: "contract violation"

  schema_validation:
    description: "Verificar compatibilidade de schema de eventos NATS"
    rules:
      - "Novos campos sao sempre opcionais (backward compatible)"
      - "Campos existentes nunca mudam de tipo"
      - "Campos removidos passam por periodo de deprecacao de 2 sprints"
    tool: "schema-registry-validator"

  temporal_workflow_validation:
    description: "Verificar que workflows Temporal sao compativeis"
    rules:
      - "Novas versoes de workflow usam versioning do Temporal"
      - "Workflows em execucao nao sao afetados por deploy"
      - "Signal/query handlers mantem compatibilidade"
```

---

### Etapa 5: Testes Automatizados

```yaml
test_requirements:
  unit_tests:
    coverage_minimum: 80%
    coverage_for_critical_paths: 95%
    critical_paths:
      patient-flow:
        - "src/domain/patient/*.ts"
        - "src/domain/admission/*.ts"
      discharge-orchestrator:
        - "src/workflows/*.ts"
        - "src/activities/*.ts"
      ai-gateway:
        - "src/guardrails/*.ts"
        - "src/routing/*.ts"

  integration_tests:
    required_for: [medium, high, critical]
    scope:
      - "Database queries com dados reais (test containers)"
      - "NATS JetStream publish/subscribe"
      - "Temporal workflow execution"
      - "External API calls (mocked)"

  e2e_tests:
    required_for: [high, critical]
    scope:
      - "Fluxo de admissao de paciente completo"
      - "Fluxo de alta completo (discharge)"
      - "Login + navegacao + acoes criticas no velya-web"
    tools:
      - "Playwright (frontend)"
      - "Custom test harness (backend workflows)"
```

---

### Etapa 6: Verificacao de Politicas

```yaml
policy_checks:
  security:
    - tool: "Gitleaks"
      scope: "diff do PR"
      fail_on: "qualquer secret detectado"
    - tool: "Trivy"
      scope: "imagem OCI"
      fail_on: "CRITICAL ou HIGH"
    - tool: "Cosign verify"
      scope: "imagem antes de deploy"
      fail_on: "assinatura invalida ou ausente"

  compliance:
    - check: "Dados de paciente criptografados em repouso e transito"
      applies_to: [patient-flow, discharge-orchestrator]
    - check: "Logs nao contem PII sem mascaramento"
      applies_to: "todos os servicos"
    - check: "Consent tracking para uso de dados por IA"
      applies_to: [ai-gateway, agent-coordinator]

  kubernetes_admission:
    - tool: "ValidatingAdmissionPolicy"
      scope: "todos os namespaces velya-dev-*"
      policies:
        - require-resource-limits
        - require-probes
        - require-labels
        - deny-privileged
        - restrict-registry
```

---

### Etapa 7: Entrega Progressiva

```yaml
progressive_delivery:
  canary:
    applies_to: [patient-flow, discharge-orchestrator, task-inbox, velya-web]
    steps:
      low_risk: [20%, 50%, 100%]
      medium_risk: [10%, 25%, 50%, 100%]
      high_risk: [5%, 10%, 25%, 50%, 75%, 100%]
    analysis_per_step:
      - metric: "error_rate"
        query: 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])'
        threshold: "< 0.01"
      - metric: "p99_latency"
        query: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))'
        threshold: "< SLO do servico"

  blue_green:
    applies_to: [ai-gateway, auth-service]
    pre_promotion_analysis:
      duration: 5m
      metrics:
        - error_rate
        - latency_p99
        - custom_health_check
    promotion: manual_for_critical
```

---

### Etapa 8: Observacao Pos-Mudanca

```yaml
post_change_observation:
  dashboards:
    - name: "Velya Service Health"
      url: "https://grafana.velya.internal/d/service-health"
      panels:
        - request_rate
        - error_rate
        - latency_percentiles
        - pod_restarts
        - memory_usage
        - cpu_usage

  automated_checks:
    - name: "Error rate comparison"
      query: |
        (
          rate(http_requests_total{status=~"5..", service="$SERVICE"}[5m])
          /
          rate(http_requests_total{service="$SERVICE"}[5m])
        )
        >
        1.5 * (
          rate(http_requests_total{status=~"5..", service="$SERVICE"}[5m] offset 1h)
          /
          rate(http_requests_total{service="$SERVICE"}[5m] offset 1h)
        )
      action: "Se error rate e 1.5x maior que 1h atras, sinalizar para review"

    - name: "Latency regression"
      query: |
        histogram_quantile(0.99,
          rate(http_request_duration_seconds_bucket{service="$SERVICE"}[5m])
        )
        >
        1.3 * histogram_quantile(0.99,
          rate(http_request_duration_seconds_bucket{service="$SERVICE"}[5m] offset 1h)
        )
      action: "Se p99 e 1.3x maior que 1h atras, sinalizar para review"

  observation_periods:
    low: "5 minutos"
    medium: "15 minutos"
    high: "30 minutos"
    critical: "60 minutos"
```

---

### Etapa 9: Aceitar ou Rollback

```yaml
accept_or_rollback:
  decision_criteria:
    accept_when:
      - "Todas as metricas dentro dos thresholds durante periodo de observacao"
      - "Zero alertas novos disparados"
      - "Nenhum aumento anomalo em logs de erro"
      - "Health checks de todas as dependencias passando"

    rollback_when:
      - "Error rate excede threshold por mais de 2 minutos"
      - "Latencia p99 excede SLO por mais de 3 minutos"
      - "Qualquer health check de dependencia falhando"
      - "Pod restart loop detectado (> 3 restarts em 5 minutos)"
      - "Alerta de SLO budget burn rate disparado"

  rollback_procedure:
    automatic:
      trigger: "Argo Rollouts analysis failure"
      action: "Rollback para revisao anterior"
      notification: "Slack #velya-deployments"
    
    manual:
      trigger: "On-call identifica problema nao coberto por analysis"
      action: |
        kubectl argo rollouts undo <rollout-name> -n <namespace>
      notification: "Slack #velya-oncall + ticket de incidente"
```

---

### Etapa 10: Consolidacao de Aprendizado

```yaml
learning_consolidation:
  on_success:
    - "Registrar metricas de deployment (duracao, steps, metricas)"
    - "Atualizar baseline de metricas se deployment melhorou performance"
    - "Marcar ticket/issue como deployed"

  on_rollback:
    - "Criar ticket de investigacao com link para metricas"
    - "Capturar snapshot de metricas, logs e traces do periodo"
    - "Agendar review do rollback em ate 24h"
    - "Atualizar analysis templates se threshold era inadequado"
    - "Documentar root cause e prevencao"

  on_incident:
    - "Seguir processo de post-mortem (ver L8 em layered-assurance-model.md)"
    - "Atualizar runbooks com novos procedimentos"
    - "Adicionar testes para cenario nao coberto"
    - "Atualizar politicas de admission se aplicavel"
```

---

## 3. Lista de Acoes Proibidas

As seguintes acoes sao **explicitamente proibidas** e devem ser bloqueadas por controles tecnicos:

```yaml
prohibited_actions:
  source_control:
    - action: "Push direto para branch main ou develop"
      enforcement: "Branch protection rules"
      exception: "Nenhuma"

    - action: "Merge de PR com CI falhando"
      enforcement: "Required status checks"
      exception: "Nenhuma"

    - action: "Merge sem review aprovado"
      enforcement: "Required reviews"
      exception: "Hotfix P1 com aprovacao de VP"

    - action: "Commit de secrets, tokens ou credenciais"
      enforcement: "Gitleaks pre-commit hook + CI scan"
      exception: "Nenhuma - use External Secrets Operator"

    - action: "Remocao de testes existentes sem justificativa"
      enforcement: "PR review + coverage check"
      exception: "Refactoring com cobertura mantida"

  deployment:
    - action: "Deploy manual via kubectl apply em producao"
      enforcement: "RBAC + ArgoCD como unico meio de deploy"
      exception: "Emergencia P1 com log e post-mortem"

    - action: "Deploy sem delivery progressiva"
      enforcement: "Argo Rollouts obrigatorio"
      exception: "CronJobs e Jobs one-shot"

    - action: "Alterar resources de producao sem PR"
      enforcement: "GitOps (ArgoCD sync)"
      exception: "Nenhuma"

    - action: "Deploy durante janela de freeze"
      enforcement: "ArgoCD sync window"
      exception: "Hotfix P1 com aprovacao"

  infrastructure:
    - action: "Mudanca manual em recursos AWS sem OpenTofu"
      enforcement: "AWS SCPs + drift detection"
      exception: "Nenhuma"

    - action: "Criar secrets diretamente no cluster"
      enforcement: "External Secrets Operator como unica fonte"
      exception: "Nenhuma"

    - action: "Alterar NetworkPolicy manualmente"
      enforcement: "GitOps + admission policy"
      exception: "Nenhuma"

  agents:
    - action: "Deploy de agente sem guardrails configurados"
      enforcement: "Admission policy para namespace velya-dev-agents"
      exception: "Nenhuma"

    - action: "Agente com acesso a dados de paciente sem consent tracking"
      enforcement: "ai-gateway policy check"
      exception: "Nenhuma"

    - action: "Agente com permissao de escrita em producao sem aprovacao"
      enforcement: "agent-coordinator RBAC"
      exception: "Nenhuma"
```

---

## 4. Referencia ao CLAUDE.md

As regras do CLAUDE.md se integram a esta politica:

```yaml
claude_md_integration:
  rules:
    - "Claude Agent SDK opera sob as mesmas restricoes de validacao"
    - "Agentes Claude nao podem fazer push direto; devem criar PRs"
    - "Agentes Claude nao podem aprovar seus proprios PRs"
    - "Mudancas geradas por agentes passam pela mesma cadeia de 10 etapas"
    - "Agentes devem incluir 'Co-Authored-By' em commits"
    - "Agentes nao criam documentacao nao solicitada"
    - "Agentes respeitam coordination state em agent-sync-status.json"
    - "Agentes nao armazenam credenciais em repositorios"
```

---

## 5. Metricas de Conformidade

```yaml
compliance_metrics:
  - name: velya_validated_change_ratio
    description: "Proporcao de mudancas que passaram por todas as 10 etapas"
    target: "100%"
    alert_if: "< 100%"
    type: gauge

  - name: velya_unvalidated_change_detected_total
    description: "Numero de mudancas nao validadas detectadas"
    target: "0"
    alert_if: "> 0"
    type: counter
    labels: [service, stage_skipped, detected_by]

  - name: velya_validation_chain_duration_seconds
    description: "Tempo total da cadeia de validacao"
    type: histogram
    buckets: [300, 600, 900, 1800, 3600, 7200]

  - name: velya_risk_classification_distribution
    description: "Distribuicao de mudancas por nivel de risco"
    type: gauge
    labels: [risk_level, service]
```

---

## 6. Auditoria e Evidencias

Toda passagem por uma etapa gera um registro de evidencia:

```yaml
audit_trail:
  storage: "S3 bucket velya-audit-trail (retencao 7 anos)"
  format: "JSON structured log"
  
  evidence_record:
    fields:
      - change_id: "SHA do commit ou ID do PR"
      - timestamp: "ISO 8601"
      - stage: "1-10"
      - stage_name: "nome da etapa"
      - result: "pass | fail | skip_approved"
      - evidence_type: "CI result | scan report | approval | metric snapshot"
      - evidence_url: "link para artefato"
      - actor: "usuario ou sistema"
      - service: "servico Velya afetado"
      - risk_level: "low | medium | high | critical"
      - duration_seconds: "tempo gasto na etapa"

  example:
    change_id: "abc123def"
    timestamp: "2026-04-08T14:30:00Z"
    stage: 6
    stage_name: "policy_checks"
    result: "pass"
    evidence_type: "trivy_scan_report"
    evidence_url: "s3://velya-audit-trail/2026/04/08/abc123def/trivy-report.json"
    actor: "github-actions[bot]"
    service: "patient-flow"
    risk_level: "high"
    duration_seconds: 45
```
