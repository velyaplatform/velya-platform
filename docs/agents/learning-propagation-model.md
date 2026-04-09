# Learning Propagation Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Learning & Capability Development Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

The Velya agent enterprise does not simply perform work — it improves as it works. Every significant event is an opportunity to learn. The Learning Propagation Model defines how lessons are captured, validated, classified, propagated, absorbed, and verified across the entire enterprise.

A lesson that is captured but not propagated is institutional waste. A lesson that is propagated but not absorbed is institutional theater. A lesson that is absorbed but not verified is an assumption. The model addresses all three failure modes.

---

## 2. Learning Event Types

### 2.1 Incident

A failure or near-miss in production that caused or could have caused harm. Incidents are the highest-priority learning events because they represent realized failure modes — the enterprise has been shown what can go wrong, not just theorized about it.

**Threshold for learning capture:** Any incident classified Medium or above.

### 2.2 Regression

A re-occurrence of a failure pattern that was previously identified and supposedly resolved. Regressions are particularly important because they indicate that learning from the first occurrence did not take hold — the lesson was captured but not durably absorbed.

**Threshold:** Any regression, regardless of severity.

### 2.3 Feedback

Structured feedback from a downstream consumer of an agent's outputs — another agent, a clinical staff member, or an office manager — indicating that outputs were suboptimal even if they passed validation. Feedback captures subtle quality gaps that formal validation may miss.

**Threshold:** Feedback patterns (3+ instances of similar feedback) or single feedback items from Critical domains (clinical, financial).

### 2.4 Benchmark

Comparison of Velya agent performance against external benchmarks, industry standards, or internal targets. Benchmark events generate learning when performance is below target or when a better approach is identified externally.

**Threshold:** Benchmark results showing >10% gap from target or identification of a significantly better approach.

### 2.5 Anomaly

Unexpected behavior detected during watchdog monitoring, chaos experiments, or shadow comparison that does not rise to the level of an incident but reveals a previously unknown behavior pattern.

**Threshold:** Anomalies classified Medium or above by the detecting watchdog.

---

## 3. Learning Capture Process

### 3.1 Who Documents

| Learning Event Type | Primary Documenter | Backup if Primary Unavailable |
|---|---|---|
| Incident | Agent that first detected the incident | Coordinator or Manager |
| Regression | Agent that identified the recurrence | Office Manager |
| Feedback | Agent that received the feedback | Coordinator |
| Benchmark | Market Intelligence Office | PMO Office |
| Anomaly | Watchdog that detected anomaly | Agent Runtime Supervision Manager |

The Learning Report schema is defined in the Reporting Standard. All Learning Reports are filed within 24 hours of the triggering event.

### 3.2 Required Format

Learning Reports must be specific and falsifiable. The following patterns are rejected by the Learning Office:

- **Too vague:** "We should communicate better" → Rejected. What specifically? In which context? Demonstrated by what evidence?
- **Not actionable:** "The system is complex" → Rejected. What specific change would reduce the problem?
- **Not generalizable:** "Agent X made a mistake" → May generate a correction report but not a learning report unless there is a broader lesson.

A valid lesson must answer:
1. What specifically happened?
2. Why did it happen? (root cause, not symptoms)
3. What would prevent it? (specific, implementable change)
4. Which agents or offices are affected?
5. How would we verify the prevention worked?

### 3.3 Storage

All Learning Reports are stored in the Knowledge & Memory Office's learning repository with:
- Full-text search indexing
- Tags: domain, agent type, office, event type, severity, status
- Linkage to: triggering event, evidence, affected agents, propagation records
- Chronological and thematic clustering (surfacing related lessons)

---

## 4. Learning Validation

Before a lesson is propagated, the Learning & Capability Development Office validates it:

### 4.1 Validation Criteria

| Criterion | Question | Failure |
|---|---|---|
| Factual accuracy | Is the lesson based on what actually happened (evidenced)? | Lesson returned for revision |
| Causal validity | Does the root cause correctly explain the event? | Lesson returned; deeper analysis requested |
| Generalizability | Is this a specific edge case or a broadly applicable pattern? | May be filed locally rather than propagated |
| Actionability | Does the lesson lead to a specific, implementable change? | Lesson returned as observation, not lesson |
| Non-contradiction | Does this lesson contradict existing institutional knowledge? | Escalated to Learning Arbitration (see 4.2) |
| Clinical safety | For clinical lessons: does this lesson improve or at minimum not degrade patient safety? | Blocked pending clinical review |

Validation is completed within 48 hours of Learning Report receipt.

### 4.2 Learning Arbitration

When a validated lesson contradicts an existing propagated lesson:

1. Learning Office identifies the contradiction with both lesson IDs
2. Learning Manager convenes a Learning Arbitration session with relevant office managers
3. Session reviews: evidence for both lessons, contexts in which each was true, whether both can be true in different contexts
4. Outcome options:
   - **Supersede:** New lesson is correct; old lesson is deprecated and agents notified
   - **Contextualize:** Both lessons are true in different contexts; both are retained with context qualifiers
   - **Synthesize:** Both lessons point to a deeper insight; a new synthesis lesson is created
   - **Defer:** Insufficient evidence to resolve; both lessons marked `contested` pending further evidence

Contested lessons are not propagated until resolved.

---

## 5. Learning Propagation

### 5.1 Propagation Targets

The Learning Office determines which agents and offices need to receive a lesson based on:
- Which agent types are affected (all specialists of type X)
- Which offices are affected (all offices doing Y)
- Which risk domains are affected (all agents handling PHI, for example)
- Whether the lesson affects contract templates, playbooks, or validation checklists

### 5.2 Propagation Directive

```yaml
propagation_directive:
  directive_id: string
  learning_report_id: string
  lesson_title: string
  lesson_summary: string           # max 200 words — the core lesson
  change_required:
    change_type: enum [new_rule, skill_update, playbook_revision, template_change, contract_amendment, training_module, checklist_update]
    change_description: string
    change_artifact_ref: string    # where the change is documented
  propagation_targets:
    agents: list<string>           # specific agent IDs, or wildcard patterns
    offices: list<string>
    role_types: list<string>
  acknowledgment_required_by: datetime
  demonstration_required_by: datetime
  validation_method: string        # how absorption will be verified
  trainer_agent_assigned: string
```

### 5.3 Propagation Timeline

| Lesson Priority | Propagation SLA |
|---|---|
| Urgent (patient safety, active regulatory risk) | 24 hours |
| High (Critical domain findings, security) | 3 business days |
| Medium (process improvements, validated patterns) | 5 business days |
| Low (best practices, efficiency improvements) | 10 business days |

---

## 6. Learning Classification

Validated lessons are classified into one of the following change types, which determines how they are implemented:

| Change Type | Definition | Implementation Path |
|---|---|---|
| New rule | A prohibition or requirement that did not previously exist | Contract amendment for affected agents; validation checklist update |
| Skill update | An improvement to how an agent executes an existing capability | Trainer agent delivers capability update; demonstration required |
| Playbook revision | An update to a structured operational procedure | Playbook updated in Knowledge & Memory; agents notified |
| Template change | An update to a report, evidence, or document template | Template updated; agents receive new version |
| Contract amendment | A change to an agent's scope, permissions, or governance chain | Agent Factory processes amendment; ARB review if significant |
| Training module | A new training scenario for the Simulation Office | Simulation Office creates and delivers; Trainer verifies |
| Checklist update | An addition or modification to a validation or audit checklist | QA or Compliance Office updates checklist; validators notified |

---

## 7. Anti-Patterns

| Anti-Pattern | Definition | Consequence |
|---|---|---|
| Lessons ignored | Agent acknowledges a lesson but does not demonstrate incorporation | Scorecard deduction; Learning Office escalation |
| Lessons misapplied | Agent applies a lesson in the wrong context or with incorrect scope | Learning investigation; potential contract review |
| Contradictory lessons | Two lessons are propagated that contradict each other without resolution | Contested flag; Learning Arbitration required |
| Learning theater | Learning Report filed as compliance exercise with no substantive content | Learning Office rejects; escalation to manager |
| Lesson overload | Too many lessons propagated simultaneously, degrading absorption quality | Learning Office paces propagation; prioritizes urgently |
| Lessons without evidence | Lesson filed based on intuition or opinion, not documented evidence | Learning Office rejects pending evidence |
| Lesson drift | Lesson is correctly absorbed initially but agents drift back to old behavior over time | Trainer agents monitor; recurrence triggers investigation |

---

## 8. The Learning Office Role

The Learning & Capability Development Office:

1. **Operates the learning intake queue:** receives, acknowledges, and tracks all Learning Reports
2. **Validates all lessons:** applies the validation criteria; returns or escalates when needed
3. **Manages the learning backlog:** prioritizes propagation based on urgency and impact
4. **Issues propagation directives:** to all affected agents and offices
5. **Tracks acknowledgment:** follows up on unacknowledged lessons
6. **Coordinates with Trainer Agents:** for skill updates and training modules
7. **Manages the Learning Registry:** the canonical record of all lessons, their status, and their propagation
8. **Reports to the Executive:** weekly on learning backlog, propagation completion, and absorption rates
9. **Resolves learning contradictions:** through Learning Arbitration
10. **Monitors for lesson drift:** in coordination with watchdog and scorecard systems

---

## 9. Institutional Memory Architecture

### 9.1 Memory Types

| Memory Type | Scope | Owner | Access |
|---|---|---|---|
| Global Memory | Enterprise-wide — universal rules, constraints, governance | Knowledge & Memory Office | All agents (read); Learning Office (write) |
| Office Memory | Office-specific processes, patterns, institutional history | Office Manager | Office agents (read); Manager (write) |
| Process Memory | Specific workflow and procedure knowledge | Relevant coordinator agents | Process participants (read); Learning Office (write with validation) |
| Agent Memory | Individual agent's learned patterns and history | Individual agent | Agent (read/write); Manager (read) |

### 9.2 Global Memory Contents

Global memory contains:
- The institutional governance documents (this document and all sibling documents)
- Propagated rules (all active `new_rule` learning items)
- Enterprise-wide policies
- The canonical agent registry
- The canonical office registry
- The learning registry

### 9.3 Memory Lifecycle

```
CREATION
  │  New memory item created by authorized source
  │  Tagged with: domain, type, date, author, evidence refs
  │
  ▼
ACTIVE
  │  Memory item in use by agents
  │  Agents can query, cite, and reference it
  │  Review date set
  │
  ▼
REVIEW
  │  Review date reached
  │  Knowledge & Memory Office assesses currency
  │  Options: retain as-is, update, deprecate
  │
  ▼
DEPRECATED (if applicable)
  │  Item superseded by newer knowledge
  │  Marked deprecated — no longer propagated to new agents
  │  Existing references updated with deprecation notice
  │
  ▼
ARCHIVED
     Item preserved but removed from active retrieval
     7-year retention minimum; permanent for governance documents
```

---

## 10. Memory Audit Requirements

The Knowledge & Memory Office audits institutional memory quarterly:

| Audit Item | Frequency | Standard |
|---|---|---|
| Memory currency | Quarterly | >90% of items within their review cycle |
| Memory integrity | Quarterly | All items hash-verified; no undetected modifications |
| Memory completeness | Quarterly | All active processes have corresponding documentation |
| Memory contradiction detection | Quarterly | No contradictory active items without resolution notes |
| Access log review | Monthly | All memory access patterns within expected bounds |
| Deprecation hygiene | Quarterly | No items overdue for deprecation review |

The Compliance & Audit Office audits the memory audit annually for regulatory purposes.
