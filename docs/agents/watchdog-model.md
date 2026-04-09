# Modelo de Watchdog — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Namespace:** velya-dev-agents  
**Última revisão:** 2026-04-08

---

## 1. Propósito do Watchdog

O Watchdog é o mecanismo de supervisão ativa do ecossistema de agents da Velya. Enquanto os Sentinel agents monitoram métricas de infraestrutura, o Watchdog supervisiona o **comportamento** dos agents: detecta anomalias que não são visíveis em métricas simples, responde automaticamente quando possível, e escalada para humanos quando necessário.

A Velya opera com um modelo de Watchdog em três camadas:

```
┌─────────────────────────────────────────────────────────┐
│                   META-WATCHDOG                         │
│    Supervisiona todos os watchdogs da plataforma        │
│    Detecta: watchdog silencioso, watchdog travado       │
└─────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  OPS         │  │  CLINICAL    │  │  FINOPS      │
│  WATCHDOG    │  │  WATCHDOG    │  │  WATCHDOG    │
│              │  │              │  │              │
│  Plataforma  │  │  Operações   │  │  Custo e     │
│  e infra     │  │  clínicas    │  │  budget      │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## 2. Os 6 Tipos de Anomalia

### Anomalia Tipo 1: Agent Silencioso

**Definição:** Agent que não enviou heartbeat dentro do threshold configurado para sua classe.

**SLA de detecção:** 3 minutos (Workers/Sentinels), 15 minutos (Batch/Learning)

**Critério formal:**

```
silence_seconds = now() - last_heartbeat_timestamp
threshold = agent_class_heartbeat_interval * 3
IS_SILENT = silence_seconds > threshold
```

**Resposta automática:**

1. Verificar estado do pod via Kubernetes API (Running/Pending/CrashLoopBackOff)
2. Se pod Running: tentar coletar logs recentes via Loki (últimos 5 minutos)
3. Se pod CrashLoopBackOff: registrar incidente S2 imediatamente
4. Se pod em estado desconhecido: registrar incidente S2 e notificar on-call
5. Publicar em `velya.agents.watchdog.anomaly-detected` com tipo `agent_silent`

**Resolução automática:**

- Se heartbeat retornar dentro de 5 minutos sem intervenção: registrar como falso alerta e continuar monitorando
- Se silêncio persistir: tentar restart do pod (apenas se não for agent clínico em processamento ativo)

---

### Anomalia Tipo 2: Queue Buildup

**Definição:** Fila de mensagens crescendo de forma anormal sem correspondente aumento de processamento.

**SLA de detecção:** 5 minutos após início do buildup

**Critério formal:**

```
lag_growth_rate = (current_lag - lag_5min_ago) / 5  # mensagens por minuto
processor_throughput = tasks_processed_last_5min / 5  # tasks por minuto

IS_BUILDUP = lag_growth_rate > processor_throughput * 2 AND current_lag > 20
```

**Resposta automática:**

1. Verificar se workers estão ativos (heartbeat recente)
2. Verificar se KEDA ScaledObject está ativo e respondendo
3. Se workers ativos mas letos: verificar se downstream service está degradado
4. Se KEDA não está escalando: verificar disponibilidade de recursos no namespace
5. Se causa identificada: executar ação de remediação específica
6. Se causa não identificada: escalar para Incident Response Office

**Respostas por causa:**
| Causa identificada | Resposta automática |
|---|---|
| Workers em crash | Aumentar minReplicas temporariamente, notificar |
| Downstream degradado | Pausar workers, drenar para fila de espera |
| KEDA não respondendo | Reiniciar KEDA operator, notificar plataforma |
| ResourceQuota atingida | Alertar FinOps, reduzir concorrência de outros workers |

---

### Anomalia Tipo 3: Retry Storm

**Definição:** Taxa de retries acima de 30% por mais de 10 minutos, indicando problema sistêmico não resolvido.

**SLA de detecção:** 10 minutos após início do storm

**Critério formal:**

```
retry_rate = retries_last_10min / total_attempts_last_10min
IS_RETRY_STORM = retry_rate > 0.30 AND total_attempts_last_10min > 20
```

**Resposta automática:**

1. Identificar o tipo de erro mais comum nos retries (via Loki)
2. Se erro de timeout de tool: verificar saúde do serviço/tool
3. Se erro de schema: bloquear novas tentativas, alertar Architecture Review
4. Se erro de LLM API: verificar budget e disponibilidade de API
5. Aplicar circuit breaker temporário se retry_rate > 50%
6. Publicar alerta em `velya.agents.watchdog.anomaly-detected`

**Circuit Breaker automático:**

```yaml
# Quando retry_rate > 50% por 5 minutos:
action: pause_worker
duration_minutes: 15
reason: 'retry_storm_circuit_breaker'
conditions_to_resume:
  - retry_rate_below: 0.10
  - downstream_healthy: true
  - manual_approval_if_clinical: true
```

---

### Anomalia Tipo 4: Validation Backlog

**Definição:** Backlog de outputs aguardando validação crescendo sem processamento correspondente pelo Validation Office.

**SLA de detecção:** 15 minutos após início do acúmulo

**Critério formal:**

```
validation_queue_depth = messages_in("velya.agents.governance.validation-required")
validation_throughput = validations_completed_last_15min / 15

IS_VALIDATION_BACKLOG = validation_queue_depth > 50 AND
                        validation_throughput < validation_queue_depth / 30
```

**Resposta automática:**

1. Verificar disponibilidade do validation-worker
2. Se validation-worker em crash: notificar imediatamente (tasks aguardando podem expirar)
3. Se validation-worker lento: verificar custo de LLM (pode estar throttled)
4. Se custo LLM alto: verificar se usando modelo correto (pode ter regredido para modelo caro)
5. Escalar réplicas de validation-worker temporariamente se recursos disponíveis

---

### Anomalia Tipo 5: Audit Backlog

**Definição:** Backlog de eventos aguardando auditoria crescendo de forma anormal.

**SLA de detecção:** 30 minutos (auditoria é menos urgente que validação)

**Critério formal:**

```
audit_queue_depth = messages_in("velya.agents.governance.audit-required")
IS_AUDIT_BACKLOG = audit_queue_depth > 200
```

**Resposta automática:**

1. Verificar disponibilidade do audit-recorder-agent
2. Verificar capacidade de storage do Loki (pode estar cheio)
3. Verificar conectividade com audit stream NATS
4. Se storage de Loki > 90%: alertar imediatamente (perda de audit trail é incidente S1)
5. Escalar réplicas de audit-recorder se recursos disponíveis

---

### Anomalia Tipo 6: Office Overload

**Definição:** Um office está com backlog persistente, SLAs sendo violados e sem auto-recuperação.

**SLA de detecção:** 60 minutos de SLA violado consecutivo

**Critério formal:**

```
sla_violations_last_hour = tasks_exceeding_sla / total_tasks_last_hour
IS_OVERLOADED = sla_violations_last_hour > 0.20 AND duration_minutes > 60
```

**Resposta automática:**

1. Analisar causa: volume excessivo, recursos insuficientes, ou agent lento
2. Se volume excessivo: verificar se há spike anormal e se é esperado
3. Se recursos insuficientes: solicitar aprovação para aumentar ResourceQuota
4. Se agent lento: verificar se há degradação de qualidade de LLM ou timeout
5. Acionar Learning Office para identificar se é padrão recorrente

---

## 3. Configuração como CronJob Kubernetes

O Watchdog principal roda como Deployment (não CronJob) para garantir execução contínua. Watchdogs especializados podem rodar como CronJob para análises periódicas.

### 3.1 Ops Watchdog — Deployment Contínuo

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ops-watchdog
  namespace: velya-dev-agents
  labels:
    app.kubernetes.io/name: ops-watchdog
    app.kubernetes.io/component: agent
    velya.io/agent-class: Watchdog
    velya.io/office: watchdog
    velya.io/criticality: critical
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ops-watchdog
  template:
    metadata:
      labels:
        app: ops-watchdog
        velya.io/agent-class: Watchdog
    spec:
      serviceAccountName: ops-watchdog-sa
      containers:
        - name: watchdog
          image: velya/ops-watchdog:1.0.0
          env:
            - name: NATS_URL
              valueFrom:
                secretKeyRef:
                  name: nats-credentials
                  key: url
            - name: PROMETHEUS_URL
              value: 'http://prometheus.velya-dev-observability.svc.cluster.local:9090'
            - name: LOKI_URL
              value: 'http://loki.velya-dev-observability.svc.cluster.local:3100'
            - name: KUBERNETES_NAMESPACE
              valueFrom:
                fieldRef:
                  fieldPath: metadata.namespace
            - name: CHECK_INTERVAL_SECONDS
              value: '30'
            - name: AGENT_SILENT_THRESHOLD_SECONDS
              value: '180'
            - name: QUEUE_BUILDUP_THRESHOLD
              value: '20'
            - name: RETRY_STORM_THRESHOLD_PERCENT
              value: '30'
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi
          readinessProbe:
            httpGet:
              path: /ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 30
      terminationGracePeriodSeconds: 60
```

### 3.2 RBAC do Watchdog

O Watchdog precisa de permissões para ler e atualizar estados de deployments no namespace de agents:

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: ops-watchdog-sa
  namespace: velya-dev-agents
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: ops-watchdog-role
  namespace: velya-dev-agents
rules:
  - apiGroups: ['apps']
    resources: ['deployments']
    verbs: ['get', 'list', 'watch', 'patch']
  - apiGroups: ['']
    resources: ['pods']
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['']
    resources: ['pods/log']
    verbs: ['get']
  - apiGroups: ['']
    resources: ['events']
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['batch']
    resources: ['cronjobs', 'jobs']
    verbs: ['get', 'list', 'watch']
  - apiGroups: ['keda.sh']
    resources: ['scaledobjects']
    verbs: ['get', 'list', 'watch']
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: ops-watchdog-binding
  namespace: velya-dev-agents
subjects:
  - kind: ServiceAccount
    name: ops-watchdog-sa
    namespace: velya-dev-agents
roleRef:
  kind: Role
  name: ops-watchdog-role
  apiGroup: rbac.authorization.k8s.io
```

---

## 4. Meta-Watchdog

O Meta-Watchdog supervisiona todos os outros watchdogs da plataforma. Se um watchdog falha, o Meta-Watchdog detecta e escalada.

### 4.1 Configuração do Meta-Watchdog

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: meta-watchdog
  namespace: velya-dev-agents
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: meta-watchdog
          image: velya/meta-watchdog:1.0.0
          env:
            - name: MONITORED_WATCHDOGS
              value: 'ops-watchdog,clinical-watchdog,finops-watchdog'
            - name: WATCHDOG_SILENCE_THRESHOLD_SECONDS
              value: '90'
            - name: ESCALATION_CHANNEL
              value: 'velya-ops-critical'
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 200m
              memory: 128Mi
```

### 4.2 Lógica do Meta-Watchdog

```python
class MetaWatchdog:
    """
    Supervisiona todos os watchdogs registrados na plataforma.
    Se um watchdog fica silencioso, o Meta-Watchdog escalada imediatamente.
    """

    MONITORED_WATCHDOGS = [
        WatchdogConfig("ops-watchdog", silence_threshold=90, criticality="critical"),
        WatchdogConfig("clinical-watchdog", silence_threshold=90, criticality="critical"),
        WatchdogConfig("finops-watchdog", silence_threshold=120, criticality="high"),
    ]

    async def check_watchdog_health(self):
        for watchdog_config in self.MONITORED_WATCHDOGS:
            last_hb = await self.get_last_heartbeat(watchdog_config.name)

            if last_hb is None:
                await self.trigger_watchdog_missing_incident(watchdog_config)
                continue

            silence_seconds = time.time() - last_hb.timestamp

            if silence_seconds > watchdog_config.silence_threshold:
                incident = WatchdogDownIncident(
                    watchdog=watchdog_config.name,
                    silence_seconds=silence_seconds,
                    criticality=watchdog_config.criticality,
                    affected_agents=await self.list_agents_by_office(watchdog_config.office)
                )
                await self.trigger_incident(incident)

                # Meta-watchdog assume temporariamente as verificações críticas
                if watchdog_config.criticality == "critical":
                    await self.assume_critical_checks(watchdog_config)

    async def assume_critical_checks(self, failed_watchdog: WatchdogConfig):
        """
        Quando um watchdog crítico falha, o Meta-Watchdog assume
        as verificações mínimas enquanto aguarda recuperação.
        """
        # Apenas verificações de survival — não substitui o watchdog completo
        for agent in await self.list_agents_by_office(failed_watchdog.office):
            hb = await self.get_last_heartbeat(agent.name)
            if hb is None or (time.time() - hb.timestamp) > 300:
                await self.send_critical_alert(agent, "watchdog_down")
```

---

## 5. Integração com AlertManager

```yaml
# Regras de alerta para Watchdog
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-watchdog-alerts
  namespace: velya-dev-observability
spec:
  groups:
    - name: velya.watchdog
      interval: 30s
      rules:
        - alert: WatchdogDetectedAgentSilent
          expr: |
            velya_watchdog_anomalies_total{type="agent_silent"} > 0
          for: 0m
          labels:
            severity: critical
          annotations:
            summary: 'Watchdog detectou agent silencioso: {{ $labels.agent_name }}'

        - alert: WatchdogDetectedQueueBuildup
          expr: |
            velya_watchdog_anomalies_total{type="queue_buildup"} > 0
          for: 5m
          labels:
            severity: warning
          annotations:
            summary: 'Queue buildup detectado na fila: {{ $labels.queue_name }}'

        - alert: WatchdogDetectedRetryStorm
          expr: |
            velya_watchdog_anomalies_total{type="retry_storm"} > 0
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: 'Retry storm detectado no agent: {{ $labels.agent_name }}'

        - alert: MetaWatchdogDetectedWatchdogDown
          expr: |
            velya_meta_watchdog_watchdogs_down > 0
          for: 0m
          labels:
            severity: critical
            page: 'true'
          annotations:
            summary: 'CRÍTICO: Watchdog {{ $labels.watchdog_name }} está inativo'
            description: 'O sistema de supervisão está parcialmente cego. Ação humana imediata necessária.'

        - alert: CircuitBreakerActivated
          expr: |
            velya_watchdog_circuit_breakers_active > 0
          for: 0m
          labels:
            severity: warning
          annotations:
            summary: 'Circuit breaker ativado pelo watchdog para agent: {{ $labels.agent_name }}'
            description: 'Agent pausado por retry storm. Verificar causa raiz antes de retomar.'
```

---

## 6. Escalation Chain por Tipo de Incidente

### 6.1 Agent Silencioso

```
T+0min:  Watchdog detecta silêncio → publica anomalia
T+1min:  Watchdog verifica pod status
T+2min:  Se pod failing → cria incidente S2 automaticamente
T+3min:  Alerta Slack para #velya-ops-alerts
T+5min:  Se pod OK mas silencioso → tenta restart controlado
T+10min: Se silêncio persiste → notifica on-call engineer
T+30min: Se silêncio persiste com impacto clínico → notifica tech lead
```

### 6.2 Queue Buildup

```
T+0min:  Watchdog detecta buildup
T+5min:  Diagnóstico automático de causa
T+10min: Se causa identificada → ação de remediação automática
T+15min: Alerta Slack com diagnóstico
T+30min: Se buildup persiste → notifica on-call
T+60min: Se buildup crítico (>500 msgs) → notifica tech lead e aciona degraded mode
```

### 6.3 Retry Storm

```
T+0min:  Watchdog detecta retry rate > 30%
T+10min: Diagnóstico de tipo de erro
T+10min: Se retry rate > 50% → circuit breaker automático
T+15min: Alerta Slack com tipo de erro
T+20min: Se erro permanente → bloqueia retries, abre issue Architecture Review
T+30min: Notifica on-call se impacto operacional confirmado
```

### 6.4 Watchdog Down (Meta-Watchdog)

```
T+0min:  Meta-Watchdog detecta watchdog silencioso
T+0min:  Alerta CRÍTICO imediato para #velya-ops-critical
T+0min:  Page para on-call engineer
T+5min:  Meta-Watchdog assume verificações críticas mínimas
T+10min: Se watchdog não recuperar → segunda pessoa notificada
T+30min: Revisão de todos os agents sob supervisão do watchdog afetado
```

---

## 7. Métricas do Watchdog

```
velya_watchdog_anomalies_total{type, agent_name, office}
velya_watchdog_auto_remediations_total{type, result}
velya_watchdog_circuit_breakers_active{agent_name}
velya_watchdog_incidents_created_total{severity}
velya_watchdog_check_duration_seconds{check_type}
velya_watchdog_heartbeat_timestamp{watchdog_name}
velya_meta_watchdog_watchdogs_down
velya_meta_watchdog_agents_assumed
```

---

## 8. Checklist de Validação do Watchdog

Antes de considerar o Watchdog Office operacional, verificar:

- [ ] ops-watchdog em execução como Deployment no namespace velya-dev-agents
- [ ] meta-watchdog em execução e monitorando todos os watchdogs
- [ ] RBAC correto: ops-watchdog pode fazer patch em deployments
- [ ] Heartbeat de todos os watchdogs visível no dashboard Grafana
- [ ] Alertas Prometheus configurados para todos os 6 tipos de anomalia
- [ ] AlertManager configurado para rotear para Slack e PagerDuty
- [ ] Escalation chain documentada e testada
- [ ] Circuit breaker testado (deploy de agent que gera retry storm artificial)
- [ ] Meta-watchdog testado (parar ops-watchdog e verificar alerta)
- [ ] Runbooks de resposta a cada tipo de anomalia escritos e linkados nos alertas
