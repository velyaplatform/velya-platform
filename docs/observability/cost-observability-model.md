# Modelo de Observabilidade de Custo — Velya Platform

> O custo de observabilidade, infraestrutura e AI são monitorados como qualquer outro sinal técnico.
> Custo descontrolado de observabilidade derrota seu próprio propósito.
> Última atualização: 2026-04-08

---

## 1. Categorias de Custo a Monitorar

### 1.1 Stack de Observabilidade

| Recurso                  | Métrica de custo                                 | Meta                             | Alerta                              |
| ------------------------ | ------------------------------------------------ | -------------------------------- | ----------------------------------- |
| Cardinalidade Prometheus | `prometheus_tsdb_head_series`                    | < 1M series                      | > 800K (warning), > 950K (critical) |
| Volume de ingestion Loki | `rate(loki_ingester_bytes_received_total[24h])`  | < 10 GB/dia                      | > 15 GB/dia (warning)               |
| Volume de traces Tempo   | `rate(tempo_ingester_bytes_received_total[24h])` | < 5 GB/dia (quando implementado) | > 8 GB/dia (warning)                |
| Storage Prometheus       | `prometheus_tsdb_storage_blocks_bytes`           | < 50 GB                          | > 50 GB crescendo (warning)         |
| Overhead de profiling    | CPU do Pyroscope vs. CPU total                   | < 2%                             | > 3% (warning)                      |

### 1.2 Infraestrutura Kubernetes

| Recurso                                      | Métrica                                                                            | Meta                      | Alerta                                 |
| -------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------- | -------------------------------------- |
| CPU request vs. uso real (over-provisioning) | `container_cpu_usage / kube_pod_container_resource_requests{resource="cpu"}`       | > 40% de utilização       | < 20% por > 1h (pod ociosa)            |
| Memória request vs. uso real                 | `container_memory_usage / kube_pod_container_resource_requests{resource="memory"}` | > 50% de utilização       | < 20% por > 6h                         |
| KEDA scale-up eventos por hora               | `changes(kube_deployment_spec_replicas[1h])` por deployment                        | < 6 eventos/hora          | > 20 eventos/hora (thrash)             |
| Pods ociosos                                 | CPU < 20% do request por > 1h                                                      | Zero pods ociosos em prod | > 3 pods ociosos em qualquer namespace |

### 1.3 AI e Inferência

| Recurso                    | Métrica                                                   | Meta                        | Alerta                                      |
| -------------------------- | --------------------------------------------------------- | --------------------------- | ------------------------------------------- |
| Tokens por agent por hora  | `rate(velya_ai_token_consumption_total[1h])` por agent    | < 50K tokens/hora por agent | > 100K tokens/hora (alto), > 200K (crítico) |
| Tokens por modelo          | `rate(velya_ai_token_consumption_total[1h])` por model    | Haiku > 80% do volume total | — (monitoramento)                           |
| Custo por tarefa concluída | tokens \* custo_por_token / tarefas                       | Meta por produto            | Crescimento > 30% em 7 dias                 |
| Erros por rate-limit       | `rate(velya_ai_error_total{error_type="rate_limit"}[5m])` | Zero                        | > 1 erro/minuto por 5 minutos               |

---

## 2. Queries PromQL para Estimativa de Custo

### 2.1 Cardinalidade Prometheus

```promql
# Total de time series ativas agora
prometheus_tsdb_head_series

# Top 10 jobs por número de series (identificar quem está gerando mais cardinalidade)
topk(10, count by (job) ({__name__=~".+"}))

# Top 10 labels com mais valores únicos (candidatos a explosão de cardinalidade)
topk(10, count by (__name__) ({__name__=~".+"}))

# Cardinalidade por namespace Velya
count by (namespace) (
  {__name__=~"velya_.+", namespace=~"velya-dev-.+"}
)

# Crescimento de cardinalidade nas últimas 24 horas
deriv(prometheus_tsdb_head_series[24h])
```

### 2.2 Volume de Ingestion Loki

```promql
# Volume de ingestion em bytes por segundo (por namespace)
sum(rate(loki_ingester_bytes_received_total[1h])) by (namespace)

# Volume estimado em GB por dia
sum(rate(loki_ingester_bytes_received_total[24h])) * 86400 / 1024 / 1024 / 1024

# Top serviços por volume de log (log verbosity ranking)
topk(10,
  sum(rate(loki_ingester_bytes_received_total[1h])) by (service_name)
)

# Tendência de crescimento de logs (GB/dia crescendo?)
deriv(
  sum(rate(loki_ingester_bytes_received_total[24h]))[7d:1d]
) * 86400 / 1024 / 1024 / 1024
```

### 2.3 Over-provisioning de Recursos

```promql
# Pods com CPU muito abaixo do request (< 20% de utilização por > 1h)
sum(rate(container_cpu_usage_seconds_total[1h])) by (pod, namespace) /
sum(kube_pod_container_resource_requests{resource="cpu"}) by (pod, namespace) < 0.20

# Pods com memória muito abaixo do request (< 30%)
sum(container_memory_usage_bytes) by (pod, namespace) /
sum(kube_pod_container_resource_requests{resource="memory"}) by (pod, namespace) < 0.30

# Custo relativo por namespace: proporção de resources vs. utilização real
(
  sum(kube_pod_container_resource_requests{resource="cpu"}) by (namespace) -
  sum(rate(container_cpu_usage_seconds_total[1h])) by (namespace)
) / sum(kube_pod_container_resource_requests{resource="cpu"}) by (namespace)
# Resultado: proporção de CPU "desperdiçada" por namespace
```

### 2.4 Custo de AI por Agent

```promql
# Tokens por agent nas últimas 1 hora
sum(rate(velya_ai_token_consumption_total[1h]) * 3600) by (agent_name, model)

# Custo estimado por hora (valores aproximados de preço Claude)
# Haiku: $0.25/1M tokens input, $1.25/1M tokens output
# Sonnet: $3/1M tokens input, $15/1M tokens output
sum(
  rate(velya_ai_token_consumption_total{token_type="input", model="claude-3-haiku"}[1h]) * 3600 * 0.25 / 1000000 +
  rate(velya_ai_token_consumption_total{token_type="output", model="claude-3-haiku"}[1h]) * 3600 * 1.25 / 1000000
) by (agent_name)  # Custo USD/hora por agent usando Haiku

# Proporção de uso por modelo (meta: Haiku > 80% do volume)
sum(rate(velya_ai_token_consumption_total[1h])) by (model) /
sum(rate(velya_ai_token_consumption_total[1h]))

# Custo por tarefa concluída
(
  sum(rate(velya_ai_token_consumption_total{token_type="input"}[1h]) * 3600) * 0.25 / 1000000 +
  sum(rate(velya_ai_token_consumption_total{token_type="output"}[1h]) * 3600) * 1.25 / 1000000
) / sum(rate(velya_agent_task_total{status="success"}[1h]) * 3600)
```

### 2.5 KEDA Scaling Events (Thrash Detection)

```promql
# Número de mudanças de réplicas por deployment em 1 hora (thrash = muitos eventos)
changes(kube_deployment_spec_replicas{namespace=~"velya-dev-.+"}[1h])

# Deployments com thrash (> 6 mudanças em 1 hora)
changes(kube_deployment_spec_replicas{namespace=~"velya-dev-.+"}[1h]) > 6

# Custo de thrash: pods criados e destruídos desnecessariamente
# Cada scale-up cria pods (custo de startup + recurso alocado)
# Detectar tendência
```

---

## 3. Alertas de Custo

### COST-001: Cardinalidade Prometheus Elevada

```yaml
alert: PrometheusHighCardinality
expr: prometheus_tsdb_head_series > 800000
for: 15m
labels:
  severity: medium
  domain: cost
  owner: platform-office
annotations:
  summary: 'Prometheus com {{ $value | humanize }} time series (meta: < 1M)'
  impact: 'Performance de query degradada. PVC crescendo além do esperado.'
  initial_action: |
    Identificar top series por job:
    topk(10, count by (job) ({__name__=~'.+'}))
    Verificar se algum serviço adicionou labels de alta cardinalidade recentemente.
  dashboard_url: 'http://grafana/d/velya-cost-observability-board'
  runbook_url: 'https://docs.velya/runbooks/prometheus-high-cardinality'
```

### COST-002: Volume de Loki Elevado

```yaml
alert: LokiIngestionSpike
expr: |
  sum(rate(loki_ingester_bytes_received_total[1h])) > (15 * 1024 * 1024 * 1024 / 86400)
for: 30m
labels:
  severity: medium
  domain: cost
  owner: platform-office
annotations:
  summary: 'Loki ingerindo acima de 15 GB/dia'
  impact: 'PVC do Loki pode encher. Custo de storage elevado.'
  initial_action: |
    Identificar serviços com maior volume:
    topk(10, sum(rate(loki_ingester_bytes_received_total[1h])) by (service_name))
    Verificar se algum serviço está em modo de log verboso (DEBUG ativo).
```

### COST-003: KEDA Thrash

```yaml
alert: KEDAScalingThrash
expr: changes(kube_deployment_spec_replicas{namespace=~"velya-dev-.+"}[1h]) > 20
for: 10m
labels:
  severity: medium
  domain: cost
  owner: platform-office
annotations:
  summary: 'Deployment {{ $labels.deployment }} com {{ $value }} eventos de scaling em 1 hora'
  impact: 'Thrash de scaling gera overhead de pods sendo criados/destruídos. Custo desnecessário e instabilidade.'
  initial_action: |
    Revisar o ScaledObject do deployment:
    kubectl describe scaledobject {{ $labels.deployment }} -n {{ $labels.namespace }}
    Aumentar cooldownPeriod e stabilizationWindowSeconds.
```

### COST-004: Token Consumption por Agent Elevado

```yaml
alert: AITokenConsumptionHigh
expr: |
  sum(rate(velya_ai_token_consumption_total[1h])) by (agent_name) * 3600 > 100000
for: 10m
labels:
  severity: high
  domain: cost
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} consumindo mais de 100K tokens/hora'
  impact: 'Custo de inferência anormalmente alto. Possível loop de correção ou prompt sem truncamento.'
  initial_action: |
    Verificar se o agent está em loop de correção:
    velya_agent_correction_loop_count{agent_name="{{ $labels.agent_name }}"} > 3
    Verificar throughput de tarefas vs. tokens consumidos.
```

### COST-005: Prometheus Storage Crescendo

```yaml
alert: PrometheusStorageGrowing
expr: |
  rate(prometheus_tsdb_storage_blocks_bytes[6h]) > 0
  and prometheus_tsdb_storage_blocks_bytes > (50 * 1024 * 1024 * 1024)
for: 1h
labels:
  severity: low
  domain: cost
  owner: platform-office
annotations:
  summary: 'Storage do Prometheus acima de 50 GB e ainda crescendo'
  impact: 'PVC do Prometheus pode encher. Revisar retenção e compactação.'
  initial_action: |
    Verificar configuração de retenção:
    kubectl exec -n velya-dev-observability prometheus-* -- /bin/sh -c "cat /etc/prometheus/prometheus.yml | grep retention"
    Considerar reduzir retention_time ou aumentar PVC.
```

---

## 4. Dashboard Observability Cost Board — Layout Detalhado

### Linha 1: Budget Status (4 Gauge panels)

**Painel 1 — Cardinalidade Prometheus (% do budget)**

```promql
prometheus_tsdb_head_series / 1000000  # proporção de 1M (meta)
```

Gauge: 0 a 1.0. Verde < 0.7, Amarelo < 0.85, Vermelho > 0.85

**Painel 2 — Volume Loki (% do budget diário)**

```promql
sum(rate(loki_ingester_bytes_received_total[1h])) * 86400 / (10 * 1024 * 1024 * 1024)
# proporção de 10GB/dia (meta)
```

Gauge: 0 a 1.5. Verde < 0.7, Amarelo < 1.0, Vermelho > 1.0

**Painel 3 — Storage Prometheus (GB)**

```promql
prometheus_tsdb_storage_blocks_bytes / 1024 / 1024 / 1024
```

Gauge: 0 a 100 GB. Verde < 30, Amarelo < 50, Vermelho > 50

**Painel 4 — Token AI Total (k tokens/hora)**

```promql
sum(rate(velya_ai_token_consumption_total[1h])) * 3600 / 1000
```

Gauge: 0 a 500K. Verde < 200K, Amarelo < 400K, Vermelho > 400K

---

### Linha 2: Tendência de Cardinalidade (Time Series)

**Painel — Evolução de Cardinalidade**

```promql
prometheus_tsdb_head_series
```

Time Series com threshold line em 800K (warning) e 1M (limit).
Exibir últimos 30 dias para ver tendência.

**Painel — Top 10 Jobs por Cardinalidade (Bar Chart)**

```promql
topk(10, count by (job) ({__name__=~".+"}))
```

Bar Chart horizontal, atualizado a cada 5 minutos.

---

### Linha 3: Volume de Logs (Time Series)

**Painel — Volume Loki por Namespace**

```promql
sum(rate(loki_ingester_bytes_received_total[1h])) by (namespace) * 3600 / 1024 / 1024
# MB/hora por namespace
```

Time Series stacked, com threshold line indicando o budget diário proporcional.

---

### Linha 4: Custo de AI por Agent (Bar Chart)

```promql
# Tokens por agent nas últimas 24 horas
sum(increase(velya_ai_token_consumption_total[24h])) by (agent_name, model)
```

Bar Chart horizontal com stacking por modelo (Haiku vs. Sonnet vs. Opus).
Threshold line em 100K tokens/dia por agent.

---

### Linha 5: Over-Provisioning (Table)

**Tabela de Pods Mais Over-Provisionados**

Colunas: Pod | Namespace | CPU Request | CPU Uso Real | % Utilização | Memória Request | Memória Uso Real | % Utilização

```promql
# Pods com CPU < 20% do request
sum(rate(container_cpu_usage_seconds_total[1h])) by (pod, namespace) /
sum(kube_pod_container_resource_requests{resource="cpu"}) by (pod, namespace) < 0.20
```

Ordenar por % de utilização crescente (os mais ineficientes primeiro).
Data Link: click em pod → abre logs do pod no Loki.

---

## 5. Políticas de Retenção de Dados

### 5.1 Métricas (Prometheus)

| Ambiente                            | Retenção | Storage estimado                   | Configuração                        |
| ----------------------------------- | -------- | ---------------------------------- | ----------------------------------- |
| dev                                 | 15 dias  | 5-10 GB                            | `--storage.tsdb.retention.time=15d` |
| staging                             | 45 dias  | 20-30 GB                           | `--storage.tsdb.retention.time=45d` |
| prod                                | 90 dias  | 60-100 GB                          | `--storage.tsdb.retention.time=90d` |
| prod (métricas de negócio clínicas) | 365 dias | Via recording rules e downsampling | Thanos ou remote_write (futuro)     |

### 5.2 Logs (Loki)

| Ambiente               | Retenção | Storage estimado | Configuração                  |
| ---------------------- | -------- | ---------------- | ----------------------------- |
| dev                    | 7 dias   | 5-15 GB          | `retention_period: 168h`      |
| staging                | 30 dias  | 30-60 GB         | `retention_period: 720h`      |
| prod                   | 90 dias  | 100-200 GB       | `retention_period: 2160h`     |
| prod (risk_class=high) | 365 dias | Via S3 tiering   | Configuração de tier separada |

### 5.3 Traces (Tempo — quando implementado)

| Ambiente | Retenção | Storage estimado | Configuração                                         |
| -------- | -------- | ---------------- | ---------------------------------------------------- |
| dev      | 3 dias   | 1-3 GB           | `max_trace_idle_period: 30s`, `block_retention: 72h` |
| staging  | 14 dias  | 10-20 GB         | `block_retention: 336h`                              |
| prod     | 30 dias  | 50-100 GB        | `block_retention: 720h`                              |

---

## 6. Guardrails de Custo de Observabilidade

### 6.1 Prevenção de Explosão de Cardinalidade

**Regras de naming que previnem cardinalidade alta**:

- Nunca usar `patient_id`, `request_id`, `trace_id`, `user_id` como label Prometheus
- Nunca gerar labels dinâmicos com valores não-enumeráveis
- Sempre revisar quantos valores únicos um novo label pode ter antes de adicionar

**Processo de aprovação para novos labels**:

1. Estimar cardinalidade: `número de labels únicos esperados × número de séries existentes`
2. Se resultado > 10.000 novas séries → revisão obrigatória com platform-office
3. Se resultado > 50.000 novas séries → ADR obrigatório

### 6.2 Budget de Observabilidade por Categoria

| Categoria                | Budget mensal estimado (dev) | Alerta em % |
| ------------------------ | ---------------------------- | ----------- |
| Storage Prometheus (PVC) | 10 GB                        | 80%         |
| Storage Loki (PVC)       | 30 GB                        | 80%         |
| CPU OTel Collector       | 0.5 vCPU                     | 80%         |
| Memória Prometheus       | 2 GB                         | 80%         |

### 6.3 Sampling como Controle de Custo de Traces

O tail-based sampling no OTel Collector (configurado em tracing-standard.md) é o principal controle de custo para traces:

- Tráfego normal: 10% → reduz volume de traces em 10x
- Erros: 100% → garantia de rastreabilidade de falhas
- Fluxos clínicos (risk_class=high): 100% → rastreabilidade clínica completa

**Impacto de custo estimado** (quando Tempo estiver implementado):

- 100% de sampling: ~5 GB/dia de traces (estimativa)
- 10% de sampling + 100% erros: ~0.8 GB/dia (redução de 84%)
