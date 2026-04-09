# AI Safety Rules

## AI Abstraction Layer is Mandatory

No service or agent may call LLM APIs directly.
All AI access goes through `packages/ai-gateway/`, which provides:
- Provider routing and fallback
- Rate limiting and cost tracking
- Request/response logging with PHI redaction
- Model version pinning
- Prompt injection detection
- Output validation

**Violation of this rule is a security incident, not a code review comment.**

## Prompt Injection Prevention

All inputs that flow into AI contexts must be sanitized before inclusion.
This includes:

| Input Source | Risk | Required Control |
|---|---|---|
| User text input | Direct injection | Input sanitization + output validation |
| Patient records (EHR/FHIR) | Indirect injection | Structured extraction, not raw text passthrough |
| Clinical notes | Indirect injection | Field-level extraction, PII-aware parsing |
| NATS event payloads | Indirect injection | Schema validation before context inclusion |
| Web search results (market intelligence) | Indirect injection | Sandboxed context, no action based on raw result |
| Runbook content | Indirect injection | Treat as untrusted until validated |
| External documents | Indirect injection | Maximum sandboxing, no action authority |
| Agent-to-agent messages | Indirect injection | Validate against schema, no raw passthrough |

Controls are defined in detail in `docs/risk/prompt-injection-controls.md`.

## Output Validation

Every AI output that drives an action must be validated before the action is executed.
Validation requirements by risk class:

| Risk Class | Validation Required |
|---|---|
| Low | Schema validation only |
| Medium | Schema + semantic validation |
| High | Schema + semantic + independent agent review |
| Critical | Schema + semantic + two independent reviews + human approval |
| Clinical | Above + clinical safety check + documented rationale |

## Excessive Agency Prevention

No agent may:
- Execute infrastructure changes without human approval (production)
- Modify clinical records without human approval
- Send external communications without human approval
- Modify its own permissions, scope, or contract
- Create other agents without Agent Factory process
- Access PHI beyond its defined data scope
- Execute financial transactions autonomously

If an agent attempts an action outside its `allowed_actions`, the action must be:
1. Blocked immediately
2. Logged with full context
3. Escalated to the agent's manager
4. Reviewed by the Red Team Office if it's a repeat

## AI Confidence and Explainability

Every AI recommendation presented to a clinician or operator must include:
- Confidence level (expressed as percentage or categorical: Low/Medium/High)
- Primary evidence used to reach the conclusion
- Key assumptions made
- Data recency (timestamp of the most recent data used)
- Alternative conclusions considered
- What would change the recommendation

AI recommendations presented without these fields are a patient safety failure.

## Fallback Behavior

Every AI-assisted workflow must define safe behavior when the AI is unavailable:
- What manual process can substitute
- What information the human needs to make the decision manually
- What the system should display during AI degradation
- Maximum time before AI degradation becomes a clinical safety issue

Fallback behavior must be tested. An untested fallback is not a fallback.

## Model Version Policy

- Model versions are pinned in the AI gateway configuration
- No automatic model version upgrades
- Model version changes require: testing, shadow comparison, gradual rollout
- Model version changes that affect clinical decisions require clinical safety review

## PHI in AI Contexts

PHI must be minimized in every AI context:
- Only include the PHI fields required for the specific task
- De-identify where the task can be completed without identifying the patient
- Never include PHI in prompts sent to external AI providers without legal review
- Never log AI prompts or responses that contain PHI in unmasked form
- Audit every PHI field accessed by every AI call

See `docs/risk/data-minimization-model.md` for field-level minimization rules.

## MCP and Tool Trust

MCP servers and tools are classified by trust tier:
- Tier 0 (Read-only, internal): Minimal review, standard logging
- Tier 1 (Write, internal): Validation required before each action
- Tier 2 (Write, external): Human approval required, full audit trail
- Tier 3 (Irreversible): Explicit approval + human review + rollback plan
- Tier 4 (Clinical impact): Clinical safety review + documented rationale

No tool may be added to an agent's tool set without going through the trust classification process.
Full model defined in `docs/risk/mcp-and-tool-trust-model.md`.

## Autonomous Operation Prohibition (Clinical)

No AI agent may autonomously:
- Modify or create clinical orders
- Discharge or admit patients
- Modify medication schedules
- Override clinical alerts
- Certify clinical documentation
- Take any irreversible clinical action

These actions require human authorization. The AI role is advisory only.

## Agent Self-Improvement Prohibition

No agent may:
- Modify its own rules, constraints, or scope
- Approve its own learning propagation
- Promote its own lifecycle stage
- Update its own scorecard metrics or thresholds
- Override its own validation or audit requirements

All self-improvement proposals go through the Learning Office and require:
- Evidence that the improvement is correct
- Validation from an independent agent
- Audit before propagation
