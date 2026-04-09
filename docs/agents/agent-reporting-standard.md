# Agent Reporting Standard

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Knowledge & Memory Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose and Scope

Every agent operating in the Velya enterprise communicates exclusively through structured reports. Unstructured communication — free-form messages, ad-hoc notifications, verbal equivalents — is not recognized as institutional communication and carries no accountability weight.

This standard defines 11 report types, their schemas, delivery SLAs, routing rules, and the conditions under which each triggers institutional action.

A report that is missing required fields is treated as a non-report. The receiving agent must reject it, log the rejection, and escalate to the sending agent's manager.

---

## 2. Universal Report Header

Every report, regardless of type, must include this header:

```yaml
report_header:
  report_id: string            # UUID — assigned at creation, immutable
  report_type: string          # one of the 11 canonical types
  report_version: string       # schema version (e.g., "1.0")
  generated_at: datetime       # ISO 8601 with timezone
  generated_by: string         # agent_name (canonical ID)
  office: string               # agent's office
  task_id: string              # the task this report relates to (if applicable)
  workflow_id: string          # the workflow context
  correlation_id: string       # links related reports in a workflow
  recipients:
    primary: list<string>      # required recipients (must confirm receipt)
    cc: list<string>           # informational recipients
  classification: string       # public | internal | restricted | confidential
  contains_phi: bool           # true if any PHI is present in body
  retention_days: int          # mandatory retention period
```

---

## 3. Report Types

---

### 3.1 Status Report

**Purpose:** Periodic health check from an agent confirming operational state.  
**Trigger:** Time-based (cadence defined in agent contract) or on-demand from manager.  
**SLA:** Delivered within 5 minutes of scheduled time.  
**Recipients:** Office Manager, Agent Runtime Supervision Office (watchdog).  
**Action Trigger:** Missing status report triggers watchdog investigation after one missed cycle.

```yaml
# STATUS REPORT SCHEMA
report_type: status_report
status_report:
  operational_state:
    enum: [healthy, degraded, blocked, recovering, silent-risk]
  current_task:
    task_id: string
    task_type: string
    started_at: datetime
    elapsed_minutes: int
    expected_completion_at: datetime
  queue_depth: int             # number of pending tasks
  recent_completions:
    last_24h: int
    pass_rate_24h: float
  active_blockers: list<string>
  active_escalations: list<string>
  scorecard_snapshot:
    completion_quality: float
    sla_adherence: float
    evidence_completeness: float
  anomalies_detected: list<string>
  self_assessment: string      # free text — agent's own assessment of its state
```

**Example:**
```yaml
report_header:
  report_id: "sr-2026-04-08-001"
  report_type: status_report
  generated_by: "platform-office/infrastructure-specialist-agent"
  generated_at: "2026-04-08T06:00:00Z"
  recipients:
    primary: ["platform-office/infrastructure-manager-agent"]
    cc: ["agent-runtime-supervision/watchdog-platform-agent"]

status_report:
  operational_state: healthy
  current_task:
    task_id: "task-infra-2026-04-08-034"
    task_type: namespace_provisioning
    started_at: "2026-04-08T05:45:00Z"
    elapsed_minutes: 15
    expected_completion_at: "2026-04-08T06:15:00Z"
  queue_depth: 3
  recent_completions:
    last_24h: 12
    pass_rate_24h: 100.0
  active_blockers: []
  active_escalations: []
  scorecard_snapshot:
    completion_quality: 97.5
    sla_adherence: 95.8
    evidence_completeness: 100.0
  anomalies_detected: []
  self_assessment: >
    Operating within normal parameters. Current task is on schedule.
    No blockers or escalations active.
```

---

### 3.2 Execution Report

**Purpose:** Post-task completion record documenting what was done, how, and with what result.  
**Trigger:** Task completion (success or failure).  
**SLA:** Delivered within 30 minutes of task completion.  
**Recipients:** Supervising coordinator, office manager, validation request (if required).  
**Action Trigger:** Missing Execution Report for a High/Critical task escalates to manager within 60 minutes.

```yaml
# EXECUTION REPORT SCHEMA
report_type: execution_report
execution_report:
  task_id: string
  task_type: string
  task_description: string
  assigned_by: string
  assigned_at: datetime
  started_at: datetime
  completed_at: datetime
  duration_minutes: int
  outcome:
    enum: [success, partial_success, failure, blocked]
  outcome_description: string
  actions_taken:
    - action: string
      timestamp: datetime
      result: string
      evidence_ref: string
  deviations_from_plan: list<string>
  evidence_package:
    items:
      - evidence_type: string
        storage_ref: string
        hash_sha256: string
  validation_requested: bool
  validation_request_id: string   # if validation_requested = true
  risk_events_during_execution: list<string>
  lessons_noted: list<string>     # preliminary — feeds Learning Report
```

**Example (abbreviated):**
```yaml
report_header:
  report_id: "exec-2026-04-08-infra-034"
  report_type: execution_report
  generated_by: "platform-office/infrastructure-specialist-agent"
  generated_at: "2026-04-08T06:22:00Z"
  task_id: "task-infra-2026-04-08-034"

execution_report:
  task_type: namespace_provisioning
  task_description: "Provision velya-clinical-v2 namespace per RFC-INFRA-2026-041"
  assigned_by: "platform-office/infrastructure-coordinator-agent"
  started_at: "2026-04-08T05:45:00Z"
  completed_at: "2026-04-08T06:20:00Z"
  duration_minutes: 35
  outcome: success
  outcome_description: "Namespace created with ResourceQuota and NetworkPolicy per RFC specification"
  actions_taken:
    - action: "kubectl apply namespace manifest"
      timestamp: "2026-04-08T05:48:00Z"
      result: "namespace/velya-clinical-v2 created"
      evidence_ref: "evidence/infra/task-034/namespace-apply.yaml"
    - action: "kubectl apply resource quota"
      timestamp: "2026-04-08T05:52:00Z"
      result: "resourcequota/velya-clinical-v2-quota created"
      evidence_ref: "evidence/infra/task-034/quota-apply.yaml"
    - action: "kubectl apply network policy"
      timestamp: "2026-04-08T05:58:00Z"
      result: "networkpolicy/velya-clinical-v2-default created"
      evidence_ref: "evidence/infra/task-034/netpol-apply.yaml"
  deviations_from_plan: []
  validation_requested: true
  validation_request_id: "val-req-2026-04-08-infra-034"
  lessons_noted: []
```

---

### 3.3 Validation Report

**Purpose:** A validator's independent assessment of a specialist's execution.  
**Trigger:** Receipt of a validation request.  
**SLA:** Delivered within 2 hours for Medium risk; 4 hours for High; 8 hours for Critical.  
**Recipients:** Requesting agent, requesting agent's manager, audit queue (if High+).  
**Action Trigger:** Rejection triggers correction loop. Critical rejection triggers immediate manager escalation.

```yaml
# VALIDATION REPORT SCHEMA
report_type: validation_report
validation_report:
  validation_request_id: string
  target_task_id: string
  target_agent: string
  validator_agent: string
  validator_office: string
  validation_type:
    enum: [technical, functional, security, compliance, clinical, composite]
  risk_class_verified: string
  checklist_results:
    - check_id: string
      check_description: string
      result:
        enum: [pass, fail, not_applicable, inconclusive]
      evidence_reviewed: string
      finding: string
  overall_result:
    enum: [certified, rejected, conditional_hold]
  certification_rationale: string   # required for certified
  rejection_rationale: string       # required for rejected
  rejection_items: list<string>     # specific items requiring correction
  required_corrections: list<string>
  revalidation_required: bool
  revalidation_scope: string        # full | targeted
  evidence_package_complete: bool
  evidence_gaps: list<string>
  validator_confidence:
    enum: [high, medium, low]
  validator_confidence_rationale: string
```

---

### 3.4 Audit Report

**Purpose:** An auditor's review of the validation process and evidence chain for completeness and policy adherence.  
**Trigger:** Risk-class-based (High and above always trigger audit) or scheduled.  
**SLA:** 4 hours for High; 8 hours for Critical; 24 hours for Catastrophic (extended evidence collection).  
**Recipients:** Office Manager of audited agent, Compliance Office, Executive Office (Critical/Catastrophic).  
**Action Trigger:** Finding triggers formal finding registry entry. Critical finding triggers human notification.

```yaml
# AUDIT REPORT SCHEMA
report_type: audit_report
audit_report:
  audit_id: string
  audit_type:
    enum: [process, evidence, compliance, behavioral, systemic]
  subject:
    agent: string
    task_ids: list<string>
    scope_description: string
  auditor_agent: string
  auditor_office: string
  independence_confirmed: bool     # auditor not in reporting chain of subject
  audit_period:
    from: datetime
    to: datetime
  policy_references: list<string>  # which policies were checked
  checklist_results:
    - check_id: string
      policy_ref: string
      result: enum [pass, finding, failure, not_applicable]
      evidence_reviewed: list<string>
      observation: string
  findings:
    - finding_id: string
      severity: enum [informational, low, medium, high, critical]
      description: string
      policy_violated: string
      evidence: string
      recommended_action: string
      due_date: date
  overall_assessment:
    enum: [clean, findings_noted, significant_findings, failure]
  regulatory_impact: string
  evidence_chain_complete: bool
  evidence_chain_gaps: list<string>
  follow_up_required: bool
  follow_up_deadline: date
```

---

### 3.5 Exception Report

**Purpose:** Alert when something has gone wrong that does not yet constitute a full failure but requires immediate awareness.  
**Trigger:** Agent detects an anomaly, unexpected state, policy edge case, or ambiguity requiring management attention.  
**SLA:** Delivered within 15 minutes of detection.  
**Recipients:** Supervising coordinator or manager, watchdog agent for the office.  
**Action Trigger:** Manager must acknowledge within 30 minutes. Unacknowledged exceptions escalate to Executive.

```yaml
# EXCEPTION REPORT SCHEMA
report_type: exception_report
exception_report:
  exception_id: string
  detected_at: datetime
  exception_type:
    enum: [unexpected_state, policy_ambiguity, resource_constraint, dependency_failure, scope_boundary, data_quality, authorization_gap]
  severity:
    enum: [low, medium, high, critical]
  description: string
  current_agent_state: string
  affected_tasks: list<string>
  affected_workflows: list<string>
  immediate_actions_taken: list<string>
  current_disposition:
    enum: [continuing, paused, halted]
  disposition_rationale: string
  decision_required_from: string
  decision_deadline: datetime
  if_no_decision:
    default_action: string
    default_action_rationale: string
  evidence:
    - type: string
      ref: string
```

---

### 3.6 Risk Report

**Purpose:** Formal escalation when a risk is identified that exceeds the agent's authority to manage alone.  
**Trigger:** Risk identified during task execution that was not anticipated in the original risk classification.  
**SLA:** Delivered within 10 minutes of risk identification for High+. Immediately for Catastrophic.  
**Recipients:** Office Manager, Risk Office (via Executive), Agent Runtime Supervision watchdog.  
**Action Trigger:** High+ risk reports trigger mandatory manager response within 15 minutes.

```yaml
# RISK REPORT SCHEMA
report_type: risk_report
risk_report:
  risk_id: string
  identified_at: datetime
  original_task_risk_class: string
  identified_risk_class: string  # what the agent now believes the risk to be
  risk_description: string
  risk_dimensions:
    probability: enum [low, medium, high, certain]
    impact: enum [low, medium, high, critical, catastrophic]
    detectability: enum [easy, moderate, difficult, undetectable]
    blast_radius: string
    reversibility: enum [reversible, partially-reversible, irreversible]
    clinical_impact: string
    regulatory_impact: string
  trigger_event: string
  immediate_actions_taken: list<string>
  agent_current_state:
    enum: [continuing, paused, halted]
  recommended_response: string
  requires_human_intervention: bool
  human_intervention_rationale: string
  evidence: list<string>
```

---

### 3.7 Failure Report

**Purpose:** Definitive record of a task or agent failure with full analysis.  
**Trigger:** Task fails irrecoverably, or agent enters a failure state.  
**SLA:** Delivered within 60 minutes of failure confirmation.  
**Recipients:** Supervising coordinator, office manager, Learning Office.  
**Action Trigger:** Triggers correction loop (if task-level failure) or quarantine investigation (if agent-level failure).

```yaml
# FAILURE REPORT SCHEMA
report_type: failure_report
failure_report:
  failure_id: string
  failed_at: datetime
  failure_type:
    enum: [task_failure, agent_failure, dependency_failure, permission_failure, data_failure, timeout_failure]
  failed_task_id: string
  failure_description: string
  last_successful_state: string
  failure_timeline:
    - timestamp: datetime
      event: string
  root_cause_hypothesis: string
  contributing_factors: list<string>
  impact_assessment:
    tasks_affected: int
    workflows_affected: int
    estimated_delay_minutes: int
    clinical_impact: string
  recovery_actions_attempted: list<string>
  recovery_outcome: string
  current_state: string
  recommended_next_action: string
  learning_potential:
    enum: [none, low, medium, high]
  preliminary_lessons: list<string>
  evidence: list<string>
```

---

### 3.8 Learning Report

**Purpose:** Document a lesson learned for institutional propagation.  
**Trigger:** Post-incident, post-correction cycle completion, post-audit finding, or trainer-directed learning event.  
**SLA:** Delivered within 24 hours of triggering event.  
**Recipients:** Learning Office (primary), relevant office managers.  
**Action Trigger:** Learning Office validates within 48 hours. Valid lessons are propagated within 5 business days.

```yaml
# LEARNING REPORT SCHEMA
report_type: learning_report
learning_report:
  learning_id: string
  source_event:
    event_type: enum [incident, regression, audit_finding, correction, benchmark, simulation]
    event_id: string
    occurred_at: datetime
  lesson_title: string
  lesson_description: string
  lesson_category:
    enum: [process, technical, governance, clinical, security, data, behavioral]
  affected_offices: list<string>
  affected_agent_types: list<string>
  before_state: string
  after_state: string
  recommended_change:
    change_type: enum [new_rule, skill_update, playbook_revision, template_change, contract_amendment, training_module]
    change_description: string
    priority: enum [low, medium, high, urgent]
  supporting_evidence: list<string>
  lesson_confidence:
    enum: [low, medium, high]
  lesson_confidence_rationale: string
  contradicts_existing_lesson: bool
  contradicted_lesson_id: string
  submitted_by: string
  validation_status: enum [pending, validated, rejected, requires_revision]
```

---

### 3.9 Handoff Report

**Purpose:** Formal record of work transfer between agents, ensuring no work is lost.  
**Trigger:** Whenever work is transferred from one agent to another.  
**SLA:** Delivered before work is considered transferred. Receiving agent has 15 minutes to confirm or reject.  
**Recipients:** Receiving agent (primary), both agents' managers if cross-office.  
**Action Trigger:** Rejected handoff (insufficient context) returns work to sender. Unconfirmed handoff after 15 minutes escalates to both managers.

```yaml
# HANDOFF REPORT SCHEMA
report_type: handoff_report
handoff_report:
  handoff_id: string
  handoff_type:
    enum: [within_office, cross_office, emergency, scheduled, cascade]
  origin_agent: string
  origin_office: string
  destination_agent: string
  destination_office: string
  handoff_reason: string
  work_package:
    task_id: string
    workflow_id: string
    task_description: string
    task_type: string
    priority: enum [low, medium, high, urgent, emergency]
    deadline: datetime
  context_package:
    background: string
    decisions_made: list<string>
    decisions_pending: list<string>
    open_questions: list<string>
    known_risks: list<string>
    known_dependencies: list<string>
  artifacts_transferred:
    - artifact_name: string
      artifact_type: string
      storage_ref: string
      hash_sha256: string
  validation_status:
    validated: bool
    validation_report_id: string
    validation_outstanding: bool
  risk_class: string
  sla_inherited:
    sla_deadline: datetime
    time_remaining_minutes: int
  cross_office_authorization: string  # required for cross-office handoffs
  confirmation_required_by: datetime
  if_not_confirmed_by: string         # default action if confirmation not received
```

---

### 3.10 Correction Report

**Purpose:** Agent's structured response to a validation rejection, documenting acknowledgment, analysis, and correction plan.  
**Trigger:** Receipt of a rejected Validation Report.  
**SLA:** Delivered within 2 hours of receiving rejection for High+. 4 hours for Medium.  
**Recipients:** Validator that issued rejection, supervising coordinator, office manager.  
**Action Trigger:** Correction Report initiates the correction loop. Third correction on same issue triggers mandatory escalation.

```yaml
# CORRECTION REPORT SCHEMA
report_type: correction_report
correction_report:
  correction_id: string
  correction_cycle: int              # 1st, 2nd, 3rd correction attempt
  original_task_id: string
  rejected_validation_report_id: string
  rejection_received_at: datetime
  correction_report_filed_at: datetime
  acknowledgment:
    rejection_understood: bool
    items_acknowledged: list<string>
  root_cause_analysis:
    identified_cause: string
    cause_category: enum [knowledge_gap, process_violation, tool_failure, data_error, scope_misunderstanding, environmental]
    contributing_factors: list<string>
  correction_plan:
    - correction_item: string
      rejection_item_addressed: string
      planned_action: string
      expected_evidence: string
      estimated_completion: datetime
  items_not_corrected:
    - item: string
      rationale: string             # must be approved by manager before submission
  revalidation_scope:
    enum: [full, targeted]
  revalidation_scope_rationale: string
  learning_identified: list<string>
  recurrence_prevention: string
```

---

### 3.11 Post-Action Review

**Purpose:** Structured retrospective after a significant event (incident, major release, DR exercise, external audit, human intervention).  
**Trigger:** Any event classified as significant in the post-action trigger registry.  
**SLA:** Delivered within 48 hours of event close.  
**Recipients:** Office Manager, Executive Office, Learning Office.  
**Action Trigger:** All findings with action items are tracked in the PMO portfolio. Recurring findings trigger Learning propagation within 5 business days.

```yaml
# POST-ACTION REVIEW SCHEMA
report_type: post_action_review
post_action_review:
  par_id: string
  event_type:
    enum: [incident, major_release, dr_exercise, external_audit, human_intervention, chaos_exercise, security_breach]
  event_id: string
  event_started_at: datetime
  event_closed_at: datetime
  duration_minutes: int
  participants: list<string>        # all agents involved
  facilitator: string               # agent responsible for PAR
  timeline:
    - timestamp: datetime
      event: string
      actor: string
  what_went_well: list<string>
  what_went_wrong: list<string>
  why_it_happened:
    immediate_cause: string
    contributing_factors: list<string>
    systemic_factors: list<string>
  impact:
    services_affected: list<string>
    duration_minutes: int
    clinical_impact: string
    regulatory_impact: string
    patient_impact: string
  detection:
    how_detected: string
    time_to_detect_minutes: int
    detection_gap: string
  response:
    time_to_respond_minutes: int
    response_effectiveness: enum [effective, partially_effective, ineffective]
    response_gaps: list<string>
  action_items:
    - item_id: string
      description: string
      owner: string
      due_date: date
      priority: enum [low, medium, high, urgent]
      tracking_ticket: string
  learning_report_ids: list<string>
  human_intervention_review:
    was_human_intervention_required: bool
    was_human_intervention_justified: bool
    could_agents_have_resolved: bool
    prevention_recommendation: string
```

---

## 4. Report Routing Rules

| Report Type | Primary Recipients | Escalation if Unacknowledged |
|---|---|---|
| Status | Office Manager + Watchdog | 1 missed cycle → watchdog investigation |
| Execution | Coordinator + Manager | 60 min for High+ → manager alert |
| Validation | Requesting agent + Manager | 4 hours → manager escalation |
| Audit | Office Manager + Compliance | 8 hours → Executive escalation |
| Exception | Coordinator + Manager | 30 min → Executive escalation |
| Risk | Manager + Executive | 15 min for High+ → immediate escalation |
| Failure | Coordinator + Manager + Learning | Immediate for agent failure → quarantine trigger |
| Learning | Learning Office | 48 hours → Learning Office manager alert |
| Handoff | Destination agent + both managers | 15 min → work returns to sender |
| Correction | Validator + Coordinator + Manager | 4 hours for High+ → manager escalation |
| Post-Action Review | Manager + Executive + Learning | 72 hours → Executive escalation |

---

## 5. Report Anti-Patterns

The following behaviors in reporting are defects and are tracked on the agent scorecard:

| Anti-Pattern | Definition | Consequence |
|---|---|---|
| Missing header fields | Required header fields absent | Report rejected as invalid |
| Late delivery | Report delivered after SLA | SLA metric degraded |
| Self-referential validation | Validator reporting on own work | Automatic escalation + watchdog flag |
| Incomplete evidence references | Evidence cited but not linked | Evidence completeness metric degraded |
| Retroactive dating | Report backdated to appear on-time | Trust flag; auditor investigation |
| Boilerplate correction | Correction report not analyzing specific rejection items | Third correction cycle auto-escalation |
| Silent status | No status report filed for 2+ cycles | Watchdog incident opened |
| PHI in non-restricted report | PHI present without proper classification | Security incident + Data Governance alert |
