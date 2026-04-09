# Frontend Workflow Model — Velya Platform

**Date**: 2026-04-08
**Status**: Design specification — not yet implemented
**Companion**: `docs/frontend/revolutionary-frontend-principles.md`

---

## 1. Primary Flows

### Flow 1: Patient Admission

**Trigger**: Patient arrives from ED, elective list, or transfer

**Actors**: Admissions clerk, Bed Manager, Receiving Ward Nurse

**Flow Steps**:

```
1. Admission request created (from ED, from elective list, or manual)
   ↓
2. Bed Manager sees incoming patient in Bed Board [auto-surfaced, 0 clicks]
   ↓
3. System suggests best available bed (ward, gender match, infection control, proximity to nursing station)
   ↓
4. Bed Manager reviews suggestion + confirms or selects alternative [2 clicks: view → confirm]
   ↓
5. Ward Nurse receives notification in Action Inbox [auto, 0 clicks]
   ↓
6. Ward Nurse acknowledges bed assignment [1 click]
   ↓
7. Admissions clerk receives bed confirmed notification [auto]
   ↓
8. Patient moved, ward nurse updates patient status [2 clicks: patient → arrived]
```

**Total clicks (Bed Manager)**: 2
**Total clicks (Ward Nurse)**: 3
**Total elapsed time target**: < 5 minutes
**Handoff points**: 2 (Bed Manager → Ward Nurse, Ward Nurse → System)

**Failure modes**:

- No beds available → Escalation to Discharge Tower to identify discharge candidates
- Infection control mismatch → Alternative beds shown with reasons
- Ward at capacity → Escalation to Site Manager via Exception Workboard

---

### Flow 2: Discharge Process

**Trigger**: Clinical team determines patient is medically ready for discharge

**Actors**: Attending/Consultant, Discharge Planner, Ward Nurse, Pharmacy, Patient/Family

**Flow Steps**:

```
1. Attending marks patient as "Clinically Ready for Discharge" [2 clicks: patient → mark ready]
   ↓
2. Discharge Planner sees patient in Discharge Control Tower with readiness score [auto]
   ↓
3. System identifies blockers: outstanding prescriptions, transport, family notification, social care
   ↓
4. Discharge Planner triggers blockers in parallel:
   - TTO to pharmacy [1 click]
   - Transport booking [1 click]
   - Family notification [1 click]
   ↓
5. Each blocker team receives task in their Action Inbox [auto]
   ↓
6. As blockers resolve, discharge readiness score updates in real-time
   ↓
7. When all blockers cleared, Discharge Planner confirms discharge [2 clicks: patient → confirm discharge]
   ↓
8. Ward Nurse receives discharge confirmation task [auto]
   ↓
9. Ward Nurse completes discharge checks [2 clicks: checklist → complete]
   ↓
10. Bed marked dirty, housekeeping notified [auto]
    ↓
11. Bed available in Bed Board [auto, <15 minutes after discharge]
```

**Total clicks (Discharge Planner)**: 5 (for typical case)
**Total clicks (Ward Nurse)**: 4
**Total elapsed time target (after clinical ready)**: < 2 hours
**Blocker types**: Pharmacy (TTO), Transport, Family/Social, Paperwork, Outstanding results

**Discharge Control Tower shows**:

- Which patients are ready but blocked
- Which specific blocker is preventing discharge
- Time-to-clear prediction per blocker
- Batch escalation when >3 patients blocked on same service

---

### Flow 3: Task Routing

**Trigger**: System generates task (from alert, from clinical event, from AI recommendation, from manual creation)

**Actors**: System (task-inbox service), Ward Nurse, Charge Nurse, Specialist

**Flow Steps**:

```
1. Task created (source: alert, AI, clinical event, or manual)
   ↓
2. task-inbox service determines routing:
   - Role match (does task require nurse vs. doctor vs. specialist?)
   - Workload balance (who has fewest open tasks in current shift?)
   - Skill match (specific competency required?)
   - Location proximity (patient location vs. current position of staff)
   ↓
3. Task assigned to specific staff member
   ↓
4. Task appears in staff member's Action Inbox with priority level [auto, 0 clicks]
   ↓
5. Staff acknowledges task [1 click]
   ↓
6. Staff completes task (variable steps depending on task type)
   ↓
7. Task marked complete [1–2 clicks]
   ↓
8. Completion logged in audit-service [auto]
   ↓
9. If task has downstream dependencies, next task triggered [auto]
```

**Task escalation path**:

- Task overdue by 15 min → Escalate to Charge Nurse
- Task overdue by 30 min → Escalate to Exception Workboard
- Task overdue by 60 min → Page-level escalation

**Reassignment**: Staff can reassign a task in 2 clicks (open task → reassign → select person → confirm)

---

### Flow 4: Alert Handling

**Trigger**: Clinical alert fires (vital signs threshold, medication due, deterioration score)

**Actors**: Ward Nurse, Charge Nurse, Attending

**Flow Steps**:

```
1. Alert triggered by clinical system or monitoring
   ↓
2. Alert routed to appropriate clinician via task-inbox [auto]
   ↓
3. Alert appears at top of Action Inbox with red priority indicator [auto]
   ↓
4. Clinician opens alert [1 click]
   ↓
5. Alert shows: patient, what triggered it, context, recommended action, AI confidence
   ↓
6a. If clinician agrees with recommendation: Execute action [1 click]
6b. If clinician disagrees: Override with reason (mandatory for clinical audit) [3 clicks]
6c. If clinician needs more context: Open patient detail [1 click] → return to alert [back]
   ↓
7. Alert acknowledged with outcome recorded [auto on action]
   ↓
8. Audit log entry created [auto]
   ↓
9. If action was taken: downstream tasks created as needed [auto]
```

**Alert priority levels**:

- Critical (red): Respond within 5 minutes
- Urgent (amber): Respond within 15 minutes
- Routine (grey): Respond within 60 minutes
- Informational (white): No response required, informational only

**SLA tracking**: Time from alert creation to acknowledgement is tracked and visible in Exception Workboard for overdue alerts.

---

## 2. Click Budget Per Flow

| Flow              | Action                              | User              | Target Clicks |
| ----------------- | ----------------------------------- | ----------------- | ------------- |
| Patient Admission | Confirm bed assignment              | Bed Manager       | 2             |
| Patient Admission | Acknowledge assignment              | Ward Nurse        | 1             |
| Patient Admission | Update arrival status               | Ward Nurse        | 2             |
| Discharge         | Mark clinically ready               | Attending         | 2             |
| Discharge         | Trigger all blockers                | Discharge Planner | 3             |
| Discharge         | Confirm discharge                   | Discharge Planner | 2             |
| Discharge         | Complete discharge checks           | Ward Nurse        | 2             |
| Task              | Acknowledge task                    | Any               | 1             |
| Task              | Complete task                       | Any               | 1–3           |
| Task              | Reassign task                       | Any               | 3             |
| Alert             | Acknowledge + act on alert          | Any               | 2             |
| Alert             | Override alert with reason          | Any               | 3             |
| Handoff           | Open handoff for my shift           | Any               | 1             |
| Handoff           | Complete handoff                    | Any               | 3             |
| Explainability    | Open explanation for recommendation | Any               | 1             |
| Role switch       | Change workspace                    | Any               | 2             |

---

## 3. Context Switching Analysis

### Current State (without Velya)

A Charge Nurse managing a 24-bed ward switches context an estimated 48 times per 8-hour shift between applications: EHR, bed management system, task list (paper or whiteboard), handover notes, staff allocation sheet, email, pager.

Each context switch has:

- Navigation overhead: 30–90 seconds
- Memory load: "Where was I? What was I looking at?"
- Error risk: Incomplete actions left in previous context

**Total estimated context-switching overhead**: 40–80 minutes per shift.

### Velya Design Target

All clinical operations accessible from a single interface. Context switch = tab change within the same application.

| Scenario                                    | Old (multiple apps)    | Velya Target              | Reduction |
| ------------------------------------------- | ---------------------- | ------------------------- | --------- |
| Check patient status + assign task          | 5 min, 3 apps          | 45 sec, 1 view            | 85%       |
| Check bed availability + admit patient      | 10 min, 2 apps         | 2 min, 1 view             | 80%       |
| Complete discharge tasks across departments | 30 min, 4 apps         | 5 min, 1 view             | 83%       |
| Shift handoff                               | 20 min, paper + verbal | 8 min, structured digital | 60%       |

---

## 4. Handoff Model

### Principles

1. Handoff is never blank — system pre-populates from known state
2. Handoff is structured — free text supplements structure, does not replace it
3. Handoff is auditable — every handoff is timestamped and stored
4. Handoff is bidirectional — outgoing nurse and incoming nurse both confirm

### Handoff Structure Per Patient

```
Patient: [Name, DOB, Location]
Status: [Stable / Deteriorating / Critical / Pending Assessment]
Open Tasks: [Auto-listed from task-inbox]
Pending Decisions: [Auto-listed from AI recommendations awaiting action]
Outstanding Tests: [Auto-listed from clinical system]
Family/Social: [Free text field]
Medication Alerts: [Auto-listed]
Important Notes: [Free text field — for anything not captured above]
Priority for Incoming Shift: [High / Normal / Watch]
```

### Handoff Flow

```
1. 30 minutes before shift end: Handoff notification in Action Inbox
   ↓
2. Nurse opens handoff [1 click]
   ↓
3. System pre-populates all patients with known state
   ↓
4. Nurse reviews + adds notes where needed [free text per patient]
   ↓
5. Nurse marks handoff ready [1 click]
   ↓
6. Incoming nurse receives handoff in their Action Inbox [auto]
   ↓
7. Incoming nurse reviews + acknowledges [1 click]
   ↓
8. Both signatures recorded in audit log [auto]
   ↓
9. Outgoing nurse's patient list transfers to incoming nurse [auto]
```

---

## 5. Degraded Mode Behavior

### Degraded Mode Levels

| Level                     | Condition                         | User Impact                   | System Behavior                     |
| ------------------------- | --------------------------------- | ----------------------------- | ----------------------------------- |
| Level 0 — Normal          | All systems healthy               | None                          | Full functionality                  |
| Level 1 — Degraded        | API latency > 3s                  | Slower updates                | Stale data shown with timestamp     |
| Level 2 — Partial Offline | One or more backend services down | Specific features unavailable | Feature disabled with clear message |
| Level 3 — Offline         | No API connectivity               | Limited functionality         | Local cache + queue mode            |
| Level 4 — Full Downtime   | Planned maintenance               | Downtime UI shown             | Fallback procedures displayed       |

### Level 3 — Offline Mode Detail

**Available in offline mode**:

- Last-synced patient list (read only)
- Task list (read from local cache)
- Task completion (queued for sync)
- Handoff notes (local storage)
- Patient status notes (queued)
- Contact directory (cached)

**NOT available in offline mode**:

- New admissions (no real-time bed board data)
- Live vital signs or monitoring data
- AI recommendations (requires live model)
- Drug interaction checking
- Cross-ward queries

**User experience in offline mode**:

- Orange banner: "Offline — showing data as of [timestamp]. Write actions will sync automatically."
- Offline-capable actions show normally
- Online-only actions are visually disabled with tooltip: "Requires connection"
- Automatic reconnection check every 30 seconds
- On reconnect: silent sync, banner changes to "Back online — data synced"

### Downtime Runbook Integration

When Level 4 (full downtime) is triggered, the UI displays:

- Estimated time to recovery
- Link to offline procedure document
- Emergency contact numbers
- QR code to paper backup forms (pre-printed, stored in ward)

---

## 6. Technical Architecture Requirements for Workflows

| Requirement                       | Why                         | Implementation                                                    |
| --------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Optimistic UI updates             | 200ms response requirement  | Update UI immediately, sync in background, rollback on error      |
| WebSocket or SSE                  | Real-time task routing      | WebSocket preferred, SSE fallback                                 |
| Service worker + IndexedDB        | Offline mode                | PWA architecture                                                  |
| Conflict resolution               | Offline write sync          | Last-write-wins with server authority                             |
| Server-sent events for alerts     | Push alerts without polling | SSE from task-inbox service                                       |
| Audit log for every user action   | HIPAA, clinical governance  | Every state-changing action logged with user + timestamp          |
| Session timeout with soft warning | Security                    | Warning at 14 min, logout at 15 min, with unsaved data protection |
| Multi-tab coordination            | Shared workstations         | BroadcastChannel API for shared state                             |

---

_Workflow model maintained by: Frontend Team + Clinical Product Owner. Validation of current state vs. this model is in `docs/validation/frontend-revolution-validation.md`._
