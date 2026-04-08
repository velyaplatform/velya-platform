---
name: create-adr
description: Create a new Architecture Decision Record with proper template and numbering
---

# Create ADR

Create a new Architecture Decision Record following the Velya ADR format and numbering convention.

## When to Use

Use this skill when asked to create an ADR, record an architectural decision, or document a technical decision.

## Process

1. **Determine the next ADR number**: Look in `docs/architecture/decisions/` for existing ADRs. Find the highest numbered file and increment by 1. If no ADRs exist yet, start at `001`. Numbers are zero-padded to 3 digits.

2. **Generate the filename**: Use the pattern `{number}-{kebab-case-title}.md`. Example: `005-use-nats-for-event-backbone.md`. The title should describe the decision, not the problem.

3. **Write the ADR** using the template below. Fill in all sections with substantive content based on the user's input. If the context, alternatives, or consequences are unclear, ask clarifying questions before writing.

4. **Save the file** to `docs/architecture/decisions/{filename}`.

5. **Report** the file path and a one-sentence summary of the decision.

## ADR Template

```markdown
# {NUMBER}. {Title}

**Status**: proposed

**Date**: {YYYY-MM-DD}

**Decision Makers**: {who was involved}

## Context

{Describe the situation and the problem that needs to be addressed. Include relevant technical constraints, business requirements, and any forces at play. Be specific about what is driving the need for a decision. Reference existing ADRs if this builds on or supersedes them.}

## Decision

{State the decision clearly in active voice: "We will use X" not "X was chosen." Include enough detail that someone unfamiliar with the discussion can understand what was decided and how it will be implemented.}

## Alternatives Considered

### {Alternative 1 name}

{Description of the alternative.}

**Pros**: {advantages}

**Cons**: {disadvantages}

**Why not chosen**: {specific reason}

### {Alternative 2 name}

{Description of the alternative.}

**Pros**: {advantages}

**Cons**: {disadvantages}

**Why not chosen**: {specific reason}

## Consequences

### Positive

- {Benefit 1}
- {Benefit 2}

### Negative

- {Tradeoff 1}
- {Tradeoff 2}

### Risks

- {Risk 1}: {mitigation strategy}
- {Risk 2}: {mitigation strategy}

## Implementation

{Brief description of what needs to happen to implement this decision. Include any migration steps if this changes existing behavior.}

## References

- {Links to relevant documentation, RFCs, prior art, or external resources}
```

## Rules

- ADR status starts as `proposed` unless the user explicitly says it should be `accepted`.
- Use today's date unless a specific date is provided.
- Do not leave any section as a placeholder or with generic text. If information is missing, ask the user before creating the file.
- Keep the title concise but descriptive (under 60 characters). It should describe the decision, not the problem.
- Include at least 2 alternatives considered. "Do nothing" or "status quo" counts as one.
- Consequences must include both positive and negative outcomes.
- Reference the naming taxonomy at `docs/product/naming-taxonomy.md` if the decision involves naming.
- Reference existing ADRs if this decision relates to or supersedes a prior decision.
- After creating the ADR, mention if any existing documentation should be updated to reference it.
