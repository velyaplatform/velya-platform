# Agent Lifecycle Model

**Version:** 1.0.0  
**Status:** Active  
**Owner:** Agent Factory Office  
**Last Updated:** 2026-04-08  
**Classification:** Institutional Governance — Authoritative

---

## 1. Purpose

Every agent in the Velya enterprise follows a defined lifecycle from conception to retirement. The lifecycle is the quality and safety gate system that ensures no agent operates in production without having demonstrated its capability, been validated, and achieved the appropriate level of trust.

No stage may be skipped. No promotion may occur without the exit criteria for the current stage being met and documented. The lifecycle is enforced by the Agent Factory — no agent promotes itself.

---

## 2. Lifecycle Stages Overview

```
RFC FILED
    │
    ▼
1. DRAFT
   Agent is being designed. No implementation. No operation.
    │
    ▼
2. SANDBOX
   Implemented. Operating only in isolated test environment.
    │
    ▼
3. SHADOW
   Running in production environment. Outputs observed but NOT acted upon.
    │
    ▼
4. PROBATION
   Outputs acted upon in production. Human review mandatory for all outputs.
    │
    ▼
5. ACTIVE
   Fully autonomous within declared scope. No routine human review.
    │         │
    │         ▼
    │    6. DEPRECATED
    │       Replacement exists. Running in parallel. Wind-down in progress.
    │         │
    ▼         ▼
       7. RETIRED
          Deactivated. Archived. No longer operational.
```

---

## 3. Stage 1: Draft

### Entry Criteria
- RFC filed and approved (see Agent Factory Model)
- Naming validated by Naming Governance Office
- Charter approved by Office Manager
- Contract schema complete (may have placeholder values for some fields)
- Risk class assigned and justified

### What Happens in Draft
- Agent design is refined and reviewed
- Dependencies are mapped and confirmed available
- Validators and auditors are assigned
- Permission scope is defined (minimal viable)
- Sandbox environment is prepared
- No agent code is executed in any environment

### Exit Criteria
- Full contract schema complete with no placeholder values
- All dependencies confirmed available in sandbox environment
- Validator and auditor assignments confirmed
- Sandbox environment ready and tested
- ARB review complete for High+ risk agents
- Office Manager approval to proceed to Sandbox

### Duration Guidelines
- Target: 1–2 weeks for standard agents
- Maximum: 4 weeks (if exceeded, RFC is reconsidered)

### Human Oversight Requirements
- Office Manager reviews and approves draft contract before exit
- ARB review for High+ risk agents (can be delegated to ARB agent)

### Evidence Requirements
- Approved RFC
- Approved contract (version 1.0.0)
- Naming approval from Naming Governance Office
- ARB review record (if applicable)
- Sandbox environment readiness confirmation

---

## 4. Stage 2: Sandbox

### Entry Criteria
- Draft stage exit criteria fully met
- Agent implementation complete
- Unit tests written and passing
- Sandbox environment confirmed ready
- Contract version 1.x approved for sandbox operation

### What Happens in Sandbox
- Agent executes in an isolated, non-production environment
- Agent is tested with synthetic and representative workloads
- All outputs are reviewed by the Agent Factory (not production validators)
- Failure modes are deliberately tested
- Performance and throughput are benchmarked
- Permission scope is validated against declared contract

### Sandbox Environment Requirements
- No connection to production systems
- No access to real PHI
- NATS JetStream in sandbox stream group only
- Kubernetes namespace: `velya-sandbox`
- All external API calls mocked

### Exit Criteria
- All unit tests passing (100%)
- Integration tests passing (>95%)
- Deliberate failure mode tests completed and documented
- No forbidden actions taken during any test
- Performance within 80% of expected benchmarks
- Evidence package completeness demonstrated (can produce correct evidence)
- Agent Factory review complete
- Office Manager approval to proceed to Shadow

### Duration Guidelines
- Target: 1–2 weeks for standard agents
- Target: 3–4 weeks for clinical and financial agents
- Maximum: 6 weeks (if exceeded, redesign is assessed)

### Human Oversight Requirements
- Agent Factory Manager reviews sandbox test results
- Office Manager approves shadow promotion

### Evidence Requirements
- Sandbox test report (all tests, results, and failures)
- Performance benchmark report
- Failure mode test report
- Permission scope validation report
- Agent Factory review sign-off

---

## 5. Stage 3: Shadow

### Purpose
Shadow mode is the most important lifecycle stage. The agent operates in the real production environment, processes real inputs, and produces outputs — but those outputs are observed and compared to expected outcomes, not acted upon. The agent runs alongside existing processes (or the incumbent agent) for direct comparison.

Shadow mode reveals real-world behavior that sandbox cannot: edge cases from real data, performance under actual load, integration behavior with live systems, and drift from expected patterns under production conditions.

### Entry Criteria
- Sandbox stage exit criteria fully met
- Production-equivalent environment access provisioned (read permissions only initially)
- Shadow comparison framework in place (how outputs will be compared to expected)
- Watchdog coverage assigned for the shadow agent
- Status reporting configured and tested
- All NATS subscriptions configured for shadow-only consumption (agent receives real messages but cannot produce consequential effects)

### What Happens in Shadow
- Agent processes real production inputs
- Agent produces outputs to a shadow topic (not the production topic)
- Shadow outputs are compared to: incumbent agent outputs, expected outputs from specifications, or human expert reference outputs (for novel agent types)
- Discrepancies are flagged and analyzed
- Scorecard tracking begins (but thresholds are advisory, not enforcement)
- Correction loop is active: if shadow outputs have consistent discrepancies, the agent undergoes correction

### Shadow Comparison Requirements

| Metric | Minimum Standard for Promotion |
|---|---|
| Output accuracy vs. reference | >92% agreement (>95% for clinical/financial) |
| Scenario coverage | Shadow period must cover all task types in declared scope |
| Edge case handling | Agent must demonstrate correct edge case behavior for all documented edge cases |
| No forbidden actions | Zero forbidden actions in shadow period |
| Evidence completeness | >95% of shadow tasks with complete evidence |

### Duration Guidelines

| Agent Domain | Minimum Shadow Duration |
|---|---|
| Standard (infrastructure, DevOps, QA) | 2 weeks |
| Financial (FinOps, Cost Governance) | 4 weeks |
| Clinical (any clinical workflow) | 4 weeks |
| Security (Security, Compliance) | 4 weeks |
| AI Platform | 4 weeks |

Shadow periods may be extended if:
- Output accuracy is below target at the minimum duration mark
- The period did not cover all declared task types
- A significant incident occurred during shadow that requires investigation

### Exit Criteria
- Minimum shadow duration completed
- Output accuracy meets or exceeds minimum standard
- All task types in scope exercised
- No forbidden actions
- Evidence completeness target met
- Watchdog review: no behavioral anomalies
- Office Manager + Agent Factory approval
- For Clinical/Financial/Security: Compliance Office review required

### Human Oversight Requirements
- Shadow comparison report reviewed by Office Manager
- For clinical agents: clinical stakeholder review of shadow output samples
- Agent Factory Manager approval for promotion

### Evidence Requirements
- Shadow comparison report (all comparison data, discrepancy analysis)
- Edge case test results
- Watchdog behavioral report for shadow period
- Office Manager + Agent Factory sign-off
- Compliance Office sign-off (if applicable)

---

## 6. Stage 4: Probation

### Purpose
Probation is the transition stage between shadow (observe only) and active (fully autonomous). In probation, the agent's outputs are acted upon in production — but a mandatory human review layer sits above the agent's decisions for the duration of the probation period.

Probation proves that the agent's outputs are reliable enough to trust in a supervised context, before granting full autonomy.

### Entry Criteria
- Shadow stage exit criteria fully met
- Human review process defined and staffed for the probation period
- Production permissions provisioned at the minimal viable scope
- Validators assigned per the contract
- Reporting configured and monitored

### What Happens in Probation
- Agent operates in production with full permissions per contract
- All outputs above Low risk are reviewed by a designated human (or a highly trusted senior agent designated as probation supervisor) before taking effect
- For Low-risk outputs: outputs take effect, but are spot-checked (25% review rate)
- Scorecard tracking is active with enforcement thresholds
- Correction loop is fully active
- Any quarantine trigger results in immediate human review (not just watchdog)

### Probation Review Checkpoints

Weekly probation review meeting (agent's manager + human probation supervisor):
- Review week's outputs and any rejections
- Review scorecard trend
- Review any corrections and their quality
- Decision: continue, extend, or promote

### Exit Criteria
- Minimum probation duration completed (4 weeks for all agents)
- Minimum 6 weeks for clinical and financial agents
- Human review pass rate >95% (fewer than 5% of outputs required correction by probation supervisor)
- Scorecard in Green for final 2 weeks
- No quarantine events during probation
- No forbidden actions during probation
- All correction cycles resolved (no open corrections)
- Office Manager + Executive approval for Critical/Catastrophic agents

### Human Oversight Requirements
- Designated probation supervisor (human or senior trusted agent) must review all High+ outputs
- Weekly review meeting
- Final promotion requires explicit sign-off from human Governance Council sponsor for Critical agents

### Evidence Requirements
- Probation review logs (all weekly review records)
- Human supervisor sign-offs
- Scorecard history for probation period
- Correction log
- Final promotion recommendation from Office Manager

---

## 7. Stage 5: Active

### Entry Criteria
- Probation stage exit criteria fully met
- Contract finalized (promotion version)
- Human oversight removed (or reduced to break-glass only)
- All validators and auditors confirmed operational
- Watchdog coverage confirmed

### What Happens in Active
- Agent operates fully autonomously within declared contract scope
- No routine human review
- Scorecard tracking continues with full enforcement
- Watchdog monitoring continues
- 30-day post-activation review mandatory (see below)
- Contract is reviewed on its scheduled review date

### 30-Day Post-Activation Review

Mandatory review at 30 days after Active promotion:
- Scorecard analysis: is performance meeting expectations without probation supervision?
- Any new failure modes discovered in Active state?
- Any contract amendments needed based on Active experience?
- Confirm validators and auditors are functioning correctly
- Decision: continue Active, or return to Probation if performance degraded

### Duration in Active
- Active until retirement triggers are met (see Retirement Model)
- Contract review on schedule (as defined in contract)
- Scorecard review weekly

---

## 8. Stage 6: Deprecated

### Entry Criteria
- Retirement trigger identified and accepted by Office Manager
- Replacement agent in Shadow or Probation (if trigger is replacement)
- Retirement proposal approved
- All stakeholders notified

### What Happens in Deprecated
- Agent continues to operate normally
- No new scope expansions or capability additions (contract frozen)
- Replacement agent shadow overlap in progress
- Long-running task assignments reviewed for handoff timing
- Knowledge transfer planning underway

### Duration
- Until replacement agent achieves Active status and knowledge transfer is complete
- Or until the retirement date specified in the proposal

### Exit Criteria
- Replacement agent Active (or handoff plan complete if no single replacement)
- Knowledge transfer completed and verified
- All in-flight tasks handed off or completed
- Retirement audit scheduled

---

## 9. Stage 7: Retired

### Entry Criteria
- Deprecated stage exit criteria fully met
- Retirement audit complete
- All permissions revoked
- All credentials rotated
- All evidence archived

### What Happens in Retirement
- Agent is deactivated (process stopped, container terminated)
- Lifecycle stage set to `retired` in registry
- Archive complete and queryable
- Post-retirement monitoring of replacement agent begins (30 days)

### Duration
- Permanent (with post-retirement monitoring period of 30 days)
- Records retained per retention policy (permanent for contract and decision logs; 7 years for operational records)

---

## 10. Lifecycle Transition Summary Table

| Transition | Authorized By | Evidence Required | SLA |
|---|---|---|---|
| Draft → Sandbox | Office Manager | Full contract, ARB review, sandbox env ready | — |
| Sandbox → Shadow | Office Manager + Agent Factory | Sandbox test report, Factory sign-off | — |
| Shadow → Probation | Office Manager + Agent Factory (+Compliance for clinical) | Shadow comparison report, behavioral review | — |
| Probation → Active | Office Manager + Executive (Critical) | Probation review log, scorecard history, supervisor sign-off | — |
| Active → Deprecated | Office Manager (+Executive for Critical) | Retirement proposal, replacement readiness | — |
| Deprecated → Retired | Office Manager + retirement audit sign-off | Retirement audit, archive confirmation | — |
| Any stage → Emergency Retired | Executive | Forensic snapshot, incident report | Immediate |
| Any stage → Quarantine | Watchdog/Manager/Executive | Quarantine trigger evidence | Immediate |
