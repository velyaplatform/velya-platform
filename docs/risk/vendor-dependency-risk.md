# Vendor Dependency Risk Register

**Velya Hospital AI Platform**
**Document Type:** Vendor Risk Assessment
**Date:** 2026-04-08
**Classification:** Internal — Risk Management
**Status:** Active — Initial Assessment

---

## Purpose

This document assesses the risk profile of every significant external vendor or technology dependency in the Velya platform. For each dependency, it evaluates: what would happen if the vendor changed terms, raised prices, became unavailable, or was compromised. It also tracks mitigation status for each dependency.

A dependency with no mitigation and high replacement cost is a strategic risk to clinical operations, not just a technical concern.

---

## Dependency Risk Matrix

### Summary Overview

| Vendor/Technology                         | Category             | Criticality | Lock-In Score | Risk Level |
| ----------------------------------------- | -------------------- | ----------- | ------------- | ---------- |
| Anthropic (Claude API)                    | AI Inference         | Critical    | High          | High       |
| AWS (EKS, S3, SQS, Secrets Manager, etc.) | Cloud Platform       | Critical    | High          | High       |
| LocalStack Pro                            | Dev/Test Environment | Medium      | Medium        | Medium     |
| NATS JetStream                            | Messaging            | Critical    | Medium        | Medium     |
| ArgoCD                                    | GitOps               | High        | Low           | Low        |
| Helm                                      | Package Management   | High        | Low           | Low        |
| KEDA                                      | Autoscaling          | Medium      | Low           | Low        |
| Prometheus / kube-prometheus-stack        | Observability        | High        | Low           | Low        |
| Grafana                                   | Observability UI     | Medium      | Low           | Low        |
| Loki / Promtail                           | Log Aggregation      | Medium      | Low           | Low        |
| OpenTelemetry Collector                   | Tracing              | Medium      | Low           | Low        |
| MetalLB                                   | Network LB (dev)     | Low         | Low           | Very Low   |
| nginx-ingress                             | Ingress              | High        | Low           | Low        |
| External Secrets Operator                 | Secrets Sync         | High        | Low           | Low        |
| PostgreSQL                                | Database             | Critical    | Low           | Low        |
| kind (Kubernetes IN Docker)               | Local Dev Cluster    | Low         | Low           | Very Low   |
| GitHub / GitHub Actions                   | SCM + CI             | High        | Medium        | Medium     |
| Medplum (planned)                         | FHIR Server          | Critical    | High          | High       |
| Temporal (planned)                        | Workflow Engine      | High        | Medium        | Medium     |
| Node.js / TypeScript / NestJS             | Runtime & Framework  | Critical    | Low           | Low        |
| Next.js                                   | Frontend Framework   | High        | Low           | Low        |

---

## Detailed Assessments

---

### VD-001 — Anthropic (Claude API)

| Field                  | Value                                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor**             | Anthropic PBC                                                                                                                                                                                                                                                                                                                         |
| **Dependency Type**    | AI inference — the core intelligence layer for all AI recommendations and agent decisions                                                                                                                                                                                                                                             |
| **Current Usage**      | All ai-gateway inference calls route to Claude. Specific model version pinned in ai-gateway config.                                                                                                                                                                                                                                   |
| **Criticality**        | Critical — the platform's core clinical AI capability does not function without this                                                                                                                                                                                                                                                  |
| **Contract Status**    | Commercial API (pay per token). HIPAA BAA status: not yet executed — this is an open clinical safety blocker (see BS-004).                                                                                                                                                                                                            |
| **Lock-In Score**      | High. Claude-specific response formats (tool call structure, content blocks) are used in ai-gateway.                                                                                                                                                                                                                                  |
| **Pricing Risk**       | Anthropic has changed API pricing multiple times. Token prices for Claude 3.x and 4.x have varied by 3-10x. Hospital AI workloads have large, clinically necessary contexts that make them expensive relative to general use cases.                                                                                                   |
| **Availability Risk**  | Anthropic's API has had outages. In a hospital context, any AI inference outage must degrade gracefully — the platform must function in a reduced-capability mode without AI recommendations. This is currently not implemented.                                                                                                      |
| **Termination Risk**   | If Anthropic terminates the commercial relationship (unlikely but not impossible), all AI capabilities cease. No alternative is wired in.                                                                                                                                                                                             |
| **Compliance Risk**    | HIPAA BAA is not signed. Processing PHI through the Anthropic API without a BAA is a HIPAA violation. This is a current open blocker.                                                                                                                                                                                                 |
| **Replacement Effort** | Medium-high. ai-gateway is intended to abstract the provider, but Claude-specific response parsing exists. Replacing requires: (1) alternative provider integration in ai-gateway, (2) prompt re-engineering (Claude-optimized prompts may not perform identically on other models), (3) clinical re-validation of AI output quality. |
| **Mitigation Status**  | Partial. ai-gateway provides an abstraction layer but it is not provider-neutral yet. No secondary provider is integrated. HIPAA BAA not executed.                                                                                                                                                                                    |
| **Required Actions**   | (1) Execute HIPAA BAA with Anthropic before any PHI flows through the API. (2) Integrate a secondary provider (OpenAI, Mistral, or a self-hosted model) as a fallback. (3) Audit ai-gateway for Claude-specific code and replace with provider-agnostic abstractions.                                                                 |
| **Risk Level**         | High                                                                                                                                                                                                                                                                                                                                  |

---

### VD-002 — AWS (Multiple Services)

| Field                  | Value                                                                                                                                                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor**             | Amazon Web Services                                                                                                                                                                                                                                     |
| **Dependency Type**    | Cloud platform — compute (EKS Auto Mode), storage (S3), messaging (SQS), secrets (Secrets Manager), database (RDS, planned), IAM, networking (VPC, Route53, ACM)                                                                                        |
| **Current Usage**      | Simulated via LocalStack Pro in dev. Target production infrastructure is EKS. All infrastructure designed around AWS-specific services.                                                                                                                 |
| **Criticality**        | Critical — production platform runs on AWS                                                                                                                                                                                                              |
| **Contract Status**    | Standard AWS commercial agreement. HIPAA BAA with AWS is covered under standard AWS BAA for HIPAA-eligible services (EKS, RDS, S3, Secrets Manager are all HIPAA-eligible).                                                                             |
| **Lock-In Score**      | High. SQS queues, DynamoDB tables, Kinesis streams, EventBridge rules, Step Functions — all are AWS-specific. OpenTofu modules are written for the AWS provider.                                                                                        |
| **Pricing Risk**       | AWS pricing has remained stable for EKS and compute. Data transfer costs can be significant for AI workloads that move large contexts between services. EKS Auto Mode pricing includes node management costs.                                           |
| **Availability Risk**  | AWS has had regional outages (us-east-1 is historically the most affected). No multi-region architecture is defined. Single-region EKS deployment means an AWS regional failure is a clinical platform outage.                                          |
| **Termination Risk**   | Low. AWS does not terminate well-behaved commercial accounts.                                                                                                                                                                                           |
| **Replacement Effort** | Very high. Replacing AWS requires rewriting all OpenTofu modules for a different cloud provider, replacing AWS-specific services with equivalents, and re-validating the entire platform. Estimated: 6+ months.                                         |
| **Mitigation Status**  | Poor. No multi-region architecture. No cloud-agnostic abstraction for AWS-specific services. LocalStack provides a simulation that creates false confidence in portability (see UU-004).                                                                |
| **Required Actions**   | (1) Define multi-region or active-passive HA architecture for EKS. (2) Abstract AWS-specific service calls behind internal interfaces. (3) Validate LocalStack-to-real-AWS migration path. (4) Confirm HIPAA BAA coverage for all planned AWS services. |
| **Risk Level**         | High                                                                                                                                                                                                                                                    |

---

### VD-003 — LocalStack Pro

| Field                 | Value                                                                                                                                                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vendor**            | LocalStack GmbH                                                                                                                                                                                                                                                    |
| **Dependency Type**   | Development and test environment — simulation of AWS services locally                                                                                                                                                                                              |
| **Current Usage**     | Active in dev environment. Simulates: KMS, S3, SQS, SNS, DynamoDB, Secrets Manager, SSM, Lambda, Kinesis, EventBridge, CloudWatch, IAM, Step Functions                                                                                                             |
| **Criticality**       | Medium — affects development velocity; does not affect production                                                                                                                                                                                                  |
| **Contract Status**   | LocalStack Pro license active (key stored in dev memory — see UU-015).                                                                                                                                                                                             |
| **Lock-In Score**     | Medium. LocalStack APIs match AWS APIs but have known behavioral differences. Dev code that works on LocalStack may have subtle failures on real AWS.                                                                                                              |
| **Pricing Risk**      | LocalStack Pro pricing is per-developer seat. Scaling the team increases licensing costs.                                                                                                                                                                          |
| **Termination Risk**  | If LocalStack Pro license lapses or the product is discontinued, the dev environment loses AWS simulation. Developers would need to point at real AWS accounts, increasing cost and complexity.                                                                    |
| **Mitigation Status** | None explicitly. License key stored in plain text (security risk, see UU-015).                                                                                                                                                                                     |
| **Required Actions**  | (1) Store LocalStack license key in secrets manager, not in documentation. (2) Document behavioral differences between LocalStack and real AWS to catch integration gaps. (3) Run integration tests against real AWS periodically to validate LocalStack fidelity. |
| **Risk Level**        | Medium                                                                                                                                                                                                                                                             |

---

### VD-004 — NATS JetStream

| Field                 | Value                                                                                                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor**            | Synadia (commercial backing) / CNCF project                                                                                                                                                                                                                                                   |
| **Dependency Type**   | Event backbone — all inter-service communication, clinical event delivery, agent coordination                                                                                                                                                                                                 |
| **Current Usage**     | NATS v2.12.6 deployed via `nats-2.12.6` Helm chart. All Velya services publish/subscribe via NATS.                                                                                                                                                                                            |
| **Criticality**       | Critical — NATS is the nervous system of the platform                                                                                                                                                                                                                                         |
| **Contract Status**   | Open source (Apache 2.0). No commercial support contract.                                                                                                                                                                                                                                     |
| **Lock-In Score**     | Medium. NATS-specific subject hierarchy, JetStream stream configuration, and durable consumer patterns are embedded in service code. Replacing NATS would require rewriting all event handling.                                                                                               |
| **Support Risk**      | No commercial support contract means that production NATS issues require community support, GitHub issues, or self-resolution. For a hospital platform, this is a meaningful operational risk.                                                                                                |
| **Availability Risk** | Current deployment is single-node NATS (not clustered for HA). Single-node failure means complete event delivery loss. Clustered NATS requires 3 nodes minimum for raft quorum.                                                                                                               |
| **Upgrade Risk**      | NATS has breaking changes between major versions. Subject hierarchy changes and consumer API changes have historically required migration.                                                                                                                                                    |
| **Mitigation Status** | Poor. No commercial support. No NATS clustering. No subject-level authorization. Stream deduplication not configured (see UU-003).                                                                                                                                                            |
| **Required Actions**  | (1) Evaluate Synadia Cloud or commercial NATS support contract for production. (2) Deploy NATS with 3-node raft clustering for HA. (3) Configure stream authorization and per-subject access controls. (4) Document the event schema in a schema registry to support future broker migration. |
| **Risk Level**        | Medium                                                                                                                                                                                                                                                                                        |

---

### VD-005 — ArgoCD

| Field                  | Value                                                                                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor**             | Intuit / CNCF project                                                                                                                                                                                                              |
| **Dependency Type**    | GitOps — all Kubernetes deployments managed by ArgoCD                                                                                                                                                                              |
| **Current Usage**      | ArgoCD v2.11.3 deployed. Manages all Velya service deployments and Helm release synchronization.                                                                                                                                   |
| **Criticality**        | High — all deployments go through ArgoCD                                                                                                                                                                                           |
| **Contract Status**    | Open source (Apache 2.0). No commercial support contract.                                                                                                                                                                          |
| **Lock-In Score**      | Low. ArgoCD follows standard GitOps patterns. Application manifests can be applied directly with kubectl if ArgoCD is removed. ArgoCD-specific annotations (e.g., `argocd.argoproj.io/sync-wave`) are the primary lock-in surface. |
| **Availability Risk**  | ArgoCD failure means no new deployments can be pushed. Existing pods continue running. Clinical operations are not affected by ArgoCD being down — only deployments are blocked.                                                   |
| **Replacement Effort** | Low-medium. FluxCD, Rancher Fleet, or direct kubectl apply are viable alternatives.                                                                                                                                                |
| **Mitigation Status**  | Good. ArgoCD is a CNCF project with broad adoption. Default admin password not rotated (see UU-009) — this is a security gap, not a vendor risk.                                                                                   |
| **Required Actions**   | (1) Rotate ArgoCD admin password and implement SSO. (2) Enable audit logging on ArgoCD.                                                                                                                                            |
| **Risk Level**         | Low                                                                                                                                                                                                                                |

---

### VD-006 — GitHub / GitHub Actions

| Field                 | Value                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor**            | Microsoft (GitHub)                                                                                                                                                                                                                                                                                                              |
| **Dependency Type**   | Source control management and CI/CD pipeline                                                                                                                                                                                                                                                                                    |
| **Current Usage**     | All Velya code is in GitHub. GitHub Actions runs CI workflows. Agent workflows create PRs via GitHub API.                                                                                                                                                                                                                       |
| **Criticality**       | High — source control is the foundation of the GitOps model. CI is the primary quality gate.                                                                                                                                                                                                                                    |
| **Contract Status**   | Commercial GitHub plan. GitHub Actions minutes cost based on usage.                                                                                                                                                                                                                                                             |
| **Lock-In Score**     | Medium. GitHub Actions workflow syntax (`.github/workflows/*.yml`) is GitHub-specific. Migrating to GitLab CI or Jenkins requires rewriting all CI workflows. Code itself is portable (git).                                                                                                                                    |
| **Availability Risk** | GitHub has had significant outages (most notably the 2020 and 2022 incidents). During a GitHub outage, deployments cannot be triggered, PRs cannot be reviewed, and CI cannot run. For a hospital platform, this is a significant operational risk if a critical hotfix is needed during a GitHub outage.                       |
| **Compliance Risk**   | GitHub may be subject to US export regulations. Patient data should not be in GitHub — only code. Confirming no PHI leaks into GitHub (e.g., via test fixtures, logs, or hardcoded test data) is a compliance requirement.                                                                                                      |
| **Mitigation Status** | Partial. Code is in GitHub. No backup SCM or CI system is defined. No process for deploying a hotfix during a GitHub outage.                                                                                                                                                                                                    |
| **Required Actions**  | (1) Document the emergency deployment procedure that does not depend on GitHub Actions (direct ArgoCD sync from a local clone). (2) Verify that no PHI exists in any repository (test fixtures, configuration values). (3) Pin all GitHub Actions by SHA (see security rules — currently required but compliance not verified). |
| **Risk Level**        | Medium                                                                                                                                                                                                                                                                                                                          |

---

### VD-007 — Medplum (Planned)

| Field                  | Value                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor**             | Medplum Inc.                                                                                                                                                                                                                                                                                                                        |
| **Dependency Type**    | FHIR R4 clinical data server — the source of truth for all clinical data once integrated                                                                                                                                                                                                                                            |
| **Current Usage**      | Not yet deployed — listed as pending in project state. Medplum is planned as the FHIR server.                                                                                                                                                                                                                                       |
| **Criticality**        | Critical (when deployed) — all clinical data flows through Medplum                                                                                                                                                                                                                                                                  |
| **Contract Status**    | Medplum offers both open-source self-hosted and commercial cloud versions. Contract type not yet determined.                                                                                                                                                                                                                        |
| **Lock-In Score**      | High. FHIR R4 is a standard, but Medplum's specific Bot runtime, authentication model, and subscription mechanism are Medplum-specific.                                                                                                                                                                                             |
| **HIPAA Compliance**   | Medplum is designed for HIPAA compliance. BAA is available. This must be executed before any patient data flows through the instance.                                                                                                                                                                                               |
| **Replacement Effort** | High. FHIR is a standard, but clinical workflows built on Medplum Bots, FHIR Subscriptions, and Medplum's specific GraphQL layer would need to be rebuilt for a different FHIR server (HAPI FHIR, Azure FHIR, AWS HealthLake).                                                                                                      |
| **Mitigation Status**  | N/A — not yet deployed. Risk assessment is forward-looking.                                                                                                                                                                                                                                                                         |
| **Required Actions**   | (1) Before deployment: execute HIPAA BAA with Medplum. (2) Define the FHIR resource schema independently of Medplum (FHIR profiles, IG) so that the schema is portable. (3) Isolate Medplum-specific code (Bots, subscriptions) in an ACL layer. (4) Evaluate self-hosted vs. Medplum Cloud based on data sovereignty requirements. |
| **Risk Level**         | High (when deployed)                                                                                                                                                                                                                                                                                                                |

---

### VD-008 — Temporal (Planned)

| Field                 | Value                                                                                                                                                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor**            | Temporal Technologies Inc.                                                                                                                                                                                                                                                                                          |
| **Dependency Type**   | Durable workflow engine — planned for managing long-running clinical workflows (patient discharge, pre-authorization, medication reconciliation)                                                                                                                                                                    |
| **Current Usage**     | Not yet deployed — listed as pending in project state. Requires PostgreSQL backend (already available).                                                                                                                                                                                                             |
| **Criticality**       | High (when deployed)                                                                                                                                                                                                                                                                                                |
| **Contract Status**   | Open source (MIT) or Temporal Cloud (managed service).                                                                                                                                                                                                                                                              |
| **Lock-In Score**     | Medium. Temporal's workflow and activity model is specific to Temporal, but the concept (durable execution) is portable to alternatives like Restate, Conductor, or custom NATS-based saga patterns.                                                                                                                |
| **Availability Risk** | Temporal's worker model requires the Temporal server to be running for workflows to progress. If the Temporal server is unavailable, in-flight workflows pause (they don't fail — they resume when the server is available). This is a significant resilience advantage over message-queue-based workflow patterns. |
| **Mitigation Status** | N/A — not yet deployed.                                                                                                                                                                                                                                                                                             |
| **Required Actions**  | (1) Before deployment: decide between self-hosted Temporal (requires PostgreSQL or Cassandra backend) and Temporal Cloud. (2) If self-hosted: confirm PostgreSQL sizing is adequate for Temporal's history and visibility stores. (3) Define Temporal namespace per environment.                                    |
| **Risk Level**        | Medium (when deployed)                                                                                                                                                                                                                                                                                              |

---

### VD-009 — Node.js / TypeScript / NestJS

| Field                 | Value                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Vendor**            | Node.js Foundation (OpenJS) / Microsoft (TypeScript) / NestJS (community)                                                                                                                                                |
| **Dependency Type**   | Runtime and application framework for all backend services                                                                                                                                                               |
| **Current Usage**     | All 9 NestJS services. TypeScript strict mode. Node.js LTS version.                                                                                                                                                      |
| **Criticality**       | Critical                                                                                                                                                                                                                 |
| **Lock-In Score**     | Low. TypeScript is a superset of JavaScript, which runs on any Node.js environment. NestJS applications can be compiled to standard Node.js without NestJS-specific runtime.                                             |
| **Support Risk**      | NestJS is community-maintained with a small core team. Enterprise support is available via NestJS Pro but is not subscribed. Node.js LTS is backed by the OpenJS Foundation with broad industry support.                 |
| **Security Risk**     | Node.js security patches are frequent. npm supply chain attacks are an ongoing risk. All dependencies must be pinned (see project CLAUDE.md — no `latest` tags).                                                         |
| **Mitigation Status** | Good. Widely used stack. Low vendor lock-in.                                                                                                                                                                             |
| **Required Actions**  | (1) Pin Node.js version across all Dockerfiles. (2) Use npm audit in CI to catch known vulnerabilities. (3) Monitor NestJS CVEs — NestJS applications have had injection vulnerabilities related to metadata reflection. |
| **Risk Level**        | Low                                                                                                                                                                                                                      |

---

### VD-010 — kube-prometheus-stack (Prometheus, Alertmanager, Grafana)

| Field                 | Value                                                                                                                                   |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Vendor**            | Prometheus CNCF project / Grafana Labs / Alertmanager community                                                                         |
| **Dependency Type**   | Observability — metrics collection, alerting, dashboards                                                                                |
| **Current Usage**     | kube-prometheus-stack-54.0.0 deployed in `velya-dev-observability`. 5 PrometheusRules defined. 6 Grafana dashboards.                    |
| **Criticality**       | High — observability is a clinical safety function, not just operational                                                                |
| **Lock-In Score**     | Low. Prometheus exposes standard metrics format. Grafana dashboards are JSON and can be migrated. PromQL is standard.                   |
| **Pricing Risk**      | All components are open source. Grafana Cloud (managed) has a cost, but self-hosted Grafana is free.                                    |
| **Support Risk**      | Alertmanager routing is not configured (see BS-009, alert-fatigue-validation.md). This is not a vendor risk — it's a configuration gap. |
| **Mitigation Status** | Good stack choice. Current gaps are configuration issues, not vendor issues.                                                            |
| **Risk Level**        | Low                                                                                                                                     |

---

## Overall Vendor Risk Summary

### High-Risk Dependencies (Immediate Action Required)

1. **Anthropic** — HIPAA BAA not signed (clinical safety blocker), no fallback provider
2. **AWS** — No multi-region HA, LocalStack-to-AWS gap not validated, lock-in high
3. **Medplum (planned)** — HIPAA BAA must be in place before deployment, high lock-in

### Medium-Risk Dependencies (Address Before Production)

4. **NATS JetStream** — No commercial support, no HA clustering, no authorization
5. **LocalStack Pro** — License key in plain text, behavioral differences from real AWS
6. **GitHub / GitHub Actions** — No emergency deployment procedure for GitHub outage

### Low-Risk Dependencies (Monitor)

7. ArgoCD, Helm, KEDA, Prometheus, Grafana, Loki, OTel, nginx-ingress, ESO, PostgreSQL, Node.js/NestJS, Next.js

---

## Vendor Risk Response Plan

### If Anthropic API becomes unavailable

1. ai-gateway switches to degraded mode — returns empty recommendations with `AI_UNAVAILABLE` status
2. velya-web displays degraded mode banner (see cognitive-safety-controls.md Control 3)
3. Clinical staff notified that AI recommendations are unavailable — manual clinical process applies
4. If outage > 4 hours: activate secondary AI provider if integrated (planned, not yet done)
5. Monitor Anthropic status page: https://status.anthropic.com

### If AWS has a regional outage

1. EKS control plane may be unavailable — existing workloads continue on nodes
2. ArgoCD sync is blocked — no new deployments during the outage
3. Secrets Manager may be unavailable — services that restart during the outage cannot retrieve secrets (use image pull secrets cache and secret pre-loading where possible)
4. S3 and SQS may be unavailable — services with AWS SDK calls degrade per circuit breaker (L-006)
5. Incident declared — escalate to on-call engineer

### If GitHub is unavailable

1. CI is blocked — no automated testing or deployment pipelines
2. Existing ArgoCD Applications continue serving from their last synced state
3. Emergency deployment procedure: git clone to a local machine, run `argocd app sync <app>` directly
4. Monitor GitHub status: https://githubstatus.com
