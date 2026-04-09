# Cognitive Safety Controls

**Velya Hospital AI Platform — Clinical UI**
**Document Type:** UI/UX Safety Design Specification
**Date:** 2026-04-08
**Classification:** Internal — Clinical Safety Document
**Status:** Active — Design Requirements

---

## Overview

Cognitive safety controls are specific, testable UI/UX design decisions that prevent identified cognitive failure modes in clinical operations. Each control in this document has a defined failure mode it prevents, a concrete implementation specification for Velya's Next.js frontend, and a validation method that can be tested against the implemented UI.

These controls are not design suggestions — they are clinical safety requirements. Any release of velya-web that does not implement these controls should not be used in live clinical operations.

---

## Control 1: Progressive Disclosure

**What It Prevents:** Decision overload. Presenting all available information simultaneously increases cognitive load and causes clinicians to miss the most important items by spreading attention across too many signals.

**How It's Implemented in Velya's Design:**

The task inbox and patient dashboard use a three-layer disclosure model:

- **Layer 1 (Always Visible):** The one most urgent action required right now. For each patient, this is the single highest-severity unacknowledged item. For the inbox, this is the count of critical items as a large, bold number. No other detail is shown until Layer 1 is acknowledged.
- **Layer 2 (Revealed on Selection):** When a clinician selects a patient or task, Layer 2 expands to show all outstanding items for that patient or task group, ordered by severity. This is a full card with vitals, pending tasks, and AI recommendations.
- **Layer 3 (Explicit Reveal):** Audit trail, historical events, AI explanation detail, and reference data are behind a labeled "Show more" or "Details" control. These do not appear automatically.

AI recommendations are Layer 2 by default. Their full explanation and supporting evidence are Layer 3. A clinician reviewing a patient quickly gets a summary; a clinician doing a thorough assessment gets the full detail without navigating away.

**Validation Method:**

- Heuristic evaluation: count the number of distinct data elements visible on a fresh patient list view for a user who has never interacted with it. Target: ≤ 5 elements visible before any interaction.
- User testing: give a nurse 6 patients with mixed severity. Measure time-to-identify the most critical patient. Target: < 10 seconds.
- Audit: no critical information should be hidden behind Layer 3. Verify by listing all clinical safety-critical fields and checking their disclosure layer.

---

## Control 2: Critical Alert Visual Hierarchy

**What It Prevents:** Clinically critical alerts being visually buried in a list of informational notifications, causing delayed or missed response.

**How It's Implemented in Velya's Design:**

Critical alerts in velya-web use all five visual channels simultaneously — never color alone:

1. **Color:** Red (`#D32F2F`) background for critical items. Yellow (`#F9A825`) for warning. No color change for informational.
2. **Typography:** Critical item titles are displayed in 18px bold. Warning items are 16px medium. Informational items are 14px regular.
3. **Icon:** Each severity has a distinct icon: ⬥ (diamond, red) for critical, ▲ (triangle, yellow) for warning, ● (circle, grey) for informational. Icons are chosen to be distinguishable for the most common forms of color vision deficiency (deuteranopia, protanopia).
4. **Layout position:** Critical items are always at the top of any list they appear in, regardless of creation time or sort order. They never appear below a non-critical item.
5. **Spatial separation:** Critical items have a visible border and margin that physically separates them from warning and informational items. The visual group boundary is not just color.

For life-threatening conditions (as defined by policy-engine), a full-screen modal interrupt is triggered — the interface cannot be used until the alert is acknowledged or escalated. Full-screen interrupt criteria include: critical lab value unacknowledged for > 5 minutes, patient deterioration score crossing a threshold, discharge workflow attempted for a patient with a physician hold.

**Validation Method:**

- Accessibility audit: verify all critical/warning/informational states are distinguishable without color by a user with full color blindness simulation enabled in the browser
- Contrast check: all text in critical alert cards meets WCAG AA contrast ratio (4.5:1 minimum)
- Eye-tracking study (or 5-user hallway test): show a task inbox with 30 informational items and 1 critical item. Measure time-to-first-fixation on the critical item. Target: < 3 seconds
- Code review: assert in component tests that critical items always render before non-critical items in the DOM and visual order

---

## Control 3: Degraded Mode Status Banner

**What It Prevents:** Clinical staff acting on data they believe is current when one or more backend services are unavailable or degraded, causing decisions based on stale or absent information.

**How It's Implemented in Velya's Design:**

velya-web maintains a service health state derived from:

1. API responses (4xx/5xx errors or timeout from any backend service)
2. A `/health` endpoint polled every 30 seconds that returns the health of each downstream service
3. A `data_freshness_seconds` field returned by each API response

The degraded mode status banner:

- **Renders at the top of the viewport**, above all navigation and content — not in a corner, not as a toast notification, not as a badge
- **Is non-dismissable** without a deliberate override action that is logged to audit-service
- **Specifies which services are affected** in plain language: "Patient Flow data is unavailable. Showing patient list from 14:23 (12 minutes ago). Discharge system is operating normally."
- **Changes visual state by degradation severity:**
  - Full unavailability: Red banner with black text. Blocks all clinical actions that depend on the unavailable service.
  - Stale data (> 5 minutes): Yellow banner with dark text. Shows timestamp of last known good data. Does not block actions but adds a confirmation step.
  - Restored: Green banner for 30 seconds, then disappears.

When a clinical action is attempted that depends on unavailable data, the action button is disabled and a tooltip explains: "This action requires Patient Flow data, which is currently unavailable. Last known data is from 14:23."

**Validation Method:**

- Integration test: stop patient-flow-service pod; verify banner appears within 60 seconds
- Integration test: verify that a discharge initiation attempt while discharge-orchestrator is unavailable is blocked with the correct explanation
- UI review: verify banner is visible at 320px, 375px, 768px, and 1440px viewports
- Accessibility: banner text meets contrast requirements and is announced by screen readers as an ARIA live region

---

## Control 4: AI Confidence Indicators

**What It Prevents:** Clinical staff treating AI recommendations as authoritative without understanding the confidence level or evidential basis, increasing the risk of accepting incorrect recommendations.

**How It's Implemented in Velya's Design:**

Every AI recommendation rendered in velya-web includes all of the following, without exception:

| Element             | Display                                                                                 | Example                                                                               |
| ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Confidence level    | Visual badge: High (green) / Medium (yellow) / Low (grey)                               | "Medium confidence"                                                                   |
| Data basis          | Bullet list of the specific data points the recommendation is based on, with timestamps | "Based on: Vitals from 13:45, Lab panel from 11:20, Discharge history from admission" |
| Rationale           | One plain-language sentence explaining the recommendation                               | "Length of stay is within expected range for this DRG and vital signs are stable."    |
| Staleness flag      | If any data basis item is > 30 minutes old, it is flagged individually                  | "⚠ Vitals: last updated 47 minutes ago"                                               |
| Recommendation type | Explicit label: AI Suggestion (not a decision, not an order)                            | "AI Suggestion — requires clinical review"                                            |
| Source identifier   | Which agent produced this recommendation                                                | "Discharge Assessment Agent v1.2"                                                     |

Recommendations with Low confidence are displayed in a reduced visual style (no color fill, dotted border) and include: "This recommendation is based on incomplete information. Independent clinical assessment is required before taking action."

Recommendations that cannot be explained (no rationale field returned by ai-gateway) are not rendered to clinical staff. They are logged to decision-log-service as "unexplainable output — suppressed" and an alert fires to governance.

**Validation Method:**

- Visual regression test: assert that every AI recommendation component in Storybook renders with confidence badge, rationale, and data basis present
- API contract test: if ai-gateway returns a recommendation without a confidence field, assert that velya-web does not render the recommendation to the user
- User testing: show clinicians recommendations with high vs. low confidence indicators. Measure override rate difference. Low confidence recommendations should have higher override rate.
- Code review: assert there is no code path that renders an AI recommendation component without all required fields populated

---

## Control 5: Stale Data Warnings

**What It Prevents:** Clinical decisions made based on data that is outdated without the clinician's knowledge.

**How It's Implemented in Velya's Design:**

Every data element in velya-web that is fetched from a backend service carries a timestamp. The frontend maintains a staleness threshold configuration:

| Data Type                | Warning Threshold | Critical Threshold |
| ------------------------ | ----------------- | ------------------ |
| Vital signs              | 15 minutes        | 30 minutes         |
| Lab results              | 30 minutes        | 60 minutes         |
| Medication list          | 60 minutes        | 4 hours            |
| Patient admission status | 5 minutes         | 15 minutes         |
| Discharge blocker status | 2 minutes         | 5 minutes          |
| Task assignments         | 5 minutes         | 15 minutes         |
| AI recommendations       | 10 minutes        | 20 minutes         |

When a data element exceeds the warning threshold, its display changes:

- Value is shown with a `⚠ [timestamp]` label next to it
- Value text color shifts to match the staleness severity (grey for warning, red for critical)
- Tooltip on the timestamp label shows: "Data last refreshed at [time]. May not reflect current patient state."

When a data element exceeds the critical threshold, it enters a "must verify" state:

- Value is shown with a strikethrough
- A "Verify data" button appears that triggers a manual refresh
- Clinical actions that depend on this element are blocked until the data is refreshed or the clinician explicitly overrides with an audit-logged attestation

**Validation Method:**

- Unit test: assert that a data element with a timestamp 16 minutes in the past renders with a staleness warning
- Integration test: stop patient-flow-service; verify that vital sign displays enter stale state within 16 minutes
- Accessibility: staleness warning is not communicated by color alone; verify icon and text label are present
- Edge case test: verify that the staleness clock uses UTC consistently — no timezone-induced false staleness warnings during daylight saving time transitions

---

## Control 6: Handoff Completeness Check

**What It Prevents:** Incomplete shift handoffs where the departing clinician confirms handoff but the incoming clinician has not reviewed critical outstanding items, creating continuity gaps.

**How It's Implemented in Velya's Design:**

The shift handoff workflow in velya-web is a structured two-party process:

**Departing Clinician Side:**

- Checklist is auto-populated by velya-web from live patient data: outstanding tasks, pending lab results, medication changes in last 4 hours, pending specialist visits, AI flags on any patient
- Each checklist item must be explicitly addressed: "Confirmed and communicated," "Not applicable," or "Cannot complete — requires incoming clinician attention"
- Items marked "Cannot complete" generate an automatic high-priority task in the incoming clinician's inbox
- Handoff cannot be confirmed while any patient has a critical status item that is unchecked
- Free-text "shift notes" field is required (minimum 20 characters) — cannot be skipped

**Incoming Clinician Side:**

- Handoff briefing screen is the first screen shown after shift start (before access to regular dashboard)
- Briefing shows the departing clinician's notes and all flagged items
- Incoming clinician must confirm review of each patient before the briefing screen can be dismissed
- If incoming clinician has not reviewed all patients within 15 minutes of shift start, a reminder fires

**Completion Gate:**

- Handoff is not marked "complete" in audit-service until both sides have completed their steps
- Any gap in the two-party process is logged as an incomplete handoff and escalated to the ward coordinator

**Validation Method:**

- Functional test: attempt to confirm handoff with a critical unaddressed item — verify it is blocked
- Functional test: attempt to dismiss briefing screen without reviewing all patients — verify it is blocked
- Integration test: verify that audit-service records a complete handoff event with both clinician IDs and completion timestamps
- Usability test: time the handoff process for a ward with 6 patients. Target: < 8 minutes for a complete handoff.

---

## Control 7: Role-Scoped Views

**What It Prevents:** Information overload from showing clinicians data and controls irrelevant to their role. A ward nurse should not see agent governance controls. A physician should not see infrastructure alerts. An ops engineer should not see patient clinical data.

**How It's Implemented in Velya's Design:**

velya-web implements role-based view scoping at the routing and component level. Roles defined:

| Role                | Scope                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| Ward Nurse          | Their ward's patients, assigned tasks, shift handoff, clinical alerts for their patients               |
| Physician           | All patients (filtered by service), AI recommendations requiring physician action, discharge approvals |
| Ward Coordinator    | All patients in ward, aggregate queue status, handoff oversight, escalations                           |
| Clinical Supervisor | All wards, patient safety alerts, governance flags, clinician performance indicators                   |
| Platform Engineer   | Service health dashboards, infrastructure alerts, deployment status — NO patient data                  |
| Agent Governance    | Agent behavior dashboards, policy violations, agent scoring — NO patient data                          |

Implementation:

- Role is determined at login from the user's JWT claims
- velya-web's Next.js middleware validates role on every route access
- Navigation is rendered based on role — items the user cannot access are not rendered, not just disabled
- API requests include the user's role claim; backend services reject requests for out-of-scope data
- Role scope is enforced server-side; client-side scoping is a UX enhancement, not a security control

**Validation Method:**

- RBAC test: attempt to access a physician route as a ward nurse — verify 403
- UI test: verify that a ward nurse's navigation does not include agent governance or infrastructure links
- Penetration test: modify JWT role claim client-side and attempt privileged operations — verify server-side rejection
- Review: confirm that patient data is never returned in API responses to non-clinical roles

---

## Control 8: One-Click Critical Actions

**What It Prevents:** Emergency clinical actions requiring excessive navigation or clicks, delaying critical interventions.

**How It's Implemented in Velya's Design:**

The following actions are classified as emergency actions and require one click from any screen:

| Action                              | Access Point                                                |
| ----------------------------------- | ----------------------------------------------------------- |
| Escalate patient to critical status | Global toolbar button (always visible, red, fixed position) |
| Alert care team for patient         | Patient card — always visible action button                 |
| Block discharge immediately         | Patient card — visible when discharge workflow is active    |
| Acknowledge critical alert          | Alert card — primary action button at top of card           |
| Request physician review            | Any task card — secondary action button                     |

Design principles for one-click critical actions:

- The action button is visible without any required preceding navigation
- The button renders at 64px minimum touch target on mobile
- For actions with patient safety impact (escalate, block discharge), a single confirmation dialog appears — just the patient name and "Confirm [Action]?" — no additional forms
- The confirmation dialog auto-closes in 30 seconds if unanswered, treating silence as "cancel" (not as "confirm") for safety
- One-click actions are logged to audit-service regardless of whether they complete successfully

**Validation Method:**

- Time-task test: give a tester an unfamiliar scenario requiring a critical escalation. Measure clicks and time from screen load to completed action. Target: ≤ 2 clicks, ≤ 15 seconds.
- Mobile test: complete all emergency actions on a 375px viewport with touch input only
- Load test: verify one-click actions complete within 2 seconds even when backend is under load (Prometheus histogram p99)

---

## Control 9: Undo and Audit Trail

**What It Prevents:** Non-reversible actions taken in error (wrong patient, wrong task, accidental dismissal) with no recovery mechanism. Lack of audit trail for clinical action accountability.

**How It's Implemented in Velya's Design:**

All actions in velya-web are classified:

**Reversible actions** (allow undo within a time window):

- Task assignment
- Task status change
- Handoff note edit
- Alert acknowledgment (not escalation)

For reversible actions, an undo toast notification appears for 15 seconds: "[Action] — Undo." The undo is available for 30 seconds after the action. Both the action and the undo are logged separately to audit-service.

**Non-reversible actions** (require confirmation, cannot be undone):

- Discharge confirmation
- Patient status critical escalation
- Task deletion
- Policy override approval

For non-reversible actions, a confirmation dialog explicitly states: "This action cannot be undone. [Plain language description of what will happen]. Confirm?"

**Audit trail behavior:**

- Every action (including undo) generates an audit event with: user ID, role, timestamp (UTC), patient ID if relevant, action type, action result, and session ID
- Audit events are written to audit-service synchronously before the UI confirms success to the user
- If the audit write fails, the action is rolled back and the user sees an error — a clinical action that cannot be audited is not recorded as successful

**Validation Method:**

- Functional test: perform a task assignment, then undo. Verify audit-service records two events: the assignment and the reversal, with correct timestamps and user IDs
- Functional test: attempt to proceed past the discharge confirmation dialog in < 3 seconds — verify the confirm button has a 3-second activation delay for high-consequence actions
- Integration test: stop audit-service; attempt a clinical action; verify the action is rolled back and the user receives an error
- Compliance check: verify audit records contain all 7 required HIPAA audit fields (user ID, event type, date/time, patient ID, description, outcome, device ID)

---

## Control 10: Shift Change Readiness Indicator

**What It Prevents:** Clinicians ending their shift with outstanding critical items unaddressed, creating clinical continuity gaps.

**How It's Implemented in Velya's Design:**

In the 30 minutes before a scheduled shift end, velya-web displays a persistent "Shift End in [X] minutes" indicator in the navigation bar. The indicator includes:

- Count of outstanding critical tasks for their patients
- Count of pending handoff items not yet completed
- Whether any patient has an active AI recommendation not yet reviewed

When 15 minutes remain, if any critical items are outstanding, the indicator expands to a modal checklist: "Before your shift ends, the following items require attention:" with direct links to each outstanding item.

The indicator uses a traffic light system:

- **Green:** All handoff items addressed, no outstanding critical tasks
- **Yellow:** Outstanding tasks exist but no immediate safety risk
- **Red:** Outstanding critical items that should be addressed before handoff

Shift-end confirmation is blocked (requires explicit override) if the indicator is Red. Override is logged to audit-service and escalated to the ward coordinator.

**Validation Method:**

- Functional test: create 2 unacknowledged critical tasks with 10 minutes to shift end; verify indicator turns Red and modal appears
- Functional test: attempt to confirm shift end with Red indicator — verify confirmation is blocked
- Integration test: verify override is logged to audit-service with timestamp and user ID
- User test: clinician is unaware the shift end feature exists; verify they discover the indicator without training within 10 minutes of first use

---

## Control 11: Exception Highlighting Rules

**What It Prevents:** Clinical staff missing abnormal conditions because they are rendered the same as normal conditions, requiring active comparison to baseline to detect the exception.

**How It's Implemented in Velya's Design:**

Exception highlighting is applied automatically based on defined rules. Clinical data fields that cross a threshold are highlighted at the field level, not just in a separate alert section:

| Data Type               | Exception Condition                          | Highlight                     |
| ----------------------- | -------------------------------------------- | ----------------------------- |
| Heart rate              | < 50 or > 120 bpm                            | Red bold value                |
| SpO₂                    | < 92%                                        | Red bold value                |
| Blood pressure systolic | < 90 or > 180 mmHg                           | Red bold value                |
| Temperature             | < 36.0°C or > 38.5°C                         | Yellow bold value             |
| Blood glucose           | < 3.0 or > 15.0 mmol/L                       | Red bold value                |
| Serum potassium         | < 3.0 or > 5.5 mEq/L                         | Red bold value                |
| Serum sodium            | < 130 or > 150 mEq/L                         | Yellow bold value             |
| Pain score              | ≥ 8/10 (not recently reassessed)             | Yellow bold value             |
| Length of stay          | > expected by > 2 days                       | Yellow flag on patient card   |
| Discharge blocker count | ≥ 1 active blocker during discharge workflow | Red banner on discharge panel |
| Unacknowledged task age | > 2 hours (critical), > 8 hours (warning)    | Age badge on task card        |

Exception highlighting rules are:

- Applied to raw data values, not derived summaries — clinicians see the highlighted value in context
- Never color-only — always accompanied by bold text weight and, for critical conditions, an icon
- Configurable per deployment (different hospitals have different normal ranges for some parameters)
- Suppressed if the clinician has explicitly noted "patient baseline is outside normal range" — preventing habituated alerts for patients with chronic conditions

**Validation Method:**

- Unit test: assert that a heart rate value of 125 renders with the red exception style and that 75 renders in the normal style
- Parameterized test suite: for each defined exception rule, verify the rendering changes at the threshold boundary
- Accessibility test: verify exception highlighting is perceivable without color (bold text + icon present)
- Clinical review: rules list reviewed by at least one clinical advisor before deployment

---

## Control 12: Cognitive Break Indicators

**What It Prevents:** Extended shift work without breaks, leading to accumulated cognitive fatigue that increases clinical decision errors and overlooked alerts.

**How It's Implemented in Velya's Design:**

velya-web tracks continuous session duration per user. Cognitive break indicators are passive (informational only) — they do not interrupt clinical workflows.

**Session tracking:**

- Session duration is measured from last login or last explicit "back from break" confirmation
- Duration is visible as a small indicator in the navigation bar: a clock icon + hours/minutes

**Break suggestion rules:**

- After 3 hours of continuous session: soft indicator appears — "You've been active for 3 hours. Consider a break."
- After 4.5 hours: indicator becomes more prominent (yellow) with the same message
- After 6 hours: indicator turns red; break suggestion is more explicit — "Extended session detected. If safe to do so, a break is recommended."

**Non-interrupting design:**

- Break suggestions are never full-screen interrupts. They are dismissable toasts that do not block any clinical action.
- The suggestion includes a "I'm on break" button that pauses the counter
- When the clinician returns, "Back from break" resets the session counter
- Break suggestions are suppressed during active critical alerts — no break suggestion fires while the user is in an active emergency response flow

**Governance integration:**

- Session duration data (anonymized) is reported to the clinical governance dashboard
- Shifts with consistently extended sessions (> 10 hours without a break) are flagged for ward coordinator review
- Data is used to identify systemic staffing issues, not for individual performance management

**Validation Method:**

- Functional test: advance the system clock by 3 hours of simulated session time; verify the break suggestion indicator appears
- UX test: verify that the break indicator does not appear during an active full-screen critical alert
- Privacy review: confirm that session duration data is stored with role and ward granularity only, not individual user identifiers in the governance dashboard
- Clinical review: confirm that break timing thresholds align with local fatigue management policy
