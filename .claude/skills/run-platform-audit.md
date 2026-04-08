---
name: run-platform-audit
description: Audit current platform state across infrastructure, security, quality, and naming conventions
---

# Run Platform Audit

Perform a comprehensive audit of the Velya platform's current state, checking infrastructure configuration, security posture, code quality, and naming convention compliance.

## When to Use

Use this skill when asked to audit the platform, check platform health, verify compliance with standards, or perform a platform review.

## Audit Sections

### 1. Naming Convention Audit

Check all artifacts against the naming taxonomy in `docs/product/naming-taxonomy.md`.

**Checks**:

- Directory names use `kebab-case`
- TypeScript files use `kebab-case`
- Services follow `velya-{domain}-{responsibility}` pattern
- Kubernetes namespaces follow `velya-{env}-{domain}` pattern
- Helm charts follow `velya-{service}` pattern
- Agent directories follow `{office}-{role}-agent` pattern
- Database tables follow `{domain}_{entity}` pattern (check migration files)
- Event names follow `velya.{domain}.{entity}.{action}` pattern (check event schema files)
- Feature flags follow `velya.{domain}.{feature}` pattern

**How to check**:

- Scan directory structure under `services/`, `agents/`, `apps/`, `packages/`
- Scan Helm chart names under `infra/helm/charts/`
- Scan OpenTofu module names under `infra/tofu/modules/`
- Scan Kubernetes manifest files for namespace and resource names
- Report violations with the expected name and a suggested correction

### 2. Infrastructure Audit

Verify infrastructure follows the rules in `.claude/rules/infrastructure.md`.

**Checks**:

- All OpenTofu modules in `infra/tofu/modules/` have pinned provider versions
- No floating version constraints (`~>`, `>=`) in `required_providers`
- All AWS resources have required tags (Project, Environment, ManagedBy, Owner, CostCenter)
- Helm charts have value files per environment (`values-dev.yaml`, `values-staging.yaml`, `values-prod.yaml`)
- All Kubernetes deployments have resource requests and limits
- PodDisruptionBudgets exist for critical workloads
- No hardcoded AWS account IDs

**How to check**:

- Read OpenTofu files (`*.tf`) and check `required_providers` blocks
- Search for missing `tags` blocks in resource definitions
- Read Helm `values-*.yaml` files and check for `resources:` sections
- Search for raw AWS account ID patterns (12-digit numbers) outside of variable references

### 3. Security Audit

Verify security posture per `.claude/rules/security.md` and `docs/security/`.

**Checks**:

- No secrets in code (AWS keys, API tokens, passwords, private keys)
- GitHub Actions pinned by SHA (not by mutable tag)
- Container images pinned by digest in Dockerfiles
- Containers run as non-root (`runAsNonRoot: true`)
- Read-only root filesystem where possible
- All capabilities dropped
- Network policies exist for all namespaces
- No wildcard resource ARNs in IAM policies
- `automountServiceAccountToken: false` by default
- No `latest` image tags

**How to check**:

- Use `run-security-audit` skill patterns for detailed secret scanning
- Search `*.yaml` and `*.yml` files under `.github/workflows/` and `infra/github-actions/` for unpinned actions
- Search Dockerfiles for unpinned base images
- Search Helm values and Kubernetes manifests for security context settings
- Search IAM policy files for `"Resource": "*"`

### 4. Quality Audit

Verify quality standards per `.claude/rules/quality.md`.

**Checks**:

- Test files exist alongside source files (`*.test.ts` next to `*.ts`)
- ESLint config extends shared config from `packages/eslint-config/`
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- No `any` types (search for `: any` in TypeScript files)
- No `eslint-disable` without explanatory comments
- No `@ts-ignore` (should use `@ts-expect-error` with explanation)
- `package-lock.json` exists and is committed
- No unused dependencies (check for imports matching package.json entries)

**How to check**:

- For each `.ts` file under `services/` and `packages/`, check for a corresponding `.test.ts`
- Read `tsconfig.json` files and verify `strict: true`
- Search for `: any` patterns in TypeScript files
- Search for `eslint-disable` without adjacent comments
- Search for `@ts-ignore`

### 5. Architecture Audit

Verify architectural rules per `.claude/rules/architecture.md`.

**Checks**:

- Services do not import directly from other services (no shared databases)
- AI access goes through `packages/ai-gateway/` (no direct LLM SDK imports in services)
- Event schemas defined in `packages/event-schemas/`
- Temporal workflows are deterministic (no side effects in workflow code)
- Anti-corruption layers exist for external integrations
- No synchronous chains longer than 3 services (check for nested HTTP calls)
- Structured logging only (no `console.log` in `services/` or `packages/`)

**How to check**:

- Search for direct imports of `@anthropic-ai/sdk`, `openai`, or other LLM SDKs in `services/`
- Search for `console.log`, `console.error`, `console.warn` in `services/` and `packages/`
- Check that `services/integrations/` contains ACL patterns

### 6. Documentation Audit

Check documentation completeness and freshness.

**Checks**:

- ADRs exist in `docs/architecture/decisions/`
- Each service has a README or doc entry
- API specs (OpenAPI) exist for services with HTTP endpoints
- Runbooks exist for critical services
- Domain lexicon is up to date with terms used in code

## Output Format

```markdown
## Platform Audit Report

**Date**: {today's date}
**Auditor**: Claude Code

### Summary

| Section        | Status           | Findings       |
| -------------- | ---------------- | -------------- |
| Naming         | {PASS/WARN/FAIL} | {count} issues |
| Infrastructure | {PASS/WARN/FAIL} | {count} issues |
| Security       | {PASS/WARN/FAIL} | {count} issues |
| Quality        | {PASS/WARN/FAIL} | {count} issues |
| Architecture   | {PASS/WARN/FAIL} | {count} issues |
| Documentation  | {PASS/WARN/FAIL} | {count} issues |

### Findings

#### Critical (must fix immediately)

1. {finding}

#### High (fix before next release)

1. {finding}

#### Medium (fix within sprint)

1. {finding}

#### Low (track and address)

1. {finding}

### Recommendations

1. {top priority recommendation}
2. {second priority recommendation}
```

## Rules

- Run all sections unless the user requests a specific subset.
- Be thorough but do not generate false positives. Only report genuine violations.
- For each finding, include the file path, line number (if applicable), what is wrong, and how to fix it.
- Distinguish between violations of mandatory rules and recommended practices.
- If a section has no findings, report it as PASS with a note that no issues were found.
- Sort findings by severity (Critical > High > Medium > Low).
