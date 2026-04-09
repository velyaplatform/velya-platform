# Estratégia de NodePool e NodeClass para EKS — Velya

**Versão:** 1.0  
**Domínio:** Infraestrutura de Compute  
**Classificação:** Documento de Referência Técnica  
**Data:** 2026-04-08

---

## Visão Geral

A Velya usa Karpenter para provisionamento automático de nós em EKS. Cada NodePool é declarado explicitamente com família de instâncias, tipo de capacidade, política de disruption e taints/tolerations.

**Princípios:**

1. NodePool por classe de workload — não um NodePool genérico
2. Spot onde tolerável, On-Demand onde crítico
3. Consolidação agressiva em batch, conservadora em realtime
4. PDB obrigatório antes de habilitar consolidação

---

## NodeClass Base (EKS Auto Mode)

```yaml
apiVersion: eks.amazonaws.com/v1
kind: NodeClass
metadata:
  name: velya-base-nodeclass
spec:
  # EKS Auto Mode usa AMI gerenciada pela AWS
  # Não é necessário especificar AMI — EKS gerencia

  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: velya-prod
        kubernetes.io/role/internal-elb: '1'

  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: velya-prod

  instanceProfile: 'KarpenterNodeInstanceProfile-velya-prod'

  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 50Gi
        volumeType: gp3
        iops: 3000
        throughput: 125
        encrypted: true
        kmsKeyID: 'arn:aws:kms:us-east-1:ACCOUNT_ID:key/KEY_ID'

  tags:
    Environment: production
    ManagedBy: karpenter
    Platform: velya
    CostCenter: infrastructure

---
# NodeClass para nós com storage expandido (DB, observabilidade)
apiVersion: eks.amazonaws.com/v1
kind: NodeClass
metadata:
  name: velya-storage-nodeclass
spec:
  subnetSelectorTerms:
    - tags:
        karpenter.sh/discovery: velya-prod
        kubernetes.io/role/internal-elb: '1'

  securityGroupSelectorTerms:
    - tags:
        karpenter.sh/discovery: velya-prod

  instanceProfile: 'KarpenterNodeInstanceProfile-velya-prod'

  blockDeviceMappings:
    - deviceName: /dev/xvda
      ebs:
        volumeSize: 200Gi
        volumeType: gp3
        iops: 6000
        throughput: 250
        encrypted: true

  tags:
    Environment: production
    ManagedBy: karpenter
    StorageTier: high
```

---

## NodePool 1: system-critical

### Propósito

Nós dedicados para componentes de plataforma críticos: Temporal, NATS JetStream, Redis, CoreDNS, Karpenter em si.

### Instance Families

| Família    | Razão                                                        |
| ---------- | ------------------------------------------------------------ |
| m7i.xlarge | General purpose, EBS otimizado                               |
| m6i.xlarge | Geração anterior, mais barato                                |
| m7g.xlarge | ARM (Graviton3), custo ~20% menor, verificar compatibilidade |

### Configuração Karpenter NodePool

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-system-critical
spec:
  template:
    metadata:
      labels:
        velya.io/node-pool: system-critical
        velya.io/workload-class: system
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: velya-base-nodeclass

      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ['amd64'] # amd64 apenas para compatibilidade máxima
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['on-demand'] # NUNCA Spot para críticos
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - m7i.xlarge
            - m6i.xlarge
            - m6a.xlarge
        - key: topology.kubernetes.io/zone
          operator: In
          values: ['us-east-1a', 'us-east-1b', 'us-east-1c']

      taints:
        - key: velya.io/system-critical
          value: 'true'
          effect: NoSchedule

      expireAfter: 720h # Rotação de nó a cada 30 dias

  disruption:
    consolidationPolicy: WhenEmptyAndUnderutilized
    consolidateAfter: Never # NUNCA consolidar nós com pods críticos
    budgets:
      - nodes: '0%' # Não interromper nenhum nó deste pool voluntariamente

  limits:
    cpu: 32 # Máx 8 nós m6i.xlarge (4 vCPUs cada)
    memory: 128Gi

  weight: 100 # Alta prioridade no scheduling de nós
```

### PDB Requirements

Todos os pods neste pool DEVEM ter PDB configurado:

- Temporal: `minAvailable: 2` (cluster 3 nós)
- NATS: `minAvailable: 2` (cluster 3 nós)
- Redis: `minAvailable: 1` (sentinels)

### Expected Utilization

| Métrica            | Target              |
| ------------------ | ------------------- |
| CPU utilization    | 40-60%              |
| Memory utilization | 50-70%              |
| Nós provisionados  | 3 fixos (On-Demand) |

### Cost Envelope

- 3x m6i.xlarge On-Demand: ~$435/mês
- Storage EBS: ~$30/mês
- **Total: ~$465/mês**

---

## NodePool 2: realtime-app

### Propósito

Nós para serviços de aplicação que servem tráfego HTTP em tempo real: api-gateway, patient-flow-service, task-inbox-service, velya-web.

### Instance Families

| Família    | vCPU | RAM  | Custo OD/h | Razão                                          |
| ---------- | ---- | ---- | ---------- | ---------------------------------------------- |
| c7i.xlarge | 4    | 8 GB | ~$0.179    | Compute-optimized, excelente para HTTP         |
| c6i.xlarge | 4    | 8 GB | ~$0.170    | Geração anterior, mais barato                  |
| c7g.xlarge | 4    | 8 GB | ~$0.145    | Graviton3, mais barato, testar compatibilidade |
| m6i.large  | 2    | 8 GB | ~$0.096    | Para pods menores                              |

### Configuração Karpenter NodePool

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-realtime-app
spec:
  template:
    metadata:
      labels:
        velya.io/node-pool: realtime-app
        velya.io/workload-class: realtime-request-serving
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: velya-base-nodeclass

      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['on-demand'] # On-Demand para SLO de latência
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - c7i.xlarge
            - c7i.2xlarge
            - c6i.xlarge
            - c6i.2xlarge
            - c7g.xlarge
            - c7g.2xlarge
            - m6i.large
            - m6i.xlarge
        - key: topology.kubernetes.io/zone
          operator: In
          values: ['us-east-1a', 'us-east-1b', 'us-east-1c']

      taints:
        - key: velya.io/realtime
          value: 'true'
          effect: NoSchedule

  disruption:
    consolidationPolicy: WhenEmptyAndUnderutilized
    consolidateAfter: 10m # Consolidar após 10min se subutilizado
    budgets:
      - nodes: '10%' # Max 10% dos nós interrompidos simultaneamente
        schedule: '0 * * * *' # Verificar a cada hora
        duration: 30m
      - nodes: '0%' # Zero interrupção em horário de pico
        schedule: '0 7-19 * * 1-5' # Horário comercial, dias úteis
        duration: 12h

  limits:
    cpu: 128 # ~32 nós c7i.xlarge
    memory: 256Gi

  weight: 90
```

### Affinity Rules para Workloads

```yaml
# Workloads realtime devem especificar:
affinity:
  nodeAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      nodeSelectorTerms:
        - matchExpressions:
            - key: velya.io/node-pool
              operator: In
              values: ['realtime-app']

  podAntiAffinity:
    requiredDuringSchedulingIgnoredDuringExecution:
      - labelSelector:
          matchLabels:
            app: api-gateway
        topologyKey: kubernetes.io/hostname # Máximo 1 pod por nó
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchLabels:
              app: api-gateway
          topologyKey: topology.kubernetes.io/zone # Distribuir por AZ
```

### Expected Utilization

| Métrica            | Target                       |
| ------------------ | ---------------------------- |
| CPU utilization    | 50-65% (headroom para picos) |
| Memory utilization | 60-75%                       |
| Nós em baseline    | 3-5                          |
| Nós em pico        | 10-15                        |

### Cost Envelope

- Baseline 4x c7i.xlarge OD: ~$513/mês
- Pico adicional (Spot não usado aqui): +$300/mês
- **Total estimado: ~$600-900/mês**

---

## NodePool 3: async-workers

### Propósito

Workers event-driven que processam filas NATS. Podem ser Spot — são stateless e toleram interrupção (NATS reentrega a mensagem).

### Instance Families

| Família   | Razão                                     |
| --------- | ----------------------------------------- |
| m6i.large | General purpose, bom custo                |
| m7g.large | Graviton3 Spot, muito barato              |
| c6i.large | Compute-optimized para workers intensivos |
| t3.large  | Burstable para workers com carga variável |

### Configuração Karpenter NodePool

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-async-workers
spec:
  template:
    metadata:
      labels:
        velya.io/node-pool: async-workers
        velya.io/workload-class: async-worker
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: velya-base-nodeclass

      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['spot', 'on-demand'] # Spot preferido
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - m6i.large
            - m6i.xlarge
            - m7g.large
            - m7g.xlarge
            - c6i.large
            - c6i.xlarge
            - t3.large
            - t3.xlarge

      taints:
        - key: velya.io/async-worker
          value: 'true'
          effect: NoSchedule
        - key: spot
          value: 'true'
          effect: NoSchedule

  disruption:
    consolidationPolicy: WhenEmptyAndUnderutilized
    consolidateAfter: 5m # Consolidação agressiva — Spot é barato mas faz scaling
    budgets:
      - nodes: '30%' # Pode interromper até 30% simultaneamente

  limits:
    cpu: 256
    memory: 512Gi

  weight: 70
```

### Expected Utilization

| Métrica               | Target                         |
| --------------------- | ------------------------------ |
| CPU utilization       | 60-75% (workers são CPU-bound) |
| Memory utilization    | 40-60%                         |
| Spot savings estimado | 60-70% vs On-Demand            |
| Scale-to-zero         | Não (min 1 worker ativo)       |

### Cost Envelope

- Baseline 3x m6i.large Spot: ~$50/mês
- Pico 15x nós Spot: ~$250/mês
- **Total estimado: ~$50-250/mês (Spot savings ativo)**

---

## NodePool 4: scheduled-batch

### Propósito

CronJobs e Argo Workflows. Podem escalar para zero entre execuções. Spot fortemente preferido.

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-scheduled-batch
spec:
  template:
    metadata:
      labels:
        velya.io/node-pool: scheduled-batch
        velya.io/workload-class: scheduled
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: velya-base-nodeclass

      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['spot'] # Spot apenas para batch — custo mínimo
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - m6i.large
            - m7g.large
            - m7g.xlarge
            - c6g.large
            - c6g.xlarge
            - r6g.large # Memory-optimized para jobs de processamento

      taints:
        - key: velya.io/batch
          value: 'true'
          effect: NoSchedule
        - key: spot
          value: 'true'
          effect: NoSchedule

  disruption:
    consolidationPolicy: WhenEmpty # Só consolida quando vazio — job em execução não interrompe
    consolidateAfter: 2m

  limits:
    cpu: 128
    memory: 256Gi

  weight: 50
```

---

## NodePool 5: agent-runtime

### Propósito

AI agents que rodam como pods Kubernetes. Chamadas para LLM API (Anthropic), processamento de contexto, tool calls. CPU-bound para serialização/parsing, I/O-bound para LLM calls.

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-agent-runtime
spec:
  template:
    metadata:
      labels:
        velya.io/node-pool: agent-runtime
        velya.io/workload-class: async-worker
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: velya-base-nodeclass

      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['spot', 'on-demand']
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - m6i.xlarge # 4 vCPU, 16 GB — bom para agent com contexto grande
            - m7i.xlarge
            - m7g.xlarge # Graviton — I/O bound se beneficia bem
            - c6i.xlarge # Para agents CPU-intensivos
            - r6i.large # Memory-optimized para contexto grande (32 GB)

      taints:
        - key: velya.io/agent-runtime
          value: 'true'
          effect: NoSchedule

  disruption:
    consolidationPolicy: WhenEmptyAndUnderutilized
    consolidateAfter: 15m # Agents podem ter tarefas longas — esperar mais
    budgets:
      - nodes: '20%'

  limits:
    cpu: 64
    memory: 256Gi

  weight: 60
```

### Notas Especiais para Agent Runtime

- **preStop hook obrigatório**: agents devem ter hook de 60s para concluir a chamada LLM em andamento antes de SIGTERM
- **KEDA scale-to-zero**: agents de baixa prioridade escalam para zero quando sem tarefas
- **Budget annotation**: todo deployment de agent deve ter `velya.io/token-budget-daily`

---

## NodePool 6: heavy-ai-analytics

### Propósito

Jobs de análise intensiva, modelos de ML, batch inference. No futuro: GPU nodes para modelos locais.

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-heavy-ai-analytics
spec:
  template:
    metadata:
      labels:
        velya.io/node-pool: heavy-ai-analytics
        velya.io/workload-class: heavy-analytics-ai
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: velya-base-nodeclass

      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['spot'] # Sempre Spot — jobs toleram preempção com Temporal
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - c6i.2xlarge # 8 vCPU, 16 GB
            - c6i.4xlarge # 16 vCPU, 32 GB
            - c7g.2xlarge # Graviton3, excelente para analytics
            - c7g.4xlarge
            - r6g.xlarge # Memory-optimized para datasets grandes
            - r6g.2xlarge
          # GPU (futuro):
          # - g4dn.xlarge    # NVIDIA T4 — inferência
          # - g5.xlarge      # NVIDIA A10G — inferência/treino

      taints:
        - key: velya.io/heavy-analytics
          value: 'true'
          effect: NoSchedule
        - key: spot
          value: 'true'
          effect: NoSchedule

  disruption:
    consolidationPolicy: WhenEmpty # Não interromper jobs em execução
    consolidateAfter: 5m
    budgets:
      - nodes: '100%' # Pode terminar todos se vazios

  limits:
    cpu: 256
    memory: 1Ti # Headroom para grandes datasets

  weight: 40
```

---

## NodePool 7: observability

### Propósito

Nós dedicados para Prometheus, Grafana, Loki, Tempo. Separação evita que picos de telemetria afetem workloads de aplicação.

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-observability
spec:
  template:
    metadata:
      labels:
        velya.io/node-pool: observability
        velya.io/workload-class: continuous-sentinel
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: velya-storage-nodeclass # NodeClass com disco maior (200 GB)

      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['on-demand'] # Observabilidade não pode perder dados por Spot eviction
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - m6i.2xlarge # 8 vCPU, 32 GB — Prometheus é memory-hungry
            - m7i.2xlarge
            - r6i.large # Memory-optimized — para Loki/Prometheus com TSDB grande
            - r6i.xlarge
            - r7g.large # Graviton memory-optimized

      taints:
        - key: velya.io/observability
          value: 'true'
          effect: NoSchedule

  disruption:
    consolidationPolicy: WhenEmptyAndUnderutilized
    consolidateAfter: Never # Não consolidar — TSDB em PVC pode ser lento para reattach
    budgets:
      - nodes: '0%' # Nunca interromper voluntariamente

  limits:
    cpu: 32
    memory: 256Gi

  weight: 80
```

### PDB para Observabilidade

```yaml
# Prometheus
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

---
# Loki (distribuído)
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: loki-ingester-pdb
  namespace: velya-dev-observability
spec:
  maxUnavailable: 1
  selector:
    matchLabels:
      app: loki
      component: ingester
```

---

## NodePool 8: platform-ops

### Propósito

Ferramentas de operação de plataforma: ArgoCD, cert-manager, External Secrets Operator, Kyverno, metrics-server.

```yaml
apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: velya-platform-ops
spec:
  template:
    metadata:
      labels:
        velya.io/node-pool: platform-ops
    spec:
      nodeClassRef:
        group: eks.amazonaws.com
        kind: NodeClass
        name: velya-base-nodeclass

      requirements:
        - key: karpenter.sh/capacity-type
          operator: In
          values: ['on-demand'] # Ferramentas de plataforma são On-Demand
        - key: node.kubernetes.io/instance-type
          operator: In
          values:
            - m6i.large
            - m7g.large
            - t3.large # Burstable OK para componentes de plataforma

      taints:
        - key: velya.io/platform-ops
          value: 'true'
          effect: NoSchedule

  disruption:
    consolidationPolicy: WhenEmptyAndUnderutilized
    consolidateAfter: 30m
    budgets:
      - nodes: '10%'

  limits:
    cpu: 16
    memory: 64Gi

  weight: 75
```

---

## Tabela Resumo de NodePools

| NodePool           | Famílias Preferidas | Capacity    | Consolidação | Disruption Budget           | PDB         | Utilização Target | Custo/mês |
| ------------------ | ------------------- | ----------- | ------------ | --------------------------- | ----------- | ----------------- | --------- |
| system-critical    | m7i, m6i            | On-Demand   | Never        | 0%                          | Obrigatório | 40-60%            | ~$465     |
| realtime-app       | c7i, c6i, c7g       | On-Demand   | 10min        | 10% (fora pico) / 0% (pico) | Obrigatório | 50-65%            | ~$600-900 |
| async-workers      | m6i, m7g, c6i       | Spot + OD   | 5min         | 30%                         | Preferido   | 60-75%            | ~$50-250  |
| scheduled-batch    | m7g, c6g, r6g       | Spot apenas | WhenEmpty    | N/A                         | N/A         | 40-80%            | ~$20-100  |
| agent-runtime      | m6i, m7g, r6i       | Spot + OD   | 15min        | 20%                         | Recomendado | 50-70%            | ~$100-300 |
| heavy-ai-analytics | c7g, c6i, r6g       | Spot apenas | WhenEmpty    | N/A                         | N/A         | 60-80%            | ~$50-200  |
| observability      | m6i, r6i, r7g       | On-Demand   | Never        | 0%                          | Obrigatório | 50-70%            | ~$300-500 |
| platform-ops       | m6i, t3             | On-Demand   | 30min        | 10%                         | Recomendado | 30-50%            | ~$100-150 |

**Total estimado EKS prod:** ~$1.685-2.865/mês (compute apenas)

---

## Taints e Tolerations por NodePool

```yaml
# Referência completa de taints por NodePool

# system-critical
taints:
  - key: velya.io/system-critical
    value: 'true'
    effect: NoSchedule

# Toleração correspondente nos pods
tolerations:
  - key: velya.io/system-critical
    operator: Equal
    value: 'true'
    effect: NoSchedule

---
# realtime-app
taints:
  - key: velya.io/realtime
    value: 'true'
    effect: NoSchedule

tolerations:
  - key: velya.io/realtime
    operator: Equal
    value: 'true'
    effect: NoSchedule

---
# async-workers + spot
taints:
  - key: velya.io/async-worker
    value: 'true'
    effect: NoSchedule
  - key: spot
    value: 'true'
    effect: NoSchedule

tolerations:
  - key: velya.io/async-worker
    operator: Equal
    value: 'true'
    effect: NoSchedule
  - key: spot
    operator: Equal
    value: 'true'
    effect: NoSchedule

---
# scheduled-batch + spot
taints:
  - key: velya.io/batch
    value: 'true'
    effect: NoSchedule
  - key: spot
    value: 'true'
    effect: NoSchedule

tolerations:
  - key: velya.io/batch
    operator: Exists
    effect: NoSchedule
  - key: spot
    operator: Equal
    value: 'true'
    effect: NoSchedule
```

---

## Estratégia de Migração: kind-velya-local → EKS

### Fase 1: Validação em kind (Atual)

No kind-velya-local, todos os pods rodam em 3 nós sem differentiation de NodePool. As labels de workload-class são aplicadas mas sem taints/tolerations efetivos.

```bash
# Verificar nós atuais em kind
kubectl get nodes -o wide

# Verificar distribuição de pods por nó
kubectl get pods -A -o wide | awk '{print $8}' | sort | uniq -c
```

### Fase 2: EKS Staging — NodePools Simplificados

Em staging, usar apenas 4 NodePools:

- `system-critical` (On-Demand)
- `app-general` (On-Demand, fusão de realtime-app + platform-ops)
- `workers-batch` (Spot, fusão de async-workers + batch)
- `observability` (On-Demand)

### Fase 3: EKS Produção — NodePools Completos

Implementar os 8 NodePools conforme este documento.

---

## Monitoramento de NodePools

### Métricas Prometheus

```yaml
# Alertas de NodePool
groups:
  - name: karpenter-nodepool-alerts
    rules:
      - alert: NodePoolUtilizationHigh
        expr: |
          karpenter_nodepool_usage_requests{resource="cpu"} /
          karpenter_nodepool_limit{resource="cpu"} > 0.85
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: 'NodePool {{ $labels.nodepool }} com CPU utilization > 85%'
          description: 'Considerar aumentar limits do NodePool ou revisar workloads'

      - alert: NodePoolLimitReached
        expr: |
          karpenter_nodepool_usage_requests{resource="cpu"} /
          karpenter_nodepool_limit{resource="cpu"} >= 1.0
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: 'NodePool {{ $labels.nodepool }} atingiu o limite!'
          description: 'Pods podem estar pendentes. Aumentar limits ou revisar workloads urgentemente.'

      - alert: SpotEvictionRateHigh
        expr: |
          rate(karpenter_nodes_termination_time_seconds_count{
            nodepool=~".*async.*|.*batch.*|.*heavy.*"
          }[30m]) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: 'Alta taxa de eviction Spot no NodePool {{ $labels.nodepool }}'
```

---

_Esta estratégia é revisada a cada trimestre ou quando novas famílias de instâncias AWS são lançadas com melhor custo/benefício._
