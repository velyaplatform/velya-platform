# Naming Governance Model

## Overview

The Naming Governance Model defines how the Velya platform enforces consistent, meaningful, and domain-accurate naming across all artifacts: code, infrastructure, data schemas, agents, services, events, and documentation. Good naming is a force multiplier for a platform with dozens of agents, hundreds of services, and thousands of FHIR resources. Bad naming creates ambiguity that compounds across the entire system.

## Governance Scope

Naming governance applies to all platform artifacts:

| Artifact Type                                      | Naming Authority             | Convention Reference                      |
| -------------------------------------------------- | ---------------------------- | ----------------------------------------- |
| TypeScript files and directories                   | Engineering office           | `.claude/rules/naming.md`                 |
| TypeScript types, classes, interfaces              | Engineering office           | `.claude/rules/naming.md`                 |
| Kubernetes resources (pods, services, deployments) | Infrastructure office        | `.claude/rules/naming.md`                 |
| NATS subjects                                      | Engineering + Infrastructure | `.claude/rules/naming.md`                 |
| Temporal workflows and activities                  | Engineering office           | `.claude/rules/naming.md`                 |
| Database tables and columns                        | Data office                  | `.claude/rules/naming.md`                 |
| FHIR resources and extensions                      | Clinical ops + Data          | FHIR naming standards                     |
| Agents                                             | Agent governance reviewer    | `{office}-{role}-agent` pattern           |
| Services                                           | Engineering office           | `velya-{domain}-{responsibility}` pattern |
| OpenTofu modules                                   | Infrastructure office        | `{provider}-{resource-type}` pattern      |
| ADR documents                                      | Architecture office          | `NNNN-{descriptive-title}.md`             |
| Environment variables                              | Engineering office           | `SCREAMING_SNAKE_CASE`                    |

## Taxonomy

The platform taxonomy is the authoritative list of domain terms, their definitions, and their approved usage. It is maintained in `docs/product/naming-taxonomy.md`.

### Taxonomy Structure

The taxonomy organizes terms by domain:

```
Clinical Domain:
  - patient (not: client, customer, user)
  - encounter (not: visit, appointment, session)
  - condition (not: diagnosis, problem, issue)
  - observation (not: measurement, reading, result)
  - medication-request (not: prescription, order, rx)

Business Domain:
  - claim (not: bill, invoice, charge)
  - coverage (not: insurance, plan, policy)
  - prior-authorization (not: pre-auth, auth-request, approval)

Platform Domain:
  - agent (not: bot, assistant, AI, worker)
  - service (not: microservice, module, component)
  - event (not: message, notification, signal)
  - workflow (not: process, pipeline, flow)
```

### Term Authority

Each domain has a designated term authority (an office supervisor or designated agent) who approves additions, modifications, or deprecations of taxonomy terms. No new term can be added to the taxonomy without the relevant authority's approval.

## Lexicon Curation

The lexicon is the operational subset of the taxonomy: the specific terms currently in active use across the codebase, with their approved forms and prohibited alternatives.

### Lexicon Maintenance

The naming-governance-agent continuously curates the lexicon:

1. **Discovery**: Scans the codebase for new terms not yet in the lexicon. New terms are flagged for review.
2. **Validation**: Checks existing code against the lexicon for violations (use of prohibited alternatives).
3. **Deprecation**: When a term is superseded, the old term is added to a deprecated list with a migration path.
4. **Aliasing**: Some terms have approved aliases for specific contexts (e.g., `encounter` in clinical code, `visit` in patient-facing UI copy only).

### Lexicon Entry Format

```yaml
term: encounter
domain: clinical
definition: 'A specific interaction between a patient and healthcare provider(s) for the purpose of providing healthcare services'
fhir-resource: Encounter
approved-forms:
  - encounter (noun, general use)
  - patient-encounter (compound, when disambiguation needed)
prohibited-forms:
  - visit (except in patient-facing UI copy)
  - appointment (this is a separate FHIR resource with different semantics)
  - session (too generic)
related-terms:
  - patient
  - condition
  - observation
added: 2026-03-15
authority: clinical-ops-supervisor
```

## Validation Hooks

Naming governance is enforced through automated validation at multiple points in the development lifecycle.

### Pre-Commit Hooks

A pre-commit hook scans changed files for naming violations:

- **File names**: Must be `kebab-case`. No underscores, no camelCase, no PascalCase in file names.
- **Prohibited terms**: Checks for uses of prohibited term forms (e.g., `visit` instead of `encounter` in non-UI code).
- **Generic names**: Flags files or directories named `utils`, `helpers`, `common`, `misc`, `lib`.
- **Abbreviations**: Flags non-standard abbreviations. Only universally understood abbreviations are allowed (`id`, `url`, `http`, `api`).

### CI Pipeline Checks

The CI pipeline runs deeper naming validation:

- **Type and interface names**: Must be `PascalCase`. Interfaces should not use `I` prefix (use descriptive names instead).
- **NATS subject format**: Must follow `dot.separated.kebab` convention.
- **Kubernetes resource names**: Must follow `kebab-case` and the `velya-{domain}-{responsibility}` pattern.
- **Database migration names**: Must follow `NNNN_{descriptive_action}.sql` pattern.
- **Constant naming**: Must be `SCREAMING_SNAKE_CASE`.

### Agent Review

The naming-governance-agent reviews PRs for naming quality beyond what automated checks can catch:

- **Semantic accuracy**: Is the name meaningful and accurate? Does `calculateDosage` actually calculate a dosage?
- **Consistency**: Does the new name follow existing patterns in the same module?
- **Domain alignment**: Does the name use the correct domain term from the taxonomy?
- **Specificity**: Is the name specific enough? `PatientIntakeService` vs. `IntakeService`.
- **Verbosity balance**: Is the name too long without adding clarity? Names over 40 characters are flagged for review.

## Enforcement Levels

Naming violations are classified by severity:

| Level       | Description                             | Enforcement          | Example                                                                       |
| ----------- | --------------------------------------- | -------------------- | ----------------------------------------------------------------------------- |
| **Error**   | Blocks merge. Must be fixed.            | Pre-commit hook + CI | File named `Helpers.ts`, using `client` instead of `patient` in clinical code |
| **Warning** | Flagged in PR review. Should be fixed.  | CI + agent review    | Name is technically valid but inconsistent with existing patterns             |
| **Info**    | Noted for awareness. Fix if convenient. | Agent review only    | Name could be more specific but is acceptable                                 |

## Migration Process

When naming conventions change or taxonomy terms are updated:

1. **Announce**: The naming change is documented in the taxonomy with an effective date and migration deadline.
2. **Codemods**: Automated codemods are prepared to rename affected symbols across the codebase.
3. **Gradual rollout**: Old names are deprecated (warning level) before being prohibited (error level). Deprecation period is typically 2 sprints.
4. **Validation update**: Pre-commit hooks and CI checks are updated to enforce the new names.
5. **Audit**: After the migration deadline, the naming-governance-agent performs a full codebase scan to verify completion.

## Cross-Cutting Concerns

### Internationalization

The codebase uses English for all code identifiers, variable names, and internal documentation. Patient-facing strings are externalized for translation but the keys themselves follow English naming conventions.

### FHIR Alignment

Where a concept maps to a FHIR resource, the platform term must match the FHIR resource name. The FHIR specification is the authoritative source for clinical term naming:

- Use `Encounter` not `Visit`
- Use `Condition` not `Diagnosis`
- Use `MedicationRequest` not `Prescription`
- Use `Observation` not `LabResult`

### Agent Naming

Agent names follow the pattern `{office}-{role}-agent`:

- The `{office}` segment identifies which of the 22 offices the agent belongs to.
- The `{role}` segment describes the agent's specific function.
- The `-agent` suffix distinguishes agents from services.
- Examples: `clinical-documentation-agent`, `revenue-coding-agent`, `infra-deployment-agent`.

## Metrics

| Metric                    | Description                                           | Target           |
| ------------------------- | ----------------------------------------------------- | ---------------- |
| Naming violation rate     | Violations per 1000 lines of changed code             | <= 2             |
| Pre-commit rejection rate | Percentage of commits initially rejected for naming   | <= 5%            |
| Taxonomy coverage         | Percentage of domain terms that have taxonomy entries | >= 90%           |
| Deprecated term usage     | Count of deprecated term usages in active code        | Trending to zero |
| Agent naming compliance   | Percentage of agents following the naming pattern     | 100%             |
