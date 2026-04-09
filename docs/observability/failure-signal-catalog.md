# Catálogo de Sinais de Falha — Velya Platform

> Catálogo de todas as falhas que devem ser detectáveis na observabilidade da Velya.
> Para cada falha: sinal esperado, query de detecção, dashboard e alerta.
> Última atualização: 2026-04-08

---

## Estrutura de Cada Entrada

| Campo                            | Descrição                                              |
| -------------------------------- | ------------------------------------------------------ |
| **ID**                           | Identificador único (ex.: INF-001)                     |
| **Nome**                         | Nome legível da falha                                  |
| **Descrição**                    | O que está falhando                                    |
| **Sinal esperado**               | Como a falha se manifesta nos dados de observabilidade |
| **Query de detecção**            | PromQL ou LogQL para detectar                          |
| **Dashboard**                    | Onde visualizar                                        |
| **Alerta**                       | ID do alerta correspondente                            |
| **Detecção atualmente possível** | Sim/Não (dado o estado atual sem ServiceMonitors)      |

---

## 1. Falhas de Infraestrutura

### INF-001: Pod em CrashLoopBackOff

**Descrição**: Container reiniciando repetidamente, indicando falha não recuperável no processo.

**Sinal esperado**: `kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"} > 0`

```promql
# Query de detecção
sum(kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}) by (pod, namespace, container) > 0
```

**LogQL para diagnóstico**:

```logql
{namespace="$namespace", pod="$pod"} | json | level="error"
```

**Dashboard**: velya-infra-namespace-health
**Alerta**: INFRA-003
**Detecção atualmente possível**: Sim (kube-state-metrics ativo)

---

### INF-002: Node com Memory Pressure

**Descrição**: Nó com memória insuficiente para novos pods. Kubernetes começa a evict pods.

**Sinal esperado**:

```promql
kube_node_status_condition{condition="MemoryPressure",status="true"} == 1
```

**Indicadores correlatos**:

```promql
# Taxa de evictions no nó
rate(kube_pod_status_reason{reason="Evicted"}[10m]) > 0

# Pods evicted no nó
kube_pod_status_reason{reason="Evicted"} == 1
```

**Dashboard**: velya-infra-node-nodepool
**Alerta**: INFRA-001
**Detecção atualmente possível**: Sim

---

### INF-003: PVC com > 85% de Uso

**Descrição**: Volume persistente quase cheio. Quando chega a 100%, o serviço que escreve para o PVC crasha.

**Sinal esperado**:

```promql
kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85
```

**Severidade por threshold**:

- 85% → warning (tempo para investigar)
- 95% → critical (intervenção imediata)

**Dashboard**: velya-infra-storage-network
**Alerta**: INFRA-005, INFRA-006
**Detecção atualmente possível**: Sim (kubelet metrics)

---

### INF-004: Scheduling Failure (Pod Unschedulable)

**Descrição**: Pod não consegue ser agendado em nenhum nó. Causas: falta de recursos, taint sem toleração, PV não disponível.

**Sinal esperado**:

```promql
kube_pod_status_unschedulable > 0
```

**Eventos de diagnóstico** (via Loki — logs do K8s events):

```logql
{namespace="kube-system"} |= "FailedScheduling" | json
```

**Dashboard**: velya-infra-scheduling-quotas
**Alerta**: INFRA-004
**Detecção atualmente possível**: Sim

---

### INF-005: Node Not Ready

**Descrição**: Nó do cluster em estado Not Ready. Pods podem ser realocados.

**Sinal esperado**:

```promql
kube_node_status_condition{condition="Ready",status="true"} == 0
```

**Dashboard**: velya-infra-cluster-overview
**Alerta**: INFRA-008
**Detecção atualmente possível**: Sim

---

### INF-006: Disk Pressure no Nó

**Descrição**: Disco do nó quase cheio. Pode causar evictions e impedir criação de novos pods.

**Sinal esperado**:

```promql
kube_node_status_condition{condition="DiskPressure",status="true"} == 1
```

**Sinal alternativo (node-exporter)**:

```promql
node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"} < 0.15
```

**Dashboard**: velya-infra-node-nodepool
**Alerta**: INFRA-002
**Detecção atualmente possível**: Sim

---

### INF-007: CPU Throttling Severo em Container

**Descrição**: Container está sendo throttled porque atingiu o limit de CPU. Isso causa latência adicional.

**Sinal esperado**:

```promql
rate(container_cpu_cfs_throttled_seconds_total[5m]) /
rate(container_cpu_cfs_periods_total[5m]) > 0.50
```

**O que significa**: Container está throttled em > 50% dos ciclos de CPU. Sinal de que o CPU limit está muito baixo.

**Dashboard**: velya-infra-namespace-health
**Alerta**: Não definido ainda (adicionar como INFRA-016)
**Detecção atualmente possível**: Sim

---

### INF-008: PersistentVolume Not Bound

**Descrição**: PV em estado diferente de Bound. Pods que dependem dele não conseguem iniciar.

**Sinal esperado**:

```promql
kube_persistentvolume_status_phase{phase!="Bound"} == 1
```

**Dashboard**: velya-infra-storage-network
**Alerta**: INFRA-014
**Detecção atualmente possível**: Sim

---

### INF-009: Resource Quota Excedendo 90%

**Descrição**: Namespace usando > 90% da quota de CPU ou memória. Novos pods podem ser rejeitados.

**Sinal esperado**:

```promql
kube_resourcequota_used / kube_resourcequota_hard > 0.90
```

**Dashboard**: velya-infra-scheduling-quotas
**Alerta**: INFRA-015
**Detecção atualmente possível**: Sim

---

### INF-010: Kubernetes API Server Inacessível

**Descrição**: API Server não está respondendo. Operações de controle do cluster param.

**Sinal esperado**:

```promql
up{job="apiserver"} == 0
```

**Impacto**: Nenhum deploy, nenhum scale, nenhuma criação de pod funciona. Cluster em modo de falha.

**Dashboard**: velya-infra-cluster-overview
**Alerta**: INFRA-011
**Detecção atualmente possível**: Sim

---

## 2. Falhas de Plataforma

### PLAT-001: ArgoCD Application Degraded

**Descrição**: Uma Application ArgoCD tem health status Degraded. Deploy falhou ou rollout causou degradação.

**Sinal esperado**:

```promql
argocd_app_info{health_status="Degraded"} == 1
```

**LogQL para diagnóstico**:

```logql
{namespace="argocd"} |= "Degraded" | json | app_name="$app_name"
```

**Dashboard**: velya-infra-argocd-delivery-monitor
**Alerta**: PLAT-002
**Detecção atualmente possível**: Depende de ArgoCD métricas disponíveis

---

### PLAT-002: KEDA Scaler em Thrash

**Descrição**: ScaledObject está escalando e desescalando repetidamente sem estabilizar. Indica trigger sensível demais ou cooldown insuficiente.

**Sinal esperado**:

```promql
changes(kube_deployment_spec_replicas{namespace=~"velya-dev-.+"}[30m]) > 6
```

**Visualização**: State Timeline do ScaledObject mostrando mudanças rápidas de estado.

**Dashboard**: velya-keda-scaling-monitor
**Alerta**: PLAT-003
**Detecção atualmente possível**: Sim

---

### PLAT-003: KEDA Prometheus Source Indisponível

**Descrição**: KEDA não consegue acessar o Prometheus para avaliar o trigger de scaling. Comportamento silencioso: usa `minReplicaCount`.

**Sinal esperado**:

```promql
keda_scaler_active{scaler_type="prometheus"} == 0
```

**Por que é uma falha silenciosa**: O ScaledObject parece estar funcionando, mas na verdade está ignorando a métrica de trigger. Serviço pode ficar no mínimo de réplicas sem que o auto-scaling funcione.

**Dashboard**: velya-keda-scaling-monitor
**Alerta**: PLAT-004
**Detecção atualmente possível**: Sim (KEDA métricas)

---

### PLAT-004: Secret Retrieval Failure

**Descrição**: Serviço não conseguiu recuperar um secret do Kubernetes/Vault. Pode causar falha de conexão ao banco de dados ou API externa.

**Sinal esperado**:

```promql
rate(velya_secret_retrieval_failure_total[5m]) > 0
```

**LogQL alternativo** (enquanto métrica não existe):

```logql
{namespace=~"velya-dev-.+"} | json | error_code="SECRET_RETRIEVAL_FAILED"
```

**Dashboard**: velya-security-secrets-identity-board
**Alerta**: PLAT-005
**Detecção atualmente possível**: Parcialmente (via logs)

---

### PLAT-005: Certificate Expiring

**Descrição**: Certificado TLS com menos de 30 dias para expirar. Após expirar, conexões TLS falharão.

**Sinal esperado**:

```promql
(certmanager_certificate_expiration_timestamp_seconds - time()) < (30 * 24 * 3600)
```

**Dashboard**: velya-security-secrets-identity-board
**Alerta**: PLAT-006
**Detecção atualmente possível**: Sim (cert-manager metrics)

---

### PLAT-006: GitOps Drift por > 1 hora

**Descrição**: Uma Application ArgoCD ficou out-of-sync por mais de 1 hora. O estado do cluster divergiu do estado desejado no Git.

**Sinal esperado**:

```promql
argocd_app_info{sync_status="OutOfSync"} == 1
# (com for: 1h no alerta)
```

**Dashboard**: velya-infra-argocd-delivery-monitor
**Alerta**: PLAT-008
**Detecção atualmente possível**: Depende de ArgoCD metrics

---

### PLAT-007: Prometheus Target Down

**Descrição**: Um target de scraping ficou inacessível. Métricas daquele serviço não estão sendo coletadas.

**Sinal esperado**:

```promql
up == 0
```

**Risco específico**: Se o target down for o Alertmanager, os próprios alertas do Prometheus param de ser enviados.

**Dashboard**: velya-infra-cluster-overview
**Alerta**: INFRA-012
**Detecção atualmente possível**: Sim

---

### PLAT-008: ArgoCD Sync Falhou

**Descrição**: ArgoCD tentou sincronizar uma Application mas falhou. Pode indicar manifesto inválido, recurso inexistente ou erro de permissão.

**Sinal esperado**:

```promql
argocd_app_sync_total{phase="Error"} > 0
```

**Dashboard**: velya-infra-argocd-delivery-monitor
**Alerta**: PLAT-001
**Detecção atualmente possível**: Depende de ArgoCD metrics

---

## 3. Falhas de Backend

### BACK-001: Error Rate > 5% em Serviço Velya

**Descrição**: Serviço respondendo com 5xx em mais de 5% das requisições.

**Sinal esperado**:

```promql
rate(http_requests_total{status=~"5..",service=~"velya-.+"}[5m]) /
rate(http_requests_total{service=~"velya-.+"}[5m]) > 0.05
```

**Dashboard**: velya-backend-api-red
**Alerta**: BACK-001
**Detecção atualmente possível**: Não (requer ServiceMonitors)

---

### BACK-002: P99 de Latência > 2 segundos

**Descrição**: 1% dos usuários está esperando mais de 2 segundos por resposta.

**Sinal esperado**:

```promql
histogram_quantile(0.99,
  rate(http_request_duration_seconds_bucket{service=~"velya-.+"}[$__rate_interval])
) > 2
```

**Dashboard**: velya-backend-api-red
**Alerta**: BACK-003
**Detecção atualmente possível**: Não (requer ServiceMonitors)

---

### BACK-003: Dead Letter Queue Não Vazia

**Descrição**: Mensagens que falharam após todas as retentativas foram para a DLQ. Indica perda potencial de dados de workflow.

**Sinal esperado**:

```promql
velya_dead_letter_queue_total > 0
```

**LogQL para investigação**:

```logql
{namespace="velya-dev-core"} | json | error_class="messaging.dlq"
```

**Dashboard**: velya-backend-queue-worker-health
**Alerta**: BACK-006
**Detecção atualmente possível**: Não (requer métrica customizada)

---

### BACK-004: Circuit Breaker Aberto

**Descrição**: Circuit breaker de um serviço abriu, indicando que a dependência está em falha. Serviço operando em modo degradado.

**Sinal esperado**:

```promql
velya_circuit_breaker_state{state="open"} == 1
```

**LogQL correlato**:

```logql
{namespace=~"velya-dev-.+"} | json | error_code="CIRCUIT_BREAKER_OPEN"
```

**Dashboard**: velya-backend-integration-health
**Alerta**: BACK-008
**Detecção atualmente possível**: Não (requer métrica customizada)

---

### BACK-005: Queue NATS Acumulando

**Descrição**: Consumer NATS com mensagens acumulando mais rápido do que são processadas.

**Sinal esperado**:

```promql
nats_consumer_num_pending > 1000
```

**Dashboard**: velya-backend-queue-worker-health
**Alerta**: BACK-005
**Detecção atualmente possível**: Depende de NATS exporter configurado

---

### BACK-006: DB Connection Pool Esgotando

**Descrição**: Pool de conexões com o banco de dados próximo do limite. Novas queries podem ficar em espera.

**Sinal esperado**:

```promql
velya_db_pool_waiting_total / velya_db_pool_size_total > 0.80
```

**Dashboard**: velya-backend-postgresql-performance
**Alerta**: BACK-007
**Detecção atualmente possível**: Não (requer métrica customizada)

---

### BACK-007: API Gateway Inacessível

**Descrição**: api-gateway não está respondendo. Nenhum cliente consegue acessar nenhum serviço Velya.

**Sinal esperado**:

```promql
up{job="api-gateway"} == 0
```

**Dashboard**: velya-backend-api-red
**Alerta**: BACK-009
**Detecção atualmente possível**: Não (requer ServiceMonitor)

---

### BACK-008: AI Gateway Rate Limit Errors

**Descrição**: AI Gateway recebendo erros de rate-limit do provedor de AI. Agents não conseguem respostas.

**Sinal esperado**:

```promql
rate(velya_ai_error_total{error_type="rate_limit"}[5m]) > 1
```

**LogQL correlato**:

```logql
{service="ai-gateway"} | json | error_code="AI_RATE_LIMIT_EXCEEDED"
```

**Dashboard**: velya-backend-ai-gateway-performance
**Alerta**: BACK-010
**Detecção atualmente possível**: Não (requer métrica customizada)

---

### BACK-009: Temporal Worker Crash

**Descrição**: Worker Temporal parou de processar tasks. Workflows podem ficar stuck.

**Sinal esperado**:

```promql
up{job=~"velya-.*-worker"} == 0
# OU
kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff", namespace="velya-dev-agents"} > 0
```

**Dashboard**: velya-backend-queue-worker-health
**Alerta**: Não definido ainda
**Detecção atualmente possível**: Parcialmente (via kube-state-metrics)

---

### BACK-010: Resposta de AI com Baixa Confiança

**Descrição**: AI retornando respostas com score de confiança abaixo do threshold mínimo. Não é um erro técnico, mas um sinal de qualidade.

**Sinal esperado**:

```promql
histogram_quantile(0.50,
  rate(velya_ai_confidence_distribution_bucket[$__rate_interval])
) < 0.60
```

**Dashboard**: velya-backend-ai-gateway-performance
**Alerta**: Informativo — dashboard apenas
**Detecção atualmente possível**: Não (requer métrica customizada)

---

## 4. Falhas Silenciosas Específicas da Velya

Estas são as mais perigosas: o sistema parece funcionar, mas está falhando de forma invisível.

---

### SILENT-001: KEDA com Prometheus Indisponível

**Descrição**: Quando o Prometheus está inacessível, KEDA silenciosamente usa `minReplicaCount` ao invés de retornar erro. O auto-scaling para de funcionar sem nenhum alerta visível.

**Por que é silencioso**: KEDA não retorna erro. O ScaledObject continua parecendo "ativo". Apenas o valor da métrica para de mudar.

**Como detectar**:

```promql
keda_scaler_active{scaler_type="prometheus"} == 0
```

**O que observar**: Se `keda_scaler_metrics_value` ficou constante por tempo incomum, pode indicar que a fonte de dados parou.

**Dashboard**: velya-keda-scaling-monitor
**Alerta**: PLAT-004
**Detecção atualmente possível**: Sim

---

### SILENT-002: NetworkPolicy Definida mas Não Enforçada

**Descrição**: No ambiente kind com CNI kindnet (padrão), NetworkPolicies são parseadas mas não enforçadas. Tráfego proibido pela política passa livremente.

**Por que é silencioso**: NetworkPolicies existem nos objetos Kubernetes (`kubectl get networkpolicy`), mas não bloqueiam tráfego real. Sem sinal de violação.

**Como detectar** (indiretamente):

```bash
# Testar se tráfego proibido pela policy está fluindo
kubectl exec -n velya-dev-core deploy/patient-flow-service -- \
  curl -sf http://ai-gateway.velya-dev-agents:3000/health
# Se responde: NetworkPolicy NÃO está enforçada
```

**Nota**: Em EKS com AWS VPC CNI + Network Policy Controller, as policies são enforçadas. O problema existe apenas no kind-velya-local com CNI padrão.

**Dashboard**: velya-security-policy-drift-board (indicar que enforcemento não está ativo)
**Alerta**: Não é possível via Prometheus — documentar como limitação do ambiente

---

### SILENT-003: Alert Rule Definida mas Não Roteada

**Descrição**: Uma PrometheusRule define um alerta. O alerta dispara no Prometheus. Mas o Alertmanager não tem uma rota para aquela severidade/label → alerta vai para o receiver `default` (que não existe ou não está configurado).

**Por que é silencioso**: O alerta aparece como `FIRING` no Prometheus UI, mas nenhuma notificação é enviada.

**Como detectar**:

```promql
# Alertas que estão firing mas sem receberem
ALERTS{alertstate="firing"}
# Verificar no Alertmanager UI se esses alertas estão presentes
```

```bash
# Verificar rotas no Alertmanager
kubectl port-forward svc/alertmanager -n velya-dev-observability 9093:9093
# Acessar http://localhost:9093/#/alerts
```

**Status atual**: TODOS os 5 alertas existentes estão nesta condição (firing no Prometheus mas sem destinatário real).

**Dashboard**: Sem dashboard específico para isso
**Alerta**: Não autodetectável — requer verificação manual periódica

---

### SILENT-004: Log Level DEBUG em Produção

**Descrição**: Serviço com `LOG_LEVEL=debug` em produção gera volume massivo de logs, pode revelar dados sensíveis, e infla custo do Loki.

**Por que é silencioso**: Logs aparecem normalmente no Loki, mas sem sinal de anomalia imediato.

**Como detectar**:

```logql
# Proporção de logs DEBUG vs. INFO nos últimos 5 minutos
sum(rate({namespace=~"velya-dev-.+"} | json | level="debug" [5m])) /
sum(rate({namespace=~"velya-dev-.+"} | json [5m])) > 0.30
```

**Verificação via kubectl**:

```bash
kubectl get pods -n velya-dev-core -o json | jq '.items[].spec.containers[].env[] | select(.name=="LOG_LEVEL")'
```

**Dashboard**: velya-cost-observability-board (volume de logs incomum)
**Alerta**: Não definido ainda

---

### SILENT-005: ServiceMonitor com Selector Incorreto

**Descrição**: Um ServiceMonitor existe mas o seletor não corresponde a nenhum Service ou Pod. O Prometheus não encontra targets mas também não retorna erro — simplesmente não coleta.

**Por que é silencioso**: `kubectl get servicemonitor` mostra o objeto. O Prometheus não mostra erro. Mas o target nunca aparece na lista de `/targets`.

**Como detectar**:

```bash
# Verificar que todos os ServiceMonitors têm pelo menos 1 target UP no Prometheus
kubectl port-forward svc/kube-prometheus-stack-prometheus -n velya-dev-observability 9090:9090
# Acessar http://localhost:9090/targets
# Verificar se todos os jobs esperados estão presentes e com status UP
```

**Alerta de ausência de target**:

```promql
# Se um job esperado desaparece dos targets (usando absent())
absent(up{job="patient-flow-service"})
```

**Dashboard**: velya-infra-cluster-overview (seção de targets Prometheus)
**Alerta**: Adicionar alertas de `absent()` para cada job crítico

---

## 5. Resumo de Detecção por Categoria

| Categoria               | Total de falhas documentadas | Detectáveis agora | Não detectáveis (aguardando implementação) |
| ----------------------- | ---------------------------- | ----------------- | ------------------------------------------ |
| Infraestrutura          | 10                           | 10                | 0                                          |
| Plataforma              | 8                            | 4                 | 4                                          |
| Backend                 | 10                           | 2                 | 8                                          |
| Silenciosas específicas | 5                            | 2                 | 3                                          |
| **Total**               | **33**                       | **18**            | **15**                                     |

**Nota**: As 15 falhas não detectáveis dependem majoritariamente da implementação de ServiceMonitors (GAP-001) e métricas customizadas (GAP-003, GAP-007) descritas em monitoring-gaps-register.md.
