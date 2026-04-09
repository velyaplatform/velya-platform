# Agent Evidence Log Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Knowledge & Memory Office / Compliance & Audit Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Evidence is the foundation of accountability. An agent that claims to have done something correctly, without evidence that it did it correctly, has provided an assertion — not a fact. The Evidence Log Model defines what evidence is required, how it is collected, stored, linked, and verified.

Evidence is not paperwork. It is the institutional memory of what happened, available for validation, audit, regulatory review, and learning analysis. Without evidence, every claim about agent behavior is unverifiable.

---

## 2. Evidence Requirements by Task Type and Risk Class

### 2.1 Universal Evidence Requirements (All Risk Classes)

Every task, regardless of risk class, requires:

| Evidence Item | Description |
|---|---|
| Task assignment record | Proof the task was formally assigned (NATS message or handoff record) |
| Execution log | Structured log of all actions taken during the task |
| Outcome record | What was the result of the task |
| Report reference | The Execution Report filed upon completion |

### 2.2 Additional Requirements by Risk Class

| Evidence Item | Medium | High | Critical | Catastrophic |
|---|---|---|---|---|
| Pre-state snapshot | Recommended | Required | Required | Required |
| Post-state snapshot | Recommended | Required | Required | Required |
| Applied configuration/manifest | Required | Required | Required | Required |
| Validation report | Required | Required | Required | Required |
| Audit report | Not required | Required | Required | Required |
| Decision log entries | When applicable | Required for all decisions | Required for all decisions | Required for all decisions |
| Alternative approaches considered | Not required | Required | Required | Required |
| Risk assessment document | Not required | Required | Required | Required |
| Approval record (for approvals obtained) | When applicable | Required | Required | Required |
| Rollback plan | Not required | Required | Required | Required |
| Hash verification of all artifacts | Recommended | Required | Required | Required |

### 2.3 Domain-Specific Evidence Requirements

**Infrastructure tasks (additional):**
- `kubectl get {resource} -o yaml` before and after
- Kubernetes event log for the namespace during the operation
- Network policy verification output

**Security tasks (additional):**
- Vulnerability scan raw output
- Patch verification evidence
- Credential rotation confirmation records

**Clinical workflow tasks (additional):**
- PHI access log for the workflow period
- Clinical pathway specification referenced
- De-identification verification (if any PHI was in outputs)

**Release and deployment tasks (additional):**
- CI/CD pipeline execution log
- Test suite results
- ArgoCD sync status before and after
- Rollback test evidence

**Data tasks (additional):**
- Data quality check results before and after
- Data lineage verification
- PHI access audit trail
- HIPAA compliance verification

---

## 3. Evidence Types

| Evidence Type | Description | Format | Example |
|---|---|---|---|
| code_artifact | Source code, configuration files, manifests | yaml, json, typescript | k8s manifest applied |
| test_result | Output from automated test execution | JUnit XML, JSON | regression test report |
| validation_report | Validator's assessment | structured markdown + YAML | validation report schema |
| audit_report | Auditor's evidence review | structured markdown + YAML | audit report schema |
| log_file | Structured execution log | JSON lines | kubectl apply output |
| screenshot | UI state or dashboard capture | PNG/JPEG | Grafana dashboard state |
| approval_record | Documented authorization | YAML with agent IDs and timestamps | manager approval message |
| state_snapshot | System state before/after | kubectl get -o yaml | namespace resource state |
| hash_verification | Integrity check of artifact | SHA-256 digest | file hash list |
| diff | Change delta between two states | unified diff format | manifest diff |
| event_trace | NATS/Temporal event sequence | JSON event log | NATS message history |
| external_report | Third-party output (CVE reports, etc.) | varies | CISA KEV alert |
| decision_log_entry | Decision log reference | decision_id | DEC-agent-date-seq |
| phi_access_log | HIPAA-compliant PHI access record | structured audit log | PHI access event stream |
| communication_record | Inter-agent handoff or escalation | handoff report schema | handoff_report_id |

---

## 4. Evidence Linking

Evidence is only valuable when it is linked to the decisions and actions it supports. Unlinked evidence is an archive problem, not an accountability solution.

### 4.1 Evidence Linking Schema

```yaml
evidence_package:
  package_id: string                 # UUID
  created_at: datetime
  created_by: string                 # agent ID
  task_id: string
  workflow_id: string
  risk_class: string
  
  items:
    - item_id: string
      item_type: string              # from the evidence type list above
      item_name: string
      description: string
      collected_at: datetime
      collected_by: string           # agent ID
      storage_ref: string            # path or URI in evidence store
      hash_sha256: string            # computed at collection time
      hash_verified_at: datetime     # when hash was last verified
      hash_verified_by: string
      
      # Linking — every item must be linked to at least one of:
      links:
        decision_ids: list<string>   # decision log entries this evidence supports
        action_ids: list<string>     # specific actions in the execution log
        report_ids: list<string>     # reports that reference this evidence
        task_ids: list<string>       # tasks this evidence relates to
        
      is_critical: bool              # if true, task cannot complete without this item
      is_phi_containing: bool
      phi_classification: string     # restricted | confidential | de-identified
      retention_days: int
      
  completeness_assessment:
    all_required_items_present: bool
    missing_items: list<string>
    completeness_percentage: float
    assessor: string
    assessed_at: datetime
    
  integrity_assessment:
    all_hashes_verified: bool
    hash_failures: list<string>
    integrity_verified_at: datetime
    integrity_verified_by: string
```

### 4.2 Bidirectional Linking

Evidence linking must be bidirectional:
- The evidence item references the decision/action it supports
- The decision log entry references the evidence items that support it
- The execution report references the evidence package

This bidirectionality enables auditors to navigate from any entry point — from a decision, find the evidence; from evidence, find the decision; from a report, find both.

---

## 5. Evidence Integrity Requirements

### 5.1 Hash Verification

Every evidence item is hash-verified at collection and at each subsequent significant review:

```
Collection time:
  hash = SHA-256(item_contents)
  hash stored in evidence package
  
First validation:
  recompute_hash = SHA-256(stored_item_contents)
  assert recompute_hash == stored_hash
  
Audit time:
  recompute_hash = SHA-256(stored_item_contents)
  assert recompute_hash == stored_hash
  
Result: if any hash fails, the item is flagged as potentially modified
        → security incident opened
        → all evidence from the same agent in the same time window is suspect
```

### 5.2 Immutability

Evidence items are stored in a write-once, append-only evidence store. The only permitted operations are:
- **Append:** Add new evidence items
- **Read:** Read existing items
- **Verify:** Compute and compare hash

Deletion is not permitted. Modification is not permitted. If an evidence item is incorrect, a corrected version is appended with a reference to the original item and an explanation of the correction. Both versions are retained.

### 5.3 Chain of Custody

For High and Critical evidence, a chain of custody record is maintained:

```yaml
chain_of_custody:
  evidence_item_id: string
  events:
    - event_type: enum [collected, stored, read, verified, transferred, referenced_in_audit]
      timestamp: datetime
      actor: string          # agent ID or auditor ID
      context: string        # why this action was taken
      hash_at_time: string   # hash state at this point in time
```

---

## 6. Evidence Storage and Retrieval

### 6.1 Storage Architecture

Evidence is stored in the Velya Evidence Store — a service operated by the Knowledge & Memory Office with:
- Append-only writes (enforced at the storage layer, not just policy)
- Cryptographic integrity verification
- Role-based access control (read access requires authorization per evidence classification)
- Full-text indexing on structured fields
- Tiered storage: hot (current + 90 days), warm (90 days–1 year), cold (1 year+)

### 6.2 Access Control

| Evidence Classification | Who Can Read |
|---|---|
| Public | All agents with valid credentials |
| Internal | Agents in the same or related office; Compliance; Executive |
| Restricted | Named agents in the evidence package; Compliance; Executive |
| Confidential (PHI) | Only agents with PHI access authorization; Compliance; Data Governance |

Access to Confidential evidence is logged with full access audit trail (HIPAA requirement).

### 6.3 Retrieval SLA

| Evidence Age | Retrieval Time |
|---|---|
| Hot (< 90 days) | < 5 seconds |
| Warm (90 days – 1 year) | < 30 seconds |
| Cold (> 1 year) | < 10 minutes |
| Archive (> retention period) | < 24 hours (on request) |

---

## 7. Evidence Retention Policy

| Evidence Category | Minimum Retention |
|---|---|
| Standard operational evidence | 365 days |
| High risk action evidence | 7 years |
| Clinical workflow evidence | 7 years |
| PHI-containing evidence | 7 years (HIPAA) |
| Security incident evidence | 7 years |
| Regulatory compliance evidence | 7 years |
| Audit evidence | 7 years |
| Agent contract evidence | Permanent |
| Decision log evidence | Permanent (for governance decisions) |
| Learning event evidence | Permanent |

Retention is enforced automatically by the Evidence Store. Items approaching their retention limit generate a notification to the Knowledge & Memory Office for review before deletion.

---

## 8. Evidence Completeness Checks

### 8.1 Automated Completeness Check

When an agent files an Execution Report, the Evidence Store automatically checks:
- Are all required items for this risk class present?
- Are all items correctly linked to task and report IDs?
- Do all items have valid hashes?
- Are all items within their declared format?

If any check fails, the Execution Report is flagged as `evidence_incomplete` and:
- The agent receives an immediate notification
- The validation request is held pending evidence completion
- If evidence is not completed within 30 minutes (for High+), the manager is notified

### 8.2 Validator Evidence Check

Validators check evidence completeness as part of their validation checklist (V-E items). A validator cannot certify work when the evidence package is flagged `evidence_incomplete`.

### 8.3 Auditor Evidence Check

Auditors verify evidence integrity (hash verification) and completeness (all required items present) as core audit checklist items. An audit cannot be completed with a clean finding when evidence integrity fails.

---

## 9. Missing Evidence Handling

When evidence is identified as missing:

| Situation | Action |
|---|---|
| Missing non-critical item discovered by agent during task | Agent collects and adds immediately; notes delay |
| Missing critical item discovered by agent | Agent pauses task; logs exception; notifies coordinator |
| Missing item discovered by validator | Validation held; rejection with evidence gap finding |
| Missing item discovered by auditor | Audit finding (medium-high severity); evidence gap investigation |
| Missing item discovered post-deployment | Audit finding + investigation: was evidence lost or never collected? |
| Missing item due to storage failure | Storage incident opened; attempt recovery from secondary store |

Evidence that cannot be recovered after a good-faith recovery attempt becomes an audit finding. If the missing evidence relates to PHI access, it is a potential HIPAA incident requiring regulatory review.

---

## 10. Evidence Audit Procedure

The Compliance & Audit Office conducts evidence audits on the following schedule:

| Audit Type | Frequency | Scope |
|---|---|---|
| Sample completeness audit | Weekly | 10% random sample of evidence packages from prior week |
| High-risk completeness audit | Monthly | 100% of High and Critical evidence packages from prior month |
| PHI evidence audit | Monthly | 100% of evidence packages containing or referencing PHI |
| Hash integrity audit | Quarterly | Full hash verification of all evidence in hot storage |
| Retention compliance audit | Quarterly | Verify retention periods are correctly set and enforced |
| Evidence store access audit | Monthly | Review all read access logs for anomalous patterns |

Audit findings are entered in the Compliance Finding Registry with the standard finding lifecycle.
