# Production Certification — Velya Platform

**Date**: 2026-04-08
**Certification Status**: NOT CERTIFIED — DEV READY ONLY
**Overall Platform Score**: 62/100
**Minimum Required for Production**: 85/100

---

## Certification Statement

> The Velya platform, as of 2026-04-08, is **NOT CERTIFIED FOR PRODUCTION USE** with real patient data.
>
> The platform demonstrates sound architectural foundations, strong CI/CD security hygiene, and a working development cluster. It does not meet the minimum technical, operational, or regulatory requirements for clinical production use.
>
> This certification document records all known blockers, their risk level, and the requirements for production sign-off.

---

## Current Status Summary

| Domain               | Score  | Production Ready               |
| -------------------- | ------ | ------------------------------ |
| Repository Structure | 85/100 | YES                            |
| CI/CD                | 90/100 | YES (with conditions)          |
| Runtime/Services     | 75/100 | NO — no business logic         |
| Observability        | 80/100 | NO — no application monitoring |
| GitOps               | 30/100 | NO — no ArgoCD applications    |
| Autoscaling          | 20/100 | NO — no ScaledObjects          |
| Secrets Management   | 70/100 | NO — LocalStack only           |
| Network Security     | 75/100 | NO — no TLS                    |
| Frontend             | 40/100 | NO — scaffold only             |
| Documentation        | 70/100 | NO — no runbooks (improving)   |
| Agent Framework      | 65/100 | NO — no runtime code           |
| Production Readiness | 35/100 | NO                             |

**Overall**: 62/100 — DEV READY, NOT PROD READY

---

## Production Blockers

The following blockers **must** be resolved before production certification can be issued.

### BLOCKER-001: No EKS Cluster

**Category**: Infrastructure
**Risk**: CRITICAL
**Description**: The entire platform runs on a local kind cluster on a developer's machine. Kind clusters cannot run production workloads.

**Why it blocks production**:

- No multi-AZ redundancy
- No persistent storage guarantees
- No AWS IAM integration
- No production networking (VPC, NLB, PrivateLink)
- No SLA or managed upgrade path

**Required**:

- [ ] AWS EKS cluster provisioned via OpenTofu
- [ ] Multi-AZ (minimum 3 AZs)
- [ ] EKS Auto Mode or Karpenter for node management
- [ ] VPC with private subnets, NAT gateways, security groups
- [ ] Managed node groups per workload type

**Estimated effort**: 3–4 weeks

---

### BLOCKER-002: No ArgoCD Applications — No GitOps

**Category**: GitOps / Delivery
**Risk**: CRITICAL
**Description**: ArgoCD is installed but zero Applications are configured. The current cluster state was manually applied. There is no automated delivery pipeline.

**Why it blocks production**:

- No controlled promotion (dev → staging → prod)
- No rollback capability
- No drift detection
- Manual kubectl applies are error-prone and unauditable

**Required**:

- [ ] ArgoCD Application manifests created in `infra/argocd/`
- [ ] App-of-Apps root application
- [ ] Auto-sync for dev, manual sync for staging/prod
- [ ] All services delivered exclusively via ArgoCD

**Estimated effort**: 1–2 weeks

---

### BLOCKER-003: No KEDA ScaledObjects — No Autoscaling

**Category**: Availability / Scalability
**Risk**: HIGH
**Description**: All services run at single replica with no autoscaling. Any service under load will fail without human intervention.

**Why it blocks production**:

- Zero fault tolerance (1 pod crash = 100% service downtime)
- No capacity elasticity for clinical demand peaks
- Cannot meet SLAs without HA and autoscaling

**Required**:

- [ ] Minimum 2 replicas for all clinical services
- [ ] KEDA ScaledObjects for all stateless services
- [ ] HPA for web-tier services
- [ ] Load testing validating scaling thresholds

**Estimated effort**: 2–3 weeks

---

### BLOCKER-004: Services Are Scaffold Code — No Clinical Functionality

**Category**: Functionality
**Risk**: CRITICAL
**Description**: All 9 backend services return HTTP 200 but implement no business logic. The platform provides no clinical value.

**Why it blocks production**:

- No patient flow management
- No discharge orchestration
- No task routing
- No audit trail
- No AI capabilities

**Required** (minimum for clinical MVP):

- [ ] patient-flow: admission, transfer, discharge API
- [ ] discharge-orchestrator: discharge planning workflow
- [ ] task-inbox: task creation, routing, assignment, completion
- [ ] audit-service: immutable audit event recording
- [ ] ai-gateway: real AI provider integration (Anthropic)
- [ ] policy-engine: policy evaluation for AI safety

**Estimated effort**: 3–6 months

---

### BLOCKER-005: No TLS on Any Ingress

**Category**: Security / HIPAA
**Risk**: CRITICAL
**Description**: All 13 ingresses use plaintext HTTP. Any clinical data transmitted would be unencrypted.

**Why it blocks production**:

- HIPAA Technical Safeguard 45 CFR §164.312(e)(2)(ii) requires encryption of PHI in transit
- Regulatory non-compliance is a hard blocker for any clinical use

**Required**:

- [ ] cert-manager installed
- [ ] TLS configured on all 13 ingresses
- [ ] HTTPS redirect enforced
- [ ] Certificate auto-renewal configured
- [ ] TLS 1.2 minimum enforced

**Estimated effort**: 1 week

---

### BLOCKER-006: No Application-Level Observability

**Category**: Observability / Operations
**Risk**: HIGH
**Description**: The observability stack monitors cluster infrastructure but has zero visibility into Velya service health.

**Why it blocks production**:

- Cannot detect service degradation without application metrics
- Cannot define or measure SLOs
- Cannot alert on clinical service failures
- On-call engineers are blind to application issues

**Required**:

- [ ] ServiceMonitors for all 9 Velya services
- [ ] Grafana dashboards: RED metrics per service
- [ ] SLO definitions per service
- [ ] Alert rules for service down, high error rate, high latency
- [ ] Runbooks linked to alerts

**Estimated effort**: 2–3 weeks

---

### BLOCKER-007: No mTLS Between Services

**Category**: Security / HIPAA
**Risk**: HIGH
**Description**: Service-to-service communication is plaintext within the cluster. No mutual TLS configured.

**Why it blocks production**:

- HIPAA requires PHI to be encrypted in transit
- Compromised pod could intercept service traffic

**Required**:

- [ ] Service mesh installed (Linkerd or Cilium)
- [ ] mTLS enforced between all Velya services
- [ ] Certificate rotation automated

**Estimated effort**: 2–3 weeks

---

### BLOCKER-008: No AWS Secrets Manager — LocalStack Only

**Category**: Secrets / Security
**Risk**: HIGH
**Description**: Secrets are managed via ESO with LocalStack backend. LocalStack is a dev mock — not suitable for production.

**Why it blocks production**:

- LocalStack has no persistence guarantees
- LocalStack has no access auditing
- Real credentials cannot be managed via LocalStack

**Required**:

- [ ] AWS Secrets Manager provisioned via OpenTofu
- [ ] ClusterSecretStore updated to use real AWS SM
- [ ] Secret rotation configured in AWS SM
- [ ] CloudTrail for secret access auditing

**Estimated effort**: 1–2 weeks

---

### BLOCKER-009: Frontend Not Implemented

**Category**: Frontend / Clinical Operations
**Risk**: HIGH
**Description**: Current frontend score: 8/100. No clinical workflows exist. No authentication. No role-based workspaces.

**Why it blocks production**:

- Clinical staff have no UI to operate the platform
- Without authentication, access is uncontrolled
- Without role-based workspaces, clinical safety is compromised

**Required minimum**:

- [ ] Authentication (login, session management)
- [ ] Role-based workspace routing
- [ ] Patient Operational Cockpit (basic)
- [ ] Unified Action Inbox (basic)
- [ ] Handoff Timeline
- [ ] Degraded mode UI
- [ ] WCAG 2.1 AA accessibility

**Estimated effort**: 6–10 months

---

### BLOCKER-010: Container Image Scanning Is a Placeholder

**Category**: Security / Supply Chain
**Risk**: HIGH
**Description**: CI has a placeholder for image scanning. Critical CVEs in production images would not be detected.

**Required**:

- [ ] Replace placeholder with Trivy action (pinned by SHA)
- [ ] Block on CRITICAL and HIGH CVEs
- [ ] SARIF results uploaded to GitHub Security

**Estimated effort**: 2–4 hours

---

### BLOCKER-011: No Load Testing

**Category**: Reliability / Production Readiness
**Risk**: HIGH
**Description**: No load testing has been performed. Unknown if the platform can handle production traffic.

**Required**:

- [ ] Load test each service at 2x expected peak
- [ ] Validate autoscaling responds correctly
- [ ] Identify and resolve bottlenecks
- [ ] Document performance baselines

**Estimated effort**: 2 weeks

---

### BLOCKER-012: No HIPAA Business Associate Agreements

**Category**: Legal / Compliance
**Risk**: CRITICAL (if using AWS and third-party services with PHI)
**Description**: Before handling any real PHI, Business Associate Agreements must be in place with:

- AWS (BAA available)
- Any AI provider (Anthropic BAA required if sending PHI to models)
- Any monitoring tool receiving clinical data

**Required**:

- [ ] AWS BAA signed
- [ ] Anthropic BAA signed (or PHI redacted before AI calls)
- [ ] All BAAs reviewed by legal
- [ ] PHI data flows documented and audited

**Estimated effort**: 2–4 weeks (legal process)

---

### BLOCKER-013: No Penetration Testing

**Category**: Security
**Risk**: HIGH
**Description**: No external security testing has been performed.

**Required**:

- [ ] External penetration test by qualified firm
- [ ] All critical findings remediated
- [ ] High findings remediated or accepted with compensating controls
- [ ] Penetration test report retained

**Estimated effort**: 4–8 weeks (scheduling + remediation)

---

### BLOCKER-014: No Disaster Recovery Plan

**Category**: Operations / Compliance
**Risk**: HIGH
**Description**: No DR/backup procedures exist. No RTO/RPO defined.

**Required**:

- [ ] RTO/RPO defined per service
- [ ] Database backup schedule configured and tested
- [ ] Backup restore procedure documented and tested
- [ ] DR runbook written and verified
- [ ] Multi-region failover plan (if required by RTO)

**Estimated effort**: 2–4 weeks

---

### BLOCKER-015: No Formal Test Suite

**Category**: Quality
**Risk**: HIGH
**Description**: 1 stub unit test. No integration tests. No E2E tests.

**Required**:

- [ ] 80% unit test coverage for all services and packages
- [ ] Integration tests for every service (Testcontainers)
- [ ] E2E tests for critical clinical paths
- [ ] Tests passing in CI on every PR

**Estimated effort**: 2–4 months alongside business logic implementation

---

## Conditional Certifications

Some items can be certified before others:

### DEV ENVIRONMENT — CERTIFIED (2026-04-08)

The development environment is certified for:

- Platform development work
- Architecture prototyping
- CI/CD pipeline validation
- Developer onboarding
- Observability stack evaluation

Not for: real patient data, clinical use, external access

### STAGING CERTIFICATION PREREQUISITES

Staging certification (before prod) requires:

- [ ] All blockers 001–010 resolved
- [ ] 70%+ test coverage
- [ ] Penetration test planned (can be parallel)
- [ ] ArgoCD delivering staging environment
- [ ] Load testing at 1x expected peak

### PRODUCTION CERTIFICATION PREREQUISITES

All blockers 001–015 must be resolved, plus:

- [ ] Staging validation complete (30-day minimum)
- [ ] Clinical stakeholder sign-off
- [ ] Legal/compliance review complete
- [ ] Security team sign-off
- [ ] Operations team sign-off (on-call rotation trained)
- [ ] HIPAA compliance assessment complete
- [ ] External penetration test complete and remediated

---

## Sign-Off Requirements

Production certification requires sign-off from:

| Role                         | Name | Status  | Date |
| ---------------------------- | ---- | ------- | ---- |
| Engineering Lead             | TBD  | PENDING | —    |
| Security Lead                | TBD  | PENDING | —    |
| Clinical Safety Officer      | TBD  | PENDING | —    |
| Information Governance / DPO | TBD  | PENDING | —    |
| Operations Lead              | TBD  | PENDING | —    |
| Legal                        | TBD  | PENDING | —    |

---

## Estimated Timeline to Production Readiness

| Phase                                             | Duration        | Gates                                |
| ------------------------------------------------- | --------------- | ------------------------------------ |
| Phase 1: Infrastructure (EKS + GitOps + Security) | 6–8 weeks       | BLOCKER-001, 002, 005, 007, 008, 010 |
| Phase 2: Core Backend (business logic)            | 3–6 months      | BLOCKER-004, 015                     |
| Phase 3: Autoscaling + Observability              | 3–4 weeks       | BLOCKER-003, 006, 011                |
| Phase 4: Frontend MVP                             | 4–6 months      | BLOCKER-009                          |
| Phase 5: Compliance + Legal + Testing             | 2–4 months      | BLOCKER-012, 013, 014                |
| Phase 6: Staging validation                       | 1 month minimum | All blockers resolved                |

**Estimated total**: 12–18 months from current state to production certification

---

## Re-Certification Trigger Events

This certification must be re-evaluated when:

- A new clinical service is added to the platform
- A security incident occurs
- A HIPAA audit finding is made
- The cluster is migrated (kind → EKS)
- An ArgoCD deployment causes a production incident
- Any of the sign-off role holders change

---

_Certification document owned by: Platform Lead + Security Lead. This document supersedes any informal statements about production readiness. Only this document, when signed by all required parties, constitutes production certification._
