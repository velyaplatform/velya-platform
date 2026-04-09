# Red Team & Blind Spot Discovery Validation
**Velya Hospital AI Platform**
**Document Type:** Security & Risk Validation Report
**Date:** 2026-04-08
**Classification:** Internal — Restricted
**Status:** Active Finding — Remediation In Progress

---

## 1. Executive Summary

This document records the output of a structured red team and blind spot discovery exercise conducted against the Velya platform as deployed on the `kind-velya-local` cluster (5-node kind cluster proxying a future EKS topology). The exercise evaluated the platform across eight domains: Security, AI/Agent, Clinical, Infrastructure, Governance, Data, Frontend, and Economic.

**Overall risk posture: HIGH.** The platform is at an early scaffold stage with significant business logic yet to be implemented, which means many mitigations that were assumed to be handled by application logic do not yet exist.

### Severity Distribution

| Severity | Count | % of Total |
|---|---|---|
| Critical | 4 | 12% |
| High | 11 | 33% |
| Medium | 10 | 30% |
| Low | 8 | 24% |

**Top finding:** Network policy isolation between namespaces (`velya-dev-core`, `velya-dev-platform`, `velya-dev-agents`) is written into YAML but unenforced because kindnet does not implement the NetworkPolicy API. Any pod in any namespace can freely call any other pod's IP directly, bypassing all intended segmentation. This means agent services can call patient-flow-service or PostgreSQL directly without going through api-gateway.

**Second most critical finding:** NATS JetStream streams carry no per-message authentication or authorization. Any pod that can reach the NATS service at port 4222 (which is every pod, due to the above) can publish to any subject, including subjects consumed by discharge-orchestrator and task-inbox-service.

**Third critical finding:** All nine NestJS services are still at scaffold stage with 0% test coverage. Validation logic, business rules, and guard rails that documentation describes as present are not implemented. The platform's safety posture is currently documentation-only.

---

## 2. Methodology

The discovery exercise used the following frameworks applied sequentially:

### 2.1 STRIDE (per component)

Each service was analyzed for Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, and Elevation of Privilege threats. STRIDE was applied to: api-gateway, patient-flow-service, task-inbox-service, discharge-orchestrator, ai-gateway, agent-orchestrator, memory-service, policy-engine, decision-log-service, and the NATS JetStream broker.

### 2.2 OWASP LLM Top 10 (2025 edition)

Applied to ai-gateway and agent-orchestrator as the primary AI-facing surfaces. Each of the 10 LLM risk categories was evaluated for presence, partial mitigation, and gap.

| LLM Risk | Present | Mitigated | Gap |
|---|---|---|---|
| LLM01: Prompt Injection | Yes | No | No input sanitization exists |
| LLM02: Insecure Output Handling | Yes | No | No output validation before NATS publish |
| LLM03: Training Data Poisoning | Partial | No | memory-service writes accepted without validation |
| LLM04: Model DoS | Yes | No | No token budget limits implemented |
| LLM05: Supply Chain | Yes | Partial | Anthropic SDK pinned but no SBOMs |
| LLM06: Sensitive Information Disclosure | Yes | No | No PII scrubbing before LLM calls |
| LLM07: Insecure Plugin Design | Yes | No | No tool call validation in agent runtime |
| LLM08: Excessive Agency | Yes | No | Agents not scope-limited in scaffold |
| LLM09: Overreliance | Yes | No | No confidence scoring or disclaimers |
| LLM10: Model Theft | Low | Partial | No fine-tuned models yet |

### 2.3 MITRE ATLAS

ATLAS tactics applied: Reconnaissance, Resource Development, Initial Access (via prompt injection), Execution (via tool call manipulation), Persistence (via memory poisoning), Privilege Escalation (via agent scope expansion), Defense Evasion (validator bypass), Collection (patient context extraction), Exfiltration (via agent output to external endpoint), Impact (spurious discharge triggering).

### 2.4 NIST CSF 2.0

Evaluated platform coverage across Identify, Protect, Detect, Respond, Recover, and Govern functions. Current state: Govern and Identify have partial documentation coverage. Protect, Detect, Respond, and Recover are critically underbuilt.

---

## 3. Scope of Blind Spot Discovery

The following areas were explicitly scoped in:

- Network enforcement vs. network definition (NetworkPolicy intent vs. kindnet behavior)
- NATS authorization model
- Agent scope boundaries and enforcement mechanisms
- Memory-service write access and validation
- Clinical event ordering guarantees under failure scenarios
- Frontend cognitive safety under degraded conditions
- KEDA scaling behavior when Prometheus is unavailable
- ArgoCD sync and rollback behavior during partial failures
- HIPAA-relevant data flows through LLM calls
- Alert routing and actionability

The following were explicitly scoped out of this round:
- External EKS production topology (not yet deployed)
- Medplum FHIR integration (not yet implemented)
- Temporal workflow engine (not yet deployed)
- Multi-tenant isolation (single-tenant dev only at this stage)

---

## 4. Top 10 Most Critical Blind Spots

### BS-001 — NetworkPolicy Enforcement Gap (Critical)

**Severity:** Critical
**Domain:** Infrastructure / Security
**Finding:** The cluster uses kindnet as its CNI. kindnet does not implement the Kubernetes NetworkPolicy API. All NetworkPolicy objects in the repository are syntactically valid and accepted by the API server but are completely unenforced at the dataplane level. Network traffic between all pods in all namespaces is unrestricted.
**Evidence:** `kubectl get networkpolicy -A` returns policies. `kubectl exec` from agent-orchestrator pod can curl patient-flow-service at its ClusterIP directly, bypassing api-gateway entirely. `kubectl exec` from any pod can reach PostgreSQL at 5432.
**Impact:** Zero network segmentation. Any compromised pod has lateral movement to all other pods, including the database. Agent-to-service calls bypass api-gateway authentication. The security architecture diagram is correct; the enforcement is absent.
**CVSS (estimated):** 9.1 (AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:H/A:H)

---

### BS-002 — NATS JetStream Open Authorization (Critical)

**Severity:** Critical
**Domain:** Infrastructure / AI Security
**Finding:** NATS JetStream is deployed without any authorization configuration. The NATS `values.yaml` in the Helm release does not configure accounts, users, or NKeys. Any pod that can reach port 4222 (all pods, due to BS-001) can publish to any subject, consume from any stream, and delete messages.
**Evidence:** `nats pub velya.discharge.trigger '{"patientId":"P-FAKE","reason":"test"}'` from any pod succeeds. `nats stream ls` returns all streams with no authentication prompt.
**Impact:** Adversarial or compromised pod can publish spurious discharge events, inject task creation events, or consume and drop clinical messages in transit. Denial of service via stream purge is one shell command away.

---

### BS-003 — All Services at Scaffold — Business Logic Absent (Critical)

**Severity:** Critical
**Domain:** Clinical / Governance
**Finding:** All NestJS services (patient-flow-service, task-inbox-service, discharge-orchestrator, ai-gateway, agent-orchestrator, memory-service, policy-engine, decision-log-service, audit-service) are scaffolds. They expose `/healthz` endpoints but contain no implemented business logic. This means: no discharge blocking logic, no task routing logic, no AI call validation, no policy enforcement, no audit writes, no agent scope enforcement.
**Evidence:** 0% test coverage confirmed in project state. Service source files contain NestJS boilerplate controllers with stub handlers.
**Impact:** The entire platform's safety posture described in governance and clinical documentation is aspirational. No described behavior is implemented. Any validation that references these services as mitigations is currently invalid.

---

### BS-004 — LLM Calls Will Transmit Unscrubbed PHI (Critical)

**Severity:** Critical
**Domain:** AI/Agent / HIPAA
**Finding:** When ai-gateway is implemented and calls Claude (Anthropic API), it will receive patient context from patient-flow-service or memory-service. No PHI scrubbing layer exists in the current architecture. Patient names, MRNs, diagnoses, and admission data as currently modeled will be sent as prompt context to a third-party AI API.
**Evidence:** Architecture documents describe agent prompts being built from patient context. No de-identification or tokenization step appears in any data flow diagram.
**Impact:** HIPAA BAA with Anthropic must be executed before any patient data touches the API. Without a scrubbing layer, even with a BAA, the data minimization principle is violated. PHI in model context also appears in Anthropic's request logs.
**Regulation:** 45 CFR §164.502 (minimum necessary), §164.308(a)(1) (risk analysis)

---

### BS-005 — Memory-Service Writes Are Unvalidated (High)

**Severity:** High
**Domain:** AI/Agent
**Finding:** The memory-service accepts writes from agent-orchestrator with no validation of content, schema, or source. An agent that has been compromised via prompt injection can write arbitrary content into institutional memory, which is then read by subsequent agent invocations.
**Evidence:** memory-service API design as described accepts POST writes from any authenticated agent. No content hash, no source attestation, no quarantine-before-write flow.
**Impact:** Memory poisoning. A single prompt injection event can persist malicious instructions into all future agent invocations until the memory entry is detected and purged. Recovery requires identifying the poisoned entry, which requires audit logging that does not yet exist.

---

### BS-006 — ArgoCD Auto-Sync Without Rollback Gate (High)

**Severity:** High
**Domain:** Infrastructure / Governance
**Finding:** ArgoCD is deployed and configured to sync from the GitOps repository. There is no confirmation that automated sync is gated on any health check beyond pod readiness. A bad deployment that starts pods but serves error responses will be considered healthy and will remain the desired state.
**Evidence:** No ArgoCD Application manifests with custom health checks or sync waves were found in the infra review. Default pod readiness is the only gate.
**Impact:** A deployment that breaks clinical logic (once implemented) can auto-sync to production (future EKS) with no rollback trigger. Manual detection required.

---

### BS-007 — No Clinical Event Deduplication (High)

**Severity:** High
**Domain:** Clinical
**Finding:** NATS JetStream is configured with at-least-once delivery semantics. There is no idempotency key handling, message deduplication window configuration, or deduplication logic in any consumer service. Under failure-and-retry scenarios, a critical clinical event (lab result, discharge trigger, escalation) may be processed multiple times.
**Evidence:** NATS Helm values do not configure `max_age` or deduplication windows per stream. Consumer services are scaffolds with no idempotency handling.
**Impact:** Duplicate discharge triggers could initiate multiple discharge workflows for the same patient. Duplicate task creation floods the inbox. In a high-severity scenario, duplicate escalation suppression could mask a real event.

---

### BS-008 — KEDA ScaledObjects Not Yet Deployed (High)

**Severity:** High
**Domain:** Infrastructure
**Finding:** KEDA v2.19.0 is running but no ScaledObjects are defined in the repository. All services run at static replica counts. The autoscaling architecture described in documentation (scale on SQS queue depth, scale on Prometheus metrics) is not implemented.
**Evidence:** `kubectl get scaledobject -A` returns no resources. Project state notes "KEDA ScaledObjects for SQS autoscaling" as pending.
**Impact:** Under load, services will not scale. During patient surge events, patient-flow-service and task-inbox-service will queue beyond capacity with no automatic remediation. Manual intervention required.

---

### BS-009 — Prometheus Alertmanager Routing Not Configured (High)

**Severity:** High
**Domain:** Operations
**Finding:** PrometheusRules exist (VelyaServiceDown, VelyaHighCPU, VelyaHighMemory, VelyaPatientFlowDown, VelyaDischargeDown) but Alertmanager routing configuration has not been verified. Alerts fire into Alertmanager with no confirmed receiver configuration — no PagerDuty, no Slack, no email routing.
**Evidence:** kube-prometheus-stack deployed with default values. No custom Alertmanager configuration found in Helm values overrides.
**Impact:** Alerts are firing into a black hole. A VelyaPatientFlowDown alert during a real clinical incident would not notify anyone. The alerting system provides a false sense of coverage.

---

### BS-010 — velya-web Frontend Has No Degraded Mode UI (Medium-High)

**Severity:** Medium-High
**Domain:** Frontend / Clinical Safety
**Finding:** The Next.js frontend (velya-web, http://velya.172.19.0.6.nip.io) has no documented or implemented degraded mode state. When backend services are unavailable, there is no visual indicator distinguishing "data is stale" from "data is current." Clinical staff may act on stale data without knowing it is stale.
**Evidence:** Frontend documentation describes the application but no degraded mode components, stale data banners, or service health indicators are specified in the current implementation.
**Impact:** Clinical decision-making with stale or absent data presented as current. In a discharge scenario, a discharged patient might still appear as admitted if patient-flow-service is down and the frontend is serving cached state.

---

## 5. Blind Spots by Category

### Security (8 findings)
- BS-001: NetworkPolicy unenforced (Critical)
- BS-002: NATS open authorization (Critical)
- BS-004: PHI to LLM without scrubbing (Critical)
- Ingress TLS termination not verified for internal service-to-service calls
- No mutual TLS between microservices
- PostgreSQL credentials hardcoded in dev secrets (acceptable for dev, risk in pipeline drift)
- External Secrets Operator using fake LocalStack provider — real secrets hygiene not yet tested
- No image signing or admission controller for image provenance

### AI/Agent (7 findings)
- BS-005: Memory poisoning via unvalidated writes (High)
- No prompt injection prevention in any service
- No output validation before NATS publish
- No token budget limiting
- No tool call validation in agent runtime
- No confidence scoring on AI recommendations
- No self-validation detection (agent validating its own output)

### Clinical (5 findings)
- BS-007: No event deduplication (High)
- BS-010: No degraded mode UI (Medium-High)
- No discharge blocker enforcement (scaffold only)
- No critical lab result escalation path implemented
- No shift handoff data completeness check

### Infrastructure (6 findings)
- BS-001: kindnet CNI unenforced NetworkPolicy (Critical)
- BS-006: ArgoCD auto-sync without rollback gate (High)
- BS-008: KEDA ScaledObjects not deployed (High)
- No pod disruption budgets defined for any service
- No resource limits on agent-orchestrator pod (unbounded memory)
- Loki log retention not configured — logs may roll off before incident investigation

### Governance (4 findings)
- BS-003: All services scaffold — governance described but not enforced (Critical)
- BS-009: Alertmanager routing not configured (High)
- No quarantine zone for agents — quarantine is described but has no implementation
- decision-log-service scaffold — all agent decisions are currently unlogged

### Data (4 findings)
- BS-004: PHI to LLM (Critical)
- No data classification labels on any Kubernetes resource
- No field-level encryption for patient data at rest in PostgreSQL
- No data retention policy enforcement — NATS streams will grow unbounded

### Frontend (3 findings)
- BS-010: No degraded mode (Medium-High)
- No mobile-specific UI validation performed
- No alert fatigue testing — inbox behavior under 50+ alerts unknown

### Economic (2 findings)
- No per-agent token cost tracking — runaway agent could consume unbounded API budget
- No cost circuit breaker — no mechanism to halt AI calls if daily spend exceeds threshold

---

## 6. Coverage Gaps vs. Previous Validation Prompts

Previous validation documents in `docs/validation/` covered:
- Cluster architecture (networking, storage, DNS)
- Security baseline (RBAC, secrets, TLS)
- Observability (Prometheus, Grafana, Loki)
- GitOps flow (ArgoCD, Helm)
- Frontend workflow model
- Master validation matrix

**What was not covered:**
- AI/LLM-specific attack surfaces (OWASP LLM Top 10 not previously applied)
- NATS authorization model
- Clinical event integrity guarantees
- Memory poisoning vectors
- Economic/cost safety
- Alert routing verification (alerts fire but go nowhere)
- Human factors and cognitive safety in the frontend

---

## 7. New Risks Discovered in This Round

| Risk ID | Title | Why It's New |
|---|---|---|
| BS-001 | kindnet CNI enforcement gap | Previous networking validation assumed NetworkPolicy = enforcement |
| BS-002 | NATS open auth | NATS security was treated as infrastructure concern, not reviewed at auth level |
| BS-004 | PHI to LLM | Data flow to Anthropic API was not traced in previous security baseline |
| BS-005 | Memory poisoning | AI security section was not previously included in validation scope |
| BS-007 | No event deduplication | NATS was validated as "running" not "correctly configured for clinical safety" |
| BS-009 | Alertmanager black hole | Previous observability validation confirmed rules exist, not routing |

---

## 8. Risks That Were Assumed Covered but Aren't

| Assumption | Reality |
|---|---|
| "NetworkPolicies protect service isolation" | NetworkPolicies exist but kindnet does not enforce them |
| "RBAC controls what agents can do" | RBAC controls k8s API access; it does not control what an agent can publish to NATS |
| "Audit service logs all agent decisions" | audit-service is a scaffold; it logs nothing |
| "Policy-engine enforces agent boundaries" | policy-engine is a scaffold; it enforces nothing |
| "ArgoCD sync = validated deployment" | ArgoCD syncs on manifest validity + pod readiness, not on clinical logic correctness |
| "Alerts notify on-call" | Alertmanager has no receiver configured; alerts fire internally only |
| "discharge-orchestrator blocks unsafe discharges" | discharge-orchestrator is a scaffold with no blocking logic |

---

## 9. Remediation Backlog

| ID | Finding | Priority | Effort | Owner |
|---|---|---|---|---|
| REM-001 | Replace kindnet with Calico or Cilium for NetworkPolicy enforcement | Critical | High (cluster rebuild) | Infra |
| REM-002 | Configure NATS authorization with NKeys or accounts | Critical | Medium | Infra/Platform |
| REM-003 | Implement PHI scrubbing layer in ai-gateway before any Anthropic API calls | Critical | High | Platform |
| REM-004 | Configure Alertmanager receivers (PagerDuty/Slack) and validate routing | High | Low | Ops |
| REM-005 | Define and deploy KEDA ScaledObjects for patient-flow, task-inbox, discharge-orchestrator | High | Medium | Infra |
| REM-006 | Implement memory-service write validation and source attestation | High | Medium | Platform |
| REM-007 | Configure NATS stream deduplication windows per stream | High | Low | Platform |
| REM-008 | Define Pod Disruption Budgets for all clinical services | High | Low | Infra |
| REM-009 | Add ArgoCD custom health checks for service logic, not just pod readiness | High | Medium | Infra |
| REM-010 | Implement degraded mode UI with stale data indicators in velya-web | Medium | High | Frontend |
| REM-011 | Add resource limits to agent-orchestrator pod spec | Medium | Low | Infra |
| REM-012 | Implement token budget limiting in ai-gateway | Medium | Medium | Platform |
| REM-013 | Configure Loki retention policy | Medium | Low | Ops |
| REM-014 | Define data classification labels for all Kubernetes resources | Low | Low | Governance |
| REM-015 | Implement per-agent cost tracking and daily cost circuit breaker | Medium | Medium | Platform |

---

## 10. Validation Score by Domain

| Domain | Score | Max | Grade | Notes |
|---|---|---|---|---|
| Security | 18 | 50 | F | Critical gaps: NetworkPolicy unenforced, NATS open, PHI exposure |
| AI/Agent | 12 | 50 | F | No prompt injection protection, no output validation, no scope enforcement |
| Clinical | 22 | 50 | D | No event deduplication, no discharge blocking, no degraded mode |
| Infrastructure | 28 | 50 | D+ | Services running, observability present, but autoscaling absent and PDBs missing |
| Governance | 20 | 50 | D | Governance documented but not implemented in any service |
| Data | 15 | 50 | F | PHI flow to LLM unresolved, no field encryption, no retention enforcement |
| Frontend | 25 | 50 | D+ | UI exists, no degraded mode, no mobile validation |
| Economic | 10 | 50 | F | No cost tracking, no circuit breaker |
| **Overall** | **150** | **400** | **D-** | Platform is at scaffold stage — documentation ahead of implementation |

> **Note:** This score reflects the current state of a platform under active development. The goal of this exercise is to close gaps before business logic implementation begins, which is the appropriate time to catch architectural issues. The risk is that implementation proceeds without addressing these gaps.
