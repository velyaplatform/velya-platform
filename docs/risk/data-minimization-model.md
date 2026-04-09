# Data Minimization Model — Velya Platform

**Version**: 1.0  
**Date**: 2026-04-08  
**Classification**: Internal — Restricted  
**Regulatory Basis**: HIPAA Minimum Necessary Standard (§164.502(b)), HIPAA Privacy Rule, GDPR Article 5(1)(c) (where applicable)  
**Owner**: Data Team + Compliance Team + Clinical Medical Officer  
**Review Cadence**: Quarterly; when a new agent is added; when a new FHIR resource type enters the system; after any PHI audit finding

---

## Principle

The minimum necessary standard requires that Velya limits the PHI it uses, discloses, or requests to the minimum needed to accomplish the intended purpose. This principle applies at every layer: what agents receive from FHIR, what enters LLM context, what appears in logs, what is stored in memory-service, and what appears in the frontend.

**The default is: no PHI, unless specifically justified and documented.**

---

## Section 1: Agent Data Access Rights

Each agent is permitted access only to the FHIR resource types and fields required for its declared function. This is enforced via Medplum client authorization scopes.

### bed-allocation-agent

| Permitted Resource | Permitted Fields                                         | Prohibited Fields                    | Justification                                            |
| ------------------ | -------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------- |
| Encounter          | id, status, period.start, location.location, serviceType | patient.reference (patient identity) | Bed allocation does not require knowing patient identity |
| Location (bed)     | id, status, name, type, managingOrganization             | (none restricted)                    | Full bed context needed                                  |
| ServiceRequest     | id, status, priority, code                               | patient.reference, subject.reference | Task urgency without patient identity                    |

**Note**: bed-allocation-agent operates on bed-level and location data. Patient identity is not required for bed assignment decisions. The agent receives a `patientHandle` (opaque internal ID) only — no name, MRN, DOB, or diagnosis.

---

### discharge-coordinator-agent

| Permitted Resource  | Permitted Fields                                    | Prohibited Fields               | Justification                                                  |
| ------------------- | --------------------------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| Encounter           | id, status, period, diagnosis, reasonCode, location | patient.reference (name fields) | Discharge criteria evaluation; patient MRN used as handle only |
| Condition           | id, code, clinicalStatus, verificationStatus        | subject.display (patient name)  | Condition codes needed; patient name not needed                |
| MedicationStatement | id, status, medication, dosage, effective           | patient.display                 | Medication context for reconciliation                          |
| ServiceRequest      | id, status, code, reasonCode                        | subject.display                 | Pending orders status                                          |
| CarePlan            | id, status, activity                                | subject.display                 | Discharge planning context                                     |
| DiagnosticReport    | id, status, code, result (Observation refs)         | subject.display                 | Lab results summary                                            |

**What discharge-coordinator-agent does NOT receive**:

- Patient full name
- Patient home address
- Patient insurance details
- Patient social history beyond what is clinically relevant to discharge
- Other family members' information

---

### early-warning-agent

| Permitted Resource   | Permitted Fields                                           | Prohibited Fields | Justification                                                    |
| -------------------- | ---------------------------------------------------------- | ----------------- | ---------------------------------------------------------------- |
| Observation (Vitals) | id, code, value, referenceRange, effectiveDateTime, status | subject.display   | Vital signs for deterioration detection; patient name not needed |
| Observation (Labs)   | id, code, value, interpretation, referenceRange            | subject.display   | Lab values for deterioration                                     |
| Encounter            | id, location, status                                       | patient.reference | Ward location for alert routing                                  |

**Minimum necessary**: early-warning-agent receives a `patientHandle` + ward location. Name and full identity are only revealed to clinical staff, not to the agent performing the computation.

---

### admission-assessment-agent

| Permitted Resource          | Permitted Fields                                           | Prohibited Fields                        | Justification                                                        |
| --------------------------- | ---------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| Patient                     | id (as handle), birthDate (age only, not full DOB), gender | name, address, telecom, identifier (MRN) | Age and gender for clinical risk stratification; identity not needed |
| Condition (Chief Complaint) | id, code, onset                                            | recordedDate, recorder                   | Presenting problem                                                   |
| AllergyIntolerance          | id, code, criticality                                      | patient.display                          | Safety check                                                         |
| MedicationStatement         | id, medication, status                                     | patient.display                          | Current medications for interaction check                            |

---

### medication-reconciliation-agent

| Permitted Resource          | Permitted Fields                          | Prohibited Fields | Justification                                   |
| --------------------------- | ----------------------------------------- | ----------------- | ----------------------------------------------- |
| MedicationStatement         | id, medication, dosage, status, effective | patient.display   | All medication fields needed for reconciliation |
| AllergyIntolerance          | id, code, criticality, category           | patient.display   | Allergy cross-check                             |
| MedicationRequest           | id, medication, dosage, status, intent    | subject.display   | Active orders                                   |
| Observation (relevant labs) | id, code, value, interpretation           | subject.display   | Labs relevant to drug monitoring                |

---

### task-routing-agent

| Permitted Resource | Permitted Fields                                  | Prohibited Fields          | Justification                                                           |
| ------------------ | ------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| Task               | id, status, priority, intent, code, for.reference | for.display (patient name) | Task metadata for routing; patient name not needed for routing decision |
| PractitionerRole   | id, practitioner, organization, code, location    | (none restricted)          | Staff context for routing                                               |
| Encounter          | id, location, serviceType                         | patient.reference          | Ward for geographic routing                                             |

---

## Section 2: PHI Minimization in AI/LLM Contexts

The following rules govern what patient data may enter the LLM context when calling the Anthropic Claude API (or any LLM API).

### Absolute Prohibitions (NEVER send to LLM)

| PHI Element                    | FHIR Field         | Reason                                     |
| ------------------------------ | ------------------ | ------------------------------------------ |
| Patient full name              | Patient.name       | Not needed for any clinical reasoning task |
| Patient home address           | Patient.address    | Not needed; PHI exfiltration risk          |
| Patient telephone number       | Patient.telecom    | Not needed                                 |
| Patient national ID / MRN      | Patient.identifier | Use opaque internal handle instead         |
| Patient insurance details      | Coverage.\*        | Not needed for clinical reasoning          |
| Patient social security number | (custom extension) | Never needed                               |
| Patient photo                  | Patient.photo      | Never needed                               |

### Conditional PHI (Allowed only when specifically justified)

| PHI Element              | FHIR Field                          | When Allowed                                                                  | When Prohibited                                      |
| ------------------------ | ----------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------- |
| Patient age              | Patient.birthDate → age calculation | When clinical reasoning requires age (e.g., pediatric dosing, geriatric risk) | Send age in years only, never birthDate              |
| Patient sex/gender       | Patient.gender                      | When clinically relevant (e.g., medication dosing, risk stratification)       | Do not send if not clinically indicated for the task |
| Diagnosis codes (ICD-10) | Condition.code                      | When needed for clinical reasoning                                            | Never with patient name in same prompt               |
| Medication list          | MedicationStatement                 | When needed for reconciliation, interaction check                             | Redact patient identifier fields from the resource   |
| Vital signs              | Observation                         | When needed for deterioration assessment                                      | Redact patient name from Observation.subject.display |

### PHI Handle System

Every patient is assigned a cryptographically opaque `patientHandle` that is:

- A HMAC-SHA256 of the patient's Medplum ID, keyed with a per-environment rotation key
- Rotated every 90 days (invalidating historical handles; prior decisions are linked by encounter ID)
- Not reversible without the keying material (one-way mapping)
- Not PII itself — it cannot identify a patient without access to the key

```typescript
// packages/domain/src/phi/patient-handle.ts

function createPatientHandle(medplumPatientId: string, environmentKey: string): string {
  return createHmac('sha256', environmentKey).update(medplumPatientId).digest('hex').slice(0, 32); // 128-bit handle
}

// In LLM context, patient is referred to as:
// "patient_handle: a3f2e1b9c4d8e7f0..." never "Patient: John Smith (MRN 123456)"
```

---

## Section 3: Retention Policies by Data Class

| Data Class                       | Examples                                             | Retention Period                                                                   | Deletion Method                                                 | Regulatory Basis                  |
| -------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------- |
| FHIR Clinical Records (active)   | Patient, Encounter, Observation, MedicationStatement | Retain for duration of care relationship + 10 years (adult) / 21 years (pediatric) | Medplum soft delete; data retained in audit archive             | State medical records laws; HIPAA |
| FHIR Clinical Records (inactive) | Discharged encounters, historical records            | 7–10 years from last activity                                                      | Medplum archive + cryptographic deletion                        | HIPAA; state law                  |
| AI Decision Records              | decision-log-service entries                         | 7 years                                                                            | decision-log-service audit archive; hard delete after retention | HIPAA audit controls              |
| Agent Memory (clinical context)  | memory-service entries                               | 24 hours max TTL (enforced hard limit)                                             | Automatic TTL expiry in Redis/memory-service                    | Minimum necessary standard        |
| Agent Memory (non-clinical)      | Workflow state, coordination data                    | 8 hours TTL                                                                        | Automatic TTL expiry                                            | Operational requirement           |
| Application Logs (PHI-scrubbed)  | Loki logs from NestJS services                       | 90 days                                                                            | Loki retention rule deletion                                    | Operational; HIPAA                |
| Application Logs (Kubernetes)    | Pod stdout, audit logs                               | 30 days                                                                            | Loki retention rule deletion                                    | Operational                       |
| NATS Event History               | JetStream retention                                  | 7 days for clinical subjects; 24h for operational                                  | NATS JetStream maxAge configuration                             | Operational + replay capability   |
| Prometheus Metrics               | Time-series metrics                                  | 15 days local; 1 year in long-term storage (Thanos/S3)                             | Prometheus retention; S3 lifecycle                              | Operational                       |
| Grafana Dashboard Data           | Saved annotations, alerts                            | Indefinite (dashboard config only; no PHI)                                         | Manual cleanup                                                  | Operational                       |
| Security Audit Logs              | Authentication, access control, API access           | 7 years                                                                            | Immutable S3 with object lock; hard delete after retention      | HIPAA audit controls              |
| Container Images                 | ECR images                                           | 90 days for non-release tags; retain release tags for 2 years                      | ECR lifecycle policy                                            | Security (CVE response)           |
| Backup Data                      | RDS PITR, Velero cluster backup                      | 35 days rolling                                                                    | RDS automated backup deletion; Velero policy                    | HIPAA contingency plan            |

---

## Section 4: Masking Requirements by Context

### Masking Matrix

| Context                                     | Patient Name              | MRN                   | DOB                              | Diagnosis Codes      | Medication Names | PHI Fields                      |
| ------------------------------------------- | ------------------------- | --------------------- | -------------------------------- | -------------------- | ---------------- | ------------------------------- |
| LLM prompt (any agent)                      | MASK → patient_handle     | MASK → patient_handle | MASK → age_in_years              | ALLOWED (codes only) | ALLOWED          | All identity fields masked      |
| Prometheus metrics                          | PROHIBITED                | PROHIBITED            | PROHIBITED                       | PROHIBITED           | PROHIBITED       | No PHI in metric labels         |
| Loki logs                                   | SCRUB (Promtail pipeline) | SCRUB                 | SCRUB                            | ALLOWED (coded)      | ALLOWED          | Scrubbed by Promtail            |
| Grafana dashboards                          | PROHIBITED                | PROHIBITED            | PROHIBITED                       | AGGREGATE ONLY       | AGGREGATE ONLY   | No per-patient data             |
| API error responses                         | PROHIBITED                | PROHIBITED            | PROHIBITED                       | PROHIBITED           | PROHIBITED       | No PHI in error messages        |
| NATS subject names                          | PROHIBITED                | PROHIBITED            | PROHIBITED                       | PROHIBITED           | PROHIBITED       | No PHI in subject hierarchy     |
| Git repository                              | PROHIBITED                | PROHIBITED            | PROHIBITED                       | PROHIBITED           | PROHIBITED       | No PHI in code or fixtures      |
| Test data                                   | SYNTHETIC ONLY            | SYNTHETIC ONLY        | SYNTHETIC ONLY                   | SYNTHETIC ONLY       | SYNTHETIC ONLY   | All test data must be synthetic |
| Stack traces and debugging                  | MASK                      | MASK                  | MASK                             | ALLOWED              | ALLOWED          | ID fields masked in exceptions  |
| Clinical UI (authenticated user with scope) | ALLOWED                   | ALLOWED (restricted)  | ALLOWED (if clinically relevant) | ALLOWED              | ALLOWED          | Role-based field visibility     |

### Promtail PHI Scrubbing Pipeline

```yaml
# infra/kubernetes/monitoring/promtail-config.yaml
scrape_configs:
  - job_name: velya-services
    pipeline_stages:
      - json:
          expressions:
            level: level
            message: message
            patientId: patientId
            mrn: mrn
      - replace:
          expression: '(?i)(mrn|medical.record.number)[:\s]+([\w\d-]+)'
          replace: 'mrn: [REDACTED]'
      - replace:
          expression: '(?i)(patient.name|patientName|patient_name)[:\s]+"?([^",}]+)"?'
          replace: 'patientName: [REDACTED]'
      - replace:
          expression: '\b\d{3}-\d{2}-\d{4}\b' # SSN pattern
          replace: '[REDACTED-SSN]'
      - replace:
          expression: '\b\d{1,2}/\d{1,2}/\d{4}\b' # Date of birth pattern (MM/DD/YYYY)
          replace: '[REDACTED-DOB]'
```

---

## Section 5: Purpose Limitation Enforcement

Each data access must be scoped to a declared clinical purpose. The policy-engine enforces purpose limitation by:

1. **Purpose declaration at agent activation**: when an agent begins processing a patient, it declares its purpose (e.g., `discharge-readiness-assessment`)
2. **Scope validation per FHIR call**: policy-engine validates that each FHIR resource type and field accessed is within the declared scope
3. **Cross-purpose access blocking**: if discharge-coordinator-agent attempts to access Observation resources (not in its scope), the call is blocked and logged

```typescript
// platform/policy-engine/src/purpose-limitation/enforcer.ts

interface DataAccessRequest {
  agentId: string;
  declaredPurpose:
    | 'bed-allocation'
    | 'discharge-assessment'
    | 'deterioration-monitoring'
    | 'medication-reconciliation'
    | 'task-routing';
  resourceType: FHIRResourceType;
  fields: string[];
  patientHandle: string;
}

function validatePurposeScope(request: DataAccessRequest): ValidationResult {
  const allowedAccess = PURPOSE_SCOPE_MAP[request.agentId][request.declaredPurpose];
  const requestedFields = new Set(request.fields);
  const allowedFields = new Set(allowedAccess[request.resourceType] ?? []);

  const unauthorizedFields = [...requestedFields].filter((f) => !allowedFields.has(f));

  if (unauthorizedFields.length > 0) {
    return {
      allowed: false,
      reason: `Purpose ${request.declaredPurpose} does not permit access to fields: ${unauthorizedFields.join(', ')}`,
      violation: true,
    };
  }

  return { allowed: true };
}
```

---

## Section 6: Access Logging Requirements

Every PHI access must generate an access log entry. This satisfies HIPAA §164.312(b) audit controls.

### Required Access Log Fields

```typescript
interface PHIAccessLogEntry {
  logId: string; // UUID
  timestamp: string; // ISO 8601 with milliseconds
  accessorType: 'agent' | 'user' | 'service';
  accessorId: string; // Agent ID or user JWT sub
  accessorRole: string; // Agent role or user clinical role
  patientHandle: string; // Opaque patient handle
  encounterId: string; // Encounter context
  resourceType: FHIRResourceType;
  resourceId: string; // FHIR resource ID
  accessedFields: string[]; // Which fields were accessed
  purpose: string; // Declared clinical purpose
  outcome: 'success' | 'denied' | 'error';
  denyReason: string | null; // If denied, why
  ipAddress: string; // For user accesses; agent pod IP for agent accesses
  sessionId: string; // For user accesses
  workflowId: string | null; // Temporal workflow ID if applicable
}
```

### Access Log Integrity

Access logs must be written to the append-only audit-service store before the FHIR read completes. If the audit log write fails, the FHIR read must also fail (audit-first pattern):

```typescript
// NestJS interceptor on FHIR access endpoints
@Injectable()
export class PHIAccessAuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const logEntry = buildAccessLogEntry(context);

    return from(this.auditService.log(logEntry)).pipe(
      switchMap(() => next.handle()), // only proceed if audit log succeeds
      catchError((err) => {
        if (err instanceof AuditServiceError) {
          // Audit log failed — block the PHI access
          throw new ServiceUnavailableException('Audit service unavailable — PHI access blocked');
        }
        throw err;
      }),
    );
  }
}
```

---

## Section 7: Export Controls

### PHI Export Authorization

PHI export (bulk export of patient data from Medplum or any service) requires:

1. Formal export request submitted through the compliance portal
2. Approval from Clinical Medical Officer AND Privacy Officer
3. Purpose documented and time-limited (export is for specific purpose, not general use)
4. Export logged with: requester, approver, purpose, records exported, destination, date
5. Exported data must be de-identified before leaving the hospital's legal control (unless BAA with recipient is in place)
6. Export credentials are single-use and time-limited (24-hour expiry)

### FHIR Bulk Export Restrictions

Medplum FHIR Bulk Export (FHIR R4 Bulk Data API) must be:

- Restricted to authorized export users only (not available to agents)
- Logged in audit-service with full export manifest
- Encrypted in transit and at rest for the export file
- Deleted from the export location after download confirmation (not left on shared storage)

### Right to Erasure

When a patient exercises their right to have data erased (where applicable under state law or where not conflicting with HIPAA retention requirements):

1. Identify all Medplum FHIR resources for the patient
2. Identify all decision-log-service entries (deanonymize using key + patient handle mapping)
3. Identify all memory-service entries (TTL may have already expired)
4. Identify all NATS event history entries referencing the patient handle
5. Execute cryptographic erasure: delete the keying material for the patient's handle (renders all handle-based references unreachable)
6. Execute hard delete on FHIR resources (if legally permitted; HIPAA may prohibit if needed for ongoing care)
7. Document the erasure request and execution for compliance audit

---

## Data Minimization Compliance Dashboard

The following metrics must be tracked and reviewed monthly:

| Metric                                              | Target            | Alert Threshold |
| --------------------------------------------------- | ----------------- | --------------- |
| Agent FHIR access out-of-scope violations           | 0                 | > 0 per day     |
| PHI fields found in Prometheus labels               | 0                 | Any detection   |
| PHI patterns found in Loki index scan               | 0 after scrubbing | Any detection   |
| LLM prompts with raw patient name                   | 0                 | Any detection   |
| Memory-service entries past TTL (eviction failures) | 0                 | > 0 per day     |
| PHI access log write failures                       | 0                 | > 0 per day     |
| Unauthorized FHIR field access requests             | 0                 | > 0 per day     |

---

_This model is the authoritative specification for PHI data handling in Velya. Deviations require a documented exception approved by the Clinical Medical Officer and the Data Privacy Officer, with a compensating control documented for the duration of the exception._
