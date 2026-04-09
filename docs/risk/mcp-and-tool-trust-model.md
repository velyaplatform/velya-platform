# MCP and Tool Trust Model — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Scope**: All MCP servers and tools available to Velya agents  
**Authority**: AI Safety Team + Security Team + Clinical Medical Officer  
**Review Cadence**: Monthly; whenever a new tool or MCP server is added; after any tool-related incident  

---

## Purpose

Velya agents execute clinical actions in a hospital setting by invoking MCP tools. The fundamental security property required is: **no agent can take a destructive or irreversible clinical action through a tool that was not explicitly authorized for that action type by a human reviewer**.

This model defines a tiered trust system that classifies every tool by its potential impact, assigns approval requirements proportional to that impact, and establishes monitoring and audit obligations per tier.

---

## Tool Classification Tiers

### Tier 0: Read-Only, Internal

**Definition**: Tools that only read data from internal Velya or Medplum systems. No writes. No external calls. No side effects.

**Examples**:
- `fhir_read_patient` — reads FHIR Patient resource by ID
- `fhir_search_encounters` — searches active Encounters by ward
- `fhir_read_vitals` — reads Observation resources for a patient
- `fhir_read_bed_status` — reads current BedAvailability resources
- `memory_service_get` — reads agent memory for a patient context
- `task_inbox_list` — lists tasks for a given nurse/physician assignment
- `decision_log_query` — queries prior AI decisions for a patient

**Trust Level**: Trusted for automated execution by any authorized agent  
**Approval Requirements**: None — executes automatically on agent request  
**Monitoring Requirements**: Basic usage logging (which agent, which patient handle, timestamp)  
**Audit Requirements**: Daily audit log review for anomalous access patterns  
**Rate Limiting**: 100 calls/minute per agent instance  

---

### Tier 1: Write-Local, Reversible

**Definition**: Tools that write to internal Velya systems (not Medplum confirmed resources). Writes are reversible (can be undone or overwritten). No external notifications sent.

**Examples**:
- `memory_service_store` — stores patient context in agent memory (with TTL)
- `task_inbox_update_priority` — updates priority of an existing task
- `task_inbox_add_note` — adds a note to an existing task
- `fhir_create_proposed_resource` — creates a Draft/Proposed FHIR resource (not confirmed)
- `decision_log_create` — creates a decision log entry
- `bed_status_reserve` — soft-reserves a bed (reversible until confirmed)

**Trust Level**: Trusted for automated execution by agents in their defined scope  
**Approval Requirements**: None for automated execution; tool must verify agent has write scope for the resource type  
**Monitoring Requirements**: Full tool invocation log with before/after state  
**Audit Requirements**: All writes audited; weekly audit review per tool type  
**Rate Limiting**: 50 calls/minute per agent instance  

---

### Tier 2: Write-External, Reversible

**Definition**: Tools that trigger communications to external systems or people. Messages can be retracted if caught quickly, but recipient may have already read/acted.

**Examples**:
- `notify_clinical_staff` — sends a push notification to a nurse or physician
- `send_internal_alert` — posts an internal clinical alert to the task inbox
- `send_pager_notification` — sends a pager notification (urgent)
- `create_patient_transport_request` — requests patient transport from porters
- `request_pharmacy_review` — sends a medication review request to pharmacy

**Trust Level**: Requires agent confidence > 0.85; output anomaly scan passes  
**Approval Requirements**: Automated execution allowed ONLY if confidence > 0.85 AND output passes anomaly detection. Otherwise requires human confirmation.  
**Monitoring Requirements**: Every invocation logged with recipient, message content, sender agent, patient handle  
**Audit Requirements**: Real-time alert if > 10 notifications sent by a single agent in 5 minutes (possible loop); daily review  
**Rate Limiting**: 10 calls/5-minutes per agent instance; hard limit 50/hour  

---

### Tier 3: Irreversible

**Definition**: Tools whose effects cannot be undone once executed, or where reversal has significant overhead.

**Examples**:
- `fhir_update_encounter_status` — updates an Encounter status to 'finished' (discharge)
- `fhir_create_clinical_order` — creates a clinical order in Medplum
- `delete_task_from_inbox` — permanently removes a task
- `close_admission_workflow` — terminates a Temporal admission workflow
- `mark_bed_as_unavailable` — takes a bed out of service

**Trust Level**: Human confirmation required before execution  
**Approval Requirements**: MANDATORY human approval token before tool invocation. Agent must present recommendation + evidence; human must explicitly confirm. Approval token is single-use with 5-minute expiry.  
**Monitoring Requirements**: Real-time alert on every invocation; before/after state recorded  
**Audit Requirements**: Every invocation appears in audit trail with human approver ID; clinical officer reviews weekly  
**Rate Limiting**: 5 calls/hour per agent instance; human approval is rate-limiting anyway  

---

### Tier 4: Clinical-Impact (Potentially Life-Affecting)

**Definition**: Tools that directly affect patient clinical status, medication, or safety decisions. The consequences of an error are potentially clinical harm or adverse event.

**Examples**:
- `medication_reconciliation_finalize` — marks medication reconciliation as complete (pharmacist sign-off equivalent)
- `discharge_patient_final` — executes final patient discharge from hospital
- `escalate_deterioration_to_rapid_response` — triggers rapid response team activation
- `approve_dnr_flag` — records patient DNR preference in FHIR
- `override_allergy_alert` — records allergy override with rationale
- `activate_mass_casualty_protocol` — triggers hospital-wide mass casualty response

**Trust Level**: Physician or senior clinical officer required; agent role is advisory only  
**Approval Requirements**: (1) Agent generates recommendation with full evidence chain. (2) Recommendation presented to relevant clinician (physician, charge nurse, pharmacist) via Velya UI. (3) Clinician explicitly confirms or overrides. (4) Clinician identity verified at confirmation time (re-authentication prompt). (5) Tool executes only with confirmed clinician approval token.  
**Monitoring Requirements**: Immediate audit record; real-time notification to clinical supervisor; monthly clinical outcome review per action type  
**Audit Requirements**: Every execution linked to: agent recommendation, evidence cited, clinician identity, clinician review time, clinician decision, outcome tracking for 30 days post-action  
**Rate Limiting**: No automated rate limit — human approval is the gate. Alert if > 3 Tier 4 actions in 10 minutes for same patient (possible attack or error)  

---

## Forbidden Tool Capabilities

The following capabilities must NEVER be implemented as tools available to any Velya agent, regardless of tier:

| Forbidden Capability | Reason |
|---|---|
| Direct database modification (SQL UPDATE/DELETE outside FHIR API) | Bypasses FHIR access controls and audit trail; data integrity risk |
| Access to other patients' data beyond the current workflow scope | Violates minimum necessary; PHI access beyond agent scope |
| Reading or writing Kubernetes cluster configuration | Separation of AI and infrastructure planes |
| Accessing secret values (API keys, database passwords) | Credential exfiltration risk |
| Sending email to external addresses (outside hospital domain) | PHI exfiltration vector |
| Making HTTP requests to arbitrary external URLs | Data exfiltration and SSRF risk |
| Reading or modifying agent configuration or prompts | Self-modification prohibition |
| Executing shell commands on any host | Remote code execution risk |
| Modifying audit records | Audit trail integrity |
| Granting or revoking permissions for other agents or users | Privilege escalation |

---

## MCP Server Security Requirements

Any MCP server registered for use with Velya agents must meet the following requirements:

### Authentication and Authorization

```typescript
interface MCPServerRequirements {
  authentication: {
    required: true;
    method: 'mTLS' | 'JWT' | 'API-key-with-rotation';
    rotationPeriodDays: number; // max 90
  };
  authorization: {
    perToolGranularity: true;    // Each tool has its own authorization check
    agentIdRequired: true;       // Tool must verify calling agent identity
    patientScopeEnforced: true;  // Tool must verify agent has scope for patient
  };
  audit: {
    logEveryInvocation: true;
    logInputArgs: true;          // Sanitized — no PHI
    logOutputSchema: true;       // Schema metadata, not full output
    retentionDays: 2555;         // 7 years for HIPAA
  };
  availability: {
    healthEndpoint: '/health';
    timeoutMs: 5000;
    retryPolicy: 'exponential-backoff-max-3';
  };
}
```

### MCP Server Registration

All MCP servers must be registered in the platform/policy-engine tool registry before any agent can invoke their tools:

```typescript
// platform/policy-engine/src/tool-registry/registry.ts

interface ToolRegistryEntry {
  toolId: string;               // e.g., 'fhir.patient.read'
  mcpServer: string;            // e.g., 'medplum-mcp-server'
  tier: 0 | 1 | 2 | 3 | 4;
  allowedAgentIds: string[];    // Explicit list; no wildcards
  allowedPatientScopes: ('assigned' | 'ward' | 'all')[];
  requiresHumanApproval: boolean;
  maxCallsPerMinute: number;
  description: string;
  clinicalRationale: string;
  approvedBy: {
    technicalReviewer: string;
    clinicalReviewer: string;  // Required for Tier 3 and 4
    approvedDate: string;
  };
}
```

---

## Tool Output Validation Requirements

All tool outputs (results returned to the agent) must be validated before the agent processes them:

### Validation Rules by Tier

| Tier | Schema Validation | PHI Minimization | Anomaly Check | Clinical Entity Verify |
|---|---|---|---|---|
| Tier 0 | Required | Required | Optional | Recommended |
| Tier 1 | Required | Required | Required | Required |
| Tier 2 | Required | Required | Required | Required |
| Tier 3 | Required | Required | Required | Required — before presenting to human |
| Tier 4 | Required | Required | Required | Required — before presenting to clinician |

### Tool Output PHI Minimization

Tool output must not include PHI fields not required for the agent's declared task:

```typescript
// Tool output for bed-allocation-agent: 
// ALLOWED fields:
{
  bedId: 'BED-7A-12',
  ward: 'CARDIOLOGY-7A',
  status: 'available',
  lastOccupiedAt: '2026-04-07T14:30:00Z',  // timestamp only, no patient info
  requiredEquipment: ['oxygen', 'telemetry']
}

// FORBIDDEN fields in the same tool output for this agent:
{
  lastPatientId: 'P001',          // wrong patient PHI
  lastPatientDiagnosis: 'NSTEMI', // PHI not needed for bed allocation
  lastPatientName: 'John Smith'   // PHI
}
```

---

## Rate Limiting Requirements Per Tool Tier

```yaml
# infra/kubernetes/config/mcp-rate-limits.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-tool-rate-limits
  namespace: velya-dev-platform
data:
  tier0-calls-per-minute: "100"
  tier1-calls-per-minute: "50"
  tier2-calls-per-5min: "10"
  tier2-calls-per-hour: "50"
  tier3-calls-per-hour: "5"  # human approval gate is primary rate limit
  tier4-max-without-review: "3"  # alert if > 3 in 10 minutes for same patient
  
  # Per-agent absolute limits (regardless of tier)
  max-total-tool-calls-per-agent-per-hour: "500"
  
  # Circuit breaker thresholds
  circuit-breaker-error-threshold: "5"  # consecutive errors before open
  circuit-breaker-recovery-timeout-seconds: "30"
```

---

## Approval Workflow for Tier 3 and 4 Tools

### Approval Token Architecture

```typescript
// platform/policy-engine/src/approval/approval-service.ts

interface ApprovalRequest {
  requestId: string;             // UUID
  agentId: string;
  toolId: string;
  tier: 3 | 4;
  patientHandle: string;
  recommendation: string;        // Human-readable recommendation
  evidence: string[];            // List of evidence items agent used
  confidence: number;
  expiresAt: string;             // ISO 8601; must be within 5 minutes
}

interface ApprovalToken {
  tokenId: string;               // UUID, single-use
  requestId: string;
  approverId: string;            // Identity from JWT
  approverRole: 'physician' | 'charge_nurse' | 'pharmacist' | 'clinical_officer';
  decision: 'approved' | 'overridden';
  overrideRationale: string | null;
  issuedAt: string;
  expiresAt: string;             // 5 minutes from issuance
  consumed: boolean;             // Becomes true when tool uses token
}
```

### Tier 4 Re-Authentication Requirement

For Clinical-Impact (Tier 4) tools, the approving clinician must re-authenticate at the point of approval:

```typescript
// velya-web: Tier 4 approval confirmation dialog
const confirmClinicalAction = async (approvalRequest: ApprovalRequest) => {
  // 1. Display full recommendation with evidence to clinician
  // 2. Show risk information for the specific action
  // 3. Require explicit text entry: clinician types "CONFIRM" to proceed
  // 4. Re-authentication: biometric, PIN, or password re-entry
  // 5. Generate approval token with clinician identity
  // 6. Token sent to policy-engine; tool invocation proceeds
};
```

---

## Revocation Procedure

### Immediate Tool Revocation (Security Incident)

When a tool is suspected of being misused (via prompt injection, agent compromise, or misconfiguration):

1. **T+0**: Security team sets `revoked: true` in tool registry via platform/policy-engine API
2. **T+30s**: Policy-engine pushes revocation to all agent instances; all in-flight calls for that tool are rejected
3. **T+2m**: All pending approval requests for that tool are invalidated
4. **T+5m**: Alert sent to all clinical staff who may have recently received recommendations from that agent
5. **T+1h**: Incident report documenting: tool invocations in the previous 24h, clinical actions taken, patients affected
6. **T+24h**: Root cause analysis; tool re-enabled only after root cause resolution and clinical officer sign-off

### Standard Tool Deprecation

When a tool is being replaced or retired (non-emergency):

1. Create deprecation notice in tool registry with `deprecatedAt` and `removalAt` dates
2. Notify all agent owners whose agents use the deprecated tool
3. Monitor call frequency on deprecated tool; alert if increasing (suggests missed migration)
4. Remove tool from tool registry on `removalAt` date; all agent definitions referencing it must be updated first

---

## Tool Registry Current State

As of 2026-04-08, no MCP server has been formally registered in the tool registry. The following tools are planned for the initial tool set:

| Planned Tool | Server | Tier | Status |
|---|---|---|---|
| fhir_read_patient | medplum-mcp-server | 0 | Planned |
| fhir_search_encounters | medplum-mcp-server | 0 | Planned |
| fhir_read_vitals | medplum-mcp-server | 0 | Planned |
| memory_service_get | memory-mcp-server | 0 | Planned |
| memory_service_store | memory-mcp-server | 1 | Planned |
| fhir_create_proposed_resource | medplum-mcp-server | 1 | Planned |
| notify_clinical_staff | notification-mcp-server | 2 | Planned |
| send_internal_alert | task-inbox-mcp-server | 2 | Planned |
| fhir_update_encounter_status | medplum-mcp-server | 3 | Planned |
| discharge_patient_final | discharge-mcp-server | 4 | Planned |
| escalate_deterioration | alerting-mcp-server | 4 | Planned |

No Tier 3 or 4 tool may be activated without: formal registration, clinical reviewer approval, and a tested approval workflow.

---

*This trust model is the authoritative specification for all agent tool access in Velya. Any deviation from this model for any tool is a security incident, not a feature request.*
