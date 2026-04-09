# Automatic Enterprise Operating Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Executive Office — Chief Agent Officer  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. What "Autonomous" Means for Velya

**Autonomous operation** means the Velya agent enterprise handles all routine hospital operational work — planning, execution, validation, monitoring, correction, and learning — without requiring human intervention in the normal course of business.

"Autonomous" does not mean:
- Ungoverned (governance is more rigorous, not less)
- Infallible (failures happen; autonomy means the enterprise recovers from them without human rescue)
- Isolated from humans (humans govern the framework and intervene in genuine exceptions)
- Complete (autonomy is a spectrum; Velya is explicitly not yet fully autonomous — see Section 10)

Autonomy is measured operationally, not philosophically: **how many routine human interventions occurred in the last 30 days?** A truly autonomous enterprise has zero routine interventions. A developing autonomous enterprise has a measurable, declining intervention rate.

---

## 2. The Continuous Operating Loops

The autonomous enterprise runs the following loops continuously. These are not scheduled tasks — they are perpetual:

### 2.1 Heartbeat Loop (Every 5 Minutes)

**Operated by:** Agent Runtime Supervision Office  
**Purpose:** Confirm all active agents are alive and reporting

```
For each active agent:
  → Is a status report expected within the cycle? 
  → If yes, has it been received?
  → If no, has the agent's heartbeat NATS message been received?
  → If neither: watchdog alert
```

The heartbeat loop is the foundation of behavioral health monitoring. Without it, agent silence is undetected.

### 2.2 Scorecard Generation Loop (Weekly — Mondays)

**Operated by:** Knowledge & Memory Office  
**Purpose:** Generate fresh agent and office scorecards

```
For each agent:
  → Collect metrics from evidence store, validation records, audit records
  → Compute composite score
  → Compare to previous week (trend)
  → Flag threshold breaches
  → Notify relevant managers
  
For each office:
  → Aggregate agent scores
  → Compute office-level metrics
  → Generate office scorecard report
  → Notify Executive Office if any office is Yellow or below
```

### 2.3 Watchdog Scan Loop (Every 30 Minutes)

**Operated by:** All watchdog agents, coordinated by Agent Runtime Supervision  
**Purpose:** Detect behavioral anomalies in real time

```
For each monitored agent:
  → Check: silence threshold crossed?
  → Check: loop pattern detected?
  → Check: thrashing pattern detected?
  → Check: scope drift detected?
  → Check: permission usage within declared set?
  → Check: overload indicators?
  → For any positive: create alert, begin investigation phase
```

### 2.4 Backlog Prioritization Loop (Every 4 Hours)

**Operated by:** Office Coordinators, overseen by PMO Office  
**Purpose:** Ensure work is correctly prioritized and no critical work is stalled

```
For each office's task queue:
  → Are there tasks exceeding their SLA?
  → Are there blocked tasks with no active escalation?
  → Are there unassigned tasks?
  → Are there tasks whose risk class has changed since assignment?
  → Reorder queue, trigger escalations as needed
```

### 2.5 Learning Propagation Loop (Weekly — Thursdays)

**Operated by:** Learning & Capability Development Office  
**Purpose:** Ensure validated lessons reach all affected agents

```
For each validated, unpropped learning item:
  → Determine propagation targets
  → Issue propagation directives
  → Track acknowledgment deadlines
  → Flag unacknowledged lessons to relevant managers
  
For each previously propagated lesson:
  → Has acknowledgment been received from all targets?
  → Has demonstration been scheduled or completed?
  → Flag delinquent targets
```

### 2.6 Market Intelligence Intake Loop (Daily)

**Operated by:** Market Intelligence Office  
**Purpose:** Ensure external environment changes are surfaced before they become crises

```
Daily scans:
  → Regulatory update feeds (CMS, ONC, OCR, CISA)
  → Clinical best practice updates (relevant clinical domains)
  → Technology security alerts (CVE feeds, vendor advisories)
  → Competitive intelligence sources (configured)
  
Weekly digest:
  → Produce briefing for Executive Office
  → Flag urgent items (same-day notification for regulatory effective-date alerts < 30 days)
```

---

## 3. Decision Boundaries

### 3.1 What Agents Decide Alone

Within their contract scope and for actions at their risk authorization level, agents make all decisions autonomously:

- Task execution strategy and approach
- Resource allocation within declared limits
- Evidence collection methods
- Escalation timing (within defined thresholds)
- Correction plan design (within correction cycle rules)
- Handoff timing and context packaging
- Report content and format

### 3.2 What Requires Approval Within the Agent Hierarchy

| Decision | Approval Required From |
|---|---|
| Cross-office task handoff | Both office managers |
| Exception to standard process | Office Manager |
| High-risk action execution | Second validator + Office Manager awareness |
| Critical risk action | Two validators + Office Manager + Executive awareness |
| Permission expansion | Office Manager + Security Office |
| Contract amendment | Agent Factory + ARB + Office Manager |
| Agent quarantine (L2+) | Office Manager (L2) or Executive (L3+) |
| Agent retirement proposal | Office Manager + Executive |

### 3.3 What Requires Human Break-Glass

Human intervention is required for:

| Situation | Human Authority Needed |
|---|---|
| Catastrophic risk action | Governance Council |
| Patient safety threat | Clinical human authority + Executive |
| PHI breach confirmed | HIPAA Officer (human) + Executive + Governance Council |
| Executive Agent failure or conflict of interest | Governance Council |
| Regulatory authority contact | Legal/Compliance human authority |
| Novel ethical dilemma | Governance Council |
| External audit commencement | Human Compliance Officer |
| Any action where the entire agent hierarchy is implicated | Governance Council |

---

## 4. The 23 Offices Operating in Concert

### 4.1 Daily Rhythm

The enterprise operates on a continuous cadence within each day:

```
00:00 – 06:00  Night operations
  → Scheduled maintenance windows (Platform + DevOps offices)
  → Batch data jobs (Data Governance Office)
  → Security scans (Security Office)
  → Log analysis and anomaly detection (Reliability Office)

06:00          Daily kickoff
  → All Office Managers file daily status reports to Executive
  → Backlog prioritization runs
  → Learning propagation digest reviewed

06:00 – 12:00  Primary delivery window
  → Specialist agents execute primary workloads
  → Validators process queued validation requests
  → Auditors process queued audit requests

12:00          Midday review
  → Incident review (Reliability + Service Management)
  → Escalation status check (Executive)

12:00 – 18:00  Secondary delivery window
  → Continued execution
  → Cross-office handoffs processed
  → Exception reports resolved

18:00          End of business summary
  → Incident review
  → Tomorrow's maintenance window scheduling
  → Learning report submissions due

18:00 – 00:00  Evening operations
  → Lower-priority batch work
  → Watchdog scan continues (reduced intensity)
  → Emergency-only escalation path active
```

### 4.2 Weekly Rhythm

| Day | Primary Activities |
|---|---|
| Monday | Scorecard generation; Agent probation/quarantine reviews |
| Tuesday | Office scorecard aggregation; Cross-office dependency review |
| Wednesday | Enterprise health dashboard update; Architecture decisions |
| Thursday | Learning propagation digest; Backlog grooming |
| Friday | Cross-office retrospective (automated PAR digest); Pre-weekend risk assessment |
| Saturday/Sunday | Maintenance window operations (Platform, DevOps); Reduced monitoring |

### 4.3 Monthly Rhythm

| Week 1 | Enterprise health dashboard to Governance Council |
| Week 2 | Compliance & Audit monthly review; ARB session |
| Week 3 | Cost Governance monthly report; FinOps optimization |
| Week 4 | Agent lifecycle review (promotions, retirements); DR exercise (quarterly) |

---

## 5. How the Enterprise Handles Situations

### 5.1 Routine Work

**Flow:** Market Intelligence or product demand → PMO portfolio → Office Manager assignment → Coordinator decomposition → Specialist execution → Validator certification → Auditor review (if required) → Delivery → Evidence archival → Learning capture

**Human involvement:** None in the standard flow.

### 5.2 Incidents

**Flow:** Detection (Reliability Office or Watchdog) → Incident opened (Service Management) → Impact assessment → Containment (relevant office specialists) → Root cause analysis → Remediation → Validation → Post-Action Review → Learning propagation

**Human involvement:** For Medium incidents — none routinely; humans may review PAR. For High+ incidents — human notification; humans may choose to intervene or observe. For Catastrophic incidents — human break-glass invoked.

### 5.3 New Requirements

**Flow:** Market Intelligence or stakeholder input → Product Office RFC → PMO prioritization → ARB review (if architectural) → Agent Factory (if new agents needed) → Development → Shadow → Probation → Activation

**Human involvement:** Governance Council reviews strategic priorities quarterly. Individual features do not require human approval.

### 5.4 External Changes (Regulatory, Technology)

**Flow:** Market Intelligence detects change → Briefing to Executive Office → Risk assessment (Compliance if regulatory, ARB if technology) → Impact analysis → Work items generated → Standard delivery flow

**Human involvement:** For regulatory changes with legal implications — human legal/compliance review. For standard technology changes — none.

### 5.5 Technology Shifts

**Flow:** Market Intelligence identifies emerging technology → ARB evaluates → ADR drafted → Pilot RFC through Agent Factory if agents involved → Phased adoption with shadow mode → Standard lifecycle

**Human involvement:** Major technology platform changes (e.g., replacing the message bus) require Governance Council approval.

---

## 6. The Break-Glass Protocol

### 6.1 Invocation

Break-glass is invoked when a situation meets one of the human escalation triggers defined in Section 3.3. The Executive Agent automatically sends a structured briefing to the designated human:

```yaml
break_glass_briefing:
  briefing_id: string
  triggered_at: datetime
  trigger_condition: string
  situation_summary: string          # max 200 words
  current_agent_actions:
    - action: string
      agent: string
      status: string
  specific_decision_required: string  # exactly what the human must decide
  options:
    - option: string
      agent_recommendation: bool
      consequences: string
  risk_if_no_decision_by: datetime
  evidence_package_ref: string
  escalation_path_exhausted: list<string>
```

### 6.2 Human Action

The human:
1. Reviews the briefing
2. Reviews the evidence package if needed
3. Makes a binary decision (authorize or prohibit) or a selection among options
4. Communicates the decision through the designated human input channel
5. The Executive Agent receives and implements the decision

Humans do not manage agents. They make decisions that agents then implement.

### 6.3 Post-Intervention Review

Every break-glass invocation generates a mandatory PAR within 24 hours. The PAR determines whether the intervention was genuinely necessary and what change would prevent the same situation from requiring human escalation in the future.

---

## 7. Enterprise Health Dashboard

The Executive Office maintains a real-time enterprise health dashboard:

| Section | Key Indicators |
|---|---|
| **Agent Workforce** | Total active agents; agents in quarantine; agents on probation; agents in shadow |
| **Quality** | Enterprise validation pass rate; audit pass rate; evidence completeness |
| **Reliability** | Enterprise SLA compliance; open incident count by severity; MTTR by severity |
| **Learning** | Learning propagation completion rate; open learning items; lessons pending validation |
| **Security** | Open critical vulnerabilities; secret rotation compliance; permission anomalies |
| **Compliance** | Open critical audit findings; HIPAA readiness score; SOC2 readiness score |
| **Human Interventions** | Interventions in last 30 days; trend; interventions by type |
| **Office Health** | Office scorecard status (all 23) — green/yellow/orange/red |
| **Cost** | Cloud spend vs. budget; cost efficiency trend |
| **Autonomy Level** | Current autonomy self-assessment (see Section 10) |

---

## 8. Autonomous Operation Prerequisites

The following must ALL be met before Velya can claim autonomous operation:

| Prerequisite | Status (2026-04-08) |
|---|---|
| All 23 offices have active Manager Agents | Partial — 14 of 23 offices have Manager Agents active |
| All office watchdog coverage complete | Partial — 11 of 23 offices have dedicated watchdog coverage |
| Agent lifecycle model fully implemented | In progress — lifecycle tooling 60% complete |
| Scorecard system operational for all agents | In progress — manual scorecard for ~40% of agents |
| Evidence Store operational with hash verification | In progress — write-once storage implemented; hash verification in progress |
| Decision log operational for all agents | Not yet — decision log model defined; implementation pending |
| Learning propagation loop automated | Partial — manual Learning Office process; automation in progress |
| Correction loop automated (not manual tracking) | Partial — correction workflow defined; automation pending |
| Handoff confirmation protocol automated | Not yet — defined; implementation pending |
| Quarantine system operational | Partial — L1/L2 quarantine manual; tooling in progress |
| Meta-watchdog operational | Not yet — model defined; implementation pending |
| Enterprise health dashboard operational | Partial — key metrics visible; full dashboard in progress |
| Break-glass protocol tested and exercised | Not yet — protocol defined; first exercise not yet conducted |
| Human intervention rate < 5/month for 90 days | Not yet — baseline not established |

---

## 9. Autonomy Dimension Assessment (Honest Rating — 2026-04-08)

This is an honest, current assessment. Optimistic claims about autonomy are more dangerous than accurate admissions of gap.

| Autonomy Dimension | Target | Current | Gap |
|---|---|---|---|
| **Routine work execution** | Zero human intervention | ~70% autonomous — humans review many outputs | Large |
| **Incident detection** | Automated, < 5 min | ~60% automated — some reliance on human observation | Significant |
| **Incident resolution** | Agent-led, human notified | ~40% agent-led — humans heavily involved in resolution | Very large |
| **Validation chain** | Fully automated | ~50% automated — validator agents operational for some domains | Large |
| **Audit chain** | Fully automated | ~30% automated — mostly manual audits | Very large |
| **Learning capture** | Automated capture and propagation | ~20% automated — primarily manual | Very large |
| **Watchdog coverage** | Complete enterprise coverage | ~48% of offices covered | Large |
| **Scorecard generation** | Fully automated weekly | ~40% automated — mostly manual | Large |
| **Handoff management** | Automated confirmation protocol | ~20% automated — mostly manual or implicit | Very large |
| **Quarantine management** | Automated trigger + process | ~30% — L1 partially automated; L2+ manual | Large |
| **Evidence collection** | Automated, complete | ~55% — evidence collected for some domains, not all | Significant |
| **Decision logging** | Automated, comprehensive | ~15% — model defined; minimal implementation | Very large |
| **Correction loop** | Automated, tracked | ~25% — correction loop exists but tracking is manual | Large |
| **Break-glass protocol** | Tested and operational | Model defined; not yet implemented or tested | Full gap |

**Enterprise Autonomy Level (Self-Assessed):** **2.5 / 5.0 — Early Development**

At this level, Velya operates with significant human involvement in most governance functions. The agent enterprise exists as a defined model and partial implementation. The gap between the model and operational reality is the primary engineering and organizational challenge for the next 12–18 months.

**What Level 2.5 means in practice:**
- Agents exist and execute work in many domains
- Governance structures are defined and partially implemented
- Human intervention is routine, not exceptional
- The institutional framework documented in these 19 files is the target state, not the current state
- Progress toward autonomy requires systematic implementation of each governance mechanism

---

## 10. Path to Autonomy — Priority Order

The following sequence prioritizes the highest-value autonomy investments:

**Phase 1 (Next 90 days): Foundation**
1. Complete watchdog coverage for all 23 offices
2. Automate agent scorecard generation for all agents
3. Implement decision log tooling (agents can file decision logs natively)
4. Implement evidence store hash verification

**Phase 2 (90–180 days): Quality Chain**
5. Expand validator agent coverage to all High-risk domains
6. Automate handoff confirmation protocol
7. Automate correction loop tracking and escalation
8. Implement learning propagation automation

**Phase 3 (180–270 days): Governance Completion**
9. Complete audit agent coverage for all Critical domains
10. Implement automated quarantine triggering (L1/L2)
11. Deploy Meta-Watchdog
12. Conduct first break-glass protocol exercise

**Phase 4 (270–365 days): Autonomy Validation**
13. 90-day measurement period for human intervention rate
14. Enterprise autonomy audit by Compliance & Audit Office
15. Governance Council assessment of autonomy claim readiness
16. First public autonomy level declaration

Full autonomous operation is not a destination — it is an ongoing practice. The enterprise will continue to improve autonomy dimensions after the initial phases, adding new domains and refining governance mechanisms as the agent workforce matures.
