# Agent Retirement Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Agent Factory Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Retirement is the formal end of an agent's operational existence. Like quarantine, it is not punishment. It is the responsible conclusion of an agent's lifecycle when the agent is no longer the right instrument for its purpose — whether because a better replacement exists, because the agent has drifted beyond correction, or because an urgent safety or security event demands immediate deactivation.

Retirement is never instantaneous except in emergencies. The standard path preserves knowledge, ensures continuity, and produces an institutional record of what the agent did, what it learned, and why it was retired.

---

## 2. Retirement Triggers

### 2.1 Voluntary Deprecation (Planned)

The most common and preferred retirement path. Triggered when:
- A replacement agent has been developed and is in Shadow or Probation phase
- The office's strategic direction changes and the agent's charter is superseded
- The agent's domain has been absorbed by a different office
- The agent's tools or integrations are being decommissioned (e.g., a downstream service is retired)

### 2.2 Capability Drift

When an agent's capability no longer meets institutional requirements:
- Scorecard in critical threshold for 8 consecutive weeks despite multiple correction attempts
- Agent has been through 3 or more full quarantine/requalification cycles without sustained improvement
- The domain has evolved beyond the agent's training such that correction is not cost-effective
- The agent's contract cannot be amended to restore fit without effectively redesigning the agent

### 2.3 Replacement by Newer Agent

When the Agent Factory produces a replacement:
- Shadow comparison shows the new agent outperforms the incumbent on all scorecard dimensions
- The new agent passes all required lifecycle stages and is ready for activation
- The incumbent's charter is fully covered by the new agent's scope

### 2.4 Security Failure

When the agent has been involved in or caused a security event:
- Agent was confirmed exploited or compromised
- Agent committed a PHI breach attributable to a contract deficiency (not a one-time error)
- Agent's trust foundation is irrecoverably compromised by audit findings
- Regulatory authority requires deactivation

### 2.5 Emergency Retirement

Immediate deactivation — used only when the agent poses a continuing active risk that cannot wait for orderly retirement. See Section 7.

---

## 3. The Standard Retirement Process

### Stage 1: Retirement Announcement

- **Who decides:** Office Manager (with Executive concurrence for Critical/Catastrophic agents)
- **What is filed:** Retirement Proposal including trigger, timeline, replacement plan, knowledge transfer requirements
- **Notification to:** All agents that depend on or interact with the retiring agent
- **Timeline:** Minimum 2 weeks notice before Shadow stage for non-critical agents; 4 weeks for clinical/financial agents

```yaml
retirement_proposal:
  proposal_id: string
  agent_id: string
  proposed_by: string
  proposed_at: datetime
  retirement_trigger:
    enum: [voluntary_deprecation, capability_drift, replacement, security_failure]
  trigger_description: string
  replacement_agent_id: string        # if trigger = replacement
  replacement_readiness_status: string
  knowledge_transfer_requirements: list<string>
  dependent_agents: list<string>       # agents that need notification
  proposed_timeline:
    announcement_date: date
    shadow_start_date: date
    shadow_end_date: date
    deactivation_date: date
    archive_date: date
  risks_of_retirement: list<string>
  risks_of_not_retiring: list<string>
  approved_by: list<string>
```

### Stage 2: Deprecated Lifecycle Stage

- Agent's lifecycle stage is changed to `deprecated`
- Agent continues to operate normally
- Replacement agent (if applicable) begins or continues Shadow mode
- All new task assignments to the retiring agent are reviewed — long-running tasks should be planned for handoff
- Agent contract is frozen: no new scope expansions or capability additions

### Stage 3: Shadow Overlap (if replacement exists)

- Replacement agent runs in shadow mode alongside the retiring agent
- Both process identical inputs; outputs are compared
- Comparison is tracked by the Quality Assurance Office
- Minimum shadow overlap: 2 weeks (standard); 4 weeks (clinical, financial, security)
- Exit criteria: replacement agent must achieve parity on all scorecard metrics

### Stage 4: Handoff

- All in-flight tasks are transferred to the replacement agent (or distributed among existing agents if no single replacement)
- Full knowledge transfer conducted: institutional memory, decision log entries, lessons learned, process preferences
- Handoff is treated as the most comprehensive handoff in the model — it is the agent's complete operational history
- Handoff confirmation required from all receiving agents

### Stage 5: Deactivation

- All permissions revoked
- All NATS subscriptions closed
- All credentials invalidated
- Agent process stopped
- Agent status set to `retired` in the registry
- Deactivation record filed with timestamp and authorized signatures

### Stage 6: Archive

- All agent records preserved: contract versions, execution reports, validation reports, audit records, learning reports, scorecard history, decision logs, evidence packages
- Archive location: institutional archive with standard retention periods
- Archive is immutable and queryable
- A retirement summary is filed by the Knowledge & Memory Office

---

## 4. Data and Knowledge Preservation Requirements

### 4.1 What Must Be Preserved

Every retiring agent must have the following preserved before deactivation:

| Item | Preservation Format | Retention |
|---|---|---|
| All contract versions | Versioned YAML in institutional archive | Permanent |
| Complete execution history | Indexed log store | 7 years |
| All validation reports | Indexed, with links to task evidence | 7 years |
| All audit reports | Indexed, with links to evidence | 7 years |
| Decision log (all entries) | Immutable decision log archive | Permanent |
| Scorecard history | Time-series metrics archive | 7 years |
| Learning reports authored | Learning Office archive | Permanent |
| Learning reports received | Agent's acknowledgment records | 7 years |
| Handoff records | Handoff archive | 7 years |
| PHI access log | HIPAA-compliant archive | 7 years (minimum) |
| Institutional memory entries | Knowledge & Memory Office archive | Permanent |

### 4.2 Knowledge Transfer to Replacement Agent

Before deactivation, the retiring agent must participate in a structured knowledge transfer session with the replacement agent:

```yaml
knowledge_transfer_record:
  session_id: string
  retiring_agent: string
  receiving_agent: string
  conducted_at: datetime
  facilitated_by: string         # trainer agent or office manager
  knowledge_items_transferred:
    - item_type: enum [process_insight, edge_case, institutional_relationship, domain_knowledge, failure_pattern, preference]
      description: string
      criticality: enum [low, medium, high]
      confirmed_received: bool
  institutional_relationships:
    - agent_id: string
      relationship_type: string
      context: string
      current_status: string
  open_issues_transferred: list<string>
  pending_decisions_transferred: list<string>
  known_risks_transferred: list<string>
  transfer_completeness_assessment: string
  receiving_agent_assessment:
    confident_to_proceed: bool
    knowledge_gaps: list<string>
    training_requested: list<string>
```

---

## 5. Retirement Audit

Every standard retirement (non-emergency) requires a retirement audit by the Compliance & Audit Office:

- Verification that all required knowledge was transferred
- Verification that all in-flight tasks were properly handed off
- Verification that all permissions were revoked
- Verification that all credentials were invalidated
- Verification that the evidence archive is complete
- Confirmation that the retirement was authorized at the appropriate level
- Assessment of whether the retirement creates any compliance gaps

The retirement audit report is filed in the Compliance Finding Registry as a positive record (not a finding — a confirmation of orderly closure).

---

## 6. Emergency Retirement

Emergency retirement is immediate deactivation used only when an agent poses a continuing active risk.

### 6.1 Emergency Retirement Triggers

- Active security breach through the agent
- Agent confirmed to be producing or distributing malicious outputs
- Active patient safety incident caused by agent action
- Regulatory authority order to immediately deactivate

### 6.2 Emergency Retirement Process

**Time 0:** Executive Agent (or Security Manager for security events) issues emergency retirement order

**Within 5 minutes:**
- All agent permissions revoked at infrastructure level
- NATS credentials invalidated
- Agent process terminated
- Forensic snapshot taken before any evidence is disturbed

**Within 15 minutes:**
- All in-flight tasks assessed for impact
- Clinical tasks: immediate escalation to clinical staff
- Other tasks: coordinator assumes accountability pending redistribution

**Within 30 minutes:**
- Governance Council notified (if clinical or security event)
- Human notification if patient safety involved
- Security incident opened (if applicable)
- Evidence preservation confirmed

**Within 2 hours:**
- Emergency PAR initiated
- Investigation opened
- All dependent agents notified

**Within 24 hours:**
- Full forensic evidence package assembled
- Impact assessment filed
- Regulatory notifications initiated if required (HIPAA breach, etc.)

### 6.3 Post-Emergency Review

Every emergency retirement triggers a mandatory PAR within 72 hours. The PAR asks:
- Was emergency retirement justified, or could an alternative have been used?
- What was the root cause?
- Are other agents at risk from the same cause?
- What changes prevent recurrence?
- What were the actual clinical/operational impacts?

---

## 7. Post-Retirement Monitoring Period

For all non-emergency retirements, a 30-day post-retirement monitoring period applies:

- The replacement agent (if applicable) is monitored at elevated intensity
- The Knowledge & Memory Office monitors for knowledge gaps that surface post-handoff
- The QA Office compares replacement agent performance to retired agent baseline
- Any gaps identified during monitoring are treated as learning events
- At the end of 30 days, the retirement is formally closed with a post-retirement assessment

---

## 8. Retirement Registry

The Agent Factory Office maintains the Retirement Registry: a permanent, immutable record of every retired agent.

```yaml
retirement_registry_entry:
  registry_id: string
  agent_id: string
  agent_name: string
  office: string
  role_type: string
  lifecycle_start: date               # when agent entered Draft stage
  lifecycle_end: date                 # deactivation date
  total_active_days: int
  retirement_type: enum [standard, emergency]
  retirement_trigger: string
  replacement_agent_id: string
  final_scorecard_snapshot: object    # all metrics at retirement
  knowledge_transfer_record_id: string
  retirement_audit_id: string
  archive_location: string
  compliance_clearance: bool
  notable_contributions: list<string>  # institutional memory
  notable_failures: list<string>       # institutional lessons
  archived_by: string
  archived_at: datetime
```

The registry is queryable by any agent with appropriate authorization and is used by the Agent Factory to inform new agent design (learning from retired agents' histories).
