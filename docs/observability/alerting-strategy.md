# Estratégia de Alerting — Velya Platform

> Todo alerta deve ser acionável, ter dono, severidade e runbook. Alertas sem runbook não devem existir em produção.
> Última atualização: 2026-04-08

---

## 1. Princípios de Alerting

| #   | Princípio                                  | Consequência prática                                                           |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| 1   | **Todo alerta é acionável**                | Se não há ação a tomar, não é alerta — é métrica de dashboard                  |
| 2   | **Todo alerta tem dono**                   | Owner = office responsável por investigar e resolver                           |
| 3   | **Todo alerta tem severidade**             | Severidade determina canal de notificação e SLA de resposta                    |
| 4   | **Todo alerta tem runbook**                | Link obrigatório para documentação de diagnóstico e resolução                  |
| 5   | **Alertas clínicos nunca são silenciados** | Domínio `clinical` é excluído de todos os Mute Timings                         |
| 6   | **Alert fatigue é um risco de segurança**  | Alertas ruidosos são desativados ou corrigidos — não tolerados                 |
| 7   | **Thresholds baseados em evidência**       | Definir threshold a partir de dados históricos, não intuição                   |
| 8   | **Janela temporal adequada**               | Janelas muito curtas geram falsos positivos; muito longas, detecção tardia     |
| 9   | **Pending period antes de disparar**       | `for: 5m` evita alertas de flap. Críticos: `for: 2m`. Informativos: `for: 15m` |
| 10  | **Revisão a cada 90 dias**                 | Alertas que nunca disparam ou sempre disparam são revisados                    |

---

## 2. Matriz de Severidade

| Severidade  | Impacto                                                              | Canal                                 | SLA de Resposta        | Exemplos                                                                    |
| ----------- | -------------------------------------------------------------------- | ------------------------------------- | ---------------------- | --------------------------------------------------------------------------- |
| **Crítico** | Impacto imediato na segurança do paciente ou perda de dados clínicos | PagerDuty + Slack #velya-ops-critical | Resposta em 5 minutos  | patient-flow down, discharge-orchestrator crash, perda de decisões clínicas |
| **Alto**    | Impacto na operação clínica, degradação significativa de serviço     | Slack #velya-ops-high                 | Resposta em 30 minutos | API gateway error rate > 5%, latência P99 > 5s, agent silencioso > 60min    |
| **Médio**   | Degradação de qualidade, indicador de problema futuro                | Slack #velya-ops-info                 | Resposta em 4 horas    | Error rate elevada mas abaixo de SLO, PVC > 70%, backlog crescendo          |
| **Baixo**   | Indicador preventivo, tendência negativa                             | Slack #velya-ops-info                 | Próximo dia útil       | Certificado expira em 30 dias, over-provisioning detectado                  |

---

## 3. Catálogo de Alertas

### 3.1 Infraestrutura (15 alertas)

#### INFRA-001: NodeMemoryPressure

```yaml
alert: NodeMemoryPressure
expr: kube_node_status_condition{condition="MemoryPressure",status="true"} == 1
for: 2m
labels:
  severity: critical
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Nó {{ $labels.node }} com pressão de memória'
  impact: 'Pods podem ser evicted, serviços críticos afetados'
  dashboard_url: 'http://grafana/d/velya-infra-node-nodepool'
  runbook_url: 'https://docs.velya/runbooks/node-memory-pressure'
  initial_action: 'Verificar pods com maior consumo de memória no nó: kubectl top pods --all-namespaces --sort-by=memory | grep <nó>'
```

---

#### INFRA-002: NodeDiskPressure

```yaml
alert: NodeDiskPressure
expr: kube_node_status_condition{condition="DiskPressure",status="true"} == 1
for: 2m
labels:
  severity: critical
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Nó {{ $labels.node }} com pressão de disco'
  impact: 'Pods novos não serão agendados no nó. Risco de perda de logs.'
  runbook_url: 'https://docs.velya/runbooks/node-disk-pressure'
  initial_action: 'Verificar uso de disco: kubectl describe node <nó>. Limpar imagens não utilizadas: kubectl delete pods --field-selector=status.phase=Failed -A'
```

---

#### INFRA-003: PodCrashLoopBackOff

```yaml
alert: PodCrashLoopBackOff
expr: |
  sum(kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}) by (pod, namespace, container) > 0
for: 5m
labels:
  severity: high
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Pod {{ $labels.pod }} em CrashLoopBackOff no namespace {{ $labels.namespace }}'
  impact: 'Serviço {{ $labels.pod }} indisponível ou com capacidade reduzida'
  dashboard_url: 'http://grafana/d/velya-infra-namespace-health'
  runbook_url: 'https://docs.velya/runbooks/pod-crashloop'
  initial_action: 'Ver logs: kubectl logs {{ $labels.pod }} -n {{ $labels.namespace }} --previous'
```

---

#### INFRA-004: PodPendingTooLong

```yaml
alert: PodPendingTooLong
expr: |
  sum(kube_pod_status_phase{phase="Pending"}) by (pod, namespace) > 0
for: 15m
labels:
  severity: high
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Pod {{ $labels.pod }} em Pending por mais de 15 minutos'
  impact: 'Capacidade do serviço reduzida ou serviço não iniciando'
  runbook_url: 'https://docs.velya/runbooks/pod-pending'
  initial_action: 'Verificar eventos: kubectl describe pod {{ $labels.pod }} -n {{ $labels.namespace }}'
```

---

#### INFRA-005: PVCAlmostFull

```yaml
alert: PVCAlmostFull
expr: |
  kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85
for: 10m
labels:
  severity: medium
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'PVC {{ $labels.persistentvolumeclaim }} com {{ $value | humanizePercentage }} de uso'
  impact: 'Quando cheio, o serviço pode parar de escrever dados e crashar'
  runbook_url: 'https://docs.velya/runbooks/pvc-full'
  initial_action: 'Identificar grandes consumidores: kubectl exec -n {{ $labels.namespace }} <pod> -- du -sh /data/*'
```

---

#### INFRA-006: PVCCriticallyFull

```yaml
alert: PVCCriticallyFull
expr: |
  kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.95
for: 5m
labels:
  severity: critical
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'PVC {{ $labels.persistentvolumeclaim }} com {{ $value | humanizePercentage }} de uso — CRÍTICO'
  impact: 'Iminente perda de capacidade de escrita. Serviço pode crashar a qualquer momento.'
  runbook_url: 'https://docs.velya/runbooks/pvc-full'
  initial_action: 'Escalar PVC imediatamente ou liberar espaço'
```

---

#### INFRA-007: NodeCPUHighSustained

```yaml
alert: NodeCPUHighSustained
expr: |
  (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) by (instance)) > 0.90
for: 15m
labels:
  severity: high
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Nó {{ $labels.instance }} com CPU > 90% por mais de 15 minutos'
  impact: 'Throttling de pods, latência elevada em todos os serviços do nó'
  runbook_url: 'https://docs.velya/runbooks/node-high-cpu'
  initial_action: 'kubectl top pods -A --sort-by=cpu | head -20'
```

---

#### INFRA-008: NodeNotReady

```yaml
alert: NodeNotReady
expr: kube_node_status_condition{condition="Ready",status="true"} == 0
for: 2m
labels:
  severity: critical
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Nó {{ $labels.node }} com status NotReady'
  impact: 'Pods no nó podem ser removidos e reagendados. Perda de capacidade do cluster.'
  runbook_url: 'https://docs.velya/runbooks/node-not-ready'
  initial_action: 'kubectl describe node {{ $labels.node }} | grep -A 10 Conditions'
```

---

#### INFRA-009: HighPodEvictionRate

```yaml
alert: HighPodEvictionRate
expr: |
  rate(kube_pod_status_reason{reason="Evicted"}[10m]) > 0.5
for: 5m
labels:
  severity: high
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Taxa anormal de pod evictions detectada'
  impact: 'Pods sendo evicted indica pressão de recursos. Possível cascata de falhas.'
  runbook_url: 'https://docs.velya/runbooks/pod-eviction'
```

---

#### INFRA-010: HighContainerRestartRate

```yaml
alert: HighContainerRestartRate
expr: |
  rate(kube_pod_container_status_restarts_total[15m]) * 60 * 15 > 5
for: 5m
labels:
  severity: medium
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Container {{ $labels.container }} reiniciando mais de 5 vezes em 15 minutos'
  impact: 'Serviço instável, possível CrashLoop iminente'
  runbook_url: 'https://docs.velya/runbooks/container-restarts'
```

---

#### INFRA-011: KubernetesAPIServerDown

```yaml
alert: KubernetesAPIServerDown
expr: up{job="apiserver"} == 0
for: 1m
labels:
  severity: critical
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Kubernetes API Server inacessível'
  impact: 'Nenhum deploy, scale ou operação de controle funciona. Cluster em modo de falha.'
  runbook_url: 'https://docs.velya/runbooks/apiserver-down'
```

---

#### INFRA-012: PrometheusTargetDown

```yaml
alert: PrometheusTargetDown
expr: up == 0
for: 5m
labels:
  severity: medium
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Target Prometheus {{ $labels.job }}/{{ $labels.instance }} inacessível'
  impact: 'Métricas deste target não estão sendo coletadas. Alertas baseados nelas podem não disparar.'
  runbook_url: 'https://docs.velya/runbooks/prometheus-target-down'
```

---

#### INFRA-013: HighNetworkErrors

```yaml
alert: HighNetworkErrors
expr: |
  rate(node_network_receive_errs_total[5m]) + rate(node_network_transmit_errs_total[5m]) > 10
for: 10m
labels:
  severity: medium
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Erros de rede elevados no nó {{ $labels.instance }}'
  impact: 'Possível degradação de comunicação entre pods. Latência e timeouts podem aumentar.'
  runbook_url: 'https://docs.velya/runbooks/network-errors'
```

---

#### INFRA-014: PersistentVolumeNotBound

```yaml
alert: PersistentVolumeNotBound
expr: kube_persistentvolume_status_phase{phase!="Bound"} == 1
for: 10m
labels:
  severity: high
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'PersistentVolume {{ $labels.persistentvolume }} não está em Bound'
  impact: 'Pods que dependem deste PV não conseguem iniciar'
  runbook_url: 'https://docs.velya/runbooks/pv-not-bound'
```

---

#### INFRA-015: ClusterResourceQuotaExceeding

```yaml
alert: ClusterResourceQuotaExceeding
expr: |
  kube_resourcequota_used / kube_resourcequota_hard > 0.90
for: 10m
labels:
  severity: high
  domain: infrastructure
  owner: platform-office
annotations:
  summary: 'Namespace {{ $labels.namespace }} usando {{ $value | humanizePercentage }} da quota de {{ $labels.resource }}'
  impact: 'Novos pods podem ser rejeitados quando quota for excedida'
  runbook_url: 'https://docs.velya/runbooks/resource-quota'
```

---

### 3.2 Plataforma (8 alertas)

#### PLAT-001: ArgoCDApplicationOutOfSync

```yaml
alert: ArgoCDApplicationOutOfSync
expr: argocd_app_info{sync_status="OutOfSync"} == 1
for: 15m
labels:
  severity: medium
  domain: platform
  owner: platform-office
annotations:
  summary: 'Application ArgoCD {{ $labels.name }} fora de sync por mais de 15 minutos'
  impact: 'Configuração aplicada pode não refletir o estado do Git. GitOps drift.'
  runbook_url: 'https://docs.velya/runbooks/argocd-out-of-sync'
  initial_action: 'argocd app sync {{ $labels.name }}'
```

---

#### PLAT-002: ArgoCDApplicationDegraded

```yaml
alert: ArgoCDApplicationDegraded
expr: argocd_app_info{health_status="Degraded"} == 1
for: 5m
labels:
  severity: high
  domain: platform
  owner: platform-office
annotations:
  summary: 'Application ArgoCD {{ $labels.name }} com health status Degraded'
  impact: 'Deploy falhou ou rollout causou degradação'
  runbook_url: 'https://docs.velya/runbooks/argocd-degraded'
```

---

#### PLAT-003: KEDAScalerThrash

```yaml
alert: KEDAScalerThrash
expr: |
  changes(kube_deployment_spec_replicas[30m]) > 6
for: 5m
labels:
  severity: high
  domain: platform
  owner: platform-office
annotations:
  summary: 'ScaledObject {{ $labels.deployment }} em thrash: mais de 6 mudanças de réplicas em 30 minutos'
  impact: 'Serviço instável com pods sendo criados e destruídos repetidamente. Latência elevada.'
  dashboard_url: 'http://grafana/d/velya-keda-scaling-monitor'
  runbook_url: 'https://docs.velya/runbooks/keda-thrash'
  initial_action: 'Revisar cooldownPeriod e stabilizationWindowSeconds do ScaledObject'
```

---

#### PLAT-004: KEDAPrometheusSourceUnavailable

```yaml
alert: KEDAPrometheusSourceUnavailable
expr: |
  keda_scaler_active{scaler_type="prometheus"} == 0
for: 10m
labels:
  severity: high
  domain: platform
  owner: platform-office
annotations:
  summary: 'KEDA não consegue acessar Prometheus para trigger de scaling'
  impact: 'ScaledObjects usarão minReplicaCount silenciosamente. Scaling automático inativo.'
  runbook_url: 'https://docs.velya/runbooks/keda-prometheus-source'
```

---

#### PLAT-005: SecretRetrievalFailure

```yaml
alert: SecretRetrievalFailure
expr: |
  rate(velya_secret_retrieval_failure_total[5m]) > 0
for: 2m
labels:
  severity: critical
  domain: platform
  owner: security-office
annotations:
  summary: 'Falha ao recuperar secret no serviço {{ $labels.service }}'
  impact: 'Serviço pode não conseguir conectar ao banco de dados ou APIs externas'
  runbook_url: 'https://docs.velya/runbooks/secret-retrieval-failure'
```

---

#### PLAT-006: CertificateExpiringSoon

```yaml
alert: CertificateExpiringSoon
expr: |
  (certmanager_certificate_expiration_timestamp_seconds - time()) < (30 * 24 * 3600)
for: 1h
labels:
  severity: medium
  domain: platform
  owner: security-office
annotations:
  summary: 'Certificado {{ $labels.name }} expira em menos de 30 dias'
  impact: 'Conexões TLS falharão após expiração'
  runbook_url: 'https://docs.velya/runbooks/certificate-renewal'
```

---

#### PLAT-007: CertificateExpiredCritical

```yaml
alert: CertificateExpiredCritical
expr: |
  (certmanager_certificate_expiration_timestamp_seconds - time()) < (7 * 24 * 3600)
for: 1h
labels:
  severity: critical
  domain: platform
  owner: security-office
annotations:
  summary: 'Certificado {{ $labels.name }} expira em menos de 7 dias — CRÍTICO'
  impact: 'Conexões TLS falharão em menos de 7 dias. Serviços podem se tornar inacessíveis.'
  runbook_url: 'https://docs.velya/runbooks/certificate-renewal'
```

---

#### PLAT-008: GitOpsDriftDetected

```yaml
alert: GitOpsDriftDetected
expr: argocd_app_info{sync_status="OutOfSync"} == 1
for: 1h
labels:
  severity: high
  domain: platform
  owner: platform-office
annotations:
  summary: 'Drift de GitOps detectado: {{ $labels.name }} fora de sync por mais de 1 hora'
  impact: 'Configuração em produção divergiu do estado desejado no Git'
  runbook_url: 'https://docs.velya/runbooks/gitops-drift'
```

---

### 3.3 Backend (10 alertas)

#### BACK-001: ServiceHighErrorRate

```yaml
alert: ServiceHighErrorRate
expr: |
  rate(http_requests_total{status=~"5..",service=~"velya-.+"}[5m]) /
  rate(http_requests_total{service=~"velya-.+"}[5m]) > 0.05
for: 5m
labels:
  severity: high
  domain: backend
  owner: backend-office
annotations:
  summary: 'Serviço {{ $labels.service }} com taxa de erros > 5%'
  impact: '{{ $value | humanizePercentage }} das requisições estão falhando. Experiência do usuário degradada.'
  dashboard_url: 'http://grafana/d/velya-backend-api-red'
  runbook_url: 'https://docs.velya/runbooks/high-error-rate'
  initial_action: "Ver logs de erro: {service='{{ $labels.service }}'} |= 'ERROR' | json"
```

---

#### BACK-002: ServiceCriticalErrorRate

```yaml
alert: ServiceCriticalErrorRate
expr: |
  rate(http_requests_total{status=~"5..",service=~"velya-.+"}[5m]) /
  rate(http_requests_total{service=~"velya-.+"}[5m]) > 0.20
for: 2m
labels:
  severity: critical
  domain: backend
  owner: backend-office
annotations:
  summary: 'Serviço {{ $labels.service }} com taxa de erros CRÍTICA > 20%'
  impact: 'Serviço essencialmente não funcional. Impacto direto em usuários clínicos.'
  dashboard_url: 'http://grafana/d/velya-backend-api-red'
  runbook_url: 'https://docs.velya/runbooks/critical-error-rate'
```

---

#### BACK-003: ServiceHighLatencyP99

```yaml
alert: ServiceHighLatencyP99
expr: |
  histogram_quantile(0.99,
    rate(http_request_duration_seconds_bucket{service=~"velya-.+"}[$__rate_interval])
  ) > 2
for: 10m
labels:
  severity: high
  domain: backend
  owner: backend-office
annotations:
  summary: 'Serviço {{ $labels.service }} com P99 de latência > 2 segundos'
  impact: '1% dos usuários está esperando mais de 2s por resposta. Possível timeout em cascata.'
  dashboard_url: 'http://grafana/d/velya-backend-api-red'
  runbook_url: 'https://docs.velya/runbooks/high-latency'
```

---

#### BACK-004: ServiceDown

```yaml
alert: ServiceDown
expr: |
  up{job=~"velya-.+"} == 0
for: 2m
labels:
  severity: critical
  domain: backend
  owner: backend-office
annotations:
  summary: 'Serviço {{ $labels.job }} inacessível — Prometheus não consegue fazer scrape'
  impact: 'Serviço pode estar down ou endpoint /metrics não responde'
  runbook_url: 'https://docs.velya/runbooks/service-down'
```

---

#### BACK-005: QueueBuildup

```yaml
alert: QueueBuildup
expr: |
  nats_consumer_num_pending > 1000
for: 10m
labels:
  severity: high
  domain: backend
  owner: backend-office
annotations:
  summary: 'Fila NATS {{ $labels.consumer }} acumulando: {{ $value }} mensagens pendentes'
  impact: 'Workers não estão processando na velocidade de produção. Risco de timeout e dead letters.'
  dashboard_url: 'http://grafana/d/velya-backend-queue-worker-health'
  runbook_url: 'https://docs.velya/runbooks/queue-buildup'
```

---

#### BACK-006: DeadLetterQueueNonEmpty

```yaml
alert: DeadLetterQueueNonEmpty
expr: |
  velya_dead_letter_queue_total > 0
for: 5m
labels:
  severity: high
  domain: backend
  owner: backend-office
annotations:
  summary: 'Dead letter queue com {{ $value }} mensagens no serviço {{ $labels.service }}'
  impact: 'Mensagens perdidas permanentemente. Possível perda de dados de workflow clínico.'
  runbook_url: 'https://docs.velya/runbooks/dead-letter-queue'
```

---

#### BACK-007: DatabaseConnectionPoolExhausted

```yaml
alert: DatabaseConnectionPoolExhausted
expr: |
  velya_db_pool_waiting_total / velya_db_pool_size_total > 0.80
for: 5m
labels:
  severity: high
  domain: backend
  owner: backend-office
annotations:
  summary: 'Pool de conexões do banco de dados de {{ $labels.service }} está {{ $value | humanizePercentage }} utilizado'
  impact: 'Novas operações de banco de dados podem ficar em espera, causando timeout'
  runbook_url: 'https://docs.velya/runbooks/db-pool-exhausted'
```

---

#### BACK-008: CircuitBreakerOpen

```yaml
alert: CircuitBreakerOpen
expr: |
  velya_circuit_breaker_state{state="open"} == 1
for: 1m
labels:
  severity: high
  domain: backend
  owner: backend-office
annotations:
  summary: 'Circuit breaker aberto em {{ $labels.service }} → {{ $labels.dependency }}'
  impact: '{{ $labels.service }} não está fazendo chamadas para {{ $labels.dependency }}. Modo degradado ativo.'
  runbook_url: 'https://docs.velya/runbooks/circuit-breaker-open'
```

---

#### BACK-009: APIGatewayDown

```yaml
alert: APIGatewayDown
expr: |
  up{job="api-gateway"} == 0
for: 1m
labels:
  severity: critical
  domain: backend
  owner: backend-office
annotations:
  summary: 'API Gateway inacessível — todos os clientes afetados'
  impact: 'CRÍTICO: Nenhum cliente (web ou mobile) consegue acessar nenhum serviço Velya'
  dashboard_url: 'http://grafana/d/velya-backend-api-red'
  runbook_url: 'https://docs.velya/runbooks/api-gateway-down'
```

---

#### BACK-010: AIGatewayRateLimitErrors

```yaml
alert: AIGatewayRateLimitErrors
expr: |
  rate(velya_ai_error_total{error_type="rate_limit"}[5m]) > 1
for: 5m
labels:
  severity: high
  domain: backend
  owner: agents-office
annotations:
  summary: 'AI Gateway recebendo erros de rate-limit do provedor de AI'
  impact: 'Agents não conseguem obter respostas de AI. Decisões clínicas podem ser atrasadas.'
  dashboard_url: 'http://grafana/d/velya-backend-ai-gateway-performance'
  runbook_url: 'https://docs.velya/runbooks/ai-rate-limit'
```

---

### 3.4 Frontend (5 alertas)

#### FRONT-001: FrontendJSErrorSpike

```yaml
alert: FrontendJSErrorSpike
expr: |
  rate(velya_web_js_error_total[5m]) > 5
for: 5m
labels:
  severity: high
  domain: frontend
  owner: frontend-office
annotations:
  summary: 'Spike de erros JavaScript no velya-web: {{ $value | humanize }} erros/segundo'
  impact: 'Usuários podem estar vendo telas brancas ou funcionalidades quebradas'
  dashboard_url: 'http://grafana/d/velya-frontend-action-failure-board'
  runbook_url: 'https://docs.velya/runbooks/frontend-js-errors'
```

---

#### FRONT-002: FrontendRouteSlowLCP

```yaml
alert: FrontendRouteSlowLCP
expr: |
  velya_web_lcp_seconds{quantile="0.95"} > 4
for: 10m
labels:
  severity: medium
  domain: frontend
  owner: frontend-office
annotations:
  summary: 'Rota {{ $labels.route }} com LCP P95 > 4 segundos'
  impact: 'Carregamento lento de página afeta resposta clínica. Core Web Vital fora do limite aceitável.'
  runbook_url: 'https://docs.velya/runbooks/frontend-slow-lcp'
```

---

#### FRONT-003: FrontendDegradedModeActive

```yaml
alert: FrontendDegradedModeActive
expr: |
  velya_degraded_mode_active{service="velya-web"} == 1
for: 2m
labels:
  severity: high
  domain: frontend
  owner: frontend-office
annotations:
  summary: 'velya-web está em modo degradado'
  impact: 'Usuários clínicos podem estar vendo dados em cache ou com funcionalidades limitadas'
  dashboard_url: 'http://grafana/d/velya-frontend-degraded-mode-board'
  runbook_url: 'https://docs.velya/runbooks/frontend-degraded-mode'
```

---

#### FRONT-004: FrontendAPIFailureSpike

```yaml
alert: FrontendAPIFailureSpike
expr: |
  rate(velya_web_api_error_total[5m]) / rate(velya_web_api_total[5m]) > 0.10
for: 5m
labels:
  severity: high
  domain: frontend
  owner: frontend-office
annotations:
  summary: 'Frontend com taxa de falha de API > 10% do ponto de vista do usuário'
  impact: 'Usuários estão vendo erros ao tentar realizar ações clínicas'
  runbook_url: 'https://docs.velya/runbooks/frontend-api-failures'
```

---

#### FRONT-005: FrontendHighFlowAbandonment

```yaml
alert: FrontendHighFlowAbandonment
expr: |
  rate(velya_web_flow_abandonment_total[30m]) > 0.30
for: 15m
labels:
  severity: medium
  domain: frontend
  owner: frontend-office
annotations:
  summary: 'Taxa de abandono de fluxo {{ $labels.flow }} > 30% na última meia hora'
  impact: 'Usuários estão saindo de fluxos clínicos críticos no meio — possível problema de UX ou erro'
  runbook_url: 'https://docs.velya/runbooks/frontend-flow-abandonment'
```

---

### 3.5 Agents (8 alertas)

#### AGENT-001: AgentSilentWarning

```yaml
alert: AgentSilentWarning
expr: |
  time() - velya_agent_last_activity_timestamp > 1800
for: 5m
labels:
  severity: medium
  domain: agents
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} silencioso por mais de 30 minutos'
  impact: 'Agent pode estar preso, em deadlock ou com worker parado'
  dashboard_url: 'http://grafana/d/velya-agents-oversight-console'
  runbook_url: 'https://docs.velya/runbooks/agent-silent'
```

---

#### AGENT-002: AgentSilentCritical

```yaml
alert: AgentSilentCritical
expr: |
  time() - velya_agent_last_activity_timestamp > 3600
for: 5m
labels:
  severity: critical
  domain: agents
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} silencioso por mais de 60 minutos — CRÍTICO'
  impact: 'Agent completamente parado. Tarefas do office {{ $labels.office }} não estão sendo processadas.'
  dashboard_url: 'http://grafana/d/velya-agents-oversight-console'
  runbook_url: 'https://docs.velya/runbooks/agent-silent'
```

---

#### AGENT-003: AgentHighValidationRejection

```yaml
alert: AgentHighValidationRejection
expr: |
  rate(velya_agent_validation_result_total{result="fail"}[1h]) /
  rate(velya_agent_validation_result_total[1h]) > 0.30
for: 15m
labels:
  severity: high
  domain: agents
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} com taxa de rejeição de validação > 30%'
  impact: 'Agent produzindo saídas com baixa qualidade. Retrabalho aumentado. Risco clínico se agent afeta decisões.'
  dashboard_url: 'http://grafana/d/velya-agents-validation-board'
  runbook_url: 'https://docs.velya/runbooks/agent-validation-rejection'
```

---

#### AGENT-004: AgentCorrectionLoop

```yaml
alert: AgentCorrectionLoop
expr: |
  velya_agent_correction_loop_count > 3
for: 5m
labels:
  severity: high
  domain: agents
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} em loop de correção: {{ $value }} iterações'
  impact: 'Agent não está convergindo para solução correta. Consumo elevado de tokens e latência aumentada.'
  runbook_url: 'https://docs.velya/runbooks/agent-correction-loop'
```

---

#### AGENT-005: AgentQuarantineEvent

```yaml
alert: AgentQuarantineEvent
expr: |
  increase(velya_agent_quarantine_total[5m]) > 0
for: 1m
labels:
  severity: critical
  domain: agents
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} foi colocado em quarentena'
  impact: 'CRÍTICO: Agent removido de operação. Tarefas de {{ $labels.office }} podem acumular.'
  dashboard_url: 'http://grafana/d/velya-agents-quarantine-center'
  runbook_url: 'https://docs.velya/runbooks/agent-quarantine'
```

---

#### AGENT-006: AgentWatchdogIncident

```yaml
alert: AgentWatchdogIncident
expr: |
  increase(velya_agent_watchdog_incident_total[10m]) > 0
for: 2m
labels:
  severity: high
  domain: agents
  owner: agents-office
annotations:
  summary: 'Watchdog detectou incidente em agent {{ $labels.agent_name }}'
  impact: 'Comportamento anômalo detectado. Agent pode estar em estado inconsistente.'
  runbook_url: 'https://docs.velya/runbooks/agent-watchdog-incident'
```

---

#### AGENT-007: AgentEvidenceCompletenessLow

```yaml
alert: AgentEvidenceCompletenessLow
expr: |
  velya_agent_evidence_completeness_ratio < 0.70
for: 15m
labels:
  severity: medium
  domain: agents
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} com evidência incompleta: {{ $value | humanizePercentage }}'
  impact: 'Decisões do agent baseadas em contexto incompleto. Qualidade das saídas pode ser inferior.'
  runbook_url: 'https://docs.velya/runbooks/agent-evidence-completeness'
```

---

#### AGENT-008: AgentTokenCostExplosion

```yaml
alert: AgentTokenCostExplosion
expr: |
  rate(velya_ai_token_consumption_total[1h]) > 100000
for: 10m
labels:
  severity: high
  domain: agents
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} consumindo mais de 100K tokens/hora'
  impact: 'Custo de inferência anormalmente alto. Possível loop ou prompt sem truncamento.'
  dashboard_url: 'http://grafana/d/velya-backend-ai-gateway-performance'
  runbook_url: 'https://docs.velya/runbooks/agent-token-cost'
```

---

### 3.6 Negócio Hospitalar (6 alertas)

#### CLIN-001: DischargeBlockerAged

```yaml
alert: DischargeBlockerAged
expr: |
  max(velya_discharge_blocker_age_seconds) by (unit, blocker_type) > 14400
for: 5m
labels:
  severity: critical
  domain: clinical
  owner: clinical-office
annotations:
  summary: 'Bloqueador de alta tipo {{ $labels.blocker_type }} na unidade {{ $labels.unit }} sem resolução há mais de 4 horas'
  impact: 'CLÍNICO: Paciente aguardando alta por mais de 4h com bloqueador ativo. Risco de leito desnecessariamente ocupado e sobrecarga.'
  dashboard_url: 'http://grafana/d/velya-clinical-discharge-control-board'
  runbook_url: 'https://docs.velya/runbooks/discharge-blocker-aged'
```

---

#### CLIN-002: InboxOverload

```yaml
alert: InboxOverload
expr: |
  velya_task_inbox_depth{priority="critical"} > 20
for: 5m
labels:
  severity: critical
  domain: clinical
  owner: clinical-office
annotations:
  summary: 'Inbox clínico com {{ $value }} tarefas críticas acumuladas'
  impact: 'CLÍNICO: Volume anormal de tarefas críticas sem atendimento. Risco de atraso em cuidados urgentes.'
  dashboard_url: 'http://grafana/d/velya-clinical-inbox-intelligence-board'
  runbook_url: 'https://docs.velya/runbooks/inbox-overload'
```

---

#### CLIN-003: NoNextAction

```yaml
alert: NoNextAction
expr: |
  velya_task_inbox_unowned_total{priority=~"critical|high"} > 5
for: 10m
labels:
  severity: high
  domain: clinical
  owner: clinical-office
annotations:
  summary: '{{ $value }} tarefas de alta prioridade sem dono na inbox clínica'
  impact: 'Tarefas críticas aguardando atribuição. Risco de SLA clínico não atendido.'
  runbook_url: 'https://docs.velya/runbooks/no-next-action'
```

---

#### CLIN-004: HandoffStuck

```yaml
alert: HandoffStuck
expr: |
  velya_agent_handoff_total{status="stuck"} > 0
for: 15m
labels:
  severity: high
  domain: clinical
  owner: agents-office
annotations:
  summary: 'Handoff de agent parado por mais de 15 minutos'
  impact: 'Processo clínico interrompido. Tasks do workflow podem estar bloqueadas aguardando handoff.'
  dashboard_url: 'http://grafana/d/velya-agents-handoff-monitor'
  runbook_url: 'https://docs.velya/runbooks/handoff-stuck'
```

---

#### CLIN-005: ClinicalAlertDeliveryLatencyHigh

```yaml
alert: ClinicalAlertDeliveryLatencyHigh
expr: |
  histogram_quantile(0.95, rate(velya_clinical_alert_delivery_latency_seconds_bucket[5m])) > 30
for: 5m
labels:
  severity: critical
  domain: clinical
  owner: backend-office
annotations:
  summary: 'Alertas clínicos com P95 de latência de entrega > 30 segundos'
  impact: 'CRÍTICO: Alertas clínicos chegando com atraso > 30s para profissionais de saúde. Risco direto ao paciente.'
  runbook_url: 'https://docs.velya/runbooks/clinical-alert-delivery-latency'
```

---

#### CLIN-006: DischargeBacklogGrowing

```yaml
alert: DischargeBacklogGrowing
expr: |
  deriv(velya_discharge_pending_total[30m]) > 0.5
for: 20m
labels:
  severity: medium
  domain: clinical
  owner: clinical-office
annotations:
  summary: 'Backlog de altas crescendo continuamente há 20 minutos'
  impact: 'Tendência negativa: mais altas sendo criadas do que resolvidas. Pressão de leitos iminente.'
  dashboard_url: 'http://grafana/d/velya-clinical-discharge-control-board'
  runbook_url: 'https://docs.velya/runbooks/discharge-backlog'
```

---

### 3.7 Custo e Observabilidade (5 alertas)

#### COST-001: PrometheusHighCardinality

```yaml
alert: PrometheusHighCardinality
expr: prometheus_tsdb_head_series > 800000
for: 15m
labels:
  severity: medium
  domain: cost
  owner: platform-office
annotations:
  summary: 'Prometheus com {{ $value | humanize }} time series — acima de 800K'
  impact: 'Risco de degradação de performance e custo elevado de storage. Investigar explosão de cardinalidade.'
  dashboard_url: 'http://grafana/d/velya-cost-observability-board'
  runbook_url: 'https://docs.velya/runbooks/prometheus-high-cardinality'
  initial_action: "Identificar top labels por cardinalidade: topk(10, count by (__name__) ({__name__=~'.+'}))"
```

---

#### COST-002: LokiIngestionSpike

```yaml
alert: LokiIngestionSpike
expr: |
  rate(loki_ingester_bytes_received_total[1h]) > (15 * 1024 * 1024 * 1024 / 3600)
for: 30m
labels:
  severity: medium
  domain: cost
  owner: platform-office
annotations:
  summary: 'Loki ingerindo acima de 15GB/dia'
  impact: 'Custo de storage elevado e possível degradação de Loki'
  dashboard_url: 'http://grafana/d/velya-cost-observability-board'
  runbook_url: 'https://docs.velya/runbooks/loki-ingestion-spike'
```

---

#### COST-003: KEDAThrashCost

```yaml
alert: KEDAThrashCost
expr: |
  changes(kube_deployment_spec_replicas{namespace=~"velya-.+"}[1h]) > 20
for: 10m
labels:
  severity: medium
  domain: cost
  owner: platform-office
annotations:
  summary: 'Deployment {{ $labels.deployment }} com mais de 20 eventos de scaling em 1 hora (thrash de custo)'
  impact: 'Scaling thrash gera custo computacional desnecessário e instabilidade'
  runbook_url: 'https://docs.velya/runbooks/keda-thrash'
```

---

#### COST-004: AITokenConsumptionHigh

```yaml
alert: AITokenConsumptionHigh
expr: |
  sum(rate(velya_ai_token_consumption_total[1h])) by (agent_name) > 100000
for: 10m
labels:
  severity: high
  domain: cost
  owner: agents-office
annotations:
  summary: 'Agent {{ $labels.agent_name }} consumindo mais de 100K tokens/hora'
  impact: 'Custo de inferência anormalmente alto. Revisar prompts e possíveis loops.'
  runbook_url: 'https://docs.velya/runbooks/ai-token-cost'
```

---

#### COST-005: PrometheusStorageGrowing

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
  summary: 'Storage do Prometheus acima de 50GB e crescendo'
  impact: 'PVC do Prometheus pode encher. Revisar retenção e compactação.'
  runbook_url: 'https://docs.velya/runbooks/prometheus-storage'
```

---

## 4. Resumo do Catálogo de Alertas

| Domínio         | Total  | Crítico | Alto   | Médio  | Baixo |
| --------------- | ------ | ------- | ------ | ------ | ----- |
| Infraestrutura  | 15     | 5       | 5      | 4      | 1     |
| Plataforma      | 8      | 2       | 3      | 2      | 1     |
| Backend         | 10     | 3       | 5      | 1      | 1     |
| Frontend        | 5      | 0       | 3      | 2      | 0     |
| Agents          | 8      | 2       | 4      | 2      | 0     |
| Negócio Clínico | 6      | 3       | 2      | 1      | 0     |
| Custo           | 5      | 0       | 1      | 3      | 1     |
| **Total**       | **57** | **15**  | **23** | **15** | **4** |

---

## 5. Estado Atual dos Alertas

| Alerta Existente                         | Estado                       | Problema                                                                |
| ---------------------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| velya-service-alerts (5 alertas básicos) | Definido como PrometheusRule | Sem contact points reais. Alertmanager sem Slack/PagerDuty configurado. |
| 52 alertas neste catálogo                | Não implementado             | Aguardando ServiceMonitors e métricas customizadas                      |

**Ação imediata necessária**:

1. Configurar Alertmanager com Slack webhook
2. Implementar ServiceMonitors para todos os serviços
3. Implementar métricas customizadas velya\_\* nos serviços NestJS
4. Adicionar runbooks para os 5 alertas existentes
