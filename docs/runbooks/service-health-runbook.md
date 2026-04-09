# Service Health Runbook — Velya Platform

**Date**: 2026-04-08
**Scope**: All Velya services (velya-dev-core, velya-dev-platform, velya-dev-agents namespaces)
**Audience**: On-call engineers, platform team
**Cluster**: kind-velya-local (dev) / velya-prod (future EKS)

---

## Quick Reference

| Service | Namespace | Ingress URL | Health Path |
|---|---|---|---|
| patient-flow | velya-dev-core | http://patient-flow.172.19.0.6.nip.io | /health |
| discharge-orchestrator | velya-dev-core | http://discharge.172.19.0.6.nip.io | /health |
| task-inbox | velya-dev-core | http://task-inbox.172.19.0.6.nip.io | /health |
| audit-service | velya-dev-core | http://audit.172.19.0.6.nip.io | /health |
| ai-gateway | velya-dev-platform | http://ai-gateway.172.19.0.6.nip.io | /health |
| policy-engine | velya-dev-platform | http://policy-engine.172.19.0.6.nip.io | /health |
| memory-service | velya-dev-platform | http://memory-service.172.19.0.6.nip.io | /health |
| decision-log-service | velya-dev-platform | http://decision-log.172.19.0.6.nip.io | /health |
| agent-orchestrator | velya-dev-agents | http://agents.172.19.0.6.nip.io | /health |

---

## 1. Detection

### 1.1 How You Know a Service Is Unhealthy

**Automated detection** (when configured):
- Prometheus alert fires: `VelyaServiceDown` or `VelyaHighErrorRate`
- ArgoCD app shows Degraded health (when ArgoCD Applications are configured)
- Grafana alert notification in Slack/PagerDuty

**Manual detection**:
- HTTP request to service endpoint returns 5xx
- HTTP request times out (> 5 seconds)
- Pod shows CrashLoopBackOff or OOMKilled
- Kubernetes reports pod as not Ready

### 1.2 First Check (< 2 minutes)

```bash
# 1. Check all Velya pods
kubectl get pods -n velya-dev-core
kubectl get pods -n velya-dev-platform
kubectl get pods -n velya-dev-agents

# 2. Quick HTTP health check for specific service
curl -o /dev/null -s -w "%{http_code}\n" http://patient-flow.172.19.0.6.nip.io/health

# 3. Check for recent events
kubectl get events -n velya-dev-core --sort-by='.lastTimestamp' | tail -20
```

---

## 2. Triage

### 2.1 Classify the Severity

| Condition | Severity | Response Time |
|---|---|---|
| Clinical service returning 5xx | P1 CRITICAL | Immediate |
| Clinical service not responding | P1 CRITICAL | Immediate |
| AI/Platform service down | P2 HIGH | 15 minutes |
| Observability service down | P3 MEDIUM | 1 hour |
| Single pod restart (recovered) | P4 LOW | Next business day |
| Background service degraded | P4 LOW | Next business day |

**Clinical services** (patient-flow, discharge-orchestrator, task-inbox, audit-service) are P1 by default.

### 2.2 Determine the Failure Type

```bash
# Check pod status
kubectl get pod -n <namespace> <pod-name> -o wide

# Common status meanings:
# CrashLoopBackOff  → Application crashing on startup
# OOMKilled         → Container exceeded memory limit
# Pending           → Cannot be scheduled (resources, node selector, PVC)
# ImagePullBackOff  → Cannot pull container image
# Error             → Container exited with non-zero code
# Init:Error        → Init container failed
```

---

## 3. Diagnosis

### 3.1 Read Pod Logs

```bash
# Current pod logs (last 100 lines)
kubectl logs -n <namespace> <pod-name> --tail=100

# Previous container logs (if pod restarted)
kubectl logs -n <namespace> <pod-name> --previous

# Stream logs in real time
kubectl logs -n <namespace> -l app=patient-flow -f

# All containers in pod
kubectl logs -n <namespace> <pod-name> --all-containers
```

### 3.2 Inspect Pod Details

```bash
# Full pod description (events, resource limits, mounts)
kubectl describe pod -n <namespace> <pod-name>

# Check specific fields
kubectl get pod -n <namespace> <pod-name> -o jsonpath='{.status.conditions}'
kubectl get pod -n <namespace> <pod-name> -o jsonpath='{.status.containerStatuses}'
```

### 3.3 Check Resource Consumption

```bash
# CPU and memory usage
kubectl top pods -n velya-dev-core
kubectl top pods -n velya-dev-platform

# Check resource limits vs requests
kubectl get pod -n <namespace> <pod-name> -o jsonpath='{.spec.containers[0].resources}'

# Check namespace quota usage
kubectl describe resourcequota -n <namespace>
```

### 3.4 Check Service and Ingress

```bash
# Is the Service routing to healthy pods?
kubectl get endpoints -n <namespace> <service-name>

# Is the Ingress configured correctly?
kubectl get ingress -n <namespace> -o yaml

# Check ingress-nginx controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx --tail=50
```

### 3.5 Common Failure Patterns

#### Pattern 1: CrashLoopBackOff

```bash
# Get crash reason
kubectl logs -n <namespace> <pod-name> --previous

# Common causes:
# - Application startup failure (missing env var, wrong DB URL)
# - Port already in use
# - Missing required configuration
# - Code bug in startup path
```

**Fix**: Read the logs. The error message is almost always in the last few lines.

#### Pattern 2: OOMKilled

```bash
# Confirm OOM
kubectl get pod -n <namespace> <pod-name> -o jsonpath='{.status.containerStatuses[0].lastState}'

# Check memory usage trend (requires Prometheus)
# Grafana → explore → 
# container_memory_usage_bytes{pod="<pod-name>"}
```

**Fix**: Increase memory limit in deployment manifest. Check for memory leaks if recurring.

#### Pattern 3: ImagePullBackOff

```bash
# Check image name and tag
kubectl get pod -n <namespace> <pod-name> -o jsonpath='{.spec.containers[0].image}'

# Check image pull secrets
kubectl get pod -n <namespace> <pod-name> -o jsonpath='{.spec.imagePullSecrets}'
```

**Fix**: Verify image exists in registry. Verify pull secret is valid.

#### Pattern 4: Service Returns 5xx

```bash
# Check if pod is marked Ready
kubectl get pod -n <namespace> -l app=<service-name>

# Test direct pod (bypassing service/ingress)
kubectl port-forward -n <namespace> pod/<pod-name> 3000:3000
curl localhost:3000/health

# Check recent log errors
kubectl logs -n <namespace> <pod-name> --tail=50 | grep -E '"level":"error"'
```

#### Pattern 5: Pending Pod (Cannot Schedule)

```bash
# Check scheduling events
kubectl describe pod -n <namespace> <pod-name> | grep -A 10 Events

# Common reasons:
# - Insufficient CPU or memory on nodes: kubectl top nodes
# - PVC cannot be provisioned: kubectl get pvc -n <namespace>
# - ResourceQuota exceeded: kubectl describe resourcequota -n <namespace>
```

---

## 4. Recovery Steps

### 4.1 Restart a Pod

```bash
# Delete pod — Kubernetes will recreate it from the Deployment
kubectl delete pod -n <namespace> <pod-name>

# Or restart the deployment (rolling restart)
kubectl rollout restart deployment/<deployment-name> -n <namespace>

# Watch rollout status
kubectl rollout status deployment/<deployment-name> -n <namespace>
```

### 4.2 Rollback a Deployment

```bash
# Check rollout history
kubectl rollout history deployment/<deployment-name> -n <namespace>

# Rollback to previous version
kubectl rollout undo deployment/<deployment-name> -n <namespace>

# Rollback to specific revision
kubectl rollout undo deployment/<deployment-name> -n <namespace> --to-revision=<number>

# Verify rollback
kubectl rollout status deployment/<deployment-name> -n <namespace>
```

### 4.3 Scale a Service

```bash
# Scale up (for availability)
kubectl scale deployment/<deployment-name> -n <namespace> --replicas=2

# Scale down (for resource relief)
kubectl scale deployment/<deployment-name> -n <namespace> --replicas=1
```

### 4.4 Force Delete a Stuck Pod

```bash
# Only use if pod is stuck in Terminating state
kubectl delete pod -n <namespace> <pod-name> --force --grace-period=0
```

### 4.5 Apply a Config Fix

```bash
# Edit deployment directly (dev only — use GitOps in staging/prod)
kubectl edit deployment/<deployment-name> -n <namespace>

# Or apply updated manifest
kubectl apply -f infra/kubernetes/services/<service-name>/deployment.yaml
```

---

## 5. Escalation

### 5.1 Escalation Matrix

| Situation | Escalate To | Channel |
|---|---|---|
| P1 - Clinical service down > 5 minutes | Platform Lead + Clinical Lead | Pager/phone |
| P1 - Cannot recover in 15 minutes | Engineering Manager | Phone |
| Data loss suspected | Security Team + Engineering Manager | Phone immediately |
| PHI exposure suspected | Security Team + Legal + Engineering Manager | Phone immediately |
| Recurring failures (3rd time same issue) | Platform Lead for root cause | Slack |
| Node or cluster failure | Infrastructure Lead | Pager |

### 5.2 Escalation Information to Prepare

Before escalating, gather:
1. Which service is affected
2. When did it start failing
3. Error messages from pod logs (last 50 lines)
4. What was recently deployed
5. How many users are affected
6. Whether patient data operations are affected

---

## 6. Observability Links

When Prometheus and Grafana are configured with application metrics:

| Dashboard | URL |
|---|---|
| Grafana | http://grafana.172.19.0.6.nip.io |
| Prometheus | http://prometheus.172.19.0.6.nip.io |

**Useful Prometheus queries** (once ServiceMonitors are configured):

```promql
# Service availability
up{job="patient-flow"}

# Request rate
rate(http_requests_total{service="patient-flow"}[5m])

# Error rate
rate(http_requests_total{service="patient-flow", status=~"5.."}[5m])

# P99 latency
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="patient-flow"}[5m]))

# Memory usage
container_memory_usage_bytes{namespace="velya-dev-core"}

# Restarts in last hour
increase(kube_pod_container_status_restarts_total{namespace="velya-dev-core"}[1h])
```

---

## 7. Post-Incident

### 7.1 Immediate Post-Incident Steps (< 1 hour after resolution)

1. Confirm service is fully healthy (all health endpoints returning 200)
2. Confirm no data loss occurred
3. Notify stakeholders that service is restored
4. Write brief incident summary: what failed, when, how fixed

### 7.2 Post-Incident Review (within 48 hours)

Conduct a blameless post-mortem covering:

1. **Timeline**: When did the incident start? When was it detected? When resolved?
2. **Root cause**: What actually caused the failure?
3. **Contributing factors**: What made it worse? What delayed detection?
4. **Resolution**: What fixed it?
5. **Action items**: What changes prevent recurrence?

**Document location**: `docs/security/incidents/YYYY-MM-DD-<service>-<brief-description>.md`

### 7.3 Action Item Categories

| Category | Example |
|---|---|
| Detection | Add alert rule, improve health check |
| Prevention | Fix bug, add validation, increase resources |
| Recovery | Improve runbook, add rollback automation |
| Process | Update on-call procedures, add escalation contact |

---

## 8. Service-Specific Notes

### patient-flow
- Most critical clinical service — P1 always
- Affects: patient admission, transfer, census visibility
- Key dependency: PostgreSQL database connection

### discharge-orchestrator
- Critical for bed capacity — P1 if beds unavailable
- Affects: discharge planning, bed turnover
- Key dependency: patient-flow service + external pharmacy integration

### task-inbox
- Affects clinical workflow routing — P1
- Key dependency: NATS JetStream for task events

### audit-service
- Must not lose events — P1 for data integrity
- If audit-service fails, all other services should continue but log to fallback
- Key dependency: PostgreSQL write path

### ai-gateway
- Affects all AI features — P2 (AI features degrade, clinical continues)
- Key dependency: Anthropic/OpenAI API access

### policy-engine
- Affects AI safety checks — P1 if in enforcement mode
- If policy-engine is down and AI gateway defaults to DENY, all AI features stop
- Consider fail-open vs. fail-closed policy for degraded mode

---

*Runbook maintained by: Platform Team. Review quarterly or after any incident.*
