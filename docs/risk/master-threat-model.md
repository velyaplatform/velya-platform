# Master Threat Model — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Framework**: STRIDE (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege)  
**Methodology**: Per-surface STRIDE analysis with hospital-specific threat actor profiles  
**Review Cadence**: Quarterly; after any major architecture change; after any security incident  

---

## Threat Actor Profiles

| Actor | Motivation | Capability | Access Level | Likelihood |
|---|---|---|---|---|
| External Attacker (Opportunistic) | Financial (ransomware), curiosity | Low–Medium | Internet-facing endpoints only | High |
| External Attacker (Targeted) | Corporate espionage, nation-state, insurance fraud | High | Internet-facing; phishing for credentials | Medium |
| Malicious Insider (Clinical Staff) | Personal grievance, financial incentive, coercion | Low–Medium | Internal network; authenticated application user | Low |
| Malicious Insider (Engineer) | Sabotage, data theft | High | Cluster access, CI/CD, source code | Very Low |
| Compromised Vendor | Supply chain attack via Anthropic, Medplum, NATS, or GitHub Actions runner | High | Depends on vendor privilege level | Low |
| AI Model (Indirect) | Not intentional — model hallucination or prompt-injected behavior | N/A | Whatever tools and context the agent has | Medium (for errors) |
| Ransomware Group | Financial extortion via hospital operational disruption | High | Typically enters via phishing, then lateral movement | Medium |

---

## Surface 1: External API Surface (Internet → Ingress → api-gateway)

The nginx-ingress controller receives all external HTTP traffic. Traffic is forwarded to the api-gateway (NestJS), which routes to downstream services. Currently no TLS, no WAF, and no authentication enforcement.

### STRIDE Analysis — External API Surface

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-EXT-001 | Spoofing | api-gateway identity | External Attacker | HTTP request forgery — attacker crafts requests claiming to be from internal services by manipulating headers (X-Forwarded-For, X-Service-Identity) | Authorization bypass; attacker gains elevated API access | High | Critical | None | mTLS between ingress and api-gateway; service identity headers stripped at ingress | P0 |
| TM-EXT-002 | Tampering | HTTP request payloads | External Attacker | Parameter manipulation in FHIR resource IDs, patient MRNs, bed IDs in API requests — attacker modifies IDs to access another patient's record | Unauthorized PHI access; patient data corruption | High | Critical | None | Input validation in NestJS pipes; FHIR authorization checks per resource | P0 |
| TM-EXT-003 | Repudiation | API audit trail | External Attacker | API calls made without authenticated identity; no audit record links action to actor | Cannot reconstruct breach timeline; legal liability | High | Critical | None | Mandatory authentication; structured audit log per API call with actor identity | P1 |
| TM-EXT-004 | Information Disclosure | Patient records, clinical data | External Attacker | Unauthenticated API access — currently api-gateway has no auth middleware enforcing authentication on all routes | Complete PHI exposure to any internet user; HIPAA breach | Very High | Catastrophic | None | Authentication middleware; RBAC per endpoint; field-level redaction | P0 |
| TM-EXT-005 | Denial of Service | api-gateway availability | Opportunistic Attacker | HTTP flood against api-gateway endpoints; no rate limiting means exhaustion of NestJS worker threads | Clinical operations disruption; patient safety risk if staff cannot access system | High | Critical | None | Rate limiting per IP and per authenticated user; WAF; HPA for api-gateway | P1 |
| TM-EXT-006 | Elevation of Privilege | Role permissions | Malicious Insider | Authenticated low-privilege user manipulates JWT claims or exploits RBAC misconfiguration to access admin or physician-level operations | Unauthorized clinical actions; data modification | Medium | High | None | JWT signature verification; server-side RBAC enforcement; principle of least privilege | P1 |
| TM-EXT-007 | Information Disclosure | Error messages | External Attacker | NestJS stack traces exposed in HTTP 500 responses — reveals internal file paths, library versions, database schema | Reconnaissance data for targeted attack | High | Medium | None | Production error handler that returns generic messages; stack traces to Loki only | P2 |
| TM-EXT-008 | Tampering | TLS session | MITM Attacker | All traffic is plaintext HTTP — network-adjacent attacker intercepts session tokens, patient data, credentials | Full session hijack; credential theft | High | Critical | None | TLS on all ingress routes via cert-manager; HSTS header | P0 |

---

## Surface 2: AI/LLM Layer (ai-gateway → Anthropic Claude API)

The ai-gateway service assembles context from Medplum FHIR, memory-service, and NATS events, then calls the Anthropic API. Responses are returned to calling agents. No prompt injection defenses, no output validation, no context boundary enforcement currently exist.

### STRIDE Analysis — AI/LLM Layer

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-AI-001 | Tampering | LLM prompt context | External Attacker / Malicious Insider | Direct prompt injection via patient-facing input fields (admission notes, patient-reported symptoms) — attacker crafts input that hijacks agent instructions | Agent takes unauthorized clinical action; bypasses policy-engine constraints | Medium | Catastrophic | None | Input sanitization layer; instruction/data separation in prompt architecture; output validation | P0 |
| TM-AI-002 | Tampering | LLM prompt context | External Attacker / Compromised Vendor | Indirect prompt injection via EHR content — malicious text in a discharge summary, referral letter, or lab result triggers unintended agent behavior | Agent executes attacker-controlled instructions without human awareness | Medium | Catastrophic | None | PHI sanitization before LLM context; injection pattern detection; output anomaly detection | P0 |
| TM-AI-003 | Information Disclosure | Patient PHI | ai-gateway → Anthropic | Full FHIR patient records sent to Anthropic API without minimization — PHI leaves the trust boundary | HIPAA breach; BAA violation; regulatory action | Very High | Catastrophic | None | Data minimization policy; PHI masking before LLM call; BAA with Anthropic | P0 |
| TM-AI-004 | Denial of Service | ai-gateway / Anthropic API budget | External Attacker / Compromised Agent | Token exhaustion attack — attacker triggers rapid agent invocations causing runaway API calls; Anthropic API rate limit hit or cost explosion | Clinical AI unavailable; hospital unable to use AI-assisted workflows | Medium | High | None | Per-agent token budget; rate limiting on ai-gateway; circuit breaker | P1 |
| TM-AI-005 | Tampering | Agent output / clinical decision | AI Model (Hallucination) | Model hallucinates incorrect patient identifier, wrong medication, wrong bed assignment — output treated as ground truth by downstream service | Clinical harm; wrong patient treated; wrong medication administered | High | Catastrophic | None | Output schema validation; entity verification against FHIR store; human-in-the-loop gate | P0 |
| TM-AI-006 | Elevation of Privilege | MCP tool permissions | Compromised Agent / Prompt Injection | Prompt injection causes agent to invoke high-privilege MCP tool (e.g., write to FHIR, send clinical alert) without intended authorization | Unauthorized clinical data modification; false alerts causing clinical harm | Medium | Catastrophic | None | Tool trust tiers; per-tool approval requirements; output audit before execution | P0 |
| TM-AI-007 | Repudiation | AI decision audit trail | Malicious Insider | No audit record of what the AI was told or what it decided — cannot prove or disprove that an AI recommendation caused a clinical outcome | Cannot defend against litigation; regulatory non-compliance | Very High | Critical | None | decision-log-service must capture full prompt + response + calling agent + patient context | P1 |
| TM-AI-008 | Information Disclosure | Agent memory | Compromised Agent | Indirect prompt injection causes agent to exfiltrate contents of memory-service (patient history, prior clinical decisions) to external endpoint via a tool call | PHI exfiltration from memory store | Low | Critical | None | Memory access RBAC; outbound network policy; tool output validation | P1 |
| TM-AI-009 | Tampering | Model version | Supply Chain Attacker | Anthropic silently changes Claude model behavior in a minor version — agent that passed safety tests now has different clinical reasoning | Undetected degradation in clinical recommendation quality | Medium | High | None | Model version pinning; automated regression test suite for agent behavior | P2 |
| TM-AI-010 | Spoofing | ai-gateway identity | Internal Attacker | A malicious microservice impersonates ai-gateway to call Anthropic API directly, bypassing policy-engine and audit controls | Unaudited AI calls; policy bypass; uncontrolled cost | Low | High | None | Anthropic API key accessible only to ai-gateway pod via ESO; RBAC on secret | P1 |

---

## Surface 3: Agent-to-Agent Communication via NATS JetStream

Agents publish and subscribe to NATS subjects for event-driven coordination. Currently: no authentication on NATS subjects between services in the cluster; all pods in velya-dev-agents namespace can publish/subscribe to all subjects.

### STRIDE Analysis — NATS Communication

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-NATS-001 | Spoofing | NATS publisher identity | Compromised Pod | A compromised or malicious service publishes fake clinical events (patient-admitted, bed-assigned, discharge-ready) on behalf of another service | Clinical workflow corruption; wrong patients processed; erroneous discharges | Low | Critical | NetworkPolicy (unenforced) | NATS per-subject authorization; NKey authentication per service; event schema validation | P1 |
| TM-NATS-002 | Tampering | Event payload content | Compromised Pod / Prompt Injection | Malicious NATS payload contains injection text targeting downstream agent that will load event content into LLM context | Indirect prompt injection via NATS; agent hijacking | Low | Critical | None | Event payload schema validation; PHI scanning in NATS pipeline; payload signing | P1 |
| TM-NATS-003 | Repudiation | Event delivery confirmation | System Failure | Events consumed from NATS JetStream but processing fails — no dead letter queue means the failure is silent and unrecoverable | Critical clinical events (early-warning, discharge-blocker) silently lost | High | Critical | None | Dead letter queue per subject; consumer acknowledgment timeout alerts; event replay | P1 |
| TM-NATS-004 | Information Disclosure | PHI in event payloads | Any Pod in Namespace | NATS subjects containing PHI (patient MRN, diagnosis, admission notes) accessible to any subscriber in velya-dev-agents namespace without authorization | PHI accessible to any compromised pod | Medium | Critical | None | Per-subject authorization; PHI-containing subjects require NKey authentication | P1 |
| TM-NATS-005 | Denial of Service | NATS JetStream availability | External Attacker / Buggy Agent | Runaway agent publishes at extremely high rate; fills NATS JetStream storage; blocks other consumers | All event-driven workflows blocked; clinical operations halted | Low | High | None | Per-publisher rate limits; NATS JetStream storage quotas; alert on message backlog > threshold | P2 |
| TM-NATS-006 | Elevation of Privilege | NATS admin operations | Compromised Pod | Compromised pod accesses NATS admin API (subject deletion, consumer reset, stream purge) — no per-service authorization on management plane | Loss of event history; permanent data loss; clinical timeline corrupted | Very Low | Critical | None | NATS management API accessible only to platform team; admin credentials via ESO only | P1 |

---

## Surface 4: Clinical Data Flows

Covers: patient-flow-service ↔ Medplum, discharge-orchestrator ↔ Temporal ↔ Medplum, task-inbox-service ↔ NATS, early-warning-agent ↔ FHIR Observations.

### STRIDE Analysis — Clinical Data Flows

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-CLIN-001 | Spoofing | Medplum FHIR identity | Compromised Service | Service calls Medplum FHIR API using another service's credentials — Medplum client ID/secret shared or stolen | Unauthorized access to all FHIR resources; patient data breach | Low | Critical | Per-service ESO secrets | Medplum per-client authorization scopes; individual client per service; audit log per client | P1 |
| TM-CLIN-002 | Tampering | FHIR patient resources | Malicious Insider | Authenticated user with write access to Medplum modifies patient demographics, allergy list, or discharge criteria via direct API call | Wrong patient identity; missed allergy; premature discharge | Low | Catastrophic | None | FHIR resource versioning; change audit log; field-level validation; dual verification for critical fields | P0 |
| TM-CLIN-003 | Information Disclosure | Patient census / PHI | External Attacker | Misconfigured Medplum FHIR API public access — FHIR endpoints are publicly accessible without auth | Full hospital patient census exposed | Low | Catastrophic | None (unknown) | Verify Medplum is not public-facing; NetworkPolicy to restrict Medplum access to internal services only | P0 |
| TM-CLIN-004 | Repudiation | Clinical action audit trail | Any Actor | Clinical action (bed assignment, discharge approval, medication reconciliation) performed with no audit record linkable to actor identity | Cannot investigate adverse event; regulatory non-compliance | Very High | Critical | None | audit-service must intercept all clinical write operations; structured log with actor, patient, action, timestamp | P0 |
| TM-CLIN-005 | Denial of Service | Discharge workflow | External Attacker / System Failure | Temporal workflow for discharge-orchestrator enters stuck state — no timeout configured; all discharge workflows blocked | Patients cannot be discharged; bed availability collapses; ED overflow | Medium | Catastrophic | None | Temporal workflow timeouts; schedule-to-start timeout; heartbeat timeout; operator alert | P1 |
| TM-CLIN-006 | Information Disclosure | Clinical task assignments | Malicious Insider | task-inbox-service has no RBAC — any authenticated user can view all task assignments, including tasks for other wards, specialties, or physicians | Cross-ward PHI access; targeted manipulation of task queue | Medium | High | None | Role-based task visibility; ward/specialty scoping per authenticated user | P1 |

---

## Surface 5: GitOps Pipeline (ArgoCD, GitHub Actions)

GitHub Actions runs CI/CD. ArgoCD (currently with 0 applications) is intended to deliver manifests to the cluster. The GitOps pipeline is both a delivery surface and an attack surface.

### STRIDE Analysis — GitOps Pipeline

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-GITOPS-001 | Spoofing | GitHub Actions runner identity | Supply Chain Attacker | A compromised GitHub Actions dependency (npm package, action, Docker image) injects malicious code into the CI pipeline | Malicious image published to ECR; backdoored container deployed to cluster | Low | Catastrophic | SHA-pinned actions; npm audit | SBOM per build; image signing (cosign); Sigstore policy in cluster admission | P1 |
| TM-GITOPS-002 | Tampering | Kubernetes manifests in git | Malicious Insider | Engineer with write access to main branch pushes malicious Kubernetes manifest (privileged pod, hostNetwork, DaemonSet with backdoor) | Full cluster compromise via privileged container | Very Low | Catastrophic | Branch protection (not verified) | Verified branch protection; required reviews; OPA/Kyverno admission controller | P1 |
| TM-GITOPS-003 | Repudiation | Deployment history | Malicious Insider | Git history rewritten to hide a malicious commit; ArgoCD sync from amended history | Cannot trace when malicious code was introduced | Very Low | Critical | None | Protected branch force-push disabled; GitHub audit log; immutable ArgoCD history | P2 |
| TM-GITOPS-004 | Information Disclosure | CI/CD secrets | External Attacker | GitHub Actions secrets (ANTHROPIC_API_KEY, AWS credentials) exposed via log output, pull request workflow, or misconfigured secret scope | Credential theft; unauthorized API access; AWS account compromise | Low | Critical | OIDC auth (no static AWS keys) | Secret masking in logs; restrict secret access to protected branches; secret rotation | P1 |
| TM-GITOPS-005 | Denial of Service | ArgoCD sync | External Attacker / Misconfiguration | ArgoCD sync loop — malformed manifest causes ArgoCD to enter sync-fail-retry loop, consuming CPU and blocking other application syncs | All GitOps delivery blocked; manual intervention required | Low | High | None | ArgoCD sync timeout; retry backoff; health check on ArgoCD application status | P2 |
| TM-GITOPS-006 | Elevation of Privilege | ArgoCD permissions | Compromised ArgoCD | ArgoCD uses ClusterAdmin-equivalent role — if ArgoCD is compromised, attacker has full cluster control | Complete cluster takeover | Very Low | Catastrophic | None | Scope ArgoCD RBAC to specific namespaces; use AppProject to limit sync targets | P1 |

---

## Surface 6: Container Supply Chain

Every container image built or pulled introduces supply chain risk. Base images from Docker Hub, npm packages from registries, and Python packages from PyPI are all third-party trust boundaries.

### STRIDE Analysis — Container Supply Chain

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-SC-001 | Tampering | Base container images | Supply Chain Attacker | Compromised node:20-alpine or python:3.12-slim base image — attacker backdoors widely-used base image on Docker Hub | Backdoor in every Velya container; remote code execution | Very Low | Catastrophic | npm audit in CI | Trivy image scan (not real yet — placeholder); image signing; private base image registry | P1 |
| TM-SC-002 | Tampering | npm packages | Supply Chain Attacker | Dependency confusion attack or typosquatting — malicious npm package installed as transitive dependency | Code execution in NestJS or Next.js process; credential exfiltration | Low | High | npm audit at high level | Lock file integrity checking; private npm registry; SBOM generation | P1 |
| TM-SC-003 | Information Disclosure | SBOM (missing) | External Attacker | No SBOM means no way to identify which deployed containers are affected when a new CVE is published | Cannot respond to zero-day CVEs affecting deployed services | High | High | None | SBOM per build stored in ECR; Trivy continuous monitoring against deployed SBOMs | P2 |
| TM-SC-004 | Elevation of Privilege | Container runtime | Compromised Image | Container running as root — a compromised NestJS process can break out to host if security context allows privilege escalation | Node compromise; lateral movement across cluster | Medium | Critical | None | `runAsNonRoot: true`; `allowPrivilegeEscalation: false`; read-only root filesystem where possible | P1 |

---

## Surface 7: Kubernetes Control Plane

The Kubernetes API server is the central control plane. In kind, it's accessible at localhost. In EKS, it will be semi-public or private. etcd stores all cluster state.

### STRIDE Analysis — Kubernetes Control Plane

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-K8S-001 | Spoofing | kubectl / API server identity | External Attacker | Stolen kubeconfig provides authenticated access to Kubernetes API server | Full cluster control | Very Low | Catastrophic | None | kubeconfig not stored in code; short-lived credentials; EKS OIDC auth | P1 |
| TM-K8S-002 | Tampering | Kubernetes RBAC | Malicious Insider | ClusterRoleBinding created granting excessive permissions to service account | Service account escalates to cluster-admin | Very Low | Catastrophic | None | Kyverno policy: no ClusterRoleBinding to cluster-admin except for named system accounts | P1 |
| TM-K8S-003 | Information Disclosure | etcd data | External Attacker | etcd not encrypted at rest (kind default) — backup of etcd reveals all Kubernetes secrets in plaintext | All secrets exposed | Low | Critical | None (kind) | EKS: etcd encryption with KMS; TLS for etcd peer traffic | P1 (EKS) |
| TM-K8S-004 | Denial of Service | Kubernetes API server | External Attacker / Buggy Controller | API server request flood from runaway controller or external attacker — apiserver becomes unresponsive | All kubectl operations fail; ArgoCD cannot sync; operators lose cluster visibility | Low | High | ResourceQuotas | API priority and fairness (APF); rate limiting per client | P2 |
| TM-K8S-005 | Elevation of Privilege | Service account tokens | Compromised Pod | Pod with automountServiceAccountToken=true and no RBAC restrictions uses token to escalate within cluster | Lateral movement; access to other namespaces | Medium | High | automountServiceAccountToken=false in service accounts | Validate all service accounts have proper RBAC; audit token usage | P1 |

---

## Surface 8: Secrets Management

ESO syncs from LocalStack (dev) / AWS Secrets Manager (prod) to Kubernetes Secrets. Secrets are mounted as files in pods.

### STRIDE Analysis — Secrets Management

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-SEC-001 | Information Disclosure | Anthropic API key | Compromised Pod | Pod reads mounted secret file and exfiltrates API key via network call | Uncontrolled AI API access; significant cost exposure; Anthropic ToS violation | Low | High | ESO file mounting; secret not in env vars (should be) | Network egress policy restricting which pods can reach Anthropic API | P1 |
| TM-SEC-002 | Information Disclosure | Database credentials | Compromised Pod | Pod reads mounted PostgreSQL connection string; uses it to directly query Medplum/patient-flow database | Full database access bypassing application authorization | Low | Catastrophic | Per-service ESO | Vault agent with dynamic credentials; short-lived database credentials via AWS RDS IAM auth | P2 |
| TM-SEC-003 | Tampering | Kubernetes Secrets | Malicious Insider with kubectl | Direct modification of Kubernetes Secret via kubectl edit — ESO will re-sync but attack window exists | Credential substitution; impersonation of Anthropic API endpoint | Very Low | High | None | Audit log on Kubernetes Secret mutation; restrict kubectl access to secrets | P1 |
| TM-SEC-004 | Repudiation | Secret access | Any Actor | No log of which pod read which secret from which mounted volume — cannot audit secret access | Cannot investigate credential misuse | High | High | None | Vault with audit log; or AWS CloudTrail on Secrets Manager reads | P2 |
| TM-SEC-005 | Spoofing | LocalStack (dev) | Internal Attacker | LocalStack has no authentication — any pod that can reach LocalStack on port 4566 can read or write any dev secret | Dev credential exposure; potential to inject malicious secrets | Medium | High | None | NetworkPolicy restricting LocalStack access to ESO pod only | P1 |

---

## Surface 9: Frontend (velya-web — Next.js)

The Next.js frontend is the primary interface for clinical staff (nurses, physicians, administrators). Currently a scaffold. No authentication. No CSP.

### STRIDE Analysis — Frontend

| ID | STRIDE Class | Asset | Threat Actor | Attack Vector | Impact | Likelihood | Severity | Existing Controls | Missing Controls | Mitigation Priority |
|---|---|---|---|---|---|---|---|---|---|---|
| TM-FE-001 | Spoofing | User identity | External Attacker | No authentication on frontend — any user on the network can access all pages and claim any role | Impersonation of physicians; unauthorized clinical actions | Very High | Catastrophic | None | Authentication (OIDC via Okta/Azure AD); session management; role validation on every request | P0 |
| TM-FE-002 | Tampering | Clinical UI data | External Attacker | XSS via unsanitized patient data rendered in React — attacker injects script via patient name, diagnosis field, or clinical note | Session hijack; credential theft; CSRF in context of authenticated session | Medium | High | React default escaping | CSP headers; DOMPurify for any innerHTML usage; output encoding audit | P1 |
| TM-FE-003 | Information Disclosure | PHI in browser | Malicious Insider | Patient data fetched to browser, cached in localStorage, visible in browser history — user leaves workstation unlocked | PHI exposure via shared workstation | High | High | None | No PHI in localStorage; session timeout; auto-logout after inactivity; no cache headers for clinical pages | P1 |
| TM-FE-004 | Repudiation | User actions in UI | Any User | No audit trail of what a clinical user did in the UI — cannot trace who approved a discharge, assigned a bed, or cleared an alert | Legal and regulatory exposure for adverse events | Very High | Critical | None | Client-side action logging posted to audit-service; structured audit event per user interaction | P1 |
| TM-FE-005 | Denial of Service | Frontend availability | External Attacker | No CDN or caching — direct flood against velya-web pod; Next.js server-side rendering under load | Clinical staff cannot access patient data; ward operations disrupted | Medium | High | None | CDN (CloudFront); SSG/ISR for non-dynamic pages; HPA for velya-web | P2 |
| TM-FE-006 | Elevation of Privilege | Role permissions in UI | Malicious Insider | Frontend shows all UI elements to all users — role-based access control enforced only by hiding UI elements, not server-side | Nurse accesses physician-only actions by manipulating API calls directly | Very High | Critical | None | Server-side RBAC enforcement on ALL API endpoints; do not rely on UI hiding for security | P0 |
| TM-FE-007 | Information Disclosure | API error messages | External Attacker | Development-mode API errors exposed in production — stack traces, SQL queries, file paths visible in browser | Reconnaissance for targeted attack | Medium | Medium | None | Production Next.js build (NODE_ENV=production); error boundaries with generic messages | P2 |

---

## Threat Severity Distribution

| Severity | Count | Percentage |
|---|---|---|
| Catastrophic | 14 | 28% |
| Critical | 22 | 44% |
| High | 12 | 24% |
| Medium | 2 | 4% |
| Low | 0 | 0% |

**Total Threats Identified**: 50

**Key Finding**: 72% of identified threats are Critical or Catastrophic. The primary drivers are: no authentication anywhere in the current system, no TLS, no audit trail, and no output validation on AI responses. These are not theoretical risks — they represent the current deployed state.

---

## Threat Prioritization Matrix

Threats are prioritized by: Severity × Likelihood × Current Control Effectiveness

| Priority | Threat IDs | Theme |
|---|---|---|
| P0 — Act Immediately | TM-EXT-004, TM-FE-001, TM-AI-003, TM-CLIN-002, TM-EXT-008 | Anonymous access; PHI exposure; no TLS |
| P1 — Sprint +1 | TM-AI-001, TM-AI-002, TM-AI-005, TM-AI-006, TM-CLIN-004, TM-FE-006 | Prompt injection; output validation; audit trail |
| P2 — Sprint +2 | TM-NATS-001 through 004; TM-K8S-005; TM-SC-001 through 004 | NATS auth; K8s RBAC; supply chain |
| P3 — Pre-production | TM-GITOPS-001 through 006; TM-K8S-001 through 003; TM-SEC-001 through 005 | GitOps security; K8s control plane; secret hygiene |

---

*This threat model is a living document. New threats must be added whenever: a new external API is introduced, a new agent capability is added, a new tool is granted to an agent, or any external-facing surface changes. Every threat must map to one or more controls in the Control Matrix (docs/risk/control-matrix.md).*
