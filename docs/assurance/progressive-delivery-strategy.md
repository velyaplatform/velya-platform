# Estrategia de Entrega Progressiva - Velya Platform

> Definicao das estrategias de Argo Rollouts para todos os servicos da plataforma Velya.
> Classificacao: Interno | Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

A plataforma Velya utiliza **Argo Rollouts** para entrega progressiva de todos os servicos.
Nenhum deploy vai direto para 100% do trafego. Cada servico tem uma estrategia definida
com base em seu perfil de risco e tipo de carga.

### Arvore de Decisao: Canary vs Blue-Green

```
  O servico processa dados de paciente em tempo real?
  |
  +-- SIM --> O servico tem estado local (cache, sessao)?
  |           |
  |           +-- SIM --> BLUE-GREEN (troca atomica, sem estado misto)
  |           |           Exemplos: auth-service
  |           |
  |           +-- NAO --> CANARY com steps conservadores
  |                       Exemplos: patient-flow, discharge-orchestrator
  |
  +-- NAO --> O servico e um gateway ou roteador de IA?
              |
              +-- SIM --> BLUE-GREEN com analysis pre-promocao
              |           Exemplos: ai-gateway, api-gateway
              |
              +-- NAO --> O servico e frontend?
                          |
                          +-- SIM --> CANARY com metricas de frontend
                          |           Exemplos: velya-web
                          |
                          +-- NAO --> CANARY padrao
                                      Exemplos: task-inbox, notification-hub
```

---

## 2. Condicoes de Freeze (Nao Fazer Deploy)

```yaml
freeze_conditions:
  automatic_freeze:
    - condition: 'Incidente P1 ou P2 ativo'
      check: |
        # Verificar via PagerDuty API ou flag no ConfigMap
        kubectl get configmap velya-deploy-control -n velya-dev-platform \
          -o jsonpath='{.data.incident_active}'
      block_message: 'Deploy bloqueado: incidente ativo'

    - condition: 'Horario de pico clinico'
      schedule:
        timezone: 'America/Sao_Paulo'
        blocked_hours:
          - start: '07:00'
            end: '09:00'
            reason: 'Pico de admissao matinal'
          - start: '13:00'
            end: '14:00'
            reason: 'Troca de plantao'
          - start: '19:00'
            end: '20:00'
            reason: 'Troca de plantao noturno'
      exceptions: 'Hotfix P1 com aprovacao'

    - condition: 'SLO budget abaixo de 20%'
      check: |
        # Se ja queimou mais de 80% do error budget do mes
        slo_remaining=$(curl -s prometheus:9090/api/v1/query \
          --data-urlencode 'query=velya_slo_budget_remaining_ratio{service="$SERVICE"}' \
          | jq '.data.result[0].value[1]' -r)
        [ "$(echo "$slo_remaining < 0.20" | bc)" -eq 1 ]
      block_message: 'Deploy bloqueado: error budget abaixo de 20%'

    - condition: 'Mais de 2 rollbacks nas ultimas 24h para o mesmo servico'
      check: |
        rollbacks=$(kubectl get analysisruns -n $NAMESPACE \
          -l rollout-name=$SERVICE \
          --sort-by=.metadata.creationTimestamp \
          -o jsonpath='{.items[*].status.phase}' | tr ' ' '\n' | grep -c Failed)
        [ "$rollbacks" -gt 2 ]
      block_message: 'Deploy bloqueado: excesso de rollbacks recentes'

  manual_freeze:
    how_to_activate: |
      kubectl patch configmap velya-deploy-control -n velya-dev-platform \
        --type merge -p '{"data":{"freeze":"true","freeze_reason":"Motivo","freeze_until":"2026-04-09T08:00:00Z"}}'

    argocd_sync_window:
      kind: deny
      schedule: '* * * * *' # ativado dinamicamente
      duration: '24h'
      namespaces:
        - 'velya-dev-*'
```

---

## 3. Estrategia Canary: patient-flow

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: patient-flow
  namespace: velya-dev-core
  labels:
    app.kubernetes.io/name: patient-flow
    app.kubernetes.io/component: api
    app.kubernetes.io/managed-by: argocd
    velya.io/team: squad-clinical
    velya.io/risk-level: critical
  annotations:
    velya.io/owner: 'squad-clinical@velya.health'
    velya.io/oncall-channel: '#velya-oncall-clinical'
    velya.io/runbook-url: 'https://runbooks.velya.internal/patient-flow'
spec:
  replicas: 3
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app.kubernetes.io/name: patient-flow
  template:
    metadata:
      labels:
        app.kubernetes.io/name: patient-flow
        app.kubernetes.io/version: '{{ .Values.image.tag }}'
        velya.io/team: squad-clinical
    spec:
      securityContext:
        runAsNonRoot: true
        fsGroup: 1000
      containers:
        - name: patient-flow
          image: ghcr.io/velya-platform/patient-flow:{{ .Values.image.tag }}
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 9090
              name: metrics
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            initialDelaySeconds: 10
            periodSeconds: 15
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/startup
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 30
          env:
            - name: OTEL_SERVICE_NAME
              value: patient-flow
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: 'http://otel-collector.velya-dev-observability:4317'
          envFrom:
            - secretRef:
                name: patient-flow-secrets
  strategy:
    canary:
      canaryService: patient-flow-canary
      stableService: patient-flow-stable
      trafficRouting:
        nginx:
          stableIngress: patient-flow-ingress
          additionalIngressAnnotations:
            canary-by-header: X-Canary
            canary-by-header-value: 'true'
      steps:
        # Step 1: 10% do trafego
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
            args:
              - name: service-name
                value: patient-flow
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest

        # Step 2: 25% do trafego
        - setWeight: 25
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis

        # Step 3: 50% do trafego
        - setWeight: 50
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
              - templateName: patient-flow-business-analysis

        # Step 4: 100% do trafego
        - setWeight: 100
        - pause: { duration: 10m }
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
              - templateName: patient-flow-business-analysis

      # Rollback automatico se analysis falhar
      abortScaleDownDelaySeconds: 30
      dynamicStableScale: true
      scaleDownDelaySeconds: 30
      scaleDownDelayRevisionLimit: 2
```

### AnalysisTemplate para patient-flow

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: patient-flow-canary-analysis
  namespace: velya-dev-core
spec:
  args:
    - name: service-name
    - name: canary-hash
  metrics:
    # Metrica 1: Taxa de erro HTTP
    - name: error-rate
      interval: 60s
      count: 5
      successCondition: result[0] < 0.01
      failureCondition: result[0] >= 0.05
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(http_requests_total{
              service="{{ args.service-name }}",
              pod_template_hash="{{ args.canary-hash }}",
              status=~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="{{ args.service-name }}",
              pod_template_hash="{{ args.canary-hash }}"
            }[2m]))

    # Metrica 2: Latencia P99
    - name: latency-p99
      interval: 60s
      count: 5
      successCondition: result[0] < 0.5
      failureCondition: result[0] >= 1.0
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                service="{{ args.service-name }}",
                pod_template_hash="{{ args.canary-hash }}"
              }[2m])) by (le)
            )

    # Metrica 3: Saturacao (CPU)
    - name: cpu-saturation
      interval: 60s
      count: 5
      successCondition: result[0] < 0.80
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            avg(
              rate(container_cpu_usage_seconds_total{
                namespace="velya-dev-core",
                pod=~"patient-flow-.*{{ args.canary-hash }}.*"
              }[2m])
              /
              kube_pod_container_resource_limits{
                namespace="velya-dev-core",
                pod=~"patient-flow-.*{{ args.canary-hash }}.*",
                resource="cpu"
              }
            )

    # Metrica 4: Pod restarts
    - name: pod-restarts
      interval: 60s
      count: 5
      successCondition: result[0] == 0
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(increase(kube_pod_container_status_restarts_total{
              namespace="velya-dev-core",
              pod=~"patient-flow-.*{{ args.canary-hash }}.*"
            }[5m]))

    # Metrica 5: Memory usage
    - name: memory-usage
      interval: 60s
      count: 5
      successCondition: result[0] < 0.85
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            avg(
              container_memory_working_set_bytes{
                namespace="velya-dev-core",
                pod=~"patient-flow-.*{{ args.canary-hash }}.*"
              }
              /
              kube_pod_container_resource_limits{
                namespace="velya-dev-core",
                pod=~"patient-flow-.*{{ args.canary-hash }}.*",
                resource="memory"
              }
            )
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: patient-flow-business-analysis
  namespace: velya-dev-core
spec:
  metrics:
    # Metrica de negocio: taxa de sucesso de admissao de paciente
    - name: admission-success-rate
      interval: 120s
      count: 3
      successCondition: result[0] > 0.98
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(velya_patient_admission_total{status="success"}[5m]))
            /
            sum(rate(velya_patient_admission_total[5m]))

    # Metrica de negocio: tempo medio de admissao
    - name: admission-duration
      interval: 120s
      count: 3
      successCondition: result[0] < 120
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.95,
              sum(rate(velya_patient_admission_duration_seconds_bucket[5m])) by (le)
            )
```

---

## 4. Estrategia Blue-Green: ai-gateway

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: ai-gateway
  namespace: velya-dev-agents
  labels:
    app.kubernetes.io/name: ai-gateway
    app.kubernetes.io/component: gateway
    app.kubernetes.io/managed-by: argocd
    velya.io/team: squad-ai
    velya.io/risk-level: high
  annotations:
    velya.io/owner: 'squad-ai@velya.health'
    velya.io/oncall-channel: '#velya-oncall-ai'
    velya.io/runbook-url: 'https://runbooks.velya.internal/ai-gateway'
spec:
  replicas: 3
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: ai-gateway
  template:
    metadata:
      labels:
        app.kubernetes.io/name: ai-gateway
    spec:
      containers:
        - name: ai-gateway
          image: ghcr.io/velya-platform/ai-gateway:{{ .Values.image.tag }}
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 9090
              name: metrics
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 2000m
              memory: 2Gi
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
          livenessProbe:
            httpGet:
              path: /health/live
              port: http
            periodSeconds: 15
          readinessProbe:
            httpGet:
              path: /health/ready
              port: http
            periodSeconds: 10
          startupProbe:
            httpGet:
              path: /health/startup
              port: http
            periodSeconds: 5
            failureThreshold: 30
  strategy:
    blueGreen:
      activeService: ai-gateway-active
      previewService: ai-gateway-preview
      autoPromotionEnabled: false # promocao MANUAL para servicos de IA
      scaleDownDelaySeconds: 60
      prePromotionAnalysis:
        templates:
          - templateName: ai-gateway-pre-promotion
        args:
          - name: service-name
            value: ai-gateway
      postPromotionAnalysis:
        templates:
          - templateName: ai-gateway-post-promotion
        args:
          - name: service-name
            value: ai-gateway
      antiAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          weight: 100
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: ai-gateway-pre-promotion
  namespace: velya-dev-agents
spec:
  args:
    - name: service-name
  metrics:
    # Verificar que o preview responde corretamente
    - name: preview-health
      interval: 30s
      count: 10
      successCondition: result[0] == 1
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            up{job="{{ args.service-name }}-preview"}

    # Verificar latencia do preview
    - name: preview-latency
      interval: 60s
      count: 5
      successCondition: result[0] < 2.0
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                service="{{ args.service-name }}",
                kubernetes_pod_name=~".*preview.*"
              }[2m])) by (le)
            )

    # Verificar que guardrails estao ativos
    - name: guardrails-active
      interval: 60s
      count: 3
      successCondition: result[0] > 0
      failureLimit: 0 # guardrails DEVEM estar ativos
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            velya_ai_guardrails_active{service="{{ args.service-name }}"}

    # Verificar taxa de erro zero no preview
    - name: preview-error-rate
      interval: 60s
      count: 5
      successCondition: result[0] < 0.005
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(http_requests_total{
              service="{{ args.service-name }}",
              kubernetes_pod_name=~".*preview.*",
              status=~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="{{ args.service-name }}",
              kubernetes_pod_name=~".*preview.*"
            }[2m]))
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: ai-gateway-post-promotion
  namespace: velya-dev-agents
spec:
  args:
    - name: service-name
  metrics:
    - name: post-promotion-error-rate
      interval: 60s
      count: 10
      successCondition: result[0] < 0.005
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(http_requests_total{
              service="{{ args.service-name }}",
              status=~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="{{ args.service-name }}"
            }[2m]))

    - name: post-promotion-token-usage
      interval: 120s
      count: 5
      successCondition: result[0] < 1000000
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(velya_ai_tokens_used_total{
              service="{{ args.service-name }}"
            }[5m])) * 300
```

---

## 5. Estrategia Canary: velya-web (Frontend)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: velya-web
  namespace: velya-dev-web
  labels:
    app.kubernetes.io/name: velya-web
    app.kubernetes.io/component: web
    app.kubernetes.io/managed-by: argocd
    velya.io/team: squad-frontend
    velya.io/risk-level: medium
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: velya-web
  template:
    metadata:
      labels:
        app.kubernetes.io/name: velya-web
    spec:
      containers:
        - name: velya-web
          image: ghcr.io/velya-platform/velya-web:{{ .Values.image.tag }}
          ports:
            - containerPort: 3000
              name: http
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
  strategy:
    canary:
      canaryService: velya-web-canary
      stableService: velya-web-stable
      trafficRouting:
        nginx:
          stableIngress: velya-web-ingress
      steps:
        # Step 1: 10% - smoke test
        - setWeight: 10
        - pause: { duration: 3m }
        - analysis:
            templates:
              - templateName: velya-web-canary-analysis

        # Step 2: 50%
        - setWeight: 50
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: velya-web-canary-analysis
              - templateName: velya-web-frontend-metrics

        # Step 3: 100%
        - setWeight: 100
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: velya-web-canary-analysis
              - templateName: velya-web-frontend-metrics
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: velya-web-canary-analysis
  namespace: velya-dev-web
spec:
  metrics:
    - name: error-rate
      interval: 60s
      count: 5
      successCondition: result[0] < 0.02
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(http_requests_total{
              service="velya-web",
              status=~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="velya-web"
            }[2m]))
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: velya-web-frontend-metrics
  namespace: velya-dev-web
spec:
  metrics:
    # Largest Contentful Paint
    - name: lcp
      interval: 120s
      count: 3
      successCondition: result[0] < 2.5
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.75,
              sum(rate(velya_web_lcp_seconds_bucket[5m])) by (le)
            )

    # First Input Delay
    - name: fid
      interval: 120s
      count: 3
      successCondition: result[0] < 0.1
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.75,
              sum(rate(velya_web_fid_seconds_bucket[5m])) by (le)
            )

    # Cumulative Layout Shift
    - name: cls
      interval: 120s
      count: 3
      successCondition: result[0] < 0.1
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.75,
              sum(rate(velya_web_cls_bucket[5m])) by (le)
            )

    # JavaScript errors no browser
    - name: js-errors
      interval: 120s
      count: 3
      successCondition: result[0] < 5
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(velya_web_js_errors_total[5m])) * 300
```

---

## 6. Estrategia Canary: discharge-orchestrator

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: discharge-orchestrator
  namespace: velya-dev-core
  labels:
    app.kubernetes.io/name: discharge-orchestrator
    velya.io/team: squad-clinical
    velya.io/risk-level: critical
spec:
  replicas: 3
  selector:
    matchLabels:
      app.kubernetes.io/name: discharge-orchestrator
  template:
    metadata:
      labels:
        app.kubernetes.io/name: discharge-orchestrator
    spec:
      containers:
        - name: discharge-orchestrator
          image: ghcr.io/velya-platform/discharge-orchestrator:{{ .Values.image.tag }}
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 9090
              name: metrics
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 1000m
              memory: 512Mi
          securityContext:
            runAsNonRoot: true
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
  strategy:
    canary:
      steps:
        - setWeight: 10
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: discharge-orchestrator-analysis
        - setWeight: 25
        - pause: { duration: 5m }
        - analysis:
            templates:
              - templateName: discharge-orchestrator-analysis
        - setWeight: 50
        - pause: { duration: 10m }
        - analysis:
            templates:
              - templateName: discharge-orchestrator-analysis
              - templateName: discharge-workflow-analysis
        - setWeight: 100
        - pause: { duration: 10m }
        - analysis:
            templates:
              - templateName: discharge-orchestrator-analysis
              - templateName: discharge-workflow-analysis
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: discharge-orchestrator-analysis
  namespace: velya-dev-core
spec:
  metrics:
    - name: error-rate
      interval: 60s
      count: 5
      successCondition: result[0] < 0.005
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(http_requests_total{
              service="discharge-orchestrator",
              status=~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="discharge-orchestrator"
            }[2m]))

    - name: latency-p99
      interval: 60s
      count: 5
      successCondition: result[0] < 1.0
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                service="discharge-orchestrator"
              }[2m])) by (le)
            )
---
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: discharge-workflow-analysis
  namespace: velya-dev-core
spec:
  metrics:
    # Taxa de sucesso de workflows Temporal de alta
    - name: workflow-success-rate
      interval: 120s
      count: 3
      successCondition: result[0] > 0.98
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            sum(rate(temporal_workflow_completed_total{
              workflow_type="DischargeWorkflow",
              status="Completed"
            }[5m]))
            /
            sum(rate(temporal_workflow_completed_total{
              workflow_type="DischargeWorkflow"
            }[5m]))

    # Tempo medio de workflow de alta
    - name: workflow-duration
      interval: 120s
      count: 3
      successCondition: result[0] < 300
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.95,
              sum(rate(temporal_workflow_task_execution_latency_bucket{
                workflow_type="DischargeWorkflow"
              }[5m])) by (le)
            )
```

---

## 7. Notifications e Integracao

```yaml
# ConfigMap para configuracao de notificacoes do Argo Rollouts
apiVersion: v1
kind: ConfigMap
metadata:
  name: argo-rollouts-notification-configmap
  namespace: velya-dev-argocd
data:
  # Slack
  service.slack: |
    token: $slack-token

  # Templates de mensagem
  template.rollout-started: |
    :rocket: *Rollout iniciado*
    Servico: {{.rollout.metadata.name}}
    Namespace: {{.rollout.metadata.namespace}}
    Nova versao: {{.rollout.spec.template.metadata.labels.app.kubernetes.io/version}}
    Estrategia: {{if .rollout.spec.strategy.canary}}Canary{{else}}Blue-Green{{end}}

  template.rollout-completed: |
    :white_check_mark: *Rollout concluido com sucesso*
    Servico: {{.rollout.metadata.name}}
    Namespace: {{.rollout.metadata.namespace}}
    Versao: {{.rollout.spec.template.metadata.labels.app.kubernetes.io/version}}
    Duracao: {{.rollout.status.phase}}

  template.rollout-aborted: |
    :x: *Rollout abortado - ROLLBACK automatico*
    Servico: {{.rollout.metadata.name}}
    Namespace: {{.rollout.metadata.namespace}}
    Versao tentada: {{.rollout.spec.template.metadata.labels.app.kubernetes.io/version}}
    Motivo: Analysis falhou
    Acao: Verificar metricas no Grafana

  # Triggers
  trigger.on-rollout-started: |
    - send: [rollout-started]
      when: rollout.status.phase == "Progressing"

  trigger.on-rollout-completed: |
    - send: [rollout-completed]
      when: rollout.status.phase == "Healthy"

  trigger.on-rollout-aborted: |
    - send: [rollout-aborted]
      when: rollout.status.phase == "Degraded"

  # Subscricoes
  subscriptions: |
    - recipients:
        - slack:#velya-deployments
      triggers:
        - on-rollout-started
        - on-rollout-completed
        - on-rollout-aborted
```

---

## 8. Comparacao com Baseline

Para cada analysis, o resultado do canary e comparado com o baseline (versao estavel):

```yaml
# AnalysisTemplate com comparacao canary vs baseline
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: canary-vs-baseline-comparison
  namespace: velya-dev-core
spec:
  args:
    - name: service-name
    - name: canary-hash
    - name: baseline-hash
  metrics:
    - name: error-rate-comparison
      interval: 120s
      count: 5
      # Canary nao pode ter error rate 2x maior que baseline
      successCondition: result[0] < 2.0
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            (
              sum(rate(http_requests_total{
                service="{{ args.service-name }}",
                pod_template_hash="{{ args.canary-hash }}",
                status=~"5.."
              }[5m]))
              /
              sum(rate(http_requests_total{
                service="{{ args.service-name }}",
                pod_template_hash="{{ args.canary-hash }}"
              }[5m]))
            )
            /
            (
              sum(rate(http_requests_total{
                service="{{ args.service-name }}",
                pod_template_hash="{{ args.baseline-hash }}",
                status=~"5.."
              }[5m]))
              /
              sum(rate(http_requests_total{
                service="{{ args.service-name }}",
                pod_template_hash="{{ args.baseline-hash }}"
              }[5m]))
            )

    - name: latency-comparison
      interval: 120s
      count: 5
      # Latencia do canary nao pode ser 1.5x maior que baseline
      successCondition: result[0] < 1.5
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.velya-dev-observability:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                service="{{ args.service-name }}",
                pod_template_hash="{{ args.canary-hash }}"
              }[5m])) by (le)
            )
            /
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                service="{{ args.service-name }}",
                pod_template_hash="{{ args.baseline-hash }}"
              }[5m])) by (le)
            )
```

---

## 9. Documentos Relacionados

| Documento                          | Descricao                                      |
| ---------------------------------- | ---------------------------------------------- |
| `layered-assurance-model.md`       | Modelo completo de assurance (L5 = Deployment) |
| `runtime-integrity-model.md`       | Monitoramento apos deploy                      |
| `auto-remediation-safety-model.md` | Acoes de rollback automatico                   |
| `kubernetes-policy-guardrails.md`  | Politicas de admission pre-deploy              |
