# Catalogo de Cenarios de Falha - Velya Platform

> Documento 15 da serie Layered Assurance + Self-Healing  
> Ultima atualizacao: 2026-04-08

---

## 1. Visao Geral

Este catalogo documenta **35 cenarios de falha** conhecidos para a Velya Platform, organizados em 6 categorias. Cada cenario inclui: gatilho, metodo de deteccao (com query PromQL/LogQL), impacto, resposta, prevencao e metodo de teste.

### Convencoes

| Severidade | Impacto | SLA de Resposta |
|---|---|---|
| P1 - Critico | Servico indisponivel, dados em risco | < 5 min |
| P2 - Alto | Degradacao significativa, funcionalidade comprometida | < 15 min |
| P3 - Medio | Degradacao menor, workaround disponivel | < 1h |
| P4 - Baixo | Impacto minimo, correcao planejada | < 24h |

---

## 2. Categoria: Deploy

### DEPLOY-001: Degradacao Lenta Pos-Deploy

| Campo | Descricao |
|---|---|
| **ID** | DEPLOY-001 |
| **Severidade** | P2 |
| **Gatilho** | Nova versao introduz regressao de performance que cresce gradualmente (memory leak, connection leak, goroutine leak) |
| **Deteccao** | PromQL: taxa de crescimento de memoria |
| **Impacto** | Latencia crescente ate OOMKill, restarts frequentes |
| **Resposta** | Rollback canary se em canary; rollback manual se pos-promocao |
| **Prevencao** | Load test com duracao >= 30min em staging; monitorar trend de memoria |
| **Teste** | Injetar memory leak artificial em staging e validar deteccao |

```promql
# Deteccao: crescimento de memoria > 10% em 30 minutos
deriv(container_memory_working_set_bytes{
  namespace="velya",
  container!="istio-proxy"
}[30m]) > 0
AND
(
  container_memory_working_set_bytes /
  kube_pod_container_resource_limits{resource="memory"}
) > 0.7
```

```yaml
# Alerta
- alert: VelyaSlowDegradation
  expr: |
    deriv(container_memory_working_set_bytes{namespace="velya",container!=""}[30m]) > 1e6
    AND increase(kube_pod_container_status_restarts_total{namespace="velya"}[1h]) > 0
  for: 10m
  labels:
    severity: warning
    category: deploy
  annotations:
    summary: "Degradacao lenta detectada em {{ $labels.pod }}"
    runbook: "docs/runbooks/deploy-001-slow-degradation.md"
```

---

### DEPLOY-002: Crescimento de Erros no Rollout

| Campo | Descricao |
|---|---|
| **ID** | DEPLOY-002 |
| **Severidade** | P1 |
| **Gatilho** | Canary recebe trafego e gera erros 5xx crescentes |
| **Deteccao** | AnalysisRun do Argo Rollouts detecta error rate > threshold |
| **Impacto** | Usuarios afetados proporcionalmente ao peso do canary |
| **Resposta** | Rollback automatico pelo Argo Rollouts |
| **Prevencao** | Testes de integracao cobrindo cenarios de erro; smoke tests pos-deploy |
| **Teste** | Deploy de versao com bug conhecido em staging e validar rollback |

```promql
# Deteccao: error rate do canary > 1%
sum(rate(http_requests_total{
  status=~"5..",
  rollouts_pod_template_hash=~".+",
  namespace="velya"
}[2m])) by (app)
/
sum(rate(http_requests_total{
  rollouts_pod_template_hash=~".+",
  namespace="velya"
}[2m])) by (app)
> 0.01
```

---

### DEPLOY-003: GitOps Drift

| Campo | Descricao |
|---|---|
| **ID** | DEPLOY-003 |
| **Severidade** | P3 |
| **Gatilho** | Alguem executa `kubectl apply` ou `kubectl edit` diretamente, criando drift entre Git e cluster |
| **Deteccao** | ArgoCD detecta OutOfSync |
| **Impacto** | Estado do cluster nao corresponde ao declarado; rollbacks podem reverter mudancas nao rastreadas |
| **Resposta** | Identificar autor do drift (audit log); sincronizar ArgoCD; reforcar politica |
| **Prevencao** | RBAC restritivo; OPA/Gatekeeper bloqueando applies diretos; alertas de drift |
| **Teste** | Aplicar mudanca manual e validar deteccao em < 5min |

```promql
# Deteccao: aplicacoes fora de sync
argocd_app_info{sync_status!="Synced"} > 0
```

```logql
# Deteccao via audit log: applies manuais
{job="kube-apiserver-audit"} |= "kubectl" |= "create" OR |= "patch" OR |= "update"
  | json | resource_namespace="velya"
  | user_username!~"system:serviceaccount:argocd:.*"
```

---

### DEPLOY-004: Imagem Nao Encontrada

| Campo | Descricao |
|---|---|
| **ID** | DEPLOY-004 |
| **Severidade** | P2 |
| **Gatilho** | Tag de imagem referenciada no manifesto nao existe no registry (typo, pipeline falhou, registry indisponivel) |
| **Deteccao** | Pods em ImagePullBackOff |
| **Impacto** | Deploy trava; pods nao iniciam |
| **Resposta** | Corrigir tag ou rebuild pipeline; verificar credenciais do registry |
| **Prevencao** | CI valida existencia da imagem antes de atualizar manifesto |
| **Teste** | Referenciar tag inexistente em staging |

```promql
# Deteccao
kube_pod_container_status_waiting_reason{reason="ImagePullBackOff",namespace="velya"} > 0
```

---

### DEPLOY-005: Migration de Banco Falha no Deploy

| Campo | Descricao |
|---|---|
| **ID** | DEPLOY-005 |
| **Severidade** | P1 |
| **Gatilho** | Init container de migration falha; schema incompativel entre versao antiga e nova |
| **Deteccao** | Pod stuck em Init:Error; migration job falha |
| **Impacto** | Servico nao inicia; dados podem estar em estado inconsistente |
| **Resposta** | Nao fazer rollback automatico (pode piorar); avaliar estado do schema; correcao manual |
| **Prevencao** | Migrations sempre aditivas; testar migration em copia do banco de producao |
| **Teste** | Simular falha de migration em staging com banco populado |

```promql
kube_pod_init_container_status_waiting_reason{reason="CrashLoopBackOff",namespace="velya"} > 0
```

---

## 3. Categoria: Infraestrutura

### INFRA-001: Node Pressure (CPU/Memory/Disk)

| Campo | Descricao |
|---|---|
| **ID** | INFRA-001 |
| **Severidade** | P2 |
| **Gatilho** | Nodes do EKS atingem limites de CPU, memoria ou disco |
| **Deteccao** | Node conditions: MemoryPressure, DiskPressure, PIDPressure |
| **Impacto** | Evictions de pods; scheduling failures; degradacao generalizada |
| **Resposta** | Escalar node group; identificar pods com consumo anomalo |
| **Prevencao** | Cluster autoscaler configurado; resource quotas por namespace; alertas antecipados |
| **Teste** | Stress test de nodes em staging |

```promql
# Deteccao: nodes com condicoes de pressao
kube_node_status_condition{condition=~"MemoryPressure|DiskPressure|PIDPressure",status="true"} > 0

# Antecipacao: uso de memoria do node > 85%
(
  1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)
) > 0.85
```

---

### INFRA-002: Scheduling Lag

| Campo | Descricao |
|---|---|
| **ID** | INFRA-002 |
| **Severidade** | P2 |
| **Gatilho** | Pods ficam em Pending por falta de recursos, node affinity, taints, ou PVC binding |
| **Deteccao** | Pods em Pending por > 2 minutos |
| **Impacto** | Replicas insuficientes; autoscaling nao efetiva; SLO comprometido |
| **Resposta** | Verificar eventos do pod; verificar capacidade do cluster; verificar PVCs |
| **Prevencao** | Headroom no cluster autoscaler; PriorityClasses definidas; monitorar scheduling latency |
| **Teste** | Criar deployment que excede capacidade disponivel |

```promql
# Deteccao: pods pendentes por mais de 2 minutos
min_over_time(kube_pod_status_phase{phase="Pending",namespace="velya"}[2m]) > 0
```

---

### INFRA-003: KEDA Mis-Scaling

| Campo | Descricao |
|---|---|
| **ID** | INFRA-003 |
| **Severidade** | P2 |
| **Gatilho** | KEDA scaler configurado incorretamente, gerando scaling excessivo (runaway) ou insuficiente |
| **Deteccao** | Replicas muito acima do esperado ou filas crescendo com replicas no maximo |
| **Impacto** | Custo excessivo (over-scale) ou degradacao de throughput (under-scale) |
| **Resposta** | Ajustar thresholds do ScaledObject; verificar fonte de metricas |
| **Prevencao** | MaxReplicaCount definido; testes de carga com KEDA ativo; alertas de replica count anomalo |
| **Teste** | Simular carga crescente e validar scaling proporcional |

```promql
# Deteccao: scaling excessivo
kube_deployment_spec_replicas{namespace="velya"} > 20

# Deteccao: fila crescendo apesar de replicas no maximo
nats_jetstream_consumer_num_pending > 10000
AND ON (deployment)
kube_deployment_spec_replicas == kube_deployment_spec_strategy_rollingupdate_max_surge + kube_deployment_status_replicas_available
```

```yaml
# Alerta
- alert: VelyaKEDAMisScale
  expr: |
    abs(
      kube_deployment_spec_replicas{namespace="velya"}
      - avg_over_time(kube_deployment_spec_replicas{namespace="velya"}[1h])
    ) > 5
  for: 10m
  labels:
    severity: warning
    category: infrastructure
  annotations:
    summary: "KEDA scaling anomalo para {{ $labels.deployment }}"
```

---

### INFRA-004: HPA Oscillation (Flapping)

| Campo | Descricao |
|---|---|
| **ID** | INFRA-004 |
| **Severidade** | P3 |
| **Gatilho** | HPA escala para cima e para baixo repetidamente em intervalos curtos |
| **Deteccao** | Variacao de replicas > 3 vezes em 15 minutos |
| **Impacto** | Instabilidade; conexoes perdidas durante scale-down; custo imprevisivel |
| **Resposta** | Ajustar stabilizationWindowSeconds; ajustar behavior policies |
| **Prevencao** | Configurar scaleDown.stabilizationWindowSeconds >= 300; usar HPA v2 com behavior |
| **Teste** | Variar carga sinusoidalmente e observar comportamento do HPA |

```promql
# Deteccao: mudancas frequentes de replicas
changes(kube_deployment_spec_replicas{namespace="velya"}[15m]) > 3
```

---

### INFRA-005: Storage Pressure (PVC/EBS)

| Campo | Descricao |
|---|---|
| **ID** | INFRA-005 |
| **Severidade** | P1 |
| **Gatilho** | Volume EBS atinge capacidade maxima; PVC nao pode expandir |
| **Deteccao** | kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.85 |
| **Impacto** | Escrita falha; banco de dados para; dados perdidos potencialmente |
| **Resposta** | Expandir PVC; limpar dados temporarios; escalar storage |
| **Prevencao** | Alertas em 70% e 85%; auto-expansion configurada; retencao de logs controlada |
| **Teste** | Preencher volume ate 85% em staging e validar alerta |

```promql
# Deteccao
kubelet_volume_stats_used_bytes{namespace="velya"}
/
kubelet_volume_stats_capacity_bytes{namespace="velya"}
> 0.85
```

---

### INFRA-006: NATS JetStream Cluster Desync

| Campo | Descricao |
|---|---|
| **ID** | INFRA-006 |
| **Severidade** | P1 |
| **Gatilho** | Particao de rede entre nos do NATS cluster; lider nao eleito |
| **Deteccao** | nats_jetstream_cluster_leader == 0 por > 30s |
| **Impacto** | Mensagens nao sao processadas; filas acumulam; workflows Temporal travam |
| **Resposta** | Verificar conectividade entre nos; forcar re-eleicao se necessario |
| **Prevencao** | 3 replicas em AZs distintas; network policies permissivas entre nos NATS |
| **Teste** | Simular particao de rede com network policy temporaria |

```promql
nats_jetstream_meta_cluster_size < 3
OR
nats_jetstream_server_jetstream_disabled == 1
```

---

### INFRA-007: External Secrets Sync Failure

| Campo | Descricao |
|---|---|
| **ID** | INFRA-007 |
| **Severidade** | P2 |
| **Gatilho** | External Secrets Operator nao consegue sincronizar secrets do AWS Secrets Manager (credenciais expiradas, quota atingida, secret deletado) |
| **Deteccao** | ExternalSecret status != SecretSynced |
| **Impacto** | Secrets desatualizados; rotacao de credenciais nao propagada; novos pods falham ao iniciar |
| **Resposta** | Verificar IAM role; verificar existencia do secret na AWS; verificar quota |
| **Prevencao** | Monitorar status de sync; alertar em falha > 5min; testar rotacao periodicamente |
| **Teste** | Revogar IAM temporariamente em staging e validar alerta |

```promql
externalsecret_status_condition{condition="SecretSynced",status="False",namespace="velya"} > 0
```

---

## 4. Categoria: Aplicacao

### APP-001: Retry Storm

| Campo | Descricao |
|---|---|
| **ID** | APP-001 |
| **Severidade** | P1 |
| **Gatilho** | Servico dependente falha e clientes fazem retry agressivo, amplificando a carga |
| **Deteccao** | Taxa de requests > 3x a baseline com error rate alto |
| **Impacto** | Cascata de falhas; timeout em servicos upstream; exaustao de recursos |
| **Resposta** | Ativar circuit breaker; limitar rate; escalar se possivel |
| **Prevencao** | Exponential backoff com jitter em todos os clients; circuit breakers; rate limiting |
| **Teste** | Derrubar dependencia em staging e observar comportamento de retry |

```promql
# Deteccao: trafego > 3x baseline
sum(rate(http_requests_total{namespace="velya"}[2m])) by (app)
/
sum(avg_over_time(rate(http_requests_total{namespace="velya"}[5m])[1h:5m])) by (app)
> 3
```

---

### APP-002: Queue Buildup (NATS JetStream)

| Campo | Descricao |
|---|---|
| **ID** | APP-002 |
| **Severidade** | P2 |
| **Gatilho** | Consumers nao processam mensagens na velocidade de producao |
| **Deteccao** | Consumer pending count crescente |
| **Impacto** | Atraso no processamento; mensagens expiram; perda de dados potencial |
| **Resposta** | Escalar consumers (KEDA); investigar causa da lentidao; verificar DLQ |
| **Prevencao** | KEDA scaler configurado com threshold adequado; max_deliver configurado; DLQ monitorada |
| **Teste** | Produzir mensagens mais rapido que capacidade de consumo e validar scaling |

```promql
# Deteccao: pending crescente por 5 minutos
deriv(nats_jetstream_consumer_num_pending[5m]) > 0
AND
nats_jetstream_consumer_num_pending > 500
```

---

### APP-003: Temporal Workflow Stuck

| Campo | Descricao |
|---|---|
| **ID** | APP-003 |
| **Severidade** | P2 |
| **Gatilho** | Workflow Temporal trava em activity que nao completa (timeout nao configurado, dependencia morta, deadlock) |
| **Deteccao** | Workflow execution duration > SLA esperado |
| **Impacto** | Processo de negocio parado (agendamento, faturamento, resultado de exame) |
| **Resposta** | Identificar activity travada; terminar workflow se irrecuperavel; re-executar |
| **Prevencao** | Timeouts em todas as activities; heartbeat para activities longas; alertas de duracao |
| **Teste** | Simular activity que nao responde em staging |

```promql
# Deteccao: workflows com duracao excessiva
temporal_workflow_execution_duration_seconds{namespace="velya"}
> 300  # 5 minutos, ajustar por workflow type
```

```logql
# Deteccao via logs Temporal
{app="temporal-server"} |= "workflow execution timeout" | json
  | workflow_type=~"PatientIntake|Scheduling|Billing"
```

---

### APP-004: DLQ Growth

| Campo | Descricao |
|---|---|
| **ID** | APP-004 |
| **Severidade** | P2 |
| **Gatilho** | Mensagens falham repetidamente e sao enviadas para Dead Letter Queue |
| **Deteccao** | DLQ message count > 0 |
| **Impacto** | Dados nao processados; processos incompletos; inconsistencia eventual |
| **Resposta** | Analisar mensagens na DLQ; corrigir causa raiz; reprocessar mensagens |
| **Prevencao** | Validacao de schema na producao; testes de contrato; monitorar DLQ ativamente |
| **Teste** | Publicar mensagem com schema invalido e validar roteamento para DLQ |

```promql
nats_jetstream_consumer_num_redelivered{namespace="velya"} > 10
```

---

### APP-005: Dependency Timeout

| Campo | Descricao |
|---|---|
| **ID** | APP-005 |
| **Severidade** | P2 |
| **Gatilho** | Servico externo (lab system, payment gateway, EHR) responde lentamente ou nao responde |
| **Deteccao** | Latencia de requests para dependencia > SLA |
| **Impacto** | Threads bloqueadas; cascata de timeouts; experiencia do usuario degradada |
| **Resposta** | Ativar circuit breaker; retornar resposta degradada; notificar fornecedor |
| **Prevencao** | Circuit breakers; timeouts curtos; fallback responses; cache de respostas |
| **Teste** | Adicionar latencia artificial a dependencia em staging com chaos engineering |

```promql
histogram_quantile(0.99,
  sum(rate(http_client_request_duration_seconds_bucket{
    namespace="velya",
    target_service=~"external-.*"
  }[5m])) by (le, target_service)
) > 5
```

---

### APP-006: Database Slowdown

| Campo | Descricao |
|---|---|
| **ID** | APP-006 |
| **Severidade** | P1 |
| **Gatilho** | Queries lentas; lock contention; conexoes esgotadas; replicacao atrasada |
| **Deteccao** | Query duration P99 > SLA; connection pool usage > 85% |
| **Impacto** | Todos os servicos que dependem do banco degradam; cascata |
| **Resposta** | Identificar queries problematicas; kill queries se necessario; failover para replica |
| **Prevencao** | Query review em PRs; connection pool monitoring; read replicas para queries pesadas |
| **Teste** | Executar query pesada em staging e validar deteccao |

```promql
# Deteccao: connection pool quase esgotado
pg_stat_activity_count{datname="velya_production"}
/
pg_settings_max_connections > 0.85

# Deteccao: replicacao atrasada
pg_stat_replication_lag_seconds > 5
```

---

### APP-007: Circuit Breaker Stuck Open

| Campo | Descricao |
|---|---|
| **ID** | APP-007 |
| **Severidade** | P2 |
| **Gatilho** | Circuit breaker abre por falha transitoria e nao recupera (half-open probe falha, configuracao incorreta) |
| **Deteccao** | Circuit breaker state == open por > recovery timeout |
| **Impacto** | Funcionalidade permanentemente degradada apesar de dependencia ter se recuperado |
| **Resposta** | Reset manual do circuit breaker; investigar por que half-open falha |
| **Prevencao** | Half-open timeout adequado; health check da dependencia; alerta de circuit breaker aberto > X min |
| **Teste** | Abrir circuit breaker e simular recuperacao da dependencia |

```promql
circuit_breaker_state{state="open",namespace="velya"} == 1
AND
time() - circuit_breaker_state_change_timestamp{namespace="velya"} > 300
```

---

### APP-008: Authentication/Authorization Failure Spike

| Campo | Descricao |
|---|---|
| **ID** | APP-008 |
| **Severidade** | P1 |
| **Gatilho** | Token expired em massa; OIDC provider indisponivel; RBAC misconfiguration |
| **Deteccao** | 401/403 rate spike |
| **Impacto** | Usuarios nao conseguem acessar o sistema; operacoes clinicas interrompidas |
| **Resposta** | Verificar identity provider; verificar certificados; verificar RBAC |
| **Prevencao** | Monitorar expiracoes de certificados; redundancia no identity provider; cache de tokens |
| **Teste** | Simular identity provider indisponivel em staging |

```promql
sum(rate(http_requests_total{status=~"401|403",namespace="velya"}[5m])) by (app)
/
sum(rate(http_requests_total{namespace="velya"}[5m])) by (app)
> 0.1
```

---

## 5. Categoria: Agente

### AGENT-001: Agent Silence (Nao Responde)

| Campo | Descricao |
|---|---|
| **ID** | AGENT-001 |
| **Severidade** | P2 |
| **Gatilho** | Agente autonomo para de processar eventos (crash, deadlock, quota API esgotada) |
| **Deteccao** | Ausencia de heartbeat; ultima acao > threshold |
| **Impacto** | Incidentes nao sao detectados/respondidos automaticamente |
| **Resposta** | Restart do agente; escalar para humano; verificar quotas |
| **Prevencao** | Heartbeat obrigatorio a cada 60s; watchdog externo; alerta de silencio > 5min |
| **Teste** | Parar agente e validar deteccao em < 5min |

```promql
time() - velya_agent_last_heartbeat_timestamp > 300

# Ou: ausencia de acoes no periodo esperado
absent_over_time(velya_agent_actions_total[10m])
```

---

### AGENT-002: Agent Noise (Excesso de Acoes)

| Campo | Descricao |
|---|---|
| **ID** | AGENT-002 |
| **Severidade** | P3 |
| **Gatilho** | Agente entra em loop de acoes; gera excesso de alertas/PRs/notificacoes |
| **Deteccao** | Taxa de acoes > 3x baseline |
| **Impacto** | Alert fatigue; recursos consumidos; acoes incorretas potenciais |
| **Resposta** | Throttle ou pause do agente; investigar causa do loop |
| **Prevencao** | Rate limiting de acoes; circuit breaker no agente; dedup de alertas |
| **Teste** | Simular condicao de loop e validar throttling |

```promql
rate(velya_agent_actions_total[5m]) > 3 * avg_over_time(rate(velya_agent_actions_total[5m])[1h:5m])
```

---

### AGENT-003: Agent False Healthy

| Campo | Descricao |
|---|---|
| **ID** | AGENT-003 |
| **Severidade** | P1 |
| **Gatilho** | Agente reporta sistema saudavel quando nao esta (metricas erradas, query incorreta, threshold mal configurado) |
| **Deteccao** | Discrepancia entre status reportado pelo agente e metricas reais |
| **Impacto** | Incidentes nao detectados; confianca no sistema comprometida |
| **Resposta** | Desativar agente; investigar discrepancia; escalar para humano |
| **Prevencao** | Cross-validation de metricas; auditoria periodica de decisoes do agente; canary checks |
| **Teste** | Injetar falha conhecida e validar que agente detecta |

```promql
# Deteccao: agente diz OK mas metricas dizem o contrario
velya_agent_system_status{status="healthy"} == 1
AND ON ()
(
  sum(rate(http_requests_total{status=~"5..",namespace="velya"}[5m]))
  / sum(rate(http_requests_total{namespace="velya"}[5m]))
) > 0.05
```

---

### AGENT-004: Quarantine Escape

| Campo | Descricao |
|---|---|
| **ID** | AGENT-004 |
| **Severidade** | P1 |
| **Gatilho** | Agente em quarentena (permissoes revogadas) consegue executar acoes fora de seu escopo |
| **Deteccao** | Audit log mostra acoes de agente quarentenado |
| **Impacto** | Acoes nao autorizadas; seguranca comprometida |
| **Resposta** | Kill imediato do agente; revogar todas as credenciais; investigar brecha |
| **Prevencao** | Quarentena por revogacao de ServiceAccount; network policy isolando agente; auditoria continua |
| **Teste** | Quarentenar agente em staging e tentar acoes |

```logql
{app="velya-agent"} | json
  | agent_status="quarantined"
  | action_type!="heartbeat" AND action_type!="log"
```

---

### AGENT-005: Agent Decision Drift

| Campo | Descricao |
|---|---|
| **ID** | AGENT-005 |
| **Severidade** | P3 |
| **Gatilho** | Decisoes do agente divergem gradualmente da politica definida (prompt drift, contexto acumulado, edge cases) |
| **Deteccao** | Taxa de decisoes revisadas/revertidas por humanos crescente |
| **Impacto** | Confianca no agente reduzida; decisoes subotimas |
| **Resposta** | Recalibrar agente; atualizar prompts; aumentar review humano temporariamente |
| **Prevencao** | Auditoria semanal de decisoes; benchmark contra dataset de referencia; versionamento de prompts |
| **Teste** | Submeter dataset de referencia ao agente e comparar com respostas esperadas |

```promql
increase(velya_agent_decision_reverted_total[7d])
/
increase(velya_agent_decision_total[7d])
> 0.05
```

---

## 6. Categoria: Self-Healing

### HEAL-001: Remediacao Falha

| Campo | Descricao |
|---|---|
| **ID** | HEAL-001 |
| **Severidade** | P2 |
| **Gatilho** | Acao de self-healing (restart pod, scale up, rollback) falha ao executar |
| **Deteccao** | Remediation action status = failed |
| **Impacto** | Incidente nao resolvido; escala para humano necessaria |
| **Resposta** | Escalar para humano; executar remediacao manual; investigar por que falhou |
| **Prevencao** | Testar remediacos periodicamente (chaos engineering); multiplas estrategias de fallback |
| **Teste** | Simular falha de remediacao (RBAC insuficiente para restart pod) |

```promql
velya_remediation_status{status="failed"} > 0
```

---

### HEAL-002: Rollback Parcial

| Campo | Descricao |
|---|---|
| **ID** | HEAL-002 |
| **Severidade** | P1 |
| **Gatilho** | Rollback reverte aplicacao mas nao reverte migration de banco ou config change |
| **Deteccao** | Versao da app != versao esperada do schema/config |
| **Impacto** | Incompatibilidade entre app e banco; erros de runtime; dados corrompidos |
| **Resposta** | Avaliar compatibilidade; aplicar migration forward se possivel; coordenar rollback completo |
| **Prevencao** | Migrations sempre backward-compatible; config changes em PR separado do app deploy |
| **Teste** | Simular rollback pos-migration em staging |

```promql
# Deteccao: rollback ocorreu mas erros persistem
increase(argocd_app_rollback_total[10m]) > 0
AND
sum(rate(http_requests_total{status=~"5..",namespace="velya"}[5m])) > 0
```

---

### HEAL-003: Healing Causa Novo Problema

| Campo | Descricao |
|---|---|
| **ID** | HEAL-003 |
| **Severidade** | P1 |
| **Gatilho** | Acao de healing resolve problema A mas causa problema B (ex: scale up excessivo causa node pressure; restart causa thundering herd) |
| **Deteccao** | Novo alerta dispara dentro de 5 minutos de uma acao de healing |
| **Impacto** | Situacao pior que antes da healing; cascata |
| **Resposta** | Reverter acao de healing; investigar correlacao; tratar ambos os problemas |
| **Prevencao** | Blast radius assessment antes de healing; rate limiting de acoes; observacao pos-acao |
| **Teste** | Simular cenario onde restart causa thundering herd |

```promql
# Deteccao: novo alerta dentro de 5min de remediacao
ALERTS{alertstate="firing"}
AND ON ()
increase(velya_remediation_actions_total[5m]) > 0
```

---

### HEAL-004: Healing Loop

| Campo | Descricao |
|---|---|
| **ID** | HEAL-004 |
| **Severidade** | P2 |
| **Gatilho** | Self-healing executa a mesma acao repetidamente sem resolver o problema |
| **Deteccao** | Mesma acao de remediacao > 3 vezes em 30 minutos |
| **Impacto** | Recursos desperdicados; problema nao resolvido; instabilidade |
| **Resposta** | Parar healing loop; escalar para humano; investigar causa raiz |
| **Prevencao** | Dedup de acoes; cooldown entre acoes identicas; max retries por tipo de acao |
| **Teste** | Criar condicao que nao se resolve com restart e validar deteccao de loop |

```promql
increase(velya_remediation_actions_total{action="restart"}[30m]) > 3
AND ON (target)
increase(velya_remediation_actions_total{action="restart"}[5m]) > 0
```

---

## 7. Categoria: Frontend

### FE-001: Degradacao de Rota

| Campo | Descricao |
|---|---|
| **ID** | FE-001 |
| **Severidade** | P2 |
| **Gatilho** | Rota especifica do frontend carrega lentamente ou falha (API backend lenta, JS error, rendering timeout) |
| **Deteccao** | Web Vitals degradados para rota especifica; error rate de API calls do frontend |
| **Impacto** | Usuarios nao conseguem acessar funcionalidade especifica |
| **Resposta** | Identificar rota afetada; investigar backend correspondente; rollback se necessario |
| **Prevencao** | Monitoramento de Web Vitals por rota; error boundaries no React; retry com fallback |
| **Teste** | Degradar backend especifico e validar deteccao pelo frontend monitoring |

```promql
# Deteccao: LCP degradado por rota
histogram_quantile(0.75,
  sum(rate(web_vitals_lcp_bucket{route=~".*"}[5m])) by (le, route)
) > 4
```

---

### FE-002: Action Failure Spike

| Campo | Descricao |
|---|---|
| **ID** | FE-002 |
| **Severidade** | P2 |
| **Gatilho** | Acoes do usuario (submit form, agendar consulta, confirmar pagamento) falham em taxa crescente |
| **Deteccao** | Taxa de falha de acoes do usuario > 5% |
| **Impacto** | Frustracao do usuario; operacoes clinicas comprometidas; dados nao salvos |
| **Resposta** | Identificar acao afetada; investigar API/validacao; comunicar usuarios |
| **Prevencao** | Retry automatico para acoes idem-potentes; feedback de erro claro; offline queue |
| **Teste** | Simular falha de API de submit e validar experiencia do usuario |

```promql
sum(rate(frontend_action_errors_total[5m])) by (action)
/
sum(rate(frontend_action_total[5m])) by (action)
> 0.05
```

---

### FE-003: Static Asset Loading Failure

| Campo | Descricao |
|---|---|
| **ID** | FE-003 |
| **Severidade** | P2 |
| **Gatilho** | CDN/S3 falha; hash de assets muda sem cache invalidation; CORS misconfiguration |
| **Deteccao** | JS/CSS 404 errors; console errors no Real User Monitoring |
| **Impacto** | Frontend quebrado; pagina em branco; funcionalidade ausente |
| **Resposta** | Verificar CDN; verificar deploy de assets; invalidar cache se necessario |
| **Prevencao** | Content hash nos nomes de assets; fallback para origin; monitoramento sintetico |
| **Teste** | Invalidar cache do CDN e validar fallback |

```promql
sum(rate(http_requests_total{status="404",path=~".*(js|css|woff2)$"}[5m])) > 1
```

---

## 8. Matriz de Severidade e Resposta

| Categoria | P1 (Critico) | P2 (Alto) | P3 (Medio) | P4 (Baixo) |
|---|---|---|---|---|
| Deploy | DEPLOY-005 | DEPLOY-001, -002, -004 | DEPLOY-003 | - |
| Infra | INFRA-005, -006 | INFRA-001, -002, -003, -007 | INFRA-004 | - |
| App | APP-001, -006, -008 | APP-002, -003, -004, -005, -007 | - | - |
| Agent | AGENT-003, -004 | AGENT-001 | AGENT-002, -005 | - |
| Self-Healing | HEAL-002, -003 | HEAL-001, -004 | - | - |
| Frontend | - | FE-001, -002, -003 | - | - |

---

## 9. Cadencia de Teste

| Frequencia | Cenarios a Testar | Metodo |
|---|---|---|
| Semanal | DEPLOY-002, APP-001, AGENT-001 | Chaos engineering automatizado |
| Quinzenal | INFRA-001, APP-003, HEAL-001 | Game day com equipe |
| Mensal | DEPLOY-005, INFRA-006, HEAL-003 | Simulacao completa |
| Trimestral | AGENT-004, HEAL-002 | Red team exercise |
| Pos-incidente | Cenario que causou o incidente | Reproduzido em staging |

---

## 10. Template de Registro de Cenario Novo

```yaml
# Usar este template para adicionar novos cenarios ao catalogo
newScenario:
  id: "CATEGORIA-NNN"
  title: ""
  severity: "P1|P2|P3|P4"
  category: "deploy|infra|app|agent|self-healing|frontend"
  trigger: ""
  detection:
    method: ""
    query: ""  # PromQL ou LogQL
  impact: ""
  response:
    immediate: ""
    followUp: ""
  prevention: ""
  testMethod: ""
  testFrequency: ""
  addedDate: ""
  addedBy: ""
  lastTestedDate: ""
  lastIncidentDate: ""
```
