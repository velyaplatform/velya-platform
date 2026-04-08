---
name: setup-naming-taxonomy
description: Validate naming conventions against the Velya naming taxonomy
---

# Setup Naming Taxonomy Validation

Validate that files, directories, services, and resources across the platform follow the naming conventions defined in `docs/product/naming-taxonomy.md` and `.claude/rules/naming.md`.

## When to Use

Use this skill when asked to validate naming, check naming conventions, audit names, or enforce the naming taxonomy.

## Validation Rules

### File and Directory Names

**Rule**: All files and directories use `kebab-case`.

**Check**:

- Scan all directories under `services/`, `apps/`, `packages/`, `agents/`, `infra/`, `platform/`
- Flag names containing uppercase letters, underscores, or spaces
- Exceptions: `SECURITY.md`, `CLAUDE.md`, `README.md`, `LICENSE`, `Dockerfile`, `Makefile`, `.gitignore`, `node_modules/`, configuration files that require specific casing (e.g., `tsconfig.json`, `Dockerfile`, `.eslintrc.js`)

**Examples**:

- `patient-flow-handler.ts` (correct)
- `patientFlowHandler.ts` (incorrect -- should be kebab-case)
- `PatientFlow/` (incorrect -- should be `patient-flow/`)

### Service Names

**Rule**: Services follow `velya-{domain}-{responsibility}` pattern.

**Check**:

- Scan `services/` directories
- Each top-level directory under `services/` should match the pattern
- The domain should correspond to a term in `docs/product/domain-lexicon.md`

**Examples**:

- `velya-patient-flow` (correct)
- `velya-discharge-orchestrator` (correct)
- `patient-service` (incorrect -- missing `velya-` prefix, too generic)
- `velya-svc-patient` (incorrect -- abbreviation, wrong order)

### Package Names

**Rule**: Packages follow `@velya/{package-name}` pattern.

**Check**:

- Read `package.json` files under `packages/`
- Verify the `name` field starts with `@velya/`

**Examples**:

- `@velya/ui-components` (correct)
- `@velya/event-schemas` (correct)
- `event-schemas` (incorrect -- missing `@velya/` scope)

### Kubernetes Namespace Names

**Rule**: Namespaces follow `velya-{env}-{domain}` pattern.

**Check**:

- Scan Kubernetes manifest files and Helm values for namespace declarations
- Env must be one of: `dev`, `staging`, `prod`
- Domain should be one of: `core`, `agents`, `data`, `observability`, `security`, `infra`, `platform`

**Examples**:

- `velya-prod-core` (correct)
- `velya-dev-agents` (correct)
- `production` (incorrect -- not following pattern)

### Agent Names

**Rule**: Agents follow `{office}-{role}-agent` pattern.

**Check**:

- Scan directories under `agents/`
- Agent directory names should end with `-agent`
- Office should match one of the 22 offices in the org chart

**Examples**:

- `security-office-reviewer-agent` (correct)
- `quality-office-test-agent` (correct)
- `code-reviewer` (incorrect -- missing office and `-agent` suffix)

### Helm Chart Names

**Rule**: Charts follow `velya-{service}` pattern.

**Check**:

- Scan `Chart.yaml` files under `infra/helm/charts/`
- Verify the `name` field follows the pattern

### OpenTofu Module Names

**Rule**: Modules follow `velya-{resource}` pattern.

**Check**:

- Scan directory names under `infra/tofu/modules/`

### Event Names

**Rule**: Events follow `velya.{domain}.{entity}.{action}` pattern.

**Check**:

- Scan event schema files under `packages/event-schemas/`
- Search for event name string literals in source code
- Actions should use past tense

**Examples**:

- `velya.patient.discharge.blocked` (correct)
- `patient-discharge-blocked` (incorrect -- wrong separator, not past tense)

### API Paths

**Rule**: API paths follow `/api/v1/{domain}/{resource}` pattern.

**Check**:

- Scan route definitions in service code
- Search for Express/Fastify route registrations
- Verify paths are versioned and domain-scoped

### Database Table Names

**Rule**: Tables follow `{domain}_{entity}` pattern using `snake_case`.

**Check**:

- Scan migration files for `CREATE TABLE` statements
- Scan ORM model definitions

### Feature Flag Names

**Rule**: Flags follow `velya.{domain}.{feature}` pattern.

**Check**:

- Search for feature flag references in code
- Verify dot-separated naming

### TypeScript Naming

**Rule**: Types/interfaces use PascalCase, variables/functions use camelCase, constants use SCREAMING_SNAKE_CASE.

**Check**:

- Search for exported type/interface declarations and verify PascalCase
- This is best checked by ESLint rules rather than manual scanning, so verify ESLint config includes naming convention rules

## Output Format

```markdown
## Naming Taxonomy Validation Report

**Date**: {today's date}

### Summary

| Category            | Total Checked | Violations | Status      |
| ------------------- | ------------- | ---------- | ----------- |
| Files & Directories | {n}           | {n}        | {PASS/FAIL} |
| Services            | {n}           | {n}        | {PASS/FAIL} |
| Packages            | {n}           | {n}        | {PASS/FAIL} |
| Namespaces          | {n}           | {n}        | {PASS/FAIL} |
| Agents              | {n}           | {n}        | {PASS/FAIL} |
| Helm Charts         | {n}           | {n}        | {PASS/FAIL} |
| OpenTofu Modules    | {n}           | {n}        | {PASS/FAIL} |
| Events              | {n}           | {n}        | {PASS/FAIL} |
| API Paths           | {n}           | {n}        | {PASS/FAIL} |
| Database Tables     | {n}           | {n}        | {PASS/FAIL} |
| Feature Flags       | {n}           | {n}        | {PASS/FAIL} |

### Violations

| #   | Category   | Current Name | Expected Name   | Location    |
| --- | ---------- | ------------ | --------------- | ----------- |
| 1   | {category} | {current}    | {suggested fix} | {file path} |
```

## Rules

- Skip `node_modules/`, `.git/`, `dist/`, `build/`, and other generated directories.
- Skip files that must have specific names (e.g., `Dockerfile`, `Makefile`, `tsconfig.json`).
- For each violation, provide the current name and a suggested corrected name.
- If a category has no items to check (e.g., no agents directory exists yet), note it as N/A rather than PASS.
- Reference `docs/product/naming-taxonomy.md` for the authoritative naming rules.
