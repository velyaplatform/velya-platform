# Runtime Isolation Model — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Scope**: kind-velya-local (current dev environment) and target AWS EKS (production)  
**Owner**: Infrastructure Team + Security Team  
**Review Cadence**: Quarterly; when cluster topology changes; before EKS migration

---

## Overview

The Velya runtime isolation model defines how workloads are separated from each other in the Kubernetes cluster. Isolation serves multiple purposes:

1. **Security**: Limit the blast radius of a compromised pod — a compromised clinical service cannot reach the AI infrastructure
2. **Resource fairness**: Prevent noisy-neighbor problems where a batch workload starves clinical services
3. **Compliance**: PHI-handling workloads must be isolated from non-PHI infrastructure (HIPAA)
4. **Operational clarity**: Clear namespace boundaries make debugging, RBAC, and quota management easier
5. **Regulatory**: Demonstrate to auditors that clinical data is isolated from operational tools

---

## Current State (kind-velya-local)

### Known Isolation Gaps in kind

The following isolation mechanisms are configured but do not function as expected in kind:

| Mechanism         | Expected                                | Actual                                       | Gap                                  |
| ----------------- | --------------------------------------- | -------------------------------------------- | ------------------------------------ |
| NetworkPolicy     | Pod-to-pod traffic restriction per tier | Not enforced — kindnet ignores NetworkPolicy | Critical gap (GAP-SEC-005, TECH-001) |
| Node isolation    | Workload-class-specific node pools      | All pods share 5 kind nodes                  | No isolation by workload class       |
| Container network | Isolated pod networks per namespace     | Pods can reach across namespaces             | No actual isolation                  |

This means the current dev cluster has **administrative** isolation (RBAC, quotas) but **zero network isolation**. All pods can communicate freely with all other pods.

---

## Namespace Isolation Strategy

### Namespace Inventory and Purpose

| Namespace                 | Purpose                                                                                               | PHI Exposure                                     | Criticality | Network Tier        |
| ------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------- | ------------------- |
| `velya-dev-clinical`      | Patient-facing clinical services: patient-flow-service, discharge-orchestrator, task-inbox-service    | HIGH — direct FHIR access                        | Critical    | clinical-tier       |
| `velya-dev-core`          | Core API infrastructure: api-gateway, audit-service                                                   | HIGH — PHI transit                               | Critical    | backend-tier        |
| `velya-dev-platform`      | Platform services: ESO, ArgoCD, cert-manager                                                          | MEDIUM — secret access                           | High        | platform-tier       |
| `velya-dev-agents`        | AI agent runtime: agent-orchestrator, ai-gateway, policy-engine, memory-service, decision-log-service | HIGH — LLM context includes PHI                  | Critical    | ai-tier             |
| `velya-dev-observability` | Monitoring: Prometheus, Grafana, Loki, Promtail                                                       | LOW — logs contain scrubbed data                 | High        | observability-tier  |
| `velya-dev-web`           | Frontend: velya-web (Next.js)                                                                         | LOW — browser-facing; no direct PHI              | Medium      | frontend-tier       |
| `argocd`                  | GitOps: ArgoCD server and application controller                                                      | LOW — infrastructure only                        | High        | platform-tier       |
| `ingress-nginx`           | Ingress controller: nginx-ingress                                                                     | LOW — TLS termination only                       | Critical    | ingress-tier        |
| `metallb-system`          | Load balancer (dev only): MetalLB speakers                                                            | LOW — network infrastructure                     | High        | infrastructure-tier |
| `keda`                    | Autoscaling: KEDA operator                                                                            | LOW — infrastructure only                        | Medium      | platform-tier       |
| `temporal-system`         | Workflow engine: Temporal server, web UI                                                              | MEDIUM — workflow history may contain references | High        | platform-tier       |
| `nats`                    | Event broker: NATS JetStream cluster                                                                  | HIGH — clinical events in flight                 | Critical    | platform-tier       |

### Namespace Design Principles

1. **PHI-handling namespaces are treated as high-security zones**: `velya-dev-clinical`, `velya-dev-core`, `velya-dev-agents`
2. **Namespaces must not share secrets**: Each namespace has its own ExternalSecret resources pointing to service-specific Secrets Manager paths
3. **Cross-namespace access is forbidden by default**: Any cross-namespace service call requires explicit justification and NetworkPolicy exception
4. **Observability namespace is read-only from a PHI perspective**: Loki may contain logs from clinical services, but all PHI must be scrubbed before reaching Loki

---

## Network Policy Enforcement

### Current State (Critical Gap)

**kindnet does NOT enforce NetworkPolicy.** All 12 configured NetworkPolicy objects are administratively valid but functionally inert. See GAP-SEC-005 and invalidated-assumption TECH-001.

### Required CNI for NetworkPolicy Enforcement

| Environment           | CNI                                    | NetworkPolicy Enforcement |
| --------------------- | -------------------------------------- | ------------------------- |
| kind (dev) — current  | kindnet                                | NOT ENFORCED              |
| kind (dev) — required | Calico (via kind config)               | ENFORCED                  |
| EKS (production)      | Amazon VPC CNI + NetworkPolicy support | ENFORCED                  |

### Replacing kindnet with Calico for kind

```yaml
# infra/local/kind-config-calico.yaml
kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
networking:
  disableDefaultCNI: true # Disable kindnet
  podSubnet: '192.168.0.0/16' # Calico default subnet
nodes:
  - role: control-plane
  - role: worker
  - role: worker
  - role: worker
  - role: worker
```

After cluster creation: `kubectl apply -f https://raw.githubusercontent.com/projectcalico/calico/v3.27.0/manifests/calico.yaml`

### NetworkPolicy Architecture

Once NetworkPolicy is enforced, the following traffic rules apply:

```
External Internet
       ↓
   ingress-nginx (velya-dev-core/ingress-nginx)
       ↓
   api-gateway (velya-dev-core)
       ↓
   [selective access to:]
   patient-flow ← → discharge-orchestrator  [velya-dev-clinical]
   task-inbox-service                        [velya-dev-clinical]
   ai-gateway (velya-dev-agents)
   audit-service (velya-dev-core)
       ↓
   [velya-dev-agents internal:]
   ai-gateway → Anthropic API (internet egress, restricted)
   agent-orchestrator ↔ NATS
   policy-engine (internal only)
   memory-service (internal only)
```

### Default-Deny Baseline

Every namespace must have a default-deny NetworkPolicy as its first policy:

```yaml
# Applied to each velya-dev-* namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: velya-dev-clinical
spec:
  podSelector: {} # All pods in namespace
  policyTypes:
    - Ingress
    - Egress
  # No rules = deny all ingress and egress
```

### Permitted Traffic Matrix

| Source Namespace/Pod               | Destination Namespace/Pod                   | Port       | Justification                                |
| ---------------------------------- | ------------------------------------------- | ---------- | -------------------------------------------- |
| ingress-nginx                      | velya-dev-core / api-gateway                | 3000       | All external traffic enters via api-gateway  |
| velya-dev-core / api-gateway       | velya-dev-clinical / patient-flow-service   | 3001       | Patient data API routing                     |
| velya-dev-core / api-gateway       | velya-dev-clinical / discharge-orchestrator | 3002       | Discharge API routing                        |
| velya-dev-core / api-gateway       | velya-dev-clinical / task-inbox-service     | 3003       | Task API routing                             |
| velya-dev-core / api-gateway       | velya-dev-agents / ai-gateway               | 3010       | AI request routing                           |
| velya-dev-clinical / \*            | nats / nats-server                          | 4222       | NATS client connections                      |
| velya-dev-agents / \*              | nats / nats-server                          | 4222       | Agent NATS communication                     |
| velya-dev-agents / ai-gateway      | api.anthropic.com (egress)                  | 443        | LLM API calls                                |
| velya-dev-clinical / \*            | temporal-system / \*                        | 7233       | Temporal workflow client                     |
| velya-dev-_ / _                    | velya-dev-observability / \*                | PROHIBITED | No direct observability access from services |
| velya-dev-observability / promtail | velya-dev-\* (egress only)                  | ANY        | Log collection                               |

---

## Resource Quota Enforcement

### Current State

ResourceQuotas are configured and enforced on all velya namespaces (kindnet does enforce ResourceQuota even though it doesn't enforce NetworkPolicy).

### Quota Design by Namespace Tier

```yaml
# Clinical namespace quota (higher limits — priority workloads)
apiVersion: v1
kind: ResourceQuota
metadata:
  name: clinical-tier-quota
  namespace: velya-dev-clinical
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.memory: 16Gi
    count/pods: "20"
    count/services: "10"
    persistentvolumeclaims: "5"

# Platform namespace quota (moderate limits)
apiVersion: v1
kind: ResourceQuota
metadata:
  name: platform-tier-quota
  namespace: velya-dev-platform
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 4Gi
    limits.memory: 8Gi
    count/pods: "15"

# Batch/background namespace quota (strict limits)
apiVersion: v1
kind: ResourceQuota
metadata:
  name: batch-tier-quota
  namespace: velya-dev-agents  # agents can be batch-like
spec:
  hard:
    requests.cpu: "8"           # Higher CPU for LLM processing
    requests.memory: 16Gi
    limits.memory: 32Gi
    count/pods: "30"
```

---

## PriorityClass Scheme

### Current State

PriorityClasses are not created in the cluster. Pod scheduling priority is undefined.

### Required PriorityClasses

```yaml
# Priority 1 — Highest: System-critical infrastructure
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-system-critical
value: 1000000
globalDefault: false
description: 'Critical platform components: NATS, ESO, cert-manager. Evict other workloads before these.'

---
# Priority 2 — Clinical services: Direct patient care impact
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-clinical-critical
value: 900000
globalDefault: false
description: 'Clinical services with direct patient safety impact: patient-flow, discharge-orchestrator, early-warning-agent.'

---
# Priority 3 — Platform services: Operational impact
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-platform-high
value: 800000
globalDefault: false
description: 'Important platform services: api-gateway, ai-gateway, policy-engine, audit-service.'

---
# Priority 4 — Default: Standard services
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-standard
value: 500000
globalDefault: true
description: 'Standard services: memory-service, task-inbox, decision-log, velya-web.'

---
# Priority 5 — Lowest: Batch and background
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-batch-low
value: 100000
globalDefault: false
description: 'Non-urgent batch: market intelligence agents, report generation, cleanup jobs.'
```

### Priority Assignment by Service

| Service                   | PriorityClass           | Rationale                                           |
| ------------------------- | ----------------------- | --------------------------------------------------- |
| NATS JetStream            | velya-system-critical   | Event backbone; all clinical workflows depend on it |
| External Secrets Operator | velya-system-critical   | All services need secrets to start                  |
| cert-manager              | velya-system-critical   | TLS for all services depends on cert-manager        |
| patient-flow-service      | velya-clinical-critical | Direct patient data access                          |
| discharge-orchestrator    | velya-clinical-critical | Patient discharge management                        |
| early-warning-agent       | velya-clinical-critical | Patient safety; deterioration alerts                |
| api-gateway               | velya-platform-high     | All external traffic routes through api-gateway     |
| ai-gateway                | velya-platform-high     | AI layer for clinical decision support              |
| audit-service             | velya-platform-high     | Compliance — must not be evicted                    |
| policy-engine             | velya-platform-high     | Safety gate for agent actions                       |
| Prometheus + Alertmanager | velya-platform-high     | Observability and alerting                          |
| task-inbox-service        | velya-standard          | Task routing                                        |
| velya-web                 | velya-standard          | Frontend                                            |
| memory-service            | velya-standard          | Agent memory                                        |
| decision-log-service      | velya-standard          | AI audit trail                                      |
| market-intelligence-agent | velya-batch-low         | Background; no direct patient impact                |
| report-generation jobs    | velya-batch-low         | Batch analytics                                     |

---

## Pod Security Standards

### Target Configuration

Velya namespaces should enforce Pod Security Standards at the `restricted` level, which requires:

- `runAsNonRoot: true`
- `allowPrivilegeEscalation: false`
- `seccompProfile.type: RuntimeDefault` or `Localhost`
- `capabilities.drop: [ALL]`
- No `privileged: true`
- No `hostNetwork`, `hostPID`, `hostIPC`

```yaml
# Namespace label for PSS enforcement
apiVersion: v1
kind: Namespace
metadata:
  name: velya-dev-clinical
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: v1.27
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/warn-version: v1.27
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/audit-version: v1.27
```

**Exception namespaces**: `metallb-system` and `ingress-nginx` require `privileged` baseline due to host network access requirements. These must be explicitly documented exceptions.

### Current State

Pod Security Standards enforcement is not verified. Namespace labels for PSS are not confirmed to be present. This is an open gap (GAP-SEC-008).

---

## Service Account Minimization

### Rules

1. Every Velya service has its own dedicated ServiceAccount
2. No service uses the `default` ServiceAccount
3. `automountServiceAccountToken: false` for all services unless Kubernetes API access is required
4. ServiceAccount names match service names exactly (naming governance)

### ServiceAccount Inventory

```yaml
# velya-dev-clinical namespace
ServiceAccounts:
  - name: velya-patient-flow
    automountServiceAccountToken: false
    annotations:
      velya.io/owner: clinical-team

  - name: velya-discharge-orchestrator
    automountServiceAccountToken: false
    annotations:
      velya.io/owner: clinical-team

  - name: velya-task-inbox
    automountServiceAccountToken: false

# velya-dev-agents namespace
ServiceAccounts:
  - name: velya-ai-gateway
    automountServiceAccountToken: false

  - name: velya-agent-orchestrator
    automountServiceAccountToken: false

  - name: velya-policy-engine
    automountServiceAccountToken: false

# velya-dev-platform namespace
ServiceAccounts:
  - name: velya-external-secrets  # Needs K8s API for secret creation
    automountServiceAccountToken: true  # Exception: ESO needs API access

  - name: velya-argocd  # Needs K8s API for resource management
    automountServiceAccountToken: true  # Exception: ArgoCD needs API access
```

---

## RBAC Model

### Role Hierarchy

```
ClusterAdmin (break-glass only — no human has permanent access)
    ↓
cluster-viewer (SRE read-only access to production)
    ↓
velya-dev-admin (full access to dev namespace group)
    ↓
velya-dev-{domain}-developer (scoped to specific namespace)
    ↓
velya-serviceaccount-{service} (per-service, minimum permissions)
```

### Per-Service RBAC

Each service account is bound to a Role (namespaced, not ClusterRole) with minimum permissions:

```yaml
# Example: patient-flow-service RBAC
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: velya-patient-flow-role
  namespace: velya-dev-clinical
rules:
  - apiGroups: ['']
    resources: ['secrets']
    resourceNames: ['patient-flow-secrets'] # Only its own secret
    verbs: ['get']
  - apiGroups: ['']
    resources: ['configmaps']
    resourceNames: ['patient-flow-config']
    verbs: ['get', 'watch']
  # No cluster-level permissions
  # No cross-namespace permissions
```

---

## Node Pool Isolation (EKS Target)

### Current State (kind)

All 5 kind nodes are identical. Workloads are not separated by node. No node taints exist.

### Target EKS Node Pool Architecture

| Node Pool Name        | Instance Type             | Workloads                                               | Taints                                       | Min | Max |
| --------------------- | ------------------------- | ------------------------------------------------------- | -------------------------------------------- | --- | --- |
| `velya-clinical`      | m6i.xlarge (4 CPU, 16GB)  | Clinical services (patient-flow, discharge, task-inbox) | `velya.io/workload=clinical:NoSchedule`      | 2   | 10  |
| `velya-platform`      | m6i.large (2 CPU, 8GB)    | API gateway, ESO, cert-manager, NATS                    | `velya.io/workload=platform:NoSchedule`      | 2   | 6   |
| `velya-ai`            | m6i.2xlarge (8 CPU, 32GB) | Agent runtime, ai-gateway, policy-engine                | `velya.io/workload=ai:NoSchedule`            | 1   | 5   |
| `velya-observability` | r6i.large (2 CPU, 16GB)   | Prometheus, Loki, Grafana (memory-intensive)            | `velya.io/workload=observability:NoSchedule` | 2   | 4   |
| `velya-web`           | t3.medium (2 CPU, 4GB)    | velya-web, ingress-nginx                                | `velya.io/workload=web:NoSchedule`           | 1   | 8   |
| `velya-batch`         | m6i.xlarge Spot           | Batch jobs, market intelligence                         | `velya.io/workload=batch:NoSchedule`         | 0   | 10  |

### EKS Node Pool Tolerations

Each workload must declare its node pool toleration:

```yaml
# Example: patient-flow-service deployment
spec:
  template:
    spec:
      tolerations:
        - key: 'velya.io/workload'
          value: 'clinical'
          effect: 'NoSchedule'
      nodeSelector:
        velya.io/workload: clinical
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: patient-flow-service
```

---

## Container Security Context Requirements

All Velya containers must have the following security context (enforced by Kyverno ClusterPolicy):

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1001 # Non-root UID
  runAsGroup: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  seccompProfile:
    type: RuntimeDefault
  capabilities:
    drop:
      - ALL
    add: [] # No capabilities added
```

### Exceptions

| Container       | Exception Required                | Reason                              | Compensating Control                              |
| --------------- | --------------------------------- | ----------------------------------- | ------------------------------------------------- |
| MetalLB speaker | hostNetwork: true                 | L2 ARP requires host network        | Only in dev; replaced by AWS LBC in EKS           |
| ingress-nginx   | Net bind capability (port 80/443) | Ingress requires port < 1024        | Add NET_BIND_SERVICE only; all other caps dropped |
| Promtail        | hostPath volume read              | Log collection from node filesystem | Read-only mount; no write permission              |

---

## Isolation Compliance Verification

The following tests must pass in any environment before it is certified for PHI handling:

```bash
# Test 1: NetworkPolicy enforcement
kubectl exec -n velya-dev-web web-pod -- curl http://patient-flow.velya-dev-clinical.svc.cluster.local/health
# Expected: Connection refused (blocked by NetworkPolicy)
# Current kind result: HTTP 200 (NetworkPolicy not enforced — FAIL)

# Test 2: Default service account not used
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.namespace}/{.metadata.name}: {.spec.serviceAccountName}{"\n"}{end}' | grep "default"
# Expected: No Velya pods use the default service account

# Test 3: Pod not running as root
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.name}: runAsUser={.spec.containers[0].securityContext.runAsUser}{"\n"}{end}'
# Expected: All velya-dev-* pods show runAsUser != 0

# Test 4: No privileged containers
kubectl get pods -A -o jsonpath='{range .items[*]}{.metadata.name}: privileged={.spec.containers[0].securityContext.privileged}{"\n"}{end}' | grep "true"
# Expected: Only MetalLB/ingress-nginx (documented exceptions)

# Test 5: ResourceQuotas enforced
kubectl run test-pod -n velya-dev-clinical --image=nginx --restart=Never --limits='cpu=100,memory=10000Gi'
# Expected: Admission rejected due to quota
```

---

_This isolation model is the target state. The current kind cluster does not meet the isolation requirements for PHI handling due to the kindnet NetworkPolicy enforcement gap. No PHI should be processed in the current dev cluster until the CNI is replaced with Calico and all isolation tests pass._
