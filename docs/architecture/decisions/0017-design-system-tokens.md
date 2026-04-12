# 0017 — Monochromatic Design System Tokens

**Status:** Accepted
**Date:** 2026-04-12
**Deciders:** Product Architect

## Context

Hospital software must be visually sober, high-contrast, and legible under
fluorescent lighting, at arm's length, by fatigued clinicians. Color-as-meaning
is a known accessibility failure mode — color-blind users and glare conditions
make colored badges unreliable.

The Velya frontend previously used a multi-color palette (red for critical,
amber for warning, green for success, blue for info) in badges, cards, buttons,
alerts, and KPI tiles. This created visual noise, inconsistency across pages,
and accessibility gaps where status depended on color alone.

## Decision

All UI components use a monochromatic neutral palette:

- **Backgrounds:** white, neutral-50, neutral-100, neutral-200, neutral-900 (primary buttons)
- **Text:** neutral-900 (primary), neutral-700 (secondary), neutral-500 (tertiary), white (on dark bg)
- **Borders:** neutral-200, neutral-300
- **Prohibited:** Any Tailwind color family except neutral/white/black

Status meaning is conveyed by **text labels** (e.g., "URGENTE", "Bloqueado",
"Disponivel") and **icons**, never by color alone.

## Enforcement

- `scripts/validate/validate-color-policy.ts` — blocks prohibited color classes
- `scripts/validate/validate-no-emoji.ts` — blocks emoji characters
- `scripts/validate/validate-design-tokens.ts` — comprehensive audit
- CI gate in `.github/workflows/frontend-governance.yaml` Stage 1

## Consequences

- **Positive:** Higher contrast, better accessibility, consistent visual weight,
  reduced cognitive load, easier to maintain.
- **Negative:** Some users may initially find the UI "flat". Status
  differentiation relies on reading text labels, which requires adequate
  font size and spacing.
- **Mitigated by:** Using font-weight, uppercase, and spacing variation to
  create visual hierarchy without color.
