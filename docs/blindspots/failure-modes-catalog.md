# Catálogo de Modos de Falha — Velya Platform

> **Versão**: 1.0 | **Atualizado em**: 2026-04-08 | **Dono**: Arquitetura e Operações  
> **Propósito**: Catalogar sistematicamente como cada componente da plataforma Velya pode falhar, como essa falha se manifesta, qual o impacto clínico potencial e como detectar e mitigar cada modo.

---

## Camada 1 — Infraestrutura Kubernetes

### K8S-001 — Pod Crash e CrashLoopBackOff

**Como ocorre**: Processo do container encerra inesperadamente (segfault, OOMKill, exception não tratada, falha de startup). Kubernetes reinicia o pod com backoff exponencial.

**Como falha silenciosamente**: Durante o período entre crash e reinício, requests chegam ao pod que não existe — retornam 503. O pod aparece como "Restarting" no status, não como "Down". Se o restart acontece rapidamente, alertas de disponibilidade podem não disparar.

**Impacto clínico**: Se o patient-flow-service ou discharge-orchestrator crasham, fluxos de alta ficam presos sem processamento. Tarefas em andamento no momento do crash são perdidas (sem replay). Clínicos podem esperar resposta que nunca chega.

**Detecção**:

- Alerta: `kube_pod_container_status_restarts_total > 3` nos últimos 5 minutos
- Alerta: `kube_pod_status_phase{phase="Failed"}`
- Log: Buscar no Loki por `OOMKill` ou `exit code` nos últimos logs do container

**Mitigação**:

- Implementar `resources.limits` corretos para prevenir OOMKill
- Readiness probe bem calibrada para evitar traffic durante startup
- Horizontal Pod Autoscaler para garantir réplicas saudáveis sempre disponíveis
- PodDisruptionBudget para manter mínimo durante operações de manutenção

**Runbook**: `docs/runbooks/pod-crashloop.md`

---

### K8S-002 — Pod Eviction por Pressão de Recursos

**Como ocorre**: Nó fica com memória ou disco insuficiente. Kubelet evicta pods de acordo com QoS class: BestEffort primeiro, depois Burstable, por último Guaranteed.

**Como falha silenciosamente**: Pods sem `resources.requests` são tratados como BestEffort e são os primeiros a ser evictados. O pod desaparece sem CrashLoop — vai para "Evicted". Se não houver réplicas suficientes, o serviço fica degradado.

**Impacto clínico**: Serviços críticos como api-gateway ou velya-web podem ser evictados durante pico de carga, tornando a interface inacessível para clínicos durante momento de alta demanda.

**Detecção**:

- Alerta: `kube_node_status_condition{condition="MemoryPressure",status="true"}`
- Alerta: `kube_pod_status_reason{reason="Evicted"} > 0`
- Monitorar: `node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.15`

**Mitigação**:

- Definir `resources.requests` e `limits` para todos os containers
- Configurar `priorityClassName` para serviços críticos
- Usar QoS class Guaranteed para serviços clínicos críticos

**Runbook**: `docs/runbooks/pod-eviction.md`

---

### K8S-003 — Node Failure

**Como ocorre**: Um dos 5 nós do cluster kind-velya-local fica indisponível (processo do container docker parado, OOM do host, falha de rede).

**Como falha silenciosamente**: Por padrão, Kubernetes aguarda 5 minutos (`node.kubernetes.io/not-ready` toleration) antes de evictar pods do nó falho. Durante esses 5 minutos, pods aparecem como "Running" mas não respondem. Sem PodAntiAffinity, todos os pods de um serviço podem estar no mesmo nó.

**Impacto clínico**: Se patient-flow-service tem todas as réplicas no mesmo nó, e esse nó falha, o serviço fica indisponível por até 5 minutos sem detecção clara.

**Detecção**:

- Alerta: `kube_node_status_condition{condition="Ready",status="true"} == 0`
- Alerta: Up metric do serviço cai para 0
- `kubectl get nodes` mostra NotReady

**Mitigação**:

- Configurar `PodAntiAffinity` para distribuir réplicas entre nós
- Reduzir `pod-eviction-timeout` no controller manager
- Monitorar saúde de nós com alerta imediato

**Runbook**: `docs/runbooks/node-failure.md`

---

### K8S-004 — Scheduling Failure

**Como ocorre**: Nenhum nó satisfaz os requisitos do pod (resources insuficientes, taints sem tolerations, node selectors sem match, PVC em zona diferente).

**Como falha silenciosamente**: Pod fica em `Pending` indefinidamente. O deployment aparece como `0/1 ready` mas sem alerta automático. Deploys de novo serviço podem ficar pendentes por horas sem detecção.

**Impacto clínico**: Um novo pod de serviço crítico implantado durante incidente (para scaling manual) pode não subir, deixando o operador acreditando que o scaling foi bem-sucedido quando não foi.

**Detecção**:

- Alerta: `kube_pod_status_phase{phase="Pending"} > 0` por mais de 5 minutos
- `kubectl describe pod <pod>` mostra eventos de scheduling failure

**Mitigação**:

- Usar `kubectl describe pod` como primeiro passo de troubleshooting
- Configurar `resources.requests` realistas para garantir schedulability
- Monitorar cluster capacity vs. requested resources

---

### K8S-005 — Resource Starvation (CPU Throttling)

**Como ocorre**: Pod atinge `resources.limits.cpu`. O Linux kernel throttla o processo — CPU não é "tirada", mas o processo fica esperando sua próxima janela de CPU conforme CFS (Completely Fair Scheduler).

**Como falha silenciosamente**: CPU throttling não gera erro, não aparece nos logs, não cria restart. Latência aumenta gradualmente. O pod parece saudável (`Running`, health check passando) mas responde cada vez mais lento.

**Impacto clínico**: discharge-orchestrator processando alta mais lentamente que o esperado. Clínico aguarda confirmação que demora 30 segundos em vez de 3.

**Detecção**:

- Métrica: `container_cpu_cfs_throttled_seconds_total` — alerta se throttling ratio > 25%
- Alerta de latência p95 elevada no serviço

**Mitigação**:

- Medir CPU real em carga antes de definir limits
- Usar `resources.requests.cpu` adequado para Guaranteed QoS
- Considerar VPA para ajuste automático de requests/limits

---

## Camada 2 — NATS JetStream

### NATS-001 — Consumer Lag Crescente

**Como ocorre**: O consumer processa mensagens mais devagar do que são publicadas. Pode ser por: consumer com leak de memória, queries DB lentas no handler, timeout em chamadas externas (Anthropic API), ou burst de eventos acima da capacidade.

**Como falha silenciosamente**: As mensagens continuam sendo aceitas pela stream. O publisher não sabe que nada está sendo processado. O pod do consumer está Running e healthy. O lag cresce silenciosamente.

**Impacto clínico**: Eventos de alta de paciente publicados às 14h são processados às 16h. Clínico aguardando confirmação de alta nunca recebe porque o processamento está horas atrás.

**Detecção**:

- Métrica NATS: `nats_consumer_num_pending` — alerta se > 100 mensagens por > 5 minutos
- Monitorar `nats_consumer_last_deliver_time`
- `nats consumer info <stream> <consumer>` via CLI

**Mitigação**:

- Timeout por handler de evento com dead-letter se excedido
- Horizontal scaling de consumers via KEDA com trigger de consumer lag
- Dead-letter queue para mensagens que falham repetidamente

**Runbook**: `docs/runbooks/nats-consumer-lag.md`

---

### NATS-002 — Publisher Blocked

**Como ocorre**: Stream atingiu `max_bytes` ou `max_msgs`. Publisher tenta publicar e recebe erro `nats: maximum bytes exceeded` ou `nats: maximum messages exceeded`. Sem tratamento de erro, o serviço publisher pode falhar silenciosamente ou lançar exceção não tratada.

**Como falha silenciosamente**: Se o publisher tem try/catch que engole o erro, eventos são perdidos sem log. A stream parece cheia mas nenhum alerta dispara.

**Impacto clínico**: Eventos de atualização de estado de paciente são perdidos permanentemente. O sistema fica com estado inconsistente sem saber.

**Detecção**:

- Monitorar `nats_stream_bytes` vs. `max_bytes` — alerta em 80%
- Logs de erro de publicação no publisher
- Alerta em `nats_stream_messages` vs. `max_msgs`

**Mitigação**:

- Configurar `max_bytes` adequado para retenção esperada
- Não silenciar erros de publicação — propagar para circuit breaker
- Configurar discard policy: `DiscardOld` para streams onde mensagens antigas são menos importantes que novas

---

### NATS-003 — Stream Max-Bytes Atingido com Discard Silencioso

**Como ocorre**: Stream configurada com `discard=old` atinge `max_bytes`. Mensagens antigas são deletadas silenciosamente para abrir espaço. Consumers que não processaram ainda perdem mensagens.

**Como falha silenciosamente**: Do ponto de vista do publisher, tudo funciona. Do ponto de vista do consumer, mensagens simplesmente não aparecem mais. Não há erro — mensagens foram discartadas como configurado, mas o impacto clínico não foi considerado.

**Impacto clínico**: Histórico de eventos de um paciente truncado. Workflow de alta baseado em sequência de eventos opera com contexto incompleto.

**Detecção**:

- Monitorar `nats_stream_num_deleted` — alerta se aumenta inesperadamente
- Verificar `nats_stream_first_seq` vs. `consumer_deliver_start_seq`

**Mitigação**:

- Usar `discard=new` para streams críticas clínicas (prefere rejeitar novos que perder histórico)
- Dimensionar `max_bytes` para retenção necessária com margem de 2x
- Alerta quando stream atinge 70% de capacidade

---

### NATS-004 — Connection Drop e Reconexão

**Como ocorre**: Conexão TCP entre serviço e NATS server é dropada (network blip, restart do NATS pod, timeout). O SDK NATS.js tenta reconectar automaticamente, mas há uma janela de tempo onde eventos publicados durante a reconexão podem ser perdidos.

**Como falha silenciosamente**: Se o publisher não verifica o ack da publicação, eventos enviados durante reconnect window são silenciosamente perdidos. O serviço continua operando normalmente após reconexão.

**Impacto clínico**: Evento de início de workflow de alta perdido. O discharge-orchestrator nunca inicia o processo. O leito permanece ocupado desnecessariamente.

**Detecção**:

- Log de reconexão NATS: `nats: reconnected`
- Monitorar gaps em sequence numbers de eventos
- Alerta de reconexão frequente indica problema de rede

**Mitigação**:

- Usar `publish()` com espera de ack (`js.publish()` vs `nc.publish()`)
- Implementar retry com idempotency key para publicações críticas
- Configurar NATS clustering para alta disponibilidade

---

### NATS-005 — Message Duplicate Delivery

**Como ocorre**: Consumer falha após processar a mensagem mas antes de fazer ack. NATS reentrega a mensagem. Com QoS at-least-once (padrão do JetStream), duplicatas são esperadas.

**Como falha silenciosamente**: Se o consumer não é idempotente, a mesma ação é executada duas vezes. Por exemplo: tarefa de alta criada duas vezes, workflow Temporal disparado duas vezes.

**Impacto clínico**: Alta duplicada de paciente. Duas ordens de medicação criadas. Duas notificações enviadas ao familiar.

**Detecção**:

- Rastrear `event_id` processado por consumer — detectar duplicata antes de processar
- Log de duplicata detectada
- Monitorar taxa de eventos processados vs. eventos únicos

**Mitigação**:

- Implementar idempotency check em todos os consumers usando `event_id`
- Usar exactly-once delivery do JetStream onde crítico (requer configuração adicional)
- Transações idempotentes no banco com `ON CONFLICT DO NOTHING`

---

## Camada 3 — KEDA

### KEDA-001 — Scaler Source Unavailable

**Como ocorre**: O ScaledObject do KEDA usa Prometheus como fonte de métricas. Se o Prometheus está indisponível ou o ServiceMonitor não existe, o KEDA não consegue coletar a métrica.

**Como falha silenciosamente**: O KEDA recebe erro ao consultar Prometheus e, por segurança, escala para `minReplicaCount`. O serviço opera com capacidade mínima sem alerta visível. O log do KEDA Operator mostra erro, mas ninguém monitora esse log.

**Impacto clínico**: Em pico de uso clínico, o serviço que deveria ter 10 réplicas fica com 1. Latência explode. Clínicos enfrentam interface lenta durante momento crítico.

**Detecção**:

- Monitorar status de ScaledObjects: `kubectl describe scaledobject -n velya-dev-core`
- Alerta: `keda_scaler_errors_total > 0` (se KEDA expõe métricas)
- Verificar réplicas atuais vs. esperadas para carga atual

**Mitigação**:

- Configurar fallback de scaling no ScaledObject: `fallback.replicas` com valor conservador
- Garantir que ServiceMonitor existe antes de configurar ScaledObject que depende de métrica Velya
- Alerta se réplicas ficam no mínimo por mais de 15 minutos durante horário clínico

---

### KEDA-002 — Scaling Thrash

**Como ocorre**: Trigger de scaling oscila em torno do threshold, causando scale up → scale down → scale up repetidamente a cada 30-60 segundos.

**Como falha silenciosamente**: Cada scaling event tem custo operacional (pod criado, inicialização, warmup, destruído). O serviço fica instável. Latência tem picos a cada ciclo de scaling. Custo de infra aumenta.

**Impacto clínico**: Experiência degradada intermitente para clínicos. Requests perdidos durante ciclos de scale down antes do graceful shutdown completar.

**Detecção**:

- Monitorar `kube_deployment_status_replicas` ao longo do tempo — pattern de oscilação
- Alerta se número de scaling events > 10 em 1 hora para o mesmo serviço

**Mitigação**:

- Configurar `cooldownPeriod: 300` (5 minutos) nos ScaledObjects
- Usar `stabilizationWindowSeconds` no HPA gerado pelo KEDA
- Escolher threshold de trigger com margem para evitar oscilação

---

### KEDA-003 — Trigger Misconfigured

**Como ocorre**: ScaledObject configurado com nome de métrica incorreto, threshold absurdo, ou expression PromQL inválida. O KEDA falha silenciosamente e usa fallback.

**Como falha silenciosamente**: Scaling nunca acontece (ou sempre escala para max). O time assume que KEDA está funcionando porque o pod do operator está Running.

**Detecção**:

- `kubectl describe scaledobject` mostra eventos de erro
- Verificar status.conditions do ScaledObject

**Mitigação**:

- Testar trigger expression no Prometheus antes de criar ScaledObject
- Lint de ScaledObjects no CI com kube-linter
- Review obrigatório de ScaledObjects em PRs

---

## Camada 4 — ArgoCD

### ARGO-001 — Sync Failure

**Como ocorre**: ArgoCD tenta sincronizar uma Application mas falha (manifesto inválido, recurso em conflito, hook falhou, timeout). A Application fica em estado `OutOfSync` ou `Degraded`.

**Como falha silenciosamente**: Sem alertas configurados, o sync pode falhar silenciosamente por dias. O cluster diverge do Git progressivamente sem que ninguém saiba.

**Impacto clínico**: Mudança de configuração crítica (novo secret, atualização de feature flag) nunca chega ao cluster. O time pensa que está deployado mas não está.

**Detecção**:

- Alerta: Application em estado OutOfSync por mais de 15 minutos
- Alerta: Application health: Degraded
- Notificação no Slack a cada sync failure

**Mitigação**:

- Configurar `notifications.argoproj.io` para notificações de sync failure
- Habilitar self-heal para correção automática de drift simples
- Validar manifests com `argocd app diff` antes de merge em main

---

### ARGO-002 — Drift Silencioso

**Como ocorre**: Alguém faz mudança manual no cluster (`kubectl edit`, `kubectl apply` manual) sem atualizar o Git. O ArgoCD detecta o drift mas, se não tiver self-heal, apenas reporta como OutOfSync.

**Como falha silenciosamente**: A mudança manual pode "funcionar" por semanas. Mas o Git tem uma versão diferente. Quando o ArgoCD sincroniza (após PR), a mudança manual é sobrescrita, possivelmente quebrando algo que estava funcionando.

**Impacto clínico**: Configuração de um serviço revertida para versão antiga durante sincronização. Comportamento inesperado após deploy aparentemente não relacionado.

**Detecção**:

- ArgoCD UI mostra diff entre estado desejado (Git) e estado real (cluster)
- Alerta de drift: `argocd_app_info{sync_status="OutOfSync"}`

**Mitigação**:

- Habilitar `self-heal: true` para aplicar configuração do Git automaticamente
- Proibir `kubectl apply` manual em produção. Todas as mudanças via Git.
- Audit log de mudanças manuais no cluster

---

## Camada 5 — PostgreSQL

### PG-001 — Connection Pool Exhaustion

**Como ocorre**: Cada pod de serviço NestJS abre um connection pool ao PostgreSQL. Com múltiplas réplicas de múltiplos serviços, o número total de conexões pode exceder `max_connections` do PostgreSQL (padrão: 100).

**Como falha silenciosamente**: Novas conexões falham com `FATAL: sorry, too many clients already`. Se o serviço não trata esse erro, os requests ficam esperando por uma conexão disponível até timeout. Do ponto de vista do usuário, a interface congela.

**Impacto clínico**: Toda a plataforma fica indisponível — todos os serviços dependem do banco. Clínicos não conseguem acessar dados de pacientes.

**Detecção**:

- Métrica: `pg_stat_activity_count` vs. `max_connections` — alerta em 80%
- Log de erro: `FATAL: sorry, too many clients already`
- Latência de queries aumenta antes do esgotamento

**Mitigação**:

- Implementar PgBouncer como connection pooler entre serviços e PostgreSQL
- Configurar pool size por serviço considerando total de réplicas
- Alerta quando conexões ativas > 80% de `max_connections`

**Runbook**: `docs/runbooks/postgres-connection-pool.md`

---

### PG-002 — Lock Contention

**Como ocorre**: Múltiplos serviços ou réplicas tentam adquirir lock na mesma linha ou tabela simultaneamente. Transações esperam indefinidamente por lock, causando acúmulo de conexões bloqueadas.

**Como falha silenciosamente**: O banco fica progressivamente mais lento. Queries que levavam 10ms passam a levar 10 segundos. O pod do PostgreSQL está Running. O banco não está "down" — está congestionado.

**Impacto clínico**: Operações de alta ficam lentas ou travam. Workflow de discharge-orchestrator aguarda commit que nunca vem.

**Detecção**:

- Query: `SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock'`
- Alerta: `pg_stat_activity_count{wait_event_type="Lock"} > 10`
- Alerta de latência de queries (p95 > threshold)

**Mitigação**:

- Usar `NOWAIT` ou `SKIP LOCKED` para operações não críticas
- Minimizar tamanho de transações
- Configurar `deadlock_timeout` e `lock_timeout` por sessão

---

### PG-003 — Storage Full

**Como ocorre**: Volume PersistentVolume do PostgreSQL atinge capacidade máxima. O banco para de aceitar writes.

**Como falha silenciosamente**: O erro de "disk full" aparece nos logs do PostgreSQL, mas a aplicação pode não tratar esse erro adequadamente — pode retornar 500 genérico sem diagnóstico claro.

**Impacto clínico**: Registros de atendimento, eventos de alta, tarefas clínicas param de ser gravados. Dados perdidos ou inconsistentes.

**Detecção**:

- Alerta: `kubelet_volume_stats_used_bytes / kubelet_volume_stats_capacity_bytes > 0.80`
- Log do PostgreSQL: `could not extend file: No space left on device`

**Mitigação**:

- Alerta em 70% (warning) e 85% (critical) de uso de volume
- Política de retenção de dados históricos
- Volume auto-expansion em EKS com StorageClass adequada

---

## Camada 6 — nginx-ingress

### NGINX-001 — Controller Eviction

**Como ocorre**: O pod do nginx-ingress-controller é evictado por pressão de memória no nó onde está rodando. Com `hostNetwork: true`, não pode ser facilmente migrado para outro nó enquanto mantém a mesma porta.

**Como falha silenciosamente**: Todo o tráfego externo para a plataforma cai. Os pods dos serviços estão Running, mas ninguém consegue acessá-los. O erro é no proxy, não nos serviços — pode ser diagnosticado como "serviço fora do ar" quando o serviço está funcionando.

**Impacto clínico**: Interface web completamente inacessível para clínicos.

**Detecção**:

- Alerta: Pod nginx-ingress-controller em estado não-Running
- Monitorar: `nginx_ingress_controller_requests` — se cai para zero

**Mitigação**:

- Configurar `priorityClassName: system-cluster-critical` para o controller
- Garantir que o nó do ingress tem resources suficientes com margem
- PodDisruptionBudget para o controller

---

### NGINX-002 — 504 Upstream Timeout com Service-Upstream Ausente

**Como ocorre**: Com `hostNetwork: true`, o nginx-ingress tenta acessar IPs de pods diretamente. Em cluster kind, os IPs de pods não são roteáveis pelo nginx rodando no host network sem a annotation `service-upstream: "true"`.

**Como falha silenciosamente**: O nginx retorna 504 Gateway Timeout. O pod do serviço está Running e healthy. Parece que o serviço está fora do ar, mas na verdade o roteamento está errado.

**Impacto clínico**: Serviço inacessível via URL pública mesmo estando funcionando internamente. **Já ocorreu no ambiente Velya — discovery real.**

**Detecção**:

- 504 nos logs do nginx-ingress
- `kubectl logs -n ingress-nginx deployment/ingress-nginx-controller | grep "upstream"`
- Teste: `curl -v http://velya.172.19.0.6.nip.io` retorna 504

**Mitigação (já aplicada parcialmente)**:

- Adicionar `nginx.ingress.kubernetes.io/service-upstream: "true"` em todos os Ingress resources
- Criar template padrão de Ingress que inclui esta annotation
- Validar no CI com kube-linter custom rule

---

## Camada 7 — Prometheus

### PROM-001 — Cardinality Explosion

**Como ocorre**: Uma label de alta cardinalidade (como `patient_id` ou `request_id`) é adicionada a uma métrica. Prometheus cria uma série temporal por combinação de valores de labels. Com 10.000 pacientes e 50 métricas, isso resulta em 500.000 séries apenas para esse conjunto.

**Como falha silenciosamente**: O Prometheus começa a consumir memória exponencialmente. O processo fica cada vez mais lento. Eventualmente é OOMKilled. As alertas param de funcionar no momento em que mais se precisa delas — durante incidente de alta carga.

**Impacto clínico**: Perda total de observabilidade da plataforma no pior momento possível.

**Detecção**:

- Monitorar `prometheus_tsdb_symbol_table_size_bytes` — crescimento anormal
- Alerta: `prometheus_tsdb_head_series > 1000000` (1 milhão de séries)
- Query: `topk(10, count by (__name__, job) ({__name__=~".+"}))` para encontrar métricas com alta cardinalidade

**Mitigação**:

- Auditar labels de todas as métricas antes de adicionar ao código
- Regra de code review: nunca usar IDs de alta cardinalidade como labels Prometheus
- Configurar `--storage.tsdb.max-block-chunk-segment-size` com limite de cardinality
- Usar histogramas em vez de gauges por request ID

---

### PROM-002 — OOMKilled

**Como ocorre**: Prometheus sem `resources.limits.memory` definido consome memória ilimitada. Kubelet OOMKill o processo.

**Como falha silenciosamente**: O pod é reiniciado. Dados em memória (últimas horas de séries temporais não persistidas) são perdidos. Há gap nos gráficos. Alertas podem não disparar durante o downtime.

**Detecção**:

- `kube_pod_container_status_last_terminated_reason{reason="OOMKilled"}`
- Gap nos gráficos de saúde da plataforma

**Mitigação**:

- Definir `resources.limits.memory` para Prometheus com folga (ex: 4Gi para ambiente atual)
- Reduzir cardinalidade antes de aumentar memória
- Usar recording rules para pré-computar queries pesadas

---

## Camada 8 — Grafana

### GRAF-001 — Datasource Connection Failure

**Como ocorre**: Grafana não consegue conectar ao Prometheus, Loki ou Tempo. Pode ser por restart do datasource, mudança de service name, ou expiração de credenciais.

**Como falha silenciosamente**: Dashboards mostram "No data" em vez de dados reais. Um operador que não conhece o sistema pode assumir que não há dados quando na verdade o datasource está quebrado.

**Impacto clínico**: Perda de visibilidade operacional durante incidente. O time não consegue diagnosticar a causa raiz.

**Detecção**:

- Grafana expõe métricas de saúde de datasources: `grafana_datasource_request_failed_total`
- Alerta se datasource probe falha

**Mitigação**:

- Health check de datasource configurado e monitorado
- Documentação clara de como verificar e reconectar datasource
- Backup de credenciais de datasource no Kubernetes Secret, não hardcoded

---

## Camada 9 — AI Gateway

### AIGTW-001 — Provider Timeout

**Como ocorre**: Anthropic API leva mais de N segundos para responder. Sem timeout configurado, a chamada fica esperando indefinidamente, bloqueando a thread/goroutine.

**Como falha silenciosamente**: O serviço que fez a chamada ao AI Gateway fica waiting. Depois de um tempo, o request do usuário faz timeout no nginx (tipicamente 60 segundos). O usuário vê um erro genérico. O AI Gateway não registra timeout porque ainda está esperando.

**Impacto clínico**: Clínico esperando análise de AI para decisão de alta fica sem resposta por 60 segundos, então recebe erro. Pode tentar novamente, causando múltiplas chamadas simultâneas ao provider.

**Detecção**:

- Implementar timeout explícito no AI Gateway (ex: 30 segundos)
- Alerta: `ai_gateway_request_duration_seconds_p95 > 10`
- Log de timeout com model, prompt_tokens estimados

**Mitigação**:

- Configurar timeout de 30 segundos máximo por chamada de inferência
- Circuit breaker: se 3 timeouts em 1 minuto, abrir circuit por 30 segundos
- Fallback: cache de resposta similar ou modo degradado

---

### AIGTW-002 — Rate Limit Atingido

**Como ocorre**: Anthropic API tem rate limits por minuto (RPM) e por token (TPM). Com múltiplos agents fazendo chamadas simultâneas, o limite é atingido. A API retorna `429 Too Many Requests`.

**Como falha silenciosamente**: Se o AI Gateway não tem retry com backoff, retorna erro imediatamente para o serviço chamador. O serviço pode não tratar o 429 adequadamente e retornar erro 500 ao usuário.

**Impacto clínico**: Múltiplas features AI ficam indisponíveis simultaneamente durante picos de uso.

**Detecção**:

- Log de erro 429 com timestamp e model
- Alerta: `ai_gateway_rate_limit_errors_total` crescendo
- Dashboard de uso de tokens por minuto vs. limite

**Mitigação**:

- Implementar retry com exponential backoff + jitter para erros 429
- Prioridade de chamadas: clínicas > operacionais > analytics
- Cache de respostas para queries repetidas (ex: mesmo paciente, mesmo contexto)
- Alerta quando 70% do RPM/TPM é consumido

---

### AIGTW-003 — Token Budget Excedido

**Como ocorre**: Um agent ou um contexto muito longo excede o limite de tokens por request do modelo escolhido. A API retorna erro de context length exceeded.

**Como falha silenciosamente**: O AI Gateway recebe o erro e pode retornar resposta de fallback inadequada ou erro genérico. O agente pode não saber que sua resposta foi truncada.

**Impacto clínico**: Análise de AI de alta hospitalar truncada — parte das informações clínicas não foi considerada na recomendação.

**Detecção**:

- Log de erro com tipo `context_length_exceeded`
- Monitorar tamanho médio de contexto por tipo de request

**Mitigação**:

- Implementar compressão e summarização de contexto antes de enviar ao modelo
- Monitorar tamanho de contexto e alertar se > 80% do limit do modelo
- Escolher modelo com context window adequado para cada use case

---

## Camada 10 — Fluxo NATS → Serviço

### FLOW-001 — Consumer Morto Sem Ack — Redelivery Storm

**Como ocorre**: Consumer processa mensagem, falha antes do ack, NATS reentrega. Se a causa do erro persiste (ex: bug no handler, dado inválido), o ciclo se repete indefinidamente. Com muitos consumers afetados, a stream é bombardeada com redeliveries.

**Como falha silenciosamente**: Cada tentativa gera um log de erro, mas se o log não for monitorado ou se o erro for engolido, o redelivery storm cresce silenciosamente. O consumer usa recursos (CPU, memória, conexões DB) para processar e falhar repetidamente.

**Impacto clínico**: Recursos de computação esgotados em reprocessamento inútil. Novas mensagens (eventos clínicos recentes) ficam atrás de uma fila de redeliveries, aumentando latência para novos eventos.

**Detecção**:

- Monitorar `nats_consumer_num_redelivered` — crescimento anormal
- Alerta: taxa de redelivery > 10% do throughput normal
- Log de falhas de processamento repetidas com mesmo `event_id`

**Mitigação**:

- Configurar `maxDeliver` no consumer JetStream (ex: 3 tentativas)
- Após N tentativas, mover para dead-letter stream para análise
- Implementar backoff exponencial entre tentativas
- Separar erros transientes (retry) de erros permanentes (DLQ imediato)

---

## Resumo de Cobertura por Componente

| Componente         | Modos Catalogados | Críticos | Com Runbook |
| ------------------ | ----------------- | -------- | ----------- |
| Kubernetes         | 5                 | 2        | 3           |
| NATS JetStream     | 5                 | 3        | 1           |
| KEDA               | 3                 | 1        | 0           |
| ArgoCD             | 2                 | 1        | 0           |
| PostgreSQL         | 3                 | 2        | 1           |
| nginx-ingress      | 2                 | 1        | 0           |
| Prometheus         | 2                 | 1        | 0           |
| Grafana            | 1                 | 0        | 0           |
| AI Gateway         | 3                 | 1        | 0           |
| Fluxo NATS→Serviço | 1                 | 1        | 0           |
| **TOTAL**          | **27**            | **13**   | **5**       |

> **Gap crítico**: Apenas 5 dos 27 modos de falha têm runbook documentado. Os 22 restantes precisam de runbook antes do go-live com dados reais.
