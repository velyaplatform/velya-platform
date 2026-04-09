# Master Gap Register — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Owners**: CTO, CISO, Platform Lead  
**Review Cadence**: Weekly during active development; monthly post go-live  
**Framework**: Severity × Exploitability × Blast Radius  

---

## How to Read This Register

Each gap is assigned:

- **Severity**: Low / Medium / High / Critical / Catastrophic — business and clinical impact if the gap is exploited or triggers failure
- **Exploitability**: 1 (requires deep insider access) → 5 (trivially exploitable by anonymous attacker)
- **Detection Difficulty**: 1 (immediately visible) → 5 (may never be detected without specific tooling)
- **Blast Radius**: Local (one service) / Service (one domain) / Platform (all services) / Clinical (patient harm possible) / Regulatory (legal/HIPAA exposure)

Gaps marked **BLOCKER** prevent production certification. All BLOCKER gaps must reach status **Resolved** or **Accepted with Control** before production go-live.

---

## Gap Categories

1. Security
2. AI/Agent Safety
3. Clinical Operations
4. Infrastructure
5. Data & Privacy
6. Compliance
7. Frontend/UX
8. Governance
9. Cost
10. Testing

---

## Security Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-SEC-001 | Security | No TLS between services — all inter-service communication is plaintext HTTP | Critical | 3 | 2 | Platform | Security | Open | YES |
| GAP-SEC-002 | Security | No container image scanning in CI — Trivy step is a placeholder comment, not an executing scan | High | 4 | 3 | Platform | Security | Open | YES |
| GAP-SEC-003 | Security | No secret rotation policy or automation — LocalStack secrets do not rotate; AWS rotation not configured | High | 2 | 4 | Platform | Security | Open | YES |
| GAP-SEC-004 | Security | No mTLS (mutual TLS) between microservices — service identity not verified at transport layer | Critical | 3 | 3 | Platform | Security | Open | YES |
| GAP-SEC-005 | Security | No Network Policy enforcement at runtime — kindnet does not enforce Kubernetes NetworkPolicy objects despite 12 policies being defined | Critical | 4 | 4 | Platform | Security | Open | YES |
| GAP-SEC-006 | Security | No SBOM (Software Bill of Materials) generated per build — supply chain visibility is zero | High | 2 | 4 | Platform | Security | Open | NO |
| GAP-SEC-007 | Security | No penetration test conducted — no external attacker perspective on the platform | Critical | N/A | N/A | Platform | Security | Open | YES |
| GAP-SEC-008 | Security | No Pod Security Standards (PSS) enforcement verified — namespaces not confirmed to be running in restricted or baseline mode | High | 3 | 3 | Platform | Security | Open | YES |
| GAP-SEC-009 | Security | api-gateway has no rate limiting configured — susceptible to brute-force and DoS against auth endpoints | High | 5 | 2 | Platform | Security | Open | YES |
| GAP-SEC-010 | Security | No WAF (Web Application Firewall) in front of ingress — no protection against OWASP Top 10 at the HTTP layer | High | 4 | 2 | Platform | Security | Open | YES |

### GAP-SEC-001 Detail

**Description**: All HTTP traffic between api-gateway, patient-flow-service, discharge-orchestrator, task-inbox-service, audit-service, and ai-gateway traverses plaintext HTTP. Any attacker with access to the cluster network (e.g., a compromised pod in any namespace) can capture credentials, session tokens, patient identifiers, and clinical data in transit.

**Remediation**:
1. Deploy cert-manager with a ClusterIssuer for internal CA
2. Enable Istio or Linkerd for automatic mTLS in mesh, OR configure per-service TLS with cert-manager certificates
3. Update all Service manifests to use HTTPS ports
4. Update all internal service URLs in ConfigMaps and ExternalSecrets to `https://`
5. Verify with `kubectl exec` into a pod and confirm no plaintext traffic visible via tcpdump

**Timeline**: Sprint +1 (blocker for any production milestone)

---

### GAP-SEC-002 Detail

**Description**: The CI pipeline (`ci.yaml`) has a commented-out Trivy scan step. No container images are scanned for CVEs before push to ECR or deployment. A compromised or vulnerable base image could introduce exploitable vulnerabilities into the clinical runtime.

**Remediation**:
1. Uncomment and complete Trivy scan step in `ci.yaml`
2. Set `--exit-code 1` for CRITICAL and HIGH CVEs
3. Add image scan to release pipeline as a gate
4. Add Trivy to pre-deployment check in ArgoCD sync hooks

**Timeline**: Sprint +1

---

### GAP-SEC-003 Detail

**Description**: No rotation policy exists for any secret. The ESO model defines a `RotationSchedule` metadata tag but no automation enforces rotation. Database passwords, the Anthropic API key, and NATS credentials are effectively static.

**Remediation**:
1. Enable AWS Secrets Manager automatic rotation for all database credentials (Lambda rotation function)
2. Configure ESO refreshInterval to 1h for all ExternalSecret resources
3. Define rotation runbook for manually-managed secrets (API keys)
4. Create a Prometheus alert: `time_since_last_rotation > 90d`

**Timeline**: Sprint +2

---

## AI/Agent Safety Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-AI-001 | AI/Agent Safety | No TypeScript agent runtime implementations — agents/ directory contains only type definition files | Catastrophic | N/A | 1 | Clinical | AI Team | Open | YES |
| GAP-AI-002 | AI/Agent Safety | No prompt injection defenses — no input sanitization before patient data is sent to LLM | Critical | 4 | 5 | Clinical | AI Team | Open | YES |
| GAP-AI-003 | AI/Agent Safety | No output validation on LLM responses — model outputs are passed directly to downstream clinical actions | Catastrophic | 3 | 4 | Clinical | AI Team | Open | YES |
| GAP-AI-004 | AI/Agent Safety | No agent circuit breaker — a looping or malfunctioning agent has no automatic kill switch | Critical | 2 | 4 | Clinical | AI Team | Open | YES |
| GAP-AI-005 | AI/Agent Safety | No human-in-the-loop gate for high-stakes clinical decisions — agents can (in theory) act autonomously on discharge, medication routing | Catastrophic | 3 | 3 | Clinical | AI Team | Open | YES |
| GAP-AI-006 | AI/Agent Safety | No context boundary enforcement — agents receive no enforced limit on what patient data enters LLM context | Critical | 3 | 4 | Clinical | AI Team | Open | YES |
| GAP-AI-007 | AI/Agent Safety | No audit trail for AI inputs/outputs — cannot reconstruct what the model was told or what it recommended | Critical | N/A | 5 | Regulatory | AI Team | Open | YES |
| GAP-AI-008 | AI/Agent Safety | No model version pinning — ai-gateway does not enforce a specific Claude model version; model behavior may change without notice | High | 2 | 4 | Clinical | AI Team | Open | NO |
| GAP-AI-009 | AI/Agent Safety | No MCP tool trust tiers — all tools available to agents are treated with equal trust regardless of destructiveness | Critical | 3 | 4 | Clinical | AI Team | Open | YES |
| GAP-AI-010 | AI/Agent Safety | No agent-to-agent communication integrity checks — NATS subjects have no signature or sender verification | High | 3 | 4 | Platform | AI Team | Open | NO |

### GAP-AI-001 Detail

**Description**: The `agents/` directory contains interface and type definition files for the following agents: admission-assessment-agent, bed-allocation-agent, discharge-coordinator-agent, early-warning-agent, medication-reconciliation-agent, task-routing-agent, and others. None of these have actual runtime implementation code. No agent can execute. The entire AI-native value proposition of Velya is unimplemented.

**Remediation**:
1. Prioritize bed-allocation-agent and discharge-coordinator-agent as first implementations (highest clinical value)
2. Each agent must implement: context assembly, LLM call via ai-gateway, output validation, NATS event publication, audit logging
3. Agent runtime must connect to Medplum FHIR store for patient context
4. All agent actions must be idempotent and audit-logged before execution

**Timeline**: Sprint +2 through Sprint +6 (phased delivery)

---

### GAP-AI-003 Detail

**Description**: When ai-gateway receives an LLM response, the response is forwarded to the calling service with no validation. A model hallucinating a patient name, MRN, bed number, or clinical recommendation has no validation layer between the LLM output and the clinical action. This is the highest severity gap in the system.

**Remediation**:
1. Implement response schema validation (Zod schemas per agent action type)
2. Implement confidence threshold checks — responses below threshold require human review
3. Implement clinical entity verification — referenced patient IDs, bed IDs, medication codes must exist in FHIR store
4. Implement contradiction detection — compare LLM recommendation against policy-engine rules before acting

**Timeline**: Before any agent goes to production

---

## Clinical Operations Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-CLIN-001 | Clinical Operations | patient-flow-service is a scaffold — no real patient flow logic, FHIR resource management, or bed state machine | Catastrophic | N/A | 1 | Clinical | Clinical Team | Open | YES |
| GAP-CLIN-002 | Clinical Operations | discharge-orchestrator is a scaffold — no discharge workflow, no Temporal workflow implementation, no criteria checking | Catastrophic | N/A | 1 | Clinical | Clinical Team | Open | YES |
| GAP-CLIN-003 | Clinical Operations | task-inbox-service is a scaffold — no task routing logic, no priority queue, no assignment algorithm | Critical | N/A | 1 | Clinical | Clinical Team | Open | YES |
| GAP-CLIN-004 | Clinical Operations | No degraded mode implemented — if Medplum (FHIR) is unreachable, all clinical services fail with no fallback | Catastrophic | 3 | 2 | Clinical | Clinical Team | Open | YES |
| GAP-CLIN-005 | Clinical Operations | No audit trail for clinical decisions — cannot trace who ordered what, which agent recommended what, or when | Critical | N/A | 5 | Regulatory | Clinical Team | Open | YES |
| GAP-CLIN-006 | Clinical Operations | No critical alert escalation path — if early-warning-agent detects deterioration and the task-inbox is full, there is no escalation | Catastrophic | 2 | 5 | Clinical | Clinical Team | Open | YES |
| GAP-CLIN-007 | Clinical Operations | No Medplum FHIR subscription implementation — services do not receive real-time FHIR change events | High | N/A | 3 | Clinical | Clinical Team | Open | YES |
| GAP-CLIN-008 | Clinical Operations | No bed management service implemented — bed allocation logic does not exist despite being a core platform capability | Critical | N/A | 1 | Clinical | Clinical Team | Open | YES |
| GAP-CLIN-009 | Clinical Operations | No medication reconciliation logic — medication-reconciliation-agent is a type file with no implementation | Critical | N/A | 1 | Clinical | Clinical Team | Open | YES |
| GAP-CLIN-010 | Clinical Operations | No shift handover workflow — clinical context is not preserved across nursing shift changes | High | N/A | 2 | Clinical | Clinical Team | Open | NO |

---

## Infrastructure Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-INFRA-001 | Infrastructure | ArgoCD has zero Applications configured — GitOps pipeline exists but delivers nothing | Critical | N/A | 1 | Platform | Infra | Open | YES |
| GAP-INFRA-002 | Infrastructure | KEDA has zero ScaledObjects — all services at fixed 1 replica, no autoscaling under load | High | N/A | 2 | Platform | Infra | Open | YES |
| GAP-INFRA-003 | Infrastructure | EKS cluster not provisioned — production compute does not exist | Catastrophic | N/A | 1 | Platform | Infra | Open | YES |
| GAP-INFRA-004 | Infrastructure | No backup/restore tested — Medplum PostgreSQL backup exists but restoration procedure untested | Critical | N/A | 3 | Clinical | Infra | Open | YES |
| GAP-INFRA-005 | Infrastructure | All services run as single replica — no HA for any clinical service | High | N/A | 1 | Platform | Infra | Open | YES |
| GAP-INFRA-006 | Infrastructure | No chaos engineering implemented — failure modes untested under real conditions | High | N/A | 3 | Platform | Infra | Open | NO |
| GAP-INFRA-007 | Infrastructure | No node pool isolation — all workloads share kind nodes; EKS plan missing dedicated pools per workload class | Medium | N/A | 2 | Platform | Infra | Open | YES (EKS) |
| GAP-INFRA-008 | Infrastructure | No load testing performed — service capacity under hospital-scale patient volume is unknown | High | N/A | 2 | Platform | Infra | Open | YES |
| GAP-INFRA-009 | Infrastructure | PriorityClasses not created — velya-system-critical through velya-batch-low PriorityClasses are not deployed | Medium | N/A | 3 | Platform | Infra | Open | NO |
| GAP-INFRA-010 | Infrastructure | No Temporal worker implementations — Temporal is installed but no workflows or activities are registered | Critical | N/A | 1 | Clinical | Clinical Team | Open | YES |
| GAP-INFRA-011 | Infrastructure | MetalLB in L2 mode only — no BGP, no failover between MetalLB speakers | Medium | N/A | 3 | Platform | Infra | Open | NO (dev) |
| GAP-INFRA-012 | Infrastructure | No CDN/edge configured — velya-web serves directly from cluster ingress with no caching layer | Medium | N/A | 2 | Platform | Infra | Open | NO |

---

## Data & Privacy Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-DATA-001 | Data & Privacy | No PHI encryption at rest strategy — Medplum database lacks documented KMS encryption policy; kind cluster has no etcd encryption | Critical | 2 | 4 | Regulatory | Data Team | Open | YES |
| GAP-DATA-002 | Data & Privacy | No data minimization enforcement for LLM context — full patient records may be sent to Anthropic API | Critical | 3 | 5 | Regulatory | Data Team | Open | YES |
| GAP-DATA-003 | Data & Privacy | No NATS dead letter queue — events lost due to consumer failure are unrecoverable and undetected | High | 2 | 5 | Clinical | Platform | Open | YES |
| GAP-DATA-004 | Data & Privacy | No data retention policy implemented — clinical data, logs, and AI decision records accumulate indefinitely | High | N/A | 3 | Regulatory | Data Team | Open | YES |
| GAP-DATA-005 | Data & Privacy | No de-identification pipeline — raw PHI flows directly from Medplum into agent context with no masking | Critical | 3 | 4 | Regulatory | Data Team | Open | YES |
| GAP-DATA-006 | Data & Privacy | Stale FHIR data risk — no cache invalidation strategy for patient data cached in agent memory-service | High | 2 | 5 | Clinical | Data Team | Open | YES |
| GAP-DATA-007 | Data & Privacy | No data classification tagging in NATS subjects — PHI-containing events are indistinguishable from non-PHI events | Medium | 2 | 4 | Regulatory | Data Team | Open | NO |
| GAP-DATA-008 | Data & Privacy | No right-to-erasure (GDPR/HIPAA deletion) implementation — no way to delete a patient's data from all services | High | N/A | 3 | Regulatory | Data Team | Open | NO |
| GAP-DATA-009 | Data & Privacy | Loki logs may contain PHI — NestJS services log request bodies by default; no PHI scrubbing in Promtail pipeline | Critical | 2 | 4 | Regulatory | Data Team | Open | YES |
| GAP-DATA-010 | Data & Privacy | No Business Associate Agreement (BAA) verified with Anthropic — using PHI with Claude API may violate HIPAA | Catastrophic | N/A | 1 | Regulatory | Legal | Open | YES |

---

## Compliance Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-COMP-001 | Compliance | No HIPAA compliance framework — no documented HIPAA controls, no BAA with vendors, no workforce training | Catastrophic | N/A | 1 | Regulatory | Compliance | Open | YES |
| GAP-COMP-002 | Compliance | No audit trail for clinical decisions — violates HIPAA §164.312(b) audit controls requirement | Critical | N/A | 1 | Regulatory | Compliance | Open | YES |
| GAP-COMP-003 | Compliance | No access control at the application layer — no authentication or authorization on frontend or APIs | Critical | 5 | 1 | Platform | Security | Open | YES |
| GAP-COMP-004 | Compliance | No minimum necessary rule enforcement — all clinical users see all patient data regardless of role | Critical | N/A | 2 | Regulatory | Compliance | Open | YES |
| GAP-COMP-005 | Compliance | No breach notification procedure documented or tested | High | N/A | 1 | Regulatory | Compliance | Open | YES |
| GAP-COMP-006 | Compliance | No disaster recovery plan or RTO/RPO defined — HIPAA §164.308(a)(7) contingency plan requirement | High | N/A | 1 | Regulatory | Compliance | Open | YES |
| GAP-COMP-007 | Compliance | No workforce HIPAA training program documented | Medium | N/A | 1 | Regulatory | Compliance | Open | NO |
| GAP-COMP-008 | Compliance | No risk assessment formally documented — HIPAA §164.308(a)(1)(ii)(A) requirement | High | N/A | 1 | Regulatory | Compliance | Open | YES |
| GAP-COMP-009 | Compliance | No SOC 2 Type II controls mapped or in preparation | Medium | N/A | 1 | Platform | Compliance | Open | NO |
| GAP-COMP-010 | Compliance | AI regulatory compliance unknown — FDA guidance on AI/ML-based Software as a Medical Device (SaMD) not assessed | Critical | N/A | 2 | Regulatory | Legal | Open | YES |

---

## Frontend/UX Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-FE-001 | Frontend/UX | Frontend functional score: 8/100 — only a scaffold homepage with 3 feature cards exists | Catastrophic | N/A | 1 | Clinical | Frontend | Open | YES |
| GAP-FE-002 | Frontend/UX | No authentication on frontend — any user with network access can view any page | Catastrophic | 5 | 1 | Clinical | Frontend | Open | YES |
| GAP-FE-003 | Frontend/UX | No role-based workspaces — nurse, physician, administrator views are not differentiated | Critical | N/A | 1 | Clinical | Frontend | Open | YES |
| GAP-FE-004 | Frontend/UX | No real-time data — no WebSocket or SSE connection to backend; all data would be static | Critical | N/A | 1 | Clinical | Frontend | Open | YES |
| GAP-FE-005 | Frontend/UX | No degraded mode UI — if backend is unavailable, user receives no indication | High | N/A | 1 | Clinical | Frontend | Open | YES |
| GAP-FE-006 | Frontend/UX | No accessibility testing — WCAG 2.1 AA compliance required for hospital software not verified | High | N/A | 2 | Clinical | Frontend | Open | YES |
| GAP-FE-007 | Frontend/UX | No error boundary implementation — unhandled React exceptions crash the entire app | High | 2 | 2 | Clinical | Frontend | Open | YES |
| GAP-FE-008 | Frontend/UX | No Content Security Policy headers configured | High | 4 | 2 | Platform | Security | Open | YES |
| GAP-FE-009 | Frontend/UX | No session timeout implementation — once authenticated, session does not expire | High | 3 | 3 | Clinical | Frontend | Open | YES |
| GAP-FE-010 | Frontend/UX | No offline/PWA support — no cached critical views for network degradation | Medium | N/A | 2 | Clinical | Frontend | Open | NO |

---

## Governance Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-GOV-001 | Governance | No change management process for clinical AI — no defined review board or approval gate for agent behavior changes | Critical | N/A | 2 | Clinical | Governance | Open | YES |
| GAP-GOV-002 | Governance | No on-call rotation or incident response procedure | High | N/A | 1 | Platform | Ops | Open | YES |
| GAP-GOV-003 | Governance | No SLA/SLO defined for clinical services — uptime, latency, and availability targets not established | High | N/A | 1 | Platform | Platform | Open | YES |
| GAP-GOV-004 | Governance | No post-incident review process — no process for learning from failures | Medium | N/A | 2 | Platform | Ops | Open | NO |
| GAP-GOV-005 | Governance | No model governance policy — who can approve a new AI model, change prompts, modify agent behavior | Critical | N/A | 2 | Clinical | Governance | Open | YES |
| GAP-GOV-006 | Governance | No vendor risk management process for Anthropic, Medplum, NATS | High | N/A | 2 | Platform | Governance | Open | NO |
| GAP-GOV-007 | Governance | No data stewardship roles defined — no DPO, no clinical data owner, no FHIR administrator | High | N/A | 1 | Regulatory | Governance | Open | YES |
| GAP-GOV-008 | Governance | No feedback loop from clinical staff — no mechanism for nurses/physicians to report AI errors | High | N/A | 3 | Clinical | Governance | Open | YES |

---

## Cost Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-COST-001 | Cost | No AI inference cost controls — no per-agent token budgets, no circuit breakers for runaway LLM calls | High | N/A | 3 | Platform | Platform | Open | NO |
| GAP-COST-002 | Cost | No AWS cost alerting configured — no billing alarms for unexpected EKS, RDS, or API call cost increases | High | N/A | 3 | Platform | Infra | Open | YES (EKS) |
| GAP-COST-003 | Cost | No right-sizing analysis — pod resource requests/limits not validated against actual utilization | Medium | N/A | 3 | Platform | Infra | Open | NO |
| GAP-COST-004 | Cost | No Loki log retention limit — logs accumulate indefinitely; storage cost unbounded | Medium | N/A | 4 | Platform | Ops | Open | NO |
| GAP-COST-005 | Cost | No Prometheus metric cardinality limits — high-cardinality labels can cause OOM in Prometheus | Medium | N/A | 3 | Platform | Ops | Open | NO |

---

## Testing Gaps

| ID | Category | Description | Severity | Exploitability | Detection Difficulty | Blast Radius | Owner | Status | BLOCKER |
|---|---|---|---|---|---|---|---|---|---|
| GAP-TEST-001 | Testing | Near-zero test coverage — 1 stub unit test file exists; no meaningful assertions | Critical | N/A | 1 | Platform | Quality | Open | YES |
| GAP-TEST-002 | Testing | No integration tests — service-to-service interactions not tested | Critical | N/A | 2 | Platform | Quality | Open | YES |
| GAP-TEST-003 | Testing | No end-to-end tests — no Playwright or Cypress test suite for clinical workflows | Critical | N/A | 2 | Clinical | Quality | Open | YES |
| GAP-TEST-004 | Testing | No contract tests — NATS event schema compatibility between producer/consumer not verified | High | N/A | 3 | Platform | Quality | Open | YES |
| GAP-TEST-005 | Testing | No load/performance tests — service behavior under hospital-scale load not characterized | Critical | N/A | 2 | Platform | Quality | Open | YES |
| GAP-TEST-006 | Testing | No agent behavior tests — no test harness for validating agent decision quality | Catastrophic | N/A | 3 | Clinical | Quality | Open | YES |
| GAP-TEST-007 | Testing | No clinical scenario regression tests — discharge workflow, bed allocation, early warning scenarios not tested end-to-end | Critical | N/A | 2 | Clinical | Quality | Open | YES |
| GAP-TEST-008 | Testing | No Chaos Engineering tests — Medplum failure, NATS partition, node eviction not tested | High | N/A | 3 | Platform | Quality | Open | NO |
| GAP-TEST-009 | Testing | No security tests in CI — no DAST, no API fuzzing, no auth bypass tests | Critical | N/A | 2 | Platform | Security | Open | YES |
| GAP-TEST-010 | Testing | No prompt injection test suite — AI input/output combinations not fuzz-tested | Critical | N/A | 3 | Clinical | AI Team | Open | YES |

---

## Gap Summary Dashboard

| Category | Total Gaps | BLOCKER | Critical/Catastrophic | High | Medium | Low |
|---|---|---|---|---|---|---|
| Security | 10 | 8 | 6 | 4 | 0 | 0 |
| AI/Agent Safety | 10 | 8 | 9 | 1 | 0 | 0 |
| Clinical Operations | 10 | 9 | 7 | 3 | 0 | 0 |
| Infrastructure | 12 | 8 | 4 | 6 | 2 | 0 |
| Data & Privacy | 10 | 7 | 6 | 4 | 0 | 0 |
| Compliance | 10 | 8 | 5 | 4 | 1 | 0 |
| Frontend/UX | 10 | 7 | 4 | 5 | 1 | 0 |
| Governance | 8 | 5 | 1 | 6 | 1 | 0 |
| Cost | 5 | 1 | 0 | 3 | 2 | 0 |
| Testing | 10 | 9 | 7 | 2 | 1 | 0 |
| **TOTAL** | **95** | **70** | **49** | **38** | **8** | **0** |

---

## Remediation Priority Order

Priority is determined by the combination of: BLOCKER status + Clinical harm potential + Exploitability.

| Priority | Gap IDs | Rationale |
|---|---|---|
| P0 — Immediate (this sprint) | GAP-FE-002, GAP-COMP-003, GAP-DATA-010, GAP-SEC-005 | Anonymous access to clinical data; PHI to LLM without BAA; NetworkPolicy not enforced |
| P1 — Sprint +1 | GAP-SEC-001, GAP-SEC-002, GAP-INFRA-001, GAP-AI-007 | No TLS; no image scanning; no GitOps; no AI audit trail |
| P2 — Sprint +2 | GAP-AI-001, GAP-CLIN-001, GAP-CLIN-002, GAP-CLIN-003, GAP-TEST-001 | Agent implementations; core clinical services; test coverage |
| P3 — Sprint +3/4 | GAP-AI-002, GAP-AI-003, GAP-DATA-001, GAP-DATA-002, GAP-COMP-001 | Prompt injection; output validation; PHI encryption; HIPAA framework |
| P4 — Pre-production | GAP-INFRA-003, GAP-TEST-005, GAP-SEC-007, GAP-COMP-010 | EKS; load testing; pen test; AI regulatory assessment |

---

*This register is the authoritative source of platform gaps. Each gap must be linked to a corresponding issue in the project tracker. Status updates are required weekly by the owning team.*
