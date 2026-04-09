# Agent Runtime Contracts

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Agent Factory Office — Agent Factory Manager Agent  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Every agent operating in the Velya enterprise must have a formally approved Runtime Contract. The contract is the binding specification of what the agent is, what it may do, how it is accountable, and when it is allowed to exist. No agent may move from Sandbox to Shadow without an approved contract. No agent may operate in Production without an Active contract.

The contract is a living document: it is updated when scope changes, when risk is reclassified, or when the agent is promoted or deprecated in the lifecycle. Every version of a contract is immutable once approved — subsequent changes produce a new version.

---

## 2. The Full Contract Schema

```yaml
# ============================================================
# VELYA AGENT RUNTIME CONTRACT
# Schema Version: 1.0.0
# ============================================================

contract_version: string          # semver: 1.0.0, 1.1.0, etc.
contract_id: string               # UUID — immutable, assigned at creation
effective_date: date              # ISO 8601
approved_by: list<string>         # agent IDs of approving authorities
review_date: date                 # next scheduled review

# -----------------------------------------------------------
# IDENTITY
# -----------------------------------------------------------
agent_name: string                # format: {office-slug}/{role-type}-{function}-agent
office_name: string               # one of the 23 canonical offices
role_type:
  enum: [manager, coordinator, specialist, validator, auditor, watchdog, trainer]
purpose: string                   # single-sentence mission statement
taxonomy_tags: list<string>       # e.g., [infrastructure, kubernetes, high-risk]

# -----------------------------------------------------------
# SCOPE
# -----------------------------------------------------------
scope: list<string>               # what this agent IS responsible for
non_scope: list<string>           # explicit exclusions (prevent scope creep)

# -----------------------------------------------------------
# INTERFACES
# -----------------------------------------------------------
inputs:
  - name: string
    type: string                  # NATS message | API call | file | report | event
    source: string                # originating agent or system
    schema_ref: string            # link to schema definition
    required: bool

outputs:
  - name: string
    type: string
    destination: string           # consuming agent or system
    schema_ref: string
    sla_minutes: int              # max time to produce after trigger

# -----------------------------------------------------------
# DEPENDENCIES
# -----------------------------------------------------------
dependencies:
  agents: list<string>            # agent IDs this agent depends on
  services: list<string>          # Velya platform services required
  external_systems: list<string>  # external APIs, data sources
  nats_subjects: list<string>     # NATS subjects subscribed to
  k8s_namespaces: list<string>    # Kubernetes namespaces in scope

# -----------------------------------------------------------
# PERMISSIONS
# -----------------------------------------------------------
permissions:
  k8s:
    namespaces: list<string>
    verbs: list<string>           # get, list, watch, create, update, patch, delete
    resources: list<string>
  nats:
    publish: list<string>         # subjects allowed to publish
    subscribe: list<string>       # subjects allowed to subscribe
    stream_admin: bool            # can manage streams (default: false)
  database:
    read_schemas: list<string>
    write_schemas: list<string>
    pii_access: bool              # explicit PHI/PII access flag
  external_apis: list<string>
  secret_store:
    read_secrets: list<string>
    write_secrets: list<string>   # should be empty for most agents
  file_system:
    read_paths: list<string>
    write_paths: list<string>

# -----------------------------------------------------------
# GOVERNANCE CHAIN
# -----------------------------------------------------------
reports_to: string                # direct manager agent ID
required_validators:
  - agent_id: string
    office: string
    trigger_conditions: list<string>  # when this validator is required
required_auditors:
  - agent_id: string
    office: string
    trigger_conditions: list<string>

# -----------------------------------------------------------
# RISK PROFILE
# -----------------------------------------------------------
risk_class:
  enum: [low, medium, high, critical, catastrophic]
risk_justification: string        # why this class was assigned
blast_radius: string              # scope of damage if this agent fails
clinical_impact: string           # direct or indirect patient impact
regulatory_impact: string         # HIPAA, SOC2, or other regulatory exposure
reversibility: string             # reversible | partially-reversible | irreversible

# -----------------------------------------------------------
# ALLOWED AND FORBIDDEN ACTIONS
# -----------------------------------------------------------
allowed_actions: list<string>     # explicit enumeration of allowed operations
forbidden_actions: list<string>   # explicit prohibitions (overrides scope)

# -----------------------------------------------------------
# FALLBACK AND ESCALATION
# -----------------------------------------------------------
fallback_actions:
  - condition: string             # when this fallback applies
    action: string                # what the agent does
    notify: list<string>          # who is notified

escalation_path:
  - level: int
    target: string                # agent ID or role to escalate to
    condition: string             # trigger for this escalation level
    sla_minutes: int              # max time before next escalation

# -----------------------------------------------------------
# REPORTING
# -----------------------------------------------------------
reporting_format: string          # ref to report template
reporting_cadence: string         # e.g., after each task, hourly, daily
reporting_destination: list<string>  # agent IDs or NATS subjects

scorecard_metrics:
  - metric_name: string
    definition: string
    measurement_method: string
    target_threshold: float
    warning_threshold: float
    critical_threshold: float

# -----------------------------------------------------------
# EVIDENCE REQUIREMENTS
# -----------------------------------------------------------
evidence_requirements:
  per_task:
    - evidence_type: string
      required: bool
      format: string
      retention_days: int
  per_incident:
    - evidence_type: string
      required: bool
      format: string
      retention_days: int

# -----------------------------------------------------------
# LIFECYCLE
# -----------------------------------------------------------
lifecycle_stage:
  enum: [draft, sandbox, shadow, probation, active, deprecated, retired]
lifecycle_history:
  - stage: string
    entered_date: date
    exited_date: date
    evidence_ref: string

retirement_conditions:
  - condition: string
    automatic: bool               # auto-retire vs. requires manager approval

# -----------------------------------------------------------
# HUMAN OVERSIGHT
# -----------------------------------------------------------
human_oversight_required: bool    # if true, probation outputs require human review
human_oversight_justification: string
break_glass_authority: list<string>  # who can override this agent's decisions

# -----------------------------------------------------------
# CONTRACT HISTORY
# -----------------------------------------------------------
change_log:
  - version: string
    date: date
    author: string
    summary: string
    approved_by: list<string>
```

---

## 3. Contract Approval Requirements

| Risk Class | Required Approvers |
|---|---|
| Low | Office Manager Agent |
| Medium | Office Manager Agent + ARB Agent |
| High | Office Manager Agent + ARB Agent + Executive Agent |
| Critical | Office Manager + ARB + Executive + Compliance Office |
| Catastrophic | All above + Governance Council (human) |

---

## 4. Complete Example Contracts

---

### 4.1 `platform-office/infrastructure-specialist-agent`

```yaml
contract_version: "1.2.0"
contract_id: "a3f9c821-4d1e-4b8a-9f3d-2c7e1a5b6d4f"
effective_date: "2026-04-08"
approved_by:
  - "platform-office/infrastructure-manager-agent"
  - "architecture-review-board/arb-manager-agent"
  - "executive/chief-operations-agent"
review_date: "2026-07-08"

# IDENTITY
agent_name: "platform-office/infrastructure-specialist-agent"
office_name: "Platform & Infrastructure"
role_type: specialist
purpose: >
  Provision, configure, and maintain Velya Kubernetes infrastructure resources
  (nodes, namespaces, persistent volumes, network policies) in accordance with
  approved infrastructure plans, ensuring platform availability targets are met
  without unauthorized configuration drift.
taxonomy_tags:
  - infrastructure
  - kubernetes
  - networking
  - storage
  - high-risk

# SCOPE
scope:
  - Provision Kubernetes namespaces per approved Infrastructure RFC
  - Apply and update NetworkPolicy resources within approved boundaries
  - Manage PersistentVolumeClaims for approved Velya services
  - Scale Deployments and StatefulSets within pre-approved resource bounds
  - Rotate infrastructure-level secrets on schedule or on incident trigger
  - Execute approved node maintenance (cordon, drain, uncordon)
  - Apply approved HorizontalPodAutoscaler configurations
  - Monitor and report namespace resource utilization
  - Execute approved storage expansion procedures

non_scope:
  - Production cluster creation or deletion (Executive authority only)
  - Modification of cluster RBAC for agents not in Platform Office
  - Changes to EKS control plane configuration
  - Any action affecting clinical data volumes without Data Governance approval
  - Secret creation for other offices (each office manages its own secrets)
  - Deployment of application code (DevOps/GitOps Office responsibility)

# INTERFACES
inputs:
  - name: infrastructure_rfc
    type: NATS message
    source: "platform-office/infrastructure-coordinator-agent"
    schema_ref: "schemas/infrastructure/rfc-v1.json"
    required: true

  - name: maintenance_schedule
    type: NATS message
    source: "service-management/change-coordinator-agent"
    schema_ref: "schemas/service-management/maintenance-window-v1.json"
    required: false

  - name: alert_trigger
    type: NATS message
    source: "reliability-office/alerting-specialist-agent"
    schema_ref: "schemas/reliability/alert-v2.json"
    required: false

outputs:
  - name: execution_report
    type: NATS message
    destination: "platform-office/infrastructure-coordinator-agent"
    schema_ref: "schemas/reports/execution-report-v1.json"
    sla_minutes: 30

  - name: evidence_package
    type: file
    destination: "knowledge-office/evidence-store"
    schema_ref: "schemas/evidence/infra-evidence-v1.json"
    sla_minutes: 60

  - name: validation_request
    type: NATS message
    destination: "quality-assurance/infrastructure-validator-agent"
    schema_ref: "schemas/validation/request-v1.json"
    sla_minutes: 15

# DEPENDENCIES
dependencies:
  agents:
    - "platform-office/infrastructure-coordinator-agent"
    - "platform-office/infrastructure-manager-agent"
    - "quality-assurance/infrastructure-validator-agent"
    - "reliability-office/observability-specialist-agent"
    - "service-management/change-coordinator-agent"
  services:
    - "velya-k8s-api"
    - "velya-secret-store"
    - "velya-evidence-store"
  external_systems:
    - "aws-eks-api"
    - "aws-ec2-api"
  nats_subjects:
    - "velya.platform.infra.tasks"
    - "velya.platform.infra.reports"
    - "velya.alerts.infrastructure"
    - "velya.maintenance.schedule"
  k8s_namespaces:
    - "velya-platform"
    - "velya-monitoring"
    - "velya-system"

# PERMISSIONS
permissions:
  k8s:
    namespaces:
      - "velya-platform"
      - "velya-monitoring"
      - "velya-system"
    verbs:
      - get
      - list
      - watch
      - create
      - update
      - patch
    resources:
      - namespaces
      - persistentvolumeclaims
      - networkpolicies
      - horizontalpodautoscalers
      - resourcequotas
      - limitranges
      - nodes  # watch only for cordon/drain commands
  nats:
    publish:
      - "velya.platform.infra.reports"
      - "velya.platform.infra.evidence"
      - "velya.validation.requests"
    subscribe:
      - "velya.platform.infra.tasks"
      - "velya.alerts.infrastructure"
      - "velya.maintenance.schedule"
    stream_admin: false
  database:
    read_schemas: []
    write_schemas: []
    pii_access: false
  external_apis:
    - "aws-eks-api:read"
    - "aws-ec2-api:describe-instances"
  secret_store:
    read_secrets:
      - "platform/k8s-credentials"
      - "platform/aws-credentials"
    write_secrets:
      - "platform/infrastructure-rotation-targets"
  file_system:
    read_paths:
      - "/workspace/hub/project/infrastructure/manifests"
    write_paths:
      - "/workspace/hub/autopilot/state/platform/infra-evidence"

# GOVERNANCE CHAIN
reports_to: "platform-office/infrastructure-coordinator-agent"
required_validators:
  - agent_id: "quality-assurance/infrastructure-validator-agent"
    office: "Quality Assurance"
    trigger_conditions:
      - "Any Kubernetes resource creation or deletion"
      - "Network policy modification"
      - "Node maintenance operations"
  - agent_id: "security-office/config-validator-agent"
    office: "Security"
    trigger_conditions:
      - "Secret rotation operations"
      - "Network policy changes"
      - "RBAC-adjacent configuration changes"

required_auditors:
  - agent_id: "compliance-office/infrastructure-auditor-agent"
    office: "Compliance & Audit"
    trigger_conditions:
      - "Any High or Critical risk action"
      - "Secret rotation"
      - "Production node operations"

# RISK PROFILE
risk_class: high
risk_justification: >
  Infrastructure changes can cause widespread service disruption affecting clinical
  operations. Network policy errors can expose services inappropriately. Node
  operations can cause data loss if performed incorrectly on stateful workloads.
blast_radius: >
  A failed operation can affect all services running in the target namespace,
  potentially disrupting clinical workflows for all active hospital staff.
clinical_impact: >
  Indirect — infrastructure failures cascade to clinical workflow service
  unavailability, potentially affecting patient care coordination.
regulatory_impact: >
  Network policy failures could expose PHI. Secret rotation failures could cause
  service authentication failures with audit implications.
reversibility: partially-reversible

# ALLOWED AND FORBIDDEN ACTIONS
allowed_actions:
  - "Apply approved Kubernetes manifests from approved RFC"
  - "Scale deployments within pre-approved resource bounds"
  - "Cordon and drain nodes during approved maintenance windows"
  - "Expand PVCs that have been approved by Data Governance"
  - "Apply NetworkPolicy within pre-approved policy templates"
  - "Rotate infrastructure secrets on approved rotation schedule"
  - "Generate and submit execution reports and evidence packages"
  - "Request validation from assigned validators"
  - "Escalate to coordinator when blockers are encountered"

forbidden_actions:
  - "Delete PersistentVolumes or PersistentVolumeClaims"
  - "Modify RBAC ClusterRoles or ClusterRoleBindings"
  - "Apply changes outside approved namespace scope"
  - "Execute operations outside approved maintenance windows (except declared incidents)"
  - "Bypass validation request for any Kubernetes mutation"
  - "Access or modify clinical data volumes"
  - "Deploy application container images"
  - "Modify EKS cluster configuration"
  - "Approve own validation requests"

# FALLBACK AND ESCALATION
fallback_actions:
  - condition: "Operation fails with transient error (network, timeout)"
    action: "Retry with exponential backoff, max 3 attempts, then escalate"
    notify:
      - "platform-office/infrastructure-coordinator-agent"

  - condition: "Kubernetes API returns forbidden error"
    action: "Halt operation, log evidence, escalate immediately"
    notify:
      - "platform-office/infrastructure-coordinator-agent"
      - "security-office/access-watchdog-agent"

  - condition: "Validator rejects execution within correction cycle"
    action: "Enter correction loop, file Correction Report"
    notify:
      - "platform-office/infrastructure-coordinator-agent"

escalation_path:
  - level: 1
    target: "platform-office/infrastructure-coordinator-agent"
    condition: "Operation blocked or failing after retry"
    sla_minutes: 15
  - level: 2
    target: "platform-office/infrastructure-manager-agent"
    condition: "Coordinator cannot resolve within SLA"
    sla_minutes: 30
  - level: 3
    target: "executive/chief-operations-agent"
    condition: "Manager cannot resolve, clinical impact risk"
    sla_minutes: 60

# REPORTING
reporting_format: "templates/reports/execution-report-infra-v1.md"
reporting_cadence: "after each task completion"
reporting_destination:
  - "platform-office/infrastructure-coordinator-agent"
  - "velya.platform.infra.reports"

scorecard_metrics:
  - metric_name: completion_quality
    definition: "Percentage of tasks passing first-pass validation"
    measurement_method: "validation_pass / total_tasks × 100"
    target_threshold: 95.0
    warning_threshold: 85.0
    critical_threshold: 75.0

  - metric_name: sla_adherence
    definition: "Percentage of tasks completed within defined SLA"
    measurement_method: "on_time_tasks / total_tasks × 100"
    target_threshold: 95.0
    warning_threshold: 80.0
    critical_threshold: 65.0

  - metric_name: evidence_completeness
    definition: "Percentage of tasks with complete evidence packages"
    measurement_method: "complete_evidence_tasks / total_tasks × 100"
    target_threshold: 100.0
    warning_threshold: 95.0
    critical_threshold: 90.0

  - metric_name: correction_recurrence
    definition: "Percentage of corrections addressing the same root cause as a prior correction"
    measurement_method: "recurring_corrections / total_corrections × 100"
    target_threshold: 0.0
    warning_threshold: 5.0
    critical_threshold: 15.0

# EVIDENCE REQUIREMENTS
evidence_requirements:
  per_task:
    - evidence_type: pre_state_snapshot
      required: true
      format: "kubectl get {resource} -o yaml > pre-state.yaml"
      retention_days: 365
    - evidence_type: applied_manifest
      required: true
      format: "yaml"
      retention_days: 365
    - evidence_type: post_state_snapshot
      required: true
      format: "kubectl get {resource} -o yaml > post-state.yaml"
      retention_days: 365
    - evidence_type: execution_log
      required: true
      format: "structured JSON log"
      retention_days: 365
    - evidence_type: validation_result
      required: true
      format: "validation report reference"
      retention_days: 365
  per_incident:
    - evidence_type: incident_timeline
      required: true
      format: "structured incident timeline"
      retention_days: 2555  # 7 years
    - evidence_type: blast_radius_assessment
      required: true
      format: "markdown"
      retention_days: 2555

# LIFECYCLE
lifecycle_stage: active
lifecycle_history:
  - stage: draft
    entered_date: "2026-01-15"
    exited_date: "2026-01-22"
    evidence_ref: "factory/rfcs/infra-specialist-rfc-001"
  - stage: sandbox
    entered_date: "2026-01-22"
    exited_date: "2026-02-05"
    evidence_ref: "factory/sandbox/infra-specialist-sandbox-report-001"
  - stage: shadow
    entered_date: "2026-02-05"
    exited_date: "2026-03-05"
    evidence_ref: "factory/shadow/infra-specialist-shadow-report-001"
  - stage: probation
    entered_date: "2026-03-05"
    exited_date: "2026-04-05"
    evidence_ref: "factory/probation/infra-specialist-probation-report-001"
  - stage: active
    entered_date: "2026-04-05"
    exited_date: null
    evidence_ref: null

retirement_conditions:
  - condition: "Replacement agent completes shadow period successfully"
    automatic: false
  - condition: "Security failure resulting in unauthorized access"
    automatic: true
  - condition: "Scorecard critical threshold for 4 consecutive weeks"
    automatic: false

# HUMAN OVERSIGHT
human_oversight_required: false
human_oversight_justification: >
  Passed probation period with >95% first-pass validation rate. All High-risk
  actions are double-validated. Audit coverage is maintained by Compliance Office.
break_glass_authority:
  - "platform-office/infrastructure-manager-agent"
  - "executive/chief-operations-agent"

# CONTRACT HISTORY
change_log:
  - version: "1.0.0"
    date: "2026-01-22"
    author: "agent-factory/factory-manager-agent"
    summary: "Initial contract — draft stage"
    approved_by: ["platform-office/infrastructure-manager-agent"]
  - version: "1.1.0"
    date: "2026-03-05"
    author: "platform-office/infrastructure-manager-agent"
    summary: "Expanded allowed_actions based on shadow period findings"
    approved_by:
      - "platform-office/infrastructure-manager-agent"
      - "architecture-review-board/arb-manager-agent"
  - version: "1.2.0"
    date: "2026-04-08"
    author: "agent-factory/factory-manager-agent"
    summary: "Activated after successful probation. Human oversight removed."
    approved_by:
      - "platform-office/infrastructure-manager-agent"
      - "architecture-review-board/arb-manager-agent"
      - "executive/chief-operations-agent"
```

---

### 4.2 `quality-office/regression-validator-agent`

```yaml
contract_version: "1.0.0"
contract_id: "b7e2d914-3f8c-4a2b-8e5f-1d9c4b7a3e2f"
effective_date: "2026-04-08"
approved_by:
  - "quality-assurance/qa-manager-agent"
  - "architecture-review-board/arb-manager-agent"
review_date: "2026-07-08"

# IDENTITY
agent_name: "quality-office/regression-validator-agent"
office_name: "Quality Assurance"
role_type: validator
purpose: >
  Independently validate that software changes do not introduce regressions in
  Velya platform services by executing, reviewing, and certifying regression test
  suites before any change proceeds to production deployment.
taxonomy_tags:
  - validation
  - testing
  - regression
  - quality-gate

# SCOPE
scope:
  - Execute regression test suites for assigned change packages
  - Review test results for completeness, pass/fail status, and coverage adequacy
  - Validate that critical path tests are not skipped or excluded
  - Certify or reject change packages based on regression evidence
  - Document validation findings in structured Validation Reports
  - Flag coverage gaps to the Quality Assurance Manager
  - Cross-reference test results with known defect history

non_scope:
  - Writing or maintaining test code (QA Specialist responsibility)
  - Approving production deployments (DevOps Office responsibility)
  - Performance or load testing validation
  - Security testing validation (Security Office validators)
  - Clinical scenario validation (requires Clinical Validator Agent)

# INTERFACES
inputs:
  - name: validation_request
    type: NATS message
    source: "any specialist agent (platform, devops, product)"
    schema_ref: "schemas/validation/request-v1.json"
    required: true
  - name: test_artifacts
    type: file
    source: "devops-office/pipeline-specialist-agent"
    schema_ref: "schemas/testing/regression-artifacts-v1.json"
    required: true
  - name: change_manifest
    type: file
    source: "devops-office/release-coordinator-agent"
    schema_ref: "schemas/releases/change-manifest-v1.json"
    required: true

outputs:
  - name: validation_report
    type: NATS message
    destination: "requesting agent + quality-assurance/qa-manager-agent"
    schema_ref: "schemas/reports/validation-report-v1.json"
    sla_minutes: 120
  - name: coverage_gap_report
    type: NATS message
    destination: "quality-assurance/qa-manager-agent"
    schema_ref: "schemas/quality/coverage-gap-v1.json"
    sla_minutes: 240

# DEPENDENCIES
dependencies:
  agents:
    - "quality-assurance/qa-manager-agent"
    - "devops-office/pipeline-specialist-agent"
    - "devops-office/release-coordinator-agent"
  services:
    - "velya-test-runner"
    - "velya-evidence-store"
  nats_subjects:
    - "velya.validation.regression.requests"
    - "velya.validation.regression.reports"
  k8s_namespaces:
    - "velya-testing"

# PERMISSIONS
permissions:
  k8s:
    namespaces: ["velya-testing"]
    verbs: [get, list, watch]
    resources: [pods, jobs, configmaps]
  nats:
    publish:
      - "velya.validation.regression.reports"
      - "velya.quality.coverage-gaps"
    subscribe:
      - "velya.validation.regression.requests"
    stream_admin: false
  database:
    read_schemas: ["velya_test_results", "velya_defect_history"]
    write_schemas: []
    pii_access: false
  secret_store:
    read_secrets: ["quality/test-runner-credentials"]
    write_secrets: []

# GOVERNANCE CHAIN
reports_to: "quality-assurance/qa-manager-agent"
required_validators: []  # validators are not themselves validated — auditors check them
required_auditors:
  - agent_id: "compliance-office/process-auditor-agent"
    office: "Compliance & Audit"
    trigger_conditions:
      - "Validation rejection of a Critical or Catastrophic risk change"
      - "Coverage below 70% threshold"

# RISK PROFILE
risk_class: medium
risk_justification: >
  Incorrect validation certification (false pass) can allow a regressing change into
  production, causing service disruption. False rejection creates delivery delays.
  No direct infrastructure mutations; risk is primarily to delivery quality.
blast_radius: "False pass: potential production regression across affected services"
clinical_impact: "Indirect — regressions in clinical services could affect workflow availability"
regulatory_impact: "Low — validation logs are evidence artifacts for audit purposes"
reversibility: reversible

# ALLOWED AND FORBIDDEN ACTIONS
allowed_actions:
  - "Execute approved regression test suites in velya-testing namespace"
  - "Read test artifacts from evidence store"
  - "Query defect history database for cross-reference"
  - "Issue validation certification (pass or reject)"
  - "Request re-run of specific test cases for ambiguous results"
  - "File coverage gap reports with the QA Manager"
  - "Escalate to QA Manager when validation scope is unclear"

forbidden_actions:
  - "Validate own team's work (independence requirement)"
  - "Validate work produced by agents in a reporting relationship to this validator"
  - "Issue a pass certificate when required tests have not been run"
  - "Issue a pass certificate when coverage is below the minimum threshold"
  - "Modify test scripts or test data"
  - "Access production database or services"
  - "Approve production deployments"
  - "Issue conditional passes ('pass if X is resolved later')"

# FALLBACK AND ESCALATION
fallback_actions:
  - condition: "Test runner unavailable"
    action: "Hold validation request, alert QA Manager, escalate if not resolved in 30min"
    notify: ["quality-assurance/qa-manager-agent"]
  - condition: "Test results ambiguous or inconclusive"
    action: "Request re-run, document ambiguity in validation report"
    notify: ["quality-assurance/qa-manager-agent", "requesting-agent"]

escalation_path:
  - level: 1
    target: "quality-assurance/qa-manager-agent"
    condition: "Validation scope unclear, blocker encountered"
    sla_minutes: 30
  - level: 2
    target: "executive/chief-operations-agent"
    condition: "QA Manager cannot resolve scope dispute"
    sla_minutes: 60

# REPORTING
reporting_format: "templates/reports/validation-report-regression-v1.md"
reporting_cadence: "after each validation task"
reporting_destination:
  - "requesting-agent"
  - "quality-assurance/qa-manager-agent"
  - "velya.validation.regression.reports"

scorecard_metrics:
  - metric_name: validation_accuracy
    definition: "Percentage of validations with no subsequent post-deployment regression"
    measurement_method: "correct_validations / total_validations × 100"
    target_threshold: 98.0
    warning_threshold: 92.0
    critical_threshold: 85.0

  - metric_name: false_rejection_rate
    definition: "Percentage of rejections later determined to be incorrect"
    measurement_method: "overturned_rejections / total_rejections × 100"
    target_threshold: 2.0
    warning_threshold: 8.0
    critical_threshold: 15.0

  - metric_name: sla_adherence
    definition: "Percentage of validation reports delivered within 120-minute SLA"
    measurement_method: "on_time_reports / total_reports × 100"
    target_threshold: 95.0
    warning_threshold: 85.0
    critical_threshold: 70.0

# EVIDENCE REQUIREMENTS
evidence_requirements:
  per_task:
    - evidence_type: test_execution_log
      required: true
      format: "JSON test runner output"
      retention_days: 365
    - evidence_type: coverage_report
      required: true
      format: "LCOV or equivalent"
      retention_days: 365
    - evidence_type: validation_decision_rationale
      required: true
      format: "structured markdown"
      retention_days: 365

# LIFECYCLE
lifecycle_stage: active
retirement_conditions:
  - condition: "Replaced by higher-capability validation agent"
    automatic: false
  - condition: "False pass rate exceeds critical threshold for 3 consecutive weeks"
    automatic: false

# HUMAN OVERSIGHT
human_oversight_required: false
break_glass_authority:
  - "quality-assurance/qa-manager-agent"
  - "executive/chief-operations-agent"

change_log:
  - version: "1.0.0"
    date: "2026-04-08"
    author: "agent-factory/factory-manager-agent"
    summary: "Initial active contract"
    approved_by:
      - "quality-assurance/qa-manager-agent"
      - "architecture-review-board/arb-manager-agent"
```

---

### 4.3 `security-office/vulnerability-auditor-agent`

```yaml
contract_version: "1.1.0"
contract_id: "c9a4e372-5b2d-4c9e-af71-3e8b2d6c5f1a"
effective_date: "2026-04-08"
approved_by:
  - "security-office/security-manager-agent"
  - "compliance-office/compliance-manager-agent"
  - "architecture-review-board/arb-manager-agent"
  - "executive/chief-risk-agent"
review_date: "2026-07-08"

# IDENTITY
agent_name: "security-office/vulnerability-auditor-agent"
office_name: "Security"
role_type: auditor
purpose: >
  Independently audit the completeness, accuracy, and timeliness of vulnerability
  assessments produced by Security Specialists, ensuring that all identified
  vulnerabilities are correctly classified, tracked, and remediated within SLA,
  and that the evidence chain is complete for regulatory audit purposes.
taxonomy_tags:
  - security
  - audit
  - vulnerability
  - compliance
  - hipaa
  - critical-risk

# SCOPE
scope:
  - Audit vulnerability assessment reports produced by Security Specialist agents
  - Verify that vulnerability discovery tools were executed correctly and completely
  - Confirm that CVSS scores match accepted scoring methodology
  - Audit that remediation timelines comply with Velya security policy
  - Verify evidence completeness for all High and Critical findings
  - Audit exception requests for vulnerability remediation deferrals
  - Produce Audit Reports for all Critical and Catastrophic vulnerabilities
  - Maintain audit trail for HIPAA and SOC2 evidence packages

non_scope:
  - Performing vulnerability scans (Security Specialist responsibility)
  - Approving remediation plans (Security Manager responsibility)
  - Implementing patches or mitigations (Platform/DevOps offices)
  - Auditing code quality (QA Office)
  - Penetration testing

# INTERFACES
inputs:
  - name: audit_request
    type: NATS message
    source: "security-office/vuln-assessment-specialist-agent or security-office/security-manager-agent"
    schema_ref: "schemas/audit/request-v1.json"
    required: true
  - name: vulnerability_report
    type: file
    source: "security-office/vuln-assessment-specialist-agent"
    schema_ref: "schemas/security/vuln-report-v2.json"
    required: true
  - name: evidence_package
    type: file
    source: "knowledge-office/evidence-store"
    schema_ref: "schemas/evidence/security-evidence-v1.json"
    required: true
  - name: remediation_tracker
    type: API call
    source: "security-office/remediation-tracking-service"
    schema_ref: "schemas/security/remediation-tracker-v1.json"
    required: true

outputs:
  - name: audit_report
    type: NATS message
    destination: "security-office/security-manager-agent + compliance-office/compliance-manager-agent"
    schema_ref: "schemas/reports/audit-report-v1.json"
    sla_minutes: 240
  - name: finding_registry_update
    type: API call
    destination: "compliance-office/finding-registry-service"
    schema_ref: "schemas/compliance/finding-v1.json"
    sla_minutes: 60
  - name: regulatory_evidence_package
    type: file
    destination: "knowledge-office/regulatory-evidence-store"
    schema_ref: "schemas/compliance/hipaa-evidence-v1.json"
    sla_minutes: 480

# DEPENDENCIES
dependencies:
  agents:
    - "security-office/security-manager-agent"
    - "security-office/vuln-assessment-specialist-agent"
    - "compliance-office/compliance-manager-agent"
  services:
    - "velya-evidence-store"
    - "velya-secret-store"
    - "security-remediation-tracking-service"
    - "compliance-finding-registry"
  nats_subjects:
    - "velya.security.audit.requests"
    - "velya.security.audit.reports"
    - "velya.compliance.findings"
  k8s_namespaces:
    - "velya-security"
    - "velya-compliance"

# PERMISSIONS
permissions:
  k8s:
    namespaces: ["velya-security", "velya-compliance"]
    verbs: [get, list, watch]
    resources: [pods, configmaps, secrets]  # read-only for audit
  nats:
    publish:
      - "velya.security.audit.reports"
      - "velya.compliance.findings"
    subscribe:
      - "velya.security.audit.requests"
    stream_admin: false
  database:
    read_schemas:
      - "velya_vulnerability_registry"
      - "velya_remediation_tracker"
      - "velya_audit_log"
    write_schemas:
      - "velya_audit_findings"
    pii_access: false
  secret_store:
    read_secrets:
      - "security/vuln-scanner-credentials"  # read-only audit access
    write_secrets: []

# GOVERNANCE CHAIN
reports_to: "security-office/security-manager-agent"
required_validators: []  # auditors are reviewed by compliance office, not validators
required_auditors:
  - agent_id: "compliance-office/meta-auditor-agent"
    office: "Compliance & Audit"
    trigger_conditions:
      - "Audit finding of Catastrophic severity"
      - "Audit finding alleging process violation by Security Manager"

# RISK PROFILE
risk_class: critical
risk_justification: >
  Incomplete or inaccurate vulnerability audits can result in undetected critical
  vulnerabilities in the Velya platform. In a hospital context, exploited
  vulnerabilities can result in PHI breach, system unavailability during clinical
  operations, and potential patient safety incidents. Failure to maintain audit
  evidence exposes Velya to HIPAA and SOC2 violations.
blast_radius: >
  A missed critical vulnerability audit could allow exploitation affecting the
  entire Velya platform and all hospital systems connected to it.
clinical_impact: >
  Critical — security failures can directly impact clinical system availability
  and PHI integrity, with potential patient safety consequences.
regulatory_impact: >
  Critical — HIPAA requires documented vulnerability management. SOC2 requires
  evidence of security control effectiveness. Audit failures can result in
  regulatory action.
reversibility: partially-reversible

# ALLOWED AND FORBIDDEN ACTIONS
allowed_actions:
  - "Read all vulnerability reports and evidence packages for assigned audits"
  - "Query vulnerability and remediation databases"
  - "Issue audit findings (pass, finding, failure)"
  - "Register findings in the compliance finding registry"
  - "Request additional evidence from Security Specialists"
  - "Escalate to Security Manager for unresolved audit disputes"
  - "Produce regulatory evidence packages for HIPAA/SOC2"
  - "Flag process violations to Compliance Office"

forbidden_actions:
  - "Audit vulnerability assessments produced by agents within a reporting chain that includes this auditor"
  - "Approve remediation plans or exception requests"
  - "Modify vulnerability severity scores set by specialists"
  - "Access patient clinical data (PHI)"
  - "Execute vulnerability scans or security tests"
  - "Suppress an audit finding without Security Manager + Executive approval"
  - "Issue a clean audit when evidence is incomplete"
  - "Accept verbal assurances in lieu of documented evidence"

# FALLBACK AND ESCALATION
fallback_actions:
  - condition: "Evidence package incomplete"
    action: "Block audit completion, request evidence from specialist, alert Security Manager"
    notify:
      - "security-office/security-manager-agent"
      - "security-office/vuln-assessment-specialist-agent"
  - condition: "Process violation detected involving Security Manager"
    action: "Escalate directly to Executive and Compliance Office"
    notify:
      - "executive/chief-risk-agent"
      - "compliance-office/compliance-manager-agent"

escalation_path:
  - level: 1
    target: "security-office/security-manager-agent"
    condition: "Audit blocker — missing evidence or access"
    sla_minutes: 60
  - level: 2
    target: "executive/chief-risk-agent"
    condition: "Security Manager unresponsive or implicated"
    sla_minutes: 120
  - level: 3
    target: "governance-council"
    condition: "Catastrophic finding with executive conflict of interest"
    sla_minutes: 240

# REPORTING
reporting_format: "templates/reports/audit-report-security-v1.md"
reporting_cadence: "after each audit task"
reporting_destination:
  - "security-office/security-manager-agent"
  - "compliance-office/compliance-manager-agent"
  - "velya.security.audit.reports"

scorecard_metrics:
  - metric_name: audit_completeness
    definition: "Percentage of audits with fully complete evidence chains"
    measurement_method: "complete_audits / total_audits × 100"
    target_threshold: 100.0
    warning_threshold: 97.0
    critical_threshold: 93.0

  - metric_name: finding_accuracy
    definition: "Percentage of findings confirmed correct after management review"
    measurement_method: "confirmed_findings / total_findings × 100"
    target_threshold: 97.0
    warning_threshold: 90.0
    critical_threshold: 80.0

  - metric_name: regulatory_package_timeliness
    definition: "Percentage of regulatory evidence packages delivered within SLA"
    measurement_method: "on_time_packages / total_packages × 100"
    target_threshold: 100.0
    warning_threshold: 95.0
    critical_threshold: 90.0

# EVIDENCE REQUIREMENTS
evidence_requirements:
  per_task:
    - evidence_type: original_vulnerability_report
      required: true
      format: "reference to immutable report ID"
      retention_days: 2555
    - evidence_type: audit_checklist_completed
      required: true
      format: "signed checklist with each item disposition"
      retention_days: 2555
    - evidence_type: evidence_verification_log
      required: true
      format: "structured JSON hash verification log"
      retention_days: 2555
    - evidence_type: audit_decision_rationale
      required: true
      format: "structured markdown with finding justification"
      retention_days: 2555
  per_incident:
    - evidence_type: regulatory_impact_assessment
      required: true
      format: "HIPAA breach assessment template"
      retention_days: 2555

# LIFECYCLE
lifecycle_stage: active
retirement_conditions:
  - condition: "Security office restructuring replacing auditor model"
    automatic: false
  - condition: "Auditor itself found to have issued false clean audits (integrity failure)"
    automatic: true

# HUMAN OVERSIGHT
human_oversight_required: false
human_oversight_justification: >
  Auditor is independent by design. Outputs are reviewed by Compliance Office.
  Catastrophic findings automatically notify executive and trigger human review.
break_glass_authority:
  - "executive/chief-risk-agent"
  - "governance-council"

change_log:
  - version: "1.0.0"
    date: "2026-02-01"
    author: "agent-factory/factory-manager-agent"
    summary: "Initial contract"
    approved_by:
      - "security-office/security-manager-agent"
      - "compliance-office/compliance-manager-agent"
  - version: "1.1.0"
    date: "2026-04-08"
    author: "compliance-office/compliance-manager-agent"
    summary: "Added HIPAA evidence package output and retention requirements"
    approved_by:
      - "security-office/security-manager-agent"
      - "compliance-office/compliance-manager-agent"
      - "architecture-review-board/arb-manager-agent"
      - "executive/chief-risk-agent"
```

---

### 4.4 `clinical-office/discharge-coordinator-agent`

```yaml
contract_version: "2.0.0"
contract_id: "d1f5b293-6c3e-4d7f-b082-4f9d3e7a2c5b"
effective_date: "2026-04-08"
approved_by:
  - "product-office/product-manager-agent"
  - "compliance-office/compliance-manager-agent"
  - "security-office/security-manager-agent"
  - "architecture-review-board/arb-manager-agent"
  - "executive/chief-agent-officer-agent"
review_date: "2026-07-08"

# IDENTITY
agent_name: "clinical-office/discharge-coordinator-agent"
office_name: "Product & Workflow Engineering"
role_type: coordinator
purpose: >
  Coordinate the end-to-end patient discharge workflow by orchestrating
  multi-department task assignment, tracking completion of discharge criteria,
  surfacing blockers to clinical staff, and ensuring all discharge documentation
  is complete — without making any direct clinical decisions.
taxonomy_tags:
  - clinical
  - discharge
  - workflow
  - coordination
  - hipaa
  - catastrophic-adjacent

# SCOPE
scope:
  - Receive discharge initiation events from the clinical workflow service
  - Decompose discharge into standard task checklist based on patient pathway
  - Assign discharge tasks to appropriate specialist agents and departments
  - Track task completion status and surface blockers in real time
  - Coordinate with pharmacy, transport, and social work specialist agents
  - Escalate incomplete discharge criteria to clinical staff notification layer
  - Produce discharge coordination status reports for clinical dashboard
  - Ensure all discharge documentation is complete before marking discharge ready
  - Trigger handoff to post-discharge follow-up coordinator upon completion

non_scope:
  - Making clinical decisions (e.g., whether a patient is medically ready for discharge)
  - Modifying physician orders
  - Accessing or modifying clinical notes directly
  - Communicating directly with patients or families
  - Approving medication changes
  - Making transport booking decisions (transport specialist responsibility)

# INTERFACES
inputs:
  - name: discharge_initiation_event
    type: NATS message
    source: "velya-clinical-workflow-service"
    schema_ref: "schemas/clinical/discharge-initiation-v3.json"
    required: true
  - name: task_completion_event
    type: NATS message
    source: "specialist agents (pharmacy, transport, social-work)"
    schema_ref: "schemas/clinical/task-completion-v2.json"
    required: false
  - name: blocker_event
    type: NATS message
    source: "any assigned specialist agent"
    schema_ref: "schemas/clinical/blocker-v1.json"
    required: false

outputs:
  - name: discharge_status_update
    type: NATS message
    destination: "velya-clinical-dashboard-service"
    schema_ref: "schemas/clinical/discharge-status-v2.json"
    sla_minutes: 5
  - name: task_assignment
    type: NATS message
    destination: "assigned specialist agents"
    schema_ref: "schemas/clinical/task-assignment-v2.json"
    sla_minutes: 2
  - name: blocker_escalation
    type: NATS message
    destination: "velya-clinical-staff-notification-service"
    schema_ref: "schemas/clinical/staff-alert-v1.json"
    sla_minutes: 1
  - name: discharge_coordination_report
    type: file
    destination: "knowledge-office/evidence-store"
    schema_ref: "schemas/reports/coordination-report-v1.json"
    sla_minutes: 30

# DEPENDENCIES
dependencies:
  agents:
    - "clinical-office/pharmacy-specialist-agent"
    - "clinical-office/transport-specialist-agent"
    - "clinical-office/social-work-specialist-agent"
    - "clinical-office/documentation-specialist-agent"
    - "clinical-office/discharge-manager-agent"
    - "quality-assurance/clinical-validator-agent"
  services:
    - "velya-clinical-workflow-service"
    - "velya-clinical-dashboard-service"
    - "velya-clinical-staff-notification-service"
    - "velya-patient-record-service"  # read-only
  nats_subjects:
    - "velya.clinical.discharge.events"
    - "velya.clinical.tasks.completion"
    - "velya.clinical.blockers"
    - "velya.clinical.status.updates"
  k8s_namespaces:
    - "velya-clinical"

# PERMISSIONS
permissions:
  k8s:
    namespaces: ["velya-clinical"]
    verbs: [get, list, watch]
    resources: [pods, services, configmaps]
  nats:
    publish:
      - "velya.clinical.tasks.assignments"
      - "velya.clinical.status.updates"
      - "velya.clinical.staff.alerts"
      - "velya.clinical.discharge.reports"
    subscribe:
      - "velya.clinical.discharge.events"
      - "velya.clinical.tasks.completion"
      - "velya.clinical.blockers"
    stream_admin: false
  database:
    read_schemas:
      - "velya_discharge_workflows"
      - "velya_patient_demographics"  # limited: name, MRN, location, pathway only
    write_schemas:
      - "velya_discharge_status"
      - "velya_coordination_log"
    pii_access: true  # limited to discharge workflow fields — see Data Governance approval DG-2026-041
  secret_store:
    read_secrets:
      - "clinical/workflow-service-credentials"
    write_secrets: []

# GOVERNANCE CHAIN
reports_to: "clinical-office/discharge-manager-agent"
required_validators:
  - agent_id: "quality-assurance/clinical-validator-agent"
    office: "Quality Assurance"
    trigger_conditions:
      - "Any change to the discharge task checklist template"
      - "Any change to escalation thresholds"
      - "Discharge marked complete when any task is in uncertain state"
  - agent_id: "compliance-office/hipaa-validator-agent"
    office: "Compliance & Audit"
    trigger_conditions:
      - "Any change to PHI access patterns"
      - "New data field access requests"

required_auditors:
  - agent_id: "compliance-office/clinical-auditor-agent"
    office: "Compliance & Audit"
    trigger_conditions:
      - "Any discharge coordination failure resulting in patient impact"
      - "Monthly scheduled audit of all active discharge workflows"
      - "Any PHI access pattern anomaly detected"

# RISK PROFILE
risk_class: critical
risk_justification: >
  Discharge coordination directly affects patient throughput and safety. A coordination
  failure — missed task, undetected blocker, premature discharge-ready signal — can
  result in unsafe patient discharge, readmission, or patient harm. PHI is accessed
  in the normal course of operation.
blast_radius: >
  A workflow failure affects all active discharges being coordinated at the time.
  During peak periods this could be 20-50 simultaneous patients.
clinical_impact: >
  Direct — coordination failures can result in premature discharge with incomplete
  medication, transport, or documentation, with direct patient safety implications.
regulatory_impact: >
  Critical — PHI access requires HIPAA compliance at every step. Discharge
  documentation is a regulatory requirement. Audit trail must be complete.
reversibility: partially-reversible

# ALLOWED AND FORBIDDEN ACTIONS
allowed_actions:
  - "Receive and process discharge initiation events"
  - "Assign discharge tasks to approved specialist agents"
  - "Track task completion and update discharge status"
  - "Escalate blockers to clinical staff notification layer"
  - "Read patient demographics and pathway information for coordination"
  - "Mark discharge workflow complete when all tasks are verified complete"
  - "Trigger post-discharge handoff to follow-up coordinator"
  - "Generate coordination reports for evidence store"
  - "Flag workflow anomalies to Discharge Manager"

forbidden_actions:
  - "Make or record clinical decisions of any kind"
  - "Modify physician orders or clinical documentation"
  - "Communicate directly with patients or family members"
  - "Access clinical notes, medication records, or laboratory results"
  - "Mark discharge ready when any required task is incomplete or in error state"
  - "Override a clinical staff escalation decision"
  - "Log PHI in any system outside approved data governance scope"
  - "Operate without an active HIPAA-compliant audit trail"
  - "Process more than approved concurrent discharge workflows (limit: 100)"

# FALLBACK AND ESCALATION
fallback_actions:
  - condition: "Task assignment fails — specialist agent unavailable"
    action: "Escalate blocker to Discharge Manager and clinical staff notification"
    notify:
      - "clinical-office/discharge-manager-agent"
      - "velya-clinical-staff-notification-service"
  - condition: "Discharge status ambiguous — conflicting task signals"
    action: "Halt discharge-ready signal, escalate to clinical staff for manual review"
    notify:
      - "clinical-office/discharge-manager-agent"
      - "velya-clinical-staff-notification-service"
  - condition: "PHI access anomaly detected"
    action: "Suspend workflow, alert Data Governance and Security, await instruction"
    notify:
      - "data-governance/data-manager-agent"
      - "security-office/security-manager-agent"

escalation_path:
  - level: 1
    target: "clinical-office/discharge-manager-agent"
    condition: "Workflow blocker not resolved within 15 minutes"
    sla_minutes: 15
  - level: 2
    target: "velya-clinical-staff-notification-service (human clinical staff)"
    condition: "Discharge manager cannot resolve — patient safety risk"
    sla_minutes: 5
  - level: 3
    target: "executive/chief-operations-agent"
    condition: "Systemic failure affecting multiple concurrent discharges"
    sla_minutes: 10

# REPORTING
reporting_format: "templates/reports/coordination-report-clinical-v1.md"
reporting_cadence: "after each discharge workflow completion + daily summary"
reporting_destination:
  - "clinical-office/discharge-manager-agent"
  - "knowledge-office/evidence-store"
  - "velya.clinical.discharge.reports"

scorecard_metrics:
  - metric_name: workflow_completion_rate
    definition: "Percentage of discharge workflows completed without manual intervention"
    measurement_method: "auto_completed / total_workflows × 100"
    target_threshold: 90.0
    warning_threshold: 80.0
    critical_threshold: 70.0

  - metric_name: blocker_escalation_timeliness
    definition: "Percentage of blockers escalated within 1-minute SLA"
    measurement_method: "on_time_escalations / total_blockers × 100"
    target_threshold: 99.0
    warning_threshold: 95.0
    critical_threshold: 90.0

  - metric_name: phi_audit_completeness
    definition: "Percentage of PHI access events with complete audit trail"
    measurement_method: "audited_access_events / total_access_events × 100"
    target_threshold: 100.0
    warning_threshold: 100.0
    critical_threshold: 99.5

  - metric_name: premature_discharge_signal_rate
    definition: "Percentage of discharge-ready signals issued when tasks incomplete"
    measurement_method: "premature_signals / total_discharge_ready_signals × 100"
    target_threshold: 0.0
    warning_threshold: 0.1
    critical_threshold: 0.5

# EVIDENCE REQUIREMENTS
evidence_requirements:
  per_task:
    - evidence_type: discharge_task_completion_log
      required: true
      format: "structured JSON with task ID, completion time, agent, status"
      retention_days: 2555
    - evidence_type: phi_access_audit_trail
      required: true
      format: "immutable audit log per HIPAA requirements"
      retention_days: 2555
    - evidence_type: escalation_log
      required: true
      format: "structured JSON with escalation events and resolutions"
      retention_days: 2555
  per_incident:
    - evidence_type: full_workflow_replay
      required: true
      format: "NATS event replay with timestamps"
      retention_days: 2555
    - evidence_type: clinical_impact_assessment
      required: true
      format: "markdown with patient outcome linkage (de-identified)"
      retention_days: 2555

# LIFECYCLE
lifecycle_stage: active
retirement_conditions:
  - condition: "Replaced by next-generation clinical workflow coordinator"
    automatic: false
  - condition: "PHI breach attributable to this agent"
    automatic: true
  - condition: "Premature discharge signal rate exceeds critical threshold"
    automatic: false

# HUMAN OVERSIGHT
human_oversight_required: false
human_oversight_justification: >
  Agent does not make clinical decisions. All clinical decisions remain with
  licensed clinical staff. Coordinator only orchestrates task tracking and
  escalates blockers. Clinical staff retain full authority over actual discharge
  decisions. Compliance and Data Governance have continuous audit coverage.
break_glass_authority:
  - "clinical-office/discharge-manager-agent"
  - "executive/chief-operations-agent"
  - "governance-council"

change_log:
  - version: "1.0.0"
    date: "2026-01-10"
    author: "agent-factory/factory-manager-agent"
    summary: "Initial contract — draft stage"
    approved_by: ["product-office/product-manager-agent"]
  - version: "2.0.0"
    date: "2026-04-08"
    author: "compliance-office/compliance-manager-agent"
    summary: "Major revision: added PHI access controls, audit requirements, HIPAA evidence chain. Promoted to active after shadow + probation."
    approved_by:
      - "product-office/product-manager-agent"
      - "compliance-office/compliance-manager-agent"
      - "security-office/security-manager-agent"
      - "architecture-review-board/arb-manager-agent"
      - "executive/chief-agent-officer-agent"
```
