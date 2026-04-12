# ADR 0020: Visual Regression Testing

## Status

Accepted

## Context

The Velya hospital platform has a large web surface (30+ routes) that must maintain strict visual consistency across releases. Manual visual review does not scale: subtle regressions (shifted elements, contrast changes, broken focus indicators) slip through code review because reviewers focus on logic, not pixels.

The existing pixel-gate enforcement (`scripts/ui-audit/detect-overlaps.ts`, `scripts/ui-audit/screenshot-key-pages.ts`) catches overlap and geometry issues but does not detect _regressions_ — changes from a known-good visual state. We also lacked automated checks for WCAG AA contrast compliance and keyboard navigability.

## Decision

We implement four complementary validation scripts under `scripts/validate/`:

1. **`capture-screenshots.ts`** — Captures full-page screenshots of all key routes as a baseline, authenticating via `VELYA_SESSION` cookie, saving PNG files named by route slug.

2. **`compare-visual-baseline.ts`** — Compares current screenshots against a stored baseline using file-size heuristics. A PNG size difference exceeding a configurable threshold (default 5%) flags a regression. This approach requires no external image-diff libraries, keeping the dependency footprint minimal. The design explicitly leaves an upgrade path to pixel-level diffing (e.g., `pixelmatch`) when the team is ready to adopt it.

3. **`validate-contrast.ts`** — Uses Playwright to evaluate every text element against WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text). The WCAG luminance and contrast-ratio formulas are implemented inline — no external accessibility library is required for this specific check.

4. **`validate-keyboard-nav.ts`** — Tabs through each page 20 times, verifying that focus moves logically, does not get trapped, and that focused interactive elements have a visible focus indicator.

### Baseline capture process

1. Developer or CI runs `capture-screenshots.ts --out=./screenshots-baseline` against a known-good build.
2. The baseline directory is committed or stored as a CI artifact, depending on team preference.
3. On each PR, `capture-screenshots.ts --out=./screenshots-current` runs against the PR build.
4. `compare-visual-baseline.ts --baseline=./screenshots-baseline --current=./screenshots-current` compares the two.

### Comparison approach

The initial implementation uses file-size comparison as a regression proxy. For PNG images of the same page rendered at the same viewport, a significant size change reliably correlates with visual change. This is a deliberate trade-off:

- **Pros**: Zero external dependencies, fast, no false positives from anti-aliasing differences.
- **Cons**: Cannot detect pixel-level changes that happen to produce similar file sizes.
- **Upgrade path**: Replace the size comparison in `compare-visual-baseline.ts` with `pixelmatch` or `sharp`-based pixel diffing. The script structure (baseline dir, current dir, per-file comparison, markdown report) remains identical.

### Threshold configuration

- Default regression threshold: 5% file-size difference.
- Configurable via `--threshold` flag (value between 0 and 1).
- Threshold should be tuned per project — pages with dynamic content (timestamps, live data) may need a higher threshold.

### What constitutes a blocking regression

- Any page where the screenshot file size differs by more than the configured threshold.
- Any page that was present in the baseline but is missing from the current run (route removed or broken).
- Contrast violations with ratio below 3:1 (critical).
- Focus traps or pages with no focusable elements (critical keyboard nav failure).

Non-blocking warnings (logged but do not fail CI):
- Contrast violations between 3:1 and 4.5:1 for normal text (serious but not critical).
- Missing focus indicators on interactive elements.
- New pages not present in baseline (informational).

### CI integration plan

1. Add a workflow (`.github/workflows/visual-regression-gate.yaml`) triggered on PRs touching `apps/web/**`.
2. The workflow captures current screenshots, downloads the baseline artifact from the last `main` build, and runs the comparison.
3. On `main` merge, a workflow uploads the new baseline as a CI artifact.
4. The contrast and keyboard-nav validators run as separate CI steps, parallel to the visual comparison.

## Consequences

- Developers get fast feedback on visual regressions without manual screenshot comparison.
- WCAG AA contrast compliance is enforced automatically on every page.
- Keyboard accessibility is tested continuously, preventing silent regressions in focus management.
- The size-based comparison approach will miss some subtle regressions (same-size pixel changes). This is acceptable for the initial rollout and will be addressed when pixel-level diffing is adopted.
- Baseline management adds a step to the release process (updating baselines when intentional visual changes are made).
