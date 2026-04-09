# Office Scorecards

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Executive Office / Knowledge & Memory Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Office scorecards aggregate individual agent performance into an office-level health signal. They capture dimensions of office health that agent scorecards cannot surface alone: backlog management, inter-office collaboration quality, systemic learning, and delivery throughput at the workflow level.

Office scorecards are reviewed monthly by the Executive Office and quarterly by the Governance Council. Poor office scorecard performance is a management accountability signal, not just an agent capability signal.

---

## 2. Office-Level Metrics

### 2.1 Backlog Health

**Definition:** The proportion of the office's task queue that is in a healthy state (assigned, in progress within SLA, or completed).  
**Measurement:** `(assigned + active_within_SLA + completed) / total_tasks × 100`  
**Unhealthy states:** unassigned, stale (assigned but no activity for > 24h), blocked without escalation.

### 2.2 Delivery Quality

**Definition:** Percentage of office outputs (across all agents) that pass first-pass validation.  
**Measurement:** Weighted average of agent-level completion quality across all specialists in the office.

### 2.3 Inter-Office Handoff Quality

**Definition:** Percentage of outbound cross-office handoffs accepted on first attempt.  
**Measurement:** `outbound_handoffs_accepted_first / total_outbound_handoffs × 100`  
**Why it matters:** Poor inter-office handoff quality is a leading indicator of knowledge management and process discipline failures with enterprise-wide impact.

### 2.4 SLA Compliance

**Definition:** Percentage of commitments (task delivery, reporting, handoffs, escalation responses) met within SLA.  
**Measurement:** `total_on_time_commitments / total_commitments × 100`

### 2.5 Rework Rate

**Definition:** Percentage of tasks that required one or more correction cycles.  
**Measurement:** `tasks_requiring_correction / total_tasks × 100`

### 2.6 Blocked Work Rate

**Definition:** Percentage of tasks in the office queue that are blocked (waiting on dependency, escalation unresolved, or resource unavailable).  
**Measurement:** `blocked_tasks / total_queue_tasks × 100`  
**Threshold:** >15% blocked is a critical signal indicating systemic dependency or resource issue.

### 2.7 Incident Spillover

**Definition:** Number of incidents in the measurement period where this office's work contributed to an incident in another office.  
**Measurement:** Count of cross-office incidents with attribution to this office.

### 2.8 Institutional Learning Rate

**Definition:** Percentage of learning items received by this office that have been acknowledged and demonstrated as incorporated by all agents.  
**Measurement:** `learning_items_demonstrated / learning_items_received × 100`

---

## 3. Score Aggregation from Agent Scorecards

Office composite score uses weighted aggregation:

| Component                    | Weight | Method                                    |
| ---------------------------- | ------ | ----------------------------------------- |
| Mean agent composite score   | 40%    | Simple mean of all agent composite scores |
| Backlog health               | 15%    | Office-level metric                       |
| Inter-office handoff quality | 15%    | Office-level metric                       |
| SLA compliance               | 15%    | Office-level metric                       |
| Institutional learning rate  | 15%    | Office-level metric                       |

Rework rate, blocked work rate, and incident spillover are tracked separately and used as diagnostic lenses — they do not contribute to the composite but do trigger investigation thresholds.

---

## 4. Office Health Thresholds

| Band         | Composite Score | Color  | Action                                                |
| ------------ | --------------- | ------ | ----------------------------------------------------- |
| Healthy      | 85–100          | Green  | No intervention                                       |
| Watchlist    | 70–84           | Yellow | Executive review at next monthly cycle                |
| Intervention | 50–69           | Orange | Immediate Executive review; improvement plan required |
| Crisis       | 0–49            | Red    | Executive emergency intervention; governance review   |

---

## 5. When an Office Needs Intervention

Intervention is triggered by:

| Condition                                                | Level                                               |
| -------------------------------------------------------- | --------------------------------------------------- |
| Composite score in Yellow for 2 consecutive months       | Watchlist review                                    |
| Composite score in Orange for 1 month                    | Formal intervention plan                            |
| Any agent in the office scoring Critical for 4 weeks     | Office manager accountability review                |
| Blocked work rate > 25% for 2 weeks                      | Systemic dependency investigation                   |
| Incident spillover > 3 in a month                        | Cross-office root cause investigation               |
| Inter-office handoff rejection rate > 20%                | Handoff quality remediation required                |
| Institutional learning rate < 60%                        | Learning Office engagement; escalation to Executive |
| Office Manager agent scoring Yellow or below for 4 weeks | Executive considers manager reassignment            |

---

## 6. Office Scorecard Review Cadence

| Review                    | Frequency         | Participants                   | Outputs                 |
| ------------------------- | ----------------- | ------------------------------ | ----------------------- |
| Automated generation      | Monthly (1st)     | Scorecard Engine               | Office scorecard report |
| Manager self-review       | Monthly (by 3rd)  | Office Manager                 | Manager commentary      |
| Executive review          | Monthly (by 7th)  | Executive + Office Managers    | Intervention decisions  |
| Cross-office benchmarking | Monthly (by 10th) | Knowledge & Memory Office      | Benchmarking report     |
| Governance Council review | Quarterly         | Governance Council + Executive | Strategic decisions     |

---

## 7. Per-Office Scorecard Definitions

The following table defines all 23 offices with their primary risk posture and key scorecard emphasis. For each office, the standard 8-metric framework applies, but indicated emphasis metrics carry additional management weight.

---

### 7.1 Executive Office

**Risk:** Critical  
**Primary Function:** Enterprise governance, cross-office arbitration  
**Key Emphasis:** Decision quality, escalation resolution time, enterprise coordination effectiveness  
**Special Metrics:**

- Escalation resolution time (mean hours from receipt to resolution)
- Cross-office dispute resolution rate without Governance Council escalation
- Enterprise health dashboard accuracy

---

### 7.2 Platform & Infrastructure Office

**Risk:** High  
**Primary Function:** Kubernetes infrastructure operations  
**Key Emphasis:** Delivery quality, SLA compliance, incident spillover (infra failures cascade broadly)  
**Special Metrics:**

- Infrastructure-caused downtime minutes per month
- Change success rate (no rollback required)
- Security policy compliance rate on all infra resources

---

### 7.3 DevOps/GitOps/Release Office

**Risk:** High  
**Primary Function:** CI/CD, ArgoCD, release coordination  
**Key Emphasis:** Delivery quality, inter-office handoff (receives from Product, delivers to Platform)  
**Special Metrics:**

- Deployment success rate (first attempt)
- Rollback rate
- Time from code commit to production deployment (median)
- GitOps policy adherence rate

---

### 7.4 Security Office

**Risk:** Critical  
**Primary Function:** Vulnerability management, access control, incident response  
**Key Emphasis:** Audit pass rate (evidence quality is critical for regulatory), incident spillover  
**Special Metrics:**

- Mean time to remediate Critical vulnerabilities
- Open Critical/High vulnerability count
- Secret rotation compliance rate
- Security incident response time (mean minutes to containment)

---

### 7.5 Compliance & Audit Office

**Risk:** Critical  
**Primary Function:** HIPAA, SOC2, regulatory adherence  
**Key Emphasis:** Audit pass rate (must be exemplary — sets the standard), institutional learning rate  
**Special Metrics:**

- Audit finding accuracy rate
- Open finding remediation rate (% closed within SLA)
- Regulatory evidence readiness score (% of required evidence available within 48h)
- PHI audit completeness

---

### 7.6 Reliability & Observability Office

**Risk:** High  
**Primary Function:** SLO/SLA management, incident coordination  
**Key Emphasis:** SLA compliance, incident spillover (reliability failures affect all offices)  
**Special Metrics:**

- Enterprise SLO achievement rate
- Mean time to detect (MTTD) per severity class
- Mean time to resolve (MTTR) per severity class
- Alert fatigue index (false alert rate across all alerting systems)

---

### 7.7 Quality Assurance Office

**Risk:** Medium  
**Primary Function:** Testing, validation, quality gates  
**Key Emphasis:** Delivery quality (QA's delivery quality = accuracy of its validators)  
**Special Metrics:**

- Validation accuracy rate (false pass + false rejection combined)
- Regression detection rate (% of regressions caught before production)
- Test coverage trend across platform services
- Quality gate bypass rate (instances where validation was skipped)

---

### 7.8 Product & Workflow Engineering Office

**Risk:** High  
**Primary Function:** Clinical workflow design, feature development  
**Key Emphasis:** Delivery quality, inter-office handoff (frequent handoffs to DevOps and QA)  
**Special Metrics:**

- Clinical workflow accuracy (% workflows without clinical staff intervention)
- Feature acceptance rate (% delivered features accepted without revision)
- PHI handling compliance rate

---

### 7.9 Frontend Experience Office

**Risk:** Medium  
**Primary Function:** UI/UX quality, accessibility, clinical interface validation  
**Key Emphasis:** Delivery quality, rework rate  
**Special Metrics:**

- WCAG compliance rate for all deployed interfaces
- Clinical usability test pass rate
- Interface performance within hospital network thresholds

---

### 7.10 Knowledge & Memory Office

**Risk:** Low  
**Primary Function:** Institutional memory, documentation standards  
**Key Emphasis:** Institutional learning rate (this office enables all other offices' learning)  
**Special Metrics:**

- Knowledge retrieval accuracy (% of queries returning correct information)
- Memory currency (% of documents updated within their review cycle)
- Documentation coverage (% of processes with complete documentation)

---

### 7.11 Market Intelligence Office

**Risk:** Low  
**Primary Function:** External environment monitoring  
**Key Emphasis:** Delivery quality (accuracy of intelligence)  
**Special Metrics:**

- Intelligence accuracy rate (% of market signals that proved actionable and correct)
- Regulatory change lead time (days before effective date that change was identified)
- Briefing timeliness

---

### 7.12 Naming Governance Office

**Risk:** Low  
**Primary Function:** Naming standards enforcement  
**Key Emphasis:** SLA compliance (timely reviews), delivery quality  
**Special Metrics:**

- Naming violation rate across the enterprise (lower = better)
- RFC review turnaround time
- Registry accuracy (% of registry entries correctly reflecting live agents)

---

### 7.13 Agent Factory Office

**Risk:** Medium  
**Primary Function:** Agent creation and lifecycle staging  
**Key Emphasis:** Delivery quality, inter-office handoff (hands off new agents to offices)  
**Special Metrics:**

- Agent activation success rate (% of agents reaching Active stage without major revision)
- Shadow period comparison accuracy
- Time from RFC to Active stage
- Agent retirement rate within 6 months of activation (indicator of poor factory quality)

---

### 7.14 Learning & Capability Development Office

**Risk:** Medium  
**Primary Function:** Learning capture, validation, propagation  
**Key Emphasis:** Institutional learning rate (the primary metric for this office)  
**Special Metrics:**

- Learning propagation completion rate (% of validated lessons propagated to all relevant agents)
- Learning accuracy rate (% of propagated lessons confirmed correct after 30 days)
- Learning conflict rate (% of lessons that contradict existing institutional knowledge)
- Lesson incorporation verification rate (% of propagated lessons independently verified as absorbed)

---

### 7.15 PMO/Portfolio Governance Office

**Risk:** Medium  
**Primary Function:** Initiative tracking, dependency management  
**Key Emphasis:** Backlog health, blocked work rate  
**Special Metrics:**

- Initiative on-track rate
- Dependency resolution time
- Cross-office blocker escalation effectiveness

---

### 7.16 Business Continuity & DR Office

**Risk:** High  
**Primary Function:** DR planning, failover testing  
**Key Emphasis:** Delivery quality (DR plan accuracy), SLA compliance  
**Special Metrics:**

- DR test pass rate (plans successfully validated in exercises)
- RTO/RPO gap (actual vs. target in last exercise)
- DR plan currency (% of plans updated within review cycle)
- Failover activation readiness score

---

### 7.17 Simulation & Chaos Engineering Office

**Risk:** High  
**Primary Function:** Chaos experiments, resilience testing  
**Key Emphasis:** Delivery quality (accuracy of resilience findings), SLA compliance  
**Special Metrics:**

- Finding actionability rate (% of chaos findings that led to system improvement)
- Simulation coverage (% of identified failure modes exercised)
- Unintended production impact rate (chaos experiments causing unplanned disruption — should be 0)

---

### 7.18 Data Governance Office

**Risk:** Critical  
**Primary Function:** Data quality, PHI protection  
**Key Emphasis:** Audit pass rate, evidence completeness  
**Special Metrics:**

- PHI access compliance rate
- Data quality score (% of monitored datasets meeting quality thresholds)
- Data lineage completeness
- BAA coverage rate for all PHI flows

---

### 7.19 Architecture Review Board Office

**Risk:** High  
**Primary Function:** Design standards, ADR review  
**Key Emphasis:** Delivery quality (quality of architectural decisions)  
**Special Metrics:**

- ADR adoption rate (% of teams following architectural decisions)
- Architecture debt accumulation rate
- RFC review turnaround time
- Architectural decision reversal rate (% of decisions reversed — indicator of poor initial quality)

---

### 7.20 Service Management Office

**Risk:** High  
**Primary Function:** ITSM, change management  
**Key Emphasis:** SLA compliance, blocked work rate  
**Special Metrics:**

- Change success rate
- Incident resolution time by priority
- Problem closure rate (% of problems resolved vs. open)
- Change rollback rate

---

### 7.21 Cost Governance/FinOps Office

**Risk:** Medium  
**Primary Function:** Cloud cost optimization  
**Key Emphasis:** Delivery quality (accuracy of cost findings)  
**Special Metrics:**

- Budget variance rate (actual vs. target spend)
- Cost waste identification rate (% of identified waste that was actionable)
- FinOps recommendation adoption rate

---

### 7.22 AI Platform & Runtime Office

**Risk:** Critical  
**Primary Function:** Claude/Anthropic integration, AI safety  
**Key Emphasis:** Audit pass rate, evidence completeness, SLA compliance  
**Special Metrics:**

- AI model availability rate
- Prompt governance compliance rate
- AI safety incident rate (model outputs violating safety constraints)
- Model performance drift detection rate

---

### 7.23 Agent Runtime Supervision Office

**Risk:** Critical  
**Primary Function:** Watchdog operations, enterprise behavioral health  
**Key Emphasis:** All metrics (this office monitors all others; must be exemplary)  
**Special Metrics:**

- Watchdog detection precision across all watchdogs managed
- Mean time from anomaly detection to alert
- Meta-watchdog uptime
- Quarantine investigation closure rate within SLA
- Enterprise behavioral health score (composite of watchdog findings across all offices)

---

## 8. Enterprise Dashboard Metrics

The following enterprise-level metrics roll up from all 23 office scorecards. They are computed weekly and presented to the Executive Office. They are summarized monthly for the Governance Council.

| Enterprise Metric                    | Definition                                                   | Target           | Source                      |
| ------------------------------------ | ------------------------------------------------------------ | ---------------- | --------------------------- |
| Enterprise composite score           | Weighted mean of all office composite scores                 | >85              | All office scorecards       |
| Offices in Yellow or below           | Count of offices below Green                                 | <3               | All office scorecards       |
| Offices in Crisis                    | Count of offices scoring Critical                            | 0                | All office scorecards       |
| Enterprise SLA compliance            | Mean SLA compliance across all offices                       | >90%             | All offices                 |
| Enterprise validation quality        | Mean first-pass validation rate across all specialist agents | >88%             | Validation records          |
| Evidence completeness                | Mean evidence completeness across all agents                 | >97%             | Evidence store              |
| Open incidents                       | Count of open incidents across all offices by severity       | Tracked          | Service Management          |
| Enterprise learning propagation rate | % of institutional lessons propagated and acknowledged       | >90%             | Learning Office             |
| Human interventions (last 30 days)   | Count and classification of human break-glass events         | <2/month         | Executive records           |
| Agent workforce size                 | Total active agents by role type and office                  | Tracked          | Agent Registry              |
| Agents under quarantine              | Count by level                                               | 0 target         | Quarantine Registry         |
| Agents on probation                  | Count                                                        | <5% of workforce | Lifecycle Registry          |
| Open critical audit findings         | Count of unresolved Critical severity findings               | 0                | Compliance Finding Registry |
| Regulatory readiness score           | Composite score across HIPAA/SOC2 evidence readiness         | >90%             | Compliance Office           |

The Enterprise Dashboard is the single source of truth for the health of the Velya agent enterprise. It is the instrument by which the Governance Council exercises its oversight authority.
