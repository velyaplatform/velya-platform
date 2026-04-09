# Risk Register — Velya Platform Validation

**Date**: 2026-04-08
**Scope**: Risks identified from cluster audit and repository inspection
**Framework**: Likelihood × Impact (1–5 scale)
**Review Cadence**: Weekly during active development, monthly after go-live

---

## Risk Severity Matrix

| Likelihood \ Impact | 1 (Minimal) | 2 (Minor) | 3 (Moderate) | 4 (Major) | 5 (Critical) |
|---|---|---|---|---|---|
| 5 (Almost Certain) | MEDIUM | HIGH | HIGH | CRITICAL | CRITICAL |
| 4 (Likely) | LOW | MEDIUM | HIGH | HIGH | CRITICAL |
| 3 (Possible) | LOW | MEDIUM | MEDIUM | HIGH | HIGH |
| 2 (Unlikely) | LOW | LOW | MEDIUM | MEDIUM | HIGH |
| 1 (Rare) | LOW | LOW | LOW | LOW | MEDIUM |

---

## Active Risk Register

### RISK-001: No ArgoCD Applications Configured

| Field | Value |
|---|---|
| ID | RISK-001 |
| Title | ArgoCD installed but zero Applications configured — GitOps not delivering anything |
| Category | GitOps / Delivery |
| Severity | HIGH |
| Likelihood | 5 (Almost Certain — current state) |
| Impact | 4 (Major) |
| Risk Score | CRITICAL |
| Status | OPEN |
| Owner | Infrastructure Team |
| Blocks Production | YES |

**Description**:
ArgoCD is installed and running (7 pods, UI accessible at argocd.172.19.0.6.nip.io) but no ArgoCD Application CRDs exist in the cluster or in the git repository. This means:
- All 64 running pods were deployed via manual `kubectl apply` or `helm install`
- There is no GitOps delivery pipeline — changes to infra/kubernetes/ have no effect on the cluster
- Drift between git and cluster state cannot be detected
- Promotion to staging or production is impossible through GitOps

**Evidence**: `argocd app list` returns empty. No Application manifests found in `infra/argocd/`.

**Impact if Unresolved**:
- Manual deployments cannot scale to a production environment
- No rollback capability via ArgoCD
- Cannot demonstrate GitOps compliance to auditors
- Every deployment requires cluster-level kubectl access

**Remediation**:
1. Create ArgoCD Application manifests in `infra/argocd/` for each service group
2. Create a root App-of-Apps manifest pointing to `infra/argocd/`
3. Apply root app: `kubectl apply -f infra/argocd/root-app.yaml`
4. Verify ArgoCD syncs all services from git
5. Prohibit future manual kubectl applies

**Target Date**: Sprint +1 (urgent)

---

### RISK-002: No KEDA ScaledObjects — Autoscaling Not Active

| Field | Value |
|---|---|
| ID | RISK-002 |
| Title | KEDA installed but zero ScaledObjects — all services at fixed 1 replica |
| Category | Availability / Scalability |
| Severity | MEDIUM |
| Likelihood | 5 (Current state) |
| Impact | 4 (Major under load) |
| Risk Score | HIGH |
| Status | OPEN |
| Owner | Infrastructure Team |
| Blocks Production | YES |

**Description**:
KEDA (Kubernetes Event-Driven Autoscaler) is installed in the cluster but zero ScaledObjects are configured. All 13 services run at exactly 1 replica with no ability to scale under load. Combined with zero HPA configurations, this means:
- Any service experiencing load spike will become a bottleneck and potentially crash
- A single pod crash causes 100% downtime for that service until Kubernetes restarts it
- No event-driven scaling from NATS queue depth or HTTP request rate

**Evidence**: `kubectl get scaledobject -A` returns empty. `kubectl get hpa -A` returns empty.

**Impact if Unresolved**:
- Under production load, services will fail silently or become unresponsive
- No automated recovery from traffic spikes
- SLAs impossible to maintain

**Remediation**:
1. Create ScaledObject manifests for all stateless services (patient-flow, discharge, task-inbox, audit, ai-gateway, policy-engine)
2. Configure NATS-based triggers for event-driven services
3. Configure HTTP-based triggers (Prometheus metrics) for web-facing services
4. Set minimum replicas to 2 for all critical services
5. Run load tests to validate scaling thresholds

**Target Date**: Sprint +2

---

### RISK-003: No Custom PriorityClasses — No Workload Protection

| Field | Value |
|---|---|
| ID | RISK-003 |
| Title | No PriorityClasses defined — all workloads compete equally for resources |
| Category | Availability / Resource Management |
| Severity | MEDIUM |
| Likelihood | 3 (Possible under resource pressure) |
| Impact | 3 (Moderate) |
| Risk Score | MEDIUM |
| Status | OPEN |
| Owner | Infrastructure Team |
| Blocks Production | YES (for production) |

**Description**:
No custom PriorityClasses exist in the cluster (only system defaults: system-cluster-critical, system-node-critical). This means:
- Clinical services (patient-flow, discharge) have the same scheduling priority as background workers
- Under resource pressure, Kubernetes may evict critical clinical services to make room for lower-priority workloads
- No way to declare that patient-safety-critical services must not be preempted

**Evidence**: `kubectl get priorityclass` shows only system defaults. No velya-* PriorityClasses.

**Remediation**:
```yaml
# Create tiered priority classes
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-critical
value: 1000000
globalDefault: false
description: "Clinical patient-safety critical services"
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-high
value: 900000
description: "High priority platform services"
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: velya-standard
value: 800000
description: "Standard platform services"
```

**Target Date**: Sprint +2

---

### RISK-004: No Node Taints/Tolerations — No Scheduling Isolation

| Field | Value |
|---|---|
| ID | RISK-004 |
| Title | No node taints configured — workloads not isolated by type |
| Category | Availability / Security |
| Severity | LOW (dev) / HIGH (prod) |
| Likelihood | 5 (Current state — kind cluster) |
| Impact | 4 (Major for production) |
| Risk Score | LOW (dev), HIGH (prod) |
| Status | OPEN (ACCEPTED for dev) |
| Owner | Infrastructure Team |
| Blocks Production | YES (for EKS) |

**Description**:
Kind clusters do not support node group segregation the same way EKS does. No taints are configured on any node. This is an accepted limitation for local development but is a blocker for production because:
- AI workloads (GPU/high-memory) should be isolated to specific node groups
- Clinical services should not co-locate with AI inference jobs
- Cost optimization requires workload-aware scheduling

**Evidence**: `kubectl describe nodes` shows no taints. Kind limitations prevent real node group segmentation.

**Impact if Unresolved (production)**:
- AI inference workloads consume resources needed by clinical services
- Uncontrolled co-location increases blast radius
- Cannot use EKS Managed Node Groups or Karpenter NodePools effectively

**Remediation** (for EKS):
1. Define NodePools in EKS with labels and taints
2. Add tolerations to workload manifests that need specialized nodes
3. Use topologySpreadConstraints for HA across AZs

**Target Date**: EKS migration phase

---

### RISK-005: Single Replica Deployments — No High Availability

| Field | Value |
|---|---|
| ID | RISK-005 |
| Title | All services running at 1 replica — any pod restart causes service downtime |
| Category | Availability |
| Severity | HIGH |
| Likelihood | 4 (Likely to cause issues under normal operations) |
| Impact | 4 (Major — complete service outage per restart) |
| Risk Score | HIGH |
| Status | OPEN |
| Owner | Infrastructure Team |
| Blocks Production | YES |

**Description**:
All 13 Velya services are running with a single replica. Despite PDBs being configured (good), PDBs cannot protect against a rolling update or a pod crash that brings total available replicas to zero. With 1 replica:
- Any crash = 100% service downtime until Kubernetes reschedules (typically 30–60 seconds)
- Rolling updates cause downtime (no second pod to stay up during the update)
- PDBs with minAvailable: 1 become impossible to satisfy with only 1 replica

**Evidence**: `kubectl get deployments -A` — all Velya services show READY 1/1.

**Remediation**:
1. Set `replicas: 2` (minimum) for all clinical and platform services
2. Set `replicas: 3` for patient-flow (most critical clinical service)
3. Add anti-affinity rules so replicas spread across nodes
4. Combine with KEDA ScaledObjects (RISK-002) for proper autoscaling

**Target Date**: Sprint +1

---

### RISK-006: kind Cluster Only — Not Production Grade

| Field | Value |
|---|---|
| ID | RISK-006 |
| Title | Only kind cluster exists — no AWS EKS cluster provisioned |
| Category | Infrastructure / Production Readiness |
| Severity | HIGH |
| Likelihood | 5 (Current state) |
| Impact | 5 (Critical — no path to production) |
| Risk Score | CRITICAL |
| Status | OPEN |
| Owner | Infrastructure Team |
| Blocks Production | YES |

**Description**:
The entire platform runs on a local kind cluster. While kind is excellent for development, it cannot be used for production because:
- No multi-AZ redundancy (single machine)
- No persistent storage with production-grade guarantees
- No AWS IAM integration (no Pod Identity, no IRSA)
- No real AWS Secrets Manager (LocalStack only)
- No production network (no VPC, no PrivateLink, no NAT gateway)
- No managed upgrades
- No SLA or support from AWS

**Evidence**: Cluster name is `kind-velya-local`. No OpenTofu state for EKS exists (infra/opentofu has no applied state).

**Remediation**:
1. Complete OpenTofu modules for EKS cluster
2. Provision dev EKS cluster in AWS account
3. Migrate services to EKS using ArgoCD
4. Configure proper networking (VPC, subnets, security groups)
5. Replace LocalStack with real AWS Secrets Manager
6. Set up EKS Auto Mode for node lifecycle management

**Target Date**: Q2 2026

---

### RISK-007: Services Are Scaffold Code Only — No Business Logic

| Field | Value |
|---|---|
| ID | RISK-007 |
| Title | All 13 services return HTTP 200 but have no implemented business logic |
| Category | Functionality / Completeness |
| Severity | HIGH |
| Likelihood | 5 (Current state) |
| Impact | 5 (Critical — platform has no functionality) |
| Risk Score | CRITICAL |
| Status | OPEN |
| Owner | Engineering Teams |
| Blocks Production | YES |

**Description**:
All services respond to HTTP requests and are "running" in the operational sense, but the implementation is scaffold/stub code only. No clinical workflows exist:
- patient-flow: No patient admission, transfer, or discharge logic
- discharge-orchestrator: No discharge planning or orchestration
- task-inbox: No task routing, assignment, or priority logic
- audit-service: No audit trail recording
- ai-gateway: No AI provider integration
- policy-engine: No policy evaluation
- memory-service: No agent memory storage
- decision-log-service: No decision recording
- agent-orchestrator: No agent coordination

**Evidence**: Services accessible via HTTP but endpoint responses are scaffolding. No database schemas confirmed. No NATS subscriptions confirmed.

**Impact if Unresolved**:
- The platform provides zero clinical value
- Cannot run any user acceptance testing
- Cannot demonstrate HIPAA technical safeguards

**Remediation**:
Prioritized order of implementation:
1. audit-service — needed by all others for compliance
2. patient-flow — core clinical workflow
3. discharge-orchestrator — high-impact clinical optimization
4. task-inbox — clinical staff workflow
5. ai-gateway — AI platform foundation
6. policy-engine — safety and compliance
7. memory-service + decision-log-service — AI observability
8. agent-orchestrator — AI coordination

**Target Date**: Q2-Q3 2026

---

### RISK-008: No Chaos Testing

| Field | Value |
|---|---|
| ID | RISK-008 |
| Title | No chaos engineering testing performed — resilience is unproven |
| Category | Resilience / Quality |
| Severity | MEDIUM |
| Likelihood | 5 (No chaos tests done) |
| Impact | 3 (Moderate — failures will be discovered in production) |
| Risk Score | HIGH |
| Status | OPEN |
| Owner | Platform Team |
| Blocks Production | NO (but HIGH risk without it) |

**Description**:
No chaos testing has been conducted. The platform's resilience properties (circuit breakers, timeouts, graceful degradation, PDB effectiveness) have not been validated under failure conditions. Claims about resilience in ADRs and architecture docs are theoretical only.

**Evidence**: No chaos test files found. No litmus/chaos-mesh/k6 configuration present.

**Remediation**:
1. Install Chaos Mesh or LitmusChaos in dev cluster
2. Test pod kill scenarios for each service
3. Test node failure (cordon a kind node, verify service continuity)
4. Test network partition scenarios
5. Test database connection failures
6. Document all chaos test results

**Target Date**: After business logic implementation (RISK-007)

---

### RISK-009: No Operational Runbooks

| Field | Value |
|---|---|
| ID | RISK-009 |
| Title | docs/runbooks/ directory exists but contains no runbook files |
| Category | Operations |
| Severity | MEDIUM |
| Likelihood | 4 (Will cause delayed incident response) |
| Impact | 3 (Moderate — slower MTTR) |
| Risk Score | HIGH |
| Status | OPEN |
| Owner | Platform Team |
| Blocks Production | YES |

**Description**:
No operational runbooks exist. When services fail, on-call engineers have no documented procedures for diagnosis, triage, or recovery. This increases mean time to recovery (MTTR) and creates dependency on specific individuals who hold tribal knowledge.

**Evidence**: `ls docs/runbooks/` returns empty. No runbook files found in repository.

**Impact if Unresolved**:
- Incidents take longer to resolve
- Junior engineers cannot respond independently
- Post-incident reviews cannot compare actual vs. expected response
- Compliance auditors will flag missing procedures

**Remediation**:
See `docs/runbooks/service-health-runbook.md` and `docs/runbooks/observability-runbook.md` (created in this validation run). Additional runbooks needed:
- ArgoCD sync failure runbook
- Database connection failure runbook
- NATS partition runbook
- Certificate expiry runbook
- Secret rotation runbook

**Target Date**: Sprint +1

---

### RISK-010: No TLS on Any Ingress

| Field | Value |
|---|---|
| ID | RISK-010 |
| Title | All 13 Ingresses are HTTP only — plaintext traffic |
| Category | Security |
| Severity | HIGH |
| Likelihood | 5 (Current state) |
| Impact | 4 (Major — HIPAA requires encryption in transit) |
| Risk Score | CRITICAL |
| Status | OPEN |
| Owner | Security Team |
| Blocks Production | YES |

**Description**:
All 13 Ingress resources use HTTP without TLS. While this is acceptable for local kind development (nip.io URLs), it establishes a pattern that must not be carried forward. HIPAA requires encryption of PHI in transit. No clinical system may operate with plaintext HTTP.

**Evidence**: Ingress inspection shows no `tls:` sections in any Ingress resource.

**Remediation**:
1. Install cert-manager in cluster
2. Configure ClusterIssuer (self-signed for dev, ACME/Let's Encrypt for staging/prod)
3. Add `tls:` blocks to all Ingress resources
4. Enforce HTTPS redirect

**Target Date**: Sprint +2 (must be done before any clinical data handling)

---

## Risk Summary Table

| ID | Title | Severity | Status | Blocks Prod |
|---|---|---|---|---|
| RISK-001 | No ArgoCD Applications | CRITICAL | OPEN | YES |
| RISK-002 | No KEDA ScaledObjects | HIGH | OPEN | YES |
| RISK-003 | No PriorityClasses | MEDIUM | OPEN | YES (prod) |
| RISK-004 | No Node Taints | LOW/HIGH | ACCEPTED (dev) | YES (prod) |
| RISK-005 | Single Replica Deployments | HIGH | OPEN | YES |
| RISK-006 | kind Cluster Only | CRITICAL | OPEN | YES |
| RISK-007 | Scaffold Code Only | CRITICAL | OPEN | YES |
| RISK-008 | No Chaos Testing | MEDIUM | OPEN | NO |
| RISK-009 | No Runbooks | MEDIUM | OPEN | YES |
| RISK-010 | No TLS on Ingresses | CRITICAL | OPEN | YES |

---

## Risk Remediation Priority

```
P0 (Must fix before any clinical work):
  RISK-007 — No business logic
  RISK-010 — No TLS

P1 (Must fix before production):
  RISK-001 — No ArgoCD apps
  RISK-005 — Single replicas
  RISK-006 — kind cluster only
  RISK-002 — No KEDA

P2 (Fix before production):
  RISK-003 — No PriorityClasses
  RISK-009 — No runbooks

P3 (Fix before go-live):
  RISK-004 — Node taints (EKS)
  RISK-008 — Chaos testing
```

---

*Risk register owned by: Platform Architect + Security Reviewer. Review weekly until all P0/P1 risks are resolved.*
