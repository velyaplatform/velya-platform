# Agent Organization Model

> This document describes how the Velya multi-agent enterprise is structured, how agents communicate, how work flows through the organization, and how the system maintains coherence at scale.

---

## Overview

Velya operates as a **multi-agent enterprise** -- a system of autonomous and semi-autonomous software agents organized into a hierarchical structure that mirrors a real organization. This is not a metaphor; the organizational structure is a first-class architectural element that determines communication patterns, decision authority, and resource allocation.

The key insight is that scaling AI-assisted software development is fundamentally an **organizational design problem**, not just a technical one. By modeling the organization explicitly, we can apply well-understood principles of organizational theory to manage complexity.

---

## Core Concepts

### Agent

An agent is a software entity that:

- Has a defined **identity** (name, office, role)
- Operates under a **system prompt** that defines its persona, capabilities, and constraints
- Has access to **tools** (code search, file editing, API calls, shell commands)
- Follows **policies** that govern its behavior
- Produces **auditable outputs** (code, configs, documents, decisions)
- Operates at a defined **autonomy level**

### Office

An office is a functional unit containing agents with related responsibilities. Offices:

- Have a **charter** defining their mission and scope
- Have a **coordinator** agent that manages work distribution
- Contain **specialist** agents that do the work
- Have a **budget** (compute, API tokens, time allocation)
- Report to an **Executive Director**

### Hierarchy

The hierarchy serves three purposes:

1. **Scope management**: Each layer has a defined scope of authority
2. **Escalation path**: When an agent cannot handle a situation, it knows where to escalate
3. **Communication structure**: Agents primarily communicate within their office and up/down the hierarchy, reducing noise

---

## Communication Patterns

### Intra-Office Communication

Agents within the same office communicate directly through structured messages:

```
Coordinator --> Specialist: Task assignment
Specialist --> Coordinator: Status update, completion, escalation
Specialist <-> Specialist: Peer consultation (within same office only)
```

Messages are typed and schema-validated:

```typescript
interface AgentMessage {
  id: string;
  from: AgentId;
  to: AgentId;
  type: 'task-assignment' | 'status-update' | 'completion' | 'escalation' | 'consultation';
  priority: 'low' | 'normal' | 'high' | 'critical';
  payload: Record<string, unknown>;
  replyTo?: string; // for threaded conversations
  timestamp: string;
}
```

### Inter-Office Communication

Cross-office communication goes through Coordinators:

```
Office A Specialist --> Office A Coordinator --> Office B Coordinator --> Office B Specialist
```

Direct specialist-to-specialist communication across offices is not permitted. This prevents the communication explosion that occurs when N agents can all talk to N agents.

### Event-Based Communication

For broadcast and asynchronous coordination, agents publish and subscribe to events on the event bus:

```
velya.agent.task.completed       -- A task was completed
velya.agent.decision.made        -- A decision was recorded
velya.agent.escalation.triggered -- An escalation was triggered
velya.agent.artifact.produced    -- Code, doc, or config was produced
```

Events are fire-and-forget. The publisher does not know or care who subscribes.

---

## Work Distribution

### Task Flow

```
1. Executive Director sets objectives for Coordinators
2. Coordinator breaks objectives into tasks
3. Coordinator assigns tasks to Specialists based on:
   - Specialist capability match
   - Current workload
   - Priority
4. Specialist executes the task
5. Specialist reports completion (or escalation) to Coordinator
6. Coordinator aggregates results and reports to Executive Director
```

### Task Structure

```typescript
interface AgentTask {
  id: string;
  title: string;
  description: string;
  assignee: AgentId;
  assignedBy: AgentId;
  priority: 'low' | 'normal' | 'high' | 'critical';
  deadline?: string;
  inputs: Record<string, unknown>; // files, specs, context
  expectedOutputs: string[]; // what artifacts to produce
  acceptanceCriteria: string[]; // how to know it's done
  autonomyLevel: AutonomyLevel; // max autonomy for this task
  status: 'pending' | 'in-progress' | 'blocked' | 'completed' | 'escalated';
}
```

### Load Balancing

When multiple Specialists in an office can handle a task type, the Coordinator uses a simple strategy:

1. **Least loaded**: Assign to the Specialist with the fewest active tasks
2. **Affinity**: Prefer a Specialist that recently worked on related code/domain
3. **Round robin**: If load and affinity are equal, rotate

---

## Conflict Resolution

Conflicts arise when:

- Two agents modify the same file
- Two offices disagree on an approach
- An agent's output violates another office's policies

### Resolution Protocol

1. **Detect**: CI, validators, or agents detect the conflict
2. **Notify**: Both parties and their Coordinators are notified
3. **Negotiate**: Coordinators attempt to resolve between themselves
4. **Escalate**: If unresolved within 4 hours, escalate to Executive Directors
5. **Arbitrate**: If still unresolved, the Chief Coordinator or Governance Council decides

### Merge Conflict Resolution

When two agents produce conflicting code changes:

1. The second agent to push discovers the conflict
2. It notifies its Coordinator
3. The Coordinator determines priority:
   - Security fixes take priority
   - Then bug fixes
   - Then features
   - Ties broken by task priority, then first-assigned
4. The lower-priority agent rebases and resolves conflicts

---

## Agent Registry

Every agent is registered in a central registry that serves as the source of truth for the organization.

```typescript
interface AgentRegistryEntry {
  agentId: string; // unique identifier
  name: string; // human-readable name (e.g., "security-office-reviewer-agent")
  office: string; // owning office
  role: 'executive' | 'coordinator' | 'specialist' | 'validator' | 'auditor' | 'red-team';
  autonomyLevel: AutonomyLevel;
  status: 'active' | 'shadow' | 'sandbox' | 'retired';
  capabilities: string[]; // what tools/skills this agent has
  systemPromptHash: string; // hash of current system prompt for change tracking
  resourceLimits: {
    maxConcurrentTasks: number;
    dailyTokenBudget: number;
    maxLatencyMs: number;
  };
  metrics: {
    tasksCompleted: number;
    accuracyRate: number;
    avgLatencyMs: number;
    costToDate: number;
  };
  createdAt: string;
  lastActiveAt: string;
}
```

---

## Observability

### Agent Metrics

Every agent emits standardized metrics:

- `agent.task.duration` -- Time to complete a task
- `agent.task.outcome` -- Success/failure/escalation
- `agent.tokens.used` -- LLM tokens consumed
- `agent.cost.usd` -- Dollar cost of AI API calls
- `agent.decision.accuracy` -- Accuracy of decisions (sampled)
- `agent.escalation.count` -- Number of escalations

### Tracing

Agent interactions are traced end-to-end using distributed tracing (OpenTelemetry). A single user request may trigger a chain of agent tasks across multiple offices, and the trace connects them all.

### Dashboards

- **Organization Dashboard**: Overview of all offices, agent counts, active tasks, health status
- **Office Dashboard**: Per-office view of agent workload, throughput, and quality metrics
- **Agent Dashboard**: Individual agent performance, decision history, and cost

---

## Scaling Considerations

### When to Add a Specialist

Add a new Specialist agent to an office when:

- Average task queue depth exceeds 5 for more than 24 hours
- Task completion latency exceeds SLA
- A new capability is needed that existing Specialists do not have

### When to Add a Coordinator

Add a new Coordinator when:

- An office has more than 10 active Specialists
- Cross-functional coordination within the office becomes a bottleneck

### When to Create a New Office

Create a new office (via ADR) when:

- A new functional area emerges that does not fit existing offices
- An existing office's charter has grown too broad
- Separation of concerns requires organizational boundaries

### Resource Governance

Total agent compute is budgeted quarterly:

- Each office receives a token budget and compute allocation
- Overspend triggers automatic tier downgrade (frontier to balanced models)
- Underspend is not carried over (use-it-or-lose-it prevents hoarding)
- Budget reviews happen monthly via the Cost Management Office
