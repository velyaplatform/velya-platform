# Naming Conventions

Full taxonomy: `docs/product/naming-taxonomy.md`

## Case Rules

| Context                               | Convention             | Example                                 |
| ------------------------------------- | ---------------------- | --------------------------------------- |
| Files and directories                 | `kebab-case`           | `patient-intake-handler.ts`             |
| TypeScript types, classes, interfaces | `PascalCase`           | `PatientAdmission`, `IClinicalEvent`    |
| Variables, functions, properties      | `camelCase`            | `calculateDosage`, `patientName`        |
| Constants                             | `SCREAMING_SNAKE_CASE` | `MAX_RETRY_COUNT`, `DEFAULT_TIMEOUT_MS` |
| Environment variables                 | `SCREAMING_SNAKE_CASE` | `DATABASE_URL`, `NATS_CLUSTER_URL`      |
| Kubernetes resources                  | `kebab-case`           | `velya-clinical-intake`                 |
| Helm charts                           | `kebab-case`           | `velya-patient-service`                 |
| Database tables                       | `snake_case`           | `patient_encounters`                    |
| Database columns                      | `snake_case`           | `created_at`, `patient_id`              |
| NATS subjects                         | `dot.separated.kebab`  | `clinical.patient-intake.created`       |
| Temporal workflows                    | `PascalCase`           | `PatientDischargeWorkflow`              |
| Temporal activities                   | `camelCase`            | `sendDischargeNotification`             |

## Resource Naming Patterns

### Services

Pattern: `velya-{domain}-{responsibility}`

```
velya-clinical-intake
velya-billing-claims
velya-pharmacy-dispensing
velya-scheduling-appointments
```

### Agents

Pattern: `{office}-{role}-agent`

```
clinical-triage-agent
quality-audit-agent
revenue-coding-agent
ops-deployment-agent
```

### Kubernetes Namespaces

Pattern: `velya-{env}-{domain}`

```
velya-dev-clinical
velya-staging-billing
velya-prod-platform
```

### OpenTofu Modules

Pattern: `{provider}-{resource-type}`

```
aws-eks-cluster
aws-rds-postgres
aws-ecr-registry
```

### Helm Value Files

Pattern: `values-{env}.yaml`

```
values-dev.yaml
values-staging.yaml
values-prod.yaml
```

## Naming Principles

1. **Be specific.** `patient-intake-service` not `intake-service`. `calculateMedicationDosage` not `calc`.
2. **Be domain-indicating.** Names should tell you which business domain they belong to.
3. **Be semantically clear.** A reader should understand purpose without reading implementation.
4. **No abbreviations** unless universally understood (`id`, `url`, `http`, `api`).
5. **No generic names.** Avoid `utils`, `helpers`, `common`, `misc`, `stuff`, `data`, `manager`.
6. **Boolean variables** start with `is`, `has`, `should`, `can` (e.g., `isPatientAdmitted`).
7. **Event names** use past tense: `PatientAdmitted`, `ClaimSubmitted`, `MedicationDispensed`.
8. **Handler functions** use `handle` prefix: `handlePatientAdmission`, `handleClaimDenial`.
9. **Factory functions** use `create` prefix: `createPatientEncounter`, `createBillingClaim`.

## Prohibited Names

Do not use these as standalone module, directory, or file names:

- `utils`, `helpers`, `common`, `shared`, `misc`, `lib`, `core` (too vague)
- `manager`, `handler`, `processor` without domain qualifier (too generic)
- `data`, `info`, `stuff`, `thing` (meaningless)
- Single-letter variables outside of loops and lambdas
