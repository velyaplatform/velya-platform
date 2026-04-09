# Catálogo de Dashboards — Velya Platform

> Catálogo oficial de todos os dashboards que devem existir na plataforma Velya.
> Novos dashboards devem ser registrados aqui antes de serem implementados.
> Última atualização: 2026-04-08

**Legenda de Status**:

- `Implementado` — Existe no Grafana e versionado em Git
- `Planejado` — Definido, aguardando implementação
- `Prioritário` — Deve ser implementado no próximo sprint

**Padrão de ID**: `velya-{domínio}-{propósito}`

---

## Categoria 1: Infraestrutura (7 dashboards)

### velya-infra-cluster-overview

| Campo                      | Valor                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| **Nome**                   | Visão Geral do Cluster                                                                      |
| **Objetivo**               | Panorama de saúde do cluster kind-velya-local em tempo real                                 |
| **Perguntas que responde** | O cluster está saudável? Algum nó com pressão? Algum namespace consumindo além do esperado? |
| **Usuários-alvo**          | Engenharia de Platform, NOC                                                                 |
| **Frequência de uso**      | Sempre aberto (tela de NOC)                                                                 |
| **Owner**                  | platform-office                                                                             |
| **Status**                 | Planejado                                                                                   |

**Métricas principais**:

- `kube_node_status_condition{condition="Ready",status="true"}` — health dos nós
- `sum(kube_pod_container_status_running) by (namespace)` — pods rodando por namespace
- `sum(kube_pod_container_status_waiting_reason{reason="CrashLoopBackOff"}) by (namespace)` — crash loops
- `sum(container_memory_usage_bytes) by (namespace)` — memória por namespace
- `sum(rate(container_cpu_usage_seconds_total[5m])) by (namespace)` — CPU por namespace

**Visualizações**:

- Stat: nodes ativos / total
- Stat: pods running / total / crashloopbackoff (3 stats em linha)
- Time Series: CPU e memória por namespace (stacked)
- Table: top pods por consumo de memória
- State Timeline: status de cada namespace ao longo das últimas 6 horas

**Links**: velya-infra-node-nodepool, velya-infra-namespace-health, velya-keda-scaling-monitor

---

### velya-infra-node-nodepool

| Campo                      | Valor                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| **Nome**                   | Node e NodePool Health                                                                         |
| **Objetivo**               | Saúde detalhada de cada nó do cluster                                                          |
| **Perguntas que responde** | Qual nó está com pressão de memória ou disco? CPU throttling em algum nó? Nó com DiskPressure? |
| **Usuários-alvo**          | Engenharia de Platform                                                                         |
| **Frequência de uso**      | Investigação e incidente                                                                       |
| **Owner**                  | platform-office                                                                                |
| **Status**                 | Planejado                                                                                      |

**Métricas principais**:

- `node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes` — memória disponível por nó
- `rate(node_cpu_seconds_total{mode!="idle"}[5m])` — CPU usage por nó
- `node_filesystem_avail_bytes / node_filesystem_size_bytes` — disco disponível por nó
- `kube_node_status_condition` — conditions: MemoryPressure, DiskPressure, PIDPressure

**Visualizações**:

- Gauge: CPU usage % por nó
- Gauge: Memória usage % por nó
- Gauge: Disco usage % por nó (com threshold crítico em 85%)
- Time Series: CPU/Memória por nó ao longo do tempo
- Table: conditions anômalas ativas nos nós

**Links**: velya-infra-cluster-overview

---

### velya-infra-namespace-health

| Campo                      | Valor                                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Namespace Health                                                                                                                         |
| **Objetivo**               | Saúde de cada namespace Velya em detalhe                                                                                                 |
| **Perguntas que responde** | Qual namespace Velya está com mais pods reiniciando? Há pods em Pending há mais de X minutos? Algum namespace próximo ao resource limit? |
| **Usuários-alvo**          | Engenharia de Platform, Engenharia de Backend                                                                                            |
| **Frequência de uso**      | Diário, investigação                                                                                                                     |
| **Owner**                  | platform-office                                                                                                                          |
| **Status**                 | Planejado                                                                                                                                |

**Variável**: `$namespace` multi-value (velya-dev-core, velya-dev-platform, velya-dev-agents, velya-dev-web)

**Métricas principais**:

- `kube_pod_status_phase` por namespace — distribuição de fases de pods
- `kube_pod_container_status_restarts_total` — reinicios por pod
- `sum(kube_resourcequota_used) / sum(kube_resourcequota_hard)` — uso de quota por namespace
- `kube_pod_status_condition{condition="PodScheduled",status="false"}` — pods não agendados

**Visualizações**:

- Stat: pods por fase (Running/Pending/Failed/Succeeded) — 4 stats
- Table: pods com mais reinicios nas últimas 24h
- Bar Gauge: uso de CPU quota por namespace
- Bar Gauge: uso de memória quota por namespace
- Time Series: reinicios de container ao longo do tempo

---

### velya-infra-scheduling-quotas

| Campo                      | Valor                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Scheduling e Quotas                                                                                                           |
| **Objetivo**               | Detectar falhas de agendamento e pressão de recursos                                                                          |
| **Perguntas que responde** | Há pods em Pending por falta de recursos? Qual namespace está próximo da quota? PriorityClass está funcionando como esperado? |
| **Usuários-alvo**          | Engenharia de Platform                                                                                                        |
| **Frequência de uso**      | Investigação de incidente de scheduling                                                                                       |
| **Owner**                  | platform-office                                                                                                               |
| **Status**                 | Planejado                                                                                                                     |

**Métricas principais**:

- `kube_pod_status_unschedulable` — pods não agendáveis
- `kube_pod_status_reason{reason="Evicted"}` — pods evicted
- `scheduler_pending_pods` — fila do scheduler
- `kube_resourcequota_used / kube_resourcequota_hard` — ratio de uso de quota

**Visualizações**:

- Stat: pods unschedulable agora
- Time Series: pods pending ao longo do tempo por namespace
- Table: eventos de eviction recentes
- Table: quotas por namespace com % de uso

---

### velya-infra-storage-network

| Campo                      | Valor                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Storage e Rede                                                                                                      |
| **Objetivo**               | Monitorar PVCs e tráfego de rede                                                                                    |
| **Perguntas que responde** | Algum PVC próximo da capacidade? Há anomalia de tráfego de rede entre namespaces? Latência de I/O de disco elevada? |
| **Usuários-alvo**          | Engenharia de Platform                                                                                              |
| **Frequência de uso**      | Investigação, incidente de storage                                                                                  |
| **Owner**                  | platform-office                                                                                                     |
| **Status**                 | Planejado                                                                                                           |

**Métricas principais**:

- `kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes` — % uso PVC
- `rate(container_network_receive_bytes_total[5m])` — bytes recebidos por namespace
- `rate(container_network_transmit_bytes_total[5m])` — bytes enviados por namespace

**Visualizações**:

- Bar Gauge: % uso de cada PVC (threshold vermelho em 85%)
- Time Series: tráfego de rede IN/OUT por namespace

---

### velya-keda-scaling-monitor

| Campo                      | Valor                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | KEDA Scaling Monitor                                                                                                                                          |
| **Objetivo**               | Monitorar comportamento de autoescalabilidade dos ScaledObjects                                                                                               |
| **Perguntas que responde** | Algum ScaledObject está em thrash (escalar-desescalar repetidamente)? Os triggers Prometheus estão respondendo? Quais serviços escalaram nas últimas 6 horas? |
| **Usuários-alvo**          | Engenharia de Platform, Engenharia de Backend                                                                                                                 |
| **Frequência de uso**      | Diário, investigação de scaling                                                                                                                               |
| **Owner**                  | platform-office                                                                                                                                               |
| **Status**                 | Planejado                                                                                                                                                     |

**ScaledObjects ativos**: patient-flow, task-inbox, discharge-orchestrator, api-gateway, ai-gateway

**Métricas principais**:

- `keda_scaler_active` — ScaledObjects ativos
- `keda_scaler_metrics_value` — valor da métrica do trigger por ScaledObject
- `kube_deployment_spec_replicas` — réplicas desejadas vs. `kube_deployment_status_replicas_available`
- Taxa de scale events: mudanças em `kube_deployment_spec_replicas` por ScaledObject

**Visualizações**:

- State Timeline: estado de scaling por ScaledObject (scaled-up/scaled-down)
- Time Series: réplicas desejadas vs. disponíveis por deployment
- Time Series: valor do trigger Prometheus por ScaledObject

**Links**: velya-backend-api-red

---

### velya-infra-argocd-delivery-monitor

| Campo                      | Valor                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Nome**                   | ArgoCD Delivery Monitor                                                                                |
| **Objetivo**               | Monitorar estado de sincronização das Applications ArgoCD                                              |
| **Perguntas que responde** | Alguma Application fora de sync? Última sincronização bem-sucedida foi há quanto tempo? Deploy falhou? |
| **Usuários-alvo**          | Engenharia de Platform, Engenharia de Backend                                                          |
| **Frequência de uso**      | Após deploys, incidentes de GitOps                                                                     |
| **Owner**                  | platform-office                                                                                        |
| **Status**                 | Planejado                                                                                              |

**Métricas principais**:

- `argocd_app_info{sync_status="OutOfSync"}` — applications fora de sync
- `argocd_app_info{health_status="Degraded"}` — applications degradadas
- `argocd_app_sync_total` — histórico de syncs

**Visualizações**:

- Stat: applications em sync / total
- Table: applications com status != Synced ou != Healthy
- Time Series: eventos de sync ao longo do tempo

---

## Categoria 2: Backend (6 dashboards)

### velya-backend-api-red

| Campo                      | Valor                                                                                                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Nome**                   | API RED Dashboard — Rate, Errors, Duration por serviço                                                     |
| **Objetivo**               | Golden signals HTTP de todos os serviços backend em um único lugar                                         |
| **Perguntas que responde** | Qual serviço tem a maior taxa de erros agora? Qual tem P99 acima do SLO? Qual está recebendo mais tráfego? |
| **Usuários-alvo**          | NOC, Engenharia de Backend, Eng. de Plantão                                                                |
| **Frequência de uso**      | Sempre aberto                                                                                              |
| **Owner**                  | backend-office                                                                                             |
| **Status**                 | Prioritário                                                                                                |

**Variável**: `$service` com opção All

**Métricas principais**:

```promql
# Rate (requests/segundo)
rate(http_requests_total{service="$service"}[5m])

# Error rate
rate(http_requests_total{service="$service",status=~"5.."}[5m]) /
rate(http_requests_total{service="$service"}[5m])

# P99 latência
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="$service"}[$__rate_interval]))
```

**Visualizações**:

- Time Series: rate por serviço (todas as linhas em um gráfico, coloridas por serviço)
- Time Series: error rate por serviço (threshold line em 1% e 5%)
- Time Series: P50/P95/P99 latência por serviço
- Table: snapshot atual — serviço, rate, error%, P99 (ordenado por error%)

**Links**: velya-backend-dependency-map, velya-backend-queue-worker-health

---

### velya-backend-dependency-map

| Campo                      | Valor                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Mapa de Dependências de Serviços                                                                         |
| **Objetivo**               | Visualizar topologia de chamadas entre serviços e identificar gargalos                                   |
| **Perguntas que responde** | Qual serviço está sendo chamado com maior taxa de erro? Qual dependência está causando latência cascata? |
| **Usuários-alvo**          | Engenharia de Backend, Arquitetos                                                                        |
| **Frequência de uso**      | Investigação de incidente                                                                                |
| **Owner**                  | backend-office                                                                                           |
| **Status**                 | Planejado (requer Tempo para dados de trace)                                                             |

**Visualizações**:

- Node Graph: nós = serviços, arestas = chamadas, espessura = volume, cor = error rate
- Table: top 10 pares origem→destino por latência

---

### velya-backend-queue-worker-health

| Campo                      | Valor                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| **Nome**                   | Queue e Worker Health                                                                           |
| **Objetivo**               | Monitorar filas NATS e workers Temporal                                                         |
| **Perguntas que responde** | Alguma fila acumulando mensagens sem processamento? Há dead letters? Workers Temporal em crash? |
| **Usuários-alvo**          | Engenharia de Backend, NOC                                                                      |
| **Frequência de uso**      | Diário, investigação                                                                            |
| **Owner**                  | backend-office                                                                                  |
| **Status**                 | Planejado                                                                                       |

**Métricas principais**:

- `nats_consumer_num_pending` — mensagens pendentes por consumer
- `nats_consumer_num_ack_pending` — mensagens em processamento por consumer
- `temporal_workflow_task_queue_poll_succeed_total` — workers ativos por task queue

**Visualizações**:

- Bar Gauge: profundidade de fila por consumer (threshold vermelho quando > limite operacional)
- Time Series: mensagens pendentes ao longo do tempo por consumer
- Stat: dead letters acumuladas (threshold crítico em qualquer valor > 0)

---

### velya-backend-postgresql-performance

| Campo                      | Valor                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------- |
| **Nome**                   | Performance PostgreSQL                                                                |
| **Objetivo**               | Monitorar saúde e performance do banco de dados                                       |
| **Perguntas que responde** | Há queries lentas? Pool de conexões esgotando? Taxa de cache hit baixa? Locks ativos? |
| **Usuários-alvo**          | Engenharia de Backend, DBA                                                            |
| **Frequência de uso**      | Investigação de lentidão de backend                                                   |
| **Owner**                  | backend-office                                                                        |
| **Status**                 | Planejado                                                                             |

**Métricas principais** (via postgres_exporter):

- `pg_stat_database_blks_hit / (pg_stat_database_blks_hit + pg_stat_database_blks_read)` — cache hit ratio
- `pg_stat_activity_count` — conexões ativas por estado
- `pg_locks_count` — locks ativos por tipo

**Visualizações**:

- Gauge: cache hit ratio (meta: > 95%)
- Time Series: conexões por estado (active, idle, idle in transaction, waiting)
- Table: queries mais lentas (requer pg_stat_statements)

---

### velya-backend-integration-health

| Campo                      | Valor                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Integration Health                                                                                            |
| **Objetivo**               | Monitorar saúde das integrações externas (NATS, PostgreSQL, AI providers)                                     |
| **Perguntas que responde** | Alguma integração com taxa de erro elevada? Latência de conexão ao NATS anormal? Reconexões frequentes ao DB? |
| **Usuários-alvo**          | Engenharia de Backend, NOC                                                                                    |
| **Frequência de uso**      | Investigação de incidente de integração                                                                       |
| **Owner**                  | backend-office                                                                                                |
| **Status**                 | Planejado                                                                                                     |

**Visualizações**:

- State Timeline: estado de cada integração ao longo do tempo (up/degraded/down)
- Time Series: latência de conexão por integração

---

### velya-backend-ai-gateway-performance

| Campo                      | Valor                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | AI Gateway Performance                                                                                                              |
| **Objetivo**               | Monitorar latência, erros e consumo de tokens do AI Gateway                                                                         |
| **Perguntas que responde** | Qual modelo tem maior latência agora? Há erros de rate-limit? Qual agent está consumindo mais tokens? Custo de inferência por hora? |
| **Usuários-alvo**          | Engenharia de Agents, Eng. de Platform, Product Owners                                                                              |
| **Frequência de uso**      | Diário, investigação de custo                                                                                                       |
| **Owner**                  | agents-office                                                                                                                       |
| **Status**                 | Prioritário                                                                                                                         |

**Métricas principais**:

```promql
# Latência por modelo
histogram_quantile(0.99, rate(velya_ai_request_duration_seconds_bucket{model="$model"}[$__rate_interval]))

# Tokens consumidos por agent
rate(velya_ai_token_consumption_total{agent_name="$agent_name"}[1h])

# Taxa de erros por tipo
rate(velya_ai_error_total{error_type="rate_limit"}[5m])
```

**Visualizações**:

- Time Series: latência P50/P99 por modelo
- Bar Chart: tokens por agent nas últimas 1h (ordenado descendente)
- Stat: erros de rate-limit nas últimas 1h
- Time Series: token consumption por modelo ao longo do dia

**Links**: velya-agents-oversight-console, velya-cost-observability

---

## Categoria 3: Frontend (5 dashboards)

### velya-frontend-experience-overview

| Campo                      | Valor                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Frontend Experience Overview                                                                                            |
| **Objetivo**               | Panorama da experiência do usuário no velya-web                                                                         |
| **Perguntas que responde** | O frontend está lento para os usuários clínicos? Há erros de JavaScript aumentando? Alguma rota está com LCP degradado? |
| **Usuários-alvo**          | Engenharia de Frontend, Product Owners, NOC                                                                             |
| **Frequência de uso**      | Diário                                                                                                                  |
| **Owner**                  | frontend-office                                                                                                         |
| **Status**                 | Planejado (requer instrumentação frontend)                                                                              |

**Métricas principais**:

- `velya_web_lcp_seconds` — Largest Contentful Paint por rota
- `velya_web_inp_milliseconds` — Interaction to Next Paint
- `velya_web_cls_score` — Cumulative Layout Shift
- `velya_web_js_error_total` — erros JavaScript por tipo
- `velya_web_api_error_total` — chamadas API falhadas do ponto de vista do usuário

**Visualizações**:

- Stat: LCP mediano (meta: < 2.5s, bom: < 1s)
- Stat: INP mediano (meta: < 200ms)
- Stat: erros JavaScript na última hora
- Time Series: Core Web Vitals ao longo do tempo por rota
- Table: top 5 rotas com pior LCP

---

### velya-frontend-route-performance

| Campo                      | Valor                                                                                                                  |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Route Performance                                                                                                      |
| **Objetivo**               | Performance detalhada por rota do Next.js                                                                              |
| **Perguntas que responde** | A rota /discharge está mais lenta do que a de ontem? /patients está demorando mais para carregar após o último deploy? |
| **Usuários-alvo**          | Engenharia de Frontend                                                                                                 |
| **Frequência de uso**      | Investigação e após deploys                                                                                            |
| **Owner**                  | frontend-office                                                                                                        |
| **Status**                 | Planejado                                                                                                              |

**Variável**: `$route` — /patients, /tasks, /discharge, /system, /dashboard

**Visualizações**:

- Time Series: tempo de navegação por rota (P50/P95)
- Heatmap: distribuição de tempo de carregamento por rota
- Bar Chart: comparativo de P95 por rota

---

### velya-frontend-ux-friction-board

| Campo                      | Valor                                                                                                                                                            |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | UX Friction Board                                                                                                                                                |
| **Objetivo**               | Identificar pontos de atrito na jornada do usuário clínico                                                                                                       |
| **Perguntas que responde** | Usuários estão abandonando o fluxo de alta no meio? Quantos cliques são necessários para completar uma tarefa? Alguma tela requer mais de X interações em média? |
| **Usuários-alvo**          | Product Owners, UX Designers, Engenharia de Frontend                                                                                                             |
| **Frequência de uso**      | Semanal, iterações de produto                                                                                                                                    |
| **Owner**                  | frontend-office                                                                                                                                                  |
| **Status**                 | Planejado                                                                                                                                                        |

**Métricas principais**:

- `velya_web_task_click_count{task_type}` — cliques por tipo de tarefa
- `velya_web_flow_abandonment_total{flow}` — abandonos de fluxo por tipo
- `velya_web_time_to_first_action_seconds{route}` — tempo até primeira ação significativa

---

### velya-frontend-action-failure-board

| Campo                      | Valor                                                                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Action Failure Board                                                                                                                                          |
| **Objetivo**               | Monitorar falhas em ações clínicas realizadas pelo usuário                                                                                                    |
| **Perguntas que responde** | Usuários estão recebendo erros ao tentar registrar alta? Formulários estão falhando ao submeter? Quais erros API acontecem mais do ponto de vista do usuário? |
| **Usuários-alvo**          | Engenharia de Frontend, NOC                                                                                                                                   |
| **Frequência de uso**      | Diário, incidente                                                                                                                                             |
| **Owner**                  | frontend-office                                                                                                                                               |
| **Status**                 | Planejado                                                                                                                                                     |

**Visualizações**:

- Time Series: ações falhadas por tipo de ação
- Table: top 10 erros por frequência (error_code, rota, count)
- Stat: failed fetch total na última 1h

---

### velya-frontend-degraded-mode-board

| Campo                      | Valor                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Degraded Mode Board                                                                                                                                         |
| **Objetivo**               | Monitorar ativações do modo degradado e sobreposições manuais                                                                                               |
| **Perguntas que responde** | O frontend está operando em modo degradado? Usuários estão recebendo dados de cache stale? Há sobreposição manual de recomendações de AI em volume anormal? |
| **Usuários-alvo**          | NOC, Engenharia de Platform                                                                                                                                 |
| **Frequência de uso**      | Incidente, monitoramento de resiliência                                                                                                                     |
| **Owner**                  | frontend-office                                                                                                                                             |
| **Status**                 | Planejado                                                                                                                                                   |

**Métricas principais**:

- `velya_degraded_mode_active{service="velya-web"}` — indicador de modo degradado ativo
- `velya_web_ai_recommendation_override_total` — sobreposições de recomendação AI
- `velya_web_stale_data_served_total` — dados de cache sendo servidos

---

## Categoria 4: Agents e Empresa Digital (8 dashboards)

### velya-agents-oversight-console

| Campo                      | Valor                                                                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Agent Oversight Console                                                                                                                                             |
| **Objetivo**               | Painel central de supervisão de todos os agents da empresa digital                                                                                                  |
| **Perguntas que responde** | Todos os agents estão ativos? Algum agent silencioso há mais de 30 minutos? Qual agent tem maior taxa de rejeição de validação? Há loop de correção em algum agent? |
| **Usuários-alvo**          | NOC, Gestão da Empresa Digital, Engenharia de Agents                                                                                                                |
| **Frequência de uso**      | Sempre aberto (tela de supervisão)                                                                                                                                  |
| **Owner**                  | agents-office                                                                                                                                                       |
| **Status**                 | Prioritário                                                                                                                                                         |

**Métricas principais**:

```promql
# Estado de cada agent (tempo desde última atividade)
time() - velya_agent_last_activity_timestamp{agent_name="$agent_name"}

# Taxa de validação
rate(velya_agent_validation_result_total{result="pass"}[1h]) /
rate(velya_agent_validation_result_total[1h])

# Loop de correção
velya_agent_correction_loop_count{agent_name="$agent_name"} > 3
```

**Visualizações**:

- Canvas: diagrama visual dos offices com agents coloridos por estado
- State Timeline: estado de cada agent nas últimas 6 horas (healthy/degraded/silent/quarantined)
- Table: ranking de agents por taxa de rejeição de validação (últimas 24h)
- Bar Chart: throughput de tarefas por office
- Stat: agents silenciosos agora (threshold crítico em qualquer valor > 0)

**Links**: velya-agents-validation-board, velya-agents-audit-board, velya-agents-quarantine-center

---

### velya-agents-office-health-board

| Campo                      | Valor                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Office Health Board                                                                                                             |
| **Objetivo**               | Saúde de cada office da empresa digital                                                                                         |
| **Perguntas que responde** | O clinical-office está com backlog acima do normal? Qual office tem mais handoffs saindo? Qual tem mais rejeições de validação? |
| **Usuários-alvo**          | Gestão da Empresa Digital, Product Owners                                                                                       |
| **Frequência de uso**      | Diário                                                                                                                          |
| **Owner**                  | agents-office                                                                                                                   |
| **Status**                 | Planejado                                                                                                                       |

**Variável**: `$office`

**Métricas principais**:

- `velya_office_backlog_depth{office}` — profundidade de backlog por office
- `velya_agent_handoff_total{source_office, destination_office}` — matriz de handoffs
- `velya_agent_validation_pass_rate{office}` — taxa de aprovação por office

**Visualizações**:

- Heatmap: matriz de handoffs entre offices (origem × destino × volume)
- Bar Gauge: backlog depth por office
- Time Series: evolução de backlog por office

---

### velya-agents-validation-board

| Campo                      | Valor                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Validation Board                                                                                                                               |
| **Objetivo**               | Monitorar qualidade das saídas dos agents via validação                                                                                        |
| **Perguntas que responde** | A taxa de aprovação caiu após a última versão do agent? Que tipo de rejeição ocorre mais? Há regressão de qualidade em algum agent específico? |
| **Usuários-alvo**          | Engenharia de Agents, Quality Office                                                                                                           |
| **Frequência de uso**      | Diário, após releases                                                                                                                          |
| **Owner**                  | agents-office                                                                                                                                  |
| **Status**                 | Planejado                                                                                                                                      |

**Visualizações**:

- Time Series: pass rate por agent ao longo do tempo (comparar antes/depois de deploy com annotation)
- Bar Chart: distribuição de resultados (pass/fail/skip) por agent
- Table: top 10 tipos de falha de validação

---

### velya-agents-audit-board

| Campo                      | Valor                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Nome**                   | Audit Board                                                                                                              |
| **Objetivo**               | Auditoria de todas as ações clínicas realizadas por agents                                                               |
| **Perguntas que responde** | Quais decisions foram tomadas por agents nas últimas 24h? Algum agent tomou ação em dado de alta classificação de risco? |
| **Usuários-alvo**          | Compliance, Gestão Clínica, Auditoria                                                                                    |
| **Frequência de uso**      | Semanal, auditoria regulatória                                                                                           |
| **Owner**                  | compliance-office                                                                                                        |
| **Status**                 | Planejado                                                                                                                |

**Fonte de dados**: Loki (decision-log service)

**Query LogQL de exemplo**:

```logql
{service="decision-log"} | json | risk_class="high" | line_format "{{.timestamp}} | {{.agent_name}} | {{.action}} | {{.outcome}}"
```

**Visualizações**:

- Logs: stream de decisões com filtros por agent, risk_class, outcome
- Stat: decisões de alto risco nas últimas 24h
- Bar Chart: distribuição de outcomes por agent

---

### velya-agents-handoff-monitor

| Campo                      | Valor                                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Handoff Monitor                                                                                                         |
| **Objetivo**               | Monitorar latência e qualidade dos handoffs entre agents/offices                                                        |
| **Perguntas que responde** | Há handoffs em estado "stuck" (sem progressão há mais de X minutos)? Qual par de offices tem maior latência de handoff? |
| **Usuários-alvo**          | Engenharia de Agents, NOC                                                                                               |
| **Frequência de uso**      | Monitoramento contínuo                                                                                                  |
| **Owner**                  | agents-office                                                                                                           |
| **Status**                 | Planejado                                                                                                               |

**Métricas principais**:

- `velya_agent_handoff_latency_seconds` — histograma de latência de handoff
- `velya_agent_handoff_total{status="stuck"}` — handoffs travados

**Visualizações**:

- Heatmap: latência de handoff por par de offices ao longo do dia
- Stat: handoffs stuck agora

---

### velya-agents-learning-monitor

| Campo                      | Valor                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Nome**                   | Learning Monitor                                                                                                         |
| **Objetivo**               | Monitorar sinais de aprendizado e adaptação dos agents                                                                   |
| **Perguntas que responde** | A taxa de retrabalho está caindo ao longo do tempo (agent aprendendo)? A taxa de correção após feedback está melhorando? |
| **Usuários-alvo**          | Engenharia de Agents, Product Owners                                                                                     |
| **Frequência de uso**      | Semanal                                                                                                                  |
| **Owner**                  | agents-office                                                                                                            |
| **Status**                 | Planejado                                                                                                                |

**Métricas principais**:

- `velya_agent_correction_recurrence_rate` — taxa de retrabalho ao longo do tempo
- `velya_agent_evidence_completeness_ratio` — qualidade de evidência por agent

**Visualizações**:

- Time Series: correction recurrence rate por agent (semanas) — tendência deve ser decrescente
- Time Series: evidence completeness ratio por agent

---

### velya-agents-quarantine-center

| Campo                      | Valor                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Quarantine Center                                                                                         |
| **Objetivo**               | Gerenciar e monitorar agents em estado de quarentena                                                      |
| **Perguntas que responde** | Quais agents estão em quarentena agora? Por quê foram quarentenados? Há quanto tempo estão em quarentena? |
| **Usuários-alvo**          | Engenharia de Agents, Gestão da Empresa Digital                                                           |
| **Frequência de uso**      | Incidente, revisão de qualidade                                                                           |
| **Owner**                  | agents-office                                                                                             |
| **Status**                 | Planejado                                                                                                 |

**Visualizações**:

- Table: agents em quarentena agora (agent_name, motivo, início da quarentena, duração)
- Logs: eventos de entrada em quarentena (LogQL filtrado por event_type="agent.quarantine.entered")
- Time Series: histórico de entradas em quarentena por agent

---

### velya-agents-promotion-retirement-board

| Campo                      | Valor                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Promotion & Retirement Board                                                                                                                                    |
| **Objetivo**               | Rastrear ciclo de vida de agents (promoção de versão e aposentadoria)                                                                                           |
| **Perguntas que responde** | Qual versão de cada agent está em produção? Há agents em período de shadow (paralelo com versão anterior)? Algum agent candidato à aposentadoria por baixo uso? |
| **Usuários-alvo**          | Engenharia de Agents, Product Owners                                                                                                                            |
| **Frequência de uso**      | Semanal, durante releases                                                                                                                                       |
| **Owner**                  | agents-office                                                                                                                                                   |
| **Status**                 | Planejado                                                                                                                                                       |

**Visualizações**:

- Table: inventory de agents com versão, data de deploy, taxa de uso
- Time Series: throughput por agent comparando versão atual vs. anterior (shadow mode)

---

## Categoria 5: Negócio Hospitalar (5 dashboards)

### velya-clinical-patient-flow-command-board

| Campo                      | Valor                                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Patient Flow Command Board                                                                                                   |
| **Objetivo**               | Visão executiva em tempo real do fluxo de pacientes no hospital                                                              |
| **Perguntas que responde** | Quantos pacientes estão aguardando alta agora? Qual unidade está com mais bloqueadores? Qual é a capacidade atual de leitos? |
| **Usuários-alvo**          | Gestão Hospitalar, Coordenadores Clínicos, NOC Clínico                                                                       |
| **Frequência de uso**      | Sempre aberto (tela de comando clínico)                                                                                      |
| **Owner**                  | clinical-office                                                                                                              |
| **Status**                 | Prioritário                                                                                                                  |

**Métricas principais**:

```promql
# Pacientes aguardando alta por tipo de bloqueador
velya_discharge_pending_total{blocker_type="medication"}
velya_discharge_pending_total{blocker_type="exam"}
velya_discharge_pending_total{blocker_type="social"}
velya_discharge_pending_total{blocker_type="transport"}

# Leitos por status
velya_patient_flow_active_count{unit="$unit", status="occupied"}
velya_patient_flow_active_count{unit="$unit", status="blocked"}
velya_patient_flow_active_count{unit="$unit", status="available"}

# Bloqueador mais antigo
max(velya_discharge_blocker_age_seconds) by (unit)
```

**Visualizações**:

- Canvas: planta das unidades com leitos coloridos (verde=livre, amarelo=ocupado, vermelho=bloqueado)
- Stat: pacientes aguardando alta (total)
- Stat: leitos disponíveis (total)
- Stat: bloqueador mais antigo (em horas, threshold crítico > 4h)
- Table: pacientes com alta bloqueada (patient_id, tipo de bloqueador, unidade, tempo de bloqueio)
- Bar Chart: bloqueadores por tipo

**Links**: velya-clinical-discharge-control-board, velya-clinical-capacity-bottleneck-board

---

### velya-clinical-discharge-control-board

| Campo                      | Valor                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Discharge Control Board                                                                                                                                     |
| **Objetivo**               | Monitorar o processo de alta médica em detalhe                                                                                                              |
| **Perguntas que responde** | Qual é o tempo médio entre decisão de alta e alta efetiva? Quais bloqueadores estão sem resolução há mais de 2 horas? Qual a taxa de altas dentro do prazo? |
| **Usuários-alvo**          | Coordenadores de Alta, Gestão Clínica                                                                                                                       |
| **Frequência de uso**      | Diário (shifts)                                                                                                                                             |
| **Owner**                  | clinical-office                                                                                                                                             |
| **Status**                 | Prioritário                                                                                                                                                 |

**Métricas principais**:

- `histogram_quantile(0.95, velya_discharge_blocker_age_seconds_bucket)` — P95 da idade de bloqueadores
- `velya_discharge_pending_total` por estágio (médico-pronto/aguardando-doc/aguardando-transporte)
- Taxa de alta dentro do prazo: `velya_discharge_on_time_total / velya_discharge_total`

**Visualizações**:

- Bar Gauge: altas pendentes por estágio do processo
- Histogram: distribuição da duração decision→alta efetiva
- Table: bloqueadores > 2h sem resolução
- Time Series: taxa de alta dentro do prazo ao longo da semana

---

### velya-clinical-capacity-bottleneck-board

| Campo                      | Valor                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Capacity & Bottleneck Board                                                                                                                    |
| **Objetivo**               | Identificar gargalos de capacidade antes que se tornem crises                                                                                  |
| **Perguntas que responde** | Qual unidade está com ocupação acima de 90%? Há previsão de sobrecarga nos próximos turnos? Qual tipo de bloqueador aparece mais nesta semana? |
| **Usuários-alvo**          | Gestão Hospitalar, Coordenação de Leitos                                                                                                       |
| **Frequência de uso**      | Diário, planejamento de turno                                                                                                                  |
| **Owner**                  | clinical-office                                                                                                                                |
| **Status**                 | Planejado                                                                                                                                      |

**Visualizações**:

- Gauge: % ocupação por unidade
- Bar Chart: top tipos de bloqueador na semana atual vs. semana anterior
- Time Series: evolução de ocupação por unidade ao longo da semana

---

### velya-clinical-inbox-intelligence-board

| Campo                      | Valor                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Inbox Intelligence Board                                                                                                    |
| **Objetivo**               | Monitorar saúde da fila de tarefas clínicas                                                                                 |
| **Perguntas que responde** | Há tarefas urgentes sem dono há mais de 15 minutos? Qual turno tem maior backlog? A fila está crescendo ou sendo resolvida? |
| **Usuários-alvo**          | Coordenadores Clínicos, NOC Clínico                                                                                         |
| **Frequência de uso**      | Sempre aberto durante turnos                                                                                                |
| **Owner**                  | clinical-office                                                                                                             |
| **Status**                 | Prioritário                                                                                                                 |

**Métricas principais**:

```promql
# Profundidade da fila por prioridade
velya_task_inbox_depth{priority="critical"}
velya_task_inbox_depth{priority="high"}
velya_task_inbox_depth{priority="medium"}
velya_task_inbox_depth{priority="low"}

# Tarefas sem dono por prioridade
velya_task_inbox_unowned_total{priority="critical"}

# Tempo médio de resposta
histogram_quantile(0.50, rate(velya_task_response_duration_seconds_bucket[1h]))
```

**Visualizações**:

- Bar Gauge: profundidade de fila por prioridade (threshold vermelho por prioridade)
- Stat: tarefas urgentes sem dono agora
- Time Series: evolução da fila por prioridade ao longo do turno
- Table: tarefas urgentes vencidas (SLA)

---

### velya-clinical-operational-risk-board

| Campo                      | Valor                                                                                                             |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Operational Risk Board                                                                                            |
| **Objetivo**               | Consolidar sinais de risco operacional clínico em um único lugar                                                  |
| **Perguntas que responde** | Há combinação de sinais de risco que indica situação crítica iminente? Qual é o score de risco operacional agora? |
| **Usuários-alvo**          | Gestão Hospitalar, Coordenação Clínica                                                                            |
| **Frequência de uso**      | Diário, reuniões de gestão                                                                                        |
| **Owner**                  | clinical-office                                                                                                   |
| **Status**                 | Planejado                                                                                                         |

**Visualizações**:

- Stat: score agregado de risco operacional (calculado via PromQL ponderado)
- Table: top 5 indicadores de risco ativos (com valor, threshold e link para dashboard)
- Time Series: evolução de score de risco ao longo da semana

---

## Categoria 6: Segurança / Compliance (2 dashboards)

### velya-security-secrets-identity-board

| Campo                      | Valor                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Secrets & Identity Board                                                                                                   |
| **Objetivo**               | Monitorar saúde de secrets, certificados e identidade                                                                      |
| **Perguntas que responde** | Há certificados expirando nos próximos 30 dias? Há falhas de retrieval de secrets? Há tentativas de acesso não autorizado? |
| **Usuários-alvo**          | Engenharia de Security, Compliance                                                                                         |
| **Frequência de uso**      | Diário                                                                                                                     |
| **Owner**                  | security-office                                                                                                            |
| **Status**                 | Planejado                                                                                                                  |

**Métricas principais**:

- `certmanager_certificate_expiration_timestamp_seconds - time()` — dias para expiração
- `velya_secret_retrieval_failure_total` — falhas de acesso a secrets

**Visualizações**:

- Bar Gauge: dias para expiração de cada certificado (threshold vermelho < 30 dias)
- Stat: falhas de secret retrieval na última hora
- Logs: tentativas de acesso negado (filtro em policy-engine)

---

### velya-security-policy-drift-board

| Campo                      | Valor                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Policy Drift Board                                                                                                                           |
| **Objetivo**               | Detectar desvios de configuração de segurança e políticas                                                                                    |
| **Perguntas que responde** | Há NetworkPolicies faltando em algum namespace? Algum pod está rodando sem security context definido? Há desvios de política do OPA/Kyverno? |
| **Usuários-alvo**          | Engenharia de Security, Compliance                                                                                                           |
| **Frequência de uso**      | Semanal, auditoria                                                                                                                           |
| **Owner**                  | security-office                                                                                                                              |
| **Status**                 | Planejado                                                                                                                                    |

**Visualizações**:

- Table: violations de policy por tipo e namespace
- Time Series: número de policy violations ao longo do tempo

---

## Categoria 7: Custo (2 dashboards)

### velya-cost-observability-board

| Campo                      | Valor                                                                                                                                                           |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Observability Cost Board                                                                                                                                        |
| **Objetivo**               | Monitorar custo da própria stack de observabilidade                                                                                                             |
| **Perguntas que responde** | Cardinalidade Prometheus está próxima do limite? Volume de logs Loki crescendo de forma anormal? Qual serviço está gerando mais labels (cardinality explosion)? |
| **Usuários-alvo**          | Engenharia de Platform                                                                                                                                          |
| **Frequência de uso**      | Semanal                                                                                                                                                         |
| **Owner**                  | platform-office                                                                                                                                                 |
| **Status**                 | Planejado                                                                                                                                                       |

**Métricas principais**:

```promql
# Total de time series no Prometheus
prometheus_tsdb_head_series

# Ingestão de Loki (bytes/segundo)
rate(loki_ingester_bytes_received_total[1h])

# Top séries por job/namespace
topk(10, count by (job) ({__name__=~".+"}))
```

**Visualizações**:

- Gauge: cardinalidade atual vs. limite de 1M (threshold warning em 800K)
- Time Series: evolução de cardinalidade ao longo do mês
- Bar Chart: top 10 jobs por número de series
- Time Series: volume de ingestion Loki por namespace

**Links**: velya-cost-namespace-nodepool

---

### velya-cost-namespace-nodepool

| Campo                      | Valor                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Nome**                   | Namespace e NodePool Cost Board                                                                                                       |
| **Objetivo**               | Atribuição de custo por namespace e workload                                                                                          |
| **Perguntas que responde** | Qual namespace consome mais CPU/memória de forma desproporcional? Há pods com request muito maior que o uso real (over-provisioning)? |
| **Usuários-alvo**          | Engenharia de Platform, Product Owners, FinOps                                                                                        |
| **Frequência de uso**      | Semanal, planejamento de capacidade                                                                                                   |
| **Owner**                  | platform-office                                                                                                                       |
| **Status**                 | Planejado                                                                                                                             |

**Métricas principais**:

```promql
# Over-provisioning: ratio entre request e uso real
sum(container_memory_usage_bytes) by (namespace) /
sum(kube_pod_container_resource_requests{resource="memory"}) by (namespace)

# Pods com uso muito abaixo do request (< 30%)
sum(rate(container_cpu_usage_seconds_total[1h])) by (pod, namespace) /
sum(kube_pod_container_resource_requests{resource="cpu"}) by (pod, namespace) < 0.3
```

**Visualizações**:

- Bar Chart: CPU request vs. CPU real por namespace
- Bar Chart: Memória request vs. Memória real por namespace
- Table: pods mais over-provisioned (candidatos a right-sizing)
- Time Series: tendência de custo relativo por namespace ao longo do mês

---

## Resumo do Catálogo

| Categoria            | Total  | Implementado | Planejado | Prioritário |
| -------------------- | ------ | ------------ | --------- | ----------- |
| Infraestrutura       | 7      | 0            | 7         | 0           |
| Backend              | 6      | 0            | 4         | 2           |
| Frontend             | 5      | 0            | 5         | 0           |
| Agents               | 8      | 0            | 7         | 1           |
| Negócio Hospitalar   | 5      | 0            | 2         | 3           |
| Segurança/Compliance | 2      | 0            | 2         | 0           |
| Custo                | 2      | 0            | 2         | 0           |
| **Total**            | **35** | **0**        | **29**    | **6**       |
