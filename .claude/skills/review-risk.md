---
name: review-risk
description: Assess risk of a proposed change
---

# Review Risk

## Process
1. Identify the change scope (files, services, infrastructure affected)
2. Classify by domain: security, availability, data integrity, cost, compliance
3. Assess blast radius: local, service, cross-service, platform-wide
4. Determine reversibility: easily reversible, hard to reverse, irreversible
5. Check for: breaking changes, data loss potential, security implications, cost impact

## Risk Matrix
- **Low**: Local change, easily reversible, no security/data impact → auto-approve
- **Medium**: Cross-service, reversible with effort, minor security consideration → peer review
- **High**: Platform-wide, hard to reverse, security/data/cost impact → senior review + ADR
- **Critical**: Infrastructure, IAM, production data, irreversible → break-glass + multi-approval

## Output
Produce a risk assessment with:
- Risk level (low/medium/high/critical)
- Affected areas
- Blast radius
- Reversibility
- Mitigations required
- Approval chain needed
