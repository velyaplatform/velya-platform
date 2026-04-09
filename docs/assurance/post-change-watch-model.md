# Modelo de Observacao Pos-Mudanca - Velya Platform

> Documento 16 da serie Layered Assurance + Self-Healing  
> Ultima atualizacao: 2026-04-08

---

## 1. Principio

Toda mudanca na Velya Platform requer observacao estruturada. Nenhuma mudanca e considerada completa ate que o periodo de observacao tenha encerrado sem incidentes.

### Tipos de Observacao

| Tipo | Descricao | Quem |
|---|---|---|
| **Ativa** | Engenheiro monitorando dashboards em tempo real | Humano (quem fez o deploy) |
| **Passiva** | Alertas automaticos monitoram e notificam se necessario | Sistema (Prometheus + agente) |
| **Automatizada** | CronJob/watchdog coleta snapshot de metricas pos-mudanca | Watchdog Job |

---

## 2. Janelas de Observacao por Tipo de Mudanca

### 2.1 Application Deploy

| Fase | Duracao | Metricas Monitoradas | Threshold para Alerta | Threshold para Rollback |
|---|---|---|---|---|
| Ativa | 30 min | error rate, p99 latency, CPU, memory, restarts | error_rate > 0.5%, p99 > 1.5s | error_rate > 1%, p99 > 3s, restarts > 2 |
| Passiva | 4 h | error rate, p99 latency, business metrics | error_rate > 0.3%, p99 > 1.2s | error_rate > 1%, degradacao business > 10% |

**Metricas detalhadas:**

```yaml
applicationDeployWatch:
  activeWindow:
    duration: 30m
    metrics:
      - name: error_rate
        query: |
          sum(rate(http_requests_total{status=~"5..",app="{{ .service }}"}[2m]))
          / sum(rate(http_requests_total{app="{{ .service }}"}[2m]))
        alertThreshold: 0.005    # 0.5%
        rollbackThreshold: 0.01  # 1%
        escalationThreshold: 0.02  # 2%
      - name: p99_latency
        query: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{app="{{ .service }}"}[2m])) by (le))
        alertThreshold: 1.5    # 1.5 segundos
        rollbackThreshold: 3.0 # 3 segundos
        escalationThreshold: 5.0
      - name: cpu_usage
        query: |
          sum(rate(container_cpu_usage_seconds_total{
            pod=~"{{ .service }}.*",container!="istio-proxy"}[2m]))
          / sum(kube_pod_container_resource_limits{
            resource="cpu",pod=~"{{ .service }}.*"})
        alertThreshold: 0.80
        rollbackThreshold: 0.95
      - name: memory_usage
        query: |
          sum(container_memory_working_set_bytes{
            pod=~"{{ .service }}.*",container!="istio-proxy"})
          / sum(kube_pod_container_resource_limits{
            resource="memory",pod=~"{{ .service }}.*"})
        alertThreshold: 0.80
        rollbackThreshold: 0.90
      - name: pod_restarts
        query: |
          increase(kube_pod_container_status_restarts_total{
            pod=~"{{ .service }}.*"}[5m])
        alertThreshold: 1
        rollbackThreshold: 2
      - name: nats_consumer_lag
        query: |
          max(nats_jetstream_consumer_num_pending{
            stream=~".*{{ .service }}.*"})
        alertThreshold: 500
        rollbackThreshold: 5000
  passiveWindow:
    duration: 4h
    metrics:
      - name: error_rate
        query: "mesmo que acima"
        alertThreshold: 0.003    # 0.3%
        rollbackThreshold: 0.01
      - name: business_metric_degradation
        query: |
          (
            avg_over_time(velya_appointments_created_total[1h])
            / avg_over_time(velya_appointments_created_total[1h] offset 1d)
          )
        alertThreshold: 0.95  # degradacao > 5%
        rollbackThreshold: 0.90
      - name: temporal_workflow_success_rate
        query: |
          sum(rate(temporal_workflow_completed_total{namespace="velya"}[30m]))
          / sum(rate(temporal_workflow_started_total{namespace="velya"}[30m]))
        alertThreshold: 0.98
        rollbackThreshold: 0.95
```

---

### 2.2 Infrastructure Change

| Fase | Duracao | Metricas Monitoradas | Threshold para Alerta | Threshold para Rollback |
|---|---|---|---|---|
| Ativa | 1 h | node health, pod scheduling, network, storage | node NotReady, pods Pending > 2min | node NotReady > 5min, pods Pending > 10min |
| Passiva | 24 h | cluster health, resource utilization, cost | anomalias estatisticas | degradacao persistente > 1h |

```yaml
infraChangeWatch:
  activeWindow:
    duration: 1h
    metrics:
      - name: node_health
        query: |
          kube_node_status_condition{condition="Ready",status="true"} == 0
        alertThreshold: "qualquer node NotReady"
        rollbackThreshold: "> 1 node NotReady por > 5min"
      - name: pods_pending
        query: |
          count(kube_pod_status_phase{phase="Pending",namespace="velya"})
        alertThreshold: "> 0 por > 2min"
        rollbackThreshold: "> 0 por > 10min"
      - name: network_latency
        query: |
          histogram_quantile(0.99,
            sum(rate(coredns_dns_request_duration_seconds_bucket[2m])) by (le))
        alertThreshold: 0.1   # 100ms
        rollbackThreshold: 0.5
      - name: storage_iops
        query: |
          sum(rate(node_disk_io_time_seconds_total[5m])) by (instance)
        alertThreshold: 0.90  # 90% busy
        rollbackThreshold: 0.98
      - name: keda_scaler_health
        query: |
          keda_scaler_errors_total
        alertThreshold: "increase > 0 em 5min"
      - name: argocd_sync_status
        query: |
          argocd_app_info{sync_status!="Synced"} > 0
        alertThreshold: "qualquer app OutOfSync"
      - name: external_secrets_sync
        query: |
          externalsecret_status_condition{condition="SecretSynced",status="False"} > 0
        alertThreshold: "qualquer ExternalSecret nao synced"
  passiveWindow:
    duration: 24h
    metrics:
      - name: cluster_resource_utilization
        query: |
          avg(
            sum(kube_pod_container_resource_requests{resource="cpu"}) by (node)
            / sum(kube_node_status_allocatable{resource="cpu"}) by (node)
          )
        alertThreshold: 0.85
      - name: nats_cluster_health
        query: |
          nats_jetstream_meta_cluster_size < 3
        alertThreshold: "cluster size < 3"
```

---

### 2.3 Agent Promotion

| Fase | Duracao | Metricas Monitoradas | Threshold para Alerta | Threshold para Rollback |
|---|---|---|---|---|
| Ativa | 2 h | acuracia de decisoes, taxa de acoes, falsos positivos | acuracia < 97%, acoes > 2x baseline | acuracia < 95%, acao destrutiva nao autorizada |
| Passiva | 7 d | tendencia de acuracia, taxa de escalacao, feedback humano | acuracia < 95% em 24h, escalacao > baseline + 20% | acuracia < 90% em 48h |

```yaml
agentPromotionWatch:
  activeWindow:
    duration: 2h
    metrics:
      - name: decision_accuracy
        query: |
          1 - (
            sum(increase(velya_agent_decision_reverted_total[30m]))
            / sum(increase(velya_agent_decision_total[30m]))
          )
        alertThreshold: 0.97
        rollbackThreshold: 0.95
        escalationCriteria: "qualquer acao destrutiva nao autorizada -> rollback imediato"
      - name: action_rate
        query: |
          rate(velya_agent_actions_total[5m])
          / avg_over_time(rate(velya_agent_actions_total[5m])[7d:5m])
        alertThreshold: 2.0  # 2x baseline
        rollbackThreshold: 5.0
      - name: false_positive_rate
        query: |
          sum(increase(velya_agent_false_positive_total[1h]))
          / sum(increase(velya_agent_decision_total[1h]))
        alertThreshold: 0.03   # 3%
        rollbackThreshold: 0.05
      - name: unauthorized_actions
        query: |
          increase(velya_agent_unauthorized_action_total[5m])
        alertThreshold: 1  # qualquer acao nao autorizada
        rollbackThreshold: 1
  passiveWindow:
    duration: 7d
    checkInterval: 6h
    metrics:
      - name: accuracy_trend
        query: |
          avg_over_time(velya_agent_decision_accuracy[24h])
        alertThreshold: 0.95
        rollbackThreshold: 0.90
      - name: escalation_rate
        query: |
          sum(increase(velya_agent_escalation_total[24h]))
          / sum(increase(velya_agent_decision_total[24h]))
        alertThreshold: "baseline + 20%"
      - name: human_feedback_negative
        query: |
          sum(increase(velya_agent_human_feedback{sentiment="negative"}[24h]))
        alertThreshold: "> 3 feedbacks negativos em 24h"
```

---

### 2.4 Database Change (Migration/Schema/Config)

| Fase | Duracao | Metricas Monitoradas | Threshold para Alerta | Threshold para Rollback |
|---|---|---|---|---|
| Ativa | 1 h | query performance, connections, replication lag, errors | p99 query > 2x baseline, connections > 80% | p99 query > 5x baseline, replication lag > 30s |
| Passiva | 48 h | query trends, slow query count, storage growth | slow queries > baseline + 50% | persistent degradation > 4h |

```yaml
databaseChangeWatch:
  activeWindow:
    duration: 1h
    metrics:
      - name: query_p99_latency
        query: |
          histogram_quantile(0.99,
            sum(rate(pg_stat_statements_mean_exec_time_bucket[5m])) by (le))
        alertThreshold: "2x baseline (avg ultimos 7 dias)"
        rollbackThreshold: "5x baseline"
      - name: connection_pool_usage
        query: |
          pg_stat_activity_count{datname="velya_production"}
          / pg_settings_max_connections
        alertThreshold: 0.80
        rollbackThreshold: 0.95
      - name: replication_lag
        query: |
          pg_stat_replication_lag_seconds
        alertThreshold: 5   # 5 segundos
        rollbackThreshold: 30
      - name: deadlocks
        query: |
          increase(pg_stat_database_deadlocks{datname="velya_production"}[5m])
        alertThreshold: 1
        rollbackThreshold: 3
      - name: query_errors
        query: |
          increase(pg_stat_database_xact_rollback{datname="velya_production"}[5m])
        alertThreshold: "2x baseline"
        rollbackThreshold: "5x baseline"
  passiveWindow:
    duration: 48h
    checkInterval: 1h
    metrics:
      - name: slow_queries
        query: |
          pg_stat_statements_mean_exec_time{datname="velya_production"} > 1
        alertThreshold: "count > baseline + 50%"
      - name: table_bloat
        query: |
          pg_stat_user_tables_n_dead_tup{datname="velya_production"}
          / pg_stat_user_tables_n_live_tup{datname="velya_production"}
        alertThreshold: 0.20  # 20% dead tuples
      - name: storage_growth
        query: |
          deriv(pg_database_size_bytes{datname="velya_production"}[6h])
        alertThreshold: "crescimento > 2x taxa normal"
```

---

### 2.5 Workflow Update (Temporal)

| Fase | Duracao | Metricas Monitoradas | Threshold para Alerta | Threshold para Rollback |
|---|---|---|---|---|
| Ativa | 1 h | workflow completion rate, duration, failures, DLQ | completion rate < 98%, failures > 0 | completion rate < 95%, DLQ growing |
| Passiva | 24 h | workflow trends, compensation rate, stuck workflows | stuck > 0, compensation > baseline | persistent failures > 2h |

```yaml
workflowUpdateWatch:
  activeWindow:
    duration: 1h
    metrics:
      - name: workflow_completion_rate
        query: |
          sum(rate(temporal_workflow_completed_total{
            namespace="velya",workflow_type="{{ .workflowType }}"}[10m]))
          / sum(rate(temporal_workflow_started_total{
            namespace="velya",workflow_type="{{ .workflowType }}"}[10m]))
        alertThreshold: 0.98
        rollbackThreshold: 0.95
      - name: workflow_duration
        query: |
          histogram_quantile(0.99,
            sum(rate(temporal_workflow_execution_duration_seconds_bucket{
              workflow_type="{{ .workflowType }}"}[10m])) by (le))
        alertThreshold: "2x baseline"
        rollbackThreshold: "5x baseline"
      - name: activity_failures
        query: |
          increase(temporal_activity_execution_failed_total{
            namespace="velya",workflow_type="{{ .workflowType }}"}[10m])
        alertThreshold: 1
        rollbackThreshold: 5
      - name: dlq_messages
        query: |
          nats_jetstream_consumer_num_pending{
            stream=~".*dlq.*{{ .workflowType }}.*"}
        alertThreshold: 1
        rollbackThreshold: 10
  passiveWindow:
    duration: 24h
    metrics:
      - name: stuck_workflows
        query: |
          temporal_workflow_execution_duration_seconds{
            workflow_type="{{ .workflowType }}",
            status="Running"} > 3600
        alertThreshold: 1
      - name: compensation_rate
        query: |
          sum(rate(temporal_workflow_compensation_total{
            workflow_type="{{ .workflowType }}"}[1h]))
          / sum(rate(temporal_workflow_started_total{
            workflow_type="{{ .workflowType }}"}[1h]))
        alertThreshold: 0.05  # 5% de compensacao
```

---

### 2.6 Configuration Change

| Fase | Duracao | Metricas Monitoradas | Threshold para Alerta | Threshold para Rollback |
|---|---|---|---|---|
| Ativa | 15 min | pod health, config parse errors, connection health | restart > 0, config error > 0 | CrashLoopBackOff, connection failures |
| Passiva | 2 h | error rate, service behavior | anomalia vs baseline | degradacao persistente |

```yaml
configChangeWatch:
  activeWindow:
    duration: 15m
    metrics:
      - name: pod_restarts
        query: |
          increase(kube_pod_container_status_restarts_total{
            pod=~"{{ .service }}.*"}[2m])
        alertThreshold: 1
        rollbackThreshold: 2
      - name: config_parse_errors
        query: |
          increase(velya_config_parse_errors_total{app="{{ .service }}"}[2m])
        alertThreshold: 1
        rollbackThreshold: 1
      - name: crashloop
        query: |
          kube_pod_container_status_waiting_reason{
            reason="CrashLoopBackOff",pod=~"{{ .service }}.*"}
        alertThreshold: 1
        rollbackThreshold: 1
      - name: connection_health
        query: |
          up{job="{{ .service }}"} == 0
        alertThreshold: "qualquer instancia down"
        rollbackThreshold: "> 50% instancias down"
  passiveWindow:
    duration: 2h
    metrics:
      - name: error_rate_vs_baseline
        query: |
          sum(rate(http_requests_total{status=~"5..",app="{{ .service }}"}[5m]))
          / sum(rate(http_requests_total{app="{{ .service }}"}[5m]))
          / avg_over_time(
            sum(rate(http_requests_total{status=~"5..",app="{{ .service }}"}[5m]))
            / sum(rate(http_requests_total{app="{{ .service }}"}[5m]))
          [24h:5m])
        alertThreshold: 2.0  # 2x baseline
```

---

## 3. Criterios de Escalacao Humana

### Arvore de Decisao

```
Mudanca aplicada
    |
    v
[Observacao Ativa inicia]
    |
    +-- Metrica atinge alertThreshold?
    |       |
    |       +-- SIM --> Notificar engenheiro de plantao
    |       |            |
    |       |            +-- Resolve em 10 min? --> Continuar observacao
    |       |            |
    |       |            +-- NAO --> Metrica atinge rollbackThreshold?
    |       |                        |
    |       |                        +-- SIM --> ROLLBACK AUTOMATICO
    |       |                        |           + Notificar equipe
    |       |                        |           + Criar incidente
    |       |                        |
    |       |                        +-- NAO --> Metrica atinge escalationThreshold?
    |       |                                    |
    |       |                                    +-- SIM --> ESCALAR para tech lead
    |       |                                    |           + Pausar observacao passiva
    |       |                                    |           + Avaliar rollback manual
    |       |                                    |
    |       |                                    +-- NAO --> Continuar monitorando
    |       |
    |       +-- NAO --> Continuar observacao
    |
    v
[Observacao Ativa encerra]
    |
    v
[Observacao Passiva inicia]
    |
    +-- Alertas disparados?
    |       |
    |       +-- SIM --> Mesmo fluxo acima
    |       +-- NAO --> Continuar ate fim da janela
    |
    v
[Observacao Passiva encerra]
    |
    v
[MUDANCA CONSIDERADA ESTAVEL]
    |
    +-- Gerar relatorio de observacao
    +-- Arquivar snapshot de metricas
    +-- Atualizar scorecard de delivery
```

### Criterios de Escalacao por Severidade

| Condicao | Acao | Prazo |
|---|---|---|
| Metrica > alertThreshold por > 5 min | Notificar engenheiro via Slack | Imediato |
| Metrica > rollbackThreshold | Rollback automatico + notificar equipe | Automatico |
| Rollback automatico falha | Escalar para tech lead + SRE | < 5 min |
| 2+ servicos afetados simultaneamente | Escalar para incident commander | < 10 min |
| Dados potencialmente corrompidos | Escalar para CTO + DBA | < 15 min |
| Impacto em atendimento de pacientes | Escalar para lideranca clinica | < 15 min |

---

## 4. Watchdog Automatizado Pos-Mudanca

### CronJob de Watchdog

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: post-change-watchdog
  namespace: velya-ops
spec:
  schedule: "*/5 * * * *"  # a cada 5 minutos
  concurrencyPolicy: Forbid
  successfulJobsHistoryLimit: 12
  failedJobsHistoryLimit: 3
  jobTemplate:
    spec:
      activeDeadlineSeconds: 240
      template:
        spec:
          serviceAccountName: watchdog-sa
          containers:
            - name: watchdog
              image: velya/post-change-watchdog:latest
              env:
                - name: PROMETHEUS_URL
                  value: "http://prometheus.monitoring:9090"
                - name: ARGOCD_URL
                  value: "https://argocd.velya.internal"
                - name: ARGOCD_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: argocd-watchdog-token
                      key: token
                - name: SLACK_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: slack-webhooks
                      key: watchdog-channel
                - name: GRAFANA_URL
                  value: "http://grafana.monitoring:3000"
              command:
                - python3
                - /scripts/post_change_watchdog.py
              volumeMounts:
                - name: watch-config
                  mountPath: /config
          volumes:
            - name: watch-config
              configMap:
                name: watchdog-config
          restartPolicy: OnFailure
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: watchdog-config
  namespace: velya-ops
data:
  config.yaml: |
    # Configuracao do watchdog pos-mudanca
    detection:
      # Detectar mudancas recentes via ArgoCD e kube events
      sources:
        - type: argocd
          query: "applications com sync recente (< janela de observacao)"
        - type: kube-events
          query: "events de tipo Normal com reason=ScalingReplicaSet nos ultimos 30min"
        - type: rollout-events
          query: "rollout com status Progressing"
    
    watchWindows:
      application-deploy:
        active: 30m
        passive: 4h
      infrastructure-change:
        active: 1h
        passive: 24h
      agent-promotion:
        active: 2h
        passive: 168h  # 7 dias
      database-change:
        active: 1h
        passive: 48h
      config-change:
        active: 15m
        passive: 2h
      workflow-update:
        active: 1h
        passive: 24h
    
    checks:
      - name: error-rate-spike
        query: |
          sum(rate(http_requests_total{status=~"5..",namespace="velya"}[5m])) by (app)
          / sum(rate(http_requests_total{namespace="velya"}[5m])) by (app)
          > 0.01
        severity: warning
        action: notify
      
      - name: latency-degradation
        query: |
          histogram_quantile(0.99,
            sum(rate(http_request_duration_seconds_bucket{namespace="velya"}[5m])) by (le, app))
          > 2.0
        severity: warning
        action: notify
      
      - name: pod-crashloop
        query: |
          kube_pod_container_status_waiting_reason{
            reason="CrashLoopBackOff",namespace="velya"} > 0
        severity: critical
        action: rollback
      
      - name: memory-leak
        query: |
          deriv(container_memory_working_set_bytes{
            namespace="velya",container!=""}[30m]) > 1e6
        severity: warning
        action: notify
      
      - name: nats-lag-growing
        query: |
          deriv(nats_jetstream_consumer_num_pending[10m]) > 100
        severity: warning
        action: notify
      
      - name: temporal-workflow-stuck
        query: |
          temporal_workflow_execution_duration_seconds{
            namespace="velya",status="Running"} > 600
        severity: warning
        action: notify
      
      - name: argocd-drift
        query: |
          argocd_app_info{sync_status!="Synced",namespace="velya"} > 0
        severity: warning
        action: notify
    
    notifications:
      slack:
        channel: "#velya-watchdog"
        template: |
          :warning: *Post-Change Watchdog Alert*
          *Service:* {{ .service }}
          *Change Type:* {{ .changeType }}
          *Changed At:* {{ .changedAt }}
          *Watch Window:* {{ .windowPhase }} ({{ .timeRemaining }} remaining)
          *Check Failed:* {{ .checkName }}
          *Current Value:* {{ .currentValue }}
          *Threshold:* {{ .threshold }}
          *Action:* {{ .action }}
          *Dashboard:* {{ .dashboardUrl }}
```

### Script do Watchdog

```python
#!/usr/bin/env python3
"""
post_change_watchdog.py - Monitora metricas apos mudancas recentes na Velya Platform.
Detecta mudancas via ArgoCD sync events e kube events, aplica janelas de observacao
configuradas e executa checks de saude.
"""

import yaml
import requests
import json
from datetime import datetime, timedelta
from typing import List, Dict, Optional

class PostChangeWatchdog:
    def __init__(self, config_path: str = "/config/config.yaml"):
        with open(config_path) as f:
            self.config = yaml.safe_load(f)
        self.prometheus_url = os.environ["PROMETHEUS_URL"]
        self.argocd_url = os.environ["ARGOCD_URL"]
        self.argocd_token = os.environ["ARGOCD_TOKEN"]
        self.slack_webhook = os.environ.get("SLACK_WEBHOOK")

    def detect_recent_changes(self) -> List[Dict]:
        """Detecta mudancas recentes via ArgoCD e kube events."""
        changes = []

        # Buscar syncs recentes do ArgoCD
        headers = {"Authorization": f"Bearer {self.argocd_token}"}
        resp = requests.get(
            f"{self.argocd_url}/api/v1/applications",
            headers=headers
        )
        for app in resp.json().get("items", []):
            status = app.get("status", {})
            sync = status.get("operationState", {})
            if sync.get("phase") == "Succeeded":
                finished_at = sync.get("finishedAt")
                if finished_at:
                    change_time = datetime.fromisoformat(
                        finished_at.replace("Z", "+00:00")
                    )
                    change_type = self._classify_change(app["metadata"]["name"])
                    window = self.config["watchWindows"].get(change_type, {})
                    active_duration = self._parse_duration(
                        window.get("active", "30m")
                    )
                    passive_duration = self._parse_duration(
                        window.get("passive", "4h")
                    )
                    total_window = active_duration + passive_duration
                    if datetime.now(change_time.tzinfo) - change_time < total_window:
                        changes.append({
                            "service": app["metadata"]["name"],
                            "changeType": change_type,
                            "changedAt": finished_at,
                            "activeEnd": change_time + active_duration,
                            "passiveEnd": change_time + passive_duration,
                        })
        return changes

    def run_checks(self, changes: List[Dict]):
        """Executa checks de saude para mudancas dentro da janela."""
        for change in changes:
            now = datetime.now()
            if now < change["activeEnd"]:
                phase = "active"
            else:
                phase = "passive"

            for check in self.config["checks"]:
                result = self._query_prometheus(check["query"])
                if result:
                    self._handle_alert(change, check, result, phase)

    def _query_prometheus(self, query: str) -> Optional[List]:
        """Executa query no Prometheus e retorna resultados."""
        resp = requests.get(
            f"{self.prometheus_url}/api/v1/query",
            params={"query": query}
        )
        data = resp.json()
        if data["status"] == "success":
            results = data["data"]["result"]
            if results:
                return results
        return None

    def _handle_alert(self, change, check, result, phase):
        """Processa alerta e executa acao configurada."""
        action = check["action"]
        if action == "notify":
            self._send_notification(change, check, result, phase)
        elif action == "rollback":
            self._send_notification(change, check, result, phase)
            self._trigger_rollback(change["service"])

    def _classify_change(self, app_name: str) -> str:
        """Classifica o tipo de mudanca baseado no nome da aplicacao."""
        if "infra" in app_name or "cluster" in app_name:
            return "infrastructure-change"
        elif "agent" in app_name:
            return "agent-promotion"
        elif "db" in app_name or "migration" in app_name:
            return "database-change"
        elif "config" in app_name:
            return "config-change"
        elif "workflow" in app_name:
            return "workflow-update"
        return "application-deploy"

    def _parse_duration(self, duration_str: str) -> timedelta:
        """Converte string de duracao (30m, 4h, 7d) para timedelta."""
        unit = duration_str[-1]
        value = int(duration_str[:-1])
        if unit == "m":
            return timedelta(minutes=value)
        elif unit == "h":
            return timedelta(hours=value)
        elif unit == "d":
            return timedelta(days=value)
        return timedelta(minutes=value)

    def _send_notification(self, change, check, result, phase):
        """Envia notificacao via Slack."""
        if self.slack_webhook:
            requests.post(self.slack_webhook, json={
                "text": (
                    f"Post-Change Watchdog Alert\n"
                    f"Service: {change['service']}\n"
                    f"Change Type: {change['changeType']}\n"
                    f"Phase: {phase}\n"
                    f"Check: {check['name']}\n"
                    f"Severity: {check['severity']}"
                )
            })

    def _trigger_rollback(self, service: str):
        """Dispara rollback via ArgoCD."""
        headers = {"Authorization": f"Bearer {self.argocd_token}"}
        requests.post(
            f"{self.argocd_url}/api/v1/applications/{service}/rollback",
            headers=headers,
            json={"id": 0}  # rollback para revisao anterior
        )


if __name__ == "__main__":
    import os
    watchdog = PostChangeWatchdog()
    changes = watchdog.detect_recent_changes()
    if changes:
        print(f"Detectadas {len(changes)} mudancas recentes dentro da janela de observacao")
        watchdog.run_checks(changes)
    else:
        print("Nenhuma mudanca recente dentro da janela de observacao")
```

---

## 5. RBAC do Watchdog

```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: watchdog-sa
  namespace: velya-ops
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: watchdog-role
rules:
  - apiGroups: [""]
    resources: ["pods", "events", "nodes"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets"]
    verbs: ["get", "list"]
  - apiGroups: ["argoproj.io"]
    resources: ["rollouts", "analysisruns"]
    verbs: ["get", "list"]
  - apiGroups: ["keda.sh"]
    resources: ["scaledobjects"]
    verbs: ["get", "list"]
  - apiGroups: ["external-secrets.io"]
    resources: ["externalsecrets"]
    verbs: ["get", "list"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: watchdog-binding
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: watchdog-role
subjects:
  - kind: ServiceAccount
    name: watchdog-sa
    namespace: velya-ops
```

---

## 6. Dashboard de Observacao Pos-Mudanca

### Painel Grafana: Variaveis

```json
{
  "templating": {
    "list": [
      {
        "name": "service",
        "type": "query",
        "query": "label_values(http_requests_total{namespace='velya'}, app)",
        "refresh": 2
      },
      {
        "name": "change_type",
        "type": "custom",
        "options": [
          "application-deploy",
          "infrastructure-change",
          "agent-promotion",
          "database-change",
          "config-change",
          "workflow-update"
        ]
      }
    ]
  }
}
```

### Paineis Principais

| Painel | Query | Proposito |
|---|---|---|
| Error Rate (antes vs depois) | `rate(http_requests_total{status=~"5..",app="$service"}[5m])` com offset de 1h | Comparar error rate antes e depois da mudanca |
| Latency P99 (antes vs depois) | `histogram_quantile(0.99, ...)` com offset | Comparar latencia |
| Pod Restarts | `increase(kube_pod_container_status_restarts_total{pod=~"$service.*"}[5m])` | Detectar instabilidade |
| Memory Trend | `container_memory_working_set_bytes{pod=~"$service.*"}` | Detectar memory leak |
| NATS Consumer Lag | `nats_jetstream_consumer_num_pending{stream=~".*$service.*"}` | Detectar acumulo de fila |
| Watchdog Alerts | Annotations de alertas do watchdog | Timeline de alertas |

---

## 7. Relatorio de Observacao

### Template de Relatorio Pos-Mudanca

```yaml
postChangeReport:
  metadata:
    service: ""
    changeType: ""
    changedAt: ""
    changedBy: ""
    commitSha: ""
    imageTag: ""
    ticketRef: ""

  observationSummary:
    activeWindow:
      startTime: ""
      endTime: ""
      alertsTriggered: 0
      rollbacksTriggered: 0
      manualInterventions: 0
    passiveWindow:
      startTime: ""
      endTime: ""
      alertsTriggered: 0
      rollbacksTriggered: 0
      manualInterventions: 0

  metricsSnapshot:
    errorRate:
      before: ""
      during: ""
      after: ""
    p99Latency:
      before: ""
      during: ""
      after: ""
    availability:
      before: ""
      during: ""
      after: ""

  conclusion: "estavel|instavel|rollback-necessario"
  followUpActions: []
  grafanaSnapshotUrl: ""
  approvedBy: ""
  approvedAt: ""
```

---

## 8. Integracao com Fluxo de Entrega

```
PR Merged
    |
    v
[CI Pipeline] --> Build + Test + Scan
    |
    v
[ArgoCD Sync] --> Detecta nova versao
    |
    v
[Argo Rollout] --> Canary com AnalysisTemplate
    |                   |
    |                   +-- AnalysisRun monitora gates
    |                   |
    |                   +-- Watchdog CronJob detecta mudanca recente
    |
    v
[Promocao 100%]
    |
    v
[Watchdog: Observacao Ativa]  <-- engenheiro monitora dashboard
    |
    v
[Watchdog: Observacao Passiva] <-- alertas automaticos
    |
    v
[Relatorio gerado]
    |
    v
[MUDANCA COMPLETA]
```
