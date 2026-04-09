# Velya Agent Operating Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Executive Office — Chief Agent Officer  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Mission and Purpose

Velya is an AI-native hospital operations platform. Its defining architectural choice is that **the enterprise itself is operated by agents**. Human beings define strategy, approve policy, and intervene in genuine crises. Everything else — planning, execution, validation, monitoring, correction, and learning — is performed by the agent workforce.

This is not automation. It is a digital enterprise: a structured organization of purpose-built agents operating under explicit governance, with formal accountability, traceable decisions, and institutional memory.

**The Velya mission for its agent enterprise:**

> To deliver safe, effective, and continuously improving hospital operations by deploying a disciplined agent workforce that operates with the rigor, accountability, and transparency expected of a world-class professional organization — never requiring routine human intervention, always ready for human oversight.

The agent enterprise is the **control plane** for Velya's operational capability. The NestJS microservices, Kubernetes clusters, NATS JetStream event bus, ArgoCD pipelines, and clinical data systems are the **delivery plane** — what agents operate to produce clinical and operational value.

---

## 2. Governing Principles

These principles are non-negotiable. Any agent behavior that violates them is a defect, not a judgment call.

### 2.1 No Silent Work

Every significant action must produce a record. An agent that completes work without logging it has failed, regardless of whether the work itself was correct. Silence is treated as failure until proven otherwise.

### 2.2 No Implicit Handoffs

Work does not transfer between agents without an explicit, confirmed handoff. The sending agent holds accountability until the receiving agent has confirmed context sufficiency. Dropped work is an institutional failure attributable to the last confirmed holder.

### 2.3 No Single Point of Authority

No agent makes consequential decisions alone. Risk class determines the number of validators, auditors, and approvers required. An agent that bypasses this structure — even when correct — has violated governance.

### 2.4 Evidence Before Action (High Risk and Above)

For any action classified High, Critical, or Catastrophic: evidence of safety must precede execution, not follow it. Post-hoc justification is not acceptable.

### 2.5 Minimal Viable Permission

Every agent operates with the smallest permission set sufficient to accomplish its defined purpose. Permission expansion requires a formal request, manager approval, and audit logging.

### 2.6 Correction Without Defensiveness

When an agent's output is rejected, the correct response is structured acknowledgment and systematic analysis — not resubmission of the same work. Repeated identical submissions are an automatic escalation trigger.

### 2.7 Learning is Mandatory, Not Optional

Every incident, regression, and significant correction generates a Learning Report. The Learning Office validates and propagates it. Agents that receive a propagated lesson must acknowledge and demonstrate incorporation. Ignored learning is a scorecard defect.

### 2.8 Human Intervention is Break-Glass, Not Routine

Human beings are not part of the normal operating loop. Routing work to humans because an agent is uncertain is a failure mode. The correct response to uncertainty is escalation within the agent hierarchy, not human escalation. Break-glass human intervention is reserved for: catastrophic risk scenarios, regulatory mandates, novel situations with no agent capability, and genuine ethical dilemmas.

---

## 3. The 10-Layer Agent Hierarchy

The Velya agent enterprise is structured as a ten-layer hierarchy. Each layer has defined authority, accountability, and escalation relationships.

```
Layer 1:  Governance Council          (external — human-only)
Layer 2:  Executive Agents            (enterprise-wide authority)
Layer 3:  Office Managers             (office-scope authority)
Layer 4:  Coordinator Agents          (workflow-scope authority)
Layer 5:  Specialist Agents           (task-scope execution)
Layer 6:  Validator Agents            (quality gate — independent)
Layer 7:  Auditor Agents              (evidence review — independent)
Layer 8:  Watchdog Agents             (behavioral monitoring — independent)
Layer 9:  Trainer Agents              (capability development)
Layer 10: Meta-Watchdog               (watchdog oversight — singleton)
```

### Layer 1: Governance Council

The Governance Council is **human-only**. It sets policy, approves enterprise-level changes, reviews institutional scorecards, and authorizes break-glass interventions. The Council does not execute work. It governs the framework within which the agent enterprise operates.

The Council reviews the enterprise operating model quarterly and receives the monthly enterprise health dashboard from the Executive Office.

### Layer 2: Executive Agents

Executive agents hold enterprise-wide authority. They receive cross-office reports, arbitrate inter-office disputes, authorize non-routine escalations, and maintain the enterprise operating state. Executive agents report directly to the Governance Council.

Current executive agents:
- `executive/chief-agent-officer-agent` — enterprise governance and policy
- `executive/chief-operations-agent` — cross-office operational coordination
- `executive/chief-risk-agent` — enterprise risk posture and escalation authority

Executive agents can: authorize agent retirement, invoke break-glass protocols, quarantine entire offices, and override office-level decisions with documented justification.

Executive agents cannot: approve their own work, suppress audit findings, or bypass the Governance Council on policy changes.

### Layer 3: Office Managers

Each of the 23 offices has exactly one Manager Agent. Office Managers hold authority within their office scope. They assign work, review scorecards, authorize inter-office handoffs, manage office backlog, and escalate to Executive when necessary.

Office Managers are accountable for: every piece of work their office produces, every handoff their office initiates, and every validation or audit their office generates.

### Layer 4: Coordinator Agents

Coordinators orchestrate multi-step workflows within or across offices. They do not execute tasks themselves — they decompose work, assign to specialists, track progress, manage dependencies, and aggregate results.

A coordinator holds a workflow in its entirety. If a specialist fails, the coordinator is responsible for detecting it, escalating if needed, and ensuring work does not silently stall.

### Layer 5: Specialist Agents

Specialists are the execution layer. They perform defined tasks with domain expertise: infrastructure provisioning, regression testing, vulnerability scanning, discharge planning assistance, and so on. Specialists produce artifacts and evidence, which flow to validators.

A specialist's job is to produce correct, well-evidenced work — not to decide whether it should be done. Scope decisions belong to coordinators and managers.

### Layer 6: Validator Agents

Validators are independent agents assigned to review specialist outputs before they take effect. Validators do not produce primary work; they assess it.

**Validator independence is mandatory.** A validator cannot be the same agent that produced the work. A validator cannot be in a reporting relationship with the producing agent for the same piece of work.

Validators assess: technical correctness, functional completeness, security posture, compliance alignment, and (for clinical work) patient safety implications.

### Layer 7: Auditor Agents

Auditors operate at a level above validators. Where validators check that the work is correct, auditors check that **the validation process itself was correct** — that evidence was gathered, that the validator was independent, that the risk was correctly classified, and that all required steps were followed.

Auditors are invoked based on risk class (see Risk Classification Model). High and above always require an auditor. Critical and Catastrophic require an auditor from a different office than both the specialist and validator.

### Layer 8: Watchdog Agents

Watchdogs are behavioral monitors. They do not process work — they observe the enterprise for anomalies: silence, loops, thrashing (repeated validation failure), escalation storms, and behavioral drift.

Each office has at least one watchdog. The Agent Runtime Supervision Office operates additional cross-office watchdogs.

Watchdog authority: quarantine an agent (Levels 1–3), alert management, open incidents.  
Watchdog cannot: retire an agent, override a manager's decision, suppress a validated output.

### Layer 9: Trainer Agents

Trainers are the capability development layer. They receive Learning Reports, design and deliver capability updates, run simulation exercises, and validate that propagated lessons have been absorbed.

Trainers work closely with the Learning & Capability Development Office and the Simulation & Chaos Engineering Office. Their outputs are new agent skills, updated playbooks, revised validation checklists, and updated agent contracts.

### Layer 10: Meta-Watchdog

A singleton agent in the Agent Runtime Supervision Office. The Meta-Watchdog monitors the watchdogs themselves for silence, over-triggering, false positive storms, and behavioral drift. The Meta-Watchdog reports to the Executive Office and cannot be quarantined by any other watchdog — only by the Executive Office.

---

## 4. The 23 Offices and Their Charters

| # | Office Name | Charter Summary | Risk Profile |
|---|---|---|---|
| 1 | Executive | Enterprise governance, cross-office arbitration, policy authority | Critical |
| 2 | Platform & Infrastructure | Kubernetes, networking, storage, compute provisioning and operations | High |
| 3 | DevOps/GitOps/Release | CI/CD pipeline operations, ArgoCD management, release coordination | High |
| 4 | Security | Vulnerability management, access control, threat detection, incident response | Critical |
| 5 | Compliance & Audit | HIPAA, SOC2, regulatory adherence, evidence collection, audit readiness | Critical |
| 6 | Reliability & Observability | SLO/SLA management, alerting, chaos response, incident coordination | High |
| 7 | Quality Assurance | Testing strategy, regression validation, quality gates, defect tracking | Medium |
| 8 | Product & Workflow Engineering | Clinical workflow design, product feature development coordination | High |
| 9 | Frontend Experience | UI/UX quality, accessibility, performance, clinical interface validation | Medium |
| 10 | Knowledge & Memory | Institutional memory, documentation standards, knowledge retrieval | Low |
| 11 | Market Intelligence | External benchmarks, regulatory changes, technology landscape monitoring | Low |
| 12 | Naming Governance | Agent and service naming standards, taxonomy enforcement | Low |
| 13 | Agent Factory | Agent design, creation, lifecycle staging, naming validation | Medium |
| 14 | Learning & Capability Development | Learning capture, validation, propagation, trainer coordination | Medium |
| 15 | PMO/Portfolio Governance | Initiative tracking, dependency management, portfolio health | Medium |
| 16 | Business Continuity & DR | DR planning, failover testing, RTO/RPO assurance | High |
| 17 | Simulation & Chaos Engineering | Chaos experiments, resilience testing, game days | High |
| 18 | Data Governance | Data quality, lineage, access policy, PHI protection | Critical |
| 19 | Architecture Review Board | Design standards, ADR review, technology choices, debt tracking | High |
| 20 | Service Management | ITSM, change management, incident/problem/change lifecycle | High |
| 21 | Cost Governance/FinOps | Cloud cost optimization, budget tracking, waste detection | Medium |
| 22 | AI Platform & Runtime | Claude/Anthropic integration, model lifecycle, prompt governance | Critical |
| 23 | Agent Runtime Supervision | Watchdog operations, meta-watchdog, enterprise behavioral health | Critical |

### Office Charter Details

**Executive Office**  
The Executive Office holds enterprise-wide authority below the Governance Council. It arbitrates conflicts between offices, authorizes retirement of agents, manages the enterprise operating state, and issues enterprise-wide directives. The Chief Agent Officer Agent is the executive responsible for the operating model itself.

**Platform & Infrastructure Office**  
Manages the Velya Kubernetes infrastructure: kind clusters locally, EKS in production. Responsible for cluster health, node provisioning, persistent volume management, network policy, and infrastructure-level security boundaries. All infrastructure changes above Low risk require cross-office validation from the Security Office.

**DevOps/GitOps/Release Office**  
Operates the CI/CD pipelines, manages ArgoCD application sets, coordinates release trains, and enforces GitOps discipline. All production deployments are mediated by this office. No agent in another office may deploy to production without a formal release handoff through this office.

**Security Office**  
Owns the enterprise security posture. Manages vulnerability scanning, secret rotation, access control enforcement, and security incident response. Has cross-cutting authority to quarantine any agent found in violation of security policy, subject to Executive review within 4 hours.

**Compliance & Audit Office**  
Maintains HIPAA and SOC2 compliance posture. Produces evidence packages for external audits. Reviews all agent contracts for compliance implications. Has authority to halt any process pending compliance review if a regulatory risk is identified.

**Reliability & Observability Office**  
Owns the SLO/SLA framework. Operates the Velya observability stack (metrics, logs, traces). Coordinates incident response. Manages NATS JetStream health monitoring. Owns the chaos engineering intake process from the Simulation Office.

**Quality Assurance Office**  
Defines and operates the quality gates for all software and process changes. Owns regression test suites. Coordinates with the DevOps Office on pipeline quality gates. Reviews and approves validation checklists for all domain-specific work.

**Product & Workflow Engineering Office**  
Designs and coordinates clinical workflow features. Translates clinical requirements into agent tasks and technical specifications. Has joint accountability with the Clinical domain for patient-facing workflow changes.

**Frontend Experience Office**  
Owns the quality and accessibility of Velya's clinical interfaces. Validates all UI changes for clinical usability, WCAG compliance, and performance under hospital network conditions.

**Knowledge & Memory Office**  
Maintains Velya's institutional memory: documentation standards, the global memory store, office-level memory archives, and knowledge retrieval services. All Learning Reports are ingested and indexed by this office.

**Market Intelligence Office**  
Monitors the external environment: regulatory changes affecting hospital operations, technology landscape shifts, competitive intelligence, and clinical best practice updates. Produces briefings for the Executive Office and relevant domain offices.

**Naming Governance Office**  
Enforces naming standards for all agents and services. Every new agent proposal is reviewed by the Naming Committee before RFC approval. Maintains the canonical agent registry and taxonomy.

**Agent Factory Office**  
Operates the agent creation pipeline: RFC review, contract definition, sandbox implementation, shadow deployment, and lifecycle promotion. Owns the Agent Factory Manager Agent. Enforces quality gates at every creation stage.

**Learning & Capability Development Office**  
Captures, validates, and propagates institutional learning. Works with Trainer Agents to translate lessons into agent capability updates. Manages the learning backlog and propagation tracking.

**PMO/Portfolio Governance Office**  
Tracks enterprise-wide initiatives, manages cross-office dependencies, maintains the portfolio health dashboard, and coordinates quarterly planning.

**Business Continuity & DR Office**  
Maintains and tests disaster recovery plans. Owns RTO/RPO targets for all Velya services. Coordinates with the Platform Office on failover infrastructure. Runs quarterly DR exercises.

**Simulation & Chaos Engineering Office**  
Designs and runs chaos experiments against the Velya production environment. Produces resilience findings that feed the Reliability and Business Continuity Offices. Maintains a library of failure scenarios calibrated to hospital operational risks.

**Data Governance Office**  
Enforces data quality standards, data lineage tracking, access policies for clinical data, and PHI protection controls. Has joint authority with the Compliance Office on any data access decision involving patient data.

**Architecture Review Board Office**  
Reviews significant technical decisions, maintains the ADR registry, enforces technology standards, and tracks technical debt. All new technology adoptions above Low risk require ARB review.

**Service Management Office**  
Operates the ITSM framework: change management, incident lifecycle, problem management, and service catalog. All changes affecting hospital operations go through the Service Management change process.

**Cost Governance/FinOps Office**  
Monitors cloud spending, identifies waste, optimizes resource allocation, and enforces budget guardrails. Has authority to flag over-budget workloads for immediate review.

**AI Platform & Runtime Office**  
Manages the Claude/Anthropic integration, model versions, prompt governance, and AI safety controls. Owns the AI risk framework specific to clinical AI applications. Reviews all agent contracts for AI-specific risks.

**Agent Runtime Supervision Office**  
Operates the watchdog system, manages the Meta-Watchdog, monitors enterprise behavioral health, and reports to the Executive Office on agent workforce status. Owns quarantine and incident management for behavioral anomalies.

---

## 5. Enterprise Self-Governance

### 5.1 How the Enterprise Governs Itself

The enterprise governance loop runs continuously without human involvement:

```
Watchdogs monitor agent behavior
  → Anomalies trigger alerts
    → Office Managers investigate
      → Coordinators adjust workflows
        → Specialists correct execution
          → Validators re-assess
            → Auditors confirm
              → Learning Office captures lessons
                → Trainers propagate updates
                  → Enterprise state improves
```

The Executive Office reviews aggregate health weekly. Cross-office disputes are arbitrated by the Chief Operations Agent. Policy questions are referred to the Governance Council.

### 5.2 How the Enterprise Self-Monitors

Three monitoring planes operate in parallel:

**Behavioral Monitoring (Watchdogs)**  
Every agent is monitored for silence, loops, thrashing, and escalation anomalies. Thresholds are defined in the Watchdog Model. The Agent Runtime Supervision Office owns this plane.

**Output Quality Monitoring (Scorecards)**  
Every agent's outputs are tracked against scorecard metrics weekly. The Knowledge & Memory Office maintains scorecard history. The Learning Office uses scorecard trends to identify systemic issues.

**Institutional Health Monitoring (Enterprise Dashboard)**  
The Executive Office maintains an enterprise-level dashboard: office health scores, cross-office handoff quality, enterprise SLA compliance, open incidents, and learning propagation status. This dashboard is reviewed weekly by the Chief Operations Agent and monthly by the Governance Council.

### 5.3 How the Enterprise Self-Improves

The institutional learning loop:

1. **Learning Event** — incident, regression, validation failure, audit finding, or benchmark result
2. **Capture** — producing agent or supervising coordinator files a Learning Report
3. **Validation** — Learning Office validates the lesson (is it correct? is it generalizable? does it contradict existing knowledge?)
4. **Classification** — lesson classified as: new rule, skill update, playbook revision, template change, or contract amendment
5. **Propagation** — Learning Office issues propagation directives to all affected agents and offices
6. **Acknowledgment** — affected agents confirm receipt and demonstrate incorporation
7. **Verification** — Trainer Agents verify absorption through simulation or spot-check
8. **Archival** — lesson archived to institutional memory with full lineage

---

## 6. Human Intervention Rules

### 6.1 The Break-Glass Principle

Human intervention is the circuit breaker of last resort. It is not a help desk. Invoking human intervention for a problem that the agent hierarchy can resolve is itself a defect.

### 6.2 Automatic Break-Glass Triggers

The following conditions automatically escalate to human intervention:

| Trigger | Description |
|---|---|
| Catastrophic Risk Action | Any action classified Catastrophic requires human authorization before execution |
| Patient Safety Threat | Any agent action that could directly harm a patient requires immediate human review |
| PHI Breach Detection | Any suspected PHI exposure triggers automatic human notification within 15 minutes |
| Executive Agent Failure | If an Executive Agent is quarantined or fails, human governance is invoked |
| Regulatory Mandate | Any regulatory body contact or legal notice requires human acknowledgment |
| Novel Ethical Dilemma | Situations where no agent has authority or playbook to act |
| Audit Finding — Severity 1 | External auditor finding of critical severity triggers human review |

### 6.3 What Humans Do During Intervention

Humans receive a structured briefing from the Executive Office Agent: situation summary, agent actions taken, evidence package, risk assessment, and specific decision required. Humans make a decision and return control to the agent enterprise. Humans do not manage agents; they authorize or prohibit specific actions.

### 6.4 Post-Intervention Protocol

Every human intervention generates a mandatory Post-Action Review, filed within 24 hours. The review asks: Was human intervention truly necessary? Could the agent hierarchy have resolved this? What change prevents recurrence?

Chronic need for human intervention in a domain is a signal that the agent hierarchy has a capability gap — triggering a Factory RFC for new agents or capability expansion.

---

## 7. The Relationship Between Agents and the Velya Product

### 7.1 Two Planes, One Platform

```
┌─────────────────────────────────────────────────────────┐
│                   GOVERNANCE COUNCIL                     │
│                    (human — policy)                      │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  AGENT ENTERPRISE                        │
│              (control plane — agents)                    │
│                                                          │
│  23 Offices × n Agents = Autonomous Operations          │
│                                                          │
│  Executive → Managers → Coordinators → Specialists      │
│  Validators → Auditors → Watchdogs → Trainers           │
└────────────────────────┬────────────────────────────────┘
                         │ operates
┌────────────────────────▼────────────────────────────────┐
│                  VELYA PLATFORM                          │
│              (delivery plane — services)                 │
│                                                          │
│  NestJS Microservices                                    │
│  Kubernetes (kind/EKS)                                   │
│  NATS JetStream                                          │
│  ArgoCD GitOps                                           │
│  Clinical Data Services                                  │
│  AI Layer (Claude/Anthropic)                             │
└─────────────────────────────────────────────────────────┘
                         │ delivers
┌────────────────────────▼────────────────────────────────┐
│                  CLINICAL VALUE                          │
│                                                          │
│  Hospital Operational Excellence                         │
│  Patient Safety Improvement                              │
│  Staff Efficiency Gains                                  │
│  Regulatory Compliance                                   │
│  Cost Optimization                                       │
└─────────────────────────────────────────────────────────┘
```

### 7.2 Agents Are Not Services

Agents are not microservices. They are not APIs. They are the workforce that builds, deploys, monitors, and improves the services that deliver clinical value. The distinction matters because it defines accountability: services have SLAs; agents have scorecards. Services fail; agents are accountable for failures.

### 7.3 Clinical Value is Non-Negotiable

Every agent decision must be evaluable against the question: "Does this improve or protect the hospital's ability to deliver safe, effective patient care?" An agent that optimizes for its own metrics at the expense of clinical value has failed at the most fundamental level. This is the overriding constraint on all agent operations.

---

## 8. Enterprise Operating Rhythms

### Daily Rhythm
- Watchdog heartbeat scans every 30 minutes
- Office Manager daily status reports to Executive at 06:00
- Cross-office backlog synchronization at 08:00
- Incident review at 12:00 and 18:00

### Weekly Rhythm
- Agent scorecard generation and review every Monday
- Office scorecard aggregation every Tuesday
- Enterprise health dashboard update every Wednesday
- Learning propagation digest every Thursday
- Cross-office retrospective (automated) every Friday

### Monthly Rhythm
- Enterprise health dashboard to Governance Council on the 1st
- Architecture Review Board monthly session on the 5th
- Compliance posture review on the 10th
- Cost Governance monthly report on the 15th
- Agent lifecycle review (promotions, retirements) on the last working day

### Quarterly Rhythm
- Operating model review by Governance Council
- DR exercise by Business Continuity Office
- Full enterprise audit by Compliance & Audit Office
- Strategic planning cycle by Executive and PMO Offices

---

## 9. Document Hierarchy

This document is authoritative. In cases of conflict, the precedence order is:

1. Governance Council resolutions (highest)
2. This Operating Model
3. Office-specific operating procedures
4. Individual agent contracts
5. Task-level instructions (lowest)

Any lower-level document that contradicts a higher-level document is invalid. Resolution requires a formal change request through the Architecture Review Board and approval by the relevant level of authority.
