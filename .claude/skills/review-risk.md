---
name: review-risk
description: Assess risk of a proposed change across security, availability, cost, and compliance dimensions
---

# Review Risk

Assess the risk of a proposed change to determine the appropriate approval level and required mitigations.

## When to Use

Use this skill when asked to assess the risk of a change, review a proposal for safety, determine if a change needs an ADR, or evaluate the blast radius of a modification.

## Process

### Step 1: Identify Change Scope

Examine the proposed change and identify:
- **Files changed**: List all files modified, added, or deleted
- **Services affected**: Which services are directly modified
- **Downstream dependencies**: Which services consume the changed service's APIs or events
- **Infrastructure affected**: Any changes to OpenTofu, Helm charts, Kubernetes manifests, or CI/CD
- **Data affected**: Any database schema changes, migration scripts, or data transformations

### Step 2: Classify by Risk Domain

Evaluate the change against each risk domain:

| Domain | What to Check |
|---|---|
| **Security** | IAM changes, auth logic, secret handling, network policies, dependency updates, input validation, encryption, CORS |
| **Availability** | Breaking API changes, database migrations, deployment strategy, resource limits, health checks, circuit breakers |
| **Data Integrity** | Schema changes, migration safety, backup/restore, data loss potential, FHIR resource modifications |
| **Cost** | New infrastructure resources, AI/LLM API usage changes, scaling configuration, new cloud services |
| **Compliance** | PHI handling, HIPAA implications, audit trail changes, logging changes, access control modifications |
| **Agent Impact** | Changes to agent prompts, tool access, autonomy levels, inter-agent communication |

### Step 3: Assess Blast Radius

| Radius | Description |
|---|---|
| **Local** | Change is contained within a single function, component, or file |
| **Service** | Change affects a single service but not its external interfaces |
| **Cross-service** | Change affects APIs, events, or contracts consumed by other services |
| **Platform-wide** | Change affects shared infrastructure, platform services, or organizational policies |

### Step 4: Determine Reversibility

| Level | Description | Examples |
|---|---|---|
| **Instant** | Can be reverted with a single git revert, no side effects | Code changes, config changes behind feature flags |
| **Minutes** | Can be reverted within minutes with a redeployment | Non-breaking API changes, UI changes |
| **Hours** | Requires coordinated rollback across multiple services | Breaking API changes with versioning |
| **Difficult** | Requires data migration or manual intervention to reverse | Database schema changes, data transformations |
| **Irreversible** | Cannot be reversed | Data deletion, external system state changes |

### Step 5: Determine Risk Level

| Risk Level | Criteria | Required Actions |
|---|---|---|
| **R0 - Negligible** | Local scope, instant reversibility, no security/data/cost impact | Standard CI, auto-merge eligible |
| **R1 - Low** | Service scope, minutes to reverse, no breaking changes | 1 PR review |
| **R2 - Moderate** | Service scope, hours to reverse, new API/table/flag | 1 PR review + relevant office review |
| **R3 - High** | Cross-service scope, difficult to reverse, security/data/cost impact | 2 PR reviews + ADR + detailed test plan |
| **R4 - Critical** | Platform-wide scope, difficult or irreversible, production data/infra/IAM | Executive Director approval + ADR + rollback plan |
| **R5 - Existential** | Threatens platform viability, irreversible, PHI exposure risk | Governance Council + external review |

## Output Format

Produce a risk assessment report with the following structure:

```markdown
## Risk Assessment: {Brief description of the change}

### Summary
- **Risk Level**: {R0-R5} - {label}
- **Blast Radius**: {Local/Service/Cross-service/Platform-wide}
- **Reversibility**: {Instant/Minutes/Hours/Difficult/Irreversible}

### Risk Domain Analysis

| Domain | Risk | Notes |
|---|---|---|
| Security | {None/Low/Medium/High/Critical} | {explanation} |
| Availability | {None/Low/Medium/High/Critical} | {explanation} |
| Data Integrity | {None/Low/Medium/High/Critical} | {explanation} |
| Cost | {None/Low/Medium/High/Critical} | {explanation} |
| Compliance | {None/Low/Medium/High/Critical} | {explanation} |
| Agent Impact | {None/Low/Medium/High/Critical} | {explanation} |

### Affected Components
- {list of affected services, files, infrastructure}

### Required Mitigations
1. {mitigation 1}
2. {mitigation 2}

### Required Approvals
- {who needs to approve, per the decision-rights matrix}

### Recommendations
- {specific recommendations for reducing risk}
```

## Rules

- Always check `docs/org/decision-rights.md` to determine the correct approval chain for the assessed risk level.
- If a change touches security-sensitive areas (IAM, auth, secrets, encryption), automatically elevate the risk by at least one level.
- Database schema changes that drop or rename columns are always R3 or higher.
- Changes to production infrastructure are always R3 or higher.
- Changes that affect PHI handling are always R4 or higher.
- If uncertain about the risk level, err on the side of a higher assessment.
- Provide actionable mitigations, not just a risk rating.
