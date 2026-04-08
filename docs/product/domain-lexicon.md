# Velya Domain Lexicon

> Canonical definitions for domain terms used across the Velya platform. All code, documentation, API names, and agent prompts must use these terms consistently. When in doubt, this document is the source of truth.

---

## Core Domains

### Patient Flow

The movement of patients through the hospital from admission to discharge. This is the primary domain Velya addresses.

### Discharge Planning

The coordinated process of preparing a patient for safe transition out of the hospital, involving clinical readiness, social arrangements, and logistical coordination.

---

## Entities

### Encounter

A single episode of care for a patient at a facility. An encounter begins at admission and ends at discharge. A patient may have multiple encounters over time, but only one active encounter per facility at any given moment.

- **Attributes**: encounter ID, patient ID, facility, unit, bed, admitting provider, admission date, expected discharge date, status
- **Statuses**: `admitted`, `in-progress`, `discharge-planning`, `ready-for-discharge`, `discharged`, `transferred`

### Discharge Blocker

A documented impediment preventing a patient from being discharged. Blockers are categorized, assigned owners, and tracked to resolution. Resolving all blockers is a prerequisite for discharge.

- **Categories**: `clinical` (pending lab results, unstable vitals), `social` (no safe housing, awaiting placement), `logistical` (transport not arranged, equipment not delivered), `administrative` (insurance authorization pending, paperwork incomplete), `pharmacy` (medication reconciliation incomplete)
- **Statuses**: `identified`, `in-progress`, `escalated`, `resolved`, `waived`

### Task

A discrete unit of work assigned to a care team member or agent. Tasks are created from blockers, orders, protocols, or manual entry. Every task has a due date and an owner.

### Inbox

A personalized queue of tasks, notifications, and pending items for a specific user or role. The inbox is the primary interface through which care team members interact with Velya.

### Pending Item

An item in a user's inbox that requires action. Pending items may be tasks, approvals, escalation acknowledgments, or informational alerts that require dismissal.

### SLA (Service Level Agreement)

A time-bound commitment for completing a task or resolving a blocker. SLAs are configured per blocker category and severity. When an SLA is breached, escalation rules trigger.

- **Example**: Social work consult must be initiated within 2 hours of a social blocker being identified.

### Escalation

An automated response to an SLA breach or critical event. Escalations notify progressively higher levels of authority until the issue is addressed. Each escalation level has a defined set of recipients and response expectations.

- **Levels**: L1 (direct owner reminder), L2 (supervisor notification), L3 (department head alert), L4 (command center intervention)

### Command Center

A real-time operational dashboard providing hospital-wide visibility into patient flow, discharge progress, bed availability, and escalation status. Used by charge nurses, bed managers, and hospital administrators.

### Operational Copilot

The AI-powered assistant embedded in Velya that helps care team members with discharge planning, task prioritization, and decision support. The copilot operates at various autonomy levels depending on the task type and organizational trust.

---

## People and Roles

### Care Team

The group of clinical and non-clinical staff responsible for a patient's care during an encounter. The care team is dynamic and changes based on the patient's needs and location.

- **Members**: attending physician, residents, nurses, case manager, social worker, pharmacist, therapists, specialists

### Case Manager

A clinical professional (typically an RN or MSW) responsible for coordinating the discharge plan, identifying blockers, and ensuring all necessary arrangements are in place for a safe transition.

### Charge Nurse

The nurse responsible for unit-level operations including bed assignments, staffing, and patient flow coordination for a specific nursing unit during a shift.

### Bed Manager

The staff member responsible for hospital-wide bed assignment and capacity management. Works closely with the command center to optimize patient placement.

### Hospitalist

A physician specializing in inpatient care who manages admitted patients and plays a key role in discharge readiness decisions.

---

## Operational Concepts

### Bed Management

The process of tracking bed availability, assigning patients to beds, managing transfers, and optimizing bed utilization across the facility. Includes environmental services coordination for bed turnover.

- **Bed Statuses**: `available`, `occupied`, `dirty`, `cleaning`, `blocked`, `maintenance`

### Census

The count of patients currently admitted to a unit, department, or facility. Census is tracked in real time and compared against capacity targets.

- **Metrics**: current census, midnight census, average daily census, peak census

### Length of Stay (LOS)

The duration from admission to discharge, measured in days (or hours for observation patients). LOS is a critical quality and financial metric.

- **Variants**: actual LOS, expected LOS, geometric mean LOS (GMLOS), excess days

### Readmission Risk

The likelihood that a patient will be readmitted within 30 days of discharge. Assessed using clinical data, social determinants, and predictive models. High-risk patients receive enhanced discharge planning.

- **Risk Levels**: `low`, `moderate`, `high`, `critical`

### Throughput

The rate at which patients move through the hospital, from admission to discharge. Optimizing throughput is the primary operational goal of patient flow management.

### Capacity

The number of patients a unit or facility can safely care for at any given time. Capacity is determined by bed count, staffing levels, and acuity mix.

- **Types**: licensed capacity, staffed capacity, operational capacity

### Boarding

When a patient remains in a location (typically the ED) after being admitted because no inpatient bed is available. Boarding is a key indicator of capacity strain.

### Observation Status

A patient classification where the patient is being monitored but has not been formally admitted as an inpatient. Observation patients have different LOS expectations and reimbursement rules.

### Milestones

Key clinical and administrative events that mark progress toward discharge. Milestones are tracked to identify delays and predict discharge timing.

- **Examples**: consults completed, ambulation achieved, oral medications tolerated, discharge order written, transport arranged, discharge education completed

### Discharge Disposition

Where the patient goes after leaving the hospital. Disposition affects discharge planning complexity and LOS.

- **Types**: `home`, `home-with-services`, `skilled-nursing-facility`, `long-term-acute-care`, `rehabilitation`, `hospice`, `against-medical-advice`, `expired`

### Handoff

The transfer of responsibility for a patient from one care team member to another, typically at shift change or unit transfer. Handoffs are high-risk events for information loss.

---

## Technical Concepts

### Event

A record of something that happened in the system. Events are the primary mechanism for inter-service communication and are published to the event bus. Events are immutable and ordered.

### Workflow

A defined sequence of steps that move an entity through a process. Workflows are modeled as state machines and managed by orchestrator services.

### Agent

An autonomous or semi-autonomous software entity that performs work on behalf of the organization. Agents operate within defined boundaries, follow policies, and can be audited.

### Autonomy Level

The degree of independence granted to an agent or system feature. Ranges from L0 (fully manual) to L5 (self-improving). See the Autonomy Maturity Model for details.

---

## Abbreviations

| Abbreviation | Full Term                               |
| ------------ | --------------------------------------- |
| ADT          | Admission, Discharge, Transfer          |
| AMA          | Against Medical Advice                  |
| CC           | Command Center                          |
| CM           | Case Manager                            |
| DC           | Discharge                               |
| ED           | Emergency Department                    |
| EHR          | Electronic Health Record                |
| EVS          | Environmental Services                  |
| GMLOS        | Geometric Mean Length of Stay           |
| LOS          | Length of Stay                          |
| OBS          | Observation                             |
| PAC          | Post-Acute Care                         |
| PT/OT        | Physical Therapy / Occupational Therapy |
| SLA          | Service Level Agreement                 |
| SNF          | Skilled Nursing Facility                |
| SW           | Social Worker                           |
| UM           | Utilization Management                  |

---

## Usage Guidelines

1. **Use the full term** on first reference in any document, then abbreviate.
2. **Use the canonical spelling**: "Discharge Blocker" not "discharge-blocker" or "blocker" in prose. In code, use the appropriate casing for the language (camelCase, snake_case, etc.) but keep the root terms.
3. **Do not invent synonyms**: Use "Encounter" not "Visit" or "Stay". Use "Discharge Blocker" not "Barrier" or "Issue".
4. **Agents use these terms** in their prompts, outputs, and inter-agent communication. This ensures consistent language across human and AI interactions.
