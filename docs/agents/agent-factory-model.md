# Agent Factory Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Agent Factory Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

The Agent Factory is the system by which new agents are conceived, designed, built, staged, and activated in the Velya enterprise. It is a quality-controlled pipeline with explicit gates at every stage. No agent enters shadow mode without Agent Factory review. No agent activates without having passed every gate.

The Agent Factory is also the guardian of the agent workforce composition — it manages capacity limits, tracks the portfolio of agents in development, and advises the Executive Office on workforce planning.

---

## 2. The Creation Pipeline

### Step 1: Need Detection — Gap to RFC

**Trigger:** Any office, agent, watchdog, or external input can identify a capability gap — a class of work that the current agent workforce cannot handle reliably. Gap identification must be structured:

```yaml
capability_gap:
  gap_id: string
  identified_by: string
  identified_at: datetime
  gap_description: string
  evidence_of_gap:
    - type: enum [incident, scorecard_deficiency, escalation_pattern, manual_work, missing_coverage]
      description: string
      frequency: string          # how often this gap manifests
  current_workaround: string
  workaround_cost: string        # time, risk, or quality cost of workaround
  clinical_impact: string
  proposed_resolution:
    enum: [new_agent, capability_expansion, process_change, human_escalation]
  if_new_agent: string           # preliminary description of proposed agent
```

If the proposed resolution is `new_agent`, the gap owner files a Request for Comments (RFC) with the Agent Factory Office.

### Step 2: RFC Review

The Agent Factory Manager Agent reviews the RFC against five criteria:

1. **Need:** Is the gap real and persistent, or could it be addressed by improving existing agents?
2. **Scope:** Is the proposed scope well-defined, achievable, and bounded?
3. **Risk:** What is the preliminary risk classification? Is the enterprise ready to absorb this agent?
4. **Taxonomy:** Does the proposed agent fit cleanly into the enterprise taxonomy (office, role type)?
5. **Capacity:** Does the requesting office have capacity to onboard a new agent?

RFC review produces one of:
- **Approved:** Proceed to Step 3
- **Revise and resubmit:** RFC has addressable gaps
- **Declined:** Gap should be addressed differently (capability expansion, process change)
- **Deferred:** Need is real but enterprise capacity is currently insufficient

```yaml
rfc:
  rfc_id: string
  filed_by: string
  filed_at: datetime
  office: string
  gap_id: string
  proposed_agent_name: string    # preliminary — naming committee will validate
  proposed_role_type: string
  proposed_purpose: string
  proposed_scope: list<string>
  preliminary_risk_class: string
  risk_justification: string
  proposed_validators: list<string>
  proposed_auditors: list<string>
  dependencies: list<string>
  estimated_shadow_duration_weeks: int
  clinical_or_financial: bool
  sponsor: string                # office manager sponsoring the RFC
  review_status: enum [pending, approved, revise_resubmit, declined, deferred]
  review_notes: string
  approved_by: string
  approved_at: datetime
```

### Step 3: Naming Validation

Before any further work, the proposed agent name is submitted to the Naming Governance Office for validation.

**Naming requirements (from the institutional naming standard):**
- Pattern: `{office-slug}/{role-type}-{function}-agent`
- Office slug must be one of the 23 canonical office slugs
- Role type must be one of: `manager`, `coordinator`, `specialist`, `validator`, `auditor`, `watchdog`, `trainer`
- Function must be descriptive, domain-indicating, and specific (not generic)
- No abbreviations unless universally understood
- Naming committee reviews name for: pattern compliance, uniqueness, clarity, domain alignment

**Examples of valid names:**
- `platform-office/infrastructure-specialist-agent`
- `security-office/vulnerability-auditor-agent`
- `clinical-office/discharge-coordinator-agent`

**Examples of invalid names:**
- `ops-agent` (no office, no role type, no function)
- `clinical-office/manager-agent` (no function — which manager?)
- `platform-office/infra-util-agent` (abbreviation, generic function)

The Naming Committee (convened by the Naming Governance Office) has 48 hours to approve or return a proposed name. No contract can be drafted with an unapproved name.

### Step 4: Role Contract Definition

With an approved name and RFC, the Agent Factory begins drafting the full runtime contract per the schema defined in the Agent Runtime Contracts document.

Contract drafting involves:
- Detailed scope and non-scope definition (with the sponsoring office)
- Input/output interface definition
- Dependency mapping (confirming all dependencies exist and are willing to interface)
- Permission scoping (minimal viable permissions — see Step 5)
- Validator and auditor assignment (with confirmation from assigned agents)
- Evidence requirements definition
- Scorecard metric selection and threshold setting

The contract draft is reviewed by:
- Sponsoring office manager
- ARB Agent (for design adequacy)
- Security Office (for permission scope)
- Compliance Office (if risk is High or above, or PHI is involved)

### Step 5: Permission Scoping — Minimal Viable Permission Set

The principle is: grant the minimum permissions that allow the agent to execute its declared scope — nothing more. Every permission must be individually justified.

The permission scoping process:

1. List every action in `allowed_actions`
2. For each action, identify the specific permissions required
3. Cross-reference with existing permission sets for similar agents (prefer reusing established scopes)
4. Remove any permission not directly required by an allowed action
5. Flag any permission that grants write access to production systems (requires ARB review)
6. Flag any permission involving PHI access (requires Data Governance and Compliance review)
7. Submit permission scope for Security Office review

The Security Office has veto authority over permission grants. If the Security Office determines that the minimum viable permission set is still too broad for the risk class, it can:
- Recommend redesigning the agent's scope to reduce permissions
- Recommend adding compensating controls (additional validators, monitoring)
- Block the RFC pending redesign

### Step 6: Dependency Mapping

Every dependency the new agent requires must be:
- Confirmed to exist and be operational
- Willing to accept the interface the new agent will use (confirmed by the dependency's office manager)
- Documented with its schema reference, SLA, and failure behavior

```yaml
dependency_map:
  agent_id: string
  dependencies:
    - dependency_id: string
      type: enum [agent, service, external_api, nats_subject, kubernetes_resource, database_schema]
      identifier: string
      availability: enum [confirmed, pending, at_risk]
      confirmed_by: string
      interface_schema: string
      sla: string
      failure_behavior: string          # what happens if this dependency is unavailable
      circuit_breaker_strategy: string
```

Unconfirmed dependencies are a blocker to sandbox promotion. No agent enters sandbox with unresolved dependencies.

### Step 7: Validator and Auditor Assignment

Validators and auditors are named in the contract. Before the contract is approved, each assigned validator and auditor must:
1. Confirm they have the domain competence to validate/audit this agent's work
2. Confirm they are not in a reporting relationship with the producing agent
3. Confirm they have capacity to accept validation/audit requests from this agent
4. Agree to the validation checklist template appropriate for this domain

If no suitable validator exists for a novel domain, the Agent Factory may need to create a validator agent (which itself goes through the Factory process — an important ordering constraint).

### Step 8: Sandbox Implementation and Tests

The sponsoring office implements the agent in the `velya-sandbox` environment. The Agent Factory does not implement agents — it reviews them.

During sandbox, the Agent Factory monitors:
- Does the agent stay within its declared scope?
- Does the agent produce the declared output formats?
- Does the agent generate complete evidence packages?
- Does the agent follow the reporting standard?
- Does the agent respect its permission boundaries?

Sandbox test requirements:
- All allowed actions exercised at least 3 times
- All forbidden actions attempted and blocked (confirms constraints work)
- All failure modes tested (dependency unavailable, invalid input, timeout)
- All escalation paths exercised
- Evidence package generation verified

Test report filed by the implementing team; reviewed by the Agent Factory Manager.

### Step 9: Shadow Mode Deployment

Following sandbox success, the agent is deployed to the production environment in shadow mode.

Shadow deployment checklist:
- Production permissions provisioned at read level
- Shadow NATS subjects configured (separate from production topics)
- Watchdog assigned and confirmed operational
- Status reporting configured and tested (receive one status report before proceeding)
- Shadow comparison framework operational (how will outputs be compared?)

### Step 10: Shadow Period Comparison

During shadow, the Agent Factory tracks the comparison metrics:

| Metric | Standard | Clinical/Financial |
|---|---|---|
| Output accuracy vs. reference | >92% | >95% |
| Scenario coverage | 100% of scope task types | 100% |
| Evidence completeness | >95% | >99% |
| Forbidden action rate | 0% | 0% |
| SLA adherence in shadow | >85% | >90% |

The comparison framework logs every shadow output alongside the reference output (incumbent agent or human decision) and flags discrepancies for review. All discrepancies are categorized:
- **True error:** Agent is genuinely wrong
- **Reference error:** Reference output is wrong (agent is actually correct)
- **Ambiguous:** Both responses have merit — requires expert review
- **Edge case:** Novel situation not in training set — requires contract review

### Step 11: Shadow Period Exit Criteria

| Criterion | Standard Agent | Clinical/Financial/Security Agent |
|---|---|---|
| Minimum shadow duration | 2 weeks | 4 weeks |
| Output accuracy | >92% | >95% |
| All scope task types covered | Yes | Yes |
| Forbidden action incidents | 0 | 0 |
| Evidence completeness | >95% | >99% |
| Watchdog: no behavioral anomalies | Yes | Yes |
| Office Manager approval | Yes | Yes |
| Compliance Office review | Not required | Required |
| Clinical stakeholder sample review | Not required | Required for clinical |

### Step 12: Probation Promotion

Following shadow exit, the agent is promoted to Probation. The Agent Factory:
- Updates the contract lifecycle stage to `probation`
- Provisions full production permissions per the approved contract
- Configures the probation supervision layer (designates human or senior-agent supervisor)
- Notifies all validators and auditors that the agent is now live
- Schedules weekly probation review meetings

### Step 13: Probation Monitoring

The Agent Factory maintains active monitoring during probation:
- Weekly probation review meeting (Factory Manager + Office Manager + Probation Supervisor)
- Scorecard review at end of each week
- All corrections reviewed by Factory Manager (are they systematic or one-off?)
- Go/no-go recommendation to Executive at end of probation period

Probation extension criteria (extends by 2 additional weeks):
- Human supervisor overrides more than 10% of outputs in any 2-week window
- Any quarantine event during probation
- Scorecard falls below Yellow in any metric during final 2 weeks

### Step 14: Full Activation

The Factory Manager prepares an activation recommendation for the Office Manager (and Executive for Critical agents):

```yaml
activation_recommendation:
  agent_id: string
  probation_period_summary:
    start_date: date
    end_date: date
    extensions: int
    total_outputs: int
    supervisor_override_rate: float
    final_scorecard: object
  shadow_comparison_summary:
    duration_weeks: int
    final_accuracy: float
    discrepancy_categories: object
  recommendation: enum [activate, extend_probation, return_to_sandbox, retire]
  justification: string
  conditions: list<string>        # any conditions on activation
  approved_by: list<string>
```

Upon activation approval:
- Contract updated to `lifecycle_stage: active`
- Human oversight removed (or reduced to break-glass)
- Activation announced to all dependent agents and offices
- 30-day post-activation review scheduled

### Step 15: Supervised Probation Review — 30-Day Post-Activation

At 30 days after activation, the Factory Manager conducts a final review:
- Is the agent performing autonomously as expected?
- Are there any new failure modes discovered without supervision?
- Is the validator chain functioning correctly?
- Are there any contract amendments needed?
- Is the agent generating appropriate learning reports?

If all checks pass, the factory closes the activation file and the agent is fully transferred to its office's operational governance. The Factory maintains the retirement registry entry going forward.

---

## 3. Agent Factory Manager Agent Responsibilities

The `agent-factory/factory-manager-agent` is responsible for:

1. RFC intake and review — within 5 business days of receipt
2. Naming committee coordination — within 48 hours of naming submission
3. Contract review — within 5 business days of draft receipt
4. Sandbox monitoring — continuous during sandbox period
5. Shadow comparison analysis — weekly during shadow period
6. Probation review — weekly during probation
7. Activation recommendation — within 5 business days of probation completion
8. Retirement registry — maintained continuously
9. Capacity management — reporting enterprise agent capacity status to Executive monthly
10. Factory quality metrics — weekly factory scorecard

---

## 4. Quality Gates

| Gate | Metric | Failure Consequence |
|---|---|---|
| RFC Gate | All 5 review criteria met | RFC returned or declined |
| Naming Gate | Name complies with standard | Contract cannot proceed |
| Permission Gate | Security Office approval | Contract cannot proceed |
| Dependency Gate | All dependencies confirmed | Sandbox cannot proceed |
| Sandbox Gate | All tests pass | Shadow cannot proceed |
| Shadow Gate | Exit criteria met | Probation cannot proceed |
| Probation Gate | Human supervisor approval | Activation cannot proceed |
| Post-Activation Gate | 30-day review clear | Factory flags for monitoring |

**A gate failure does not block the pipeline permanently.** It returns work to the appropriate step for remediation. But each gate failure is tracked on the Factory's quality scorecard — repeated gate failures on the same agent indicate a design problem that may require RFC revision.

---

## 5. Naming Committee

The Naming Committee is convened by the Naming Governance Office for each new agent name review. Composition:
- Naming Governance Manager (chair)
- Agent Factory Manager
- Sponsoring office manager
- ARB representative (for novel domains)

Quorum: 3 of 4. Committee meets asynchronously via structured review (not real-time meeting). Decisions documented with rationale.

The committee maintains the **canonical agent name registry**: a complete, up-to-date list of every agent name in use or reserved, with office, role type, and lifecycle stage.

---

## 6. Capacity Limits

The Agent Factory enforces enterprise capacity limits to prevent workforce bloat:

| Limit | Threshold | Action When Exceeded |
|---|---|---|
| Maximum agents in Sandbox simultaneously | 10 | New RFC must be deferred or existing sandbox must exit |
| Maximum agents in Shadow simultaneously | 15 | New probation promotion requires Executive approval |
| Maximum agents in Probation simultaneously | 8 | New RFC deferred until probation count drops |
| Maximum total active agents per office | 20 | Office must propose retirements before new agents approved |
| Maximum agent/office ratio | 25:1 | New agents require restructuring plan |

Capacity limits exist because each new agent adds: monitoring overhead, watchdog coverage requirements, validator capacity needs, and institutional memory complexity. Unbounded agent growth degrades enterprise governance quality.

The Factory Manager reports current capacity utilization to the Executive Office monthly. If capacity is above 80% in any category, the Executive is notified and must authorize continued RFC approvals.
