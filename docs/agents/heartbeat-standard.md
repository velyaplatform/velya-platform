# Padrão de Heartbeat para Agents — Velya Platform

**Versão:** 1.0  
**Cluster:** kind-velya-local (simulando AWS EKS)  
**Namespace:** velya-dev-agents  
**Última revisão:** 2026-04-08

---

## 1. Propósito do Heartbeat

O heartbeat é o mecanismo pelo qual cada agent na Velya reporta continuamente seu estado de saúde, progresso e contexto operacional. Um agent que não envia heartbeat é considerado potencialmente comprometido ou morto.

O sistema de heartbeat serve a três propósitos:

1. **Detecção de falha:** Identificar agents silenciosos, travados ou em comportamento anômalo
2. **Visibilidade operacional:** Manter o dashboard 24/7 atualizado com o estado real de cada agent
3. **Coordenação:** Informar outros agents e o Meta-Watchdog sobre o estado de processamento

---

## 2. Schema JSON Completo do Heartbeat

Todo heartbeat enviado por qualquer agent Velya deve seguir este schema exato. Campos marcados como `required` são obrigatórios sem exceção.

```json
{
  "$schema": "https://schemas.velya.io/heartbeat/v1.0",

  // ── IDENTIDADE DO AGENT ───────────────────────────────────────────
  "agent_name": "task-inbox-worker", // required: nome canônico
  "agent_id": "task-inbox-worker-7f8d9c-abc12", // required: pod name único
  "agent_class": "Worker", // required: Sentinel|Worker|Batch|Watchdog|Governance|Learning|Market
  "agent_version": "1.2.3", // required: semver
  "office": "clinical-operations", // required: office do agent
  "namespace": "velya-dev-agents", // required: K8s namespace
  "node": "velya-local-worker", // required: K8s node name

  // ── TIMESTAMPS ───────────────────────────────────────────────────
  "heartbeat_at": "2026-04-08T14:23:01.123Z", // required: UTC ISO-8601
  "started_at": "2026-04-08T10:00:00.000Z", // required: quando o agent iniciou
  "heartbeat_sequence": 12345, // required: contador incremental

  // ── ESTADO ATUAL ─────────────────────────────────────────────────
  "current_state": "processing", // required: enum abaixo
  "mode": "active", // required: modo operacional do sistema
  "task_id": "task-uuid-v4-here", // optional: task atual (null se idle)
  "task_type": "task-classification", // optional: tipo da task atual
  "task_started_at": "2026-04-08T14:22:45.000Z", // optional: quando a task atual começou
  "task_progress_percent": 45, // optional: 0-100, null se não aplicável

  // ── FILA E BACKLOG ────────────────────────────────────────────────
  "queue_name": "velya.agents.clinical-ops.task-classification", // required
  "queue_lag": 12, // required: mensagens pendentes na fila
  "queue_lag_trend": "increasing", // required: increasing|stable|decreasing
  "backlog_view": {
    // required: snapshot do estado da fila
    "pending_count": 12,
    "oldest_message_age_seconds": 47,
    "in_progress_count": 3,
    "dlq_count": 0,
    "estimated_clear_time_minutes": 4
  },

  // ── HISTÓRICO DE EXECUÇÃO ─────────────────────────────────────────
  "last_success": {
    // required: null se nunca executou com sucesso
    "task_id": "task-uuid-previous",
    "completed_at": "2026-04-08T14:22:30.000Z",
    "duration_ms": 1345,
    "confidence": 0.89
  },
  "last_error": {
    // required: null se sem erros recentes
    "task_id": "task-uuid-errored",
    "occurred_at": "2026-04-08T14:10:00.000Z",
    "error_type": "ToolTimeoutError",
    "error_message": "get_patient_context timeout after 10s",
    "sent_to_dlq": false,
    "retry_scheduled": true
  },
  "retry_count": 2, // required: retries nas últimas 1 hora
  "retry_rate_percent": 15, // required: % de tasks com retry na última hora

  // ── QUALIDADE E CONFIANÇA ─────────────────────────────────────────
  "confidence": {
    // required
    "last_task": 0.89, // confiança do output da última task
    "rolling_1h_avg": 0.85, // média das últimas 1 hora
    "rolling_24h_avg": 0.88, // média das últimas 24 horas
    "below_threshold_count_1h": 2 // tasks com confidence < 0.70 na última hora
  },
  "validation_pass_rate_percent": 96.5, // required: % de outputs que passaram no validator
  "output_quality_score": 0.87, // required: score composto de qualidade 0.0-1.0

  // ── ESTADO DE SAÚDE ───────────────────────────────────────────────
  "health": {
    // required
    "status": "healthy", // required: healthy|degraded|unhealthy
    "checks": {
      "nats_connectivity": "ok",
      "temporal_connectivity": "ok",
      "prometheus_reachable": "ok",
      "llm_api_reachable": "ok",
      "dependencies_healthy": "ok"
    }
  },

  // ── BLOQUEADORES E ESCALAÇÃO ──────────────────────────────────────
  "blockers": [], // required: lista de bloqueadores ativos
  // Exemplo quando há bloqueador:
  // "blockers": [
  //   {
  //     "type": "dependency_unavailable",
  //     "description": "patient-flow-service retornando 503",
  //     "since": "2026-04-08T14:15:00.000Z",
  //     "impact": "tasks de transfer são atrasadas"
  //   }
  // ],
  "escalation_needed": false, // required: true se requer ação humana
  "escalation_reason": null, // required se escalation_needed=true
  "escalation_urgency": null, // required se escalation_needed=true: low|medium|high|critical

  // ── RECURSOS ──────────────────────────────────────────────────────
  "resource_usage_hint": {
    // required
    "cpu_request_millicores": 50, // configurado no deployment
    "cpu_usage_millicores": 78, // uso atual medido
    "memory_request_mib": 64, // configurado no deployment
    "memory_usage_mib": 89, // uso atual medido
    "llm_tokens_used_last_hour": 8432,
    "llm_cost_usd_last_hour": 0.0169,
    "llm_budget_remaining_usd": 1.983
  },

  // ── METADADOS ─────────────────────────────────────────────────────
  "schema_version": "1.0",
  "cluster": "kind-velya-local",
  "environment": "dev"
}
```

### 2.1 Enum: current_state

| Valor           | Descrição                                               |
| --------------- | ------------------------------------------------------- |
| `idle`          | Sem task em processamento, aguardando mensagens na fila |
| `processing`    | Processando uma task ativa                              |
| `waiting_lease` | Aguardando aquisição de lease                           |
| `waiting_human` | Task aguardando aprovação/input humano                  |
| `retrying`      | Re-tentando após falha transiente                       |
| `paused`        | Suspensão de processamento (modo paused do sistema)     |
| `draining`      | Concluindo tasks em andamento antes de shutdown         |
| `quarantine`    | Isolado por comportamento anômalo                       |
| `degraded`      | Funcionando com capacidade reduzida                     |
| `shadow`        | Executando em modo shadow (outputs não aplicados)       |
| `maintenance`   | Em janela de manutenção                                 |

---

## 3. Frequência de Heartbeat por Classe de Agent

| Classe     | Frequência Normal   | Frequência em Processamento | Frequência em Degraded |
| ---------- | ------------------- | --------------------------- | ---------------------- |
| Sentinel   | 30 segundos         | 60 segundos                 | 15 segundos            |
| Worker     | 60 segundos (idle)  | 30 segundos (processing)    | 15 segundos            |
| Batch      | 5 minutos (running) | 2 minutos (active chunk)    | 1 minuto               |
| Watchdog   | 30 segundos         | 30 segundos                 | 15 segundos            |
| Governance | 60 segundos         | 30 segundos                 | 30 segundos            |
| Learning   | 5 minutos           | 2 minutos                   | 2 minutos              |
| Market     | 10 minutos (idle)   | 5 minutos (running)         | 5 minutos              |

**Nota:** A frequência de heartbeat nunca deve ultrapassar a largura de banda alocada ao NATS. No ambiente kind-velya-local, o limite prático é de ~100 heartbeats/segundo no total de todos os agents.

---

## 4. Publicação do Heartbeat

### 4.1 Subject NATS para Heartbeats

```
velya.agents.heartbeats.{agent_class}.{agent_name}
```

Exemplos:

```
velya.agents.heartbeats.Worker.task-inbox-worker
velya.agents.heartbeats.Sentinel.queue-sentinel
velya.agents.heartbeats.Watchdog.ops-watchdog
```

### 4.2 Implementação de Heartbeat em Python

```python
import asyncio
import json
import time
import os
import psutil
from datetime import datetime, timezone
from nats.aio.client import Client as NATS

class AgentHeartbeat:
    def __init__(self, agent_config: dict):
        self.agent_name = agent_config["agent_name"]
        self.agent_id = os.environ.get("POD_NAME", f"{self.agent_name}-unknown")
        self.agent_class = agent_config["agent_class"]
        self.agent_version = agent_config["version"]
        self.office = agent_config["office"]
        self.queue_name = agent_config["queue_name"]
        self.namespace = os.environ.get("POD_NAMESPACE", "velya-dev-agents")
        self.node = os.environ.get("NODE_NAME", "unknown")
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.sequence = 0
        self.nc: NATS = None

        # State tracking
        self.current_task_id = None
        self.current_task_type = None
        self.current_task_started = None
        self.last_success = None
        self.last_error = None
        self.retry_count_1h = 0
        self.confidence_history = []

    async def connect(self, nats_url: str):
        self.nc = NATS()
        await self.nc.connect(nats_url)

    def build_heartbeat(self) -> dict:
        now = datetime.now(timezone.utc)
        process = psutil.Process()

        # Calcular confidence médias
        conf_last = self.last_success["confidence"] if self.last_success else None
        conf_1h = (sum(self.confidence_history[-60:]) / len(self.confidence_history[-60:])
                   if self.confidence_history else None)

        self.sequence += 1

        return {
            "agent_name": self.agent_name,
            "agent_id": self.agent_id,
            "agent_class": self.agent_class,
            "agent_version": self.agent_version,
            "office": self.office,
            "namespace": self.namespace,
            "node": self.node,
            "heartbeat_at": now.isoformat(),
            "started_at": self.started_at,
            "heartbeat_sequence": self.sequence,
            "current_state": self._determine_state(),
            "mode": self._get_system_mode(),
            "task_id": self.current_task_id,
            "task_type": self.current_task_type,
            "task_started_at": self.current_task_started,
            "queue_name": self.queue_name,
            "queue_lag": self._get_queue_lag(),
            "queue_lag_trend": self._calculate_lag_trend(),
            "backlog_view": self._get_backlog_view(),
            "last_success": self.last_success,
            "last_error": self.last_error,
            "retry_count": self.retry_count_1h,
            "retry_rate_percent": self._calculate_retry_rate(),
            "confidence": {
                "last_task": conf_last,
                "rolling_1h_avg": conf_1h,
                "rolling_24h_avg": self._get_24h_confidence_avg(),
                "below_threshold_count_1h": sum(
                    1 for c in self.confidence_history[-60:] if c < 0.70
                )
            },
            "validation_pass_rate_percent": self._get_validation_pass_rate(),
            "output_quality_score": self._calculate_quality_score(),
            "health": self._check_health(),
            "blockers": self._get_blockers(),
            "escalation_needed": self._needs_escalation(),
            "escalation_reason": self._get_escalation_reason(),
            "escalation_urgency": self._get_escalation_urgency(),
            "resource_usage_hint": {
                "cpu_request_millicores": int(os.environ.get("CPU_REQUEST_MILLICORES", "50")),
                "cpu_usage_millicores": int(process.cpu_percent() * 10),
                "memory_request_mib": int(os.environ.get("MEMORY_REQUEST_MIB", "64")),
                "memory_usage_mib": int(process.memory_info().rss / 1024 / 1024),
                "llm_tokens_used_last_hour": self._get_llm_tokens_1h(),
                "llm_cost_usd_last_hour": self._get_llm_cost_1h(),
                "llm_budget_remaining_usd": self._get_llm_budget_remaining()
            },
            "schema_version": "1.0",
            "cluster": os.environ.get("CLUSTER_NAME", "kind-velya-local"),
            "environment": os.environ.get("ENVIRONMENT", "dev")
        }

    async def start_heartbeat_loop(self, interval_seconds: int = 60):
        subject = f"velya.agents.heartbeats.{self.agent_class}.{self.agent_name}"

        while True:
            try:
                heartbeat = self.build_heartbeat()
                await self.nc.publish(
                    subject,
                    json.dumps(heartbeat).encode()
                )
            except Exception as e:
                # Heartbeat falhou — logar mas não parar o agent
                print(f"ERRO ao publicar heartbeat: {e}", flush=True)

            await asyncio.sleep(interval_seconds)
```

### 4.3 Implementação em Prometheus (Gauge de Heartbeat)

Além do NATS, cada agent expõe uma métrica Prometheus com o timestamp do último heartbeat:

```python
from prometheus_client import Gauge, start_http_server

heartbeat_gauge = Gauge(
    'velya_agent_heartbeat_timestamp',
    'Unix timestamp do último heartbeat enviado',
    ['agent_name', 'agent_class', 'office']
)

async def publish_heartbeat():
    # ... publica no NATS ...
    # Também atualiza o gauge do Prometheus
    heartbeat_gauge.labels(
        agent_name=self.agent_name,
        agent_class=self.agent_class,
        office=self.office
    ).set(time.time())
```

---

## 5. Detecção de Falhas de Heartbeat

### 5.1 Tipos de Falha Detectados

**Tipo 1: Heartbeat Ausente (Agent Silencioso)**

Definição: O agent não enviou nenhum heartbeat em 3x o intervalo configurado.

| Classe     | Intervalo normal | Threshold de alerta | Threshold de incidente |
| ---------- | ---------------- | ------------------- | ---------------------- |
| Sentinel   | 30s              | 90s (3x)            | 180s (6x)              |
| Worker     | 60s (idle)       | 180s                | 360s                   |
| Batch      | 5min             | 15min               | 30min                  |
| Watchdog   | 30s              | 90s                 | 180s                   |
| Governance | 60s              | 180s                | 360s                   |
| Learning   | 5min             | 15min               | 30min                  |
| Market     | 10min            | 30min               | 60min                  |

**Tipo 2: Heartbeat Stale (Dados Desatualizados)**

Definição: Agent envia heartbeat mas o campo `heartbeat_at` está atrasado em relação ao relógio atual. Indica sincronização de relógio incorreta ou bug no código de timestamp.

Threshold: `now - heartbeat_at > 2 * intervalo_configurado`

**Tipo 3: Agent Travado (Stuck)**

Definição: Agent envia heartbeat com `current_state: processing` mas `task_started_at` indica que a mesma task está em processamento por tempo maior que o timeout configurado.

Threshold: `now - task_started_at > max_task_duration_seconds * 2`

**Tipo 4: Spam sem Entrega (Busy Loop)**

Definição: Agent envia heartbeats com frequência muito maior que o configurado, indicando bug no loop de heartbeat ou loop infinito.

Threshold: Taxa de heartbeats > 3x a frequência configurada por mais de 2 minutos.

**Tipo 5: False Healthy**

Definição: Agent envia heartbeat com `health.status: healthy` mas métricas externas (Prometheus, NATS lag) indicam problema real.

Detecção: Correlação entre heartbeat status e métricas externas:

```
healthy=true AND queue_lag > 100 AND no_processing_for > 10min → False Healthy suspeito
```

**Tipo 6: Escalation Loop**

Definição: Agent envia heartbeats consecutivos com `escalation_needed: true` sem que nenhuma ação tenha sido tomada. Indica que o mecanismo de escalação falhou ou ninguém está respondendo.

Threshold: `escalation_needed: true` por mais de 30 minutos sem resolução registrada.

---

## 6. Alertas Prometheus para Heartbeat

```yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: velya-heartbeat-alerts
  namespace: velya-dev-observability
  labels:
    prometheus: velya
    role: alert-rules
spec:
  groups:
    - name: velya.heartbeat.critical
      interval: 30s
      rules:
        # Agent completamente silencioso — Severity: Critical
        - alert: AgentHeartbeatMissing
          expr: |
            (time() - velya_agent_heartbeat_timestamp) > 180
          for: 0m
          labels:
            severity: critical
            team: watchdog
          annotations:
            summary: 'Agent {{ $labels.agent_name }} silencioso há mais de 3 minutos'
            description: |
              Agent: {{ $labels.agent_name }}
              Office: {{ $labels.office }}
              Último heartbeat: {{ $value | humanizeDuration }} atrás
              Ação: verificar pod no namespace velya-dev-agents, checar logs via Loki
            runbook: 'https://velya-docs/runbooks/agent-heartbeat-missing'

        # Watchdog silencioso — escalada mais agressiva
        - alert: WatchdogHeartbeatMissing
          expr: |
            (time() - velya_agent_heartbeat_timestamp{agent_class="Watchdog"}) > 90
          for: 0m
          labels:
            severity: critical
            page: 'true'
          annotations:
            summary: 'CRÍTICO: Watchdog {{ $labels.agent_name }} silencioso'
            description: 'O sistema de supervisão está inativo. Intervenção humana imediata necessária.'

    - name: velya.heartbeat.warning
      interval: 1m
      rules:
        # Agent com heartbeat atrasado — Severity: Warning
        - alert: AgentHeartbeatStale
          expr: |
            (time() - velya_agent_heartbeat_timestamp) > 90 AND
            (time() - velya_agent_heartbeat_timestamp) <= 180
          for: 2m
          labels:
            severity: warning
            team: watchdog
          annotations:
            summary: 'Agent {{ $labels.agent_name }} com heartbeat atrasado'
            description: 'Heartbeat atrasado em {{ $value | humanizeDuration }}. Monitorar para possível silêncio.'

        # Agent travado em processamento
        - alert: AgentStuckInProcessing
          expr: |
            (velya_agent_task_duration_seconds > 600) AND
            (velya_agent_current_state == "processing")
          for: 5m
          labels:
            severity: warning
            team: watchdog
          annotations:
            summary: 'Agent {{ $labels.agent_name }} travado em processamento há {{ $value | humanizeDuration }}'

        # Alta taxa de retries
        - alert: AgentHighRetryRate
          expr: |
            velya_agent_retry_rate_percent > 25
          for: 10m
          labels:
            severity: warning
          annotations:
            summary: 'Agent {{ $labels.agent_name }} com taxa de retry > 25%'

        # Baixa confiança recorrente
        - alert: AgentLowConfidencePersistent
          expr: |
            velya_agent_confidence_rolling_1h < 0.70
          for: 30m
          labels:
            severity: warning
            team: governance
          annotations:
            summary: 'Agent {{ $labels.agent_name }} com confiança média < 0.70 por 30 minutos'
            description: 'Confidence médio 1h: {{ $value }}. Revisar qualidade de outputs e prompts.'

        # Escalação sem resposta
        - alert: AgentEscalationUnacknowledged
          expr: |
            velya_agent_escalation_needed == 1
          for: 30m
          labels:
            severity: critical
          annotations:
            summary: 'Agent {{ $labels.agent_name }} requer escalação há mais de 30 minutos sem resposta'

        # Budget de LLM quase esgotado
        - alert: AgentLLMBudgetLow
          expr: |
            velya_agent_llm_budget_remaining_usd < 0.50
          for: 0m
          labels:
            severity: warning
            team: finops
          annotations:
            summary: 'Agent {{ $labels.agent_name }} com budget LLM restante: ${{ $value }}'
```

---

## 7. Consumo de Heartbeats pelo Heartbeat Monitor

### 7.1 Configuração do Consumer NATS

```yaml
# Consumer NATS para monitoramento de heartbeats
consumer:
  stream: VELYA_AGENTS
  name: heartbeat-monitor-consumer
  filter_subject: 'velya.agents.heartbeats.>'
  deliver_policy: last_per_subject # Apenas o heartbeat mais recente por agent
  ack_policy: none # Monitor não precisa dar ack
  replay_policy: instant
```

### 7.2 Lógica do Heartbeat Monitor

```python
class HeartbeatMonitor:
    """
    Monitora todos os heartbeats de agents e detecta anomalias.
    Executa como Deployment sempre ativo no namespace velya-dev-agents.
    """

    def __init__(self):
        self.known_agents: dict[str, AgentRegistration] = {}
        self.last_heartbeats: dict[str, dict] = {}
        self.anomalies: list[Anomaly] = []

    async def process_heartbeat(self, subject: str, data: bytes):
        heartbeat = json.loads(data)
        agent_name = heartbeat["agent_name"]

        # Atualizar registro de último heartbeat
        self.last_heartbeats[agent_name] = heartbeat

        # Atualizar gauge Prometheus
        heartbeat_gauge.labels(
            agent_name=agent_name,
            agent_class=heartbeat["agent_class"],
            office=heartbeat["office"]
        ).set(time.time())

        # Verificar anomalias no conteúdo do heartbeat
        await self.check_heartbeat_content(heartbeat)

    async def check_heartbeat_content(self, hb: dict):
        agent = hb["agent_name"]

        # Verificar escalação
        if hb.get("escalation_needed"):
            await self.trigger_escalation(hb)

        # Verificar false healthy
        queue_lag = hb["backlog_view"]["pending_count"]
        if hb["health"]["status"] == "healthy" and queue_lag > 100:
            last_processing = hb.get("last_success", {}).get("completed_at")
            if last_processing:
                age = (datetime.now(timezone.utc) - datetime.fromisoformat(last_processing)).seconds
                if age > 600:  # 10 minutos sem processar com fila cheia
                    await self.flag_false_healthy(hb)

        # Verificar stuck
        if hb.get("current_state") == "processing" and hb.get("task_started_at"):
            task_age = (datetime.now(timezone.utc) -
                       datetime.fromisoformat(hb["task_started_at"])).seconds
            max_duration = self.get_max_task_duration(hb["agent_class"])
            if task_age > max_duration * 2:
                await self.flag_agent_stuck(hb, task_age)

    async def sweep_for_silent_agents(self):
        """Executado a cada 30 segundos para detectar agents silenciosos."""
        now = time.time()
        for agent_name, registration in self.known_agents.items():
            last_hb = self.last_heartbeats.get(agent_name)
            if last_hb is None:
                # Agent nunca enviou heartbeat
                await self.alert_never_heartbeat(agent_name, registration)
                continue

            last_hb_time = datetime.fromisoformat(last_hb["heartbeat_at"]).timestamp()
            silence_seconds = now - last_hb_time
            threshold = self.get_silence_threshold(registration.agent_class)

            if silence_seconds > threshold * 3:  # Incidente
                await self.trigger_agent_silent_incident(agent_name, silence_seconds)
            elif silence_seconds > threshold:    # Alerta
                await self.alert_agent_stale(agent_name, silence_seconds)
```

---

## 8. Integração com Dashboard Grafana

### 8.1 Painel: Heartbeat Map

O dashboard Grafana em `http://localhost:3000/d/velya-heartbeat` exibe:

- **Grid de agents:** Cada célula representa um agent. Cor indica estado:
  - Verde: heartbeat recente (< 1x intervalo)
  - Amarelo: heartbeat atrasado (1-2x intervalo)
  - Vermelho: heartbeat ausente (> 3x intervalo)
  - Cinza: agent parado intencionalmente (modo maintenance)

- **Timeline de heartbeats:** Série temporal de frequência de heartbeats por agent

- **Tabela de anomalias recentes:** Últimas 20 anomalias detectadas com timestamp e tipo

### 8.2 Queries Grafana para Heartbeat

```promql
# Tempo desde último heartbeat por agent (em segundos)
time() - velya_agent_heartbeat_timestamp

# Agents silenciosos (sem heartbeat por mais de 3x o intervalo)
(time() - velya_agent_heartbeat_timestamp) > 180

# Heartbeat freshness map (1 = fresh, 0 = stale)
(time() - velya_agent_heartbeat_timestamp) < 60

# Taxa de heartbeats por agent (por minuto)
rate(velya_agent_heartbeat_sequence[5m]) * 60
```
