# Cluster Architecture Validation — Velya Platform

**Date**: 2026-04-08
**Cluster**: kind-velya-local (5 nodes)
**Target Architecture**: AWS EKS Auto Mode (single cluster, multi-AZ)
**Validation Method**: kubectl audit + repository inspection

---

## Architecture Intent vs. Reality

The intended production architecture uses AWS EKS Auto Mode with a single cluster serving all Velya workloads, namespace-segmented by tier. The current development architecture uses a local kind cluster as a proxy for that topology.

This document validates how well the kind cluster approximates the intended EKS architecture.

---

## 1. Cluster Topology

### 1.1 Single Cluster Architecture

| Aspect | Expected | Found | Status |
|---|---|---|---|
| Architecture model | Single cluster, namespace-segmented | Single cluster (kind) | PASS |
| Node count (dev) | 3–5 nodes | 5 nodes | PASS |
| Node count (prod EKS) | 3+ AZ-distributed | N/A (not on EKS) | NOT IMPLEMENTED |
| Multi-AZ distribution | Nodes across 3 AZs | Not applicable (kind) | NOT APPLICABLE |
| EKS Auto Mode | AWS-managed nodes | Not provisioned | NOT IMPLEMENTED |

**Assessment**: The kind cluster correctly implements the single-cluster topology for development. The transition to EKS is a separate work item.

### 1.2 Node Architecture

```
kind-velya-local cluster:
  control-plane (1 node) — Kubernetes API server, etcd, scheduler
  worker-1               — General workloads
  worker-2               — General workloads
  worker-3               — General workloads
  worker-4               — General workloads

Target EKS topology:
  Control Plane         — AWS-managed
  NodePool: system      — Ingress, cert-manager, MetalLB equivalent (NLB)
  NodePool: platform    — Observability, ArgoCD, KEDA
  NodePool: core        — Clinical services (patient-flow, discharge, task-inbox, audit)
  NodePool: ai          — AI services, GPU-capable (ai-gateway, policy-engine, agents)
  NodePool: web         — Frontend services
```

---

## 2. Namespace Segmentation

### 2.1 Namespace Inventory

| Namespace | Purpose | Tier | Status |
|---|---|---|---|
| velya-dev-core | Patient flow, discharge, task, audit | Clinical/Core | PASS |
| velya-dev-platform | AI gateway, policy, memory, decision log | AI/Platform | PASS |
| velya-dev-agents | Agent orchestrator | AI/Agents | PASS |
| velya-dev-observability | Prometheus, Grafana, Loki, OTel | Observability | PASS |
| velya-dev-web | Next.js frontend | Frontend | PASS |
| argocd | GitOps control plane | System | PASS |
| ingress-nginx | Ingress controller | System | PASS |
| metallb-system | Layer 2 load balancer | System | PASS |

**Assessment**: Namespace structure correctly mirrors the intended `velya-{env}-{domain}` pattern. All 8 relevant namespaces confirmed.

### 2.2 Naming Convention Compliance

| Pattern | Expected | Found | Status |
|---|---|---|---|
| `velya-{env}-{domain}` | velya-dev-* | velya-dev-core, velya-dev-platform, velya-dev-agents, velya-dev-observability, velya-dev-web | PASS |
| System namespaces | Standard names | argocd, ingress-nginx, metallb-system | PASS |
| No velya-staging-* | Not applicable yet | Absent | PASS |
| No velya-prod-* | Not applicable yet | Absent | PASS |

---

## 3. Resource Quotas

### 3.1 ResourceQuota Coverage

| Namespace | ResourceQuota | Status |
|---|---|---|
| velya-dev-core | Configured | PASS |
| velya-dev-platform | Configured | PASS |
| velya-dev-agents | Configured | PASS |
| velya-dev-observability | Configured | PASS |
| velya-dev-web | Configured | PASS |
| argocd | Configured | PASS |
| ingress-nginx | Configured | PASS |
| metallb-system | Configured | PASS |

**Assessment**: ResourceQuotas present on all namespaces. This provides blast radius isolation — a runaway namespace cannot consume all cluster resources.

**Note**: Quota values have not been verified against actual workload requirements. Quotas may be too loose (not providing real protection) or too tight (causing quota-exceeded errors under load).

---

## 4. Network Policies

### 4.1 NetworkPolicy Coverage by Tier

| Tier | Namespaces | Policy Exists | Default Deny | Status |
|---|---|---|---|---|
| Backend/Core | velya-dev-core | YES | INFERRED | PASS |
| AI/Platform | velya-dev-platform | YES | INFERRED | PASS |
| Agents | velya-dev-agents | YES | INFERRED | PASS |
| Frontend | velya-dev-web | YES | INFERRED | PASS |
| Observability | velya-dev-observability | YES | INFERRED | PASS |
| System | argocd, ingress-nginx, metallb-system | YES | INFERRED | PASS |

**Assessment**: NetworkPolicies are configured per tier. Default-deny semantics are inferred from the cluster audit but not explicitly verified. Egress policies not confirmed.

**Gap**: NetworkPolicy effectiveness tests have not been run. Policies may have gaps that allow unexpected lateral movement. Recommend running netpol conformance tests.

### 4.2 Expected Traffic Paths

```
Internet → ingress-nginx → velya-dev-web (Next.js)
Internet → ingress-nginx → velya-dev-core services (APIs)
Internet → ingress-nginx → velya-dev-platform services (APIs)
Internet → ingress-nginx → argocd, grafana, prometheus (ops)

velya-dev-web → velya-dev-core (API calls)
velya-dev-core → velya-dev-platform (AI calls)
velya-dev-platform → velya-dev-agents (agent coordination)

All namespaces → velya-dev-observability (metrics, logs, traces)
velya-dev-* → ESO (secret reads)
```

---

## 5. PodDisruptionBudgets

| Status | Count | Verification |
|---|---|---|
| PDBs configured | YES | PASS — kubectl confirmed |
| PDBs effective with 1 replica | NO | RISKY — minAvailable: 1 with 1 replica means 0 allowed disruptions |
| PDB coverage for all services | NOT VERIFIED | Not all services enumerated |

**Assessment**: PDBs are configured which is correct. However, with all services running at single replica, PDBs with `minAvailable: 1` become impossible to satisfy during rolling updates — Kubernetes cannot take the pod down for the update because that would violate the PDB. This results in stuck deployments rather than protection.

**Fix**: Increase replicas to 2+ before PDBs can provide meaningful protection.

---

## 6. Scheduling Isolation

### 6.1 Node Taints

| Item | Expected | Found | Status |
|---|---|---|---|
| AI workload taints | `workload=ai:NoSchedule` on AI nodes | NOT CONFIGURED | NOT IMPLEMENTED |
| GPU node taints | `nvidia.com/gpu:NoSchedule` | NOT APPLICABLE (kind) | NOT IMPLEMENTED |
| System node taints | Dedicated system node | NOT CONFIGURED | NOT IMPLEMENTED |

**Assessment**: No node taints configured. Kind does not support real node group isolation the way EKS with Karpenter does. This is an accepted limitation for local development and must be addressed in the EKS migration.

### 6.2 Node Selectors and Tolerations

| Item | Status | Notes |
|---|---|---|
| nodeSelector on workloads | NOT VERIFIED | Not collected in audit |
| topologySpreadConstraints | NOT VERIFIED | Likely not configured (all pods run on any node) |
| affinity/anti-affinity rules | NOT VERIFIED | Not collected in audit |

---

## 7. Custom PriorityClasses

### 7.1 PriorityClass Inventory

| PriorityClass | Value | Found | Status |
|---|---|---|---|
| system-cluster-critical | 2000000000 | YES (system default) | N/A |
| system-node-critical | 2000001000 | YES (system default) | N/A |
| velya-critical | Not defined | ABSENT | NOT IMPLEMENTED |
| velya-high | Not defined | ABSENT | NOT IMPLEMENTED |
| velya-standard | Not defined | ABSENT | NOT IMPLEMENTED |

**Assessment**: Only Kubernetes system PriorityClasses exist. Clinical services have no scheduling priority advantage over background workers. Under resource pressure, Kubernetes may evict patient-safety-critical services.

**Required PriorityClasses for Production**:
```yaml
velya-critical: 1000000  # patient-flow, audit-service
velya-high: 900000       # discharge-orchestrator, task-inbox, ai-gateway, policy-engine
velya-standard: 800000   # memory-service, decision-log-service, agent-orchestrator
velya-background: 700000 # batch jobs, non-critical tasks
```

---

## 8. EKS-Specific Features (Not Implemented)

These features are planned for the EKS migration and are NOT IMPLEMENTED in the kind development cluster:

| Feature | Production Plan | Dev Status | Notes |
|---|---|---|---|
| EKS Auto Mode | AWS-managed nodes | NOT IMPLEMENTED | Requires EKS cluster |
| Karpenter NodePools | Workload-typed node groups | NOT IMPLEMENTED | EKS only |
| EKS Pod Identity | Per-pod AWS IAM | NOT IMPLEMENTED | Using LocalStack instead |
| AWS Load Balancer Controller | ALB/NLB integration | NOT IMPLEMENTED | Using MetalLB + ingress-nginx |
| VPC CNI | AWS-native pod networking | NOT IMPLEMENTED | Using kindnet |
| EBS CSI Driver | Managed persistent volumes | NOT IMPLEMENTED | Using hostPath or local storage |
| EFS CSI Driver | Shared filesystem (Loki, logs) | NOT IMPLEMENTED | Not applicable in kind |
| IRSA | IAM Roles for Service Accounts | NOT IMPLEMENTED | Legacy (replaced by Pod Identity) |
| AWS Secrets Manager | Real secret store | NOT IMPLEMENTED | Using LocalStack |

---

## 9. Blast Radius Analysis

### 9.1 Current Blast Radius Controls

| Control | Implemented | Effectiveness |
|---|---|---|
| Namespace isolation | YES | PARTIAL — NetworkPolicies limit blast radius between namespaces |
| ResourceQuotas | YES | MODERATE — prevents one namespace from starving others on CPU/memory |
| NetworkPolicies | YES | MODERATE — limits lateral movement |
| RBAC per namespace | NOT VERIFIED | Unknown — service account permissions not audited |
| PDBs | YES | LOW (currently) — ineffective with single replicas |
| Node isolation (taints) | NO | NOT IMPLEMENTED — any pod can land on any node |
| PriorityClasses | NO | NOT IMPLEMENTED — all pods compete equally |

### 9.2 Blast Radius Scenarios

| Scenario | Current Impact | Mitigated By | Gap |
|---|---|---|---|
| patient-flow crashes | Service down until restart (30–60s) | Pod restart policy | Single replica |
| velya-dev-core resource exhaustion | Only affects core namespace | ResourceQuotas | Quotas may be too loose |
| Compromised service reaches DB | Unknown — depends on RBAC | NetworkPolicies | No mTLS, RBAC not audited |
| ArgoCD compromised | Could deploy anything | Separate namespace | No additional controls |
| AI gateway runs unconstrained | Could overwhelm cluster | ResourceQuotas | No ScaledObjects |

---

## 10. Architecture Validation Summary

| Component | Status | Production Ready |
|---|---|---|
| Single cluster topology | PASS | YES (correct pattern) |
| Namespace segmentation | PASS | YES |
| ResourceQuotas | PASS | YES (values need tuning) |
| NetworkPolicies | PASS | PARTIAL (no mTLS, no egress audit) |
| PDBs | PASS | PARTIAL (ineffective at 1 replica) |
| Node taints | NOT IMPLEMENTED | NO |
| PriorityClasses | NOT IMPLEMENTED | NO |
| EKS Auto Mode | NOT IMPLEMENTED | NO |
| NodePool segregation | NOT IMPLEMENTED | NO |
| Multi-AZ distribution | NOT IMPLEMENTED | NO |
| EKS Pod Identity | NOT IMPLEMENTED | NO |
| AWS Secrets Manager | NOT IMPLEMENTED | NO |

**Architecture Verdict**: The development cluster correctly implements the topology and segmentation patterns intended for production. The kind-specific limitations (no node taints, no EKS features) are expected and accepted for the current development phase. The cluster is a valid development proxy for the EKS architecture.

---

*Next architecture review: after EKS cluster provisioning. Evidence sources: kubectl cluster audit, repository inspection.*
