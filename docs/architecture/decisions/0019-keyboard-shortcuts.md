# ADR 0019 -- Keyboard Shortcuts System

## Status

Accepted

## Context

Clinical users navigate between multiple hospital modules (patients, tasks, beds, lab, imaging, alerts, discharge) many times per shift. Mouse-only navigation adds friction to time-critical workflows where seconds matter. Power users in similar systems (GitHub, VS Code, Slack) rely heavily on keyboard shortcuts to move between views and trigger common actions.

The platform needed a structured shortcut system that:

- Provides fast navigation across all major modules.
- Allows context-specific shortcuts per module (e.g., "n" for new patient when on the patients page).
- Avoids interference with form input and text editing.
- Avoids accidental destructive actions from single keystrokes.
- Is discoverable without memorization.

## Decision

### Scoping rules

Shortcuts are scoped to either `global` (available everywhere) or a specific module name (e.g., `patients`, `tasks`, `beds`). The current scope is derived from the URL pathname. When a key matches both a scoped and a global shortcut, the scoped shortcut takes priority.

### Multi-key sequence pattern

Navigation shortcuts use a two-key sequence: press `g` (go), then a letter within 500ms. Examples: `g p` for patients, `g t` for tasks. This avoids collisions with single-letter typing and follows the pattern established by GitHub and Gmail.

### Safety rules

1. No single-key shortcut triggers a destructive action (delete, discharge, cancel). Destructive actions always require a modifier key or a confirmation dialog.
2. All shortcuts are suppressed when the focus is on `<input>`, `<textarea>`, `<select>`, or any element with `contentEditable`.
3. `Escape` always closes the topmost overlay or panel.
4. `ctrl+k` / `cmd+k` opens the command palette (consistent with VS Code and GitHub conventions).

### Discoverability

Pressing `?` at any time opens a full-screen overlay listing all shortcuts grouped by scope. The overlay uses Radix Dialog for accessibility. Inline `<ShortcutHint>` badges can be placed next to buttons and labels to surface relevant shortcuts in context.

### Architecture

- `shortcuts-config.ts` -- single source of truth for all shortcut definitions.
- `ShortcutProvider` -- React context that registers a global `keydown` listener, handles multi-key sequencing, and dispatches actions.
- `ShortcutOverlay` -- Radix Dialog that renders the grouped shortcut catalog.
- `ShortcutHint` -- small inline badge component for contextual hints.
- The provider wraps `AppShell` so shortcuts are available on every authenticated page.

## Consequences

- Every new shortcut must be added to `shortcuts-config.ts` and documented in `docs/frontend/shortcuts-catalog.md`.
- Module-specific shortcuts only fire when the user is on that module's page, reducing surprise.
- The multi-key sequence pattern limits navigation shortcuts to 26 possible targets (g + a-z), which is sufficient for the current module count.
- Custom events (`velya:shortcut-command`, `velya:command-palette`) decouple the shortcut system from module implementations -- modules listen for events rather than being imported by the provider.
