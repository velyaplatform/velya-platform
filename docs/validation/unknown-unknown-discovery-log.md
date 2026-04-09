# Unknown-Unknown Discovery Log
**Velya Hospital AI Platform**
**Document Type:** Risk Discovery Log
**Date:** 2026-04-08
**Classification:** Internal — Restricted
**Discovery Method:** Blind spot review, red team assumption challenge, platform archaeology

---

## Overview

This log records risks that were genuinely unknown before structured discovery — not risks that were known and deferred, but risks that were invisible because an incorrect assumption masked them. Each entry explains what assumption created the blind spot and why the risk could not have been found by reviewing existing documentation or test results.

The distinction matters: a known-unknown can be tracked in a risk register. An unknown-unknown means your risk register has a systematic gap that will produce more of the same class of finding.

---

## Discoveries

---

### UU-001 — kindnet CNI Does Not Enforce NetworkPolicy

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Assumption challenge: "What actually enforces NetworkPolicy in kind?" |
| **Category** | Infrastructure / Network Security |
| **Description** | All NetworkPolicy objects in the Velya repository are accepted by the Kubernetes API server and appear valid when listed with `kubectl get networkpolicy -A`. They have no effect whatsoever. kindnet, the default CNI for kind clusters, does not implement the NetworkPolicy API. All pod-to-pod traffic is unrestricted regardless of what NetworkPolicy resources are defined. |
| **Why It Was Unknown Before** | The assumption was: "we have NetworkPolicy manifests → we have network segmentation." The gap between defining a policy and enforcing a policy was invisible because `kubectl get networkpolicy` returns the objects without any indication of whether they are enforced. There is no warning in the kind documentation displayed during cluster creation. |
| **Impact If Not Addressed** | Zero network isolation between namespaces. Any pod can reach any other pod, including PostgreSQL at 5432, NATS at 4222, and the ai-gateway at 3010. Compromised pod has unrestricted lateral movement. The entire microservices security boundary is absent. |
| **Priority** | Critical |
| **Owner** | Infra |
| **Status** | Open — remediation requires replacing kindnet with Calico or Cilium |

---

### UU-002 — nginx-ingress with hostNetwork=true Cannot Reach Pod IPs Directly in kind

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Platform archaeology: debugging velya-web ingress connectivity |
| **Category** | Infrastructure / Networking |
| **Description** | When nginx-ingress is deployed with `hostNetwork: true` in kind (as required for MetalLB to expose it on the host's 172.19.0.0/16 network), the nginx process runs in the host network namespace. From that namespace, pod IPs (10.244.x.x) are not directly reachable via normal pod networking. Ingress rules that proxy directly to pod IPs fail silently — requests reach nginx but cannot be forwarded. The fix requires configuring nginx-ingress with `use-service-upstream: "true"` annotation, forcing it to use Service ClusterIPs (which are accessible) rather than pod IPs. Without this annotation, services are unreachable through ingress despite the ingress rule being correctly defined. |
| **Why It Was Unknown Before** | nginx-ingress documentation describes pod-direct proxying as default behavior. The kind-specific networking interaction between hostNetwork and pod CIDR routing is not surfaced in standard ingress configuration guides. The failure mode (ingress rule accepted, backend not reachable) looks identical to a misconfigured upstream. |
| **Impact If Not Addressed** | velya-web and any other service exposed via nginx-ingress is unreachable. All ingress traffic silently fails at the proxy step. This was masked during initial setup because the workaround was applied before a systematic root cause was identified. |
| **Priority** | High |
| **Owner** | Infra |
| **Status** | Mitigated (workaround applied) — but undocumented; any new ingress service will hit this again |

---

### UU-003 — NATS JetStream Default Configuration Has No Deduplication Window

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Blind spot review: "What happens to NATS events during a retry storm?" |
| **Category** | Data / Clinical Safety |
| **Description** | NATS JetStream has a built-in deduplication mechanism based on `Nats-Msg-Id` headers and a configurable `duplicate_window` per stream. In Velya's current Helm configuration, no `duplicate_window` is set on any stream. The default value is 2 minutes. This means duplicate detection only functions within a 2-minute window. Any retry that occurs more than 2 minutes after the original publish will be processed as a new, distinct message. For clinical events (admission, discharge, lab result), this is too short for scenarios involving service restarts or prolonged partition recovery. |
| **Why It Was Unknown Before** | NATS was validated as "running and delivering messages." The deduplication behavior is a stream configuration detail not surfaced by standard connectivity testing. |
| **Impact If Not Addressed** | Duplicate clinical events after any service disruption longer than 2 minutes. Duplicate discharge triggers, duplicate admission records, duplicate task creation. |
| **Priority** | High |
| **Owner** | Platform |
| **Status** | Open |

---

### UU-004 — External Secrets Operator with LocalStack Uses Fake Credentials That Will Not Transfer to Real AWS

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Assumption challenge: "What happens when this is pointed at real AWS Secrets Manager?" |
| **Category** | Infrastructure / Security |
| **Description** | The External Secrets Operator (ESO) ClusterSecretStore in the dev environment is configured to point at LocalStack with `key: test, secret: test`. All secret references in Kubernetes manifests are written against this fake store. When the platform is promoted to EKS with real AWS Secrets Manager, every ExternalSecret object will need to be re-evaluated because: (1) LocalStack secret paths may not match real AWS paths, (2) IAM role-based authentication replaces access key auth, (3) the ClusterSecretStore definition changes completely. The dev configuration creates an invisible assumption that the secrets integration is "solved" when it is only solved for the fake provider. |
| **Why It Was Unknown Before** | ESO was deployed and secrets are being resolved successfully in dev. The gap between the fake provider and the real provider is not visible during development. |
| **Impact If Not Addressed** | Complete secret injection failure on first EKS deployment. Services fail to start because they cannot resolve secrets. Potentially worse: if LocalStack-style access keys are accidentally used in production configuration, static long-lived credentials end up in EKS. |
| **Priority** | High |
| **Owner** | Infra / Security |
| **Status** | Open — will not be visible until EKS deployment attempt |

---

### UU-005 — Loki Log Retention Not Configured — Logs Roll Off During Long Incidents

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Blind spot review: "How long do we retain logs for incident forensics?" |
| **Category** | Observability / Compliance |
| **Description** | Loki is deployed via the `loki-6.55.0` Helm chart with default configuration. Default Loki retention in the monolithic deployment mode is typically 24-168 hours depending on storage configuration. No explicit `retention_period` is set in the Velya Helm values. For a hospital platform, HIPAA requires audit logs to be retained for a minimum of 6 years. Clinical incident investigation may require logs from days or weeks before the incident was identified. Currently, logs will roll off before they can be reviewed in any realistic incident scenario. |
| **Why It Was Unknown Before** | Loki was validated as "running and showing logs." Retention policy is a configuration concern, not a connectivity concern, and was not included in the observability validation checklist. |
| **Impact If Not Addressed** | HIPAA audit log retention violation (45 CFR §164.312(b)). Forensic investigation of clinical incidents impossible if logs are older than the retention window. Inability to reconstruct agent decision chains for regulatory review. |
| **Priority** | High |
| **Owner** | Ops / Compliance |
| **Status** | Open |

---

### UU-006 — OTel Collector Has No Sampling Configuration — 100% Trace Collection at Scale Is Financially Catastrophic

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Assumption challenge: "What does 100% trace sampling cost at 1000 requests/minute?" |
| **Category** | Economic / Infrastructure |
| **Description** | The OTel Collector (opentelemetry-collector-0.148.0) is deployed with default configuration, which typically collects 100% of traces. In a hospital operations platform processing high volumes of clinical events, patient interactions, and AI inference calls, 100% trace collection will generate trace volumes that exceed the storage capacity of the current Loki/Grafana Tempo setup and create prohibitive cost if shipped to a cloud backend. The platform has no tail-based sampling policy, no head-based sampling rate, and no sampling decision logic configured. |
| **Why It Was Unknown Before** | Tracing was validated as "working" — traces appear in Grafana. Volume and cost implications of 100% sampling are only visible at production scale, not in low-traffic dev. |
| **Impact If Not Addressed** | Storage exhaustion or cloud observability cost explosion at production scale. Alternatively: traces dropped silently when storage fills, which removes forensic visibility exactly when it's needed most. |
| **Priority** | Medium |
| **Owner** | Ops / Infra |
| **Status** | Open |

---

### UU-007 — KEDA v2.19.0 Has No ScaledObjects — Services Are Statically Sized

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Inventory check: "What are KEDA's current ScaledObjects?" |
| **Category** | Infrastructure / Resilience |
| **Description** | KEDA v2.19.0 is running and healthy. Zero ScaledObjects are defined. All Velya services run at static replica counts (typically 1). The autoscaling architecture described in platform documentation — scale patient-flow-service on NATS consumer lag, scale task-inbox-service on queue depth — is entirely unimplemented. During a patient surge event (e.g., mass casualty incident, shift change with high activity), services will not scale and will queue or shed load. |
| **Why It Was Unknown Before** | KEDA's presence was validated ("KEDA is running"). Its purpose (autoscaling) was assumed to be its function. The distinction between "KEDA is installed" and "KEDA has active ScaledObjects doing anything" was not checked. |
| **Impact If Not Addressed** | Service overload during surge events. patient-flow-service and task-inbox-service will drop requests or introduce unacceptable latency at the exact moment clinical throughput is highest. |
| **Priority** | High |
| **Owner** | Infra |
| **Status** | Open — noted in project state as pending |

---

### UU-008 — PostgreSQL Running Without Connection Pooling — PgBouncer Absent

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Architecture review: "What manages PostgreSQL connection limits across 9 services?" |
| **Category** | Infrastructure / Data |
| **Description** | PostgreSQL is deployed directly (postgres:16.4-alpine). No connection pooler (PgBouncer, pgpool-II) is configured. Each NestJS service maintains its own connection pool via TypeORM or similar ORM. With 9 services, each potentially maintaining 5-20 connections, the total connection count can reach 180+ at peak. PostgreSQL's default `max_connections` is 100. Under normal service operation, the database is already at risk of connection exhaustion without any unusual load. |
| **Why It Was Unknown Before** | PostgreSQL was validated as "running." Individual service connection pool sizes were not audited. The aggregate connection count across all services was not calculated. |
| **Impact If Not Addressed** | Connection exhaustion causes all services to fail DB queries simultaneously. Unlike a single service failure, DB connection exhaustion is a platform-wide outage. Clinical data is unavailable to all services. |
| **Priority** | High |
| **Owner** | Infra / Platform |
| **Status** | Open |

---

### UU-009 — ArgoCD Using Default admin Password — Rotation Not Automated

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Security review: "How is ArgoCD admin access controlled?" |
| **Category** | Security / Access Control |
| **Description** | ArgoCD is deployed with the initial admin password set by `argocd admin initial-password -n argocd`. This password is stored in a Kubernetes Secret (`argocd-initial-admin-secret`) in the argocd namespace. The platform documentation references this command as the recovery mechanism. There is no evidence of: (1) the initial password being changed post-install, (2) SSO integration with any identity provider, (3) the initial admin secret being deleted after first use (as ArgoCD recommends). Any user with read access to the argocd namespace can retrieve the admin password. |
| **Why It Was Unknown Before** | ArgoCD was validated as "running with access via port-forward." The authentication security posture of ArgoCD itself was not part of the security baseline review. |
| **Impact If Not Addressed** | Unauthorized ArgoCD access = ability to modify all Kubernetes deployments, including clinical services. Full platform compromise via GitOps controller. |
| **Priority** | High |
| **Owner** | Infra / Security |
| **Status** | Open |

---

### UU-010 — Grafana Admin Credentials Are Helm Chart Defaults — Exposed in Values

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Credential audit: "Where are Grafana credentials defined and stored?" |
| **Category** | Security / Access Control |
| **Description** | Grafana admin credentials (`admin / prom-operator`) are the kube-prometheus-stack Helm chart defaults. These credentials appear in project memory documentation (project_velya_platform_state.md) in plain text. They have not been rotated since initial deployment. The credentials are widely known as defaults for this Helm chart and would be the first tried by any attacker with access to the Grafana endpoint. |
| **Why It Was Unknown Before** | Grafana was validated as "accessible with credentials." The security concern is not in the credential existence but in their predictability and rotation status. |
| **Impact If Not Addressed** | Grafana access exposes all platform dashboards, metrics, and alert state. An attacker can observe platform performance, identify service availability windows, and time attacks to coincide with monitored blind spots. |
| **Priority** | Medium |
| **Owner** | Ops / Security |
| **Status** | Open |

---

### UU-011 — NATS JetStream Streams Have No max_msgs or max_bytes Limit

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Blind spot review: "What happens to NATS streams if consumers are slow for an extended period?" |
| **Category** | Infrastructure / Data |
| **Description** | NATS JetStream streams are created without `max_msgs` or `max_bytes` limits in the current Helm configuration. A slow consumer (e.g., discharge-orchestrator experiencing latency due to AI inference timeouts) will cause the stream to grow unbounded. In a kind cluster with limited disk, this will eventually consume all available storage on the NATS pod's PersistentVolume and crash NATS, taking down all event-driven communication on the platform. |
| **Why It Was Unknown Before** | NATS was validated as "running and delivering messages." Stream growth limits are a configuration detail only relevant over time or under load. The risk is invisible in steady-state low-traffic operation. |
| **Impact If Not Addressed** | NATS storage exhaustion causes complete messaging layer failure. All services dependent on NATS (all of them) stop receiving events. Platform-wide clinical outage. |
| **Priority** | High |
| **Owner** | Platform / Infra |
| **Status** | Open |

---

### UU-012 — No Pod Disruption Budgets — Rolling Restarts Can Take All Replicas Down

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Resilience review: "What prevents a node drain from taking patient-flow-service to zero replicas?" |
| **Category** | Infrastructure / Resilience |
| **Description** | No PodDisruptionBudget (PDB) resources are defined for any Velya service. Most services run with 1 replica. During node maintenance (drain), cluster upgrade, or scale-down, Kubernetes can evict all pods of a single-replica service simultaneously, creating a service outage. Even if a service runs with 2 replicas, without a PDB, both can be evicted at once. For a hospital platform, any service outage — including one caused by routine maintenance — is a clinical risk. |
| **Why It Was Unknown Before** | PDBs are an operational hardening concern that only matters when cluster maintenance occurs. During development with no planned node drains, their absence has no observable effect. |
| **Impact If Not Addressed** | A planned cluster upgrade causes a complete patient-flow-service outage. No automated protection. Maintenance windows must be manually coordinated, which is operationally fragile. |
| **Priority** | High |
| **Owner** | Infra |
| **Status** | Open |

---

### UU-013 — agent-orchestrator Has No Resource Limits — Can Exhaust Node Memory

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Security review: "What prevents an agent from accumulating unbounded context?" |
| **Category** | Infrastructure / Security |
| **Description** | The agent-orchestrator pod spec has no `resources.limits.memory` set. AI agent context windows accumulate conversation history, patient context, runbook content, and tool call results. A poorly controlled agent handling a complex multi-step workflow can accumulate a very large in-memory context. Without a memory limit, this can consume all available memory on the node, triggering OOM conditions that kill other pods on the same node — including clinical services. |
| **Why It Was Unknown Before** | Resource limit absence is only dangerous at the boundary conditions. During scaffold-stage testing with no real LLM calls, context size is negligible. The risk becomes real when business logic is implemented and real patient data is in context. |
| **Impact If Not Addressed** | Agent processing a large clinical history causes an OOM event that kills patient-flow-service or task-inbox-service on the same node. Clinical services become unavailable due to an AI processing event. |
| **Priority** | Medium |
| **Owner** | Infra / Platform |
| **Status** | Open |

---

### UU-014 — velya-web Has No Content Security Policy — XSS Attack Surface Open

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Frontend security audit: "What browser-level protections does velya-web have?" |
| **Category** | Frontend / Security |
| **Description** | velya-web (Next.js) has no Content-Security-Policy (CSP) header configured. In the absence of CSP, any XSS vulnerability (including those injected via patient name, clinical note, or AI recommendation text rendered in the UI) can execute arbitrary JavaScript in the clinician's browser. Given that velya-web will contain sensitive patient data and is used by clinical staff with potentially elevated system access, a successful XSS attack can extract session tokens, patient data, and inject malicious actions into the clinical interface. |
| **Why It Was Unknown Before** | CSP is an HTTP security header, not a functional concern. Functional testing of the frontend does not check security headers. The Next.js default configuration does not include CSP. |
| **Impact If Not Addressed** | Reflected or stored XSS in any patient-facing text field gives an attacker code execution in every clinician's browser. Session token theft. Patient data exfiltration. Malicious clinical actions disguised as legitimate user input. |
| **Priority** | High |
| **Owner** | Frontend / Security |
| **Status** | Open |

---

### UU-015 — LocalStack Pro License Key Visible in Plain Text in Project Memory

| Field | Value |
|---|---|
| **Discovery Date** | 2026-04-08 |
| **Discovery Method** | Security review of project memory documents |
| **Category** | Security / Secrets Management |
| **Description** | The LocalStack Pro license key (`ls-JOKe7025-8736-lIvE-rABu-FiPuLudAb65e`) is stored in plain text in `project_velya_platform_state.md`, a memory file stored in the Claude project directory. This file is not encrypted and is readable by anyone with access to the filesystem path `~/.claude/projects/`. While this is a development license key and not a clinical credential, it establishes a pattern of storing sensitive keys in documentation files. If this pattern propagates to actual clinical credentials, patient data, or production API keys, the consequences are severe. |
| **Why It Was Unknown Before** | Memory files are functional documentation, not considered a credential store. The license key was recorded for convenience. The security classification of this file was not evaluated. |
| **Impact If Not Addressed** | License key theft (low direct impact for LocalStack). More critically: establishes a pattern that will be followed for higher-value secrets, eventually leading to a production credential in a documentation file. |
| **Priority** | Medium |
| **Owner** | Security / Ops |
| **Status** | Open — key should be removed from memory file and stored in a secrets manager |

---

## Discovery Summary

| ID | Title | Priority | Status |
|---|---|---|---|
| UU-001 | kindnet CNI does not enforce NetworkPolicy | Critical | Open |
| UU-002 | nginx-ingress hostNetwork cannot reach pod IPs in kind | High | Mitigated (undocumented) |
| UU-003 | NATS JetStream default deduplication window too short | High | Open |
| UU-004 | ESO LocalStack fake credentials won't transfer to real AWS | High | Open |
| UU-005 | Loki retention not configured — logs roll off | High | Open |
| UU-006 | OTel Collector 100% sampling — no sampling policy | Medium | Open |
| UU-007 | KEDA running with zero ScaledObjects | High | Open |
| UU-008 | PostgreSQL without connection pooler | High | Open |
| UU-009 | ArgoCD default admin password not rotated | High | Open |
| UU-010 | Grafana default credentials not rotated | Medium | Open |
| UU-011 | NATS streams have no max_msgs/max_bytes limits | High | Open |
| UU-012 | No Pod Disruption Budgets for any service | High | Open |
| UU-013 | agent-orchestrator has no memory limit | Medium | Open |
| UU-014 | velya-web has no Content-Security-Policy | High | Open |
| UU-015 | LocalStack license key in plain text in memory file | Medium | Open |

---

## Meta-Finding: Assumption Classes That Produce Unknown-Unknowns

The above discoveries share common assumption classes. Future discovery exercises should systematically challenge these:

| Assumption Class | Example from This Log |
|---|---|
| "Installed = Functional" | KEDA installed but no ScaledObjects (UU-007) |
| "Defined = Enforced" | NetworkPolicy defined but not enforced (UU-001) |
| "Working in dev = Working in prod" | ESO LocalStack to AWS gap (UU-004) |
| "Validated in low traffic = Safe at scale" | OTel 100% sampling (UU-006), NATS stream growth (UU-011) |
| "Visible = Secure" | Grafana/ArgoCD credentials (UU-009, UU-010) |
| "Functional documentation = Safe to store credentials" | License key in memory file (UU-015) |
| "Pod running = Service healthy" | Missing PDBs allow instant outage during drain (UU-012) |
