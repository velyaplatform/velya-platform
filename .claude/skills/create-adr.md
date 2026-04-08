---
name: create-adr
description: Create a new Architecture Decision Record
---

# Create ADR

## Steps
1. Find the next ADR number by checking existing files in docs/adr/
2. Create a new file: docs/adr/{number}-{kebab-case-title}.md
3. Use the standard template:

```markdown
# ADR-{number}: {Title}

## Status
Proposed

## Date
{today's date}

## Context
{Why this decision is needed}

## Decision
{What we decided}

## Consequences

### Positive
- 

### Negative
- 

### Risks
- 

## Alternatives Considered
- 
```

4. Link the ADR from relevant documentation if applicable
