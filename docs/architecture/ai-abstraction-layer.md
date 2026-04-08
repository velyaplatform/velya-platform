# AI Abstraction Layer

## Overview

The AI abstraction layer (`packages/ai-core/`) provides a unified, provider-agnostic interface for all AI operations in the Velya platform. It decouples clinical services and agents from specific AI providers, enabling model routing, cost tracking, policy enforcement, and provider switching without application code changes.

## Components

```
                    +-------------------+
                    |  Clinical Service |
                    |  or Agent Runtime |
                    +--------+----------+
                             |
                    +--------v----------+
                    |    ai-gateway     |
                    |  (entry point)    |
                    +--------+----------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v------+  +----v--------+
     |model-router|  |policy-engine|  |eval-service |
     +--------+---+  +------+------+  +----+--------+
              |              |              |
     +--------v--------------v--------------v--------+
     |              Provider Adapters                 |
     |  +----------+ +--------+ +--------+ +-------+ |
     |  | Anthropic| | OpenAI | | Google | | Local | |
     |  +----------+ +--------+ +--------+ +-------+ |
     +------------------------------------------------+
                             |
                    +--------v----------+
                    | feedback-service  |
                    +-------------------+
```

## ai-gateway

The ai-gateway is the single entry point for all AI requests. It runs as a service in the `ai-inference` namespace and accepts requests over gRPC and HTTP.

### Responsibilities

- **Request acceptance**: Validates incoming AI requests (model selection, prompt format, output schema)
- **Authentication**: Verifies that the calling service or agent has authorization to make AI requests
- **Rate limiting**: Enforces per-service and per-agent rate limits to prevent runaway token consumption
- **Request enrichment**: Attaches metadata (requesting service, tenant ID, cost center) for tracking
- **Response delivery**: Returns model outputs to callers with standardized response format
- **Caching**: Deduplicates identical requests using a semantic cache (content hash of prompt + parameters)
- **Timeout management**: Enforces maximum response time; returns graceful timeout errors rather than hanging

### Request Format

```typescript
interface AIRequest {
  task: 'chat' | 'completion' | 'embedding' | 'structured-output';
  model?: string; // Optional: override model selection
  routingHint?: string; // Optional: e.g., 'clinical-reasoning', 'coding', 'fast'
  messages: ChatMessage[]; // For chat/completion tasks
  outputSchema?: ZodSchema; // For structured-output tasks
  input?: string | string[]; // For embedding tasks
  maxTokens?: number;
  temperature?: number;
  callerContext: {
    serviceId: string;
    agentId?: string;
    tenantId: string;
    taskId?: string;
    costCenter: string;
  };
}
```

## model-router

The model-router selects the optimal AI provider and model for each request based on configurable routing policies.

### Routing Policies

| Policy                | Description                                               | Example                                                                       |
| --------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **Task-based**        | Route by task type to the best-suited model               | Clinical reasoning to Claude, ICD coding to a fine-tuned model                |
| **Cost-optimized**    | Route to the cheapest model that meets quality thresholds | Use Claude Haiku for simple classification, Claude Opus for complex reasoning |
| **Latency-optimized** | Route to the fastest responding provider                  | Real-time clinical suggestions route to the provider with lowest p50 latency  |
| **Sovereignty**       | Route to providers that meet data residency requirements  | PHI-containing requests route to self-hosted models or providers with BAAs    |
| **Load-balanced**     | Distribute across providers to avoid rate limits          | Spread embedding requests across multiple providers                           |

### Routing Configuration

Routing rules are defined in `agents/config/model-routing.yaml`:

```yaml
routes:
  - name: clinical-reasoning
    match:
      routingHint: clinical-reasoning
    providers:
      - provider: anthropic
        model: claude-sonnet-4-20250514
        weight: 80
        constraints:
          maxLatencyMs: 30000
      - provider: anthropic
        model: claude-haiku-4-20250414
        weight: 20
        constraints:
          maxLatencyMs: 10000

  - name: icd-coding
    match:
      routingHint: icd-coding
    providers:
      - provider: local-vllm
        model: velya-icd-coder-v2
        weight: 100

  - name: default
    match: {}
    providers:
      - provider: anthropic
        model: claude-sonnet-4-20250514
        weight: 100
```

### Fallback Chains

When a provider is unavailable or returns an error, the model-router follows a fallback chain:

1. Retry the same provider with exponential backoff (max 2 retries)
2. Fall back to the next provider in the route's provider list
3. If all providers in the route fail, fall back to the `default` route
4. If the default route fails, return a structured error to the caller

Fallback decisions are logged with the original provider, the failure reason, and the fallback provider selected.

## policy-engine

The policy engine enforces rules on AI requests and responses. It runs as a sidecar in the ai-gateway pod.

### Pre-Request Policies

- **PHI detection**: Scans prompts for potential PHI (patient names, MRNs, dates of birth) and blocks requests to providers without BAAs if PHI is detected
- **Content filtering**: Blocks prompts that contain inappropriate or unsafe content
- **Token budget**: Rejects requests that would exceed the caller's remaining token budget for the current billing period
- **Rate limiting**: Enforces per-caller, per-model, and global rate limits

### Post-Response Policies

- **Output validation**: Validates structured output against the requested schema
- **Hallucination flags**: Marks responses where the model indicates low confidence or where outputs contradict known clinical facts (via reference database lookup)
- **PII filtering**: Scans model responses for inadvertently generated PII before returning to the caller
- **Safety classification**: Classifies clinical AI outputs by risk level (informational, advisory, clinical-decision-impacting)

## eval-service

The eval-service continuously evaluates AI model quality to inform routing decisions and detect model degradation.

### Evaluation Types

| Type                     | Frequency  | Method                                                                                              |
| ------------------------ | ---------- | --------------------------------------------------------------------------------------------------- |
| **Synthetic benchmarks** | Daily      | Run standardized clinical reasoning, coding, and documentation benchmarks against all active models |
| **Shadow evaluation**    | Continuous | Route a percentage of production requests to a secondary model and compare outputs                  |
| **Clinical accuracy**    | Weekly     | Compare AI coding suggestions against human-audited coding decisions                                |
| **Latency tracking**     | Continuous | Track p50, p95, p99 latency per provider per model per task type                                    |
| **Cost tracking**        | Continuous | Track token usage and cost per provider per model per task type                                     |

### Quality Scores

Each model maintains a quality score per task type. Scores feed back into the model-router to adjust routing weights. If a model's quality score drops below a configured threshold, it is automatically removed from routing and an alert is raised.

```typescript
interface ModelQualityScore {
  provider: string;
  model: string;
  taskType: string;
  accuracy: number; // 0.0-1.0
  latencyP50Ms: number;
  latencyP95Ms: number;
  costPer1kTokens: number;
  lastEvaluated: Date;
  sampleSize: number;
}
```

## feedback-service

The feedback-service collects human feedback on AI outputs to create a continuous improvement loop.

### Feedback Collection

- **Clinician acceptance rate**: When an AI suggestion (coding, documentation, clinical decision support) is accepted or rejected by a clinician, the feedback is recorded.
- **Edit distance**: When a clinician modifies an AI-generated document, the edit distance between the original and the edited version is measured.
- **Explicit ratings**: Clinicians can explicitly rate AI outputs on a 1-5 scale with optional free-text explanation.
- **Escalation feedback**: When an agent escalates to a human, the human's resolution is recorded as implicit feedback on what the agent could not handle.

### Feedback Loop

Feedback data flows into the eval-service to:

1. Adjust model quality scores based on real-world acceptance rates
2. Identify task types where AI quality is declining
3. Build evaluation datasets from accepted AI outputs for future benchmark testing
4. Generate training data for fine-tuned models (with appropriate consent and anonymization)

## Cost Tracking

Every AI request is tracked for cost accounting:

| Dimension                    | Granularity |
| ---------------------------- | ----------- |
| Provider + model             | Per-request |
| Input tokens + output tokens | Per-request |
| Caller service/agent         | Per-request |
| Tenant                       | Per-request |
| Cost center (department)     | Per-request |
| Task type                    | Per-request |

Cost data is aggregated and published to the FinOps dashboard. Per-tenant cost allocation enables tenant-level billing. Per-agent cost tracking enables agent efficiency comparisons.

### Token Budgets

Each service, agent, and tenant has a configurable token budget per billing period (daily, weekly, monthly). The ai-gateway enforces budgets and returns a `429 Token Budget Exceeded` error when a budget is exhausted. Budget exhaustion triggers an alert to the FinOps reviewer.

## Provider Adapters

Each AI provider has an adapter implementing the `AIProvider` interface:

```typescript
interface AIProvider {
  name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  stream(request: ChatRequest): AsyncIterable<ChatChunk>;
  healthCheck(): Promise<ProviderHealth>;
}
```

### Supported Providers

| Provider     | Adapter                | Models                     | Use Case                                  |
| ------------ | ---------------------- | -------------------------- | ----------------------------------------- |
| Anthropic    | `anthropic-adapter.ts` | Claude Opus, Sonnet, Haiku | Primary reasoning, clinical documentation |
| OpenAI       | `openai-adapter.ts`    | GPT-4o, GPT-4o-mini        | Fallback reasoning, specialized tasks     |
| Google       | `google-adapter.ts`    | Gemini Pro, Gemini Flash   | Cost-optimized classification             |
| Local vLLM   | `vllm-adapter.ts`      | Fine-tuned clinical models | ICD coding, PHI-sensitive tasks           |
| Local Ollama | `ollama-adapter.ts`    | Open-source models         | Development, testing, offline scenarios   |

### Provider-Specific Features

The abstraction supports a `rawOptions` escape hatch for provider-specific features that cannot be abstracted:

```typescript
const response = await aiClient.chat({
  messages: [...],
  rawOptions: {
    anthropic: { thinking: { type: 'enabled', budgetTokens: 10000 } },
    openai: { response_format: { type: 'json_schema', ... } },
  },
});
```

Only the `rawOptions` for the selected provider are forwarded; all others are ignored. Using `rawOptions` is discouraged and must be justified in code review.
