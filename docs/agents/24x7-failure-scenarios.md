# Cenários de Falha 24/7 — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Última revisão:** 2026-04-08  

---

## 1. Propósito

Este documento descreve os 20 cenários de falha obrigatórios que a Velya deve ser capaz de detectar, responder e verificar recuperação. Cada cenário inclui: descrição precisa do que falha, o gatilho que o sistema detecta, o impacto esperado no sistema, a resposta automática e/ou manual, e como verificar que o sistema se recuperou corretamente.

Esses cenários são usados em:
- Exercícios de gameday (trimestrais)
- Testes de chaos engineering (mensais para S3/S4, trimestrais para S1/S2)
- Validação de novos alertas antes de entrar em produção
- Treinamento de on-call engineers

---

## 2. Cenários de Falha

---

### Cenário 1: Agent Silencioso

**Descrição:** O pod de um Worker Agent continua em execução mas para de enviar heartbeats — indica deadlock, loop infinito no código de heartbeat, ou perda de conectividade com NATS.

**Trigger detectado:**
```promql
(time() - velya_agent_heartbeat_timestamp{agent_name="task-inbox-worker"}) > 180
```

**Impacto esperado:**
- Tasks continuam sendo consumidas da fila (se o pod está vivo) ou param de ser processadas (se travado)
- Watchdog perde visibilidade do estado do agent
- Se o heartbeat for o único sinal de saúde, o sistema não sabe se o agent está processando ou travado

**Resposta do sistema:**
1. T+0s: Prometheus detecta ausência de heartbeat por 3 minutos
2. T+0s: Alerta `AgentHeartbeatMissing` disparado para Slack `#velya-ops-alerts`
3. T+60s: Watchdog verifica estado do pod via Kubernetes API
4. T+90s: Se pod Running: watchdog tenta coletar logs recentes para diagnóstico
5. T+3min: Se silêncio persistir: watchdog tenta restart controlado do pod
6. T+5min: Se ainda silencioso após restart: incidente S2 criado, on-call notificado

**Verificação de sucesso:**
```bash
# Verificar que heartbeat voltou
kubectl exec -n velya-dev-agents $(kubectl get pods -n velya-dev-agents -l app=task-inbox-worker -o name | head -1) -- curl -s localhost:9090/metrics | grep velya_agent_heartbeat_timestamp

# Verificar que alerta foi resolvido
curl -s http://localhost:9090/api/v1/alerts | jq '.data.alerts[] | select(.labels.alertname=="AgentHeartbeatMissing")'
# Deve retornar vazio
```

---

### Cenário 2: Queue Buildup

**Descrição:** Mensagens na fila NATS `velya.agents.clinical-ops.task-classification` acumulam rapidamente porque o patient-flow-service degradou e o worker fica em timeout aguardando a tool `get_patient_context`.

**Trigger detectado:**
```promql
velya_agent_queue_lag{agent="task-inbox-worker"} > 100 AND
rate(velya_agent_tasks_processed_total{agent="task-inbox-worker"}[10m]) < 0.1
```

**Impacto esperado:**
- Itens do inbox clínico acumulando sem classificação
- Tempo de resposta para triagem de urgência aumentando
- SLA de classificação < 3 minutos sendo violado

**Resposta do sistema:**
1. T+0s: Watchdog detecta lag > 50 com throughput zero por 5 minutos
2. T+5min: Diagnóstico automático identifica timeout de `get_patient_context`
3. T+5min: Alerta disparado com diagnóstico: "patient-flow-service parece degradado"
4. T+10min: Se patient-flow-service confirmado degradado: tasks roteadas para processamento simplificado (sem lookup de contexto, classificação conservadora)
5. T+30min: Se não resolvido: office entra em modo degraded, apenas tasks `priority: emergency` processadas

**Verificação de sucesso:**
```bash
# Verificar que lag está caindo
nats consumer info VELYA_AGENTS task-inbox-worker-consumer --server nats://localhost:4222 | grep NumPending
# Deve estar decrescendo

# Verificar health do patient-flow-service
kubectl exec -n velya-dev-core deployment/patient-flow-service -- curl -s localhost:8080/health
```

---

### Cenário 3: Overlapping Schedules

**Descrição:** O CronJob `cost-sweep` está configurado com `concurrencyPolicy: Allow` (incorretamente) e duas instâncias sobrepõem, escrevendo relatórios conflitantes de custo.

**Trigger detectado:**
```promql
count(kube_job_status_active{namespace="velya-dev-agents", job_name=~"cost-sweep.*"}) > 1
```

**Impacto esperado:**
- Dois relatórios de custo contraditórios gerados para o mesmo período
- Budget tracking incorreto para o FinOps Office
- Possível race condition em escrita de ConfigMap de budgets

**Resposta do sistema:**
1. T+0s: Alerta `UnexpectedJobParallelism` disparado
2. T+2min: Watchdog verifica se o overlap é intencional (consulta ConfigMap de overlap policy)
3. T+2min: Se não intencional: termina a instância mais antiga (menor startTime)
4. T+5min: Notifica FinOps Office para validar integridade do relatório gerado
5. T+10min: Abre issue para corrigir `concurrencyPolicy` para `Forbid`

**Verificação de sucesso:**
```bash
# Apenas 1 job ativo
kubectl get jobs -n velya-dev-agents | grep cost-sweep | grep Running | wc -l
# Deve retornar 1

# Verificar que concurrencyPolicy foi corrigida
kubectl get cronjob cost-sweep -n velya-dev-agents -o jsonpath='{.spec.concurrencyPolicy}'
# Deve retornar "Forbid"
```

---

### Cenário 4: Retry Storm

**Descrição:** Um bug no `validation-worker` faz com que ele tente processar a mesma mensagem repetidamente sem dar ack, gerando storm de retries no NATS.

**Trigger detectado:**
```promql
velya_agent_retry_rate_percent{agent="validation-worker"} > 50
```

**Impacto esperado:**
- Budget de retries do Validation Office sendo consumido rapidamente
- Potencial throttling de outras filas compartilhando o mesmo NATS
- Logs inundados com stack traces do mesmo erro

**Resposta do sistema:**
1. T+0s: Watchdog detecta retry_rate > 50%
2. T+10min: Circuit breaker ativado automaticamente: validation-worker pausado
3. T+10min: Alerta disparado com tipo de erro mais comum
4. T+15min: Se erro é permanente (schema validation): bloquear retries, abrir issue Architecture Review
5. T+15min: Fila de validação roteada para processamento manual temporário
6. T+30min: On-call investiga e corrige o bug

**Verificação de sucesso:**
```bash
# Verificar que retry rate caiu
curl -s http://localhost:9090/api/v1/query?query=velya_agent_retry_rate_percent{agent="validation-worker"} | jq '.data.result[0].value[1]'
# Deve ser < 0.10

# Verificar que circuit breaker foi fechado
kubectl get configmap agent-state -n velya-dev-agents -o jsonpath='{.data.validation-worker\.state}'
# Deve retornar "active"
```

---

### Cenário 5: Validation Backlog

**Descrição:** O `output-validator-agent` fica sobrecarregado porque o modelo LLM usado para validações está com latência muito alta (P99 de 30s vs normal de 5s).

**Trigger detectado:**
```promql
nats_consumer_num_pending{consumer="validation-required-consumer"} > 50 AND
histogram_quantile(0.99, rate(velya_agent_task_duration_seconds_bucket{agent="output-validator-agent"}[10m])) > 20
```

**Impacto esperado:**
- Outputs de outros agents aguardando validação por tempo excessivo
- Tasks clínicas que requerem validação antes de aplicação ficam presas
- SLA de validação < 30s sendo violado para >30% das tarefas

**Resposta do sistema:**
1. T+0s: Watchdog detecta backlog crescente com latência alta
2. T+5min: Diagnóstico automático: LLM API com latência anômala
3. T+10min: Validador configura timeout reduzido para forçar fallback para modelo mais rápido (gpt-4o-mini)
4. T+15min: KEDA aumenta réplicas do validation-worker para compensar latência
5. T+30min: Se modelo mais rápido tem accuracy < 0.80: validações suspensas, human review ativado para tasks críticas

**Verificação de sucesso:**
```bash
# Lag da fila de validação voltando ao normal
nats consumer info VELYA_AGENTS validation-required-consumer | grep NumPending
# Deve ser < 10

# Latência P99 de validação normalizada
curl -s "http://localhost:9090/api/v1/query?query=histogram_quantile(0.99,rate(velya_agent_task_duration_seconds_bucket{agent='output-validator-agent'}[5m]))"
# Deve ser < 10
```

---

### Cenário 6: Audit Backlog

**Descrição:** O Loki fica indisponível temporariamente, fazendo o `audit-recorder-agent` falhar em todas as tentativas de gravar trilha de auditoria.

**Trigger detectado:**
```promql
rate(velya_agent_tasks_processed_total{agent="audit-recorder-agent", status="failure"}[5m]) > 0.5
```

**Impacto esperado:**
- Decisões de agents sendo executadas sem trilha de auditoria
- Incidente de compliance: dados de auditoria podem ser perdidos permanentemente se o backlog não for recuperado após Loki voltar
- Violação de requisito regulatório de auditabilidade de decisões clínicas

**Resposta do sistema:**
1. T+0s: audit-recorder-agent detecta falha de conexão com Loki
2. T+0s: Audit events acumulados em buffer local em memória (capacidade: 1000 eventos)
3. T+30s: Alerta S1: "Loki indisponível — audit trail em risco" + page on-call imediato
4. T+2min: Se Loki ainda indisponível: buffer secundário em NATS stream `VELYA_AUDIT.buffer`
5. T+5min: Se Loki ainda indisponível: tasks clínicas com audit obrigatório são suspensas
6. T+Loki recovery: Replay automático do buffer para Loki (em ordem cronológica)

**Verificação de sucesso:**
```bash
# Verificar que Loki está respondendo
curl -s http://localhost:3100/ready
# Deve retornar "ready"

# Verificar que o backlog de audit foi processado
nats stream info VELYA_AUDIT --json | jq '.state.messages'
# Deve corresponder ao total esperado sem lacunas

# Verificar que audit-recorder está operacional
kubectl logs -n velya-dev-agents -l app=audit-recorder-agent --since=5m | grep "successfully"
```

---

### Cenário 7: Office Overload

**Descrição:** Um evento externo (grande internação em massa de pacientes por acidente) gera 5x o volume normal de tasks no Clinical Operations Office.

**Trigger detectado:**
```promql
rate(velya_office_messages_received_total{office="clinical-operations"}[30m]) >
rate(velya_office_messages_received_total{office="clinical-operations"}[30m] offset 1d) * 4
```

**Impacto esperado:**
- Queue buildup progressivo no clinical-operations
- SLA de classificação < 3 minutos violado para a maioria das tasks
- Workers escalando ao máximo mas insuficientes para o volume

**Resposta do sistema:**
1. T+0s: Watchdog detecta spike de volume 4x
2. T+5min: KEDA tenta escalar workers (até maxReplicaCount)
3. T+10min: Se maxReplicaCount atingido e lag ainda crescendo: modo degraded ativado para o office
4. T+10min: Tasks de urgência LOW suspensas, apenas MEDIUM+ processadas
5. T+15min: On-call notificado com contexto: "volume 5x, scaling máximo, degraded mode ativo"
6. T+20min: Se necessário: aumentar temporariamente maxReplicaCount via patch

**Verificação de sucesso:**
```bash
# Verificar que queue lag está estabilizando
velya_agent_queue_lag{agent="task-inbox-worker"} # Deve parar de crescer

# Verificar que tasks de alta urgência estão sendo processadas
# Verificar que modo degraded foi ativado e documentado
kubectl get configmap velya-operating-mode -n velya-dev-platform -o jsonpath='{.data.current_mode}'
# Deve retornar "degraded"
```

---

### Cenário 8: Dead-Letter Growth

**Descrição:** A DLQ `velya.agents.dlq.max-retries-exceeded` acumula mais de 200 mensagens em 1 hora sem nenhuma investigação iniciada.

**Trigger detectado:**
```promql
increase(nats_stream_total_messages{stream="VELYA_DLQ", subject=~".*max-retries.*"}[1h]) > 200
```

**Impacto esperado:**
- Tarefas clínicas potencialmente perdidas (dependendo do conteúdo da DLQ)
- SLA de investigação de DLQ violado (2 horas para max-retries)
- Budget de retries do office esgotado sem resolução

**Resposta do sistema:**
1. T+0s: Alerta `DLQGrowthRateHigh` disparado
2. T+10min: DLQ analyzer agent classifica tipos de erro nas mensagens da DLQ
3. T+15min: Se todos erros são do mesmo tipo: identificar causa raiz comum
4. T+15min: Notificar owner do office com diagnóstico
5. T+2h: Se DLQ não processada: escalada para tech lead
6. T+4h: Se ainda não processada: incidente S2 formal criado

**Verificação de sucesso:**
```bash
# DLQ decrescendo ou estável (não crescendo)
nats consumer info VELYA_DLQ dlq-max-retries-consumer | grep NumPending
# Deve ser decrescente ou zero

# Confirmar que owner iniciou investigação
# Verificar ticket de investigação no sistema
```

---

### Cenário 9: Cost Spike

**Descrição:** O custo de inferência LLM aumenta 5x em 2 horas devido a um loop de retry em um agent que chama o LLM em cada tentativa (incluindo retries que não deveriam chamar LLM).

**Trigger detectado:**
```promql
rate(velya_agent_llm_cost_usd_total[1h]) >
rate(velya_agent_llm_cost_usd_total[1h] offset 1d) * 4
```

**Impacto esperado:**
- Budget mensal de LLM sendo consumido em 2 dias ao invés de 30
- Custo anômalo que pode ultrapassar os limites de cartão/conta AWS

**Resposta do sistema:**
1. T+0s: Alerta `LLMCostSpikeDetected` disparado (4x acima de ontem)
2. T+15min: Circuit breaker de LLM avaliado: se rate > $0.50/min, circuit breaker abre
3. T+20min: FinOps agent identifica o agent causador via `velya_agent_llm_cost_usd_total by (agent)`
4. T+25min: Agent causador pausado enquanto causa é investigada
5. T+30min: On-call engineer notificado com contexto completo
6. T+1h: Fix deployado (sem LLM em retries) + circuit breaker fechado

**Verificação de sucesso:**
```bash
# Custo de LLM voltando ao normal
rate(velya_agent_llm_cost_usd_total[30m]) # Deve ser próximo à baseline

# Circuit breaker fechado
curl -s http://localhost:9090/api/v1/query?query=velya_llm_circuit_breaker_state
# Deve retornar 0 (closed)
```

---

### Cenário 10: Stuck Handoff

**Descrição:** O `task-inbox-worker` completa a classificação e publica o resultado na fila de handoff para o `discharge-worker`, mas o discharge-worker nunca consome a mensagem porque seu consumer group perdeu a configuração.

**Trigger detectado:**
```promql
nats_consumer_num_pending{consumer="discharge-trigger-consumer"} > 0 AND
increase(nats_consumer_num_ack_pending{consumer="discharge-trigger-consumer"}[30m]) == 0
```

**Impacto esperado:**
- Processos de alta hospitalar não iniciando após classificação concluída
- Pacientes aguardando alta com workflow nunca iniciado
- SLA de início de discharge workflow (< 5 minutos após ordem médica) violado

**Resposta do sistema:**
1. T+0s: Watchdog detecta mensagens pendentes sem ack por 30 minutos
2. T+5min: Verifica estado do discharge-worker (pod health, consumer group status)
3. T+5min: Se consumer group corrompido: recriar consumer via NATS CLI
4. T+10min: Se discharge-worker falhando: investigar e reiniciar
5. T+15min: Notificar Clinical Operations Office: processos de alta estão presos

**Verificação de sucesso:**
```bash
# Consumer group ativo e processando
nats consumer info VELYA_AGENTS discharge-trigger-consumer
# NumPending deve estar decrescendo

# Verificar que discharge workflows foram iniciados no Temporal
temporal workflow list --query 'WorkflowType="DischargeWorkflow" AND StartTime > "2026-04-08T14:00:00Z"' --namespace velya
```

---

### Cenário 11: Stale Task Recovery

**Descrição:** Múltiplos tasks adquiriram leases mas os workers que as adquiriram falharam antes de dar ack. Os leases expiraram mas ninguém os reliberou, e novas mensagens NATS não estão sendo entregues porque o sistema acha que já estão em processamento.

**Trigger detectado:**
```promql
velya_leases_expired_not_released_total > 10
```

**Impacto esperado:**
- Mensagens "fantasma" presas em estado de processamento
- Fila aparenta ter mensagens em processo mas nenhum worker está de fato processando
- Throughput zero apesar de workers disponíveis

**Resposta do sistema:**
1. T+0s: Lease sweeper (executa a cada 5 minutos) detecta leases expirados há > 2x o TTL
2. T+5min: Lease sweeper libera automaticamente os leases expirados (deleta do KV VELYA_LEASES)
3. T+5min: NATS reentrega as mensagens (max_deliver - tentativas já feitas)
4. T+5min: Workers retomam processamento normalmente
5. T+30min: Investigar por que os workers falharam sem liberar lease

**Verificação de sucesso:**
```bash
# Verificar que não há leases expirados no KV bucket
nats kv status VELYA_LEASES
# Deve mostrar apenas leases válidos (created_at recente)

# Verificar que throughput voltou ao normal
rate(velya_agent_tasks_processed_total{agent="task-inbox-worker"}[5m])
```

---

### Cenário 12: Quarantine Trigger

**Descrição:** O `task-inbox-worker` começa a classificar 40% dos itens urgentes como baixa prioridade (falso negativo crítico em clínica). O Governance Agent detecta e aciona quarantine.

**Trigger detectado:**
- Governance Agent: `clinical_misclassification_rate > 0.20` por 30 minutos
- Ou: 5 correções manuais de "BAIXA → CRITICA" em 1 hora

**Impacto esperado:**
- Pacientes com condição crítica recebendo atenção atrasada
- Risco clínico real e imediato
- Confiabilidade do sistema comprometida

**Resposta do sistema:**
1. T+0s: Governance Agent detecta padrão de misclassification
2. T+0s: Imediato: task-inbox-worker quarantenado (L2 - hard isolation)
3. T+0s: Fila de tasks roteada para revisão humana manual
4. T+0s: Alerta CRÍTICO + page on-call + notificação clinical-operations
5. T+30min: Root cause investigation iniciada
6. T+2h: Primeiro update de status para todas as partes
7. T+48h: Decisão formal: fix e shadow mode ou aposentadoria

**Verificação de sucesso:**
```bash
# Worker em quarantine
kubectl get configmap agent-state -n velya-dev-agents -o jsonpath='{.data.task-inbox-worker\.state}'
# Deve retornar "quarantine"

# Tasks sendo processadas por fallback humano
# Verificar que clinical-operations foi notificado e respondeu

# Se fix foi aplicado: verificar accuracy em shadow mode antes de reativar
```

---

### Cenário 13: Learning Propagation Issue

**Descrição:** Um learning event mal-formado com regra de validator incorreta foi aprovado sem revisão adequada e está sendo propagado para todos os agents. A regra errada rejeita 30% dos outputs válidos.

**Trigger detectado:**
```promql
rate(velya_agent_validations_failed_total[30m]) >
rate(velya_agent_validations_failed_total[30m] offset 1h) * 3
```

**Impacto esperado:**
- Backlog de validações aumentando rapidamente
- Tasks sendo bloqueadas desnecessariamente
- Operadores clínicos recebendo escalações falsas

**Resposta do sistema:**
1. T+0s: Alerta `AgentValidationPassRateLow` disparado para múltiplos agents simultaneamente
2. T+5min: Padrão temporal identificado: problema começou após propagação de validator rule
3. T+5min: Rollback automático do ConfigMap `validator-rules` para versão anterior
4. T+10min: Propagation gate revisado: quem aprovou a regra sem validação adequada?
5. T+15min: Incidente S2 aberto: breach do processo de validação de learning events

**Verificação de sucesso:**
```bash
# Validation pass rate voltando ao normal
rate(velya_agent_validations_passed_total[10m]) /
rate(velya_agent_validations_total[10m])
# Deve ser > 0.90

# Versão do ConfigMap de validator rules é o rollback
kubectl get configmap validator-rules -n velya-dev-agents -o jsonpath='{.metadata.resourceVersion}'
# Deve ser a versão anterior ao incidente
```

---

### Cenário 14: Degraded Mode

**Descrição:** O sistema entra em modo degraded automaticamente após falha do Temporal server, que afeta todos os workflows de alta hospitalar.

**Trigger detectado:**
```promql
up{job="temporal-server"} == 0
```

**Impacto esperado:**
- Todos os workflows de alta paralisados
- Novos workflows não podem ser iniciados
- Workflows em andamento ficam em estado pending até Temporal recuperar

**Resposta do sistema:**
1. T+0s: Prometheus detecta Temporal server down
2. T+30s: Sistema entra em modo degraded automaticamente
3. T+1min: Alerta S1 disparado + page on-call
4. T+2min: Workflows em andamento: Temporal replay automático quando server voltar
5. T+5min: Para novos pedidos de alta: processo manual temporário ativado
6. T+15min: Se Temporal não recuperar: investigar pod (StatefulSet), PVC, PostgreSQL

**Verificação de sucesso:**
```bash
# Temporal server respondendo
kubectl exec -n velya-dev-platform deployment/temporal-server -- \
  temporal operator cluster health --namespace velya

# Workflows retomados
temporal workflow list --query 'ExecutionStatus="Running"' --namespace velya | wc -l
# Deve ser > 0 e aumentando

# Modo operacional voltou a active
kubectl get configmap velya-operating-mode -n velya-dev-platform -o jsonpath='{.data.current_mode}'
# Deve retornar "active"
```

---

### Cenário 15: Pause/Resume

**Descrição:** Uma janela de manutenção planejada para atualização de NATS JetStream requer que todos os workers sejam pausados, NATS seja atualizado, e workers sejam retomados sem perda de mensagens.

**Trigger:** Planejado. Não é falha — é teste de resiliência do processo.

**Impacto esperado:**
- Mensagens acumulam na fila NATS durante a janela (máximo 30 minutos)
- Nenhuma mensagem perdida
- Após resume, workers processam backlog acumulado em ordem

**Resposta do sistema:**
1. T-4h: Notificação de manutenção planejada publicada
2. T-30min: Sistema entra em modo maintenance
3. T-30min: Workers pausados via ConfigMap
4. T-30min: Confirmar que todos os leases foram concluídos ou liberados
5. T-0min: NATS JetStream atualizado (StatefulSet image update)
6. T+10min: NATS health check: `nats server ping`
7. T+10min: Workers retomados: ConfigMap atualizado para active
8. T+10min: KEDA começa a escalar workers com base no lag acumulado
9. T+30min: Confirmar que backlog foi processado completamente

**Verificação de sucesso:**
```bash
# Nenhuma mensagem perdida
nats stream info VELYA_AGENTS --json | jq '.state.messages'
# Deve ser > 0 (mensagens acumuladas durante manutenção, agora sendo processadas)

# Workers processando normalmente
rate(velya_agent_tasks_processed_total[5m])
# Deve estar acima do normal (processando backlog)

# Lag zerado após processamento de backlog
# Aguardar até queue_lag < 5
```

---

### Cenário 16: Shadow Mode Promotion

**Descrição:** Um novo `task-inbox-classifier-v2` completou 7 dias em shadow mode com accuracy 94%. O processo de promoção para produção deve ser feito sem downtime.

**Trigger:** Critérios de promoção atingidos: `shadow_days >= 7 AND accuracy >= 0.90 AND incidents == 0`

**Impacto esperado:**
- Transição transparente para usuários clínicos
- Zero tasks perdidas durante o switch
- Rollback rápido disponível se v2 degradar

**Resposta do sistema:**
1. T-0: Architecture Review Office aprova promoção
2. T-0: Deployment v2 escalado para produção (blue-green)
3. T-0: NATS: consumer do v1 suspenso, consumer do v2 ativado
4. T+5min: Monitorar accuracy e latência do v2 vs baseline
5. T+30min: Se sem incidentes: deployment v1 removido
6. T+1h: Relatório de promoção publicado no Knowledge Office

**Verificação de sucesso:**
```bash
# v2 está processando tasks
rate(velya_agent_tasks_processed_total{agent="task-inbox-classifier-v2"}[5m])
# Deve ser > 0

# v1 não está mais processando
rate(velya_agent_tasks_processed_total{agent="task-inbox-classifier-v1"}[5m])
# Deve ser 0

# Accuracy do v2 acima do threshold
velya_agent_output_quality_score_rolling_1h{agent="task-inbox-classifier-v2"}
# Deve ser > 0.90
```

---

### Cenário 17: False Healthy Status

**Descrição:** O `ops-watchdog` envia heartbeat com `health.status: healthy` mas na realidade não está executando nenhuma verificação de anomalia (bug no loop de checks).

**Trigger detectado:**
```promql
# Heartbeat presente mas anomaly checks não ocorrendo
velya_watchdog_checks_executed_total rate == 0 AND
velya_agent_heartbeat_timestamp{agent="ops-watchdog"} recent
```

**Impacto esperado:**
- O sistema acredita que está sendo supervisionado
- Anomalias reais não são detectadas
- Falsa sensação de segurança

**Resposta do sistema:**
1. T+0s: Meta-Watchdog detecta ausência de anomaly checks por > 10 minutos
2. T+2min: Alerta `FalseHealthyStatus` disparado
3. T+5min: Meta-Watchdog ativa verificações mínimas de survival
4. T+5min: Page on-call: "Watchdog está reporting healthy mas não fazendo checks"
5. T+15min: Restart do ops-watchdog para forçar reinicialização do loop

**Verificação de sucesso:**
```bash
# Watchdog executando checks novamente
rate(velya_watchdog_checks_executed_total[5m])
# Deve ser > 0

# Meta-watchdog não mais em modo de assumir responsabilidades
velya_meta_watchdog_agents_assumed
# Deve ser 0
```

---

### Cenário 18: No-Owner Backlog

**Descrição:** Uma refatoração de subjects NATS enviou mensagens para `velya.agents.clinical-ops.NEW-task-classification` ao invés de `velya.agents.clinical-ops.task-classification`. O consumer não existe para o novo subject.

**Trigger detectado:**
```promql
nats_stream_total_messages{stream="VELYA_DLQ", subject=~".*no-owner.*"} > 0
```

**Impacto esperado:**
- Tasks de classificação clínica sendo perdidas silenciosamente
- Nenhum worker consumindo as mensagens
- Inbox clínico não sendo processado

**Resposta do sistema:**
1. T+0s: NATS: mensagens sem consumer após `max_age` entram na DLQ no-owner
2. T+5min: Alerta `DLQNoOwner` disparado — incidente S2 imediato
3. T+5min: Platform Health Office investigado
4. T+10min: Subject correto identificado e consumer recriado
5. T+10min: Mensagens na DLQ no-owner reprocessadas para o subject correto

**Verificação de sucesso:**
```bash
# DLQ no-owner vazia
nats consumer info VELYA_DLQ dlq-no-owner-consumer | grep NumPending
# Deve ser 0

# Consumer correto ativo no stream
nats consumer info VELYA_AGENTS task-classification-consumer | grep NumPending
# Deve estar processando
```

---

### Cenário 19: Empresa Funcionando sob Degradação Parcial

**Descrição:** O cluster perde 1 dos 3 nós (falha de hardware simulada) e os pods são redistribuídos nos 2 nós restantes. Alguns pods ficam em Pending por falta de recursos.

**Trigger detectado:**
```promql
kube_node_status_condition{condition="Ready", status="true"} == 2  # Apenas 2 de 3 nós
```

**Impacto esperado:**
- Capacidade de compute reduzida em ~33%
- Alguns pods de workers em Pending (sem recursos disponíveis)
- Serviços críticos (realtime-app nodepool) mantidos com PDB
- Serviços não-críticos (batch, analytics) evictados

**Resposta do sistema:**
1. T+0s: Kubernetes detecta node NotReady
2. T+30s: Pods do node perdido marcados para eviction
3. T+1min: Scheduler tenta realocar em outros nodes (limitado por recursos)
4. T+1min: PDB garante: api-gateway, patient-flow-service mantêm minAvailable
5. T+2min: Alerta `NodeNotReady` disparado
6. T+5min: Batch agents suspensos automaticamente (liberar recursos para críticos)
7. T+10min: Sistema em modo degraded: apenas serviços críticos e alta urgência
8. T+30min: On-call avalia: substituir node (kind: novo container; EKS: Karpenter provisiona novo)

**Verificação de sucesso:**
```bash
# Serviços críticos ainda respondendo
kubectl get pods -n velya-dev-core # Todos Running
curl -s http://localhost:30080/health # api-gateway respondendo

# Sistema em modo degraded
kubectl get configmap velya-operating-mode -n velya-dev-platform -o jsonpath='{.data.current_mode}'
# Deve retornar "degraded"

# Após novo node adicionado: pods Pending sendo scheduled
kubectl get pods -n velya-dev-agents # Gradualmente passando de Pending para Running
```

---

### Cenário 20: Temporal Worker Completamente Down

**Descrição:** Todos os pods do `temporal-worker-clinical` crasham simultaneamente após um OOM killer por memory leak, paralisando todos os workflows clínicos em andamento.

**Trigger detectado:**
```promql
kube_deployment_status_replicas_available{deployment="temporal-worker-clinical"} == 0
```

**Impacto esperado:**
- Todos os workflows de alta em andamento ficam em estado "suspended" no Temporal
- Nenhum novo workflow pode ser iniciado
- Activities já completadas são preservadas pelo Temporal (event sourcing)
- Impacto clínico direto: altas hospitalares paralisadas

**Resposta do sistema:**
1. T+0s: Kubernetes detecta todos os pods em CrashLoopBackOff
2. T+30s: Alerta `TemporalWorkerDown` disparado — severity CRITICAL + page imediato
3. T+1min: Sistema clínico entra em modo manual: enfermagem notificada de processo manual de alta
4. T+2min: Investigação de OOM: verificar memory limits e leak
5. T+5min: Aumentar memory limits temporariamente + restart dos workers
6. T+10min: Temporal replay: workflows retomam de onde pararam (Activities completadas não se repetem)
7. T+30min: Memory leak identificado, hotfix deployado
8. T+1h: Todos os workflows retomados, sistema em modo active

**Verificação de sucesso:**
```bash
# Temporal workers rodando
kubectl get pods -n velya-dev-platform -l app=temporal-worker-clinical
# Todos em Running state

# Workflows retomados
temporal workflow list --query 'ExecutionStatus="Running"' --namespace velya
# Deve mostrar workflows ativos retomando de onde pararam

# Sistema voltou a active
kubectl get configmap velya-operating-mode -n velya-dev-platform -o jsonpath='{.data.current_mode}'
# Deve retornar "active"

# Nenhuma alta perdida — verificar que workflows completaram
temporal workflow list --query 'WorkflowType="DischargeWorkflow" AND ExecutionStatus="Completed"' --namespace velya
```

---

## 3. Checklist de Gameday

Para cada gameday trimestral, executar:

- [ ] Scenário 1 (Agent Silencioso): matar processo de heartbeat no pod, verificar alerta em < 3 min
- [ ] Cenário 4 (Retry Storm): injetar erro permanente em 50% das tasks, verificar circuit breaker
- [ ] Cenário 9 (Cost Spike): simular LLM chamado em retries, verificar circuit breaker LLM
- [ ] Cenário 14 (Degraded Mode): matar Temporal server pod, verificar transição para degraded
- [ ] Cenário 19 (Node Loss): `kubectl cordon + kubectl drain` em 1 nó, verificar PDB e redistribuição
- [ ] Cenário 20 (Temporal Worker Down): escalar temporal-worker para 0, verificar response e recovery

**Após cada gameday:** Post-mortem escrito em 48h, lições aprendidas para Knowledge Office, alertas/runbooks atualizados.
