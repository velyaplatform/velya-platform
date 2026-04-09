# Modos de Falha do Autoscaling — Velya

**Versão:** 1.0  
**Domínio:** Resiliência de Infraestrutura  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Visão Geral

Este documento cataloga os 20 modos de falha conhecidos do sistema de autoscaling da Velya. Para cada falha: nome, trigger, sintoma observável, query Prometheus para detecção, mitigação imediata e prevenção permanente.

**Princípio de gestão de falhas:**
> **Todo modo de falha é detectável. Se não detectável, não é um modo de falha gerenciável — é uma bomba-relógio. Adicionar detecção antes de prevenir.**

---

## Catálogo de Failure Modes

---

### FM-01: HPA Flapping (Scale Loop)

**Nome:** HPA scale oscillation — replica churn excessivo

**Trigger:** `stabilizationWindowSeconds` muito curto + carga borderline

**Sintoma:**
- Replicas sobem e descem rapidamente (< 5 min por ciclo)
- Alta taxa de pod creation/deletion events
- Latência instável por pods sendo terminados enquanto servem requests
- Logs KUBE-SCHEDULER cheios de events de bind/delete

**Detecção Prometheus:**
```promql
# Taxa de mudanças em replicas — se > 4 em 30min, flapping
changes(
  kube_horizontalpodautoscaler_status_current_replicas{
    namespace=~"velya-.*"
  }[30m]
) > 4
```

**Mitigação Imediata:**
```bash
# Estabilizar manualmente — fixar replicas no atual
kubectl patch hpa <nome> -n <namespace> \
  --patch '{"spec":{"minReplicas": <current>, "maxReplicas": <current>}}'

# Aguardar 5min para carga estabilizar, depois restaurar
kubectl patch hpa <nome> -n <namespace> \
  --patch '{"spec":{"minReplicas": <original-min>, "maxReplicas": <original-max>}}'
```

**Prevenção:**
```yaml
behavior:
  scaleDown:
    stabilizationWindowSeconds: 300   # Mínimo 5 min para scale-down
    policies:
    - type: Pods
      value: 2
      periodSeconds: 120
  scaleUp:
    stabilizationWindowSeconds: 60    # 60s para scale-up (não instantâneo)
```

---

### FM-02: HPA vs KEDA Conflict

**Nome:** Dois controllers de replicas no mesmo Deployment

**Trigger:** HPA e ScaledObject KEDA apontando para o mesmo Deployment

**Sintoma:**
- Replicas instáveis — oscilam entre o target do HPA e o target do KEDA
- ScaledObject KEDA e HPA brigam por controle da replica count
- Eventos K8s: conflito entre `HorizontalPodAutoscaler` e `ScaledObject`

**Detecção Prometheus:**
```promql
# Detectar deployments com HPA e KEDA simultâneos
# (requer label customizada ao criar os objetos)
count by (namespace, deployment) (
  label_join(
    kube_horizontalpodautoscaler_metadata_generation{namespace=~"velya-.*"},
    "deployment", "/",
    "namespace", "horizontalpodautoscaler"
  )
) > 0
# Cruzar manualmente com ScaledObjects ativos
```

**Detecção via Kubectl:**
```bash
# Script de detecção de conflito
for ns in velya-dev-core velya-dev-agents velya-dev-platform; do
  hpa_targets=$(kubectl get hpa -n $ns -o jsonpath='{.items[*].spec.scaleTargetRef.name}' 2>/dev/null | tr ' ' '\n' | sort)
  keda_targets=$(kubectl get scaledobject -n $ns -o jsonpath='{.items[*].spec.scaleTargetRef.name}' 2>/dev/null | tr ' ' '\n' | sort)
  
  conflict=$(comm -12 <(echo "$hpa_targets") <(echo "$keda_targets"))
  if [ -n "$conflict" ]; then
    echo "CONFLITO em $ns: $conflict"
  fi
done
```

**Mitigação Imediata:**
```bash
# Decidir qual usar (KEDA preferido para workers, HPA para HTTP services)
# Se KEDA é o correto: deletar o HPA
kubectl delete hpa <nome> -n <namespace>

# Se HPA é o correto: pausar o ScaledObject
kubectl annotate scaledobject <nome> -n <namespace> \
  autoscaling.keda.sh/paused=true
```

**Prevenção:**
```yaml
# Kyverno policy — bloquear criação de ScaledObject para deployments com HPA
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: prevent-hpa-keda-conflict
spec:
  validationFailureAction: Enforce
  rules:
  - name: check-hpa-exists
    match:
      any:
      - resources:
          kinds: [ScaledObject]
    validate:
      message: "Não é possível criar ScaledObject — deployment já tem HPA"
      deny:
        conditions:
          any:
          - key: "{{ request.object.spec.scaleTargetRef.name }}"
            operator: In
            value: "{{ request.namespace }}_hpa_targets"  # Requer admission webhook customizado
```

---

### FM-03: VPA Resizing Durante Pico de Tráfego

**Nome:** VPA Auto evicta pods durante pico para aplicar recomendações

**Trigger:** VPA em modo `Auto` decide fazer resize no pior momento

**Sintoma:**
- Pods são reiniciados durante horário de pico (8-10h, 14-16h)
- Latência aumenta durante restarts
- VPA events mostram `EvictedForVPA` em pods com tráfego ativo

**Detecção Prometheus:**
```promql
# Detectar evicções VPA durante horário de pico
sum by (namespace, pod) (
  kube_pod_container_status_restarts_total{
    namespace=~"velya-.*"
  }
) > 0
# Cruzar com horário (hora local 8-10 ou 14-16)
AND on() hour() >= 8 AND on() hour() <= 10
```

**Mitigação Imediata:**
```bash
# Mudar VPA para modo Initial ou Off durante pico
kubectl patch vpa <nome> -n <namespace> \
  --type merge \
  --patch '{"spec":{"updatePolicy":{"updateMode":"Initial"}}}'
```

**Prevenção:**
```yaml
# VPA com EvictionRequirements — só evictar em janela segura
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: patient-flow-vpa
  namespace: velya-dev-core
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: patient-flow-service
  updatePolicy:
    updateMode: "Auto"
    evictionRequirements:
    - resources: ["cpu", "memory"]
      changeRequirement: TargetHigherThanRequests
    # Usar PodDisruptionBudget para limitar simultâneos
  resourcePolicy:
    containerPolicies:
    - containerName: patient-flow
      # Limitar range para evitar resizes grandes
      minAllowed: {cpu: 100m, memory: 128Mi}
      maxAllowed: {cpu: 2000m, memory: 2Gi}

# MELHOR: usar mode Initial para serviços com HPA/pico
# VPA Initial aplica recomendações apenas em pods novos (scale-up)
# Nunca reinicia pods existentes
```

---

### FM-04: Node Provisioning Lag (Karpenter)

**Nome:** Karpenter demora para provisionar novo nó durante pico

**Trigger:** Burst de novos pods que precisam de nó novo; Karpenter ainda não provisionou

**Sintoma:**
- Pods ficam em `Pending` por > 3 minutos
- `kube-scheduler` events: `0/X nodes are available: insufficient cpu/memory`
- Karpenter logs: provisioning requests em queue
- SLO de latência degradado durante o burst

**Detecção Prometheus:**
```promql
# Pods em Pending por > 3 minutos
sum by (namespace, pod) (
  time() - kube_pod_start_time{
    phase="Pending",
    namespace=~"velya-.*"
  }
) > 180

# Métrica direta do Karpenter
karpenter_provisioner_scheduling_duration_seconds{quantile="0.99"} > 60
```

**Mitigação Imediata:**
```bash
# Verificar por que Karpenter não provisionou
kubectl logs -n kube-system -l app.kubernetes.io/name=karpenter --since=10m | grep -i error

# Verificar pods pendentes
kubectl get pods -A --field-selector=status.phase=Pending

# Forçar describe do pod para ver scheduling events
kubectl describe pod <pod-pendente> -n <namespace>

# Verificar se NodePool tem capacidade
kubectl get nodepool -o yaml | grep -A5 limits
```

**Prevenção:**
```yaml
# 1. Manter nós de buffer (Cluster Overprovisioning)
# Deployments com PriorityClass muito baixa que "seguram" nós vazios
apiVersion: apps/v1
kind: Deployment
metadata:
  name: overprovisioning-buffer
  namespace: velya-dev-platform
spec:
  replicas: 3
  template:
    spec:
      priorityClassName: velya-background    # Prioridade mais baixa
      containers:
      - name: pause
        image: k8s.gcr.io/pause:3.8
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 1000m
            memory: 2Gi
# Quando um pod real com prioridade mais alta chega, ele evita o pause pod
# Karpenter provisiona um novo nó para o pause pod ser re-schedulado

# 2. Warm-up de NodePool com nodes mínimos
# NodePool com minNodes (futuro Karpenter feature)
# Por enquanto: manter Deployments baseline com pelo menos 1 réplica por nó desejado
```

---

### FM-05: PDB Bloqueando Scale-Down

**Nome:** PodDisruptionBudget impede Karpenter de consolidar nós

**Trigger:** `minAvailable` ou `maxUnavailable` muito restritivo + muitos pods no nó

**Sintoma:**
- Karpenter não consegue consolidar nós subutilizados
- Custo de compute elevado com nós com < 20% utilização
- Karpenter events: `PodDisruptionBudget blocked eviction`
- `kubectl get pdb -A` mostra DISRUPTIONS ALLOWED = 0

**Detecção Prometheus:**
```promql
# Nós com utilização muito baixa (candidatos a consolidação)
kube_node_status_allocatable{resource="cpu"} -
  kube_node_status_capacity{resource="cpu"}

# PDBs bloqueando evictions
kube_poddisruptionbudget_status_disruptions_allowed == 0
AND
kube_poddisruptionbudget_status_current_healthy ==
  kube_poddisruptionbudget_status_desired_healthy
```

**Mitigação Imediata:**
```bash
# Verificar quais PDBs estão bloqueando
kubectl get pdb -A -o custom-columns=\
  'NAMESPACE:.metadata.namespace,NAME:.metadata.name,MIN-AVAIL:.spec.minAvailable,DESIRED:.status.desiredHealthy,CURRENT:.status.currentHealthy,ALLOWED:.status.disruptionsAllowed'

# Verificar nós candidatos à consolidação
kubectl get nodes --sort-by='.status.capacity.cpu'

# Se PDB muito restritivo temporariamente:
kubectl patch pdb <nome> -n <namespace> \
  --patch '{"spec":{"maxUnavailable": 1}}'
```

**Prevenção:**
```yaml
# PDB correto para serviços com múltiplas replicas
# Use maxUnavailable ao invés de minAvailable quando possível
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: patient-flow-pdb
  namespace: velya-dev-core
spec:
  maxUnavailable: 1    # Permite 1 pod indisponível (não bloqueia com 3+ replicas)
  # NÃO usar:
  # minAvailable: 3    # Bloqueia se só tem 3 pods (DISRUPTIONS ALLOWED = 0)
  selector:
    matchLabels:
      app: patient-flow-service
```

---

### FM-06: Readiness Probe Lenta Causando Churn

**Nome:** Pods novos ficam sem tráfego por muito tempo → scale-up parece não funcionar

**Trigger:** `initialDelaySeconds` muito alto + `periodSeconds` muito alto na readiness probe

**Sintoma:**
- Scale-up acontece (pods criados) mas tráfego não diminui porque pods novos não ficam "ready"
- Pods em estado `Running` mas `0/1 READY` por > 60 segundos
- HPA continua subindo replicas porque a carga não diminui (pods novos não servem)
- Eventual cascade: muitos pods, todos na fila de "becoming ready"

**Detecção Prometheus:**
```promql
# Pods running mas não ready
kube_pod_status_ready{condition="false", namespace=~"velya-.*"} == 1
AND
kube_pod_status_phase{phase="Running", namespace=~"velya-.*"} == 1

# Tempo médio para pod ficar ready
histogram_quantile(0.95,
  rate(kubelet_pod_worker_start_duration_seconds_bucket[30m])
) > 30
```

**Mitigação Imediata:**
```bash
# Verificar por que pods estão Running mas não Ready
kubectl get pods -n <namespace> | grep "0/1 Running"
kubectl describe pod <pod> -n <namespace>

# Verificar logs de startup
kubectl logs <pod> -n <namespace>

# Checar readiness probe
kubectl get deployment <nome> -n <namespace> -o jsonpath='{.spec.template.spec.containers[0].readinessProbe}'
```

**Prevenção:**
```yaml
# Startup probe + readiness probe bem configuradas
readinessProbe:
  httpGet:
    path: /healthz/ready
    port: 8080
  initialDelaySeconds: 5       # Curto — startupProbe cuida do startup
  periodSeconds: 5             # Verificar a cada 5s
  failureThreshold: 3          # 3 falhas = não ready
  successThreshold: 1

startupProbe:
  httpGet:
    path: /healthz/startup
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 30         # 30 × 5s = 150s máximo para startup
  # Startup probe falhar → pod é reiniciado (não fica preso em "not ready")
```

---

### FM-07: KEDA Scrape Interval Alto

**Nome:** KEDA demora para detectar que fila cresceu

**Trigger:** `pollingInterval` muito alto no ScaledObject + fila cresce rapidamente

**Sintoma:**
- Fila cresce para milhares de mensagens antes do KEDA iniciar scale-up
- `pollingInterval: 60` com fila que pode crescer 500 msgs/min = problema
- Spike de backlog sem resposta por 1-2 minutos

**Detecção Prometheus:**
```promql
# Queue depth crescendo sem scale-up correspondente
rate(velya_nats_pending_messages{stream=~"velya\\..*"}[5m]) > 100
AND
changes(kube_deployment_status_replicas{deployment=~".*worker.*"}[5m]) == 0
```

**Prevenção:**
```yaml
# pollingInterval adequado por tipo de worker
spec:
  pollingInterval: 15    # 15s para workers de filas críticas (discharge, clinical events)
  # pollingInterval: 30  # 30s para workers de relatórios/analytics
  # pollingInterval: 60  # 60s para workers de batch de baixa prioridade

# activationLagThreshold para evitar cold-start delay
triggers:
- type: nats-jetstream
  metadata:
    lagThreshold: "50"
    activationLagThreshold: "5"  # Acordar IMEDIATAMENTE quando tiver 5 msgs (não esperar 50)
```

---

### FM-08: Thrash por Cooldown Muito Curto

**Nome:** Workers escalam para cima e para baixo em loops curtos

**Trigger:** `cooldownPeriod` muito curto + carga em rajadas curtas

**Sintoma:**
- KEDA faz scale-up, fila é consumida, KEDA faz scale-down, fila cresce de novo
- Alta taxa de pod creation/deletion
- Custo elevado por pods que não processam nada antes de serem terminados
- Overhead de Kubernetes (etcd writes) por excesso de events

**Detecção Prometheus:**
```promql
# Rate de mudanças em scaled deployments
rate(kube_deployment_status_replicas{
  deployment=~".*worker.*",
  namespace=~"velya-.*"
}[30m]) > 0.1   # Mais de 1 mudança a cada 10min
```

**Prevenção:**
```yaml
# cooldownPeriod adequado por tipo de workload
spec:
  cooldownPeriod: 120    # 2 min para workers críticos (discharge)
  # cooldownPeriod: 300  # 5 min para AI agents (chamadas LLM longas)
  # cooldownPeriod: 600  # 10 min para analytics workers (jobs longos)

# stabilizationWindowSeconds no HPA config interno do KEDA
advanced:
  horizontalPodAutoscalerConfig:
    behavior:
      scaleDown:
        stabilizationWindowSeconds: 180  # 3 min de estabilização antes de scale-down
```

---

### FM-09: DLQ Crescendo sem Scale-Up

**Nome:** Mensagens vão para DLQ mas não há escala de workers para processar

**Trigger:** Workers em crash → mensagens vão para DLQ → DLQ não tem trigger de KEDA

**Sintoma:**
- DLQ acumula mensagens
- Workers principais estão falhando (CrashLoop ou erro de processamento)
- KEDA olha para a fila principal (sem lag), não para DLQ
- DLQ cresce indefinidamente

**Detecção Prometheus:**
```promql
# DLQ crescendo
delta(velya_nats_stream_messages{stream=~"velya\\..*\\.dlq"}[10m]) > 5

# Taxa de crescimento do DLQ
rate(velya_nats_stream_messages{stream=~"velya\\..*\\.dlq"}[5m]) > 0
```

**Mitigação Imediata:**
```bash
# Verificar por que mensagens foram para DLQ
nats stream info velya.discharge.dlq

# Inspecionar mensagens no DLQ
nats consumer sub velya.discharge.dlq velya-dlq-inspector --count=5

# Re-queue manualmente após investigar a causa raiz
nats consumer copy velya.discharge.dlq velya.discharge.queue --count=N
```

**Prevenção:**
```yaml
# ScaledObject para DLQ worker (processa mensagens que falharam)
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: discharge-dlq-worker-so
  namespace: velya-dev-agents
spec:
  scaleTargetRef:
    name: discharge-dlq-processor
  minReplicaCount: 0      # Pode ficar em zero quando DLQ vazio
  maxReplicaCount: 5      # Limite — DLQ worker não deve escalar muito
  triggers:
  - type: nats-jetstream
    metadata:
      stream: velya.discharge.dlq
      consumer: dlq-processor-consumer
      lagThreshold: "1"   # 1 worker para qualquer mensagem no DLQ
      activationLagThreshold: "1"
```

---

### FM-10: Over-scaling por Métrica Ruidosa

**Nome:** KEDA ou HPA escala por ruído em métricas Prometheus

**Trigger:** Spike momentâneo na métrica (GC pause, health check spike, falso positivo)

**Sintoma:**
- Scale-up súbito sem causa de negócio aparente
- Réplicas aumentam por 2-3 minutos e depois voltam
- Prometheus mostra spike de < 30s na métrica de trigger
- Custo aumenta sem benefício de performance

**Detecção Prometheus:**
```promql
# Spike de > 5 réplicas em < 10 minutos sem aumento de tráfego
delta(
  kube_deployment_status_replicas{deployment="api-gateway"}[10m]
) > 5
AND
rate(nginx_ingress_controller_requests{service="api-gateway"}[10m]) < 1.2 *
  avg_over_time(nginx_ingress_controller_requests{service="api-gateway"}[1h] offset 10m)
```

**Prevenção:**
```yaml
# HPA: usar janela de estabilização para ignorar spikes curtos
behavior:
  scaleUp:
    stabilizationWindowSeconds: 60    # Ignorar spikes < 60s
    policies:
    - type: Pods
      value: 2
      periodSeconds: 60

# KEDA: usar query com rate() ao invés de valor instantâneo
triggers:
- type: prometheus
  metadata:
    query: |
      avg_over_time(velya_queue_depth[2m])  # Média de 2 min, não valor instantâneo
    threshold: "100"
```

---

### FM-11: Scale-Down Agressivo com Sessões Ativas

**Nome:** Pod é terminado enquanto ainda tem connections ativas

**Trigger:** Scale-down sem graceful shutdown adequado

**Sintoma:**
- Usuários recebem erros de conexão durante scale-down
- Requests em andamento são cortados
- `502 Bad Gateway` no NGINX durante terminação de pods

**Detecção Prometheus:**
```promql
# Aumento de 502 correlacionado com scale-down events
rate(nginx_ingress_controller_requests{status="502"}[5m]) > 0
AND
delta(kube_deployment_status_replicas{deployment=~".*"}[5m]) < 0
```

**Prevenção:**
```yaml
# preStop hook + terminationGracePeriodSeconds
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 60
      containers:
      - name: api-gateway
        lifecycle:
          preStop:
            exec:
              command:
              - /bin/sh
              - -c
              - sleep 15    # Dar tempo para LB remover o pod do pool antes de SIGTERM

# NGINX: configurar upstream keepalive e connection draining
# No ingress annotation:
annotations:
  nginx.ingress.kubernetes.io/proxy-connect-timeout: "30"
  nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
  nginx.ingress.kubernetes.io/connection-proxy-header: "keep-alive"
```

---

### FM-12: Memory Limit Throttling Mascarado como CPU Issue

**Nome:** Pod atinge memory limit, OOM killer ativa, parece problema de CPU

**Trigger:** Memory leak gradual + limit muito baixo

**Sintoma:**
- Pods reiniciam periodicamente com `OOMKilled`
- HPA escala por CPU (que sobe quando há GC pressure por falta de memória)
- Escalar não resolve — cada nova réplica também enche a memória
- Logs de app mostram GC pauses frequentes

**Detecção Prometheus:**
```promql
# OOMKilled pods
kube_pod_container_status_last_terminated_reason{reason="OOMKilled"} == 1

# Memory usage próximo do limit
container_memory_working_set_bytes /
  kube_pod_container_resource_limits{resource="memory"} > 0.85
```

**Mitigação Imediata:**
```bash
# Aumentar memory limit temporariamente
kubectl set resources deployment <nome> -n <namespace> \
  --limits=memory=1Gi

# Verificar OOM history
kubectl get events -n <namespace> --field-selector reason=OOMKilling
```

**Prevenção:**
```yaml
# VPA recomendação de memória para ajuste
# Goldilocks mostra: "your containers are using X but limited to Y"
# Aumentar limit com margem de 30-50% acima do uso observado

resources:
  requests:
    memory: 256Mi    # Baseline do VPA
  limits:
    memory: 768Mi    # 3x do request para acomodar spikes de GC
    # CPU limit: omitir (throttling é pior que OOM para serviços HTTP)
```

---

### FM-13: KEDA Metrics Server Indisponível

**Nome:** KEDA não consegue consultar a fonte de métricas (Prometheus, NATS)

**Trigger:** Prometheus down, NATS monitoring endpoint inacessível, network policy bloqueando

**Sintoma:**
- Todos os ScaledObjects ficam em estado `Unknown` ou `Paused`
- Workers não escalam (ficam no minReplicaCount)
- KEDA operator logs mostram erros de conexão
- `kubectl get scaledobject -A` mostra `CONDITIONS` = `False`

**Detecção Prometheus:**
```promql
# KEDA scaler errors
keda_scaler_errors_total > 0

# ScaledObjects com erro
keda_scaled_object_error_count > 0
```

**Detecção via Kubectl:**
```bash
kubectl get scaledobject -A -o custom-columns=\
  'NAMESPACE:.metadata.namespace,NAME:.metadata.name,READY:.status.conditions[0].status,REASON:.status.conditions[0].reason'
```

**Mitigação Imediata:**
```bash
# Verificar logs do KEDA operator
kubectl logs -n keda deployment/keda-operator --since=10m | grep -i error

# Verificar se Prometheus está acessível a partir do namespace keda
kubectl exec -n keda deployment/keda-operator -- \
  wget -qO- http://prometheus-operated.velya-dev-observability.svc:9090/-/healthy

# Se Prometheus down: workers ficam no minReplicaCount — aumentar manualmente se necessário
kubectl scale deployment <worker> -n <namespace> --replicas=<seguro>
```

---

### FM-14: Spot Eviction em Cascata

**Nome:** Múltiplos nós Spot são evictados simultaneamente por AWS

**Trigger:** AWS termina Spot instances quando demanda do tipo de instância aumenta

**Sintoma:**
- Múltiplos pods terminados simultaneamente
- Karpenter provisionando novos nós mas demora 2-3 minutos
- Backlog de filas aumenta durante o gap
- Se PDB configurado corretamente, não há downtime — mas há degradação

**Detecção Prometheus:**
```promql
# Taxa de terminação de nós Spot (Karpenter metrics)
rate(karpenter_nodes_termination_time_seconds_count{
  nodepool=~".*spot.*|.*async.*|.*batch.*"
}[10m]) > 0.3   # Mais de 1 nó terminado a cada ~3min = evição em cascata
```

**Mitigação Imediata:**
```bash
# Verificar evições em andamento
kubectl get events --field-selector reason=SpotInterruption 2>/dev/null || \
  kubectl get nodes --show-labels | grep spot

# Karpenter provisiona automaticamente — monitorar
kubectl get nodes -w

# Se provisioning muito lento: verificar se NodePool atingiu limits
kubectl describe nodepool velya-async-workers | grep -A5 limits
```

**Prevenção:**
```yaml
# Diversificação de tipos de instância no NodePool
requirements:
- key: node.kubernetes.io/instance-type
  operator: In
  values:
  - m6i.large
  - m7g.large    # ARM — mercado diferente = menos competição por Spot
  - c6i.large
  - c7g.large    # ARM + diferente AZ
  - t3.large     # Burstable — menos evicção que m6/c6
  - m6a.large    # AMD — outro mercado Spot

# Topology spread para minimizar impacto por AZ
topologySpreadConstraints:
- maxSkew: 1
  topologyKey: topology.kubernetes.io/zone
  whenUnsatisfiable: DoNotSchedule
  labelSelector:
    matchLabels:
      velya.io/workload-class: async-worker
```

---

### FM-15: Validation Queue Congestion

**Nome:** Fila de validação (ex: aprovação médica) bloqueia workflows

**Trigger:** Volume alto de workflows aguardando ação humana; aprovadores não disponíveis

**Sintoma:**
- Temporal workflows ficam em `RUNNING` por horas sem avançar
- Fila de aprovação cresce no task-inbox-service
- SLA de discharge sendo violado
- Relatório de SLA mostra breach

**Detecção Prometheus:**
```promql
# Workflows Temporal em running por muito tempo
temporal_workflow_running_count{
  namespace="velya-dev",
  task_queue="discharge-orchestration"
} > 20

# Tempo médio de wait em workflows de discharge
histogram_quantile(0.95,
  temporal_workflow_execution_duration_seconds_bucket{
    namespace="velya-dev",
    workflow_type="DischargeOrchestrationWorkflow"
  }
) > 3600   # Mais de 1 hora
```

**Mitigação Imediata:**
```bash
# Ver workflows pendentes de aprovação
temporal workflow list \
  --query 'WorkflowType="DischargeOrchestrationWorkflow" AND ExecutionStatus="Running"' \
  --namespace velya-dev

# Verificar task-inbox para tarefas pendentes
kubectl exec -n velya-dev-core deployment/task-inbox-service -- \
  curl -s http://localhost:8080/api/v1/tasks?status=pending&priority=high | jq '.total'
```

**Prevenção:**
- Configurar `schedule_to_close_timeout` para atividades de aprovação humana com timeout claro
- Notificação de escalada automática se aprovação não vem em X tempo
- Fallback: escalar para próximo nível da equipe médica automaticamente

---

### FM-16: Scheduling Delay por Anti-Affinity Rígida

**Nome:** Pods não schedulados porque anti-affinity forçada não pode ser satisfeita

**Trigger:** `requiredDuringSchedulingIgnoredDuringExecution` com `topologyKey: hostname` + poucos nós

**Sintoma:**
- Pods em `Pending` com evento: `0/3 nodes available: 3 node(s) didn't match pod anti-affinity rules`
- HPA não consegue escalar efetivamente — pods novos não ficam scheduled
- kind-velya-local (3 nós) é especialmente susceptível

**Detecção:**
```bash
kubectl get pods -n velya-dev-core --field-selector=status.phase=Pending

kubectl describe pod <pod-pendente> -n velya-dev-core | grep -A10 "Events:"
# Output: 0/3 nodes available: 3 node(s) didn't match pod anti-affinity rules
```

**Prevenção:**
```yaml
# Usar preferred (soft) anti-affinity ao invés de required (hard) quando possível
affinity:
  podAntiAffinity:
    # SOFT — preferência, não obrigatoriedade
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchLabels:
            app: api-gateway
        topologyKey: kubernetes.io/hostname
    # HARD apenas para casos onde isolamento é crítico (compliance)
    # requiredDuringSchedulingIgnoredDuringExecution: ...
```

---

### FM-17: CPU Throttling sem Scale-Up (Limit sem Request)

**Nome:** Pod com CPU limit muito baixo fica com throttling mas não escala

**Trigger:** `limits.cpu` muito baixo + HPA baseado em `requests.cpu` (não observa throttling)

**Sintoma:**
- Pod com CPU utilization aparentemente baixa no Prometheus
- Mas latência alta e throughput baixo
- HPA não escala porque "CPU está em 40%" (mas está sendo throttled)
- `container_cpu_cfs_throttled_seconds_total` alto

**Detecção Prometheus:**
```promql
# Throttling rate por container
rate(container_cpu_cfs_throttled_seconds_total{
  namespace=~"velya-.*"
}[5m]) /
rate(container_cpu_cfs_periods_total{
  namespace=~"velya-.*"
}[5m]) > 0.25   # Mais de 25% de throttling = problema
```

**Prevenção:**
```yaml
resources:
  requests:
    cpu: 250m
  limits:
    # OMITIR cpu limit para serviços HTTP — throttling é pior que burst
    # Se obrigatório pelo LimitRange:
    cpu: 2000m    # Limite muito generoso — nunca throttle em burst legítimo
  
  # memory limit é SEMPRE obrigatório (OOM é controlado, throttling é silencioso)
  limits:
    memory: 512Mi
```

---

### FM-18: Liveness Probe Agressiva Matando Pods em GC

**Nome:** Liveness probe timeout durante GC pause — pod é reiniciado desnecessariamente

**Trigger:** JVM/Node.js GC pause + `timeoutSeconds` muito curto na liveness probe

**Sintoma:**
- Pods reiniciam periodicamente (1-2x por hora)
- `kubectl describe pod` mostra: `Liveness probe failed: context deadline exceeded`
- Restarts correlacionam com horários de alto uso de memória

**Detecção Prometheus:**
```promql
# Pod restarts com causa de liveness
kube_pod_container_status_restarts_total{
  namespace=~"velya-.*"
} > 3   # Mais de 3 restarts na vida do pod
```

**Prevenção:**
```yaml
livenessProbe:
  httpGet:
    path: /healthz/live
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 20
  timeoutSeconds: 10        # Timeout generoso para GC pauses
  failureThreshold: 5       # 5 falhas = 100s antes de restart
  successThreshold: 1

# startupProbe para gerir startup longo
startupProbe:
  httpGet:
    path: /healthz/startup
    port: 8080
  failureThreshold: 30      # 30 × 5s = 150s para startup completo
  periodSeconds: 5
  timeoutSeconds: 5
```

---

### FM-19: Temporal Worker Scale-Down com Workflow em Execução

**Nome:** Temporal worker pod é terminado com workflow a meio caminho

**Trigger:** Karpenter consolida nó com Temporal worker + SIGTERM para o pod

**Sintoma:**
- Workflows falham com `WorkerStopped` error
- Temporal reentrega o workflow task ao próximo worker disponível
- Workflows ficam em `RUNNING` por mais tempo que o esperado

**Detecção:**
```bash
# Verificar falhas de workflow por worker stop
temporal workflow list \
  --query 'ExecutionStatus="Failed" AND CloseTime > "1 hour ago"' \
  --namespace velya-dev | grep -i "worker"
```

**Prevenção:**
```yaml
# 1. Temporal workers em nós On-Demand (não Spot)
nodeSelector:
  karpenter.sh/capacity-type: on-demand

# 2. PDB para não ter 0 workers
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: temporal-worker-pdb
  namespace: velya-dev-agents
spec:
  minAvailable: 1   # Nunca terminando todos os workers
  selector:
    matchLabels:
      app: temporal-worker

# 3. Grace period longo para workflows concluírem atividade atual
spec:
  template:
    spec:
      terminationGracePeriodSeconds: 120   # 2 min para atividade atual terminar
      containers:
      - name: temporal-worker
        # O SDK Temporal para de pegar novas tasks quando recebe SIGTERM
        # Mas conclui as atividades em andamento dentro do grace period
```

---

### FM-20: KEDA Scaler Leak — ScaledObject Órfão

**Nome:** ScaledObject ainda ativo para Deployment deletado

**Trigger:** Deployment deletado sem deletar o ScaledObject correspondente

**Sintoma:**
- KEDA operator logs: `deployment not found` errors
- KEDA tentando criar réplicas de um deployment que não existe mais
- Recursos de KEDA consumidos sem valor
- `kubectl get scaledobject -A` mostra ScaledObjects sem target

**Detecção:**
```bash
# Verificar ScaledObjects sem target Deployment
kubectl get scaledobject -A -o json | jq -r '.items[] | 
  "\(.metadata.namespace) \(.metadata.name) \(.spec.scaleTargetRef.name)"' | \
while read ns so dep; do
  if ! kubectl get deployment $dep -n $ns &>/dev/null; then
    echo "ÓRFÃO: ScaledObject $so no namespace $ns aponta para deployment $dep inexistente"
  fi
done
```

**Mitigação Imediata:**
```bash
# Deletar ScaledObjects órfãos
kubectl delete scaledobject <nome> -n <namespace>
```

**Prevenção:**
```yaml
# Usar ownerReferences para que ScaledObject seja deletado com o Deployment
# (Helm faz isso automaticamente quando ScaledObject está no mesmo chart)
metadata:
  ownerReferences:
  - apiVersion: apps/v1
    kind: Deployment
    name: <deployment-name>
    uid: <deployment-uid>
    controller: false
    blockOwnerDeletion: false
```

---

## Tabela Resumo — Índice de Failure Modes

| # | Nome | Severidade | Detecção | Prevenção Principal |
|---|---|---|---|---|
| FM-01 | HPA Flapping | Médio | `changes(replicas[30m]) > 4` | stabilizationWindowSeconds |
| FM-02 | HPA vs KEDA Conflict | Alto | Script de cruzamento | Kyverno policy |
| FM-03 | VPA Resize em Pico | Médio | VPA events | Modo Initial |
| FM-04 | Karpenter Provisioning Lag | Alto | Pods Pending > 180s | Overprovisioning buffer |
| FM-05 | PDB Bloqueando Scale-Down | Baixo | DISRUPTIONS ALLOWED = 0 | maxUnavailable vs minAvailable |
| FM-06 | Readiness Probe Lenta | Alto | Pods Running not Ready | startupProbe |
| FM-07 | KEDA Scrape Interval Alto | Médio | Queue crescendo sem scale | pollingInterval 15s |
| FM-08 | Thrash por Cooldown Curto | Médio | Rate de mudanças replicas | cooldownPeriod adequado |
| FM-09 | DLQ sem Scale-Up | Alto | DLQ delta > 5 | KEDA para DLQ worker |
| FM-10 | Over-scaling por Métrica Ruidosa | Baixo | Scale sem causa de negócio | avg_over_time nas queries |
| FM-11 | Scale-Down com Sessões Ativas | Alto | 502 correlacionado com scale-down | preStop hook |
| FM-12 | Memory Throttling Mascarado | Médio | OOMKilled events | limits.memory adequado |
| FM-13 | KEDA Metrics Server Down | Alto | keda_scaler_errors_total > 0 | HA Prometheus + network policy |
| FM-14 | Spot Eviction em Cascata | Médio | Rate de terminação > 0.3/min | Diversidade de instâncias |
| FM-15 | Validation Queue Congestion | Alto | Workflows > 1h em running | Timeout + escalada automática |
| FM-16 | Scheduling Delay Anti-Affinity | Médio | Pods Pending anti-affinity | Soft anti-affinity |
| FM-17 | CPU Throttling sem Scale | Alto | Throttling > 25% | Omitir CPU limit |
| FM-18 | Liveness Probe Mata GC | Médio | Pod restarts > 3 | timeoutSeconds + failureThreshold |
| FM-19 | Temporal Worker Scale-Down | Médio | Workflow failures por worker | On-Demand + PDB |
| FM-20 | KEDA ScaledObject Órfão | Baixo | Script de verificação | ownerReferences |

---

*Este documento é atualizado sempre que um novo failure mode é identificado em produção ou em testes de chaos engineering.*
