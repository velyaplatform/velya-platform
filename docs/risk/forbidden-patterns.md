# Forbidden Patterns Registry — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Engineering Policy  
**Authority**: CTO + CISO  
**Enforcement**: PR review rejection + pre-commit hooks + CI checks + Kyverno admission policies  
**Scope**: All code, configuration, manifests, and operational procedures in the Velya platform

---

## Purpose

This registry defines patterns that are explicitly forbidden in the Velya platform. Forbidden patterns are not matters of taste or style — they represent failure modes that have caused or can cause patient harm, security breaches, compliance violations, or production outages. Every engineer, clinical team member, and operator who works on the Velya platform is required to know and enforce these patterns.

A PR that introduces a forbidden pattern must be blocked regardless of other qualities of the change. If a forbidden pattern is found in existing code, it must be remediated within the timeline specified, not deferred.

---

## Domain 1: Code Anti-Patterns

### FP-CODE-001: Secrets in Source Code

**Pattern Name**: Hardcoded Credentials  
**Description**: API keys, database connection strings, passwords, private keys, or bearer tokens embedded directly in source files, configuration files, or test fixtures committed to the git repository  
**Why Forbidden**: Once committed, a secret is permanent in git history even after deletion. Hospital credentials exposed in a public or semi-public repository represent a HIPAA breach. This includes `test` and `dev` credentials — real services are often reachable from dev credentials.  
**Example of Pattern**:

```typescript
// FORBIDDEN
const client = new Anthropic({
  apiKey: 'sk-ant-api03-...',
});

const db = new Pool({
  connectionString: 'postgresql://postgres:password123@localhost:5432/velya',
});
```

**Correct Pattern**:

```typescript
// CORRECT
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY ?? throwIfMissing('ANTHROPIC_API_KEY'),
});
```

**Enforcement**: Pre-commit hook (gitleaks); CodeQL secret scanning on every PR; automated git history scanning monthly  
**Detection**: `gitleaks detect` in pre-commit; GitHub secret scanning

---

### FP-CODE-002: PHI Logging

**Pattern Name**: Unmasked PHI in Log Statements  
**Description**: Patient names, MRNs, dates of birth, addresses, diagnoses, medication names, insurance IDs, or any other HIPAA-covered PHI written to console.log, logger.info, or any structured log sink  
**Why Forbidden**: Logs flow to Loki and are accessible to engineers without clinical data access rights. Log exfiltration is a common attack vector. PHI in logs represents a HIPAA breach if the logs are accessed without authorization.  
**Example of Pattern**:

```typescript
// FORBIDDEN
logger.info(`Processing discharge for patient ${patient.name}, MRN: ${patient.mrn}`);
logger.debug(`Patient DOB: ${patient.birthDate}, insurance: ${patient.insuranceId}`);
```

**Correct Pattern**:

```typescript
// CORRECT
logger.info('Processing discharge', {
  patientHandle: patient.internalId, // opaque handle only
  encounterId: encounter.id,
  workflowId: workflow.id,
});
```

**Enforcement**: ESLint rule `no-phi-logging` (custom plugin); code review mandatory check; Promtail PHI scrubbing pipeline as secondary defense  
**Detection**: ESLint in CI; automated Loki query for PHI patterns in log index

---

### FP-CODE-003: Unhandled Promise Rejections

**Pattern Name**: Fire-and-Forget Clinical Async Operations  
**Description**: Clinical actions (FHIR writes, NATS publishes, Temporal workflow starts) called with `await` missing or rejection not caught, causing silent failures  
**Why Forbidden**: In clinical systems, a silently failed operation (e.g., failed audit log write, failed NATS publish of a discharge event) may have no visible effect on the caller but causes a downstream silent failure that affects patient care.  
**Example of Pattern**:

```typescript
// FORBIDDEN
async function processDischargeCriteria(patient: Patient) {
  fhirClient.update(dischargeResource); // no await — fire and forget
  auditService.log(event); // no await — if this fails, no audit record
  natsClient.publish('discharge.ready', payload); // no await — event may be lost
}
```

**Correct Pattern**:

```typescript
// CORRECT
async function processDischargeCriteria(patient: Patient) {
  await fhirClient.update(dischargeResource); // must await + catch
  await auditService.log(event); // audit must complete before proceeding
  await natsClient.publish('discharge.ready', payload);
}
```

**Enforcement**: TypeScript `no-floating-promises` ESLint rule (enabled, error level); CI lint step  
**Detection**: ESLint in CI (`@typescript-eslint/no-floating-promises: error`)

---

### FP-CODE-004: Direct Medplum Client Access Outside Designated Services

**Pattern Name**: FHIR Access Proliferation  
**Description**: Any service other than the designated clinical services (patient-flow-service, discharge-orchestrator, audit-service) directly creating a Medplum FHIR client and accessing patient records  
**Why Forbidden**: Uncontrolled FHIR access means PHI flows to services that are not designed with appropriate data handling. It also makes access auditing impossible. The minimum necessary principle requires that FHIR access be restricted to services with a documented need.  
**Example of Pattern**:

```typescript
// FORBIDDEN in ai-gateway, task-inbox, or any non-clinical service
import { MedplumClient } from '@medplum/core';
const medplum = new MedplumClient({ baseUrl: process.env.MEDPLUM_URL });
const patient = await medplum.readResource('Patient', patientId);
```

**Correct Pattern**: ai-gateway and other services call patient-flow-service's internal API to get patient context; never access Medplum directly  
**Enforcement**: Architecture review in PR; ESLint rule prohibiting MedplumClient import outside designated services  
**Detection**: `grep -r "new MedplumClient" services/` in CI (non-clinical services); architecture review

---

### FP-CODE-005: catch(e) {} — Silent Exception Swallowing

**Pattern Name**: Silent Error Suppression  
**Description**: Empty catch blocks, catch blocks that only log to console without re-throwing or propagating, catch blocks that swallow exceptions in clinical workflow code paths  
**Why Forbidden**: In clinical systems, any exception that is silently swallowed may represent a missed clinical action, a failed audit record, or a failed alert. Silent failures in clinical code can cause patient harm.  
**Example of Pattern**:

```typescript
// FORBIDDEN
try {
  await sendCriticalAlert(patient, deteriorationEvent);
} catch (e) {
  // silently ignored
}

try {
  await auditService.log(clinicalAction);
} catch (e) {
  console.error(e); // logged but not propagated — the action continues as if audit succeeded
}
```

**Correct Pattern**: Either handle specifically (retry, fallback, compensate) or propagate  
**Enforcement**: ESLint rule `no-empty-catch` for clinical code paths; PR review  
**Detection**: ESLint in CI

---

## Domain 2: Architecture Anti-Patterns

### FP-ARCH-001: Synchronous Direct Service-to-Service Calls for Clinical Events

**Pattern Name**: Synchronous Clinical Event Chain  
**Description**: Clinical workflow events (patient-admitted, discharge-ready, bed-assigned, alert-triggered) propagated via direct HTTP calls between services rather than via NATS JetStream  
**Why Forbidden**: Synchronous HTTP chains create temporal coupling — if any service in the chain is slow or unavailable, the entire chain blocks. Clinical events can be lost if the downstream service is unavailable during the call. NATS JetStream provides durability, replay, and consumer group semantics that HTTP does not.  
**Example of Pattern**:

```typescript
// FORBIDDEN — synchronous event propagation
await httpClient.post('http://task-inbox/tasks', bedAssignmentTask);
await httpClient.post('http://audit-service/events', auditEvent);
await httpClient.post('http://notification-service/notify', notification);
```

**Correct Pattern**: Publish to NATS subject; downstream services are independent NATS consumers  
**Enforcement**: Architecture review; service communication guidelines documented in ADR  
**Detection**: PR review; `grep -r "httpClient.post.*task-inbox\|httpClient.post.*audit" services/` in CI

---

### FP-ARCH-002: Shared Database Between Services

**Pattern Name**: Database Coupling  
**Description**: Two or more microservices reading from or writing to the same PostgreSQL database schema, table, or Medplum FHIR resource type without an explicit service ownership boundary  
**Why Forbidden**: Shared databases create implicit contracts between services. Schema changes in one service break another. It is impossible to scale, replace, or independently deploy services that share a database. PHI access scope becomes uncontrolled.  
**Example of Pattern**: `discharge-orchestrator` connecting to `patient-flow` database to read bed occupancy rather than calling patient-flow API  
**Correct Pattern**: Each service owns its own schema; cross-service data access via internal API only  
**Enforcement**: Per-service database credentials (each service can only reach its own schema); network policy restricting database access  
**Detection**: Database connection string audit; IAM policy review

---

### FP-ARCH-003: Agent Writing Directly to Confirmed FHIR Resources

**Pattern Name**: Autonomous FHIR Mutation  
**Description**: Any AI agent writing, updating, or deleting FHIR resources in the confirmed/canonical resource space without human confirmation  
**Why Forbidden**: AI agents can hallucinate, misinterpret context, or be manipulated via prompt injection. An autonomous write to a confirmed clinical record can introduce incorrect data into the permanent medical record. FHIR data is the source of truth for clinical decisions — contaminating it with unverified AI output can cause patient harm.  
**Example of Pattern**: `discharge-coordinator-agent` calling `fhirClient.update('Encounter', encounterId, { status: 'finished' })` without physician confirmation  
**Correct Pattern**: Agent writes to `Proposed.*` resource or `Draft` extension; human promotes to confirmed via clinical UI  
**Enforcement**: FHIR authorization scopes: agent Medplum clients have only `Proposed.*` write permissions, no update on `Encounter`, `MedicationStatement`, `DiagnosticReport`  
**Detection**: Medplum audit log scan for agent client writes to confirmed resources; Medplum access control test in CI

---

## Domain 3: Agent Anti-Patterns

### FP-AGENT-001: Agents with Unlimited Tool Access

**Pattern Name**: Tool Sprawl  
**Description**: An agent definition that does not explicitly enumerate its allowed tools, or that is granted access to all available MCP tools by default  
**Why Forbidden**: Agents with more tools than they need can be manipulated (via prompt injection) to use unauthorized tools. Minimum necessary tool access limits the blast radius of any single agent compromise.  
**Example of Pattern**:

```typescript
// FORBIDDEN
const agent = new VelyaAgent({
  tools: '*', // all tools
  // or no tools specified — inherits all from registry
});
```

**Correct Pattern**: Every agent definition must include an explicit, minimal `allowedTools` list  
**Enforcement**: Agent factory validation: reject agent definition without explicit `allowedTools`; policy-engine validates tool call against definition at runtime  
**Detection**: Agent definition linter in CI; runtime tool call validation in policy-engine

---

### FP-AGENT-002: Agent Memory Without TTL

**Pattern Name**: Unbounded Memory Growth  
**Description**: Agent memory entries stored in memory-service without a time-to-live; old patient context, prior decisions, and stale clinical state accumulates indefinitely  
**Why Forbidden**: Stale memory causes agents to make decisions on outdated patient state. A patient discharged 6 months ago should not have their context influence a new patient in the same bed. Unbounded memory is also a storage cost risk and a PHI retention violation.  
**Example of Pattern**:

```typescript
// FORBIDDEN
await memoryService.store({
  agentId: 'discharge-coordinator',
  patientHandle: patient.internalId,
  context: patientContext,
  // no TTL set
});
```

**Correct Pattern**: All memory entries require explicit TTL; maximum TTL for clinical context is 24 hours  
**Enforcement**: Memory-service API: reject store request without TTL or with TTL > 24h for clinical records; ESLint rule on memory store calls  
**Detection**: Memory-service API validation; periodic audit of memory-service TTL distribution

---

### FP-AGENT-003: Agent Using Raw Patient Data in LLM Context

**Pattern Name**: PHI in LLM Prompt  
**Description**: An agent assembling LLM context that includes raw PHI (patient name, MRN, DOB, diagnosis) directly in the prompt sent to the Anthropic API  
**Why Forbidden**: PHI transmitted to Anthropic without a BAA violates HIPAA. Even with a BAA, minimum necessary requires that PHI be de-identified or minimized before entering any external system. This is a catastrophic regulatory risk.  
**Example of Pattern**:

```typescript
// FORBIDDEN
const prompt = `
Patient ${patient.name} (MRN: ${patient.mrn}, DOB: ${patient.birthDate})
was admitted on ${encounter.period.start} with diagnosis: ${condition.code.text}.
Please assess discharge readiness.
`;
```

**Correct Pattern**: PHI must be replaced with opaque handles before prompt assembly  
**Enforcement**: PHI detector on LLM prompt at ai-gateway entry point; ESLint rule flagging FHIR patient field access in prompt templates  
**Detection**: Automated PHI pattern scan on LLM prompts in ai-gateway middleware

---

## Domain 4: Security Anti-Patterns

### FP-SEC-001: ClusterRoleBinding to cluster-admin for Service Accounts

**Pattern Name**: Over-Privileged Service Account  
**Description**: Binding a Kubernetes service account (for any Velya service, agent, or tool) to the `cluster-admin` ClusterRole  
**Why Forbidden**: cluster-admin grants full control over the Kubernetes cluster. A compromised pod with cluster-admin service account can exfiltrate all secrets, modify all workloads, and destroy the cluster. Even ArgoCD and ESO should not use cluster-admin.  
**Example of Pattern**:

```yaml
# FORBIDDEN
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: velya-patient-flow-admin
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
  - kind: ServiceAccount
    name: velya-patient-flow
```

**Correct Pattern**: Namespaced Role with minimum necessary verbs on specific resources  
**Enforcement**: Kyverno ClusterPolicy: deny ClusterRoleBinding to cluster-admin for non-system service accounts; CI manifest validation  
**Detection**: `kubectl get clusterrolebindings -o yaml | grep -A5 cluster-admin` — automated check in CI

---

### FP-SEC-002: Privileged Containers

**Pattern Name**: Privileged Pod Security Context  
**Description**: Any Velya service pod running with `privileged: true`, `allowPrivilegeEscalation: true`, `runAsUser: 0` (root), or `capabilities: add: [NET_ADMIN, SYS_ADMIN]`  
**Why Forbidden**: Privileged containers can break out of the container isolation boundary to the host node, gaining access to all pods on that node, host filesystems, and host network interfaces. A compromised clinical service pod that is privileged can compromise the entire cluster node.  
**Example of Pattern**:

```yaml
# FORBIDDEN
securityContext:
  privileged: true
  runAsUser: 0
  allowPrivilegeEscalation: true
```

**Correct Pattern**:

```yaml
# CORRECT
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  seccompProfile:
    type: RuntimeDefault
  capabilities:
    drop: ['ALL']
```

**Enforcement**: Kyverno ClusterPolicy (enforce mode); Pod Security Standards `restricted` on velya namespaces  
**Detection**: `kubectl get pods -A -o jsonpath` audit; Kyverno policy report

---

### FP-SEC-003: Secrets in Environment Variables

**Pattern Name**: Secret Env Var  
**Description**: Kubernetes secrets mounted as environment variables rather than as volume files  
**Why Forbidden**: Environment variables are visible to any process in the pod, to `kubectl describe pod` output, and to some log collectors. Volume-mounted files with mode 0400 are readable only by the process that needs them. Additionally, env var secrets are more likely to be accidentally logged.  
**Example of Pattern**:

```yaml
# FORBIDDEN
env:
  - name: ANTHROPIC_API_KEY
    valueFrom:
      secretKeyRef:
        name: ai-gateway-secrets
        key: anthropic-api-key
```

**Correct Pattern**: Mount secret as volume file; application reads from file path  
**Enforcement**: Kyverno ClusterPolicy: warn on secretKeyRef in env; PR review  
**Detection**: `kubectl get pods -A -o json | jq '.. | .env? // [] | .[] | select(.valueFrom.secretKeyRef)'`

---

## Domain 5: Clinical Data Anti-Patterns

### FP-CLIN-001: Clinical Decision Without Audit Record

**Pattern Name**: Unaudited Clinical Action  
**Description**: Any operation that constitutes a clinical decision (discharge approval, bed assignment, alert acknowledgment, medication reconciliation sign-off) executed without first writing an audit record to audit-service  
**Why Forbidden**: HIPAA §164.312(b) requires audit controls. Any clinical action that is not audited cannot be reconstructed for investigation of adverse events, cannot be used in legal defense, and constitutes a compliance violation.  
**Example of Pattern**:

```typescript
// FORBIDDEN
await fhirClient.update('Encounter', id, { status: 'finished' }); // discharge
// No audit record written
```

**Correct Pattern**: Audit-first pattern — write audit record before executing clinical action; if audit record fails, abort clinical action  
**Enforcement**: NestJS interceptor on all clinical service endpoints; audit required before FHIR write  
**Detection**: FHIR write without prior audit record in same request context; automated audit completeness check

---

### FP-CLIN-002: Bed ID as Patient Identifier

**Pattern Name**: Spatial Patient Reference  
**Description**: Using bed number or room number as a proxy for patient identity in any data model, cache key, or agent context  
**Why Forbidden**: Beds are reused. A patient discharged from bed 14A is replaced by a new patient. Any system that uses bed ID as patient ID will silently serve wrong-patient data to agents processing the new occupant. This is a critical patient safety risk.  
**Example of Pattern**:

```typescript
// FORBIDDEN
const cacheKey = `patient-context:${bedId}`; // wrong!
await memoryService.get(`discharge:${wardId}:${bedNumber}`); // wrong!
```

**Correct Pattern**: Always use patient MRN + admission ID as the compound identifier; bed ID is only a location attribute  
**Enforcement**: ESLint custom rule flagging cache key patterns based on bed/room variables; code review  
**Detection**: Static analysis for cache key construction patterns

---

## Domain 6: Frontend Anti-Patterns

### FP-FE-001: Client-Side RBAC Enforcement Only

**Pattern Name**: Security-by-UI-Hiding  
**Description**: Restricting clinical actions by hiding UI elements (hiding buttons, disabling links) without corresponding server-side authorization enforcement  
**Why Forbidden**: Any user with basic browser developer tools can bypass UI hiding by crafting API requests directly. Clinical access control must be enforced at the server (api-gateway + per-service authorization), not at the client.  
**Example of Pattern**:

```tsx
// FORBIDDEN — security only in the UI
{
  userRole === 'physician' && <button onClick={approveDischarge}>Approve Discharge</button>;
}
// The discharge endpoint has no server-side role check
```

**Correct Pattern**: Server-side: discharge approval endpoint requires `physician` role claim in JWT; client-side: hide button as UX nicety, not as security control  
**Enforcement**: API endpoint RBAC guard on every sensitive action; security tests that call endpoints with wrong-role tokens  
**Detection**: Security test: call protected endpoint with nurse token; verify 403 returned

---

### FP-FE-002: PHI in URL Parameters

**Pattern Name**: PHI in URL  
**Description**: Patient MRNs, patient names, encounter IDs, or other PHI included in URL path parameters or query strings  
**Why Forbidden**: URLs appear in browser history, server access logs (which may not be HIPAA-compliant), proxy logs, referrer headers, and analytics tools. PHI in URLs creates uncontrolled PHI disclosure vectors.  
**Example of Pattern**:

```
// FORBIDDEN
GET /patients/John-Smith-DOB-1985-03-12/discharge
GET /ward/7/patients?mrn=MRN-123456&name=John+Smith
```

**Correct Pattern**: Use opaque internal IDs only in URLs; never patient names or MRNs  
**Enforcement**: URL design review in frontend PR; automated test scanning URL patterns for PHI-like patterns  
**Detection**: Access log analysis for name/DOB/MRN patterns in URL paths

---

### FP-FE-003: localStorage for Clinical Data

**Pattern Name**: PHI in Browser Storage  
**Description**: Patient data, clinical records, session tokens, or any sensitive information stored in `localStorage` or `sessionStorage`  
**Why Forbidden**: Browser storage persists across sessions. Shared workstations (common in hospitals) mean one clinician's data is accessible to the next user. localStorage is also accessible to any JavaScript on the page, making it an XSS exfiltration target.  
**Enforcement**: ESLint custom rule: `no-restricted-globals` for localStorage in components with clinical context; security review  
**Detection**: Browser automated test: inspect localStorage after clinical page interaction

---

## Domain 7: GitOps Anti-Patterns

### FP-GITOPS-001: Manual kubectl apply in Production

**Pattern Name**: Manual Cluster Mutation  
**Description**: Any direct `kubectl apply`, `kubectl delete`, `kubectl patch`, or `helm install/upgrade` executed against the production or staging cluster outside of the ArgoCD sync mechanism  
**Why Forbidden**: Manual mutations: (1) bypass GitOps audit trail — change is not recorded in git, (2) create drift between git and cluster that ArgoCD cannot detect if self-heal is disabled, (3) cannot be rolled back via ArgoCD history, (4) require elevated human access to the cluster, (5) cannot be reviewed or approved before execution.  
**Example of Pattern**:

```bash
# FORBIDDEN in production/staging
kubectl apply -f infra/kubernetes/apps/patient-flow/deployment.yaml
helm upgrade patient-flow ./infra/helm/charts/velya-service
```

**Correct Pattern**: Push manifest change to git → ArgoCD auto-syncs → cluster updated  
**Enforcement**: ArgoCD RBAC: production cluster access restricted to ArgoCD service account; human engineers have read-only kubectl access to production; operational runbook for break-glass procedure  
**Detection**: Kubernetes audit log alert on `kubectl apply` from human user identity in production namespace

---

### FP-GITOPS-002: Unreviewed Merge to Main

**Pattern Name**: Direct Push to Main  
**Description**: Committing directly to the `main` branch, bypassing pull request review, CI checks, and approval gates  
**Why Forbidden**: The CI pipeline enforces security scanning, image scanning, lint, and test checks. Bypassing CI means a commit with secrets, security vulnerabilities, or broken tests reaches the deployment branch without detection. In GitOps, main branch = production deployment trigger.  
**Enforcement**: GitHub branch protection: require PR with 1+ approvals; require CI checks to pass; no direct push  
**Detection**: GitHub audit log; `git log --merges --first-parent main` — all merges should be PR merges

---

## Domain 8: Cost Anti-Patterns

### FP-COST-001: Unbounded Agent Token Usage

**Pattern Name**: Open-Ended LLM Context  
**Description**: An agent that loads all available patient data, full FHIR bundles, complete history, and all supporting documents into LLM context without a defined maximum context size  
**Why Forbidden**: Context size directly maps to API cost. A 200k-token context call to Claude costs approximately 60× more than a 3k-token call. Agents operating at hospital scale with unbounded context can generate hundreds of thousands of dollars in monthly API costs.  
**Example of Pattern**:

```typescript
// FORBIDDEN
const allPatientData = await fhirClient.readAll('Patient', patientId);
const allDocuments = await fhirClient.search('DocumentReference', { patient: patientId });
const prompt = buildPrompt(allPatientData, allDocuments); // potentially 200k tokens
```

**Correct Pattern**: Define maximum context size per agent type; implement context selection (most relevant recent data only); summarize historical data before including  
**Enforcement**: ai-gateway: hard max input token limit per request; agent context builder enforces max fields  
**Detection**: Prometheus metric: `velya_llm_input_tokens_total` histogram; alert on P95 > max budget

---

### FP-COST-002: No Max Replica Count on ScaledObjects

**Pattern Name**: Unbounded Autoscaling  
**Description**: KEDA ScaledObject or HPA without a `maxReplicaCount` configured, allowing unlimited scale-out  
**Why Forbidden**: Without a max replica count, a miscalibrated KEDA trigger or a message burst can scale a service to hundreds of replicas, exhausting node capacity and incurring massive cloud compute costs.  
**Example of Pattern**:

```yaml
# FORBIDDEN
spec:
  scaleTargetRef:
    name: patient-flow-service
  triggers:
    - type: nats-jetstream
      metadata:
        lagThreshold: '10'
  # no maxReplicaCount — unbounded!
```

**Correct Pattern**: Always specify `maxReplicaCount`; set based on capacity model  
**Enforcement**: Kyverno policy: ScaledObject without maxReplicaCount is rejected; CI manifest validation  
**Detection**: `kubectl get scaledobjects -A -o yaml | grep -c maxReplicaCount` — count should match number of ScaledObjects

---

## Forbidden Pattern Summary

| ID            | Domain       | Pattern                                        | Risk         |
| ------------- | ------------ | ---------------------------------------------- | ------------ |
| FP-CODE-001   | Code         | Secrets in source code                         | Catastrophic |
| FP-CODE-002   | Code         | PHI in logs                                    | Critical     |
| FP-CODE-003   | Code         | Unhandled async clinical operations            | Critical     |
| FP-CODE-004   | Code         | Direct FHIR access outside designated services | High         |
| FP-CODE-005   | Code         | Silent exception swallowing                    | High         |
| FP-ARCH-001   | Architecture | Synchronous clinical event chain               | High         |
| FP-ARCH-002   | Architecture | Shared database between services               | High         |
| FP-ARCH-003   | Architecture | Agent writing to confirmed FHIR                | Catastrophic |
| FP-AGENT-001  | Agent        | Unlimited tool access                          | Critical     |
| FP-AGENT-002  | Agent        | Memory without TTL                             | High         |
| FP-AGENT-003  | Agent        | Raw PHI in LLM context                         | Catastrophic |
| FP-SEC-001    | Security     | cluster-admin service accounts                 | Catastrophic |
| FP-SEC-002    | Security     | Privileged containers                          | Critical     |
| FP-SEC-003    | Security     | Secrets as env vars                            | High         |
| FP-CLIN-001   | Clinical     | Clinical decision without audit                | Critical     |
| FP-CLIN-002   | Clinical     | Bed ID as patient identifier                   | Critical     |
| FP-FE-001     | Frontend     | Client-side RBAC only                          | Critical     |
| FP-FE-002     | Frontend     | PHI in URL parameters                          | High         |
| FP-FE-003     | Frontend     | PHI in browser storage                         | High         |
| FP-GITOPS-001 | GitOps       | Manual kubectl in production                   | High         |
| FP-GITOPS-002 | GitOps       | Direct push to main                            | High         |
| FP-COST-001   | Cost         | Unbounded LLM context                          | High         |
| FP-COST-002   | Cost         | No max replica count                           | Medium       |

---

_When a new forbidden pattern is identified from an incident, security review, or clinical safety concern, it must be added to this registry within one sprint cycle. Every engineer onboarding to Velya must complete a review of this document as part of their onboarding checklist._
