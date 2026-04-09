# Invalidated Assumptions — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Purpose**: Formal record of assumptions that evidence has proven to be false. These are not merely risks — they are confirmed facts that contradict the original design or operational assumptions. Each entry must include the required change and its status.  
**Source**: Cluster validation audit conducted 2026-04-08  

---

## Why This Document Matters

Invalidated assumptions are more dangerous than unvalidated assumptions because the platform may have been designed, built, or configured based on something believed to be true that is actually false. The consequences include:

- Security controls that are configured but provide no actual protection
- Operational procedures that assume a capability that does not exist  
- Clinical workflows that depend on services that are not implemented
- Compliance claims that cannot be substantiated

Each invalidated assumption must result in a concrete required change. This document is the authoritative record of what was believed and what was found.

---

## Invalidated Assumption 1: Services Are Operational

| Field | Value |
|---|---|
| **Assumption ID** | TECH-002 |
| **Original Assumption** | All 13 Velya HTTP services are running functional business logic |
| **Who Held This Assumption** | Platform team; derived from the presence of running pods and HTTP 200 responses |
| **Evidence That Contradicts It** | Repository code inspection reveals: patient-flow-service, discharge-orchestrator, task-inbox-service, audit-service, ai-gateway, policy-engine, memory-service, decision-log-service, and agent-orchestrator are all scaffold implementations. NestJS services return HTTP 200 from health endpoints but have no implemented business logic endpoints beyond health checks. No FHIR integration code exists. No Medplum client calls exist. No NATS publishers or subscribers are implemented. All services are identical NestJS bootstrapped templates with service-specific naming only. |
| **Validation Date** | 2026-04-08 |
| **Validation Method** | Source code inspection of `services/`, `platform/` directories; API endpoint probing beyond /health |
| **Impact of Invalidation** | The entire clinical value proposition of Velya is unimplemented. No service performs any clinical function. The platform is a deployment scaffold with no operational capability. All designs, runbooks, and documentation that assume service functionality are premature. |
| **Required Change** | Implement business logic in priority order: (1) patient-flow-service FHIR integration, (2) discharge-orchestrator Temporal workflow, (3) task-inbox-service task routing, (4) ai-gateway LLM integration, (5) audit-service audit trail. Each service requires a feature delivery sprint. |
| **Owner** | Clinical Team + Platform Team |
| **Status** | Open — no implementation work begun as of 2026-04-08 |
| **Fallback** | Platform is development-only until business logic is implemented. No clinical staff should use the platform in its current state for any clinical purpose. |

---

## Invalidated Assumption 2: GitOps Is Working

| Field | Value |
|---|---|
| **Assumption ID** | TECH-003 |
| **Original Assumption** | ArgoCD is actively delivering Kubernetes manifests from the git repository to the cluster, providing GitOps-controlled deployment |
| **Who Held This Assumption** | Platform team; ArgoCD is installed and accessible at argocd.172.19.0.6.nip.io; assumed it was configured |
| **Evidence That Contradicts It** | `argocd app list` returns empty. Zero ArgoCD Application CRDs exist in the cluster. Zero ArgoCD Application manifests exist in the `infra/argocd/` directory. The 64 pods running in the cluster were all deployed via manual `kubectl apply` or `helm install` commands. There is no git-to-cluster synchronization. The cluster state cannot be reproduced from the git repository alone. |
| **Validation Date** | 2026-04-08 |
| **Validation Method** | `argocd app list` (empty); `kubectl get applications -A` (no resources); `ls infra/argocd/` (directory missing) |
| **Impact of Invalidation** | GitOps compliance cannot be claimed. There is no automated delivery pipeline for infrastructure changes. Cluster state may diverge from git at any time without detection. Drift cannot be detected. Rollback is not available via ArgoCD. Promoting changes to staging or production is impossible through the GitOps mechanism. Any deployment requires cluster-level kubectl access, which is a security risk. |
| **Required Change** | (1) Create `infra/argocd/` directory with Application manifests per service group. (2) Create root App-of-Apps manifest. (3) Apply root app: `kubectl apply -f infra/argocd/root-app.yaml`. (4) Verify ArgoCD syncs all services. (5) Prohibit further manual kubectl applies via documentation and policy. (6) Enable ArgoCD self-heal and prune. |
| **Owner** | Infrastructure Team |
| **Status** | Open — CRITICAL blocker |
| **Fallback** | All deployments must be manually tracked in a deployment log until GitOps is implemented. Manual deployments must be reviewed by a second engineer before execution. |

---

## Invalidated Assumption 3: Frontend Is Functional

| Field | Value |
|---|---|
| **Assumption ID** | Derived from general "services are operational" assumption |
| **Original Assumption** | The velya-web Next.js frontend provides a functional hospital operations UI enabling clinical staff to manage patient flow, discharge coordination, and task routing |
| **Who Held This Assumption** | Frontend team; the service returns HTTP 200 and displays a rendered page |
| **Evidence That Contradicts It** | Frontend functional assessment score: 8/100. The deployed frontend consists of a homepage with three feature cards (Patient Flow, Discharge Management, Task Inbox) with no interactive functionality. No authentication exists. No routing to clinical workflow pages. No API integration. No real-time data. No role-based access. No patient data is displayed. The homepage is a marketing placeholder, not a clinical application. |
| **Validation Date** | 2026-04-08 |
| **Validation Method** | `docs/validation/frontend-revolution-validation.md`; direct HTTP access to velya.172.19.0.6.nip.io; source code inspection of `apps/web/` |
| **Impact of Invalidation** | The primary interface for clinical staff does not exist. No nurse, physician, or administrator can use Velya for any clinical purpose. There is no authentication — any network user can access the site and see what exists (which is minimal, but the absence of auth is itself a gap). |
| **Required Change** | Full frontend implementation required: (1) Authentication via OIDC (Okta/Azure AD). (2) Role-based workspace design (nurse view, physician view, admin view). (3) Patient census component with real-time FHIR data. (4) Discharge workflow UI. (5) Task inbox UI. (6) Clinical alert display. All seven patient-facing workflows identified in the product spec must be implemented before clinical use. |
| **Owner** | Frontend Team |
| **Status** | Open — CRITICAL blocker |
| **Fallback** | No fallback — clinical staff cannot use the platform until the frontend is implemented. |

---

## Invalidated Assumption 4: Tests Cover the Code

| Field | Value |
|---|---|
| **Assumption ID** | Derived from "CI pipeline is green" assumption |
| **Original Assumption** | The test suite provides meaningful coverage of Velya business logic, enabling confident deployment and change |
| **Who Held This Assumption** | All engineering teams; CI is configured with a test step and it passes |
| **Evidence That Contradicts It** | `tests/` directory contains exactly 1 file: `tests/unit/platform.test.ts`. This file contains a single stub test (`it('should be true', () => expect(true).toBe(true))`). This test always passes regardless of any code change. There are no unit tests for any service. There are no integration tests. There are no end-to-end tests. There are no contract tests for NATS event schemas. The CI "tests pass" badge reflects a passing stub, not actual code verification. |
| **Validation Date** | 2026-04-08 |
| **Validation Method** | `ls tests/` (1 file); `cat tests/unit/platform.test.ts` (stub test); `grep -r "describe\|it\|test(" services/ --count` (0 results) |
| **Impact of Invalidation** | Any code change may introduce regressions with no automated detection. Clinical logic bugs will not be caught before deployment. The CI green badge provides false assurance of code quality. Refactoring without test coverage is unsafe. No proof-of-correctness exists for any service, agent, or workflow. |
| **Required Change** | (1) Establish minimum coverage gate: 80% line coverage for services, 90% for clinical-critical code paths. (2) Write unit tests for each service as business logic is implemented. (3) Write integration tests for service-to-service workflows. (4) Write E2E tests for all clinical workflow scenarios. (5) Add Playwright tests for all critical frontend interactions. (6) Add contract tests for all NATS subjects. |
| **Owner** | Quality Team (shared across Clinical, Platform, Frontend) |
| **Status** | Open — production blocker |
| **Fallback** | No code change may be deployed to staging or production until the changed code has corresponding tests that pass. This is a hard gate enforced via CI. |

---

## Invalidated Assumption 5: kindnet Enforces NetworkPolicy

| Field | Value |
|---|---|
| **Assumption ID** | TECH-001 |
| **Original Assumption** | The kindnet CNI plugin in the kind cluster enforces Kubernetes NetworkPolicy objects, providing pod-to-pod traffic isolation between namespaces and within namespaces |
| **Who Held This Assumption** | Security team; Network Policy objects were created and the validation matrix showed them as PASS for "NetworkPolicies configured" |
| **Evidence That Contradicts It** | kindnet, the default CNI for kind clusters, does NOT implement Kubernetes NetworkPolicy. NetworkPolicy objects can be created and kubectl accepts them, but they are silently ignored at the network level. Traffic flows freely between all pods regardless of NetworkPolicy configuration. This is a documented limitation of kindnet. The 12 NetworkPolicy objects in the cluster (backend-tier, frontend-tier, platform-tier, AI tier) provide zero actual traffic restriction. |
| **Validation Date** | 2026-04-08 |
| **Validation Method** | Test: `kubectl exec -it pod-in-velya-dev-web -- curl http://patient-flow.velya-dev-core.svc.cluster.local/health` while a deny NetworkPolicy is in place — request succeeds when it should be blocked. kindnet documentation confirms no NetworkPolicy enforcement. |
| **Impact of Invalidation** | **The security model for the dev cluster is completely different from what was believed.** Any compromised pod in any namespace can reach any other pod in any namespace without restriction. All 12 NetworkPolicy objects that were counted as security controls are ineffective. The Security section of the validation scorecard showing "NetworkPolicies configured — PASS" is misleading — configured ≠ enforced. Lateral movement after any pod compromise is unrestricted. |
| **Required Change** | Immediate (dev): (1) Replace kindnet with Calico CNI for kind cluster to provide NetworkPolicy enforcement in development. Use `kind create cluster --config kind-config-calico.yaml`. (2) Update all documentation to note that the dev cluster previously had no NetworkPolicy enforcement. (3) Run NetworkPolicy enforcement test suite to verify Calico enforces policies correctly. For EKS: (4) Ensure EKS is deployed with Amazon VPC CNI + NetworkPolicy support or Calico/Cilium. (5) Re-test all NetworkPolicy rules after CNI replacement. |
| **Owner** | Infrastructure Team |
| **Status** | Open — CRITICAL security gap |
| **Fallback** | Until CNI is replaced: assume all pods can communicate freely. Do not rely on NetworkPolicy as a security control. Apply compensating controls: mutual TLS for service authentication, NATS per-subject authorization, remove any unnecessary cross-namespace service references. |

---

## Invalidated Assumption 6: Observability Covers the Application

| Field | Value |
|---|---|
| **Assumption ID** | Derived from "Prometheus running with 12 ServiceMonitors" finding |
| **Original Assumption** | The observability stack provides visibility into Velya application health, enabling detection of service degradation and alerting on abnormal conditions |
| **Who Held This Assumption** | Operations team; Prometheus, Grafana, Loki are all running; 12 ServiceMonitors are configured |
| **Evidence That Contradicts It** | All 12 ServiceMonitors scrape infrastructure components only: Prometheus itself, Grafana, NATS, Temporal, PostgreSQL, Kubernetes nodes. Zero ServiceMonitors exist for Velya application services (patient-flow-service, discharge-orchestrator, task-inbox-service, ai-gateway, etc.). No Velya service exposes a /metrics endpoint. No custom Prometheus alert rules exist for Velya services. No Grafana dashboards exist for Velya services. No SLO tracking. The observability score is 80/100 for infrastructure and 0% for application. |
| **Validation Date** | 2026-04-08 |
| **Validation Method** | `kubectl get servicemonitor -A` (only infrastructure monitors); Grafana dashboard inventory (no Velya dashboards); `kubectl get prometheusrule -A` (only infrastructure rules) |
| **Impact of Invalidation** | No clinical service health is monitored. A complete failure of patient-flow-service would not trigger any alert. There is no visibility into request rates, error rates, latency, or queue depths for any Velya service. The operational team cannot diagnose issues in clinical services using the existing observability stack. |
| **Required Change** | (1) Add `prom-client` metrics instrumentation to all NestJS services (request count, error rate, latency histograms, custom clinical metrics). (2) Create ServiceMonitor per Velya service. (3) Create Prometheus alert rules for each service (error rate, latency, absence-of-scrape). (4) Create Grafana dashboard per service domain (clinical, platform, AI). (5) Implement SLO tracking for clinical services. |
| **Owner** | Platform Team + Ops |
| **Status** | Open — production blocker |
| **Fallback** | Manual health checking of services via kubectl describe / logs. Not scalable for production. |

---

## Invalidated Assumption 7: KEDA Provides Autoscaling

| Field | Value |
|---|---|
| **Assumption ID** | TECH-014 |
| **Original Assumption** | KEDA provides event-driven autoscaling for Velya services based on NATS message lag and other operational metrics |
| **Who Held This Assumption** | Infra team; KEDA is deployed and running in the cluster |
| **Evidence That Contradicts It** | KEDA has zero ScaledObjects configured. All 13 Velya services run at exactly 1 replica. KEDA is operational software that is currently doing nothing. No service will scale under any load condition. |
| **Validation Date** | 2026-04-08 |
| **Validation Method** | `kubectl get scaledobjects -A` (empty); `kubectl get hpa -A` (empty) |
| **Impact of Invalidation** | Under hospital-scale admission surges (Monday morning, post-holiday, emergency events), Velya services will be saturated at 1 replica with no automatic relief. Clinical operations will degrade. The architecture's claimed autoscaling capability is unimplemented. |
| **Required Change** | (1) Define KEDA ScaledObjects for all clinical services using NATS consumer lag as primary trigger. (2) Define HPA for CPU-based scaling for api-gateway and velya-web. (3) Set min/max replica counts based on load testing results. (4) Test scale-up under simulated load. |
| **Owner** | Infrastructure Team |
| **Status** | Open |
| **Fallback** | Manual replica scaling via `kubectl scale deployment` during known load events. Not sustainable. |

---

## Invalidated Assumption Summary

| ID | Assumption | Invalidation Severity | Required Change Status |
|---|---|---|---|
| TECH-002 | Services are operational | Catastrophic | Open — not started |
| TECH-003 | GitOps is working | Critical | Open — not started |
| FE-001 | Frontend is functional | Catastrophic | Open — not started |
| TEST-001 | Tests cover the code | Critical | Open — not started |
| TECH-001 | kindnet enforces NetworkPolicy | Critical | Open — not started |
| OBS-001 | Observability covers application | High | Open — not started |
| TECH-014 | KEDA provides autoscaling | High | Open — not started |

**All 7 invalidated assumptions have required changes that are open and not started as of 2026-04-08.**

The most dangerous invalidated assumption is TECH-001 (kindnet NetworkPolicy) because the security team may have continued making decisions based on the belief that network isolation was enforced. All security architecture decisions made under that assumption must be re-evaluated.

---

*When any assumption in the assumption-log.md is invalidated by evidence, it must be moved to this document within 24 hours of the evidence being discovered. The required change must be tracked as a blocker in the project tracker.*
