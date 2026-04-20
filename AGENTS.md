# Velya Platform

Read `CLAUDE.md` for the full project operating rules, repository conventions, and delegation policy.

## Opensquad

This repository includes **Opensquad** for non-clinical operational and creative squads.

- Entry point: `/opensquad`
- Supported shortcuts:
  - `/opensquad help`
  - `/opensquad create <description>`
  - `/opensquad list`
  - `/opensquad run <name>`
  - `/opensquad edit <name> <changes>`
  - `/opensquad skills`
- The command behavior source is `.claude/skills/opensquad/SKILL.md`.
- Before creating or running squads, load `_opensquad/_memory/company.md` and `_opensquad/_memory/preferences.md`.
- Before running a squad, also load `squads/<name>/squad.yaml`, `squads/<name>/_memory/memories.md`, and `_opensquad/core/runner.pipeline.md`.
- Do not manually edit `_opensquad/core/` unless you are intentionally changing the framework itself.

## Scope Guard

- Use Opensquad only for non-clinical content and operational squads.
- Keep browser/session behavior aligned with `.mcp.json` and `_opensquad/config/playwright.config.json`.
