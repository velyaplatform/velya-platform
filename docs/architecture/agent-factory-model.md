# Agent Factory Model

> The Agent Factory is the mechanism by which the Velya multi-agent enterprise creates, configures, and deploys new agents. This document describes how agents create other agents, the safeguards that prevent uncontrolled proliferation, and the factory's architecture.

---

## Overview

As the Velya platform grows, manually defining every agent becomes a bottleneck. The Agent Factory enables authorized agents (Coordinators and above) to spawn new Specialist agents within their office's scope, subject to governance controls.

This is not self-replication -- agents do not clone themselves. Instead, the factory is a controlled process where higher-level agents define the specification for a new agent, and the factory infrastructure provisions it through the standard lifecycle.

---

## Factory Architecture

```
+---------------------+
|  Requesting Agent   |  (Coordinator or Executive Director)
|  "I need a new      |
|   specialist for X" |
+----------+----------+
           |
           v
+----------+----------+
|  Agent Factory       |
|  (velya-agent-       |
|   orchestrator)      |
|                      |
|  1. Validate request |
|  2. Check quotas     |
|  3. Generate spec    |
|  4. Create agent     |
|  5. Register         |
|  6. Deploy (shadow)  |
+----------+----------+
           |
           v
+----------+----------+
|  New Agent           |
|  (starts in Shadow)  |
+---------------------+
```

---

## Factory Request

A Coordinator or Executive Director submits a factory request:

```typescript
interface AgentFactoryRequest {
  requestedBy: AgentId;
  office: string;
  role: 'specialist';  // Factory can only create Specialists
  
  // What the agent should do
  purpose: string;
  capabilities: string[];
  toolAccess: string[];
  
  // Constraints
  autonomyLevel: 'L1' | 'L2';  // New agents start at L1 or L2 only
  resourceLimits: {
    dailyTokenBudget: number;
    maxConcurrentTasks: number;
  };
  
  // Context
  justification: string;
  expectedDuration: 'permanent' | 'temporary';
  temporaryEndDate?: string;  // Required if temporary
}
```

---

## Factory Process

### Step 1: Validate Request

The factory validates that:
- The requesting agent has authority to create agents (Coordinator or above)
- The requested agent falls within the requesting office's charter
- The tool access requested is within the office's allowed tools
- The purpose does not duplicate an existing agent

### Step 2: Check Quotas

The factory checks organizational quotas:
- **Office agent limit**: Each office has a maximum number of active agents (default: 15)
- **Org-wide agent limit**: Total active agents across all offices (default: 200)
- **Budget availability**: The office must have remaining token budget to support the new agent
- **Compute availability**: Sufficient infrastructure capacity must exist

If any quota is exceeded, the request is rejected with an explanation.

### Step 3: Generate Agent Specification

The factory generates a complete agent specification based on the request:

1. **Name**: Generated following the naming taxonomy (`{office}-{role}-agent`)
2. **System Prompt**: Generated from a template specific to the office and capability type, then reviewed by the AI/ML Office
3. **Tool Manifest**: List of tools the agent can access, derived from the capabilities requested
4. **Resource Limits**: Token budgets, rate limits, and compute allocation
5. **Monitoring Config**: Metrics to collect, alerting thresholds, and dashboard placement

### Step 4: Create Agent

The factory:
1. Provisions the agent's identity (service account, API credentials)
2. Stores the system prompt and configuration in the config store
3. Registers the agent in the agent registry
4. Creates monitoring dashboards and alerts

### Step 5: Register

The agent is registered in the central agent registry with:
- Status: `shadow`
- Autonomy level: L1 or L2 (as requested)
- Created by: the requesting agent's ID
- Creation reason: the justification from the request

### Step 6: Deploy in Shadow Mode

The new agent is deployed in shadow mode:
- It receives real inputs but does not take real actions
- Its outputs are logged and compared to expected outcomes
- The shadow period is a minimum of 2 weeks for permanent agents, 3 days for temporary agents

---

## Safeguards

### Proliferation Control

The factory prevents uncontrolled agent growth through multiple mechanisms:

1. **Hard limits**: Organization-wide and per-office agent count limits
2. **Budget coupling**: Every agent consumes budget; creating agents without budget is impossible
3. **Automatic expiry**: Temporary agents are automatically retired on their end date
4. **Idle detection**: Agents with no tasks for 30 days are flagged for retirement review
5. **Duplicate detection**: The factory checks for existing agents with similar capabilities before creating a new one

### Authority Limits

| Requester | Can Create | Max Per Month |
|---|---|---|
| Specialist | Nothing (cannot create agents) | 0 |
| Coordinator | Specialists in own office | 3 |
| Executive Director | Specialists in any office under their scope | 5 |
| Chief Coordinator | Any Specialist or Coordinator | 10 |
| Governance Council | Any agent at any level | Unlimited |

### Approval Gates

Even with authority, agent creation requires approval:

| Agent Type | Approver |
|---|---|
| Temporary Specialist (< 30 days) | Coordinator (self-approve) + Agent Governance notification |
| Permanent Specialist | Coordinator + Agent Governance Office approval |
| Coordinator | Executive Director + Agent Governance Office approval |
| Executive Director | Governance Council approval |

### No Self-Replication

An agent cannot create an agent with capabilities equal to or greater than its own. Specifically:
- Cannot create an agent at a higher autonomy level
- Cannot grant tools it does not itself have access to
- Cannot set a higher token budget than its own
- Cannot create an agent in a different office (except Executive Directors)

---

## Agent Templates

The factory uses templates to ensure consistency. Templates are maintained by the Agent Governance Office.

### Template Structure

```yaml
apiVersion: velya.io/v1
kind: AgentTemplate
metadata:
  name: specialist-code-reviewer
  office: "*"  # Available to all offices
spec:
  basePrompt: |
    You are a code reviewer for the {{office}} office.
    Your role is to review pull requests for {{domain}} concerns.
    
    Guidelines:
    - Follow the Velya coding standards
    - Check for {{checklist}}
    - Provide constructive, specific feedback
    - Approve, request changes, or escalate
    
  defaultTools:
    - code-search
    - file-read
    - pr-comment
    - pr-approve
    - pr-request-changes
    
  defaultLimits:
    dailyTokenBudget: 500000
    maxConcurrentTasks: 5
    
  requiredCapabilities:
    - code-analysis
    
  variables:
    - name: office
      required: true
    - name: domain
      required: true
      description: "The domain this reviewer focuses on (security, performance, etc.)"
    - name: checklist
      required: true
      description: "The specific checklist items to review"
```

### Available Templates

| Template | Purpose |
|---|---|
| `specialist-code-reviewer` | Reviews PRs for specific concerns |
| `specialist-code-generator` | Generates code from specifications |
| `specialist-test-writer` | Generates tests for existing code |
| `specialist-doc-writer` | Generates documentation |
| `specialist-config-manager` | Manages configuration and infrastructure files |
| `specialist-scanner` | Runs automated scans and reports findings |
| `specialist-monitor` | Monitors metrics and raises alerts |
| `coordinator-standard` | Standard coordinator template |

---

## Temporary Agents

Temporary agents are created for time-bounded work:

- **Sprint agents**: Created for a specific sprint to handle a burst of work
- **Incident agents**: Created during an incident to assist with investigation and remediation
- **Migration agents**: Created for a data or infrastructure migration
- **Audit agents**: Created for a specific audit engagement

Temporary agents:
- Have a mandatory end date
- Are automatically retired on the end date
- Have a shorter shadow period (3 days instead of 2 weeks)
- Are tagged as `temporary` in the registry
- Receive a post-retirement report summarizing their work and cost

---

## Monitoring the Factory

The factory itself is monitored:

- `factory.requests.total` -- Total factory requests
- `factory.requests.approved` -- Approved requests
- `factory.requests.rejected` -- Rejected requests (with reason)
- `factory.agents.created` -- New agents created
- `factory.agents.retired` -- Agents retired
- `factory.agents.active` -- Currently active agents
- `factory.budget.remaining` -- Remaining creation budget

The Agent Governance Office reviews factory activity weekly and reports to the Governance Council monthly.

---

## Emergency Controls

### Kill Switch

The Governance Council can activate a factory kill switch that:
- Immediately halts all agent creation
- Does not affect existing agents
- Requires Governance Council vote to re-enable

### Mass Retirement

In case of a runaway situation:
- Executive Directors can retire all agents in their scope
- The Chief Coordinator can retire all agents organization-wide
- Mass retirement triggers a mandatory post-incident review

### Budget Freeze

The Cost Management Office can freeze the factory budget, preventing new agent creation until the freeze is lifted. Existing agents continue to operate.
