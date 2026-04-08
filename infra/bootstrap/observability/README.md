# Observability Stack

## Overview

The Velya observability stack provides metrics, logs, and traces using:

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Dashboards and visualization
- **Loki** - Log aggregation
- **Tempo** - Distributed tracing
- **OpenTelemetry Collector** - Unified telemetry pipeline

## Prerequisites

- Kubernetes cluster (1.27+)
- Helm v3.12+
- Observability namespace created

## Installation

### 1. Create the Namespace

```bash
kubectl apply -f infra/bootstrap/observability/namespace.yaml
```

### 2. Install Prometheus via kube-prometheus-stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace velya-observability \
  --version 65.8.1 \
  --set prometheus.prometheusSpec.retention=30d \
  --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi \
  --set grafana.enabled=true \
  --set grafana.persistence.enabled=true \
  --set grafana.persistence.size=10Gi \
  --set alertmanager.enabled=true \
  --wait
```

### 3. Install Loki

```bash
helm repo add grafana https://grafana.github.io/helm-charts
helm repo update

helm install loki grafana/loki \
  --namespace velya-observability \
  --version 6.21.0 \
  --set loki.commonConfig.replication_factor=1 \
  --set loki.storage.type=s3 \
  --set singleBinary.replicas=1 \
  --wait
```

### 4. Install Tempo

```bash
helm install tempo grafana/tempo \
  --namespace velya-observability \
  --version 1.12.0 \
  --set tempo.retention=72h \
  --set persistence.enabled=true \
  --set persistence.size=10Gi \
  --wait
```

### 5. Install OpenTelemetry Collector

```bash
helm repo add open-telemetry https://open-telemetry.github.io/opentelemetry-helm-charts
helm repo update

# Apply the collector config
kubectl apply -f infra/bootstrap/observability/otel-collector-config.yaml

helm install otel-collector open-telemetry/opentelemetry-collector \
  --namespace velya-observability \
  --version 0.107.0 \
  --set mode=deployment \
  --set config.create=false \
  --set configMap.name=otel-collector-config \
  --set configMap.key=otel-collector-config.yaml \
  --set ports.otlp.enabled=true \
  --set ports.otlp-http.enabled=true \
  --set resources.requests.cpu=200m \
  --set resources.requests.memory=256Mi \
  --set resources.limits.cpu=1 \
  --set resources.limits.memory=512Mi \
  --wait
```

## Application Instrumentation

Services should send telemetry to the OTel Collector:

- **OTLP gRPC**: `otel-collector-opentelemetry-collector.velya-observability.svc.cluster.local:4317`
- **OTLP HTTP**: `otel-collector-opentelemetry-collector.velya-observability.svc.cluster.local:4318`

Set the following environment variables in your service deployments:

```yaml
env:
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: http://otel-collector-opentelemetry-collector.velya-observability.svc.cluster.local:4317
  - name: OTEL_SERVICE_NAME
    valueFrom:
      fieldRef:
        fieldPath: metadata.labels['app.kubernetes.io/name']
  - name: OTEL_RESOURCE_ATTRIBUTES
    value: 'service.namespace=$(NAMESPACE),k8s.pod.name=$(POD_NAME)'
```

## Accessing Grafana

```bash
kubectl port-forward svc/prometheus-grafana -n velya-observability 3000:80
```

Default credentials: `admin` / retrieve from secret:

```bash
kubectl get secret prometheus-grafana -n velya-observability -o jsonpath="{.data.admin-password}" | base64 -d
```
