# Modelo de Assurance em Camadas - Velya Platform

> Documento de referencia tecnica para o modelo de garantia em camadas da plataforma Velya.
> Classificacao: Interno | Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

A plataforma Velya adota um modelo de assurance em **8 camadas sequenciais e complementares**.
Cada mudanca — seja de codigo, configuracao, infraestrutura ou agente — deve atravessar todas
as camadas antes de atingir producao. Nenhuma camada pode ser ignorada; falha em qualquer
camada bloqueia a progressao automaticamente.

### Principios Fundamentais

| Principio                  | Descricao                                                       |
| -------------------------- | --------------------------------------------------------------- |
| **Zero Trust em Mudancas** | Toda mudanca e potencialmente destrutiva ate prova em contrario |
| **Defesa em Profundidade** | Multiplas camadas compensam falhas individuais                  |
| **Fail-Closed**            | Na duvida, bloqueia. Nunca assume seguranca por padrao          |
| **Rastreabilidade Total**  | Cada decisao de gate e registrada com contexto completo         |
| **Feedback Rapido**        | Falhas devem ser detectadas na camada mais proxima da origem    |

---

## 2. Diagrama de Fluxo entre Camadas

```
                         VELYA LAYERED ASSURANCE MODEL
  ============================================================================

  [DEVELOPER / AGENT]
         |
         v
  +------------------+     FAIL --> Bloqueia merge, notifica autor
  | L1: DESIGN       |     PASS --> Prossegue
  | (Pre-codigo)     |---+
  +------------------+   |
         |                |  Artefatos: ADR, RFC, threat model
         v                |
  +------------------+   |
  | L2: SOURCE       |   |  FAIL --> Bloqueia commit/PR
  | (Codigo-fonte)   |---+
  +------------------+   |
         |                |  Artefatos: lint, SAST, secrets scan
         v                |
  +------------------+   |
  | L3: BUILD        |   |  FAIL --> Bloqueia imagem/artefato
  | (Compilacao)     |---+
  +------------------+   |
         |                |  Artefatos: imagem OCI assinada, SBOM
         v                |
  +------------------+   |
  | L4: ADMISSION    |   |  FAIL --> Rejeita apply no cluster
  | (Cluster gate)   |---+
  +------------------+   |
         |                |  Artefatos: admission log, policy report
         v                |
  +------------------+   |
  | L5: DEPLOYMENT   |   |  FAIL --> Rollback automatico
  | (Entrega prog.)  |---+
  +------------------+   |
         |                |  Artefatos: rollout status, analysis run
         v                |
  +------------------+   |
  | L6: RUNTIME      |   |  FAIL --> Alerta + remediacao
  | (Observabilidade)|---+
  +------------------+   |
         |                |  Artefatos: metricas, traces, logs
         v                |
  +------------------+   |
  | L7: REMEDIATION  |   |  FAIL --> Escala para humano
  | (Auto-correcao)  |---+
  +------------------+   |
         |                |  Artefatos: remediation log, healing event
         v                |
  +------------------+
  | L8: LEARNING     |
  | (Consolidacao)   |
  +------------------+
         |
         v
  [KNOWLEDGE BASE / RUNBOOKS / POLICY UPDATES]

  ============================================================================
```

---

## 3. Detalhamento por Camada

### L1: Design (Pre-codigo)

| Aspecto              | Detalhe                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **O que e validado** | Necessidade do negocio, impacto em servicos existentes, modelo de dados, contratos de API, riscos de seguranca e conformidade LGPD/HIPAA |
| **Ferramentas**      | GitHub Issues, ADR templates, Threat Modeling (STRIDE), RFC no repositorio                                                               |
| **Gates**            | Aprovacao de pelo menos 1 tech lead + 1 domain owner para mudancas high/critical                                                         |
| **Modos de Falha**   | ADR incompleto, sem analise de impacto, sem classificacao de risco                                                                       |
| **Owner**            | Tech Lead do dominio (ex: squad patient-flow, squad discharge)                                                                           |
| **SLA**              | Review de design em ate 24h para mudancas critical, 48h para high                                                                        |

**Servicos Velya e seus dominios de design:**

```yaml
design_domains:
  clinical_flow:
    services:
      - patient-flow
      - discharge-orchestrator
      - task-inbox
    owner: 'squad-clinical'
    review_required: true
    threat_model_required_for:
      - 'mudancas em dados de paciente'
      - 'novos endpoints publicos'
      - 'integracao com sistemas externos (HL7/FHIR)'

  ai_platform:
    services:
      - ai-gateway
      - agent-coordinator
      - prompt-registry
    owner: 'squad-ai'
    review_required: true
    threat_model_required_for:
      - 'novos modelos ou providers'
      - 'mudancas em guardrails de agentes'
      - 'acesso a dados sensiveis por agentes'

  platform_infra:
    services:
      - velya-web
      - api-gateway
      - auth-service
      - notification-hub
    owner: 'squad-platform'
    review_required: true
```

**Template de ADR obrigatorio:**

```markdown
# ADR-XXXX: [Titulo]

## Status: Proposto | Aceito | Rejeitado | Obsoleto

## Contexto

[Por que essa mudanca e necessaria?]

## Decisao

[O que sera feito?]

## Servicos Impactados

[Lista de servicos Velya afetados]

## Classificacao de Risco

- [ ] Low (sem impacto em dados de paciente, rollback trivial)
- [ ] Medium (impacto limitado, rollback possivel)
- [ ] High (impacto em fluxo clinico, rollback complexo)
- [ ] Critical (impacto em seguranca de paciente ou dados sensiveis)

## Analise de Impacto LGPD

[Descrever dados pessoais envolvidos, se aplicavel]

## Alternativas Consideradas

[Pelo menos 2 alternativas]

## Consequencias

[Positivas e negativas]
```

---

### L2: Source (Codigo-fonte)

| Aspecto              | Detalhe                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| **O que e validado** | Qualidade de codigo, vulnerabilidades, secrets expostos, conformidade com padroes, cobertura de testes |
| **Ferramentas**      | ESLint/Biome, Trivy (SAST), Gitleaks, SonarQube, GitHub Actions                                        |
| **Gates**            | CI verde, zero secrets, zero vulnerabilidades critical/high, cobertura >= 80%                          |
| **Modos de Falha**   | Secret em commit, dependencia vulneravel, teste quebrado, lint error                                   |
| **Owner**            | Desenvolvedor autor + reviewer                                                                         |
| **SLA**              | Feedback de CI em ate 10 minutos                                                                       |

**Pipeline de validacao de source (GitHub Actions):**

```yaml
# .github/workflows/source-validation.yml
name: Source Validation (L2)
on:
  pull_request:
    branches: [main, develop]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint com Biome
        run: npx @biomejs/biome check --error-on-warnings .

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Gitleaks scan
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Trivy FS scan
        uses: aquasecurity/trivy-action@master
        with:
          scan-type: 'fs'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'

  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - patient-flow
          - discharge-orchestrator
          - task-inbox
          - ai-gateway
          - velya-web
    steps:
      - uses: actions/checkout@v4
      - name: Run tests for ${{ matrix.service }}
        run: |
          cd services/${{ matrix.service }}
          npm ci
          npm test -- --coverage
      - name: Verificar cobertura >= 80%
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 80" | bc -l) )); then
            echo "FALHA: Cobertura de $COVERAGE% esta abaixo do minimo de 80%"
            exit 1
          fi
```

**Regras de protecao de branch:**

```yaml
branch_protection:
  main:
    required_reviews: 2
    dismiss_stale_reviews: true
    require_code_owner_review: true
    required_status_checks:
      - 'lint'
      - 'secrets-scan'
      - 'sast'
      - 'unit-tests'
    restrict_pushes: true
    allow_force_push: false
    allow_deletion: false

  develop:
    required_reviews: 1
    required_status_checks:
      - 'lint'
      - 'secrets-scan'
      - 'unit-tests'
```

---

### L3: Build (Compilacao e Empacotamento)

| Aspecto              | Detalhe                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| **O que e validado** | Integridade da imagem, vulnerabilidades em camadas, assinatura, SBOM, tamanho                    |
| **Ferramentas**      | Docker/Buildkit, Trivy (image scan), Cosign (assinatura), Syft (SBOM), GitHub Container Registry |
| **Gates**            | Scan limpo (zero critical), imagem assinada, SBOM gerado, tamanho < 500MB                        |
| **Modos de Falha**   | Vulnerabilidade em base image, pacote nao assinado, SBOM ausente                                 |
| **Owner**            | CI/CD pipeline (automatizado)                                                                    |
| **SLA**              | Build completo em ate 15 minutos                                                                 |

```yaml
# .github/workflows/build-and-sign.yml
name: Build, Scan & Sign (L3)
on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_PREFIX: velya-platform

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service:
          - patient-flow
          - discharge-orchestrator
          - task-inbox
          - ai-gateway
          - velya-web
          - notification-hub
          - auth-service
    permissions:
      contents: read
      packages: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Build imagem
        run: |
          docker build \
            --label "org.opencontainers.image.source=https://github.com/velya-platform/${{ matrix.service }}" \
            --label "org.opencontainers.image.revision=${{ github.sha }}" \
            -t ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:${{ github.sha }} \
            -f services/${{ matrix.service }}/Dockerfile \
            services/${{ matrix.service }}

      - name: Trivy image scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: '${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:${{ github.sha }}'
          severity: 'CRITICAL,HIGH'
          exit-code: '1'
          format: 'sarif'
          output: 'trivy-results.sarif'

      - name: Gerar SBOM com Syft
        run: |
          syft ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:${{ github.sha }} \
            -o spdx-json=sbom.spdx.json

      - name: Assinar imagem com Cosign
        run: |
          cosign sign --yes \
            --key env://COSIGN_PRIVATE_KEY \
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:${{ github.sha }}
        env:
          COSIGN_PRIVATE_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}

      - name: Verificar tamanho da imagem
        run: |
          SIZE=$(docker image inspect \
            ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:${{ github.sha }} \
            --format '{{.Size}}')
          MAX_SIZE=$((500 * 1024 * 1024))
          if [ "$SIZE" -gt "$MAX_SIZE" ]; then
            echo "FALHA: Imagem de $(($SIZE / 1024 / 1024))MB excede limite de 500MB"
            exit 1
          fi

      - name: Push para registry
        run: |
          docker push ${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}/${{ matrix.service }}:${{ github.sha }}
```

---

### L4: Admission (Controle de Admissao no Cluster)

| Aspecto              | Detalhe                                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **O que e validado** | Conformidade com politicas de seguranca, labels obrigatorias, limites de recursos, security context, probes, imagem de registry confiavel |
| **Ferramentas**      | ValidatingAdmissionPolicy (K8s nativo), Kyverno (politicas avancadas), OPA/Gatekeeper (alternativa)                                       |
| **Gates**            | Todas as politicas de admission devem passar; rejeicao e sincrona                                                                         |
| **Modos de Falha**   | Pod sem resource limits, imagem de registry nao confiavel, falta de labels, securityContext permissivo                                    |
| **Owner**            | Equipe de plataforma                                                                                                                      |
| **SLA**              | Decisao de admission em < 500ms                                                                                                           |

**Namespaces Velya e suas restricoes:**

```yaml
namespace_policies:
  velya-dev-core:
    description: 'Servicos clinicos criticos'
    services:
      - patient-flow
      - discharge-orchestrator
      - auth-service
    policies:
      - require-resource-limits
      - require-probes
      - require-security-context
      - deny-privileged
      - require-labels
      - restrict-registry
    max_replicas: 10
    priority_class: 'clinical-critical'

  velya-dev-platform:
    description: 'Servicos de infraestrutura e plataforma'
    services:
      - api-gateway
      - notification-hub
      - temporal-server
    policies:
      - require-resource-limits
      - require-probes
      - require-security-context
      - deny-privileged
    max_replicas: 5
    priority_class: 'platform-standard'

  velya-dev-agents:
    description: 'Agentes de IA e coordenacao'
    services:
      - ai-gateway
      - agent-coordinator
      - prompt-registry
    policies:
      - require-resource-limits
      - require-probes
      - require-security-context
      - deny-privileged
      - restrict-egress
      - limit-token-budget
    max_replicas: 8
    priority_class: 'agents-standard'

  velya-dev-web:
    description: 'Frontend e assets estaticos'
    services:
      - velya-web
    policies:
      - require-resource-limits
      - require-probes
      - deny-privileged
    max_replicas: 6
    priority_class: 'web-standard'
```

> Detalhamento completo das politicas: ver `kubernetes-policy-guardrails.md`

---

### L5: Deployment (Entrega Progressiva)

| Aspecto              | Detalhe                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------- |
| **O que e validado** | Saude do deployment durante rollout, metricas de negocio, latencia, taxa de erro, saturacao |
| **Ferramentas**      | Argo Rollouts, Argo CD, Prometheus (analysis), NATS JetStream (event-driven checks)         |
| **Gates**            | Analysis templates com metricas de sucesso; promocao automatica ou manual conforme risco    |
| **Modos de Falha**   | Degradacao de latencia, aumento de erro rate, falha de health check, timeout de analysis    |
| **Owner**            | Pipeline de CD (Argo Rollouts) + on-call para promocao manual                               |
| **SLA**              | Rollout completo em ate 30 minutos (canary) ou 10 minutos (blue-green)                      |

**Estrategias por servico:**

```yaml
deployment_strategies:
  patient-flow:
    strategy: canary
    steps: [10%, 25%, 50%, 100%]
    analysis_interval: 5m
    promotion: automatic
    rollback_threshold:
      error_rate: '> 1%'
      p99_latency: '> 500ms'

  ai-gateway:
    strategy: blue-green
    pre_promotion_analysis: true
    analysis_duration: 5m
    promotion: manual # requer aprovacao para servicos de IA
    rollback_threshold:
      error_rate: '> 0.5%'
      p99_latency: '> 2000ms'

  velya-web:
    strategy: canary
    steps: [10%, 50%, 100%]
    analysis_interval: 3m
    promotion: automatic
    rollback_threshold:
      error_rate: '> 2%'
      lcp: '> 2500ms' # Largest Contentful Paint

  discharge-orchestrator:
    strategy: canary
    steps: [10%, 25%, 50%, 100%]
    analysis_interval: 5m
    promotion: automatic
    rollback_threshold:
      error_rate: '> 0.5%'
      p99_latency: '> 1000ms'
      workflow_failure_rate: '> 2%'
```

> Detalhamento completo: ver `progressive-delivery-strategy.md`

---

### L6: Runtime (Monitoramento em Producao)

| Aspecto              | Detalhe                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **O que e validado** | Saude continua de servicos, SLOs, metricas de negocio, integridade de dados, frescor de heartbeats |
| **Ferramentas**      | Prometheus, Grafana, Loki, Tempo, OpenTelemetry, KEDA, alertmanager                                |
| **Gates**            | SLOs dentro do budget; alertas nao violados; drift GitOps = zero                                   |
| **Modos de Falha**   | SLO breach, alert firing, drift detectado, queue aging, DLQ crescendo                              |
| **Owner**            | Equipe on-call + sistema de observabilidade                                                        |
| **SLA**              | Deteccao de anomalia em < 2 minutos; alerta em < 5 minutos                                         |

**SLOs por servico:**

```yaml
slos:
  patient-flow:
    availability: 99.95%
    p99_latency: 500ms
    error_budget_burn_rate_alert: 10x # alerta se queimar 10x mais rapido
    measurement_window: 30d

  discharge-orchestrator:
    availability: 99.9%
    p99_latency: 1000ms
    workflow_success_rate: 99.5%
    measurement_window: 30d

  ai-gateway:
    availability: 99.9%
    p99_latency: 5000ms # LLM calls sao mais lentos
    fallback_activation_rate: '< 5%'
    measurement_window: 30d

  velya-web:
    availability: 99.95%
    lcp: 2500ms
    fid: 100ms # First Input Delay
    cls: 0.1 # Cumulative Layout Shift
    measurement_window: 30d

  task-inbox:
    availability: 99.9%
    p99_latency: 300ms
    queue_age_max: 5m
    measurement_window: 30d
```

> Detalhamento completo: ver `runtime-integrity-model.md`

---

### L7: Remediation (Auto-correcao)

| Aspecto              | Detalhe                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| **O que e validado** | Eficacia da remediacao, limites de blast radius, reversibilidade, budget de healing                     |
| **Ferramentas**      | Kubernetes controllers, Temporal workflows, scripts de remediacao, Claude Agent SDK                     |
| **Gates**            | Acao reversivel, blast radius conhecido, validacao pos-acao, timeout definido                           |
| **Modos de Falha**   | Healing loop (remediacao causa mais falhas), blast radius desconhecido, acao irreversivel sem aprovacao |
| **Owner**            | Sistema autonomo (tier 1-2) + on-call (tier 3)                                                          |
| **SLA**              | Remediacao automatica em < 5 minutos; escalonamento humano em < 15 minutos                              |

**Categorias de remediacao:**

```yaml
remediation_tiers:
  tier_1_automatic:
    description: 'Acoes seguras, reversiveis, sem impacto em dados'
    actions:
      - pod_restart
      - connection_retry
      - cache_invalidation
      - circuit_breaker_reset
    max_attempts: 3
    cooldown: 60s

  tier_2_supervised:
    description: 'Acoes com impacto limitado, requerem validacao pos-acao'
    actions:
      - horizontal_scale_out
      - failover_to_secondary
      - agent_quarantine
      - fallback_activation
    max_attempts: 2
    cooldown: 300s
    requires_post_validation: true

  tier_3_manual:
    description: 'Acoes com impacto significativo, requerem aprovacao humana'
    actions:
      - database_failover
      - full_service_rollback
      - data_reconciliation
      - agent_permission_revocation
    requires_approval: true
    approval_channel: '#velya-oncall'
```

> Detalhamento completo: ver `auto-remediation-safety-model.md` e `self-healing-model.md`

---

### L8: Learning (Consolidacao de Aprendizado)

| Aspecto              | Detalhe                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| **O que e validado** | Captura de conhecimento, atualizacao de runbooks, melhoria de politicas, prevencao de recorrencia |
| **Ferramentas**      | Post-mortem templates, runbook repository, policy-as-code updates, metricas de recorrencia        |
| **Gates**            | Post-mortem completo em 48h para incidentes P1/P2; action items rastreados                        |
| **Modos de Falha**   | Incidente sem post-mortem, action items nao rastreados, mesma falha recorrente                    |
| **Owner**            | Tech Lead do servico afetado + equipe de plataforma                                               |
| **SLA**              | Post-mortem draft em 24h; review em 48h; action items priorizados em 1 sprint                     |

**Fluxo de aprendizado:**

```yaml
learning_pipeline:
  incident_detected:
    - create_incident_ticket
    - capture_timeline_automatically
    - collect_metrics_snapshot
    - collect_relevant_logs
    - collect_relevant_traces

  post_incident:
    - schedule_post_mortem: 'dentro de 48h'
    - template: 'blameless post-mortem'
    - required_sections:
        - timeline_of_events
        - root_cause_analysis
        - impact_assessment
        - detection_analysis # como foi detectado? rapido o suficiente?
        - remediation_analysis # a remediacao foi eficaz?
        - action_items # com owners e deadlines

  consolidation:
    - update_runbooks: 'se procedimento manual foi necessario'
    - update_policies: 'se admission/validation teria prevenido'
    - update_alerts: 'se deteccao foi lenta'
    - update_slos: 'se SLO era inadequado'
    - update_healing_rules: 'se auto-remediacao poderia ter resolvido'
    - train_anomaly_detection: 'novos padroes de falha'

  recurrence_tracking:
    metric: 'velya_incident_recurrence_total'
    labels: ['service', 'category', 'root_cause']
    alert_if: 'mesmo root_cause em < 30 dias'
```

---

## 4. Matriz de Responsabilidade (RACI)

| Camada         | Desenvolvedor | Tech Lead | Plataforma | On-Call | CI/CD |
| -------------- | :-----------: | :-------: | :--------: | :-----: | :---: |
| L1 Design      |       R       |     A     |     C      |    -    |   -   |
| L2 Source      |       R       |     R     |     C      |    -    |   A   |
| L3 Build       |       I       |     I     |     C      |    -    |  R/A  |
| L4 Admission   |       I       |     C     |    R/A     |    -    |   -   |
| L5 Deployment  |       I       |     C     |    R/A     |    I    |   R   |
| L6 Runtime     |       I       |     C     |     R      |    A    |   -   |
| L7 Remediation |       I       |     I     |     R      |    A    |   R   |
| L8 Learning    |       R       |     A     |     R      |    R    |   -   |

**Legenda:** R = Responsible, A = Accountable, C = Consulted, I = Informed

---

## 5. Metricas do Modelo de Assurance

```yaml
assurance_metrics:
  # Eficacia dos gates
  - name: velya_assurance_gate_pass_rate
    description: 'Taxa de passagem por camada'
    labels: [layer, service]
    type: gauge

  - name: velya_assurance_gate_block_total
    description: 'Total de bloqueios por camada'
    labels: [layer, service, reason]
    type: counter

  # Tempo de feedback
  - name: velya_assurance_feedback_duration_seconds
    description: 'Tempo para feedback em cada camada'
    labels: [layer, service]
    type: histogram
    buckets: [30, 60, 120, 300, 600, 900, 1800]

  # Cobertura
  - name: velya_assurance_coverage_ratio
    description: 'Porcentagem de mudancas que passaram por todas as camadas'
    type: gauge

  # Eficacia de deteccao
  - name: velya_assurance_escape_total
    description: 'Incidentes que nao foram detectados na camada adequada'
    labels: [expected_layer, detected_layer, service]
    type: counter
```

---

## 6. Excecoes e Bypass

Bypass de camadas e **estritamente proibido** em condicoes normais. Em situacoes de emergencia:

```yaml
emergency_bypass:
  conditions:
    - 'Incidente P1 em producao afetando seguranca de paciente'
    - 'Vulnerabilidade de seguranca com exploit ativo'

  requirements:
    - approval_from: 'VP de Engenharia ou CTO'
    - documented_in: 'ticket de incidente'
    - post_bypass:
        - 'Completar todas as validacoes retroativamente em 24h'
        - 'Post-mortem obrigatorio incluindo analise do bypass'
        - 'Atualizar modelo para prevenir necessidade futura de bypass'

  prohibited_even_in_emergency:
    - 'Ignorar scan de secrets (L2)'
    - 'Deploy de imagem nao assinada (L3)'
    - 'Bypass de politica de seguranca de dados de paciente (L4)'
```

---

## 7. Documentos Relacionados

| Documento                           | Descricao                                     |
| ----------------------------------- | --------------------------------------------- |
| `zero-unvalidated-change-policy.md` | Politica de zero mudancas nao validadas       |
| `kubernetes-policy-guardrails.md`   | Politicas de admission detalhadas (L4)        |
| `progressive-delivery-strategy.md`  | Estrategias de deployment (L5)                |
| `runtime-integrity-model.md`        | Modelo de integridade em runtime (L6)         |
| `auto-remediation-safety-model.md`  | Modelo de seguranca para auto-remediacao (L7) |
| `self-healing-model.md`             | Modelo de self-healing (L7)                   |
