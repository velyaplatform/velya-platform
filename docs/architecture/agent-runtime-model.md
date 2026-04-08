# Agent Runtime Model

## Overview

This document describes how autonomous agents execute within the Velya platform: the runtime environment, tool access model, policy enforcement, decision logging, delegation chains, and lifecycle stages. All agents run as TypeScript processes in the AI/Agents Cluster.

## TypeScript Runtime

Agents are implemented in TypeScript and run as long-lived Node.js processes in Kubernetes pods within the `agents` namespace. Each agent is a class that extends a base `VelyaAgent` class from `packages/agent-runtime/`.

```
packages/agent-runtime/
  src/
    agent-base.ts              # Base class all agents extend
    tool-registry.ts           # Registry of available tools
    policy-engine-client.ts    # Client for policy enforcement
    decision-logger.ts         # Structured decision audit log
    delegation-manager.ts      # Agent-to-agent delegation
    lifecycle-manager.ts       # Agent lifecycle state machine
    nats-transport.ts          # NATS message handling
```

### Agent Process Model

Each agent pod runs a single agent instance. The agent process:

1. Connects to NATS and subscribes to its assigned task subjects
2. Registers with the agent supervisor for its department
3. Enters the `ready` lifecycle state
4. Processes tasks from its subject queue, one at a time (or with configurable concurrency)
5. For each task, executes an AI-driven loop: observe context, reason, select tool, execute, evaluate result
6. Logs every decision to the structured audit trail
7. Publishes results back via NATS

### AI Model Interaction

Agents interact with AI models through the AI abstraction layer (`packages/ai-core/`). The agent runtime does not call model APIs directly. Instead, it uses the `AIClient` interface which routes through the ai-gateway:

- **Reasoning**: The agent sends its current context (task description, observations, tool results) to the AI model and receives a structured response indicating the next action.
- **Structured output**: Agents use Zod schemas to define expected output shapes. The AI abstraction layer enforces output parsing and retries on schema violations.
- **Streaming**: For long-running reasoning tasks, the agent can stream model output to reduce time-to-first-token.

## Tool Wrappers

Agents interact with external systems through tools. Every tool is a TypeScript class implementing the `AgentTool` interface:

```typescript
interface AgentTool {
  name: string;
  description: string;
  inputSchema: ZodSchema;
  outputSchema: ZodSchema;
  requiredPermissions: string[];
  execute(input: unknown, context: ToolContext): Promise<ToolResult>;
}
```

### Tool Categories

| Category | Examples | Access Control |
|----------|----------|---------------|
| FHIR Read | `fhir-read-patient`, `fhir-search-encounter` | Read-only access to specific FHIR resource types per agent |
| FHIR Write | `fhir-create-document-reference`, `fhir-update-condition` | Write access requires supervisory approval |
| Clinical Reference | `lookup-icd-code`, `search-drug-interactions` | Read-only, no PHI involved |
| Communication | `send-nats-event`, `request-human-review` | Subject restrictions per agent role |
| Web Research | `web-search`, `fetch-clinical-guideline` | Available only to research-designated agents |
| Internal API | `call-billing-api`, `call-scheduling-api` | Scoped to specific API endpoints per agent |

### Tool Execution Sandbox

Tool execution is wrapped in a sandbox that:

- **Validates input** against the tool's Zod input schema before execution
- **Enforces permissions** by checking the agent's declared `requiredPermissions` against its role configuration
- **Sets timeouts** per tool (default 30 seconds, configurable per tool type)
- **Captures output** and validates it against the tool's output schema
- **Records execution** in the decision log with input, output, duration, and any errors

## Policy Enforcement

The policy engine runs as a sidecar container in each agent pod. Before any tool execution or agent action, the runtime checks policies:

### Policy Evaluation Points

1. **Task acceptance**: Can this agent accept this type of task? Checked against role definition.
2. **Tool invocation**: Is this agent authorized to use this tool with these parameters? Checked against permission matrix.
3. **Data access**: Is this agent authorized to access this FHIR resource type / patient scope? Checked against data access policy.
4. **Output publication**: Is this agent authorized to publish to this NATS subject? Checked against communication policy.
5. **Delegation**: Is this agent authorized to delegate to the target agent? Checked against organizational hierarchy.

### Policy Format

Policies are defined as declarative YAML in `agents/policies/`:

```yaml
agent: clinical-documentation-agent
permissions:
  fhir-read:
    - Patient
    - Encounter
    - Condition
    - Observation
  fhir-write:
    - DocumentReference
  nats-publish:
    - agents.documentation.output.*
    - agents.escalation.human-review
  tools:
    - fhir-read-patient
    - fhir-search-encounter
    - fhir-create-document-reference
    - lookup-icd-code
authority-level: 2
max-actions-per-task: 50
requires-supervisor-approval:
  - fhir-write
```

### Policy Violations

When a policy check fails:

- The action is blocked and not executed
- A policy violation event is published to `agents.governance.policy-violation`
- The agent receives a structured error explaining which policy was violated
- Repeated violations trigger agent suspension (configurable threshold)

## Decision Logging

Every agent decision is logged to a structured audit trail. The decision log captures the full reasoning chain for compliance, debugging, and quality review.

### Decision Log Entry

Each entry contains:

| Field | Description |
|-------|-------------|
| `agentId` | Unique identifier for the agent instance |
| `taskId` | The task being processed |
| `timestamp` | ISO 8601 timestamp |
| `stage` | Lifecycle stage (observing, reasoning, acting, evaluating) |
| `action` | What the agent decided to do |
| `reasoning` | Summary of why the agent chose this action |
| `toolName` | Tool invoked (if any) |
| `toolInput` | Input provided to the tool (PHI redacted) |
| `toolOutput` | Output received from the tool (PHI redacted) |
| `confidence` | Agent's self-assessed confidence (0.0-1.0) |
| `policyChecks` | List of policy checks performed and their results |
| `delegatedTo` | Target agent if delegation occurred |
| `escalatedTo` | Escalation target if escalation occurred |
| `duration` | Time spent on this decision step |

### Storage

Decision logs are published as structured JSON to NATS subject `agents.audit.decisions.{agent-name}` and persisted to PostgreSQL in the app cluster via a dedicated audit ingestion service. Logs are retained for 7 years per healthcare compliance requirements.

## Delegation Chains

Agents can delegate subtasks to other agents through the delegation manager. Delegation follows the organizational hierarchy defined in the autonomous enterprise model.

### Delegation Rules

- An agent can only delegate to agents in its own department or to agents in a department it has an explicit delegation relationship with.
- Delegation creates a parent-child task relationship. The parent task blocks until the delegated subtask completes or times out.
- Delegation depth is limited to 3 levels to prevent infinite delegation chains.
- Each delegation is logged in the decision log of both the delegating and receiving agents.
- The delegating agent can set constraints on the subtask: time budget, action budget, required confidence threshold.

### Delegation Flow

```
1. Agent A determines a subtask is outside its scope or expertise
2. Agent A publishes a delegation request to agents.delegation.request
3. The delegation manager validates the request against organizational hierarchy
4. The target agent (Agent B) receives the subtask on its task subject
5. Agent B processes the subtask and publishes results
6. Agent A receives the subtask result and incorporates it into its own task
7. Both agents log the delegation in their decision logs
```

### Supervisor Oversight

Department supervisor agents monitor delegation patterns. If an agent delegates more than a configurable threshold of its tasks, the supervisor flags it for review (the agent may need expanded tools or scope, or it may be miscategorized).

## Lifecycle Stages

Every agent follows a defined lifecycle state machine:

```
                    +-----------+
                    | Deploying |
                    +-----+-----+
                          |
                    +-----v-----+
               +--->| Initializing |
               |    +-----+-----+
               |          |
               |    +-----v-----+
               |    |   Ready   |<---------+
               |    +-----+-----+          |
               |          |                |
               |    +-----v-----+    +-----+-----+
               |    | Processing|--->| Evaluating|
               |    +-----+-----+    +-----+-----+
               |          |                |
               |          v                |
               |    +-----+-----+          |
               |    | Delegating|----------+
               |    +-----------+
               |
               |    +-----------+
               +----| Restarting|
                    +-----------+

               +-----------+
               | Suspended |  (entered on policy violation or error threshold)
               +-----------+

               +-----------+
               | Terminated|  (entered on shutdown or decommission)
               +-----------+
```

### Stage Descriptions

| Stage | Description |
|-------|-------------|
| **Deploying** | Pod is starting, container image pulled, process initializing |
| **Initializing** | Agent connects to NATS, registers with supervisor, loads policies |
| **Ready** | Agent is idle, waiting for tasks on its subject queue |
| **Processing** | Agent is actively working on a task (observe-reason-act loop) |
| **Evaluating** | Agent is assessing the quality of its own output before publishing |
| **Delegating** | Agent has delegated a subtask and is waiting for results |
| **Restarting** | Agent encountered a recoverable error and is reinitializing |
| **Suspended** | Agent has been suspended due to policy violations or error threshold breach |
| **Terminated** | Agent is shutting down gracefully, completing in-flight tasks |

### Health Reporting

Agents expose a `/health` endpoint that reports:

- Current lifecycle stage
- Tasks processed since startup
- Current task ID (if processing)
- Error count
- Last heartbeat to supervisor
- Policy violation count

The supervisor agent monitors health endpoints. An agent that fails to heartbeat within 60 seconds is marked unhealthy and restarted by Kubernetes.
