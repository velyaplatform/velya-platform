# Modelo de Prevencao de Recorrencia - Velya Platform

> Documento 18 da serie Layered Assurance + Self-Healing  
> Ultima atualizacao: 2026-04-08

---

## 1. Principio

Um erro que se repete e uma falha no sistema de aprendizado. A Velya Platform trata recorrencia como um indicador de que as camadas de defesa sao insuficientes e precisam ser reforçadas.

### Definicao de Recorrencia

| Tipo | Criterio | Exemplo |
|---|---|---|
| **Recorrencia exata** | Mesmo erro (mesma root cause, mesmo servico) em < 90 dias | OOM kill no patient-service por memory leak no mesmo endpoint |
| **Recorrencia similar** | Mesma classe de erro (mesma root cause, servico diferente) em < 90 dias | OOM kill em qualquer servico por memory leak |
| **Recorrencia de padrao** | Mesmo padrao de falha (causa raiz similar) em < 180 dias | Qualquer leak de recursos (memory, connections, goroutines) |

---

## 2. Pipeline de Prevencao de Recorrencia

```
Erro detectado
    |
    v
[1. Detectar Padrao] -------> E recorrencia? Quantas vezes? Qual padrao?
    |
    v
[2. Classificar Root Cause] -> Causa raiz ja conhecida? Nova variante?
    |
    v
[3. Avaliar Opcoes] ---------> Teste? Policy? Alerta? Arquitetura?
    |
    v
[4. Implementar Teste] ------> Teste que teria detectado antes do deploy
    |
    v
[5. Implementar Policy] -----> Gate que teria bloqueado o deploy
    |
    v
[6. Implementar Alerta] -----> Alerta que detecta mais cedo
    |
    v
[7. Implementar Doc] --------> Runbook, catalogo, checklist
    |
    v
[8. Validar Prevencao] ------> Teste do cenario em staging
    |
    v
[9. Monitorar Eficacia] -----> Recurrence score, metricas
    |
    v
[PREVENCAO VALIDADA]
```

---

## 3. Deteccao de Recorrencia

### 3.1 Queries de Deteccao

#### Recorrencia por Error Signature (PromQL)

```promql
# Erros com a mesma assinatura nas ultimas 4 semanas
# (assinatura = combinacao de servico + tipo de erro + componente)
sum by (app, error_type, component) (
  increase(velya_error_total[7d])
) > 1
AND
sum by (app, error_type, component) (
  increase(velya_error_total[7d] offset 7d)
) > 0
AND
sum by (app, error_type, component) (
  increase(velya_error_total[7d] offset 14d)
) > 0
```

#### Recorrencia de Incidentes (PromQL)

```promql
# Incidentes do mesmo tipo em 90 dias
sum by (category, subcategory) (
  increase(velya_incident_total[90d])
) > 1
```

#### Padroes Recorrentes em Logs (LogQL)

```logql
# Mesmo stack trace recorrente (ultimos 30 dias)
{namespace="velya"} |= "panic" OR |= "fatal" OR |= "CRITICAL"
  | pattern `<_> <error_signature> <_>`
  | count_over_time({namespace="velya"} |= "panic" [30d]) by (error_signature)
  > 3
```

```logql
# OOMKill recorrente
{job="kubelet"} |= "OOMKilled"
  | json
  | container_name=~"patient-.*|scheduling-.*|billing-.*"
  | count_over_time([30d]) by (container_name)
  > 2
```

```logql
# Connection timeout recorrente para mesma dependencia
{namespace="velya"} |= "connection timeout" OR |= "dial tcp"
  | pattern `<_> <target_host>:<target_port> <_>`
  | count_over_time([7d]) by (app, target_host)
  > 5
```

#### Recorrencia de Rollbacks

```promql
# Servicos com rollback recorrente (> 2 em 30 dias)
sum by (application) (
  increase(argocd_app_rollback_total[30d])
) > 2
```

#### Recorrencia de Alertas

```promql
# Alertas que disparam repetidamente (> 5 vezes em 7 dias)
sum by (alertname, app) (
  increase(ALERTS_FOR_STATE[7d])
) > 5
```

---

### 3.2 Classificacao de Root Cause

```yaml
rootCauseClassification:
  categories:
    code:
      - id: RC-CODE-001
        label: "Memory Leak"
        pattern: "OOMKill recorrente + crescimento linear de memoria"
        preventionLayers:
          - "Teste de carga com duracao >= 30min (detecta leaks)"
          - "Alerta de deriv(memory) > threshold"
          - "Resource limits com margem adequada"
          - "Go pprof/heap profiling em staging"
      - id: RC-CODE-002
        label: "Connection Leak"
        pattern: "Connection pool esgotado + connections nao retornadas"
        preventionLayers:
          - "Connection pool monitoring com alerta em 70%"
          - "Timeout em todas as connections"
          - "Teste de integracao com connection lifecycle"
          - "Linter para defer conn.Close()"
      - id: RC-CODE-003
        label: "Goroutine Leak"
        pattern: "Goroutine count crescente sem plateau"
        preventionLayers:
          - "Alerta de runtime_goroutines > threshold"
          - "Context cancelation em todos os goroutines"
          - "goleak test em CI"
      - id: RC-CODE-004
        label: "Race Condition"
        pattern: "Erros intermitentes sob carga, data corruption"
        preventionLayers:
          - "go test -race em CI"
          - "Stress test concorrente"
          - "Mutex/channel review em PR"
      - id: RC-CODE-005
        label: "Nil Pointer / Panic"
        pattern: "Pod restart com panic no log"
        preventionLayers:
          - "Recover middleware em todos os handlers"
          - "nilaway linter em CI"
          - "Teste de input invalido"

    config:
      - id: RC-CFG-001
        label: "Configuracao Incorreta"
        pattern: "CrashLoopBackOff apos config change"
        preventionLayers:
          - "JSON Schema validation no CI"
          - "Config dry-run antes de apply"
          - "Config diff review obrigatorio"
      - id: RC-CFG-002
        label: "Secret Expirado"
        pattern: "Auth failures apos periodo sem rotacao"
        preventionLayers:
          - "Alerta de expiracao de secret 7d antes"
          - "External Secrets com rotacao automatica"
          - "Teste de rotacao trimestral"

    infra:
      - id: RC-INFRA-001
        label: "Capacidade Insuficiente"
        pattern: "Pods Pending + node full + autoscaler lento"
        preventionLayers:
          - "Headroom de 20% no cluster"
          - "Alerta de utilizacao > 70%"
          - "Capacity planning mensal"
      - id: RC-INFRA-002
        label: "Scaling Incorreto"
        pattern: "KEDA/HPA com thresholds que causam flapping ou under-scaling"
        preventionLayers:
          - "Load test com KEDA ativo"
          - "StabilizationWindow configurado"
          - "Alerta de replica count anomalo"

    dependency:
      - id: RC-DEP-001
        label: "Dependencia Indisponivel"
        pattern: "5xx spike quando dependencia externa cai"
        preventionLayers:
          - "Circuit breaker em todos os clientes externos"
          - "Fallback/cache para dados non-critical"
          - "Health check de dependencias"
          - "Chaos test de falha de dependencia"
      - id: RC-DEP-002
        label: "Dependencia Lenta"
        pattern: "Timeout cascade quando dependencia degrada"
        preventionLayers:
          - "Timeout curto em clientes (< 5s)"
          - "Bulkhead pattern (isolamento de connection pools)"
          - "Retry com backoff exponencial + jitter"

    process:
      - id: RC-PROC-001
        label: "Deploy em Horario de Risco"
        pattern: "Incidente durante sexta a tarde ou fora do horario"
        preventionLayers:
          - "Policy: sem deploys sexta pos 14h"
          - "Gate de horario no CI/CD"
          - "Revisao da janela de deploy"
      - id: RC-PROC-002
        label: "Mudanca sem Observacao"
        pattern: "Problema detectado horas apos deploy sem observacao"
        preventionLayers:
          - "Watchdog pos-mudanca obrigatorio"
          - "Checklist de deploy com campo de observacao"
          - "Alerta se deploy sem observacao ativa"
```

---

## 4. Recurrence Score

### Definicao

O **Recurrence Score** e uma metrica composta que mede a eficacia do sistema de prevencao de recorrencia.

```yaml
recurrenceScore:
  components:
    - name: incident_recurrence_rate
      weight: 0.30
      query: |
        1 - (
          sum(increase(velya_incident_recurrence_total[90d]))
          / sum(increase(velya_incident_total[90d]))
        )
      description: "% de incidentes que NAO recorrem em 90 dias"
      target: ">= 0.95"

    - name: error_pattern_reduction
      weight: 0.20
      query: |
        1 - (
          sum(velya_recurring_error_patterns_current)
          / sum(velya_recurring_error_patterns_total)
        )
      description: "% de padroes de erro que foram eliminados"
      target: ">= 0.90"

    - name: prevention_coverage
      weight: 0.20
      query: |
        sum(velya_pir_prevention_layers_implemented)
        / sum(velya_pir_prevention_layers_planned)
      description: "% de camadas de prevencao implementadas vs planejadas"
      target: ">= 0.85"

    - name: action_item_sla_compliance
      weight: 0.15
      query: |
        sum(velya_pir_action_items{status="done",on_time="true"})
        / sum(velya_pir_action_items{status=~"done|overdue"})
      description: "% de action items concluidos no SLA"
      target: ">= 0.90"

    - name: alert_effectiveness
      weight: 0.15
      query: |
        sum(velya_incidents_detected_by_alert)
        / sum(velya_incident_total)
      description: "% de incidentes detectados por alertas (nao por humanos/usuarios)"
      target: ">= 0.80"

  calculation: |
    recurrence_score = sum(component.value * component.weight) for each component

  thresholds:
    excellent: ">= 0.90"
    good: ">= 0.80"
    needs_improvement: ">= 0.60"
    critical: "< 0.60"
```

### PromQL Agregado

```promql
# Recurrence Score simplificado
(
  # Componente 1: taxa de nao-recorrencia (peso 0.30)
  0.30 * (1 - (
    sum(increase(velya_incident_recurrence_total[90d]))
    / clamp_min(sum(increase(velya_incident_total[90d])), 1)
  ))
  +
  # Componente 2: cobertura de prevencao (peso 0.20)
  0.20 * (
    sum(velya_pir_prevention_layers_implemented)
    / clamp_min(sum(velya_pir_prevention_layers_planned), 1)
  )
  +
  # Componente 3: SLA compliance (peso 0.15)
  0.15 * (
    sum(velya_pir_action_items{status="done",on_time="true"})
    / clamp_min(sum(velya_pir_action_items{status=~"done|overdue"}), 1)
  )
  +
  # Componente 4: eficacia de alertas (peso 0.15)
  0.15 * (
    sum(velya_incidents_detected_by_alert)
    / clamp_min(sum(velya_incident_total), 1)
  )
)
```

---

## 5. CronJob de Deteccao de Recorrencia

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: recurrence-detector
  namespace: velya-ops
spec:
  schedule: "0 6 * * *"  # diariamente as 6h
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      activeDeadlineSeconds: 600
      template:
        spec:
          serviceAccountName: recurrence-detector-sa
          containers:
            - name: detector
              image: velya/recurrence-detector:latest
              env:
                - name: PROMETHEUS_URL
                  value: "http://prometheus.monitoring:9090"
                - name: LOKI_URL
                  value: "http://loki.monitoring:3100"
                - name: SLACK_WEBHOOK
                  valueFrom:
                    secretKeyRef:
                      name: slack-webhooks
                      key: recurrence-channel
                - name: LOOKBACK_DAYS
                  value: "30"
              command:
                - python3
                - /scripts/recurrence_detector.py
              volumeMounts:
                - name: queries
                  mountPath: /queries
          volumes:
            - name: queries
              configMap:
                name: recurrence-queries
          restartPolicy: OnFailure
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: recurrence-queries
  namespace: velya-ops
data:
  queries.yaml: |
    detectionQueries:
      # 1. Rollbacks recorrentes por servico
      - name: recurring_rollbacks
        type: promql
        query: |
          sum by (application) (
            increase(argocd_app_rollback_total[30d])
          ) > 2
        severity: high
        message: "Servico {application} teve {value} rollbacks nos ultimos 30 dias"

      # 2. Alertas que disparam repetidamente
      - name: recurring_alerts
        type: promql
        query: |
          sum by (alertname, app) (
            increase(ALERTS_FOR_STATE[7d])
          ) > 5
        severity: medium
        message: "Alerta {alertname} para {app} disparou {value}x nos ultimos 7 dias"

      # 3. OOMKills recorrentes
      - name: recurring_oomkill
        type: promql
        query: |
          sum by (container, pod) (
            increase(kube_pod_container_status_last_terminated_reason{reason="OOMKilled",namespace="velya"}[30d])
          ) > 2
        severity: high
        message: "Container {container} teve {value} OOMKills nos ultimos 30 dias"

      # 4. CrashLoopBackOff recorrente
      - name: recurring_crashloop
        type: promql
        query: |
          sum by (pod) (
            increase(kube_pod_container_status_restarts_total{namespace="velya"}[7d])
          ) > 10
        severity: high
        message: "Pod {pod} reiniciou {value}x nos ultimos 7 dias"

      # 5. Filas NATS com acumulo recorrente
      - name: recurring_queue_buildup
        type: promql
        query: |
          count_over_time(
            (nats_jetstream_consumer_num_pending > 5000)[30d:1h]
          ) > 10
        severity: medium
        message: "Stream NATS teve acumulo de fila > 5000 em {value} ocasioes nos ultimos 30 dias"

      # 6. Workflows Temporal stuck recorrentes
      - name: recurring_stuck_workflows
        type: promql
        query: |
          sum by (workflow_type) (
            increase(temporal_workflow_timeout_total{namespace="velya"}[30d])
          ) > 3
        severity: high
        message: "Workflow {workflow_type} teve {value} timeouts nos ultimos 30 dias"

      # 7. External Secrets sync failures recorrentes
      - name: recurring_secret_sync_failure
        type: promql
        query: |
          count_over_time(
            (externalsecret_status_condition{condition="SecretSynced",status="False",namespace="velya"} > 0)[30d:1h]
          ) > 5
        severity: medium
        message: "ExternalSecret com falhas de sync recorrentes"

      # 8. Error patterns em logs
      - name: recurring_log_errors
        type: logql
        query: |
          sum by (app, level) (
            count_over_time({namespace="velya"} |= "error" [30d])
          ) > 1000
        severity: medium
        message: "App {app} gerou {value} log errors nos ultimos 30 dias"

      # 9. Connection timeout recorrente
      - name: recurring_connection_timeout
        type: promql
        query: |
          sum by (app, target_service) (
            increase(http_client_request_duration_seconds_count{
              namespace="velya",
              status="timeout"
            }[30d])
          ) > 50
        severity: medium
        message: "App {app} teve {value} timeouts para {target_service} nos ultimos 30 dias"

      # 10. Deploy failures recorrentes
      - name: recurring_deploy_failures
        type: promql
        query: |
          sum by (application) (
            increase(argocd_app_sync_total{phase="Error"}[30d])
          ) > 3
        severity: high
        message: "App {application} teve {value} deploy failures nos ultimos 30 dias"

    # Configuracao de notificacao
    notification:
      # Agrupa resultados por severidade e envia resumo
      groupBy: severity
      template: |
        *Relatorio de Recorrencia - Velya Platform*
        *Data:* {{ .date }}
        *Periodo analisado:* ultimos {{ .lookbackDays }} dias

        {{ if .high }}
        :red_circle: *Recorrencias de Alta Severidade:*
        {{ range .high }}
        - {{ .message }}
        {{ end }}
        {{ end }}

        {{ if .medium }}
        :large_yellow_circle: *Recorrencias de Media Severidade:*
        {{ range .medium }}
        - {{ .message }}
        {{ end }}
        {{ end }}

        *Recurrence Score:* {{ .recurrenceScore }}
        *Trend:* {{ .trend }}
```

### Script do Detector

```python
#!/usr/bin/env python3
"""
recurrence_detector.py - Detecta padroes recorrentes de falha na Velya Platform.
Executa queries configuradas contra Prometheus e Loki, classifica resultados
por severidade e envia relatorio via Slack.
"""

import os
import yaml
import requests
import json
from datetime import datetime
from typing import List, Dict, Tuple

class RecurrenceDetector:
    def __init__(self):
        self.prometheus_url = os.environ["PROMETHEUS_URL"]
        self.loki_url = os.environ.get("LOKI_URL", "")
        self.slack_webhook = os.environ.get("SLACK_WEBHOOK")
        self.lookback_days = int(os.environ.get("LOOKBACK_DAYS", "30"))

        with open("/queries/queries.yaml") as f:
            self.config = yaml.safe_load(f)

    def run(self):
        """Executa todas as queries de deteccao e gera relatorio."""
        results = {"high": [], "medium": [], "low": []}

        for query_def in self.config["detectionQueries"]:
            matches = self._execute_query(query_def)
            for match in matches:
                severity = query_def["severity"]
                message = self._format_message(query_def["message"], match)
                results[severity].append({
                    "name": query_def["name"],
                    "message": message,
                    "value": match.get("value", "N/A"),
                    "labels": match.get("metric", {}),
                })

        # Calcular recurrence score
        score = self._calculate_recurrence_score()

        # Determinar trend (comparar com semana anterior)
        trend = self._calculate_trend(score)

        # Enviar relatorio
        self._send_report(results, score, trend)

        # Emitir metrica para Prometheus (via pushgateway)
        self._push_metrics(results, score)

        return results

    def _execute_query(self, query_def: Dict) -> List[Dict]:
        """Executa query no Prometheus ou Loki."""
        if query_def["type"] == "promql":
            resp = requests.get(
                f"{self.prometheus_url}/api/v1/query",
                params={"query": query_def["query"].strip()}
            )
            data = resp.json()
            if data["status"] == "success":
                return data["data"]["result"]
        elif query_def["type"] == "logql" and self.loki_url:
            resp = requests.get(
                f"{self.loki_url}/loki/api/v1/query",
                params={"query": query_def["query"].strip()}
            )
            data = resp.json()
            if data.get("status") == "success":
                return data["data"]["result"]
        return []

    def _format_message(self, template: str, match: Dict) -> str:
        """Formata mensagem com labels e values do match."""
        msg = template
        metric = match.get("metric", {})
        for key, value in metric.items():
            msg = msg.replace(f"{{{key}}}", str(value))
        if match.get("value"):
            value = match["value"]
            if isinstance(value, list) and len(value) > 1:
                msg = msg.replace("{value}", str(round(float(value[1]), 2)))
            else:
                msg = msg.replace("{value}", str(value))
        return msg

    def _calculate_recurrence_score(self) -> float:
        """Calcula o recurrence score baseado nos componentes definidos."""
        try:
            # Taxa de nao-recorrencia
            resp = requests.get(f"{self.prometheus_url}/api/v1/query", params={
                "query": """
                1 - (
                  sum(increase(velya_incident_recurrence_total[90d]))
                  / clamp_min(sum(increase(velya_incident_total[90d])), 1)
                )
                """
            })
            data = resp.json()
            if data["status"] == "success" and data["data"]["result"]:
                return float(data["data"]["result"][0]["value"][1])
        except Exception:
            pass
        return 0.0

    def _calculate_trend(self, current_score: float) -> str:
        """Compara score atual com semana anterior."""
        # Simplificado - em producao, buscaria metrica historica
        if current_score >= 0.90:
            return "estavel-bom"
        elif current_score >= 0.80:
            return "aceitavel"
        else:
            return "precisa-atencao"

    def _send_report(self, results: Dict, score: float, trend: str):
        """Envia relatorio via Slack."""
        if not self.slack_webhook:
            print(json.dumps(results, indent=2, default=str))
            return

        total = sum(len(v) for v in results.values())
        if total == 0:
            text = (
                f"*Relatorio de Recorrencia - Velya Platform*\n"
                f"*Data:* {datetime.now().strftime('%Y-%m-%d')}\n"
                f"Nenhuma recorrencia detectada nos ultimos {self.lookback_days} dias.\n"
                f"*Recurrence Score:* {score:.2f}\n"
            )
        else:
            text = (
                f"*Relatorio de Recorrencia - Velya Platform*\n"
                f"*Data:* {datetime.now().strftime('%Y-%m-%d')}\n"
                f"*Periodo:* ultimos {self.lookback_days} dias\n\n"
            )
            if results["high"]:
                text += "*Recorrencias de Alta Severidade:*\n"
                for r in results["high"]:
                    text += f"- {r['message']}\n"
                text += "\n"
            if results["medium"]:
                text += "*Recorrencias de Media Severidade:*\n"
                for r in results["medium"]:
                    text += f"- {r['message']}\n"
                text += "\n"
            text += f"*Recurrence Score:* {score:.2f}\n"
            text += f"*Trend:* {trend}\n"

        requests.post(self.slack_webhook, json={"text": text})

    def _push_metrics(self, results: Dict, score: float):
        """Publica metricas no Prometheus Pushgateway."""
        pushgw = os.environ.get("PUSHGATEWAY_URL")
        if not pushgw:
            return
        metrics = (
            f"# HELP velya_recurrence_score Score de prevencao de recorrencia\n"
            f"# TYPE velya_recurrence_score gauge\n"
            f"velya_recurrence_score {score}\n"
            f"# HELP velya_recurrence_patterns_total Total de padroes recorrentes detectados\n"
            f"# TYPE velya_recurrence_patterns_total gauge\n"
            f'velya_recurrence_patterns_total{{severity="high"}} {len(results["high"])}\n'
            f'velya_recurrence_patterns_total{{severity="medium"}} {len(results["medium"])}\n'
        )
        requests.post(
            f"{pushgw}/metrics/job/recurrence_detector",
            data=metrics,
            headers={"Content-Type": "text/plain"}
        )


if __name__ == "__main__":
    detector = RecurrenceDetector()
    results = detector.run()
    total = sum(len(v) for v in results.values())
    print(f"Deteccao concluida: {total} padroes recorrentes encontrados")
```

---

## 6. Estrategias de Prevencao por Camada

### Modelo de Defesa em Profundidade

```
Camada 1: Prevencao no Codigo
    |  Linters, testes unitarios, code review
    v
Camada 2: Prevencao no CI
    |  Testes de integracao, scan, policy check
    v
Camada 3: Prevencao no Deploy
    |  Canary analysis, gates de promocao
    v
Camada 4: Deteccao em Runtime
    |  Alertas, monitoramento, observability
    v
Camada 5: Resposta Automatica
    |  Self-healing, rollback, circuit breaker
    v
Camada 6: Resposta Humana
    |  Escalacao, incidente, PIR
    v
Camada 7: Aprendizado
       PIR, action items, prevencao de recorrencia
```

### Mapeamento: Root Cause -> Camadas de Prevencao

| Root Cause | Camada 1 | Camada 2 | Camada 3 | Camada 4 | Camada 5 |
|---|---|---|---|---|---|
| Memory leak | pprof test | load test 30min | canary memory watch | deriv(memory) alert | OOMKill restart + alerta |
| Connection leak | defer close linter | integration test | canary connection pool | pool usage alert | circuit breaker |
| Race condition | -race flag | stress test | - | error rate alert | restart pod |
| Config error | schema validation | config dry-run | staging apply | CrashLoop alert | rollback |
| Capacity | - | capacity plan review | - | usage > 70% alert | cluster autoscaler |
| Dependency down | circuit breaker code | chaos test | - | dependency health alert | fallback response |
| Secret expired | - | rotation test | - | expiry alert 7d | ESO auto-rotation |
| Deploy em horario ruim | - | gate de horario | policy bloqueio | - | - |

---

## 7. Template de Prevencao

```yaml
recurrencePreventionPlan:
  metadata:
    errorPattern: ""         # descricao do padrao
    recurrenceCount: 0       # quantas vezes ocorreu
    lastOccurrence: ""       # data da ultima ocorrencia
    affectedServices: []     # servicos afetados
    relatedPIRs: []          # PIRs relacionados

  rootCause:
    category: ""             # code|config|infra|dependency|process
    subcategory: ""          # ex: memory-leak, config-error
    description: ""

  preventionLayers:
    layer1_code:
      action: ""
      owner: ""
      deadline: ""
      status: ""             # planned|implemented|validated
      prLink: ""
      validationMethod: ""

    layer2_ci:
      action: ""
      owner: ""
      deadline: ""
      status: ""
      prLink: ""
      validationMethod: ""

    layer3_deploy:
      action: ""
      owner: ""
      deadline: ""
      status: ""
      prLink: ""
      validationMethod: ""

    layer4_runtime:
      action: ""
      owner: ""
      deadline: ""
      status: ""
      prLink: ""
      validationMethod: ""

    layer5_response:
      action: ""
      owner: ""
      deadline: ""
      status: ""
      prLink: ""
      validationMethod: ""

  validation:
    scenarioTest: ""         # como testar que a prevencao funciona
    testDate: ""
    testResult: ""           # pass|fail
    nextTestDate: ""

  monitoring:
    recurrenceQuery: ""      # query que detecta recorrencia deste padrao
    dashboardPanel: ""       # link para painel no Grafana
    alertName: ""            # nome do alerta criado
```

---

## 8. Metricas de Eficacia

### Dashboard de Prevencao de Recorrencia

| Painel | Query | Proposito |
|---|---|---|
| Recurrence Score (gauge) | `velya_recurrence_score` | Score agregado atual |
| Recurrence Score (trend) | `velya_recurrence_score` 30d | Tendencia do score |
| Padroes Recorrentes por Severidade | `velya_recurrence_patterns_total` by severity | Distribuicao de recorrencias |
| Top 5 Servicos com Recorrencia | `topk(5, sum by (app) (velya_incident_recurrence_total))` | Servicos que mais recorrem |
| Camadas de Prevencao Implementadas | `velya_prevention_layers_total` by status | Progresso de implementacao |
| Action Items por SLA | `velya_pir_action_items` by status, on_time | Compliance de SLA |
| Rollbacks por Servico (30d) | `sum by (app) (increase(argocd_app_rollback_total[30d]))` | Estabilidade de deploy |
| Alertas Repetitivos (7d) | `topk(10, sum by (alertname) (increase(ALERTS_FOR_STATE[7d])))` | Alert fatigue |

---

## 9. Processo de Revisao

### Revisao Semanal (15 min, equipe de plantao)

```yaml
weeklyReview:
  agenda:
    - "Novos padroes recorrentes detectados (relatorio do CronJob)"
    - "Action items em atraso"
    - "Recurrence score atual vs meta"
  output:
    - "Priorizacao de prevencoes pendentes"
    - "Escalacao de items criticos"
```

### Revisao Mensal (30 min, tech leads + SRE)

```yaml
monthlyReview:
  agenda:
    - "Trend do recurrence score"
    - "Root causes mais frequentes"
    - "Eficacia das prevencoes implementadas"
    - "Gap analysis: onde ainda faltam camadas"
  output:
    - "Plano de prevencao para proximo mes"
    - "Investimento em automacao/tooling"
    - "Atualizacao de metas"
```

### Revisao Trimestral (1h, engineering leadership)

```yaml
quarterlyReview:
  agenda:
    - "Evolucao do recurrence score"
    - "ROI de prevencoes implementadas"
    - "Comparacao com trimestres anteriores"
    - "Gaps arquiteturais identificados"
  output:
    - "OKRs de prevencao para proximo trimestre"
    - "Budget para tooling/automacao"
    - "Decisoes arquiteturais"
```

---

## 10. Integração com Outros Documentos

| Documento | Relacao |
|---|---|
| `assertive-delivery-criteria.md` (#14) | Criterios de deploy que previnem erros |
| `failure-scenarios-catalog.md` (#15) | Catalogo alimentado por prevencoes |
| `post-change-watch-model.md` (#16) | Observacao que detecta recorrencia cedo |
| `learning-from-errors-model.md` (#17) | Pipeline que gera prevencoes |
| `autonomous-agent-improvement-policy.md` (#19) | Agentes que automatizam deteccao |
