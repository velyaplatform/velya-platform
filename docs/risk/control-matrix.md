# Control Matrix — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Purpose**: Maps every threat from the Master Threat Model to specific preventive, detective, corrective, and compensating controls  
**Input**: docs/risk/master-threat-model.md  
**Review Cadence**: Quarterly; after any security incident; after any new threat is added  

---

## Control Types

| Type | Definition |
|---|---|
| **Preventive** | Prevents the threat from being realized (e.g., authentication, encryption, input validation) |
| **Detective** | Detects when a threat is being exploited or has been exploited (e.g., alerting, audit logs, anomaly detection) |
| **Corrective** | Reduces impact after a threat is realized (e.g., incident response, rollback, isolation) |
| **Compensating** | Reduces risk when the primary control is missing or infeasible (e.g., manual review compensating for missing automated check) |

## Implementation Status

| Status | Meaning |
|---|---|
| **Implemented** | Control is deployed and verified in the cluster |
| **Partial** | Control exists but is incomplete or has known gaps |
| **Missing** | Control does not exist in any form |
| **N/A-Dev** | Not applicable in dev environment; required before EKS |

---

## Authentication & Authorization Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-AUTH-001 | Preventive | TM-EXT-001, TM-EXT-004, TM-FE-001, TM-FE-006 | OIDC authentication middleware on all api-gateway routes — every request must carry a valid JWT issued by the hospital IdP (Okta/Azure AD) | Missing | api-gateway NestJS guards | Integration test: unauthenticated request returns 401; forged JWT returns 403 | Per-deploy | Security |
| CTL-AUTH-002 | Preventive | TM-EXT-006, TM-FE-006, TM-CLIN-006 | Server-side RBAC enforcement — every API endpoint validates the calling user's role against a policy before processing; roles: physician, nurse, admin, auditor | Missing | api-gateway + per-service middleware | RBAC penetration test: lower-privilege token attempts higher-privilege operation | Weekly automated | Security |
| CTL-AUTH-003 | Preventive | TM-EXT-001, TM-K8S-001 | mTLS between ingress-nginx and api-gateway — service identity verified at transport layer; prevents header spoofing attacks | Missing | ingress-nginx → api-gateway; cert-manager | Verify TLS handshake with curl --cert; curl without cert returns 403 | Per-deploy | Security |
| CTL-AUTH-004 | Preventive | TM-NATS-001, TM-NATS-004 | NATS NKey authentication per service — each microservice has a unique NKey pair; NATS rejects connections from services without valid credentials | Missing | NATS JetStream configuration | Attempt to connect without NKey — verify connection refused | Per-deploy | Platform |
| CTL-AUTH-005 | Preventive | TM-NATS-001, TM-NATS-004 | NATS per-subject authorization — patient-flow publishes to `clinical.patient.*`; discharge-orchestrator subscribes to `clinical.discharge.*`; cross-subject access denied | Missing | NATS authorization configuration | Verify service cannot publish to unauthorized subject | Per-deploy | Platform |
| CTL-AUTH-006 | Preventive | TM-K8S-002, TM-K8S-005 | Kubernetes RBAC minimum privilege — each service account bound only to Role (not ClusterRole) for namespaced operations; ClusterRoles for operators only | Partial | infra/kubernetes/rbac/ | kubectl auth can-i check per service account | Weekly | Platform |
| CTL-AUTH-007 | Preventive | TM-CLIN-001 | Medplum per-client authorization — each service has its own Medplum client ID with scopes limited to its FHIR resource types | Missing | Medplum admin configuration | Verify patient-flow client cannot access Encounter resources; verify discharge client cannot access Observation resources | Per-deploy | Clinical |
| CTL-AUTH-008 | Detective | TM-EXT-006, TM-FE-001 | Authentication failure alerting — Prometheus counter for 401/403 responses; alert fires when > 20 failures in 5 minutes from same source | Missing | Prometheus + Alertmanager | Simulate auth failure burst; verify alert fires | Weekly | Security |
| CTL-AUTH-009 | Corrective | TM-FE-001, TM-EXT-004 | Session revocation capability — when suspicious activity detected, invalidate all active sessions for a user via identity provider API | Missing | IdP integration | Test session invalidation; verify subsequent requests fail | Quarterly | Security |
| CTL-AUTH-010 | Compensating | TM-EXT-004, TM-FE-001 | Network perimeter restriction — while authentication is not implemented, restrict access to velya.nip.io to hospital network IP range only | Partial | ingress-nginx IP allowlist | Verify external IP rejected; hospital IP accepted | Per-deploy | Security |

---

## Encryption Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-ENC-001 | Preventive | TM-EXT-008, TM-AI-003 | TLS on all ingress routes — cert-manager issues certificates; nginx-ingress enforces HTTPS-only; HSTS header set | Missing | infra/kubernetes/ingress/; cert-manager | curl http:// returns 301; curl https:// with valid cert | Per-deploy | Security |
| CTL-ENC-002 | Preventive | TM-EXT-008, TM-CLIN-003 | Inter-service TLS — all service-to-service HTTP calls use HTTPS; certificates from internal CA | Missing | Service client configuration; cert-manager internal CA | tcpdump on inter-service traffic — verify no plaintext | Per-deploy | Security |
| CTL-ENC-003 | Preventive | TM-K8S-003 | etcd encryption at rest — Kubernetes secrets encrypted using AWS KMS envelope encryption | N/A-Dev | EKS cluster configuration | Verify etcd dump does not reveal plaintext secrets | Pre-EKS deploy | Infra |
| CTL-ENC-004 | Preventive | TM-SEC-002, TM-DATA-001 | Database encryption at rest — RDS PostgreSQL encrypted with AES-256 using customer-managed KMS key | N/A-Dev | AWS RDS configuration | Verify KMS key in use; attempt offline disk read without KMS | Pre-EKS deploy | Infra |
| CTL-ENC-005 | Preventive | TM-SEC-003 | Kubernetes secrets encrypted in etcd — EncryptionConfiguration with AES-GCM | N/A-Dev | EKS API server configuration | kubectl get secret -o yaml — verify data is encrypted | Pre-EKS deploy | Infra |
| CTL-ENC-006 | Detective | TM-EXT-008 | TLS certificate expiry alerting — Prometheus alert when certificate expires in < 14 days | Missing | cert-manager + Prometheus | Create test cert expiring in 10 days; verify alert fires | Daily | Platform |
| CTL-ENC-007 | Preventive | TM-FE-003 | No PHI in localStorage or sessionStorage — Next.js components must not persist patient data in browser storage | Missing | Next.js code review | Automated test: inspect localStorage after clinical page load | Per-deploy | Frontend |

---

## AI Safety Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-AI-001 | Preventive | TM-AI-001, TM-AI-002 | Prompt injection defense — structured prompt format separates system instructions from user/patient data using XML delimiters; instruction injection patterns detected and rejected | Missing | ai-gateway prompt assembly | Injection test suite with known prompt injection patterns | Per-deploy + weekly | AI Team |
| CTL-AI-002 | Preventive | TM-AI-003, TM-AI-008 | PHI minimization before LLM call — patient data stripped to minimum required fields before context assembly; patient ID replaced with opaque handle; no raw FHIR bundles sent to Anthropic | Missing | ai-gateway context assembly layer | Inspect LLM call payloads for raw PHI; run automated PHI detector on prompts | Per-deploy | AI Team |
| CTL-AI-003 | Preventive | TM-AI-005 | LLM output schema validation — all agent responses validated against Zod schema before processing; hallucinated fields rejected | Missing | ai-gateway response handler; per-agent output validator | Feed malformed LLM response; verify rejection and alert | Per-deploy | AI Team |
| CTL-AI-004 | Preventive | TM-AI-005 | Clinical entity verification — patient IDs, bed IDs, medication codes, and ward identifiers in LLM output verified against Medplum FHIR store before action execution | Missing | Agent execution layer | Provide LLM output with non-existent patient ID; verify rejection | Per-deploy | AI Team |
| CTL-AI-005 | Preventive | TM-AI-006 | MCP tool trust tiers — tools classified as Read-only, Write-local, Write-external, Irreversible, Clinical-impact; higher tiers require human approval before execution | Missing | platform/policy-engine; MCP tool registry | Verify Write-external tool requires approval flow; verify Read-only tool executes automatically | Per-deploy | AI Team |
| CTL-AI-006 | Detective | TM-AI-007 | Decision audit log — every LLM call recorded in decision-log-service: prompt (sanitized), response, agent ID, patient context handle, calling workflow, timestamp, latency | Missing | decision-log-service | Trigger agent action; verify record appears in decision-log-service within 5s | Per-deploy | AI Team |
| CTL-AI-007 | Preventive | TM-AI-004 | Agent rate limiting — per-agent token budget per hour; circuit breaker when budget exceeded; alert when > 80% of budget consumed | Missing | ai-gateway rate limiting layer | Exhaust per-agent budget; verify circuit breaker fires and error returned | Per-deploy | AI Team |
| CTL-AI-008 | Preventive | TM-AI-004, TM-AI-009 | Model version pinning — ai-gateway enforces specific Claude model version per agent type; version changes require explicit configuration update and review | Missing | ai-gateway model configuration | Verify request without pinned version rejected; verify wrong version rejected | Per-deploy | AI Team |
| CTL-AI-009 | Corrective | TM-AI-004 | Agent circuit breaker — platform/policy-engine can disable individual agents in < 30 seconds; emergency disable via kubectl annotation | Missing | platform/policy-engine; agent-orchestrator | Trigger circuit breaker; verify agent stops accepting tasks within 30s | Monthly | AI Team |
| CTL-AI-010 | Detective | TM-AI-005, TM-AI-002 | Output anomaly detection — statistical detection of LLM outputs that deviate significantly from expected clinical vocabulary, patient IDs, or decision patterns | Missing | ai-gateway output monitoring | Feed known anomalous outputs; verify detection and alert | Weekly | AI Team |
| CTL-AI-011 | Preventive | TM-AI-006 | Human-in-the-loop gate for irreversible clinical actions — discharge approval, medication administration recommendation, DNR flag require physician confirmation before agent proceeds | Missing | discharge-orchestrator; task-inbox-service approval flow | Verify agent cannot complete discharge without physician confirmation | Per-deploy | Clinical |
| CTL-AI-012 | Compensating | TM-AI-001, TM-AI-002 | Anthropic system prompt hardening — system prompt explicitly instructs model to refuse instruction-like content from user data; tested against known prompt injection patterns | Missing | ai-gateway system prompt templates | Run OWASP LLM injection test suite against each agent prompt | Monthly | AI Team |

---

## Network Security Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-NET-001 | Preventive | TM-EXT-005, TM-AI-004 | API rate limiting — nginx-ingress rate limiting by IP (100 req/min per IP) and by authenticated user (500 req/min per JWT sub) | Missing | nginx-ingress configuration; api-gateway throttle guard | Artillery load test at 200 req/min per IP; verify 429 returned | Per-deploy | Security |
| CTL-NET-002 | Preventive | TM-EXT-005 | WAF deployment — AWS WAF or ModSecurity rules in front of ingress; OWASP Core Rule Set enabled | Missing | nginx-ingress ModSecurity / AWS WAF | Send OWASP test payloads; verify blocked | Pre-production | Security |
| CTL-NET-003 | Preventive | TM-EXT-008, TM-SC-004 | Network Policy enforcement — Calico or Cilium CNI to replace kindnet; NetworkPolicy objects take effect | Missing | Cluster CNI (EKS: VPC CNI + NetworkPolicy support) | kubectl exec into pod; verify cannot reach unauthorized service | Per-deploy | Infra |
| CTL-NET-004 | Preventive | TM-SEC-001, TM-AI-010 | Egress network policy — only ai-gateway pod is authorized to reach Anthropic API (api.anthropic.com); all other pods blocked from external internet | Missing | NetworkPolicy egress rules | kubectl exec into patient-flow pod; verify cannot reach anthropic.com | Per-deploy | Security |
| CTL-NET-005 | Detective | TM-EXT-005 | DDoS detection — alert when request rate to any service > 1000 req/min sustained over 2 minutes | Missing | Prometheus metrics + Alertmanager | Load test; verify alert fires | Weekly | Security |
| CTL-NET-006 | Preventive | TM-FE-002 | Content Security Policy — Next.js serves `Content-Security-Policy` header restricting script-src, style-src, connect-src to Velya domains only | Missing | Next.js middleware / nginx-ingress headers | Browser DevTools: verify CSP header present; browser extension CSP tester | Per-deploy | Frontend |
| CTL-NET-007 | Preventive | TM-FE-002, TM-FE-003 | Security headers — X-Frame-Options: DENY; X-Content-Type-Options: nosniff; Referrer-Policy: no-referrer; Permissions-Policy | Missing | nginx-ingress headers configuration | Verify headers with curl -I or securityheaders.com equivalent | Per-deploy | Frontend |

---

## Supply Chain Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-SC-001 | Preventive | TM-SC-001, TM-SC-002 | Container image scanning — Trivy scans all built images in CI; CRITICAL CVEs block the pipeline; HIGH CVEs require documented exception | Partial | .github/workflows/ci.yaml (placeholder) | Verify CI fails when Trivy returns CRITICAL CVE | Per-commit | Security |
| CTL-SC-002 | Preventive | TM-GITOPS-001 | GitHub Actions SHA pinning — all third-party actions referenced by commit SHA, not tag | Implemented | .github/workflows/*.yaml | Verify no `uses: action@v2` in any workflow | Per-PR | Security |
| CTL-SC-003 | Preventive | TM-SC-002 | npm audit enforcement — `npm audit --audit-level=high` in CI; blocks on high or critical findings | Implemented | .github/workflows/ci.yaml | Verify CI fails when high-severity package introduced | Per-commit | Security |
| CTL-SC-004 | Preventive | TM-SC-001, TM-GITOPS-001 | Image signing — cosign signs all images pushed to ECR; cluster admission policy rejects unsigned images | Missing | CI release pipeline; Kyverno ClusterPolicy | Attempt to deploy unsigned image; verify admission rejected | Per-deploy | Security |
| CTL-SC-005 | Detective | TM-SC-003 | SBOM generation and storage — syft generates SBOM per image; stored in ECR alongside image; Grype scans SBOM continuously for new CVEs | Missing | CI release pipeline; ECR | Verify SBOM attached to image; verify Grype scan scheduled | Per-release | Security |
| CTL-SC-006 | Preventive | TM-SC-004 | Container security context enforcement — `runAsNonRoot: true`, `allowPrivilegeEscalation: false`, `readOnlyRootFilesystem: true`, `seccompProfile: RuntimeDefault` for all pods | Missing | Kyverno ClusterPolicy; pod manifests | Deploy non-conforming pod; verify admission rejected | Per-deploy | Security |
| CTL-SC-007 | Preventive | TM-SC-004 | Pod Security Standards — velya namespaces enforced at `restricted` level; kube-system at `privileged` | Missing | Namespace labels: `pod-security.kubernetes.io/enforce: restricted` | Deploy privileged pod in velya namespace; verify rejection | Per-deploy | Security |

---

## Secrets Management Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-SEC-001 | Preventive | TM-GITOPS-004 | Pre-commit secret scanning — git-secrets or gitleaks hook blocks commit containing API keys, passwords, connection strings | Implemented | .claude/hooks/pre-commit | Attempt to commit API key; verify hook blocks | Per-commit | Security |
| CTL-SEC-002 | Preventive | TM-GITOPS-004 | CodeQL secret scanning — GitHub CodeQL workflow scans for secrets in code on every PR | Implemented | .github/workflows/security.yaml | Introduce test secret pattern; verify CodeQL alerts | Per-PR | Security |
| CTL-SEC-003 | Preventive | TM-SEC-001, TM-SEC-002 | ESO secret mounting — secrets mounted as files, not environment variables; files have mode 0400; tmpfs volume | Partial | infra/kubernetes/secrets/ | kubectl exec; ls -la /etc/secrets; verify mode | Per-deploy | Platform |
| CTL-SEC-004 | Preventive | TM-SEC-003 | Kubernetes Secret RBAC — only ESO service account and the owning service account can read a given secret; no wildcard resource access | Partial | infra/kubernetes/rbac/ | kubectl auth can-i get secret --as wrong-service | Per-deploy | Platform |
| CTL-SEC-005 | Preventive | TM-SEC-001 through 005 | Secret rotation — 90-day maximum for static credentials; automated rotation for database passwords via AWS Secrets Manager Lambda rotator | Missing | AWS Secrets Manager rotation configuration | Verify rotation event in CloudTrail; verify app continues functioning after rotation | Quarterly | Security |
| CTL-SEC-006 | Detective | TM-SEC-001, TM-SEC-002 | Secret access audit — CloudTrail records every Secrets Manager GetSecretValue; alert on unexpected access pattern | Missing | AWS CloudTrail; Alertmanager | Trigger unusual access pattern; verify alert fires within 5 minutes | Weekly | Security |
| CTL-SEC-007 | Corrective | TM-GITOPS-004 | Emergency secret rotation runbook — documented procedure to rotate all secrets within 1 hour when compromise suspected | Missing | docs/runbooks/secret-rotation.md | Tabletop exercise: rotate all secrets in staging under 1h | Quarterly | Security |

---

## Audit and Logging Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-AUD-001 | Detective | TM-EXT-003, TM-CLIN-004, TM-FE-004 | Structured clinical audit log — every clinical write operation (create/update/delete on FHIR resources, task assignment, discharge action) emits a structured log event with: actor identity, patient ID, action, resource type, resource ID, timestamp, IP, session ID | Missing | audit-service; each clinical service interceptor | Perform clinical action; verify audit event in Loki within 10s | Per-deploy | Compliance |
| CTL-AUD-002 | Detective | TM-AI-007 | AI decision audit log — every LLM call logged in decision-log-service: sanitized prompt, response, confidence, agent, patient context handle, outcome | Missing | decision-log-service | Trigger agent; verify decision record exists | Per-deploy | AI Team |
| CTL-AUD-003 | Detective | TM-EXT-004, TM-FE-001 | Authentication audit log — every successful and failed authentication attempt logged: user ID, timestamp, IP, user agent, success/failure reason | Missing | api-gateway auth middleware | Perform auth; verify log entry in Loki | Per-deploy | Security |
| CTL-AUD-004 | Preventive | TM-FE-003 | Log PHI scrubbing — Promtail pipeline configuration to redact patient MRNs, names, DOBs, and other PHI patterns from log lines before indexing in Loki | Missing | Loki Promtail pipeline stage configuration | Emit log with PHI pattern; verify Loki stores redacted version | Per-deploy | Compliance |
| CTL-AUD-005 | Detective | TM-NATS-003 | NATS dead letter monitoring — alert when any NATS consumer DLQ has messages; alert fires within 60 seconds of DLQ delivery | Missing | NATS JetStream DLQ; Prometheus NATS exporter | Simulate consumer failure; verify DLQ alert fires | Per-deploy | Platform |
| CTL-AUD-006 | Detective | All repudiation threats | Kubernetes audit log — API server audit log captures all kubectl and API server operations with user identity; shipped to Loki | N/A-Dev | EKS audit log → CloudWatch → Loki | kubectl apply; verify operation appears in audit log | Per-deploy | Platform |
| CTL-AUD-007 | Preventive | TM-EXT-003 | Immutable audit log — audit-service writes to an append-only store (separate database or S3 with object lock); no UPDATE or DELETE permissions on audit records | Missing | audit-service database design | Attempt to delete audit record via service API; verify 405 | Per-deploy | Compliance |

---

## Clinical Safety Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-CLIN-001 | Preventive | TM-AI-005, TM-CLIN-002 | Human-in-the-loop for irreversible actions — discharge final approval, allergy override, medication reconciliation sign-off require physician confirmation | Missing | discharge-orchestrator workflow; task-inbox approval flow | Verify agent cannot complete discharge without MD confirmation; simulate timeout and verify escalation | Per-deploy | Clinical |
| CTL-CLIN-002 | Preventive | TM-CLIN-005 | Temporal workflow timeout enforcement — every Temporal workflow has: scheduleToStartTimeout (10m), startToCloseTimeout (30m), heartbeatTimeout (5m) for activities; workflow-level timeout (24h max) | Missing | discharge-orchestrator Temporal workflow definitions | Simulate stuck activity; verify timeout fires and workflow enters error state | Per-deploy | Clinical |
| CTL-CLIN-003 | Preventive | TM-CLIN-004, TM-AI-007 | Degraded mode — if Medplum FHIR unreachable, services enter read-only mode from cache; display degraded mode banner; no clinical writes during degradation; auto-recovery when FHIR available | Missing | patient-flow-service; discharge-orchestrator; velya-web | Simulate Medplum failure; verify degraded mode activated within 30s | Per-deploy | Clinical |
| CTL-CLIN-004 | Detective | TM-CLIN-006 | Critical alert escalation — early-warning-agent alerts that are not acknowledged within 5 minutes escalate to next clinical tier; if no acknowledgment in 15 minutes, page on-call physician | Missing | early-warning-agent; task-inbox-service; escalation workflow | Simulate unacknowledged critical alert; verify escalation at 5m and 15m | Per-deploy | Clinical |
| CTL-CLIN-005 | Detective | TM-CLIN-002 | FHIR resource change audit — every write to Medplum FHIR store triggers an audit event captured by audit-service Medplum subscription | Missing | audit-service + Medplum FHIR subscription | Modify FHIR resource; verify audit event in audit-service within 5s | Per-deploy | Compliance |
| CTL-CLIN-006 | Corrective | TM-AI-005 | Clinical action rollback — any AI-recommended clinical action that is challenged can be reversed within the same shift; rollback procedure documented in runbook | Missing | docs/runbooks/clinical-action-rollback.md | Tabletop exercise: reverse AI-recommended discharge | Quarterly | Clinical |

---

## Incident Response Controls

| Control ID | Type | Threats Addressed | Description | Status | Location | Test Method | Test Frequency | Owner |
|---|---|---|---|---|---|---|---|---|
| CTL-IR-001 | Corrective | All catastrophic threats | Incident response plan — documented procedure for: PHI breach, ransomware, AI misbehavior, clinical system failure | Missing | docs/runbooks/incident-response.md | Tabletop exercise for each scenario | Quarterly | Security |
| CTL-IR-002 | Corrective | TM-GITOPS-002, TM-SC-001 | Deployment rollback via ArgoCD — ArgoCD can roll back any service to any previous known-good state in < 5 minutes | Missing | ArgoCD application configuration | Deploy bad image; trigger rollback; measure time to previous state | Per-deploy | Platform |
| CTL-IR-003 | Corrective | TM-AI-004, TM-CLIN-005 | Emergency agent disable — platform/policy-engine can disable any agent via kubectl annotation or API call; agent stops accepting tasks within 30 seconds | Missing | platform/policy-engine | Trigger agent disable; verify agent stops within 30s | Monthly | AI Team |
| CTL-IR-004 | Detective | All severity Critical/Catastrophic threats | PagerDuty/Opsgenie integration — Alertmanager routes Critical and Catastrophic alerts to on-call engineer via PagerDuty | Missing | Alertmanager configuration | Trigger test alert; verify PagerDuty page fires | Weekly | Ops |
| CTL-IR-005 | Corrective | TM-CLIN-005 | Database point-in-time recovery — RDS automated backups with 35-day retention; PITR tested quarterly | Missing | AWS RDS PITR configuration | Restore to point-in-time in staging; verify data integrity | Quarterly | Infra |

---

## Control Coverage Summary

| Threat Surface | Total Threats | Controls Implemented | Controls Partial | Controls Missing | Coverage % |
|---|---|---|---|---|---|
| External API | 8 | 1 (CTL-SC-002) | 2 | 5 | 13% |
| AI/LLM Layer | 10 | 0 | 0 | 12 | 0% |
| NATS Communication | 6 | 0 | 0 | 5 | 0% |
| Clinical Data Flows | 6 | 0 | 2 | 4 | 0% |
| GitOps Pipeline | 6 | 2 (SHA pin, npm audit) | 0 | 4 | 33% |
| Container Supply Chain | 4 | 2 (SHA pin, npm audit) | 1 | 1 | 38% |
| Kubernetes Control Plane | 5 | 0 | 1 | 4 | 0% |
| Secrets Management | 5 | 2 (pre-commit, CodeQL) | 1 | 2 | 40% |
| Frontend | 7 | 0 | 0 | 7 | 0% |
| **TOTAL** | **57** | **7** | **7** | **43** | **12%** |

**Overall control implementation rate: 12%**

This represents the current state as of 2026-04-08. The platform has strong preventive controls in the CI/CD supply chain layer (SHA pinning, npm audit, pre-commit hooks) but almost no controls implemented for clinical safety, AI safety, authentication, or network encryption.

---

## Critical Control Gaps (Missing controls with Catastrophic threat coverage)

| Control ID | Description | Threats Blocked | Priority |
|---|---|---|---|
| CTL-AUTH-001 | OIDC authentication on api-gateway | TM-EXT-004, TM-FE-001 | P0 |
| CTL-ENC-001 | TLS on all ingress routes | TM-EXT-008 | P0 |
| CTL-AI-002 | PHI minimization before LLM call | TM-AI-003 | P0 |
| CTL-AI-003 | LLM output schema validation | TM-AI-005 | P0 |
| CTL-AI-011 | Human-in-the-loop for irreversible actions | TM-CLIN-002 | P0 |
| CTL-AUD-001 | Structured clinical audit log | TM-CLIN-004 | P0 |
| CTL-CLIN-003 | Degraded mode implementation | TM-CLIN-005 | P1 |
| CTL-NET-003 | Network Policy enforcement | All lateral movement | P1 |
| CTL-SC-001 | Container image scanning (real, not placeholder) | TM-SC-001 | P1 |

---

*Each control must be linked to a specific test case in the test registry and a Prometheus alert where applicable. Control owners are responsible for maintaining test evidence and updating status quarterly.*
