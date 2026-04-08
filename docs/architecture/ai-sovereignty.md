# AI Sovereignty & Provider Independence

> Velya's AI strategy is built on the principle that no single AI provider should be a single point of failure or a source of vendor lock-in. This document describes the abstraction strategy, model routing, provider independence, and the path toward self-hosted models.

---

## Principles

1. **Provider independence**: The platform must function with any major LLM provider. Switching providers should require configuration changes, not code changes.
2. **Graceful degradation**: If a provider is unavailable, the system degrades gracefully -- falling back to alternative providers, cached responses, or human-in-the-loop workflows.
3. **Cost optimization**: Route requests to the most cost-effective model that meets quality requirements.
4. **Data sovereignty**: PHI and sensitive data must never leave controlled environments. Self-hosted models are the long-term path for sensitive workloads.
5. **Auditability**: Every AI interaction is logged with provider, model, token usage, latency, and cost.

---

## Architecture: The AI Gateway

The AI Gateway (`velya-ai-gateway`) is the single point of contact for all AI interactions in the platform. No service or agent calls an LLM provider directly.

```
+------------------+     +------------------+     +-------------------+
|  Service / Agent |---->|   AI Gateway     |---->|  Provider Adapter |---> Provider API
|                  |     |  (velya-ai-gw)   |     |  (Anthropic)      |
+------------------+     |                  |     +-------------------+
                         |  - Auth & Quota  |     +-------------------+
                         |  - Routing       |---->|  Provider Adapter |---> Provider API
                         |  - Fallback      |     |  (OpenAI)         |
                         |  - Caching       |     +-------------------+
                         |  - Logging       |     +-------------------+
                         |  - Rate Limiting |---->|  Provider Adapter |---> Provider API
                         |                  |     |  (AWS Bedrock)    |
                         +------------------+     +-------------------+
                                                  +-------------------+
                                            +---->|  Self-Hosted      |---> Local GPU
                                                  |  (vLLM/Ollama)   |
                                                  +-------------------+
```

### Gateway Responsibilities

1. **Authentication & Authorization**: Validate that the calling service/agent has permission to use the requested model tier.
2. **Request Routing**: Route to the appropriate provider and model based on the routing policy.
3. **Fallback**: Automatically retry with a fallback provider if the primary is unavailable or returns an error.
4. **Rate Limiting**: Enforce per-service and per-agent rate limits to prevent runaway costs.
5. **Caching**: Cache responses for idempotent queries (e.g., embeddings, classification) with configurable TTL.
6. **Logging**: Log every request/response with metadata (provider, model, tokens, latency, cost) for auditing and cost tracking.
7. **Prompt Management**: Inject system-level instructions (safety guardrails, output format constraints) transparently.

---

## Provider Adapter Interface

Every provider is accessed through a standard adapter interface. Adding a new provider means implementing this interface.

```typescript
interface AIProviderAdapter {
  readonly providerId: string;
  readonly supportedModels: ModelInfo[];

  chat(request: ChatRequest): Promise<ChatResponse>;
  chatStream(request: ChatRequest): AsyncIterable<ChatChunk>;
  embed(request: EmbedRequest): Promise<EmbedResponse>;
  healthCheck(): Promise<HealthStatus>;
}

interface ChatRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tools?: ToolDefinition[];
  metadata: RequestMetadata; // trace ID, caller, priority
}

interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  latencyMs: number;
  provider: string;
  model: string;
}
```

---

## Model Routing

Requests are routed based on a routing policy that considers task type, quality requirements, cost budget, and data sensitivity.

### Model Tiers

| Tier | Use Case | Example Models | Cost |
|---|---|---|---|
| **Tier 1: Frontier** | Complex reasoning, multi-step planning, code generation, architecture decisions | Claude Opus, GPT-4o | High |
| **Tier 2: Balanced** | Standard chat, summarization, structured extraction, most agent tasks | Claude Sonnet, GPT-4o-mini | Medium |
| **Tier 3: Fast** | Classification, simple extraction, routing decisions, low-latency needs | Claude Haiku, GPT-4o-mini | Low |
| **Tier 4: Embedding** | Vector search, semantic similarity, retrieval | text-embedding-3-large, Cohere embed | Lowest |
| **Tier 5: Self-Hosted** | PHI processing, high-volume batch, cost-sensitive workloads | Llama 3, Mistral (via vLLM) | Infrastructure only |

### Routing Rules

```yaml
routing_rules:
  - name: phi-processing
    condition: "request.metadata.containsPHI == true"
    route: self-hosted
    fallback: none  # PHI must never leave controlled infra

  - name: complex-reasoning
    condition: "request.metadata.tier == 'frontier'"
    route: [anthropic/claude-opus, openai/gpt-4o]
    fallback: anthropic/claude-sonnet

  - name: standard-agent-work
    condition: "request.metadata.tier == 'balanced'"
    route: [anthropic/claude-sonnet, openai/gpt-4o-mini]
    fallback: anthropic/claude-haiku

  - name: classification
    condition: "request.metadata.tier == 'fast'"
    route: [anthropic/claude-haiku, openai/gpt-4o-mini]
    fallback: self-hosted/llama3

  - name: embedding
    condition: "request.type == 'embed'"
    route: [openai/text-embedding-3-large]
    fallback: self-hosted/bge-large
```

### Routing Decision Flow

1. Check data sensitivity. If PHI, route to self-hosted only.
2. Check caller's quota. If budget exhausted, reject or downgrade tier.
3. Check primary provider health. If unhealthy, skip to fallback.
4. Route to primary provider.
5. If primary fails (timeout, 5xx, rate limit), retry once, then fall back.
6. Log routing decision and outcome.

---

## Fallback Strategy

```
Primary Provider
    |
    v (fail)
Retry Primary (1x with backoff)
    |
    v (fail)
Secondary Provider
    |
    v (fail)
Tertiary Provider / Self-Hosted
    |
    v (fail)
Degrade: Return cached response, or escalate to human
```

**Failure modes handled**:
- Provider API timeout (30s default)
- Provider rate limiting (429)
- Provider server error (500/502/503)
- Provider content filtering (response blocked)
- Network connectivity loss

---

## Self-Hosted Path

The long-term vision is to run a significant portion of AI workloads on self-hosted infrastructure. This is driven by three factors:

1. **PHI compliance**: Sensitive patient data cannot be sent to third-party APIs without complex BAA arrangements.
2. **Cost at scale**: At high volume, self-hosted models are significantly cheaper per token.
3. **Latency**: Self-hosted models in the same region/VPC have lower latency.

### Self-Hosted Architecture

```
+-------------------+     +-------------------+     +-------------------+
|   AI Gateway      |---->|   vLLM Cluster    |---->|   GPU Nodes       |
|                   |     |   (K8s pods)      |     |   (g5.xlarge+)    |
+-------------------+     +-------------------+     +-------------------+
                          |   - Model serving |
                          |   - Auto-scaling  |
                          |   - Health checks |
                          +-------------------+
```

### Phased Rollout

| Phase | Timeline | Scope |
|---|---|---|
| Phase 1 | Current | All workloads use cloud providers via AI Gateway |
| Phase 2 | Q3 2026 | Embeddings move to self-hosted (low risk, high volume) |
| Phase 3 | Q4 2026 | Classification and simple extraction move to self-hosted |
| Phase 4 | Q1 2027 | PHI-containing workloads move to self-hosted |
| Phase 5 | Q2 2027 | Balanced-tier agent workloads partially move to self-hosted |

### Self-Hosted Model Selection Criteria

- Open-weight license permitting commercial healthcare use
- Performance within 10% of cloud provider equivalent on Velya-specific benchmarks
- Fits within available GPU memory (target: single A10G for balanced tier)
- Active community and regular updates

---

## Cost Management

### Budget Controls

- Per-agent daily token budgets enforced at the AI Gateway
- Per-service monthly cost caps with alerting at 80% threshold
- Automatic tier downgrade when budget is exhausted (frontier to balanced, balanced to fast)
- Dashboard showing real-time cost by service, agent, and provider

### Cost Tracking

Every AI Gateway response includes cost metadata:

```json
{
  "cost": {
    "inputTokens": 1500,
    "outputTokens": 800,
    "inputCostUsd": 0.00225,
    "outputCostUsd": 0.0024,
    "totalCostUsd": 0.00465,
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514"
  }
}
```

---

## Security & Compliance

1. **No PHI to external providers**: Enforced at the AI Gateway routing layer. Requests tagged with `containsPHI: true` are only routed to self-hosted models.
2. **Prompt injection defense**: The AI Gateway injects safety preambles and validates outputs against known attack patterns.
3. **Audit logging**: All prompts and responses are logged (with PHI redacted in logs) and retained per compliance policy.
4. **API key rotation**: Provider API keys are stored in AWS Secrets Manager and rotated every 90 days via automated rotation.
5. **Network isolation**: Self-hosted model endpoints are only accessible within the VPC, not from the public internet.
