# Quality Rules

## UI Pixel Gate (non-negotiable)

Every PR that touches `apps/web/**` must pass the pixel-level overlap gate before merge.

The rules are absolute:

- **Text overlap.** No letter renders on top of another letter. No FAB or floating button covers any part of a heading, label, table cell, or form field.
- **Field over field.** No two `<input>` / `<textarea>` / `<select>` overlap by more than 30 % of pixel area.
- **Actionable over actionable.** No two `<button>` / `<a href>` (excluding parent/child nesting) overlap by more than 50 %.
- **Heading clipped by fixed chrome.** Any `main h1` / `main h2` / `.page-title` renders strictly to the right of any `position: fixed` sidebar (`rect.left ≥ sidebar.right - 4`).
- **Text clipped mid-word.** `scrollWidth > clientWidth + 4` without an explicit `white-space: nowrap` + `text-overflow: ellipsis` is high severity. "Lista de Pacient" instead of "Lista de Pacientes" is unacceptable.
- **Sidebar must be resizable.** Drag handle on right edge + keyboard `ArrowLeft` / `ArrowRight` / `Home`. Width persisted in `localStorage` under `velya:sidebar-width` (default 260, min 200, max 420). The `--sidebar-width` CSS variable is updated dynamically so `.app-content-wrapper` stays aligned.
- **No floating chrome on top of data rows.** FABs must be anchored to the sidebar gutter via the `.gh-fab-sidebar-anchor` class (`left: calc(var(--sidebar-width) + 20px)`) or live as icon buttons inside the dark header. They may never sit at `bottom-* right-*` where they collide with table action columns.

### Machine enforcement

- **Local**: `VELYA_SESSION=<cookie> npx tsx scripts/ui-audit/detect-overlaps.ts --fail-on=critical`. Use a `next build` + `next start` server, not `next dev` (CSP collides with Next's eval-based dev runtime).
- **CI**: `.github/workflows/ui-overlap-gate.yaml` runs the same detector on every PR touching `apps/web/**` or `scripts/ui-audit/**`.
- **Feedback**: `.github/workflows/ci-failure-watcher.yaml` subscribes to `workflow_run` events for the overlap gate (and the rest of the critical workflows) and comments on the PR with a triage summary when CI goes red.

The detector tolerances (4 px horizontal, 8 px vertical, 30 % field, 50 % actionable) are encoded as constants in `scripts/ui-audit/detect-overlaps.ts`. Changes must update this rule and the script together.

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
