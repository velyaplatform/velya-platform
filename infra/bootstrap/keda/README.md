# KEDA (Kubernetes Event-Driven Autoscaling)

## Overview

KEDA enables event-driven autoscaling for Velya agent workloads. Agents can scale from zero to N based on queue depth, HTTP traffic, or custom metrics.

## Installation

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm repo update

helm install keda kedacore/keda \
  --namespace keda \
  --create-namespace \
  --version 2.16.1 \
  --set resources.operator.requests.cpu=100m \
  --set resources.operator.requests.memory=128Mi \
  --set resources.operator.limits.cpu=500m \
  --set resources.operator.limits.memory=512Mi \
  --set resources.metricServer.requests.cpu=50m \
  --set resources.metricServer.requests.memory=64Mi \
  --set resources.metricServer.limits.cpu=250m \
  --set resources.metricServer.limits.memory=256Mi \
  --set prometheus.metricServer.enabled=true \
  --set prometheus.operator.enabled=true \
  --wait
```

## Example: ScaledObject for Agent Workers

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: agent-worker-scaler
  namespace: velya-dev-agents
  labels:
    app.kubernetes.io/name: agent-worker
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: agents
spec:
  scaleTargetRef:
    name: agent-worker
  pollingInterval: 15
  cooldownPeriod: 120
  idleReplicaCount: 0
  minReplicaCount: 0
  maxReplicaCount: 20
  fallback:
    failureThreshold: 3
    replicas: 2
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-server.velya-observability.svc.cluster.local:9090
        metricName: velya_agent_queue_depth
        query: sum(velya_agent_queue_depth{namespace="velya-dev-agents"})
        threshold: "5"
        activationThreshold: "1"
  advanced:
    restoreToOriginalReplicaCount: false
    horizontalPodAutoscalerConfig:
      behavior:
        scaleDown:
          stabilizationWindowSeconds: 300
          policies:
            - type: Percent
              value: 25
              periodSeconds: 60
        scaleUp:
          stabilizationWindowSeconds: 30
          policies:
            - type: Pods
              value: 4
              periodSeconds: 60
```

## Example: ScaledObject for AI Gateway (HTTP-based)

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: ai-gateway-scaler
  namespace: velya-dev-platform
  labels:
    app.kubernetes.io/name: ai-gateway
    app.kubernetes.io/part-of: velya-platform
    app.kubernetes.io/component: platform
spec:
  scaleTargetRef:
    name: ai-gateway
  pollingInterval: 10
  cooldownPeriod: 60
  minReplicaCount: 2
  maxReplicaCount: 50
  triggers:
    - type: prometheus
      metadata:
        serverAddress: http://prometheus-server.velya-observability.svc.cluster.local:9090
        metricName: velya_gateway_requests_per_second
        query: sum(rate(http_server_request_duration_seconds_count{namespace="velya-dev-platform",service="ai-gateway"}[1m]))
        threshold: "100"
```

## Verification

```bash
# Check KEDA operator is running
kubectl get pods -n keda

# Check ScaledObjects
kubectl get scaledobject -A

# Check HPA created by KEDA
kubectl get hpa -A
```
