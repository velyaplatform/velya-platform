# ADR-0010: AI Abstraction Layer for Provider Independence

## Status
Accepted

## Date
2026-04-08

## Context
The AI landscape is evolving rapidly, with new model providers, architectures, and pricing structures emerging continuously. Velya's AI agents and clinical decision support features depend on LLM capabilities (text generation, structured output, embeddings, function calling) that are currently offered by multiple providers (Anthropic, OpenAI, Google, open-source models). Hard-coding to a single provider's API creates vendor lock-in, prevents cost optimization through provider switching, and makes it impossible to run specialized models for different tasks (e.g., a clinical coding model vs. a general reasoning model).

## Decision
We will build an AI abstraction layer (`packages/ai-core/`) that provides a unified interface for all AI operations: text generation, structured output, embeddings, function/tool calling, and streaming. The abstraction defines provider-agnostic interfaces (`AIProvider`, `ChatCompletion`, `EmbeddingProvider`, `ToolCallResult`) and implements adapters for each provider (Anthropic Claude, OpenAI GPT, Google Gemini, local models via Ollama/vLLM). Provider selection is configuration-driven, supporting per-agent and per-task routing. The abstraction also provides middleware for token tracking, cost accounting, rate limiting, and response caching.

## Consequences

### Positive
- Provider independence enables switching or A/B testing models without changing application code
- Per-task routing allows using the best model for each job (e.g., Claude for clinical reasoning, a fine-tuned model for ICD coding)
- Centralized token tracking and cost accounting provide visibility into AI spend across all agents and services
- Middleware layer enables consistent guardrails (PII filtering, output validation) regardless of provider

### Negative
- Abstraction overhead: not all provider features can be abstracted cleanly (e.g., Anthropic's extended thinking, OpenAI's vision API specifics)
- Maintaining adapters for multiple providers requires ongoing engineering investment as provider APIs evolve

### Risks
- Lowest-common-denominator abstraction may prevent using advanced provider-specific features
- Mitigation: Support a provider-specific escape hatch (`rawOptions`) that passes through provider-native parameters, and use feature flags to gate provider-specific capabilities

## Alternatives Considered
- **Direct provider SDK usage**: Rejected because scattering provider-specific code across agents and services creates migration nightmares and prevents centralized cost/token tracking
- **LangChain / LlamaIndex**: Rejected because these frameworks impose their own abstractions, dependency trees, and upgrade cadences; a purpose-built thin abstraction gives us full control and avoids framework lock-in
- **Vercel AI SDK**: Considered but rejected as too opinionated toward frontend streaming use cases; Velya's AI abstraction must serve backend agents and workflow activities equally
