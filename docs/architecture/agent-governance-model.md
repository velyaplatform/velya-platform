# Agent Governance Model

## Overview

The Agent Governance Model defines the layers of control, validation, and oversight that ensure autonomous agents in the Velya platform operate safely, correctly, and within defined boundaries. Governance is not a single checkpoint but a continuous, multi-layered system that spans the entire agent lifecycle from deployment through operation to decommission.

## Governance Layers

Governance is enforced at five distinct layers, each providing a different type of control:

```
+-------------------------------------------------------------------+
| Layer 5: Human Oversight                                          |
|   Break-glass, final authority, strategic decisions               |
+-------------------------------------------------------------------+
| Layer 4: Cross-Validation                                         |
|   Multi-agent review, consensus requirements                     |
+-------------------------------------------------------------------+
| Layer 3: Supervisory Review                                       |
|   Department supervisors review high-impact outputs               |
+-------------------------------------------------------------------+
| Layer 2: Policy Enforcement                                       |
|   Automated policy checks on every action (tool, data, comms)    |
+-------------------------------------------------------------------+
| Layer 1: Agent Self-Governance                                    |
|   Confidence thresholds, self-evaluation, scope awareness         |
+-------------------------------------------------------------------+
```

### Layer 1: Agent Self-Governance

Every agent performs self-governance before taking any action:

- **Confidence thresholds**: Agents assess their confidence in each decision. Actions below the agent's configured confidence threshold are not taken; instead, the agent escalates to its supervisor.
- **Scope awareness**: Before executing a tool or producing output, the agent checks whether the action falls within its declared scope. Out-of-scope actions are refused and logged.
- **Self-evaluation**: After producing output, agents evaluate their own work against quality criteria defined in their configuration. Outputs failing self-evaluation are revised or escalated.
- **Action budgets**: Each task has a maximum number of actions (tool calls, reasoning steps). An agent that exceeds its action budget must escalate rather than continue.

### Layer 2: Policy Enforcement

The policy engine (running as a sidecar in each agent pod) enforces declarative policies on every agent action:

- **Tool authorization**: Only explicitly permitted tools can be invoked. Permissions are defined per agent role.
- **Data access control**: FHIR resource access is scoped per agent. A coding agent can read Encounter and Condition resources but not financial data.
- **Communication restrictions**: Agents can only publish to NATS subjects listed in their policy. No agent can publish to another agent's output subjects.
- **Rate limits**: Maximum actions per minute, maximum token consumption per task.
- **Temporal restrictions**: Some actions may only be performed during business hours or during approved batch windows.

### Layer 3: Supervisory Review

Each department has a supervisor agent that reviews outputs from the agents in its department:

- **Mandatory review**: High-impact actions (FHIR writes, external communications, financial calculations) always require supervisor approval before execution.
- **Sampling review**: Low-impact actions are reviewed on a configurable sampling basis (e.g., 10% of documentation outputs).
- **Quality scoring**: The supervisor scores agent outputs against department quality standards. Scores feed back into agent scorecards.
- **Escalation authority**: Supervisors can escalate to human reviewers, suspend an agent, or reassign tasks to a different agent.

### Layer 4: Cross-Validation

For critical decisions, multiple agents independently produce outputs that are compared:

- **Dual-agent validation**: Two agents independently process the same input. Outputs are compared for consistency. Discrepancies trigger human review.
- **Consensus requirements**: For specific task types (e.g., clinical coding), a minimum number of agreeing agents is required before the output is accepted.
- **Adversarial review**: A dedicated review agent evaluates another agent's output specifically looking for errors, omissions, or policy violations.

### Layer 5: Human Oversight

Humans retain ultimate authority over agent behavior:

- **Escalation endpoint**: Every escalation chain terminates at a human. No decision loop can be purely agent-driven indefinitely.
- **Configuration authority**: Only humans can modify agent role definitions, policy files, and authority levels.
- **Break-glass access**: Humans can immediately suspend any agent, override any policy, or halt all agent operations.
- **Audit review**: Human reviewers periodically audit agent decision logs, scorecards, and policy violation reports.

## Validation Chains

A validation chain is the ordered sequence of validation steps an agent output must pass before it takes effect. Chains are defined per output type:

### Example: Clinical Documentation Output

```
1. Agent self-evaluation (confidence >= 0.85)
2. Policy engine: verify output contains no PHI in metadata fields
3. Policy engine: verify output references valid FHIR resources
4. Supervisor agent: review document against clinical documentation standards
5. [If coding included] Cross-validation: second coding agent independently codes the encounter
6. Publish to output subject for clinician review
```

### Example: Billing Claim Submission

```
1. Agent self-evaluation (confidence >= 0.95 for financial outputs)
2. Policy engine: verify claim amounts within acceptable ranges
3. Policy engine: verify all required fields present per payer requirements
4. Supervisor agent: review claim for compliance
5. Cross-validation: adversarial review agent checks for upcoding patterns
6. Four-eyes: second supervisor agent approves
7. Publish to output subject for human final approval
```

## Four-Eyes Principle

The four-eyes principle requires that no single agent can independently execute high-impact actions. Implementation:

- **Dual approval**: Actions tagged as `four-eyes-required` in policy must be approved by both the originating agent's supervisor and a second reviewer (either another supervisor or a cross-departmental reviewer).
- **Separation of duties**: The two approvers must be different agent instances with different roles. An agent cannot approve its own output.
- **Audit trail**: Both approvals are recorded in the decision log with the approver identity, timestamp, and approval rationale.

### Actions Requiring Four-Eyes

| Action Category                        | Example                         | Approvers                                      |
| -------------------------------------- | ------------------------------- | ---------------------------------------------- |
| FHIR writes affecting clinical records | Creating a Condition resource   | Department supervisor + clinical quality agent |
| Financial calculations over threshold  | Claim amount > $10,000          | Revenue cycle supervisor + compliance agent    |
| External communications                | Sending prior auth to payer     | Clinical supervisor + compliance agent         |
| Agent configuration changes            | Modifying agent authority level | Agent governance reviewer + human              |
| Production deployment                  | Deploying a new agent version   | Service architect + human                      |

## Cross-Validation Patterns

### Independent Dual Processing

Two agents process the same input independently. Neither sees the other's output. Results are compared by a validation service:

- **Agreement**: If both agents produce the same result, the output is accepted.
- **Minor discrepancy**: If results differ in non-critical ways (e.g., different phrasing of the same clinical finding), the supervisor selects the better output.
- **Major discrepancy**: If results contradict (e.g., different diagnosis codes), both outputs are sent to a human reviewer.

### Adversarial Review

A review agent specifically looks for problems in another agent's output:

- The review agent receives the original input and the producing agent's output.
- It evaluates correctness, completeness, policy compliance, and clinical accuracy.
- It produces a review report with findings, severity levels, and recommendations.
- Critical findings block the output from being published.

## Break-Glass Procedures

Break-glass procedures allow humans to override normal governance in emergencies.

### Agent Suspension

Any authorized human can immediately suspend a specific agent or all agents:

```
POST /api/agents/{agent-id}/suspend
POST /api/agents/suspend-all
```

Suspended agents complete their current in-flight task (if safe to do so) and stop accepting new tasks. The suspension is logged with the authorizing human's identity and reason.

### Policy Override

In emergencies, authorized humans can temporarily override specific policies:

- Override is scoped to a specific agent, a specific policy, and a time window (maximum 4 hours).
- All actions taken during a policy override are flagged in the decision log.
- Policy overrides trigger an automatic post-incident review.

### Emergency Halt

A platform-wide emergency halt stops all agent activity across the entire agent cluster:

- All agent pods receive a SIGTERM and enter the `Terminated` lifecycle stage.
- NATS subjects for agent tasks are paused (consumers are suspended).
- The ai-gateway stops accepting new requests.
- Recovery requires explicit human authorization and a restart procedure.

### Break-Glass Audit

Every break-glass action generates:

1. An immediate alert to the governance-council and on-call team
2. A detailed audit log entry with the action taken, the authorizing human, and the reason
3. A mandatory post-incident review within 24 hours
4. A governance report documenting what happened, what was affected, and what preventive measures will be added

## Scorecard System

Each agent maintains a scorecard that tracks operational metrics:

| Metric                    | Description                                             | Threshold        |
| ------------------------- | ------------------------------------------------------- | ---------------- |
| Accuracy                  | Percentage of outputs accepted without modification     | >= 90%           |
| Escalation rate           | Percentage of tasks escalated to supervisor or human    | <= 15%           |
| Policy violations         | Number of policy violations per 1000 tasks              | <= 1             |
| Latency                   | Average task completion time                            | <= 2x baseline   |
| Cost efficiency           | Token usage per task relative to baseline               | <= 1.5x baseline |
| Self-evaluation agreement | How often self-evaluation matches supervisor evaluation | >= 85%           |

Agents whose scorecards fall below thresholds for two consecutive review periods are suspended for review and retraining. Scorecard data is reviewed monthly by the agent governance reviewer.
