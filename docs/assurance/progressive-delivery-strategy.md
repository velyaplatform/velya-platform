# Estrategia de Entrega Progressiva - Velya Platform

## Visao Geral

A Velya Platform utiliza **Argo Rollouts** para entrega progressiva de todas as mudancas em servicos de negocio e plataforma. A estrategia (canary ou blue-green) e determinada pelo tipo de servico, criticidade e padroes de trafego.

---

## Arvore de Decisao: Canary vs Blue-Green

```
                    [NOVO DEPLOY DE SERVICO]
                            |
                   O servico mantem estado
                   de sessao ou modelo IA
                   carregado em memoria?
                      /           \
                    SIM            NAO
                     |              |
                O servico tem    O servico recebe
                rollback         trafego HTTP
                complexo?        de usuarios?
                  /     \          /        \
                SIM      NAO    SIM         NAO
                 |        |      |           |
            [BLUE-GREEN] [BG]  [CANARY]   O servico e
                                          worker/consumer?
                                            /        \
                                          SIM         NAO
                                           |           |
                                       [CANARY      [CANARY
                                        por peso     simples]
                                        de consumer]

  RESUMO:
  - Blue-Green: ai-gateway (modelo em memoria), agent-coordinator (estado de sessao)
  - Canary: patient-flow, discharge-orchestrator, task-inbox, velya-web
```

---

## Estrategia por Servico

### 1. patient-flow (Canary 10% -> 25% -> 50% -> 100%)

Servico critico de gerenciamento de fluxo de pacientes. Canary gradual com analise rigorosa em cada step.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: patient-flow
  namespace: velya-dev-core
  labels:
    app: patient-flow
    team: core
    tier: backend
    version: "{{ .Values.image.tag }}"
spec:
  replicas: 3
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: patient-flow
  template:
    metadata:
      labels:
        app: patient-flow
        team: core
        tier: backend
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: patient-flow
          image: "123456789012.dkr.ecr.sa-east-1.amazonaws.com/velya/patient-flow:{{ .Values.image.tag }}"
          ports:
            - containerPort: 8080
              name: http
            - containerPort: 9090
              name: metrics
          env:
            - name: SERVICE_NAME
              value: patient-flow
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: "http://otel-collector.monitoring:4317"
            - name: NATS_URL
              value: "nats://nats.velya-dev-platform:4222"
          envFrom:
            - secretRef:
                name: patient-flow-db-credentials
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: "1"
              memory: 1Gi
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          readinessProbe:
            httpGet:
              path: /healthz/ready
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 10
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /healthz/live
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 20
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /healthz/startup
              port: 8080
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 30
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 100Mi
  strategy:
    canary:
      canaryService: patient-flow-canary
      stableService: patient-flow-stable
      trafficRouting:
        nginx:
          stableIngress: patient-flow-ingress
          additionalIngressAnnotations:
            canary-by-header: X-Canary
            canary-by-header-value: "true"
      steps:
        # Step 1: 10% do trafego para canary
        - setWeight: 10
        - pause:
            duration: 5m
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
        - pause:
            duration: 5m
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
            args:
              - name: service-name
                value: patient-flow
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest

        # Step 3: 50% do trafego
        - setWeight: 50
        - pause:
            duration: 10m
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
              - templateName: patient-flow-deep-analysis
            args:
              - name: service-name
                value: patient-flow
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest

        # Step 4: 100% - promocao final
        - setWeight: 100
        - pause:
            duration: 5m
        - analysis:
            templates:
              - templateName: patient-flow-canary-analysis
            args:
              - name: service-name
                value: patient-flow
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest

      # Rollback automatico se analysis falhar
      abortScaleDownDelaySeconds: 30
      # Anti-affinity entre canary e stable
      antiAffinity:
        preferredDuringSchedulingIgnoredDuringExecution:
          weight: 100
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
    # Metrica 1: Taxa de erro HTTP (deve ser < 1%)
    - name: error-rate
      interval: 60s
      count: 5
      successCondition: result[0] < 0.01
      failureCondition: result[0] >= 0.05
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{
              service="{{args.service-name}}",
              rollouts_pod_template_hash="{{args.canary-hash}}",
              status=~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="{{args.service-name}}",
              rollouts_pod_template_hash="{{args.canary-hash}}"
            }[2m]))

    # Metrica 2: Latencia P99 (deve ser < 2 segundos)
    - name: latency-p99
      interval: 60s
      count: 5
      successCondition: result[0] < 2.0
      failureCondition: result[0] >= 5.0
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(http_request_duration_seconds_bucket{
                service="{{args.service-name}}",
                rollouts_pod_template_hash="{{args.canary-hash}}"
              }[2m])) by (le)
            )

    # Metrica 3: Latencia P50 (deve ser < 500ms)
    - name: latency-p50
      interval: 60s
      count: 5
      successCondition: result[0] < 0.5
      failureCondition: result[0] >= 1.0
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.50,
              sum(rate(http_request_duration_seconds_bucket{
                service="{{args.service-name}}",
                rollouts_pod_template_hash="{{args.canary-hash}}"
              }[2m])) by (le)
            )

    # Metrica 4: Saturacao de CPU (deve ser < 80%)
    - name: cpu-saturation
      interval: 60s
      count: 3
      successCondition: result[0] < 0.8
      failureCondition: result[0] >= 0.95
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            avg(
              rate(container_cpu_usage_seconds_total{
                namespace="velya-dev-core",
                pod=~"patient-flow-.*-{{args.canary-hash}}-.*"
              }[2m])
              /
              kube_pod_container_resource_limits{
                namespace="velya-dev-core",
                pod=~"patient-flow-.*-{{args.canary-hash}}-.*",
                resource="cpu"
              }
            )

    # Metrica 5: Saturacao de memoria (deve ser < 85%)
    - name: memory-saturation
      interval: 60s
      count: 3
      successCondition: result[0] < 0.85
      failureCondition: result[0] >= 0.95
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            avg(
              container_memory_working_set_bytes{
                namespace="velya-dev-core",
                pod=~"patient-flow-.*-{{args.canary-hash}}-.*"
              }
              /
              kube_pod_container_resource_limits{
                namespace="velya-dev-core",
                pod=~"patient-flow-.*-{{args.canary-hash}}-.*",
                resource="memory"
              }
            )

    # Metrica 6: Pod restarts (deve ser 0)
    - name: pod-restarts
      interval: 60s
      count: 3
      successCondition: result[0] == 0
      failureLimit: 0
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(increase(kube_pod_container_status_restarts_total{
              namespace="velya-dev-core",
              pod=~"patient-flow-.*-{{args.canary-hash}}-.*"
            }[5m]))
```

### AnalysisTemplate Profunda (step 50%)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: patient-flow-deep-analysis
  namespace: velya-dev-core
spec:
  args:
    - name: service-name
    - name: canary-hash
  metrics:
    # Comparacao canary vs stable - latencia
    - name: latency-comparison
      interval: 120s
      count: 3
      successCondition: result[0] < 1.2  # canary nao pode ser 20% mais lento
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            (
              histogram_quantile(0.99,
                sum(rate(http_request_duration_seconds_bucket{
                  service="{{args.service-name}}",
                  rollouts_pod_template_hash="{{args.canary-hash}}"
                }[5m])) by (le)
              )
            )
            /
            (
              histogram_quantile(0.99,
                sum(rate(http_request_duration_seconds_bucket{
                  service="{{args.service-name}}",
                  rollouts_pod_template_hash!="{{args.canary-hash}}"
                }[5m])) by (le)
              )
            )

    # Comparacao canary vs stable - taxa de erro
    - name: error-rate-comparison
      interval: 120s
      count: 3
      successCondition: result[0] < 1.5  # canary nao pode ter 50% mais erros
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            (
              sum(rate(http_requests_total{
                service="{{args.service-name}}",
                rollouts_pod_template_hash="{{args.canary-hash}}",
                status=~"5.."
              }[5m]))
              /
              sum(rate(http_requests_total{
                service="{{args.service-name}}",
                rollouts_pod_template_hash="{{args.canary-hash}}"
              }[5m]))
            )
            /
            (
              sum(rate(http_requests_total{
                service="{{args.service-name}}",
                rollouts_pod_template_hash!="{{args.canary-hash}}",
                status=~"5.."
              }[5m]))
              /
              sum(rate(http_requests_total{
                service="{{args.service-name}}",
                rollouts_pod_template_hash!="{{args.canary-hash}}"
              }[5m]))
            )

    # Verificacao de NATS consumer lag
    - name: nats-consumer-health
      interval: 120s
      count: 3
      successCondition: result[0] < 500
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            max(nats_consumer_num_pending{
              stream=~"patient-flow.*"
            })

    # Verificacao de Temporal workflows
    - name: temporal-workflow-health
      interval: 120s
      count: 3
      successCondition: result[0] < 0.01
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            rate(temporal_workflow_failed_total{
              namespace="velya",
              workflow_type=~"patient.*"
            }[5m])
```

---

### 2. ai-gateway (Blue-Green com Analise Pre-Switch)

O ai-gateway carrega modelos em memoria e precisa de validacao completa antes de receber trafego.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: ai-gateway
  namespace: velya-dev-agents
  labels:
    app: ai-gateway
    team: agents
    tier: agent
spec:
  replicas: 2
  revisionHistoryLimit: 3
  selector:
    matchLabels:
      app: ai-gateway
  template:
    metadata:
      labels:
        app: ai-gateway
        team: agents
        tier: agent
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: ai-gateway
          image: "123456789012.dkr.ecr.sa-east-1.amazonaws.com/velya/ai-gateway:{{ .Values.image.tag }}"
          ports:
            - containerPort: 8000
              name: http
            - containerPort: 9090
              name: metrics
          env:
            - name: SERVICE_NAME
              value: ai-gateway
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: "http://otel-collector.monitoring:4317"
            - name: MODEL_CACHE_DIR
              value: /app/.cache/models
          envFrom:
            - secretRef:
                name: ai-gateway-credentials
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: "2"
              memory: 4Gi
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8000
            initialDelaySeconds: 30
            periodSeconds: 15
            failureThreshold: 3
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8000
            initialDelaySeconds: 60
            periodSeconds: 30
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/startup
              port: 8000
            initialDelaySeconds: 15
            periodSeconds: 10
            failureThreshold: 30
          volumeMounts:
            - name: tmp
              mountPath: /tmp
            - name: model-cache
              mountPath: /app/.cache/models
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 100Mi
        - name: model-cache
          emptyDir:
            sizeLimit: 2Gi
  strategy:
    blueGreen:
      activeService: ai-gateway-active
      previewService: ai-gateway-preview
      autoPromotionEnabled: false
      # Analise pre-promocao: roda no preview antes de switchar trafego
      prePromotionAnalysis:
        templates:
          - templateName: ai-gateway-pre-promotion
        args:
          - name: service-name
            value: ai-gateway
      # Analise pos-promocao: valida apos switch de trafego
      postPromotionAnalysis:
        templates:
          - templateName: ai-gateway-post-promotion
        args:
          - name: service-name
            value: ai-gateway
      # Tempo para manter a versao anterior disponivel apos promocao
      scaleDownDelaySeconds: 300  # 5 minutos para rollback rapido
      # Revisao anterior e mantida para rollback
      scaleDownDelayRevisionLimit: 1
```

### AnalysisTemplate Pre-Promocao (ai-gateway)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: ai-gateway-pre-promotion
  namespace: velya-dev-agents
spec:
  args:
    - name: service-name
  metrics:
    # Smoke test: chamar o endpoint de inferencia com input conhecido
    - name: smoke-test-inference
      count: 1
      failureLimit: 0
      provider:
        job:
          spec:
            backoffLimit: 1
            template:
              spec:
                containers:
                  - name: smoke-test
                    image: curlimages/curl:latest
                    command:
                      - /bin/sh
                      - -c
                      - |
                        # Teste de inferencia com input padrao
                        RESPONSE=$(curl -s -w "\n%{http_code}" \
                          -X POST http://ai-gateway-preview:8000/v1/predict \
                          -H "Content-Type: application/json" \
                          -d '{"input": "teste de smoke", "model": "default"}')
                        
                        HTTP_CODE=$(echo "$RESPONSE" | tail -1)
                        BODY=$(echo "$RESPONSE" | head -1)
                        
                        if [ "$HTTP_CODE" != "200" ]; then
                          echo "FALHA: HTTP $HTTP_CODE"
                          echo "Body: $BODY"
                          exit 1
                        fi
                        
                        echo "SUCESSO: Inferencia retornou HTTP 200"
                        echo "Body: $BODY"
                restartPolicy: Never

    # Verificar que o preview esta saudavel e respondendo
    - name: preview-health
      interval: 30s
      count: 5
      successCondition: result[0] == 1
      failureLimit: 0
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            up{
              job="ai-gateway-preview",
              namespace="velya-dev-agents"
            }

    # Verificar latencia de inferencia no preview
    - name: preview-latency
      interval: 30s
      count: 5
      successCondition: result[0] < 5.0  # menos de 5 segundos para inferencia
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(ai_inference_duration_seconds_bucket{
                service="ai-gateway",
                namespace="velya-dev-agents"
              }[2m])) by (le)
            )

    # Verificar uso de memoria (modelo carregado)
    - name: preview-memory
      interval: 30s
      count: 3
      successCondition: result[0] < 0.9  # menos de 90% do limit
      failureLimit: 0
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            max(
              container_memory_working_set_bytes{
                namespace="velya-dev-agents",
                container="ai-gateway",
                pod=~"ai-gateway-.*-preview-.*"
              }
              /
              kube_pod_container_resource_limits{
                namespace="velya-dev-agents",
                container="ai-gateway",
                pod=~"ai-gateway-.*-preview-.*",
                resource="memory"
              }
            )
```

### AnalysisTemplate Pos-Promocao (ai-gateway)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: ai-gateway-post-promotion
  namespace: velya-dev-agents
spec:
  args:
    - name: service-name
  metrics:
    - name: error-rate-post-switch
      interval: 60s
      count: 10  # 10 minutos de observacao
      successCondition: result[0] < 0.02  # menos de 2% de erro
      failureCondition: result[0] >= 0.10  # rollback se > 10% de erro
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{
              service="ai-gateway",
              status=~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="ai-gateway"
            }[2m]))

    - name: latency-post-switch
      interval: 60s
      count: 10
      successCondition: result[0] < 3.0
      failureCondition: result[0] >= 10.0
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(ai_inference_duration_seconds_bucket{
                service="ai-gateway"
              }[2m])) by (le)
            )
```

---

### 3. velya-web (Canary com Metricas de Frontend)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: velya-web
  namespace: velya-dev-web
  labels:
    app: velya-web
    team: web
    tier: frontend
spec:
  replicas: 2
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: velya-web
  template:
    metadata:
      labels:
        app: velya-web
        team: web
        tier: frontend
    spec:
      securityContext:
        runAsUser: 1000
        runAsGroup: 1000
        fsGroup: 1000
      containers:
        - name: velya-web
          image: "123456789012.dkr.ecr.sa-east-1.amazonaws.com/velya/velya-web:{{ .Values.image.tag }}"
          ports:
            - containerPort: 3000
              name: http
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 512Mi
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 15
          startupProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            failureThreshold: 12
  strategy:
    canary:
      canaryService: velya-web-canary
      stableService: velya-web-stable
      trafficRouting:
        nginx:
          stableIngress: velya-web-ingress
      steps:
        - setWeight: 10
        - pause:
            duration: 3m
        - analysis:
            templates:
              - templateName: velya-web-frontend-analysis
            args:
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest

        - setWeight: 50
        - pause:
            duration: 5m
        - analysis:
            templates:
              - templateName: velya-web-frontend-analysis
            args:
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest

        - setWeight: 100
        - pause:
            duration: 3m
```

### AnalysisTemplate com metricas de frontend

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: velya-web-frontend-analysis
  namespace: velya-dev-web
spec:
  args:
    - name: canary-hash
  metrics:
    # Core Web Vitals - LCP (Largest Contentful Paint)
    - name: lcp
      interval: 60s
      count: 5
      successCondition: result[0] < 2500  # < 2.5s (bom segundo Google)
      failureCondition: result[0] >= 4000  # > 4s (ruim)
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.75,
              sum(rate(web_vitals_lcp_bucket{
                app="velya-web",
                rollouts_pod_template_hash="{{args.canary-hash}}"
              }[3m])) by (le)
            )

    # Core Web Vitals - FID (First Input Delay)
    - name: fid
      interval: 60s
      count: 5
      successCondition: result[0] < 100  # < 100ms (bom)
      failureCondition: result[0] >= 300  # > 300ms (ruim)
      failureLimit: 2
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.75,
              sum(rate(web_vitals_fid_bucket{
                app="velya-web",
                rollouts_pod_template_hash="{{args.canary-hash}}"
              }[3m])) by (le)
            )

    # Taxa de erro JavaScript no cliente
    - name: js-error-rate
      interval: 60s
      count: 5
      successCondition: result[0] < 0.005  # < 0.5% de page views com erro JS
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(frontend_js_errors_total{
              app="velya-web",
              rollouts_pod_template_hash="{{args.canary-hash}}"
            }[3m]))
            /
            sum(rate(frontend_page_views_total{
              app="velya-web",
              rollouts_pod_template_hash="{{args.canary-hash}}"
            }[3m]))

    # Server-side rendering errors
    - name: ssr-errors
      interval: 60s
      count: 5
      successCondition: result[0] < 0.01
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            sum(rate(http_requests_total{
              service="velya-web",
              rollouts_pod_template_hash="{{args.canary-hash}}",
              status=~"5.."
            }[2m]))
            /
            sum(rate(http_requests_total{
              service="velya-web",
              rollouts_pod_template_hash="{{args.canary-hash}}"
            }[2m]))
```

---

### 4. discharge-orchestrator (Canary com Validacao de Workflows)

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: discharge-orchestrator
  namespace: velya-dev-core
  labels:
    app: discharge-orchestrator
    team: core
    tier: backend
spec:
  replicas: 2
  revisionHistoryLimit: 5
  selector:
    matchLabels:
      app: discharge-orchestrator
  template:
    metadata:
      labels:
        app: discharge-orchestrator
        team: core
        tier: backend
    spec:
      containers:
        - name: discharge-orchestrator
          image: "123456789012.dkr.ecr.sa-east-1.amazonaws.com/velya/discharge-orchestrator:{{ .Values.image.tag }}"
          # ... (config similar ao patient-flow)
  strategy:
    canary:
      canaryService: discharge-orchestrator-canary
      stableService: discharge-orchestrator-stable
      steps:
        - setWeight: 20
        - pause:
            duration: 10m  # mais tempo por causa de workflows longos
        - analysis:
            templates:
              - templateName: discharge-orchestrator-analysis
            args:
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest

        - setWeight: 50
        - pause:
            duration: 15m
        - analysis:
            templates:
              - templateName: discharge-orchestrator-analysis
              - templateName: temporal-workflow-analysis
            args:
              - name: canary-hash
                valueFrom:
                  podTemplateHashValue: Latest

        - setWeight: 100
        - pause:
            duration: 10m
```

### AnalysisTemplate especifica para Temporal workflows

```yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: temporal-workflow-analysis
  namespace: velya-dev-core
spec:
  args:
    - name: canary-hash
  metrics:
    # Workflows falhando
    - name: workflow-failure-rate
      interval: 120s
      count: 5
      successCondition: result[0] < 0.02
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            rate(temporal_workflow_failed_total{
              namespace="velya",
              workflow_type=~"discharge.*"
            }[5m])
            /
            rate(temporal_workflow_completed_total{
              namespace="velya",
              workflow_type=~"discharge.*"
            }[5m])

    # Workflows travados (running por mais de 30 min)
    - name: stuck-workflows
      interval: 120s
      count: 3
      successCondition: result[0] < 5
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            temporal_workflow_running{
              namespace="velya",
              workflow_type=~"discharge.*"
            }

    # Latencia de activities
    - name: activity-latency
      interval: 120s
      count: 3
      successCondition: result[0] < 30  # activities nao devem demorar mais de 30s
      failureLimit: 1
      provider:
        prometheus:
          address: http://prometheus.monitoring:9090
          query: |
            histogram_quantile(0.99,
              sum(rate(temporal_activity_execution_latency_bucket{
                namespace="velya",
                activity_type=~"discharge.*"
              }[5m])) by (le)
            )
```

---

## Condicoes de Freeze (Deploy Bloqueado)

### Configuracao de freeze no ArgoCD

```yaml
# argocd-cm ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: argocd-cm
  namespace: argocd
data:
  resource.customizations.health.argoproj.io_Rollout: |
    hs = {}
    -- Verificar se esta em horario de freeze
    local now = os.time()
    local hour = tonumber(os.date("%H", now))
    local weekday = tonumber(os.date("%w", now))
    
    -- Sexta apos 16h ou fim de semana
    if (weekday == 5 and hour >= 16) or weekday == 0 or weekday == 6 then
      hs.status = "Suspended"
      hs.message = "Deploy bloqueado: fora do horario permitido"
      return hs
    end
    
    hs.status = "Healthy"
    return hs
```

### Webhook de validacao de freeze

```yaml
# Kyverno policy para bloquear deploys durante freeze
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: velya-deploy-freeze
spec:
  validationFailureAction: Enforce
  background: false
  rules:
    - name: block-weekend-deploys
      match:
        any:
          - resources:
              kinds:
                - Rollout
              operations:
                - UPDATE
              namespaces:
                - velya-dev-core
                - velya-dev-agents
                - velya-dev-web
      preconditions:
        any:
          # Bloqueia se label de freeze ativo
          - key: "{{request.object.metadata.annotations.velya-io/freeze-override || 'false'}}"
            operator: NotEquals
            value: "true"
      validate:
        message: "Deploy bloqueado durante periodo de freeze. Para override emergencial, adicione annotation velya.io/freeze-override: 'true' com aprovacao de SRE."
        deny:
          conditions:
            any:
              - key: "{{ time_now_utc().day_of_week() }}"
                operator: AnyIn
                value: ["Saturday", "Sunday"]
```

---

## Thresholds de Rollback

| Metrica | Warning (log) | Abort (rollback) |
|---|---|---|
| Taxa de erro HTTP 5xx | > 1% | > 5% |
| Latencia P99 | > 2s | > 5s |
| Latencia P50 | > 500ms | > 1s |
| CPU saturation | > 80% | > 95% |
| Memory saturation | > 85% | > 95% |
| Pod restarts | >= 1 | >= 1 (imediato) |
| NATS consumer lag | > 500 msgs | > 5000 msgs |
| Temporal workflow failures | > 2% | > 10% |
| Frontend LCP | > 2.5s | > 4s |
| Frontend JS errors | > 0.5% | > 2% |

---

## Monitoramento de Rollouts

### Dashboard Grafana para Rollouts

```json
{
  "dashboard": {
    "title": "Velya - Argo Rollouts Status",
    "panels": [
      {
        "title": "Rollouts em Progresso",
        "type": "table",
        "targets": [
          {
            "expr": "argo_rollouts_info{namespace=~\"velya-.*\"}",
            "legendFormat": "{{name}} - {{strategy}} - {{phase}}"
          }
        ]
      },
      {
        "title": "Rollout Duration (ultimos 7 dias)",
        "type": "timeseries",
        "targets": [
          {
            "expr": "argo_rollouts_phase_duration_seconds{namespace=~\"velya-.*\"}",
            "legendFormat": "{{name}}"
          }
        ]
      },
      {
        "title": "Rollbacks (ultimos 30 dias)",
        "type": "stat",
        "targets": [
          {
            "expr": "count(argo_rollouts_info{namespace=~\"velya-.*\", phase=\"Degraded\"})",
            "legendFormat": "Rollbacks"
          }
        ]
      }
    ]
  }
}
```
