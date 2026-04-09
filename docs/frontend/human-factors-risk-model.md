# Human Factors Risk Model
**Velya Hospital AI Platform — Clinical UI**
**Document Type:** Human Factors Engineering Analysis
**Date:** 2026-04-08
**Classification:** Internal — Clinical Safety Document
**Status:** Active — Input to UI Design Requirements

---

## 1. Hospital Operational Context

Velya is used in a 24×7 hospital environment where the consequences of UI-induced error are clinical, not merely operational. This context differs from enterprise software in several critical dimensions:

| Factor | Enterprise Software | Hospital Clinical Environment |
|---|---|---|
| Operating hours | Business hours | 24×7, including peak stress at 3am |
| User cognitive state | Generally rested, variable stress | Frequently fatigued, high stress, emotionally charged |
| Interruption rate | Low to medium | High — wards are interrupt-driven environments |
| Decision speed | Minutes to hours | Seconds to minutes for critical decisions |
| Error consequence | Financial, reputational | Patient harm, potential fatality |
| Device diversity | Desktop, laptop | Mobile phones in wards, shared desktop terminals at nursing stations |
| Environmental conditions | Office | Bright ward lights, glare on screens, noisy environments |
| User training level | High — users trained on system | Variable — shift workers may have minimal platform training |
| Concurrent tasks | One to a few | Frequently managing 5+ patients simultaneously |
| Information freshness need | Hours to days | Minutes to immediate |

This context requires that every UI decision be evaluated against the question: **what happens to patient care if this element causes a 15-second delay, a misread, or a missed alert?**

---

## 2. Cognitive Load Risks

### 2.1 Decision Support That Adds Load Instead of Reducing It

**Risk Description:** AI recommendations presented with insufficient context force the clinician to do additional interpretive work. If the AI says "discharge is recommended" but provides no supporting rationale, no confidence score, and no indication of what data it used, the clinician must mentally reconstruct the reasoning before they can evaluate the recommendation. This is strictly worse than no AI — the clinician now has to evaluate the recommendation AND do the underlying clinical reasoning.

**Likelihood in Hospital Context:** High. The scaffold-stage ai-gateway returns responses without structured confidence or evidence fields. velya-web has no defined rendering standard for AI recommendations.

**Potential Patient Safety Impact:** Clinician accepts recommendation without understanding the basis. If the recommendation is wrong (due to stale data, hallucination, or missing context), the clinician has no mechanism to catch it.

**Mitigation in UI Design:**
- Every AI recommendation must display: confidence level (high/medium/low), the data it was based on with timestamps, and a one-sentence rationale
- If any of these fields are absent, the recommendation must be displayed as "unverified suggestion" with a distinct visual style
- Recommendation must not occupy visual space before these elements are loaded

---

### 2.2 Too Many Concurrent Alerts

**Risk Description:** A clinician responsible for 6 patients simultaneously may arrive at the velya-web dashboard and find 30+ task inbox items, notifications from multiple patients, and platform alerts mixed together. Research in alarm management shows that above 12-15 concurrent alarms, clinicians begin triage-by-volume (addressing what's fastest to close) rather than triage-by-severity (addressing what's most dangerous).

**Likelihood in Hospital Context:** High. Night shifts with reduced staffing and multiple patients per nurse create exactly this scenario.

**Potential Patient Safety Impact:** Critical patient condition buried in inbox noise. Clinical action delayed. Deteriorating patient not identified until condition is severe.

**Mitigation in UI Design:**
- Maximum 3 items visible in the "immediately urgent" view at any time (critical items only)
- Inbox items above critical threshold are grouped and collapsed with a count badge
- Critical items are persistent and cannot be hidden by scrolling or navigation
- "Clear all informational" is a single action; critical items require individual acknowledgment

---

### 2.3 Information Requiring Excessive Interpretation

**Risk Description:** If patient data is presented in raw form (e.g., lab values without reference ranges, vital sign trends without normal bounds, medication names without common names), the clinician must translate raw data to clinical meaning before acting. Under fatigue and time pressure, this translation step increases error probability.

**Likelihood in Hospital Context:** Medium. Depends on implementation choices made during business logic build-out.

**Potential Patient Safety Impact:** Misinterpretation of a lab value (e.g., reading K+ as normal when it's critically elevated) leading to no action or wrong action.

**Mitigation in UI Design:**
- All numeric clinical values display reference range alongside the value
- Values outside normal range are visually flagged at the value level (not just in a separate section)
- Medication names display both generic and brand names
- Trend arrows (up/down/stable) on vital signs require no calculation by the clinician

---

## 3. Shift Handoff Risks

### 3.1 Context Not Transferred

**Risk Description:** The departing clinician has held significant patient context in working memory: patient P-002 is anxious and the family requested updates, patient P-005 is expecting a specialist visit at 2pm, patient P-008's pain management was changed an hour ago and the effect hasn't been assessed. None of this is captured in structured data. velya-web's handoff view, if it shows only structured fields (diagnoses, medications, tasks), fails to transfer the unstructured clinical context that determines what the incoming clinician must prioritize.

**Likelihood in Hospital Context:** Very high. This is the endemic failure of every electronic handoff system.

**Potential Patient Safety Impact:** Incoming clinician approaches patient with incorrect expectations. Fails to follow up on time-sensitive items. Misses pending specialist visit or medication effect assessment.

**Mitigation in UI Design:**
- Handoff screen includes a free-text "shift notes" field that persists for the incoming clinician's first view
- Structured handoff checklist does not allow completion if time-sensitive items (expected specialist, medication changes in last 2 hours, pending lab results) are not explicitly addressed
- Incoming clinician sees a "not yet reviewed" banner on patients they haven't opened since their shift started

---

### 3.2 Continuity Gaps — Stale Data Shown as Current

**Risk Description:** The outgoing clinician updated patient records during their shift. The incoming clinician opens velya-web and sees the current state. If a service was briefly unavailable during the shift change window, velya-web may be displaying cached data that does not reflect the last 15-30 minutes of the previous shift. The incoming clinician has no way to know this.

**Likelihood in Hospital Context:** Medium. Most shift changes occur at predictable times (7am, 3pm, 11pm). These are also times of high system load as multiple users log on simultaneously.

**Potential Patient Safety Impact:** Incoming clinician does not see a late-shift medication change, a new lab result, or a discharge blocker added in the last 30 minutes of the previous shift.

**Mitigation in UI Design:**
- Every patient record displays a "last confirmed fresh at [timestamp]" indicator
- If data is older than 5 minutes at shift handoff, a "DATA MAY BE STALE — VERIFY BEFORE HANDOFF CONFIRMATION" banner appears and blocks handoff completion
- Handoff confirmation requires the departing clinician to attest data is current

---

### 3.3 Incoming Clinician Overwhelmed at Shift Start

**Risk Description:** At the start of a shift, a clinician inherits potentially 6+ patients simultaneously. The inbox may have accumulated overnight items. The temptation is to triage by what's loudest or quickest, not what's most critical.

**Likelihood in Hospital Context:** Very high at morning shift start.

**Potential Patient Safety Impact:** Delayed response to the most critical patient because they weren't the loudest.

**Mitigation in UI Design:**
- Shift start view is a dedicated "incoming shift briefing" screen — not the full dashboard
- Briefing screen lists patients sorted by clinical acuity, not by alphabetical or room order
- Most critical patient is shown first with a summary of outstanding actions
- Clinician cannot navigate away from the briefing screen until they confirm they've reviewed it (or explicitly dismiss with acknowledgment)

---

## 4. Alert Fatigue

### 4.1 How Velya's Design Could Induce Alert Fatigue

**Risk Description:** If velya-web surfaces every system notification, every AI recommendation, every task update, and every platform event in the same inbox with undifferentiated visual treatment, clinicians will habituate to the notification stream and stop reading it. This is the documented behavioral adaptation to alarm noise in ICU environments.

**Specific Velya Risk Factors:**
- Mixed audience in one inbox: ops events (service restarted) alongside clinical events (critical lab result)
- No severity-based visual differentiation beyond color
- AI recommendations of varying quality mixed with confirmed clinical data
- Tasks that are automated (agent-created) mixed with tasks requiring clinical judgment

**Mitigation:** Strict audience segmentation. Clinical staff should never see platform infrastructure events. The task inbox must contain only items that require clinical action.

### 4.2 How Velya's Design Could Prevent Alert Fatigue

**Positive design patterns:**
- Role-scoped views ensure clinicians only see what requires their action
- Critical alerts use a full-screen interrupt for life-threatening conditions, not just a badge update
- Alert volume is tracked per user; sustained high volume triggers a review of alert sources
- Agents suppress low-priority notifications during high-clinical-load periods (when 5+ critical items are active, informational items are held)

---

## 5. Confirmation Bias

**Risk Description:** AI recommendations presented before the clinician has formed their own assessment bias the clinician toward the AI's conclusion. This is especially dangerous when the AI is wrong. The clinician reviews the case, sees the AI recommends discharge, and their subsequent review is framed around confirming discharge rather than independently assessing discharge readiness.

**Likelihood in Hospital Context:** High. Research on anchoring in medical decision-making is well-established.

**Potential Patient Safety Impact:** Unsafe discharge of a patient whose deterioration risks were documented but not surfaced prominently.

**Mitigation in UI Design:**
- AI recommendation is hidden behind a deliberate reveal action ("View AI assessment") that requires the clinician to complete their own structured review first
- AI confidence and data basis are shown simultaneously with the recommendation, never separately
- UI tracks cases where AI recommendation was accepted without prior clinician review, and escalates to governance if the rate exceeds threshold
- Recommendation display includes "Risks if wrong" section when recommendation is high-consequence (discharge, medication change)

---

## 6. Over-Reliance on AI

**Risk Description:** As Velya's AI recommendations become accurate over time, clinical staff habituate to accepting them. The habituation is rational (high accuracy) but creates a dependency: when the AI is wrong in a novel situation (out-of-distribution patient presentation), the clinician's independent clinical reasoning capacity has atrophied relative to their normal practice.

**Likelihood in Hospital Context:** Medium initially; high within 6-12 months of deployment if not managed.

**Potential Patient Safety Impact:** Novel or edge-case patient presentation where AI recommendation is wrong, and clinician accepts it because AI has been right 95% of the time.

**Mitigation in UI Design:**
- Explicit "Uncertainty flag" on AI recommendations when patient context is atypical relative to training
- Regular "AI in training mode" periods where AI recommendations are shown but clinician must complete independent assessment before AI recommendation is revealed — maintains clinical reasoning muscle
- Governance dashboard showing individual clinician AI override rate; outliers (very low override rate) are flagged for review

---

## 7. Degraded Mode Cognitive Risk

**Risk Description:** When one or more Velya services are unavailable, the platform may partially function. Some data is real-time, some is cached, some is absent. Clinical staff must understand exactly what is and isn't functioning to make safe clinical decisions. If the degraded state is not clearly communicated, staff will either: (a) act on stale/absent data believing it's current, or (b) become so uncertain about what's reliable that they stop using the system entirely.

**Likelihood in Hospital Context:** Medium. Service restarts, deployments, and platform updates will cause degraded periods.

**Potential Patient Safety Impact:** (a) leads to clinical decisions based on bad data. (b) leads to abandonment of the platform, removing all its clinical value, and potentially creating a return to manual processes that are even less reliable.

**Mitigation in UI Design:**
- Persistent degraded mode banner at the top of every screen — not dismissable, always visible
- Banner specifies exactly what's affected: "Patient Flow data is unavailable — showing data from 14:23. Discharge data is current."
- Banner distinguishes "data may be stale" from "data is definitely unavailable" from "all systems normal"
- Clinical actions blocked during degraded mode if they depend on unavailable data (with explicit explanation)
- System displays manual fallback procedure when a workflow is blocked by degraded mode

---

## 8. Mobile Use Risks

### 8.1 Small Screen Information Density

**Risk Description:** The task inbox and patient dashboard contain dense clinical information. On a 375px mobile screen, the information density required for clinical use exceeds what is legible without zooming. Clinicians will either miss small text or scroll excessively.

**Likelihood in Hospital Context:** High. Ward nurses frequently use mobile phones.

**Potential Patient Safety Impact:** Missed alert because the notification text was truncated on mobile. Misread value because the font was too small.

**Mitigation:** Mobile-first layout for critical views. Priority items display in a card format sized for the full mobile screen width. No critical information is rendered below 16px font size. Touch targets ≥ 44px.

### 8.2 Outdoor and Ward Lighting

**Risk Description:** Bright ward fluorescent lighting and outdoor natural light create glare on mobile screens. Color-only differentiation (red for critical) may be invisible in bright light or for color-blind users.

**Likelihood in Hospital Context:** High — wards are bright, clinicians move between indoor and outdoor settings.

**Potential Patient Safety Impact:** Critical alert not noticed because the color indicator was not visible in ambient lighting.

**Mitigation:** Color is never the sole differentiator for clinical urgency. Critical items use color + bold text + icon + distinct layout position. Screen contrast meets WCAG AA minimum (4.5:1) in light mode.

### 8.3 Touch Target Precision Under Stress

**Risk Description:** Clinicians using mobile phones while wearing gloves, walking, or in a hurry make more touch target errors than in controlled desktop conditions. Small action buttons (e.g., "Acknowledge," "Escalate") that require precise tapping cause errors and frustration.

**Likelihood in Hospital Context:** High during emergency situations.

**Potential Patient Safety Impact:** Accidental wrong action (e.g., "Dismiss" instead of "Escalate") during a time-critical clinical event.

**Mitigation:** Destructive or high-consequence actions require a confirmation step. Touch targets for primary actions are minimum 64px. Dismiss/acknowledge actions are spatially separated from escalate actions to prevent accidental dismissal.

---

## 9. Interruption Recovery

**Risk Description:** A clinician is mid-way through a multi-step process (discharge checklist, task handoff, medication reconciliation) when they are interrupted — paged, called by a colleague, pulled away for an emergency. When they return to velya-web, they need to know exactly where they left off, what they've completed, and what remains.

**Likelihood in Hospital Context:** Very high. Clinical environments have an interruption rate of 6-10 per hour for nurses.

**Potential Patient Safety Impact:** Clinician returns to a workflow, believes they completed it, but actually stopped mid-way. A discharge checklist left at step 4 of 7 may have submitted a partial record, or the system may have timed out and reset progress.

**Mitigation in UI Design:**
- All multi-step workflows persist state automatically — no "save" action required
- Returning to an incomplete workflow shows a clear "You left off at step 4 of 7" indicator
- Session timeout does not lose form data — state is preserved server-side and restored on login
- Incomplete workflows are visible in the task inbox with a "resume" action
- Time-sensitive workflows (e.g., those with a 30-minute window) display a countdown and send a reminder if left incomplete

---

## Risk Summary Table

| Risk | Likelihood | Patient Safety Impact | Priority |
|---|---|---|---|
| Decision support adds cognitive load | High | High | Critical |
| Too many concurrent alerts | High | High | Critical |
| Information requiring excessive interpretation | Medium | Medium | High |
| Context not transferred at handoff | Very High | High | Critical |
| Stale data shown as current at handoff | Medium | High | Critical |
| Incoming clinician overwhelmed at shift start | Very High | Medium | High |
| Alert fatigue from mixed-audience inbox | High | High | Critical |
| Confirmation bias from AI recommendation framing | High | High | Critical |
| Over-reliance on AI recommendations | Medium-High | High | High |
| Degraded mode not communicated | Medium | High | Critical |
| Mobile small screen information density | High | Medium | High |
| Outdoor/ward lighting and color visibility | High | Medium | High |
| Touch target errors under stress | High | Medium | High |
| Interruption recovery — lost context | Very High | Medium | High |
