# Quality Rules

## Testing Requirements

### Unit Tests
- **Required for all business logic.** Every function with domain logic has a corresponding test.
- Use Vitest as the test runner.
- Minimum coverage: 80% line coverage for `services/` and `packages/`.
- Tests must be fast (< 5s per suite). Mock external dependencies.
- Name test files alongside source: `patient-intake.ts` -> `patient-intake.test.ts`.

### Integration Tests
- **Required for every service.** Test actual database queries, NATS publishing, and HTTP endpoints.
- Use Testcontainers for database and message broker dependencies.
- Integration tests run in CI on every PR.
- Test files live in `tests/integration/{service-name}/`.

### E2E Tests
- **Required for critical user paths.** Patient admission, medication ordering, billing submission.
- Use Playwright for UI flows.
- E2E tests run nightly and on release branches.
- Test files live in `tests/e2e/`.

### Agent Tests
- Agent outputs must be tested against golden datasets.
- Shadow mode comparison tests validate agent accuracy before promotion.
- Test files live alongside agent definitions in `agents/{office}/{agent-name}/tests/`.

## Schema Validation

- Validate all external inputs at service boundaries. No trusting upstream data.
- Use Zod for runtime schema validation in TypeScript.
- FHIR resources are validated against R4 profiles before persistence.
- Event payloads are validated against schemas in `packages/event-schemas/` before publishing and on consumption.
- API request/response schemas are defined in OpenAPI specs. Codegen types from specs.

## Code Quality

### Linting and Formatting
- **ESLint and Prettier are enforced in CI.** PRs with lint errors do not merge.
- Use the shared config in `packages/eslint-config/` and `packages/prettier-config/`.
- No `eslint-disable` without a comment explaining why.
- Run `lint-staged` on pre-commit hooks.

### TypeScript Strictness
- `strict: true` in all `tsconfig.json` files.
- No `any` types. Use `unknown` and narrow with type guards.
- No `@ts-ignore`. Use `@ts-expect-error` with explanation if absolutely necessary.
- Prefer `interface` over `type` for object shapes. Use `type` for unions and intersections.

### Code Review
- Every PR requires at least one approval.
- Security-sensitive changes (IAM, auth, encryption) require two approvals.
- PR descriptions must explain the "why", not just the "what".
- Keep PRs small. Target < 400 lines changed. Split large changes into stacked PRs.

## Feature Flags

- **Use feature flags for risky changes.** Roll out incrementally, not all-at-once.
- Feature flags are managed centrally. No hardcoded boolean toggles.
- Every flag has an owner, a description, and a planned removal date.
- Clean up flags within 30 days of full rollout.
- Flag naming: `velya.{domain}.{feature-name}` (e.g., `velya.clinical.ai-triage`).

## Database Migrations

- **Safe migrations only.** No destructive changes without a multi-step rollout.
- Additive changes (add column, add table, add index) are always safe.
- Destructive changes require a migration plan:
  1. Add new column/table.
  2. Dual-write to old and new.
  3. Backfill new from old.
  4. Switch reads to new.
  5. Stop writes to old.
  6. Drop old (after verification period).
- Never rename a column in a single migration. Use the add/migrate/drop pattern.
- Migrations must be backward-compatible with the previous application version.
- Test migrations against a production-size dataset in staging before applying to prod.

## Production Safety

- **No destructive production changes by default.** Deletes, drops, and truncates require explicit approval.
- All production deploys are automated via ArgoCD. No manual deployments.
- Canary or blue-green deployments for services with user-facing traffic.
- Rollback plan documented before every production release.
- Post-deploy verification checklist for critical services.

## Dependency Management

- Update dependencies weekly. Automate with Renovate or Dependabot.
- Major version upgrades require a dedicated PR with testing and documentation.
- No unused dependencies. Audit and prune regularly.
- Lockfiles (`package-lock.json`) are committed and reviewed.
