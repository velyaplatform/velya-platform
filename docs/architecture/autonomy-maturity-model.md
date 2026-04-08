# Autonomy Maturity Model

> This document defines the levels of autonomy that agents and platform features can operate at within the Velya multi-agent enterprise. Each level represents a different balance between speed and control. Progression through levels is earned through demonstrated reliability.

---

## Autonomy Levels

```
L0  Manual           -- Human does everything
L1  Assisted         -- Agent suggests, human decides and acts
L2  Semi-Automatic   -- Agent acts, human approves before execution
L3  Auto-with-Gate   -- Agent acts autonomously, human reviews periodically
L4  Full Automatic   -- Agent acts autonomously, human intervenes on exception
L5  Self-Improving   -- Agent improves its own behavior
```

---

## Level 0: Manual

**Description**: No automation. Humans perform all work without AI assistance.

**Characteristics**:

- Human identifies the need
- Human gathers information
- Human makes the decision
- Human executes the action
- Human verifies the result

**Use Cases**: Initial process before any automation is introduced. Fallback mode when agents are unavailable or untrusted.

**Controls**: Standard human processes (code review, approval workflows).

**Example**: A developer manually writes all code, runs tests, and creates PRs without any AI assistance.

---

## Level 1: Assisted

**Description**: The agent provides suggestions, drafts, and recommendations. The human makes all decisions and takes all actions.

**Characteristics**:

- Agent observes inputs and context
- Agent generates suggestions or drafts
- Human reviews every suggestion
- Human decides whether to accept, modify, or reject
- Human takes the action (e.g., commits code, merges PR)
- Agent learns from acceptance/rejection patterns

**Use Cases**: New agents in their initial deployment, high-risk tasks, unfamiliar domains.

**Controls**:

- Every agent output is presented to a human for review
- No side effects without explicit human action
- All suggestions are logged with accept/reject outcome

**Metrics**:

- Suggestion acceptance rate
- Time saved vs. manual (even at L1, suggestions should save time)
- Quality of accepted suggestions (defect rate)

**Example**: An agent suggests test cases for a function. The developer reviews each suggestion, modifies some, and adds them to the test file manually.

**Promotion Criteria to L2**:

- Suggestion acceptance rate > 70% over 30 days
- No critical defects in accepted suggestions
- Positive feedback from human reviewers

---

## Level 2: Semi-Automatic

**Description**: The agent takes action but every action requires human approval before execution. The agent does the work; the human is the gate.

**Characteristics**:

- Agent receives a task
- Agent plans and executes the work
- Agent produces output (code, config, document)
- Agent presents output for approval via PR or approval workflow
- Human reviews and approves, requests changes, or rejects
- Agent applies approved changes

**Use Cases**: Standard development work, configuration changes, documentation updates.

**Controls**:

- All outputs go through PR review
- Human approval required before merge/deploy
- Agent cannot bypass review requirements
- Automated CI checks run before human review

**Metrics**:

- First-pass approval rate (approved without changes)
- Revision count per task
- Review turnaround time
- Defect escape rate (defects found after approval)

**Example**: An agent creates a PR with a new API endpoint implementation including tests and documentation. A developer reviews the PR, requests minor changes, the agent applies them, and the developer approves.

**Promotion Criteria to L3**:

- First-pass approval rate > 80% over 30 days
- Zero critical or high-severity defects escaped in 30 days
- Average revision count < 1.5 per task
- Minimum 50 completed tasks

---

## Level 3: Auto-with-Gate

**Description**: The agent acts autonomously for most decisions. A human reviews a sample of decisions periodically (not every one). The agent can merge its own PRs for low-risk changes.

**Characteristics**:

- Agent receives objectives, not detailed tasks
- Agent plans, executes, and completes work independently
- Low-risk outputs (R0-R1) are auto-merged after CI passes
- Medium-risk outputs (R2) go through abbreviated review
- High-risk outputs (R3+) still require full human review
- A random sample of auto-merged outputs is audited weekly

**Use Cases**: Trusted agents with a track record -- test generation, documentation updates, dependency updates, code formatting, routine configuration.

**Controls**:

- Automated CI/CD checks are the primary gate
- Risk classifier determines review requirements
- 10% random audit of auto-merged changes
- Anomaly detection on agent behavior patterns
- Weekly review meeting between Coordinator and office lead

**Metrics**:

- Autonomous task completion rate
- Audit finding rate (defects found in audited auto-merged work)
- Anomaly detection trigger rate
- Human intervention rate (how often humans override)

**Example**: An agent updates all Dependabot-suggested dependency patches, runs tests, and auto-merges if CI passes. A human reviews a summary report weekly and spot-checks a few PRs.

**Promotion Criteria to L4**:

- Audit finding rate < 2% over 90 days
- Zero security findings in auto-merged changes
- Anomaly detection has not triggered in 60 days
- Executive Director approval
- Minimum 200 autonomous tasks completed

---

## Level 4: Full Automatic

**Description**: The agent operates fully autonomously. Humans are notified of outcomes but do not review individual actions. Human intervention occurs only on exception (alert, anomaly, or escalation).

**Characteristics**:

- Agent sets its own task priorities within its scope
- Agent executes all work without human review
- Agent self-validates using automated checks
- Agent escalates only genuinely exceptional situations
- Human receives daily summary reports
- Human intervenes only when alerted

**Use Cases**: Highly mature, battle-tested agents with months of L3 track record -- monitoring agents, automated security scanners, routine maintenance.

**Controls**:

- Comprehensive automated validation (tests, scans, benchmarks)
- Real-time anomaly detection with automatic rollback
- Daily digest reports to human stakeholders
- Monthly deep audit by the Agent Governance Office
- Emergency kill switch accessible to Coordinators and above

**Metrics**:

- Mean time between human interventions
- Rollback rate
- Cost efficiency (cost per task vs. human equivalent)
- Stakeholder satisfaction score

**Example**: An SRE agent monitors production metrics, auto-scales resources, restarts unhealthy pods, and creates incident tickets. It sends a daily summary to the SRE team and pages a human only for severity-1 incidents.

**Promotion Criteria to L5**:

- 180 days at L4 without critical incidents
- Demonstrated cost savings vs. human equivalent
- Governance Council unanimous approval
- External audit of agent behavior and decision patterns
- Formal risk assessment by Risk Management Office

---

## Level 5: Self-Improving

**Description**: The agent can modify its own behavior -- updating its prompts, tools, and strategies based on observed outcomes. This is the highest level of autonomy and requires the most stringent controls.

**Characteristics**:

- Agent analyzes its own performance metrics
- Agent identifies improvement opportunities
- Agent proposes and implements changes to its own system prompt, tool usage patterns, or decision strategies
- Changes are A/B tested before full adoption
- Agent maintains a changelog of self-modifications

**Use Cases**: Reserved for the most critical and well-understood agents with long operational history. Expected to be rare.

**Controls**:

- All self-modifications are logged and auditable
- Self-modifications go through A/B testing with statistical significance requirements
- Performance must improve or stay neutral; degradation triggers automatic rollback
- Maximum modification rate: 1 change per week
- Monthly human review of all self-modifications
- Quarterly external audit
- Governance Council can revoke L5 at any time
- Self-modifications cannot change the agent's core constraints or safety guardrails

**Metrics**:

- Self-modification success rate (improvements that stuck)
- Performance trend over time
- Drift from original behavior (monitored for safety)
- Cost trend

**Example**: An AI Gateway routing agent observes that a particular query pattern gets better results from Provider B than Provider A. It updates its routing rules to prefer Provider B for that pattern, A/B tests for a week, confirms improvement, and adopts the change.

---

## Autonomy Level Assignment

### New Agents

All new agents start at L1 or L2. The level is specified in the Agent Factory request and approved during the RFC process.

- **L1** for agents in novel domains or with access to sensitive systems
- **L2** for agents using well-understood patterns with established templates

### Promotion Process

```
1. Agent meets promotion criteria (documented above)
2. Coordinator submits promotion request to Agent Governance Office
3. Agent Governance Office reviews metrics and history
4. Approval authority signs off:
   - L1 -> L2: Coordinator + Agent Governance
   - L2 -> L3: Executive Director + Agent Governance
   - L3 -> L4: Governance Council (majority)
   - L4 -> L5: Governance Council (unanimous)
5. Promotion is recorded in the agent registry
6. Monitoring thresholds are adjusted for the new level
```

### Demotion Process

Demotion is immediate and does not require the same approval chain:

- Any Coordinator can demote agents in their office
- Any Executive Director can demote agents in their scope
- The Chief Security Director can demote any agent for security reasons
- Automated systems can demote agents when anomaly detection triggers

Demoted agents must re-earn promotion through the standard criteria.

---

## Autonomy by Office (Current Targets)

| Office                  | Current Target | Long-Term Target |
| ----------------------- | -------------- | ---------------- |
| Architecture Office     | L3             | L3               |
| Backend Engineering     | L2             | L3               |
| Frontend Engineering    | L2             | L3               |
| Platform Engineering    | L3             | L4               |
| Data Engineering        | L2             | L3               |
| AI/ML Office            | L2             | L3               |
| DevOps Office           | L3             | L4               |
| SRE Office              | L3             | L4               |
| Release Management      | L3             | L4               |
| Security Engineering    | L3             | L3               |
| Compliance Office       | L2             | L2               |
| Identity & Access       | L2             | L3               |
| Quality Assurance       | L3             | L4               |
| Performance Engineering | L3             | L4               |
| Accessibility Office    | L3             | L3               |
| Product Management      | L2             | L2               |
| Design Office           | L2             | L3               |
| Documentation Office    | L3             | L4               |
| Agent Governance        | L3             | L3               |
| Cost Management         | L3             | L4               |
| Risk Management         | L2             | L2               |
| Knowledge Management    | L3             | L4               |

Note: Compliance, Product Management, and Risk Management offices have lower long-term targets because their decisions inherently require human judgment and accountability.
