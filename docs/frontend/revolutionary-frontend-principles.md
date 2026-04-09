# Velya Frontend: Revolutionary Principles for Hospital Operations

**Date**: 2026-04-08
**Status**: Design specification — not yet implemented
**Audience**: Frontend engineers, product designers, clinical stakeholders

---

## Part 1: The Problem with Hospital Software Today

### The Broken State of Clinical Software

Hospital software in 2026 remains fundamentally unchanged from systems designed in the 1990s. Clinical staff operate under conditions that no other knowledge worker would tolerate:

**The click tax**: Nurses spend 30–40% of their shift on documentation. A single medication administration requires 15–23 clicks in most EHRs. A discharge takes 45–90 minutes of form completion. Every click is time stolen from patients.

**The attention tax**: Clinical dashboards present everything as equal priority. A deteriorating patient in Bed 12 competes visually with a pending lab result from 3 hours ago and an administrative reminder about parking validation. The interface demands the clinician impose their own prioritization on top of an unprioritized data dump.

**The context switching tax**: A ward coordinator manages 40 beds across 3 screens using 6 applications. The information needed to make a single admission decision is spread across: the EHR (patient status), a bed management system (physical availability), a staffing system (nurse capacity), a waiting list (next patient), and a handover document (ongoing issues). There is no integrated view.

**The passive dashboard problem**: Most hospital software shows you what has happened. It tells you a patient has been waiting 4 hours for a bed. It does not tell you what to do. It does not prioritize the action. It does not route the task to the right person. It does not follow up. It observes; it does not orchestrate.

**The degraded mode problem**: When systems are slow or unavailable, clinical staff revert to paper, WhatsApp, and verbal handoffs. No hospital system is designed to operate gracefully in degraded mode. The fallback is uncontrolled and unsafe.

---

## Part 2: Velya Frontend Manifesto

### 12 Principles of Revolutionary Hospital Operations Software

**Principle 1: Zero Cognitive Tax**
The interface should do the thinking, not the clinician. Priority is determined by the system. The clinician responds to ranked, contextualized decisions — not raw data.

**Principle 2: Action First, Data Second**
Every screen should answer: "What should I do next?" before "What is happening?" Data is shown in service of action, not for its own sake.

**Principle 3: 3-Click Budget for Core Actions**
Any action a clinical user must perform multiple times per shift — admitting a patient, assigning a bed, acknowledging an alert, completing a task — must be completable in 3 clicks or fewer from any context.

**Principle 4: Role-Aware Workspaces**
A Discharge Planner and a Charge Nurse are doing fundamentally different jobs. They should never see the same interface. Each role has a purpose-built workspace that shows exactly what they need and nothing they don't.

**Principle 5: Exceptions Only**
The system handles routine. The human handles exceptions. If every patient's discharge is on track, the coordinator should see nothing on their screen. Work appears when human judgment is required.

**Principle 6: Invisible AI**
AI assistance should feel like the system knowing what you need. AI recommendations are embedded in workflow — not presented as separate AI panels with probability scores that require clinical translation.

**Principle 7: Explainability On Demand**
When AI influences a recommendation, the user can access a one-click explanation: "Why did you suggest this?" The explanation is in plain language, not model output.

**Principle 8: Handoff as a First-Class Feature**
Every shift handoff is a potential patient safety risk. The system makes handoff structured, complete, and auditable. Nothing falls between shifts.

**Principle 9: Designed for Degraded Mode**
The system must be usable when connectivity is poor or backend services are unavailable. Core read operations work offline. Write operations queue for sync. Users know exactly what state the system is in.

**Principle 10: No Hunting**
A clinician should never search for a patient they are responsible for. The patient comes to them via their workspace. The system knows the clinician's patient list and proactively surfaces relevant information.

**Principle 11: Touch-First, Keyboard Second**
Clinical environments include standing workstations, tablets, and shared terminals. The interface must be fully operable via touch on a tablet or touchscreen. Keyboard shortcuts enhance but do not gate functionality.

**Principle 12: Trust is Earned in Milliseconds**
Clinical users have zero tolerance for latency. Every interaction must respond in under 200ms. Data that takes longer to load must show immediately with a loading state and then update — never block. A system that is slow is a system that is ignored.

---

## Part 3: Required Modules

### Module 1: Patient Operational Cockpit

**Purpose**: The primary view for clinical staff responsible for active patients.

**What it shows**:

- All patients ordered by clinical priority (AI-determined, human-adjustable)
- Each patient card: name, location, status, next required action, time to next milestone
- Visual flags: deterioration risk, discharge eligibility, pending decision
- Predicted length of stay remaining

**What it does not show**:

- Full chart
- Completed tasks
- Historical notes (unless requested)
- Any patient not under the user's responsibility

**Interaction model**:

- Tap a patient → Patient detail with action panel
- Action panel shows: top 3 recommended actions, with one-click execute
- Swipe to dismiss (mark reviewed)
- Filter by: floor, ward, risk level, discharge horizon

### Module 2: Unified Action Inbox

**Purpose**: Every task, alert, and required action for the current user, prioritized by the system.

**What it shows**:

- Ordered task list: critical (red) → urgent (amber) → routine (grey)
- Each task: description, patient, due time, estimated effort, owner (if assigned)
- AI-suggested routing: "This task can be delegated to [name]"
- Batch actions: acknowledge all routine, assign group to ward nurse

**Not a notifications list**: Every item in the inbox requires an action. Informational notifications go elsewhere.

**Interaction model**:

- Tap task → task detail with complete/delegate/defer options
- Swipe right → complete
- Swipe left → defer with time picker
- Long press → delegate

### Module 3: Discharge Control Tower

**Purpose**: Purpose-built workspace for Discharge Planners and Ward Coordinators managing discharge pipeline.

**What it shows**:

- All patients with discharge potential today/tomorrow/this week
- Discharge readiness score per patient (clinical + logistical)
- Blockers per patient: outstanding test, transport not booked, family not contacted, TTO not dispensed
- Bed release timeline
- Bottleneck identification: "3 patients blocked on pharmacy"

**Actions available**:

- One-click: escalate to pharmacy, request transport, notify family
- Bulk actions: discharge all Green patients, notify ward of discharge wave
- Drag-and-drop: reorder discharge priority

### Module 4: Bed and Capacity Flow Board

**Purpose**: Real-time view of physical capacity for Bed Managers and Admissions.

**What it shows**:

- Ward/floor grid with bed status: occupied, dirty, available, blocked
- Incoming demand: ED patients waiting, elective admissions, transfers
- Predicted availability in 2h, 4h, 8h
- Mismatch alerts: "3 patients waiting for female orthopaedic bed — none predicted available today"

**Actions available**:

- Assign patient to bed (drag or select)
- Mark bed dirty/clean
- Request housekeeping
- Block bed for isolation
- Trigger escalation to Site Manager

### Module 5: Exception-Driven Workboard

**Purpose**: Supervisor view — a board that is empty when everything is on track.

**What it shows**:

- Only items that require human judgment or escalation
- SLA breaches: patient in ED > 4 hours without bed
- AI confidence below threshold: "Discharge recommendation for [patient] — please review"
- System alerts: NATS delay, service degraded
- Escalations from other staff

**Design principle**: If the board is empty, the supervisor should feel good about it. The absence of items is success, not a broken system.

### Module 6: Explainability Side Panel

**Purpose**: On-demand explanation for any AI recommendation.

**Trigger**: Any AI-influenced element (recommendation, score, priority) has an info icon. One tap opens the panel.

**What it shows**:

- Why this recommendation was made (plain language)
- What data influenced it
- How confident the model is
- What alternative was considered and why it was ranked lower
- Who is accountable for this recommendation (agent ID + human reviewer if applicable)

**What it does not show**:

- Model weights
- Raw probability distributions
- Technical implementation details

### Module 7: Handoff Timeline

**Purpose**: Structured end-of-shift handoff for every clinical user.

**What it shows**:

- Automatic pre-population: all patients, all open tasks, all pending decisions
- Outstanding items flagged by category: clinical, administrative, family communication
- Space for free-text notes per patient (voice-to-text supported)
- Incoming handoff from departing shift

**Design principle**: A handoff is never blank. The system has always pre-filled what it knows. The clinician supplements, does not create.

**Audit trail**: Every handoff is timestamped, signed, and stored in the audit log.

### Module 8: Downtime / Degraded Mode UI

**Purpose**: Maintain essential operations when backend systems are unavailable.

**Degraded mode triggers**:

- API response time > 3 seconds
- Service health check failure
- Explicit user activation ("I can't reach the server")

**What works in degraded mode**:

- Read access to last-synced patient data (cached locally)
- Task completion queue (stored locally, sync on reconnection)
- Handoff notes creation (local storage)
- Manual bed status updates (queued)

**What does not work in degraded mode**:

- Real-time alerts
- AI recommendations
- Drug interaction checking
- Cross-ward patient queries

**User experience**:

- Clear banner: "Offline mode — data last updated [time]"
- All write operations confirmed with: "Saved locally — will sync when reconnected"
- Reconnection is automatic and silent (no full page reload)

### Module 9: Agent Oversight Console

**Purpose**: For platform administrators and clinical safety leads — visibility into AI agent activity.

**What it shows**:

- All active agents, status, last action
- Decision log: every recommendation made in last 24h, with patient, agent, decision, outcome
- Anomaly detection: agents behaving outside expected parameters
- Override log: every AI recommendation that was overridden by a human
- Agent scorecard: accuracy, latency, escalation rate per agent

**Actions available**:

- Pause specific agent
- Override agent recommendation
- Escalate anomaly for review
- Export decision log for audit

---

## Part 4: Click Budget Standards

| Action                         | Max Clicks                                       | Current State   |
| ------------------------------ | ------------------------------------------------ | --------------- |
| View my patient list           | 0 clicks (default landing view)                  | NOT IMPLEMENTED |
| Acknowledge a task             | 1 click (swipe or tap Complete)                  | NOT IMPLEMENTED |
| View patient detail            | 1 click                                          | NOT IMPLEMENTED |
| Complete a routine task        | 2 clicks (open → complete)                       | NOT IMPLEMENTED |
| Assign a bed                   | 3 clicks (select patient → select bed → confirm) | NOT IMPLEMENTED |
| Escalate an alert              | 2 clicks (open → escalate)                       | NOT IMPLEMENTED |
| View discharge readiness       | 1 click (tap patient in Discharge Tower)         | NOT IMPLEMENTED |
| Start handoff                  | 1 click (from any view)                          | NOT IMPLEMENTED |
| Open explainability panel      | 1 click (tap info icon)                          | NOT IMPLEMENTED |
| Switch workspace (role change) | 2 clicks                                         | NOT IMPLEMENTED |

---

## Part 5: Cognitive Load Principles

### Visual Hierarchy

1. Colour carries priority: Red = immediate action required; Amber = action required soon; Green = on track; Grey = informational
2. Size carries importance: Larger elements are more important. Not larger because they have more text.
3. Position carries time: Upcoming events on the left, current on the right, past below.

### Information Density

- Each card shows maximum 5 data points
- Secondary information is hidden by default, revealed on expand
- No scrollable tables — if a table needs more than 8 rows, the design is wrong

### Progressive Disclosure

- Level 1 (default): Priority, patient name, key status, primary action
- Level 2 (tap): Full context, all open tasks, timeline
- Level 3 (explicit): Full chart access, raw data, history

---

## Part 6: Role-Based Workspaces

| Role                        | Primary Module          | Secondary Modules                               | Hidden From                  |
| --------------------------- | ----------------------- | ----------------------------------------------- | ---------------------------- |
| Consultant / Attending      | Patient Cockpit         | Handoff Timeline, Explainability Panel          | Bed Board, Capacity Planning |
| Ward Nurse                  | Action Inbox            | Patient Cockpit, Handoff Timeline               | Discharge Tower, Bed Board   |
| Charge Nurse / Shift Leader | Exception Workboard     | Patient Cockpit, Action Inbox, Handoff Timeline | Bed Board                    |
| Ward Coordinator            | Discharge Control Tower | Patient Cockpit, Bed Board                      | Detailed clinical notes      |
| Bed Manager                 | Bed & Capacity Board    | Discharge Tower, Exception Workboard            | Clinical notes               |
| Admissions                  | Bed Board               | Action Inbox                                    | Clinical notes               |
| Discharge Planner           | Discharge Control Tower | Patient Cockpit                                 | Bed Board                    |
| Platform Admin              | Agent Oversight Console | Exception Workboard                             | All clinical modules         |

---

## Part 7: Traditional EHR vs. Velya Comparison

| Dimension               | Traditional EHR                     | Velya                                           |
| ----------------------- | ----------------------------------- | ----------------------------------------------- |
| Default view            | Full patient list, alphabetical     | Priority-ordered action list                    |
| Information density     | Maximum — show everything           | Minimum — show what matters now                 |
| Task management         | Separate module, not integrated     | Unified inbox, integrated with clinical context |
| AI role                 | None or separate add-on             | Invisible co-pilot, embedded in workflow        |
| Discharge planning      | Forms-based, linear                 | Visual pipeline, parallel workflows             |
| Handoff                 | Free text or structured form        | Auto-populated, structured, auditable           |
| Degraded mode           | System unavailable = clinical chaos | Graceful degradation, queued operations         |
| Click count (admission) | 25–50 clicks                        | Target: 8 clicks                                |
| Time to bed assignment  | 15–45 minutes                       | Target: under 5 minutes                         |
| Role differentiation    | Same system, different permissions  | Different workspace per role                    |
| Explainability          | Not applicable                      | One-tap explanation for any AI input            |

---

_This document defines what the Velya frontend should be. Current state validation is in `docs/validation/frontend-revolution-validation.md`. Implementation roadmap is in `docs/frontend/frontend-workflow-model.md`._
