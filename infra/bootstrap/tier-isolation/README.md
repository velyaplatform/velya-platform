# Velya Tier Isolation & Node Group Strategy

## Overview

Velya uses a **single EKS cluster with 4 specialized node groups** to achieve workload isolation without the overhead of multiple clusters.

```
┌────────────────────────────────────────────┐
│    AWS EKS Cluster (1 control plane)       │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────┐  ┌──────────────┐       │
│  │  Frontend    │  │   Backend    │       │
│  │  t3.medium   │  │  t3.large    │       │
│  │  Replicas: 2 │  │  Replicas: 2 │       │
│  └──────────────┘  └──────────────┘       │
│                                            │
│  ┌──────────────┐  ┌──────────────┐       │
│  │ Platform     │  │  AI/Agents   │       │
│  │ Tools        │  │  t3.large    │       │
│  │ t3.small     │  │  Replicas: 1 │       │
│  │ Replicas: 1  │  │ [TAINTED]    │       │
│  │ [TAINTED]    │  └──────────────┘       │
│  └──────────────┘                         │
│                                            │
│  ✓ Low latency inter-tier (<1ms)          │
│  ✓ Cost efficient (~$350-500/mo dev)      │
│  ✓ Isolated workloads via taints          │
│  ✓ Independent scaling per tier           │
│                                            │
└────────────────────────────────────────────┘
```

---

## Node Group Details

### Node Group 1: Frontend Tier
- **Purpose**: Next.js web application, static assets, UI
- **Instance Type**: `t3.medium`
- **Desired Capacity**: 2 (dev), 3 (prod)
- **Taints**: None (can accept any pod)
- **Labels**: 
  - `velya.io/tier=frontend`
  - `velya.io/workload=web`
- **CPU Requests**: 50m per pod
- **Memory Requests**: 64Mi per pod
- **Max Pods per Node**: ~20
- **Use NodeSelector**: Yes, to keep it clean

### Node Group 2: Backend Tier
- **Purpose**: API Gateway, microservices (Patient Flow, Discharge, Tasks, Audit)
- **Instance Type**: `t3.large`
- **Desired Capacity**: 2 (dev), 3 (prod)
- **Taints**: None (can accept any pod)
- **Labels**:
  - `velya.io/tier=backend`
  - `velya.io/workload=api`
- **CPU Requests**: 100m per service
- **Memory Requests**: 128Mi per service
- **Max Pods per Node**: ~20
- **Use NodeSelector**: Yes, to keep it clean

### Node Group 3: Platform Tools Tier
- **Purpose**: Infrastructure services (ArgoCD, Prometheus, Grafana, Loki, External Secrets)
- **Instance Type**: `t3.small`
- **Desired Capacity**: 1 (dev), 2 (prod)
- **Taints**: `velya.io/platform=true:NoSchedule`
- **Labels**:
  - `velya.io/tier=platform`
  - `velya.io/workload=infra`
- **CPU Requests**: 50m per tool
- **Memory Requests**: 128Mi per tool
- **Max Pods per Node**: ~30 (small pods)
- **Pod Count**: ~10-15
- **Isolation**: Only infrastructure services; user workloads cannot schedule here

### Node Group 4: AI/Agents Tier
- **Purpose**: Agent Orchestrator, AI Gateway, Model Router, Policy Engine
- **Instance Type**: `t3.large` (or `g4dn.xlarge` for GPU inference)
- **Desired Capacity**: 1 (dev), 2 (prod)
- **Taints**: `velya.io/ai-workload=true:NoSchedule`
- **Labels**:
  - `velya.io/tier=ai`
  - `velya.io/workload=agents`
- **CPU Requests**: 200m per agent
- **Memory Requests**: 256Mi per agent
- **Max Pods per Node**: ~15
- **Pod Count**: ~5-10
- **Isolation**: Only AI/agent workloads; backend cannot directly schedule here

---

## Kubernetes Manifests Applied

### 1. Network Policies
**File**: `network-policies-by-tier.yaml`

Restricts network traffic between tiers:

```
Frontend → Backend:    ✓ Allowed
Backend → Frontend:    ✗ Blocked

Backend → Platform:    ✓ Allowed (metrics, logs)
Platform → Backend:    ✓ Allowed

Backend → AI/Agents:   ✓ Allowed
AI/Agents → Backend:   ✓ Allowed (callbacks)

All → External:        ✓ Allowed (via egress)
DNS:                   ✓ Allowed everywhere
```

### 2. Resource Quotas
**File**: `resource-quotas-by-tier.yaml`

Enforce resource limits per tier:

| Tier | CPU Requests | Memory Requests | CPU Limits | Memory Limits | Pods | Services |
|------|------|------|------|------|------|------|
| Frontend | 4 | 4Gi | 8 | 8Gi | 20 | 10 |
| Backend | 8 | 16Gi | 16 | 32Gi | 50 | 20 |
| Platform | 2 | 2Gi | 4 | 4Gi | 30 | 10 |
| AI/Agents | 8 | 16Gi | 16 | 32Gi | 40 | 10 |

> **Implementation note — no `scopeSelector`**: Quotas for frontend, backend, and ai-agents do **not**
> use `scopeSelector`. Kubernetes only allows `PriorityClass` scope on compute resources (`pods`,
> `cpu`, `memory`). Mixing it with `services` or `persistentvolumeclaims` causes the API server to
> reject the entire quota object. Tier isolation is enforced at the node level (labels + taints), so
> namespace-wide quotas are correct and sufficient here. See
> [ADR-0013](../../../docs/adr/0013-resource-quota-scope-selector.md) for full rationale.

### 3. Pod Disruption Budgets (PDBs)
**File**: `resource-quotas-by-tier.yaml`

Ensures high availability during node maintenance:

| Tier | Min Available | Purpose |
|------|------|------|
| Frontend | 1 | At least 1 web instance during updates |
| Backend | 2 | At least 2 services during updates |
| Platform | 1 | At least 1 observability pod |
| AI/Agents | 1 | At least 1 agent running |

---

## Using Node Selectors and Tolerations

### For Frontend Deployments
```yaml
spec:
  template:
    spec:
      nodeSelector:
        velya.io/tier: frontend
      # No tolerations needed
      containers:
        - resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              memory: 256Mi
```

### For Backend Deployments
```yaml
spec:
  template:
    spec:
      nodeSelector:
        velya.io/tier: backend
      # No tolerations needed
      containers:
        - resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              memory: 512Mi
```

### For Platform Tools (ArgoCD, Prometheus, Grafana)
```yaml
spec:
  template:
    spec:
      nodeSelector:
        velya.io/tier: platform
      tolerations:
        - key: "velya.io/platform"
          operator: "Equal"
          value: "true"
          effect: "NoSchedule"
      containers:
        - resources:
            requests:
              cpu: 50m
              memory: 128Mi
            limits:
              memory: 512Mi
```

### For AI/Agent Deployments
```yaml
spec:
  template:
    spec:
      nodeSelector:
        velya.io/tier: ai
      tolerations:
        - key: "velya.io/ai-workload"
          operator: "Equal"
          value: "true"
          effect: "NoSchedule"
      containers:
        - resources:
            requests:
              cpu: 200m
              memory: 256Mi
            limits:
              memory: 1Gi
```

---

## Scaling Behavior

### Frontend Tier
- Scales with web traffic
- HPA target: 70% CPU utilization
- Min 1 pod, max 10 pods

### Backend Tier
- Scales with API requests
- HPA target: 75% CPU utilization
- Min 2 pods, max 15 pods
- Each service should have PDB minAvailable: 1

### Platform Tier
- Fixed replicas (no HPA)
- Usually 1-2 pods per tool
- Low churn expected

### AI/Agents Tier
- Scales with inference workload
- HPA target: 80% CPU utilization
- Min 1 pod, max 10 pods
- Can be overridden for batch processing

---

## Cost Impact (Monthly)

### Development Environment
```
Frontend (2x t3.medium):      $30
Backend (2x t3.large):        $60
Platform (1x t3.small):       $10
AI/Agents (1x t3.large):      $30
EKS Control Plane:            $73
Auto Mode Overhead:           $50
Data Transfer & Storage:      $20
────────────────────────────
Total:                        ~$275/month
```

### Production Environment
```
Frontend (3x t3.medium):      $45
Backend (3x t3.large):        $90
Platform (2x t3.small):       $20
AI/Agents (2x t3.large):      $60
EKS Control Plane:            $73
Auto Mode Overhead:           $100
Load Balancers (2x):          $33
Data Transfer & Storage:      $100
RDS Database:                 $100
NAT Gateway:                  $32
────────────────────────────
Total:                        ~$650/month
```

---

## Failure Scenarios

### Frontend Node Fails
- ✓ Other frontend pods continue serving traffic
- ✓ HPA spins up new pod on backend/other nodes (blocked by taint)
- ✓ New pod created on remaining frontend nodes
- **Impact**: Brief latency spike, then recovery

### Backend Node Fails
- ✓ Other backend pods continue serving requests
- ✓ API Gateway routes around failed pods
- ✓ PDB ensures at least 2 services running
- **Impact**: Degraded service (more latency), no data loss

### Platform Node Fails
- ✓ Prometheus/Grafana might restart
- ✓ ArgoCD continues operating (highly available)
- ✓ Monitoring may be temporarily unavailable
- **Impact**: Observability gap, but services continue

### AI/Agents Node Fails
- ✓ AI inference requests queue in NATS
- ✓ Agents restart on remaining node
- ✓ Backend continues accepting requests (just slower AI responses)
- **Impact**: Slower AI features, no request loss

---

## Scaling Up for Production

To upgrade from dev to production:

```bash
# 1. Update Node Group capacities in OpenTofu
# frontend: desired=3, max=10
# backend: desired=3, max=15
# platform: desired=2, max=5
# ai_agents: desired=2, max=10

# 2. Upgrade instance types (optional)
# frontend: t3.medium → t3.medium (sufficient)
# backend: t3.large → t3.xlarge (if high load)
# platform: t3.small → t3.small (sufficient)
# ai_agents: t3.large → g4dn.xlarge (if GPU needed)

# 3. Enable HPA on all tiers
# Update Helm values to enable autoscaling

# 4. Increase resource quotas
# Edit resource-quotas-by-tier.yaml with prod values

# 5. Deploy
./scripts/deploy.sh infrastructure prod velya-prod
```

---

## Monitoring Node Groups

```bash
# View nodes by tier
kubectl get nodes -L velya.io/tier

# Check node taints
kubectl describe node <node-name> | grep Taints

# View resource usage by node
kubectl top nodes -l velya.io/tier=backend

# View pods by tier
kubectl get pods -A -L velya.io/tier

# Check PDB status
kubectl get pdb -A

# Check resource quotas
kubectl describe resourcequota --all-namespaces
```

---

## References

- [Kubernetes Node Selection](https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/)
- [Pod Disruption Budgets](https://kubernetes.io/docs/tasks/run-application/configure-pdb/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Resource Quotas](https://kubernetes.io/docs/concepts/policy/resource-quotas/)
