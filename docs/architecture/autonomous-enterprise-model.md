# Autonomous Enterprise Model

## Overview

The Velya platform operates as a digital enterprise: a hierarchical organization of AI agents that mirrors the functional structure of a real healthcare organization. This model provides natural governance boundaries, clear escalation paths, and domain-specific expertise at every level. The enterprise consists of 22 offices, each responsible for a specific domain of platform operations.

## Organizational Structure

```
                        +---------------------+
                        |   Chief Executive   |
                        |   (Human Oversight) |
                        +----------+----------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
    +---------v--------+ +--------v--------+ +--------v--------+
    | Clinical Division| | Business Division| | Platform Division|
    +------------------+ +-----------------+ +-----------------+
    | - Clinical Ops   | | - Revenue Cycle | | - Engineering   |
    | - Quality        | | - Compliance    | | - Infrastructure|
    | - Pharmacy       | | - Finance       | | - Security      |
    | - Nursing        | | - HR            | | - Data          |
    | - Laboratory     | | - Legal         | | - AI/ML         |
    | - Radiology      | | - Marketing     | | - DevOps        |
    +------------------+ | - Procurement   | | - Observability |
                         +-----------------+ +-----------------+
```

## The 22 Offices

Each office is a self-contained unit with a head agent (supervisor), specialist agents, and defined interfaces to other offices.

### Clinical Division

| # | Office | Head Agent | Responsibilities |
|---|--------|-----------|-----------------|
| 1 | **Clinical Operations** | clinical-ops-supervisor | Patient intake, encounter management, clinical documentation, care coordination |
| 2 | **Quality Assurance** | quality-supervisor | Clinical quality metrics, outcomes tracking, guideline adherence, audit |
| 3 | **Pharmacy** | pharmacy-supervisor | Medication management, drug interaction checking, formulary management |
| 4 | **Nursing** | nursing-supervisor | Nursing assessments, care plans, shift coordination, patient education |
| 5 | **Laboratory** | lab-supervisor | Lab order management, result interpretation, reference range validation |
| 6 | **Radiology** | radiology-supervisor | Imaging order management, report processing, critical finding alerts |
| 7 | **Care Management** | care-mgmt-supervisor | Chronic disease programs, care transitions, population health |

### Business Division

| # | Office | Head Agent | Responsibilities |
|---|--------|-----------|-----------------|
| 8 | **Revenue Cycle** | revenue-supervisor | Coding, billing, claims submission, denial management, payment posting |
| 9 | **Compliance** | compliance-supervisor | Regulatory compliance, policy enforcement, audit response, reporting |
| 10 | **Finance** | finance-supervisor | Budgeting, cost analysis, financial reporting, vendor payments |
| 11 | **Human Resources** | hr-supervisor | Credentialing, scheduling, training records, competency tracking |
| 12 | **Legal** | legal-supervisor | Contract review, consent management, litigation support, privacy |
| 13 | **Marketing** | marketing-supervisor | Patient engagement, outreach campaigns, reputation management |
| 14 | **Procurement** | procurement-supervisor | Supply chain, vendor evaluation, purchase orders, inventory |
| 15 | **Market Intelligence** | market-intel-supervisor | Competitive analysis, industry benchmarks, improvement proposals |

### Platform Division

| # | Office | Head Agent | Responsibilities |
|---|--------|-----------|-----------------|
| 16 | **Engineering** | engineering-supervisor | Service development, code review, API design, testing |
| 17 | **Infrastructure** | infra-supervisor | Kubernetes operations, networking, storage, compute provisioning |
| 18 | **Security** | security-supervisor | Vulnerability management, access control, incident response |
| 19 | **Data** | data-supervisor | Data pipelines, analytics, data quality, FHIR resource management |
| 20 | **AI/ML** | ai-ml-supervisor | Model management, training pipelines, inference optimization |
| 21 | **DevOps** | devops-supervisor | CI/CD pipelines, deployment automation, environment management |
| 22 | **Observability** | observability-supervisor | Monitoring, alerting, SLOs, incident detection, capacity planning |

## Hierarchical Agent Structure

Each office follows a three-tier hierarchy:

### Tier 1: Supervisor Agent

- One per office
- Coordinates work within the office
- Reviews outputs from specialist agents
- Handles escalations from specialists
- Reports to the division lead (human)
- Manages office-level metrics and scorecards

### Tier 2: Specialist Agents

- Multiple per office, each with a narrow domain focus
- Execute specific tasks (e.g., ICD coding, prior auth, lab result interpretation)
- Self-evaluate outputs before submitting to supervisor
- Escalate low-confidence decisions to supervisor
- Operate within strict tool and data access boundaries

### Tier 3: Task Agents

- Ephemeral agents spun up for specific subtasks
- Created by specialist agents via delegation
- Exist only for the duration of a single task
- Have the narrowest possible scope and permissions
- Results flow back to the delegating specialist

## Teaching and Supervision Loops

### Teaching Loop

Agents improve over time through structured teaching:

1. **Observation**: New agents observe experienced agents processing similar tasks. The new agent produces shadow outputs that are compared but not acted upon.
2. **Guided practice**: The agent processes real tasks with mandatory supervisor review on 100% of outputs. The supervisor provides feedback that is logged as training data.
3. **Supervised autonomy**: The agent processes tasks independently, with supervisor review on a sampling basis (e.g., 20%). Feedback continues to accumulate.
4. **Full autonomy**: The agent operates independently within its authority level. Supervisor review drops to periodic audit (e.g., 5%).

Progression through teaching stages requires meeting scorecard thresholds at each level.

### Supervision Loop

Ongoing supervision ensures agents maintain quality:

```
Agent produces output
        |
        v
Self-evaluation (confidence score)
        |
        +-- Below threshold --> Escalate to supervisor
        |
        v
Supervisor sampling (configurable %)
        |
        +-- Quality issue --> Feedback + retraining flag
        |
        v
Periodic audit (monthly)
        |
        +-- Scorecard decline --> Increase supervision %
        |
        v
Quarterly review
        |
        +-- Sustained quality --> Decrease supervision %
        +-- Persistent issues --> Suspend + retrain
```

### Cross-Office Teaching

When an agent needs domain knowledge from another office:

- The agent's supervisor requests a knowledge transfer from the target office supervisor.
- The target office provides reference materials, example outputs, and evaluation criteria.
- Cross-office knowledge is packaged as structured context (not informal chat) and version-controlled in `agents/knowledge/`.

## Autonomy Levels

Each agent operates at a defined autonomy level that determines what actions it can take independently:

| Level | Name | Description | Approval Required |
|-------|------|-------------|-------------------|
| 0 | **Observer** | Can read data and produce analysis. Cannot take any action. | N/A (read-only) |
| 1 | **Advisor** | Can produce recommendations. All actions require human approval. | Human approval for all actions |
| 2 | **Supervised** | Can execute low-impact actions independently. High-impact actions require supervisor approval. | Supervisor for high-impact |
| 3 | **Autonomous** | Can execute most actions independently. Only critical actions require approval. | Supervisor for critical only |
| 4 | **Trusted** | Can execute all actions within scope independently. Periodic audit only. | Audit-only |

### Autonomy Level Assignment

- New agents start at Level 0 (Observer) or Level 1 (Advisor).
- Promotion requires meeting scorecard thresholds for a defined period at the current level.
- Demotion occurs automatically when scorecard metrics drop below thresholds.
- Level 4 (Trusted) requires explicit human approval and is reserved for agents with proven track records.
- No agent can self-promote to a higher autonomy level.

### Action Classification

Every tool and output type is classified by impact level, which maps to the minimum autonomy level required:

| Impact | Examples | Minimum Autonomy Level |
|--------|----------|----------------------|
| **Informational** | Read FHIR resource, search reference data | Level 0 |
| **Low** | Generate draft documentation, suggest coding | Level 2 |
| **Medium** | Create draft FHIR resource (requires human review), send internal notification | Level 2 + supervisor |
| **High** | Submit billing claim, modify clinical record, send external communication | Level 3 + four-eyes |
| **Critical** | Delete data, modify access controls, change agent configuration | Level 4 + human approval |

## Inter-Office Communication

Offices communicate through NATS subjects following the organizational hierarchy:

```
agents.{division}.{office}.{agent-role}.{action}
```

Examples:
- `agents.clinical.ops.documentation.task-assigned`
- `agents.business.revenue.coding.output-completed`
- `agents.platform.engineering.review.requested`
- `agents.escalation.supervisor.{office}.review-needed`

### Communication Rules

- Agents within the same office communicate directly through office-internal subjects.
- Cross-office communication flows through supervisor agents. A specialist agent cannot directly message a specialist in another office.
- Cross-division communication requires both division supervisors to be notified.
- Emergency communications (critical clinical findings, security incidents) bypass hierarchy and broadcast to all relevant supervisors.

## Enterprise Metrics

The digital enterprise tracks aggregate metrics across all offices:

| Metric | Description | Target |
|--------|-------------|--------|
| Task throughput | Total tasks processed per hour across all offices | Trending upward |
| First-pass accuracy | Percentage of outputs accepted without revision | >= 88% |
| Escalation rate | Percentage of tasks requiring human intervention | <= 12% |
| Cross-office collaboration | Number of successful cross-office delegations per day | Stable or growing |
| Mean time to resolution | Average time from task assignment to completion | <= 15 minutes |
| Cost per task | Average AI token + compute cost per task | Trending downward |
| Agent utilization | Percentage of time agents are actively processing vs. idle | 40-70% (headroom for bursts) |
