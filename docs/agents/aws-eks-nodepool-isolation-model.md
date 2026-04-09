# Modelo de Isolamento por NodePool — AWS EKS (Simulado em kind-velya-local)

**Versão:** 1.0  
**Cluster Alvo:** AWS EKS (simulado localmente com kind-velya-local)  
**Provisionador:** Karpenter  
**Última revisão:** 2026-04-08  

---

## 1. Por que Isolar por NodePool

A Velya opera workloads com características radicalmente diferentes:
- Um sentinel agent precisa de resposta em < 100ms mas usa < 50m CPU
- Um batch de AI analytics pode usar 4 vCPUs por 30 minutos e depois ficar ocioso
- Um serviço clínico de missão crítica não pode ser co-locado com um batch que pode causar CPU throttling

Sem isolamento por NodePool:
- Workloads de batch competem por CPU com serviços clínicos críticos
- Spot instances de workloads não-críticos causam evictions de pods críticos
- Custo de nodes grandes desperdiçado com pods pequenos

Com isolamento por NodePool (Karpenter):
- Cada categoria de workload vai para nodes adequados
- Spot instances apenas onde tolerável
- Tamanho de node otimizado por perfil de workload
- Disrupção limitada por categoria

---

## 2. Categorias de NodePool

### 2.1 Categoria: system-critical

**Propósito:** Componentes críticos do cluster que não podem ser interrompidos.  
**Workloads:** CoreDNS, kube-proxy, metrics-server, cert-manager, external-secrets-operator  
**Separação física:** Obrigatória — nenhum workload de aplicação neste pool

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: system-critical
spec:
  template:
    metadata:
      labels:
        velya.io/node-class: system-critical
    spec:
      nodeClassRef:
        apiVersion: karpenter.k8s.aws/v1beta1
        kind: EC2NodeClass
        name: system-critical-class
      
      taints:
        - key: "velya.io/node-class"
          value: "system-critical"
          effect: NoSchedule
      
      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]   # NUNCA spot para componentes críticos
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - "m5.large"           # 2 vCPU, 8GB RAM
            - "m5.xlarge"          # 4 vCPU, 16GB RAM
      
      expireAfter: "720h"        # Rotate nodes a cada 30 dias
  
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: "Never"  # Nunca consolidar nodes críticos automaticamente
    budgets:
      - nodes: "0"             # Nenhum node do pool pode ser disruptado em condições normais
  
  limits:
    cpu: 8
    memory: 32Gi

---
apiVersion: karpenter.k8s.aws/v1beta1
kind: EC2NodeClass
metadata:
  name: system-critical-class
spec:
  amiFamily: AL2023
  subnetSelectorTerms:
    - tags:
        velya.io/subnet-type: private
  securityGroupSelectorTerms:
    - tags:
        velya.io/node-class: system-critical
  instanceProfile: "VelyaSystemCriticalNodeProfile"
  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 50Gi
        volumeType: gp3
        encrypted: true
```

**Cost Envelope:** $100-200/mês (2-3 nodes m5.large permanentes)

---

### 2.2 Categoria: realtime-app

**Propósito:** Serviços de aplicação com SLA de latência rigoroso.  
**Workloads:** api-gateway, patient-flow-service, task-inbox-service, velya-web, ai-gateway  
**Requisito crítico:** Latência P99 < 200ms, zero tolerância a spot interruptions

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: realtime-app
spec:
  template:
    metadata:
      labels:
        velya.io/node-class: realtime-app
    spec:
      nodeClassRef:
        name: realtime-app-class
      
      taints:
        - key: "velya.io/node-class"
          value: "realtime-app"
          effect: NoSchedule
      
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - "m6i.large"          # 2 vCPU, 8GB
            - "m6i.xlarge"         # 4 vCPU, 16GB
            - "m6i.2xlarge"        # 8 vCPU, 32GB
            - "m5.large"           # Fallback
            - "m5.xlarge"
      
      expireAfter: "336h"        # Rotate a cada 14 dias
  
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: "30m"
    budgets:
      - nodes: "10%"           # Max 10% dos nodes podem ser disruptados por vez
        schedule: "0 2 * * *"  # Apenas às 2h UTC
        duration: "2h"
  
  limits:
    cpu: 32
    memory: 128Gi
```

**Tolerations para pods neste pool:**
```yaml
tolerations:
  - key: "velya.io/node-class"
    operator: "Equal"
    value: "realtime-app"
    effect: "NoSchedule"

nodeSelector:
  velya.io/node-class: realtime-app
```

**Cost Envelope:** $400-800/mês (3-6 nodes m6i.large/xlarge)

---

### 2.3 Categoria: async-workers

**Propósito:** Workers de processamento assíncrono escalados por KEDA.  
**Workloads:** task-inbox-worker, discharge-worker, validation-worker, audit-recorder  
**Característica:** Podem tolerar spot interruptions (NATS garante re-entrega)

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: async-workers
spec:
  template:
    spec:
      nodeClassRef:
        name: async-workers-class
      
      taints:
        - key: "velya.io/node-class"
          value: "async-workers"
          effect: NoSchedule
      
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]   # Prefere spot, fallback on-demand
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - "m5.large"
            - "m5.xlarge"
            - "m5a.large"
            - "m6i.large"
            - "m6a.large"
            - "r5.large"           # Memory-optimized para workers com cache
  
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: "5m"    # Consolidar nodes subutilizados rapidamente
    budgets:
      - nodes: "30%"          # 30% podem ser disruptados (NATS garante re-delivery)
  
  limits:
    cpu: 64
    memory: 256Gi
```

**Cost Envelope:** $200-600/mês (5-15 nodes spot m5.large, ~70% desconto vs on-demand)  
**Saving vs on-demand:** ~60-70% de economia em nodes spot

---

### 2.4 Categoria: scheduled-batch

**Propósito:** Jobs agendados (CronJobs) com execução periódica e sem SLA de latência.  
**Workloads:** cost-sweep-batch, daily-report, market-intel-sweep, audit-batch  
**Característica:** Podem esperar por nodes spot disponíveis, zero urgência de início

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: scheduled-batch
spec:
  template:
    spec:
      nodeClassRef:
        name: batch-class
      
      taints:
        - key: "velya.io/node-class"
          value: "scheduled-batch"
          effect: NoSchedule
      
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]      # APENAS spot — batch tolera interruption
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - "m5.large"
            - "m5.xlarge"
            - "m5.2xlarge"
            - "m6i.large"
            - "c5.xlarge"       # Compute-optimized para batch intensivo
            - "c5.2xlarge"
  
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: "1m"    # Consolidar agressivamente — batch pode reiniciar
    budgets:
      - nodes: "100%"         # Todos os nodes podem ser disruptados
  
  limits:
    cpu: 32
    memory: 64Gi

  # Escalar a zero quando não há jobs rodando
  # CronJob pods são scheduled conforme necessário
```

**Cost Envelope:** $50-200/mês (nodes spot, escalam apenas durante execução de jobs)

---

### 2.5 Categoria: agent-runtime

**Propósito:** Agents de IA em execução contínua (Sentinels, Watchdogs, Learning Agents).  
**Workloads:** ops-watchdog, meta-watchdog, heartbeat-monitor, learning-office-agent  
**Característica:** Execução contínua mas não missão crítica — podem ser movidos com algum delay

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: agent-runtime
spec:
  template:
    spec:
      taints:
        - key: "velya.io/node-class"
          value: "agent-runtime"
          effect: NoSchedule
      
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - "t3.medium"     # 2 vCPU, 4GB — agents leves
            - "t3.large"      # 2 vCPU, 8GB
            - "t3a.medium"
            - "t3a.large"
            - "m5.large"      # Fallback para agents mais pesados
  
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: "10m"
    budgets:
      - nodes: "20%"
  
  limits:
    cpu: 16
    memory: 64Gi
```

**Cost Envelope:** $100-300/mês (mix spot e on-demand, instâncias médias)

---

### 2.6 Categoria: heavy-ai-analytics

**Propósito:** Jobs de análise pesada com uso intensivo de CPU/memória ou GPU (futuro).  
**Workloads:** discharge-orchestrator com LLM heavy, cost-analytics-deep, model-fine-tuning (futuro)  
**Característica:** Spot com bid configurado, podem ser interrompidos

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: heavy-ai-analytics
spec:
  template:
    spec:
      taints:
        - key: "velya.io/node-class"
          value: "heavy-ai-analytics"
          effect: NoSchedule
      
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - "c5.4xlarge"    # 16 vCPU, 32GB — compute intensivo
            - "c5.9xlarge"    # 36 vCPU, 72GB
            - "c5a.4xlarge"
            - "m5.4xlarge"    # 16 vCPU, 64GB — memory + compute
            - "r5.4xlarge"    # 16 vCPU, 128GB — memory heavy
      
      expireAfter: "24h"    # Jobs de analytics não devem ter vida longa
  
  disruption:
    consolidationPolicy: WhenEmpty
    consolidateAfter: "1m"
    budgets:
      - nodes: "100%"
  
  limits:
    cpu: 128
    memory: 512Gi
```

**Cost Envelope:** $0 (escala a zero) até $500/mês durante uso intenso. Spot pricing.

---

### 2.7 Categoria: observability

**Propósito:** Stack de observabilidade (Prometheus, Grafana, Loki, Tempo).  
**Workloads:** prometheus, grafana, loki, tempo, alertmanager  
**Característica:** Precisa de storage persistente e estabilidade de node (Loki e Tempo têm estado)

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: observability
spec:
  template:
    spec:
      taints:
        - key: "velya.io/node-class"
          value: "observability"
          effect: NoSchedule
      
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]   # On-demand: Prometheus/Loki têm estado
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - "m5.xlarge"         # 4 vCPU, 16GB — Prometheus precisa de memória
            - "m5.2xlarge"        # 8 vCPU, 32GB
            - "r5.xlarge"         # 4 vCPU, 32GB — memory-optimized para Loki
            - "r5.2xlarge"        # 8 vCPU, 64GB
  
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: "Never"  # Não disruptar nodes de observabilidade automaticamente
    budgets:
      - nodes: "0"             # Nunca disruptar automaticamente
  
  limits:
    cpu: 24
    memory: 128Gi
```

**Cost Envelope:** $200-500/mês (2-3 nodes on-demand r5.xlarge)

---

### 2.8 Categoria: platform-ops

**Propósito:** Ferramentas de plataforma e operações (ArgoCD, KEDA operator, ingress controller).  
**Workloads:** argocd-server, argocd-application-controller, keda-operator, ingress-nginx, cert-manager  

```yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: platform-ops
spec:
  template:
    spec:
      taints:
        - key: "velya.io/node-class"
          value: "platform-ops"
          effect: NoSchedule
      
      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["on-demand"]
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - "t3.large"
            - "t3.xlarge"
            - "m5.large"
            - "m5.xlarge"
  
  disruption:
    consolidationPolicy: WhenEmptyOrUnderutilized
    consolidateAfter: "30m"
    budgets:
      - nodes: "10%"
        schedule: "0 2 * * *"
        duration: "1h"
  
  limits:
    cpu: 16
    memory: 64Gi
```

**Cost Envelope:** $100-200/mês (2-3 nodes t3.large on-demand)

---

## 3. Tabela Consolidada de NodePools

| NodePool | Instance Family | Capacity Type | Disruption | Max Scale | Cost Envelope/mês |
|---|---|---|---|---|---|
| system-critical | m5/m6i large | on-demand | Never | 8 CPU / 32GB | $100-200 |
| realtime-app | m6i/m5 large-2xlarge | on-demand | 10% / 2h UTC | 32 CPU / 128GB | $400-800 |
| async-workers | m5/m6i/r5 large | spot+on-demand | 30% | 64 CPU / 256GB | $200-600 |
| scheduled-batch | m5/c5 large-2xlarge | spot | 100% | 32 CPU / 64GB | $50-200 |
| agent-runtime | t3/m5 medium-large | spot+on-demand | 20% | 16 CPU / 64GB | $100-300 |
| heavy-ai-analytics | c5/r5 4xlarge | spot | 100% | 128 CPU / 512GB | $0-500 |
| observability | m5/r5 xlarge-2xlarge | on-demand | Never | 24 CPU / 128GB | $200-500 |
| platform-ops | t3/m5 large | on-demand | 10% | 16 CPU / 64GB | $100-200 |

**Total estimado dev:** $1.150-3.300/mês  
**Total estimado prod (3 AZs):** $3.500-10.000/mês

---

## 4. Configuração Local (kind-velya-local)

No ambiente local, os NodePools são simulados via node labels e taints manuais:

```bash
# Configurar nós do kind com labels de NodePool
kubectl label node velya-local-control-plane velya.io/node-class=system-critical
kubectl label node velya-local-worker velya.io/node-class=realtime-app
kubectl label node velya-local-worker2 velya.io/node-class=async-workers

# Adicionar taints para isolamento
kubectl taint node velya-local-worker velya.io/node-class=realtime-app:NoSchedule
kubectl taint node velya-local-worker2 velya.io/node-class=async-workers:NoSchedule
```

**Nota:** No kind local, os 3 nós simulam os 8 NodePools com isolamento por namespace e ResourceQuota ao invés de nodes separados. A configuração real de Karpenter é aplicada apenas no EKS.

---

## 5. Affinity e Anti-Affinity

### 5.1 Affinity por NodePool

```yaml
# Affinity para realtime-app (api-gateway)
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: velya.io/node-class
              operator: In
              values: ["realtime-app"]
  
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app.kubernetes.io/name: api-gateway
          topologyKey: kubernetes.io/hostname
```

### 5.2 Spread de Pods Entre Zones

```yaml
# Para serviços críticos no EKS (3 AZs)
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app.kubernetes.io/name: api-gateway
```

---

## 6. PodDisruptionBudgets por Categoria

```yaml
# PDB para serviços realtime-app
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: api-gateway-pdb
  namespace: velya-dev-core
spec:
  minAvailable: 1   # Pelo menos 1 réplica sempre disponível
  selector:
    matchLabels:
      app.kubernetes.io/name: api-gateway
---
# PDB para observabilidade (Prometheus)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: prometheus-pdb
  namespace: velya-dev-observability
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: prometheus
```
