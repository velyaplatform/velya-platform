# Observability Runbook — Velya Platform

**Date**: 2026-04-08
**Scope**: Prometheus, Grafana, Loki, Promtail, OpenTelemetry Collector
**Namespace**: velya-dev-observability
**Audience**: On-call engineers, platform team

---

## Quick Reference

| Tool           | URL                                   | Credentials           | Status  |
| -------------- | ------------------------------------- | --------------------- | ------- |
| Grafana        | http://grafana.172.19.0.6.nip.io      | admin / prom-operator | Running |
| Prometheus     | http://prometheus.172.19.0.6.nip.io   | None (open in dev)    | Running |
| Alertmanager   | http://alertmanager.172.19.0.6.nip.io | None (open in dev)    | Running |
| OTel Collector | Internal only (4317/4318)             | N/A                   | Running |

**Security Note**: These URLs are HTTP only. Do not transmit sensitive data via Grafana in dev. Credentials above are development defaults — must be changed before production.

---

## 1. Grafana Operations

### 1.1 Accessing Grafana

```bash
# Verify Grafana is running
kubectl get pods -n velya-dev-observability -l app.kubernetes.io/name=grafana

# Access via browser
open http://grafana.172.19.0.6.nip.io

# Credentials
# Username: admin
# Password: prom-operator
```

### 1.2 Grafana is Not Loading

**Symptoms**: Browser shows connection refused, timeout, or 502 Bad Gateway

```bash
# 1. Check Grafana pod
kubectl get pods -n velya-dev-observability -l app.kubernetes.io/name=grafana

# 2. Check pod logs
kubectl logs -n velya-dev-observability -l app.kubernetes.io/name=grafana --tail=50

# 3. Check Ingress
kubectl get ingress -n velya-dev-observability

# 4. Check ingress-nginx
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=20

# 5. Restart Grafana if needed
kubectl rollout restart deployment -n velya-dev-observability -l app.kubernetes.io/name=grafana
```

### 1.3 Datasource Health Check

In Grafana: Settings → Data Sources → each source → "Save & Test"

```bash
# Check datasource config via Grafana API
curl -u admin:prom-operator http://grafana.172.19.0.6.nip.io/api/datasources

# Test Prometheus connectivity manually
curl http://prometheus.172.19.0.6.nip.io/api/v1/query?query=up
```

### 1.4 Adding a New Dashboard

1. Grafana UI → Dashboards → Import
2. Paste Grafana dashboard JSON or use dashboard ID
3. Select Prometheus as datasource
4. Save with folder: "Velya Platform"

**For production**: Dashboard JSON should be committed to `infra/helm/charts/kube-prometheus-stack/dashboards/` and deployed via ConfigMap.

### 1.5 Common Grafana Queries

#### Cluster Overview

```promql
# Number of running pods
sum(kube_pod_status_phase{phase="Running"})

# Pod restarts in last hour
sum(increase(kube_pod_container_status_restarts_total[1h])) by (pod, namespace)

# Node memory usage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Node CPU usage
100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)
```

#### Service Health (requires application ServiceMonitors — not yet configured)

```promql
# Service request rate (once ServiceMonitors are added)
rate(http_requests_total{job="patient-flow"}[5m])

# Error rate
rate(http_requests_total{job="patient-flow",status=~"5.."}[5m])

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{job="patient-flow"}[5m]))
```

---

## 2. Prometheus Operations

### 2.1 Prometheus Health Check

```bash
# Check Prometheus pods
kubectl get pods -n velya-dev-observability -l prometheus=kube-prometheus

# Access Prometheus UI
open http://prometheus.172.19.0.6.nip.io

# Check Prometheus targets (what it's scraping)
# UI: Status → Targets
# Or: http://prometheus.172.19.0.6.nip.io/targets
```

### 2.2 Prometheus is Not Scraping a Target

**Symptoms**: Target shows as "DOWN" in Prometheus targets page

```bash
# Check ServiceMonitor exists
kubectl get servicemonitor -n velya-dev-observability

# Check if the service has correct labels for the ServiceMonitor selector
kubectl get service -n <target-namespace> <service-name> -o yaml | grep labels -A 10

# Check Prometheus configuration
kubectl get prometheusrule -A

# Check RBAC — Prometheus must be able to access target namespace
kubectl get clusterrole prometheus-kube-prometheus-prometheus -o yaml
```

**Common fix**: ServiceMonitor label selector does not match the target service's labels.

### 2.3 TSDB Storage Full

```bash
# Check Prometheus PVC usage
kubectl get pvc -n velya-dev-observability

# Check Prometheus storage config
kubectl get prometheus -n velya-dev-observability -o jsonpath='{.items[0].spec.storage}'
```

**Fix**: Increase PVC size or reduce retention period.

### 2.4 Prometheus Restart Recovery

```bash
# Prometheus TSDB is durable — restart will reload from WAL
kubectl rollout restart statefulset -n velya-dev-observability -l prometheus=kube-prometheus

# Watch recovery
kubectl rollout status statefulset -n velya-dev-observability
```

---

## 3. Loki Operations

### 3.1 Loki Health Check

```bash
# Check Loki pods
kubectl get pods -n velya-dev-observability -l app.kubernetes.io/name=loki

# Check Loki ready endpoint (via port-forward)
kubectl port-forward -n velya-dev-observability svc/loki 3100:3100 &
curl http://localhost:3100/ready

# Check Promtail → Loki pipeline
kubectl logs -n velya-dev-observability -l app.kubernetes.io/name=promtail --tail=20
```

### 3.2 Querying Logs in Grafana

In Grafana: Explore → Select "Loki" datasource

```logql
# All logs from a namespace
{namespace="velya-dev-core"}

# All logs from a specific service
{namespace="velya-dev-core", app="patient-flow"}

# Filter for errors
{namespace="velya-dev-core"} |= "error"

# JSON parsing (for structured logs)
{namespace="velya-dev-core"} | json | level="error"

# Recent errors with trace ID
{namespace="velya-dev-core"} | json | level="error" | line_format "{{.msg}} trace={{.traceId}}"

# Logs for a specific pod
{pod="patient-flow-xxxx-xxxxx"}

# All logs from last 5 minutes with errors
{namespace="velya-dev-core"} |= "error" [5m]
```

### 3.3 Loki Ingestion Issues

**Symptom**: Logs visible in pod (`kubectl logs`) but not in Grafana/Loki

```bash
# Check Promtail is running on the relevant node
kubectl get pods -n velya-dev-observability -l app.kubernetes.io/name=promtail -o wide

# Check Promtail config
kubectl get configmap -n velya-dev-observability -l app.kubernetes.io/name=promtail -o yaml

# Check Promtail logs for errors
kubectl logs -n velya-dev-observability -l app.kubernetes.io/name=promtail --tail=30 | grep -i error

# Check Loki ingester status
kubectl port-forward -n velya-dev-observability svc/loki 3100:3100 &
curl http://localhost:3100/ring
```

---

## 4. Promtail Operations

### 4.1 Promtail Health Check

```bash
# Check DaemonSet is running on all nodes
kubectl get pods -n velya-dev-observability -l app.kubernetes.io/name=promtail -o wide

# Expected: one pod per node (or per worker node depending on DaemonSet toleration)
# If a node is missing a Promtail pod, logs from that node are not being collected

# Check individual Promtail metrics (shows what it's shipping)
kubectl port-forward -n velya-dev-observability pod/<promtail-pod> 3101:3101 &
curl http://localhost:3101/metrics | grep promtail_read_bytes_total
```

### 4.2 Promtail Missing on a Node

```bash
# Check DaemonSet status
kubectl describe daemonset -n velya-dev-observability -l app.kubernetes.io/name=promtail

# Check if node has a taint that Promtail doesn't tolerate
kubectl describe node <node-name> | grep Taints
```

---

## 5. OpenTelemetry Collector Operations

### 5.1 OTel Collector Health Check

```bash
# Check OTel Collector pod
kubectl get pods -n velya-dev-observability -l app.kubernetes.io/name=opentelemetry-collector

# Check OTel Collector logs
kubectl logs -n velya-dev-observability -l app.kubernetes.io/name=opentelemetry-collector --tail=30
```

### 5.2 OTel Receiver Ports

| Protocol          | Port | Usage                                    |
| ----------------- | ---- | ---------------------------------------- |
| OTLP gRPC         | 4317 | Trace and metric ingestion from services |
| OTLP HTTP         | 4318 | Alternative OTLP endpoint                |
| Prometheus scrape | 8888 | OTel Collector self-metrics              |

### 5.3 Sending Test Traces

```bash
# Port-forward OTel Collector
kubectl port-forward -n velya-dev-observability svc/otel-collector 4318:4318 &

# Send a test trace via HTTP
curl -X POST http://localhost:4318/v1/traces \
  -H "Content-Type: application/json" \
  -d '{
    "resourceSpans": [{
      "resource": {"attributes": [{"key": "service.name", "value": {"stringValue": "test-service"}}]},
      "scopeSpans": [{"spans": [{"traceId": "00112233445566778899aabbccddeeff", "spanId": "0011223344556677", "name": "test-span", "kind": 1, "startTimeUnixNano": "1234567890000000000", "endTimeUnixNano": "1234567890500000000"}]}]
    }]
  }'
```

---

## 6. Alertmanager Operations

### 6.1 Alertmanager Health Check

```bash
# Check Alertmanager pods
kubectl get pods -n velya-dev-observability -l alertmanager=kube-prometheus

# Access Alertmanager UI
open http://alertmanager.172.19.0.6.nip.io
```

### 6.2 Viewing Active Alerts

```bash
# Via Prometheus UI: Alerts tab
open http://prometheus.172.19.0.6.nip.io/alerts

# Via Alertmanager UI: Shows active alerts and silences
open http://alertmanager.172.19.0.6.nip.io
```

### 6.3 Silencing an Alert (Maintenance Window)

```bash
# Via Alertmanager UI: + Silence button
# Set: matcher (alert name), start/end time, comment

# Via kubectl (create Silence via API)
curl -X POST http://alertmanager.172.19.0.6.nip.io/api/v2/silences \
  -H "Content-Type: application/json" \
  -d '{
    "matchers": [{"name": "alertname", "value": "VelyaServiceDown", "isRegex": false}],
    "startsAt": "2026-04-08T10:00:00Z",
    "endsAt": "2026-04-08T12:00:00Z",
    "comment": "Planned maintenance window",
    "createdBy": "operator"
  }'
```

---

## 7. Common Scenarios

### 7.1 "Grafana shows no data for a Velya service"

**Root cause**: Application ServiceMonitors not configured (known gap — NOT IMPLEMENTED).

**Workaround**:

1. Check `kubectl logs` for the service directly
2. Use `kubectl exec` to check internal metrics endpoint: `curl localhost:3000/metrics`
3. Track issue: ServiceMonitors must be created — see `docs/validation/observability-validation.md`

### 7.2 "I need to investigate a trace for a user-reported error"

```bash
# Step 1: Get the trace ID from service logs
kubectl logs -n velya-dev-core -l app=patient-flow | grep "error" | grep -o '"traceId":"[^"]*"'

# Step 2: Search in Grafana Explore (Loki)
{namespace="velya-dev-core"} | json | traceId="<trace-id>"

# Step 3: If Tempo/Jaeger configured, search for trace directly
# Note: Distributed trace visualization may not be available — check OTel Collector config
```

### 7.3 "Observability stack is consuming too many cluster resources"

```bash
# Check observability namespace resource usage
kubectl top pods -n velya-dev-observability

# Check Prometheus storage size
kubectl get pvc -n velya-dev-observability

# Common cause: Prometheus retention too long or high cardinality metrics
# Solution: Reduce retention period (default: 15d)
# kubectl edit prometheus -n velya-dev-observability
# spec.retention: "7d"
```

### 7.4 "Loki is showing log gaps"

```bash
# Check Promtail for ingestion errors
kubectl logs -n velya-dev-observability -l app.kubernetes.io/name=promtail | grep -i "error\|drop\|fail"

# Check Loki ingester metrics
kubectl port-forward -n velya-dev-observability svc/loki 3100:3100 &
curl http://localhost:3100/metrics | grep loki_ingester

# Check for Loki canary discrepancies
kubectl logs -n velya-dev-observability -l app.kubernetes.io/name=loki-canary | tail -20
```

---

## 8. Credentials and Secrets

| Secret                 | Namespace               | Secret Name | Key            |
| ---------------------- | ----------------------- | ----------- | -------------- |
| Grafana admin password | velya-dev-observability | grafana     | admin-password |
| Prometheus RBAC token  | velya-dev-observability | N/A         | N/A            |

```bash
# Retrieve Grafana admin password
kubectl get secret -n velya-dev-observability grafana -o jsonpath='{.data.admin-password}' | base64 -d
```

**Production note**: Change all default credentials before production. Use ESO to sync from AWS Secrets Manager.

---

## 9. When to Escalate

| Situation                                             | Escalate To                       |
| ----------------------------------------------------- | --------------------------------- |
| Prometheus TSDB corruption                            | Platform Lead                     |
| > 30 minutes of log gaps in Loki                      | Platform Lead                     |
| Observability stack consuming > 50% cluster resources | Platform Lead                     |
| Grafana breach (unauthorized access)                  | Security Team immediately         |
| Loss of audit trail from audit-service                | Security + Compliance immediately |

---

_Runbook maintained by: Platform Team (Observability). Review quarterly or after any observability incident._
