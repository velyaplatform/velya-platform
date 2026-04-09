# Production Blockers — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Definition**: A production blocker is a gap, deficiency, or missing capability that prevents the Velya platform from being certified for use with real patients, real clinical data, or real hospital operations. No blocker can be waived — all must reach Resolved or Accepted-with-Control before production certification.  
**Authority**: Production certification requires sign-off from CTO, CISO, and Clinical Medical Officer

---

## Blocker Status Definitions

| Status                | Meaning                                                                          |
| --------------------- | -------------------------------------------------------------------------------- |
| Open                  | Not started or acknowledged; no remediation in progress                          |
| In Progress           | Active remediation work underway                                                 |
| Blocked               | Remediation is blocked by a dependency (noted in remediation steps)              |
| Resolved              | Blocker eliminated; evidence recorded                                            |
| Accepted-with-Control | Risk accepted with documented compensating control; requires CTO + CISO sign-off |

---

## BLKR-001: No Authentication or Authorization on Frontend or APIs

| Field                | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| **ID**               | BLKR-001                                                          |
| **Title**            | No authentication or authorization anywhere in the platform       |
| **Category**         | Security / Compliance                                             |
| **Priority**         | P0 — Most Urgent                                                  |
| **Status**           | Open                                                              |
| **Owner**            | Security Team + Frontend Team                                     |
| **Estimated Effort** | 3 sprints (OIDC integration, RBAC middleware, frontend auth flow) |

**Why It Blocks Production**: Any user on the hospital network can access all Velya pages and (once implemented) all clinical APIs without providing credentials. In a production hospital environment, this would expose PHI to any network user, violate HIPAA, and enable unauthorized clinical actions by anonymous users.

**Current State**: velya-web returns HTTP 200 with a homepage to any unauthenticated user. No api-gateway routes have authentication middleware. No JWT validation exists. No role claims are enforced.

**Remediation Steps**:

1. Select and configure hospital IdP integration (Okta or Azure AD via OIDC)
2. Implement NextAuth.js or equivalent in velya-web for session management
3. Implement JWT validation middleware in api-gateway (NestJS guard)
4. Implement RBAC guards per endpoint based on role claims (physician, nurse, admin, auditor)
5. Implement server-side RBAC verification for every clinical action (not just UI hiding)
6. Implement session timeout (15-minute inactivity for clinical workstations)
7. Test: unauthenticated request returns 401; wrong-role request returns 403; correct-role request succeeds

---

## BLKR-002: No TLS — All Traffic Is Plaintext HTTP

| Field                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **ID**               | BLKR-002                                                               |
| **Title**            | No TLS on any ingress route or inter-service communication             |
| **Category**         | Security                                                               |
| **Priority**         | P0                                                                     |
| **Status**           | Open                                                                   |
| **Owner**            | Security Team + Infrastructure Team                                    |
| **Estimated Effort** | 1 sprint (cert-manager + ingress TLS) + 2 sprints (inter-service mTLS) |

**Why It Blocks Production**: PHI transmitted in plaintext over hospital networks is a HIPAA violation. Hospital networks are not fully trusted — network taps, legacy equipment, and insider threats make plaintext unacceptable for clinical data. HIPAA §164.312(e)(2)(ii) requires encryption in transit.

**Current State**: All 13 ingress routes use HTTP only. All inter-service calls use HTTP. No TLS certificates issued.

**Remediation Steps**:

1. Deploy cert-manager to cluster
2. Configure ClusterIssuer: Let's Encrypt for external (production domain) + internal CA for inter-service
3. Update all 13 Ingress resources with TLS configuration and certificate references
4. Configure nginx-ingress to redirect HTTP → HTTPS (308 redirect)
5. Add HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
6. For inter-service mTLS: deploy Linkerd or Istio service mesh, OR configure per-service TLS with internal CA
7. Verify: curl http:// returns 308; curl https:// succeeds with valid cert; tcpdump confirms no plaintext PHI

---

## BLKR-003: No HIPAA Compliance Framework

| Field                | Value                                                                            |
| -------------------- | -------------------------------------------------------------------------------- |
| **ID**               | BLKR-003                                                                         |
| **Title**            | No documented HIPAA compliance controls, no BAA with vendors, no risk assessment |
| **Category**         | Compliance / Regulatory                                                          |
| **Priority**         | P0                                                                               |
| **Status**           | Open                                                                             |
| **Owner**            | Compliance Team + Legal                                                          |
| **Estimated Effort** | 4–8 weeks (compliance work, not engineering)                                     |

**Why It Blocks Production**: Operating a healthcare technology platform without HIPAA compliance for a covered entity (the hospital) exposes both Velya and the hospital to regulatory fines of up to $1.9M per violation category per year. Deploying without a HIPAA framework is legally prohibited.

**Current State**: No HIPAA Security Rule risk assessment conducted. No Business Associate Agreement (BAA) executed with Anthropic, Medplum, NATS (if cloud-hosted), or any other vendor handling PHI. No workforce training program. No documented policies for PHI handling, access control, audit, breach notification, or contingency planning.

**Remediation Steps**:

1. Conduct formal HIPAA Security Rule risk assessment (§164.308(a)(1))
2. Execute BAA with Anthropic (prerequisite to any patient data reaching Claude API)
3. Execute BAA with Medplum (if using managed cloud; review terms for self-hosted)
4. Execute BAA with any other vendor whose infrastructure may encounter PHI
5. Document HIPAA administrative safeguards: workforce training, access management, incident response
6. Document HIPAA physical safeguards: facility access, workstation controls
7. Document HIPAA technical safeguards: access control, audit controls, integrity controls, transmission security
8. Map each HIPAA control to a Velya technical control or policy
9. Engage a HIPAA consultant or qualified security assessor (QSA) for independent review

---

## BLKR-004: No PHI Audit Trail

| Field                | Value                                               |
| -------------------- | --------------------------------------------------- |
| **ID**               | BLKR-004                                            |
| **Title**            | No audit trail for PHI access or clinical decisions |
| **Category**         | Compliance / Security                               |
| **Priority**         | P0                                                  |
| **Status**           | Open                                                |
| **Owner**            | Clinical Team + Compliance                          |
| **Estimated Effort** | 2 sprints                                           |

**Why It Blocks Production**: HIPAA §164.312(b) requires "hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic PHI." Without an audit trail, any access to patient data, any clinical decision, and any data modification is untracked. This makes investigation of any incident or adverse event impossible and represents a fundamental HIPAA non-compliance.

**Current State**: audit-service exists as a scaffold. No FHIR subscription to Medplum captures change events. No NestJS interceptor captures API access events. No AI decision is logged. No user action in the frontend creates an audit record.

**Remediation Steps**:

1. Implement audit-service audit event schema: actor, action, resource type, resource ID, patient handle, timestamp, IP, session ID, outcome
2. Configure Medplum FHIR Subscription to publish all FHIR resource changes to audit-service
3. Implement NestJS interceptor in api-gateway that logs every authenticated request
4. Implement NestJS interceptor in each clinical service that logs every write operation
5. Implement decision-log-service integration: every AI recommendation is logged with sanitized prompt, response, confidence
6. Configure audit-service database as append-only (no UPDATE/DELETE on audit records)
7. Verify: perform clinical action; verify audit record exists within 5 seconds

---

## BLKR-005: Near-Zero Test Coverage

| Field                | Value                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| **ID**               | BLKR-005                                                                        |
| **Title**            | Near-zero automated test coverage — 1 stub test file covering no business logic |
| **Category**         | Quality                                                                         |
| **Priority**         | P1                                                                              |
| **Status**           | Open                                                                            |
| **Owner**            | Quality Team                                                                    |
| **Estimated Effort** | Ongoing — 3 sprints for minimum viable coverage; full coverage over 6 sprints   |

**Why It Blocks Production**: Without tests, any code change may introduce clinical regressions that are not detected until a clinical staff member encounters them. For software that influences clinical decisions, undiscovered regressions may cause patient harm. No regulatory body accepts clinical software without a documented test strategy and evidence of test execution.

**Current State**: `tests/unit/platform.test.ts` — one file, one passing stub assertion. Zero integration tests. Zero E2E tests. Zero contract tests for NATS schemas. No test coverage CI gate (it would pass at 0%).

**Remediation Steps**:

1. Configure code coverage collection (vitest --coverage) and enforce minimum in CI (80% for services, 90% for clinical paths)
2. Write unit tests for every implemented service function as business logic is added (test-alongside-implementation policy)
3. Write integration tests for each service: database queries, NATS publish/subscribe, HTTP endpoints
4. Write E2E tests for 5 critical clinical workflows: patient admission, discharge, bed assignment, critical alert, task routing
5. Write contract tests for all NATS subject schemas using `packages/event-contracts`
6. Write agent behavior tests: golden dataset evaluation for each agent type
7. Add load test (k6 or Artillery) for api-gateway and patient-flow-service at 100 concurrent users

---

## BLKR-006: No Container Image Scanning

| Field                | Value                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| **ID**               | BLKR-006                                                                          |
| **Title**            | Container image scanning in CI is a placeholder comment — no actual scan executed |
| **Category**         | Security                                                                          |
| **Priority**         | P1                                                                                |
| **Status**           | Open                                                                              |
| **Owner**            | Security Team                                                                     |
| **Estimated Effort** | 1 sprint                                                                          |

**Why It Blocks Production**: A clinical software platform running containers with unscanned images may be deploying known exploitable vulnerabilities (CVEs) to a system that handles patient data. A critical CVE in a NestJS or Node.js image could allow remote code execution in a clinical service, enabling PHI exfiltration or ransomware.

**Current State**: ci.yaml has a commented-out section labeled "Trivy scan" that does not execute. No image is scanned before push to ECR.

**Remediation Steps**:

1. Uncomment and complete Trivy scan step in `.github/workflows/ci.yaml`
2. Configure `--exit-code 1` for CRITICAL severity CVEs (immediate build failure)
3. Configure `--exit-code 1` for HIGH severity CVEs (failure with documented exception process)
4. Add Trivy to release pipeline before image push to ECR
5. Enable ECR Enhanced Scanning for continuous re-scan after deployment (detects CVEs published after build)
6. Create SBOM per image using `syft` in release pipeline; store in ECR alongside image
7. Verify: introduce a known-CVE base image; confirm CI fails with exit code 1

---

## BLKR-007: No ArgoCD Applications — GitOps Inoperative

| Field                | Value                                                                  |
| -------------------- | ---------------------------------------------------------------------- |
| **ID**               | BLKR-007                                                               |
| **Title**            | ArgoCD has zero Application resources — cluster not managed via GitOps |
| **Category**         | Infrastructure / Delivery                                              |
| **Priority**         | P1                                                                     |
| **Status**           | Open                                                                   |
| **Owner**            | Infrastructure Team                                                    |
| **Estimated Effort** | 1 sprint                                                               |

**Why It Blocks Production**: Without GitOps, every deployment requires direct cluster access (kubectl), which cannot be audited, reviewed, or rolled back via the intended mechanism. In production, this means: no repeatable deployments, no drift detection, no rollback capability, and potential for unauthorized or unreviewed changes to reach the cluster.

**Current State**: ArgoCD is installed with 7 running pods. Zero ArgoCD Application CRDs exist. All 64 cluster pods were deployed via manual kubectl/helm commands.

**Remediation Steps**:

1. Create `infra/argocd/` directory structure: `root-app.yaml`, `apps/clinical.yaml`, `apps/platform.yaml`, `apps/observability.yaml`
2. Use App-of-Apps pattern: root app points to `infra/argocd/apps/`
3. Configure per-service ArgoCD Applications with: `syncPolicy.automated.selfHeal: true` (dev), `syncPolicy.automated.prune: true` (dev)
4. Configure ArgoCD Projects with namespace-scoped RBAC (no cluster-admin for ArgoCD SA)
5. Apply root app: `kubectl apply -f infra/argocd/root-app.yaml -n argocd`
6. Verify ArgoCD syncs all services from git; verify `argocd app list` returns all expected apps in Synced state
7. Document and enforce policy: no more manual kubectl apply; break-glass procedure for emergencies only

---

## BLKR-008: No Secret Rotation Policy or Automation

| Field                | Value                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| **ID**               | BLKR-008                                                                          |
| **Title**            | No secret rotation — all credentials are static with no defined rotation schedule |
| **Category**         | Security                                                                          |
| **Priority**         | P1                                                                                |
| **Status**           | Open                                                                              |
| **Owner**            | Security Team                                                                     |
| **Estimated Effort** | 2 sprints                                                                         |

**Why It Blocks Production**: Static credentials that are never rotated represent an ever-growing risk window. If any credential is ever compromised (via log exposure, insider threat, supply chain attack), it remains valid indefinitely. HIPAA and industry best practice require credentials to be rotated on a defined schedule.

**Current State**: LocalStack (dev) has no secret rotation. AWS Secrets Manager (intended for production) has no rotation Lambda configured. ESO has no refreshInterval configured to pick up rotated secrets. No alert exists for secrets that have not been rotated within policy.

**Remediation Steps**:

1. Define rotation policy: database passwords rotate every 90 days, API keys every 180 days, service credentials every 90 days
2. Configure AWS Secrets Manager automatic rotation for all database credentials (RDS rotation Lambda)
3. Configure ESO refreshInterval: `refreshInterval: 1h` for all ExternalSecret resources
4. Create Prometheus metric: `velya_secret_last_rotated_timestamp` per secret; alert if `time() - last_rotated > 90d`
5. Create rotation runbook for manually-managed secrets (Anthropic API key)
6. Test: rotate a database credential; verify application continues functioning; verify ESO picks up new value within 1h

---

## BLKR-009: No Backup/Restore Validated

| Field                | Value                                                             |
| -------------------- | ----------------------------------------------------------------- |
| **ID**               | BLKR-009                                                          |
| **Title**            | Backup job exists but restoration procedure has never been tested |
| **Category**         | Infrastructure / Compliance                                       |
| **Priority**         | P1                                                                |
| **Status**           | Open                                                              |
| **Owner**            | Infrastructure Team                                               |
| **Estimated Effort** | 1 sprint                                                          |

**Why It Blocks Production**: HIPAA §164.308(a)(7) requires a data backup plan and a testing procedure. An untested backup is not a backup — it is a false assurance. Medplum PostgreSQL contains all patient clinical data; loss of this data without recovery capability would be catastrophic and may be irrecoverable for ongoing patient care.

**Current State**: Kubernetes-level backup mechanism may exist for Medplum PostgreSQL, but no restore test has been performed. RTO and RPO have not been defined or validated.

**Remediation Steps**:

1. Define RTO (Recovery Time Objective) and RPO (Recovery Point Objective) for each data tier: clinical FHIR data (RTO: 4h, RPO: 1h), audit data (RTO: 24h, RPO: 4h)
2. Configure RDS automated backup with 35-day retention (production)
3. Configure PITR (point-in-time recovery) on RDS
4. Execute full restoration test in staging environment: restore Medplum database from backup to a previous point in time, verify data integrity
5. Measure actual RTO from backup restore test; confirm it meets target
6. Document step-by-step restoration procedure in `docs/runbooks/disaster-recovery.md`
7. Schedule quarterly restore test; make restore test result a go/no-go gate for production certification

---

## BLKR-010: No Degraded Mode Implementation

| Field                | Value                                                                              |
| -------------------- | ---------------------------------------------------------------------------------- |
| **ID**               | BLKR-010                                                                           |
| **Title**            | No degraded mode — Medplum unavailability causes complete clinical service failure |
| **Category**         | Clinical Operations / Availability                                                 |
| **Priority**         | P1                                                                                 |
| **Status**           | Open                                                                               |
| **Owner**            | Clinical Team                                                                      |
| **Estimated Effort** | 2 sprints                                                                          |

**Why It Blocks Production**: In a hospital, the clinical software platform cannot simply crash when a dependency is unavailable. Clinical staff must be able to continue operating (even in reduced capacity) and must know the system is degraded. A hospital cannot stop patient care because a FHIR server is temporarily unreachable.

**Current State**: No degraded mode code exists in any service. If Medplum becomes unreachable, all clinical services return 500 errors with no fallback. No degraded mode banner in velya-web.

**Remediation Steps**:

1. Implement Medplum connectivity circuit breaker in patient-flow-service and discharge-orchestrator
2. Implement read-from-cache degraded mode: serve last-known patient state from memory-service when Medplum is unreachable
3. Implement write-queue degraded mode: buffer clinical writes in NATS JetStream for replay when Medplum recovers
4. Block all new AI agent actions during Medplum degradation (cannot verify clinical entities)
5. Implement frontend degraded mode banner: clear visual indicator to clinical staff that data may be stale
6. Implement Medplum health check with auto-recovery: ping every 30 seconds; restore full mode when 3 consecutive successes
7. Test: simulate Medplum pod failure; verify degraded mode activates within 30s; verify staff see banner; verify recovery when restored

---

## BLKR-011: Services Are Scaffolds — No Clinical Logic Implemented

| Field                | Value                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| **ID**               | BLKR-011                                                                                  |
| **Title**            | All 9 clinical and platform services are scaffold NestJS templates with no business logic |
| **Category**         | Clinical Operations                                                                       |
| **Priority**         | P1                                                                                        |
| **Status**           | Open                                                                                      |
| **Owner**            | Clinical Team + Platform Team                                                             |
| **Estimated Effort** | 12–18 sprints (phased implementation)                                                     |

**Why It Blocks Production**: The core value of the Velya platform is AI-assisted hospital operations — patient flow management, discharge coordination, task routing, audit trails. None of these functions exist. The platform cannot perform any clinical operation.

**Current State**: patient-flow-service, discharge-orchestrator, task-inbox-service, audit-service, ai-gateway, policy-engine, memory-service, decision-log-service, and agent-orchestrator all return HTTP 200 from /health endpoints but have no implemented clinical endpoints, no FHIR integration, no NATS subscribers, and no business logic.

**Remediation Steps** (phased):

1. Phase 1: patient-flow-service — FHIR Patient/Encounter integration, bed state machine, NATS publishers
2. Phase 2: discharge-orchestrator — Temporal workflow implementation, discharge criteria evaluation, FHIR updates
3. Phase 3: task-inbox-service — task routing algorithm, priority queue, nurse/physician assignment
4. Phase 4: ai-gateway — LLM integration with PHI minimization, output validation, rate limiting
5. Phase 5: audit-service — FHIR subscription handler, structured audit event model, append-only store
6. Phase 6: policy-engine — clinical rule engine, agent action validation, override logging
7. Phase 7: agent implementations — bed-allocation-agent, discharge-coordinator-agent, early-warning-agent

---

## BLKR-012: No Load or Performance Testing

| Field                | Value                                                                             |
| -------------------- | --------------------------------------------------------------------------------- |
| **ID**               | BLKR-012                                                                          |
| **Title**            | No load testing performed — service capacity under hospital-scale load is unknown |
| **Category**         | Quality / Infrastructure                                                          |
| **Priority**         | P2                                                                                |
| **Status**           | Open                                                                              |
| **Owner**            | Quality Team + Infrastructure Team                                                |
| **Estimated Effort** | 1 sprint (after services are implemented)                                         |

**Why It Blocks Production**: Without load testing, the service capacity for a 500-bed hospital (50–200 concurrent users, 500–2000 FHIR events/hour, 100–500 NATS messages/minute) is unknown. Deploying to production without load validation means the system may fail under real hospital load on day one, with clinical consequences.

**Current State**: No load tests written. No k6, Artillery, or Locust test suite exists. Service resource limits are set to arbitrary defaults, not validated against measured behavior.

**Remediation Steps**:

1. Define load targets: concurrent users (100), NATS events/minute (500), FHIR queries/minute (200), agent invocations/hour (1000)
2. Write k6 load test for api-gateway and patient-flow-service at target load
3. Write NATS load test for discharge-orchestrator consumer at target event rate
4. Run load test in staging; measure P95 response time; verify < 500ms for clinical reads, < 2s for clinical writes
5. Tune resource requests/limits based on measured utilization
6. Run soak test (24-hour sustained load); verify no memory leaks or degradation
7. Document capacity model: service configuration → maximum safe load → scaling triggers

---

## BLKR-013: No Penetration Testing

| Field                | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| **ID**               | BLKR-013                                                     |
| **Title**            | No external penetration test conducted on the Velya platform |
| **Category**         | Security                                                     |
| **Priority**         | P2                                                           |
| **Status**           | Open                                                         |
| **Owner**            | Security Team                                                |
| **Estimated Effort** | External engagement: 2–4 weeks; remediation: 1–2 sprints     |

**Why It Blocks Production**: Without an external penetration test, the platform's security posture has only been assessed by internal teams. External attackers with no knowledge of the internal architecture may find vulnerabilities that internal reviewers missed. For a platform handling PHI, an independent security assessment is both a regulatory expectation and a risk management necessity.

**Current State**: No penetration test has been conducted. The threat model (master-threat-model.md) provides theoretical analysis but no empirical verification.

**Remediation Steps**:

1. Engage qualified penetration testing firm with healthcare/HIPAA experience
2. Scope: all public-facing endpoints, authentication mechanisms, FHIR API, AI/LLM injection surfaces, RBAC boundaries
3. Conduct test on staging environment with production-equivalent configuration
4. Remediate all Critical and High findings before production go-live
5. Re-test after remediation to confirm findings resolved
6. Document pentest report and remediation status for compliance record
7. Schedule annual penetration test post-production

---

## BLKR-014: No Agent Runtime Implementations

| Field                | Value                                                                           |
| -------------------- | ------------------------------------------------------------------------------- |
| **ID**               | BLKR-014                                                                        |
| **Title**            | agents/ directory contains type definition files only — no executing agent code |
| **Category**         | AI/Agent Safety / Clinical Operations                                           |
| **Priority**         | P2                                                                              |
| **Status**           | Open                                                                            |
| **Owner**            | AI Team                                                                         |
| **Estimated Effort** | 6–10 sprints (all 18 agents)                                                    |

**Why It Blocks Production**: The AI-native value proposition of Velya depends on operational agents. Without agent runtime code, the platform is a traditional FHIR viewer and task manager, not the AI-assisted hospital operations platform it is designed to be. The agents are the primary clinical value differentiator.

**Current State**: 18 agent definitions exist as TypeScript type/interface files. None have implementation code. No agent can execute. No LLM calls are made. No clinical recommendations are generated.

**Remediation Steps**:

1. Prioritize by clinical impact: (1) bed-allocation-agent, (2) discharge-coordinator-agent, (3) early-warning-agent
2. Each agent must implement: context assembly (PHI-minimized), ai-gateway call, output validation, NATS publish, audit log
3. Each agent must be tested in shadow mode for minimum 4 weeks before clinical use
4. Each agent must pass adversarial test suite (prompt injection, output manipulation, excessive agency tests)
5. Agent scorecards must be operational before any agent enters active mode
6. Human-in-the-loop gates must be implemented for all Clinical-impact agent actions before activation

---

## BLKR-015: No Compliance Certification

| Field                | Value                                                                                  |
| -------------------- | -------------------------------------------------------------------------------------- |
| **ID**               | BLKR-015                                                                               |
| **Title**            | No compliance certification process initiated — HIPAA, FDA SaMD assessment outstanding |
| **Category**         | Compliance / Regulatory                                                                |
| **Priority**         | P2                                                                                     |
| **Status**           | Open                                                                                   |
| **Owner**            | Compliance Team + Legal                                                                |
| **Estimated Effort** | 3–6 months (compliance engagement)                                                     |

**Why It Blocks Production**: Deploying clinical AI software to a hospital without completing required regulatory assessments exposes both Velya and the hospital to significant legal and regulatory risk. This includes: HIPAA compliance attestation, potential FDA Software as a Medical Device (SaMD) review, and any state-specific health IT regulations.

**Current State**: No compliance assessment initiated. No HIPAA qualified assessor engaged. No FDA pre-submission consultation conducted. No SOC 2 Type II controls in place.

**Remediation Steps**:

1. Engage HIPAA-qualified security assessor for risk assessment and control gap analysis
2. Conduct FDA pre-submission consultation to determine if Velya qualifies as SaMD
3. If SaMD: initiate 510(k) or de novo review process with FDA
4. If not SaMD: document intended use statement that supports exemption
5. Initiate SOC 2 Type II audit engagement (12-month observation period)
6. Complete HITRUST CSF self-assessment (hospital may require this for vendor approval)
7. Obtain BAA signatures from all relevant vendors before production go-live

---

## Production Blocker Summary

| ID       | Title                           | Category               | Priority | Status | Effort        |
| -------- | ------------------------------- | ---------------------- | -------- | ------ | ------------- |
| BLKR-001 | No authentication/authorization | Security/Compliance    | P0       | Open   | 3 sprints     |
| BLKR-002 | No TLS                          | Security               | P0       | Open   | 1–3 sprints   |
| BLKR-003 | No HIPAA framework              | Compliance             | P0       | Open   | 4–8 weeks     |
| BLKR-004 | No PHI audit trail              | Compliance/Security    | P0       | Open   | 2 sprints     |
| BLKR-005 | Near-zero test coverage         | Quality                | P1       | Open   | 3–6 sprints   |
| BLKR-006 | No image scanning               | Security               | P1       | Open   | 1 sprint      |
| BLKR-007 | No ArgoCD Applications          | Infrastructure         | P1       | Open   | 1 sprint      |
| BLKR-008 | No secret rotation              | Security               | P1       | Open   | 2 sprints     |
| BLKR-009 | No backup/restore validated     | Infrastructure         | P1       | Open   | 1 sprint      |
| BLKR-010 | No degraded mode                | Clinical/Availability  | P1       | Open   | 2 sprints     |
| BLKR-011 | Services are scaffolds          | Clinical Operations    | P1       | Open   | 12–18 sprints |
| BLKR-012 | No load testing                 | Quality/Infrastructure | P2       | Open   | 1 sprint      |
| BLKR-013 | No penetration testing          | Security               | P2       | Open   | External      |
| BLKR-014 | No agent runtime                | AI/Clinical            | P2       | Open   | 6–10 sprints  |
| BLKR-015 | No compliance certification     | Compliance             | P2       | Open   | 3–6 months    |

**Total: 15 open production blockers. 0 resolved. Earliest possible production target: 18+ months from current state.**

---

## Production Certification Checklist

Production certification requires all of the following:

- [ ] All 15 blockers at status Resolved or Accepted-with-Control with CTO+CISO signatures
- [ ] HIPAA risk assessment completed by qualified assessor with no unresolved findings
- [ ] BAA signed with all vendors handling PHI
- [ ] External penetration test completed; all Critical/High findings remediated
- [ ] Load testing completed; all services meet latency targets at 1.5× expected load
- [ ] Backup restore test completed; RTO confirmed within target
- [ ] All agents completed minimum 4-week shadow mode with acceptable accuracy
- [ ] Clinical staff training completed on AI limitations and override procedures
- [ ] On-call rotation and incident response procedure documented and tested
- [ ] EKS cluster provisioned, configured, and hardened
- [ ] All ArgoCD Applications in Synced state in production cluster
- [ ] All Prometheus alerts for critical services operational and tested
- [ ] CTO sign-off
- [ ] CISO sign-off
- [ ] Clinical Medical Officer sign-off

---

_This document is reviewed at the start of every sprint. Blockers that are not progressing must be escalated to the CTO within 2 weeks of becoming stale._
