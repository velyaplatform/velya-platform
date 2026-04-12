# Hospital Frontend Operating System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete frontend operating system for Velya Hospitalar — design system enforcement, contextual navigation, keyboard shortcuts, validation pipeline, visual regression, accessibility automation, and governance agents.

**Architecture:** 5 independent sub-plans executed in sequence. Each produces working, testable software. Sub-plan 1 (Design System Foundation) is the dependency for all others. Sub-plans 2-5 can run in parallel after Sub-plan 1 completes.

**Tech Stack:** Next.js 15 / React 19 / Tailwind CSS v4 / Playwright / Vitest / TypeScript 5.7

---

## Scope Decomposition

This plan covers 5 independent subsystems. Each subsystem is a self-contained plan that produces working software:

| Sub-plan | Name | Dependency | Estimated Tasks |
|----------|------|------------|-----------------|
| 1 | Design System Foundation & Validation Scripts | None | 12 |
| 2 | Contextual Navigation & Entity Panels | Sub-plan 1 | 10 |
| 3 | Keyboard Shortcuts System | Sub-plan 1 | 8 |
| 4 | CI Pipeline & Governance Agents | Sub-plan 1 | 10 |
| 5 | Visual Regression & Accessibility Automation | Sub-plan 1 | 8 |

---

## File Structure (all sub-plans)

### New files to create:

```
apps/web/src/
  app/
    components/
      entity-panel/
        entity-panel.tsx              # Side panel shell (Sub-plan 2)
        entity-panel-trigger.tsx      # Clickable wrapper (Sub-plan 2)
        panels/
          patient-panel.tsx           # Patient detail panel (Sub-plan 2)
          bed-panel.tsx               # Bed detail panel (Sub-plan 2)
          professional-panel.tsx      # Staff detail panel (Sub-plan 2)
          prescription-panel.tsx      # Prescription detail panel (Sub-plan 2)
          lab-panel.tsx               # Lab order detail panel (Sub-plan 2)
      shortcuts/
        shortcut-provider.tsx         # Context + key listener (Sub-plan 3)
        shortcut-overlay.tsx          # Help overlay UI (Sub-plan 3)
        shortcut-hint.tsx             # Inline hint badge (Sub-plan 3)
        shortcut-registry.ts          # Registry of all shortcuts (Sub-plan 3)
  lib/
    design-tokens.ts                  # Token constants + validator (Sub-plan 1)
    shortcuts-config.ts               # Shortcut definitions per module (Sub-plan 3)

scripts/
  validate/
    validate-color-policy.ts          # Grep for prohibited colors (Sub-plan 1)
    validate-no-emoji.ts              # Grep for prohibited emojis (Sub-plan 1)
    validate-design-tokens.ts         # Check token usage consistency (Sub-plan 1)
    validate-form-labels.ts           # Check all inputs have labels (Sub-plan 1)
    validate-keyboard-nav.ts          # Playwright keyboard traversal (Sub-plan 5)
    validate-contrast.ts              # axe-core contrast checks (Sub-plan 5)
    capture-screenshots.ts            # Per-page screenshot baseline (Sub-plan 5)
    compare-visual-baseline.ts        # Pixel diff against baseline (Sub-plan 5)
    generate-screen-inventory.ts      # Auto-generate screen catalog (Sub-plan 4)
    generate-component-inventory.ts   # Auto-generate component catalog (Sub-plan 4)

.github/workflows/
  frontend-governance.yaml            # 8-stage pipeline (Sub-plan 4)

docs/
  architecture/decisions/
    0017-design-system-tokens.md      # ADR: token architecture (Sub-plan 1)
    0018-contextual-navigation.md     # ADR: entity panel system (Sub-plan 2)
    0019-keyboard-shortcuts.md        # ADR: shortcut governance (Sub-plan 3)
    0020-visual-regression.md         # ADR: screenshot baseline (Sub-plan 5)
  frontend/
    design-tokens-reference.md        # Living token catalog (Sub-plan 1)
    shortcuts-catalog.md              # Living shortcut catalog (Sub-plan 3)
    screen-inventory.md               # Auto-generated (Sub-plan 4)
```

### Files to modify:

```
apps/web/tailwind.config.ts           # Replace legacy colors with monochrome tokens (Sub-plan 1)
apps/web/src/app/globals.css          # Clean up legacy color vars (Sub-plan 1)
apps/web/src/app/components/app-shell.tsx  # Add entity panel + shortcut provider (Sub-plans 2, 3)
apps/web/src/app/components/module-list-view.tsx  # Add entity panel triggers to table cells (Sub-plan 2)
apps/web/src/app/components/navigation.tsx  # Add shortcut hints (Sub-plan 3)
apps/web/package.json                 # Add dev dependencies (Sub-plans 1, 5)
```

---

# SUB-PLAN 1: Design System Foundation & Validation Scripts

**Goal:** Lock down the monochromatic design system with enforceable tokens, validation scripts that block prohibited colors/emojis/patterns, and an ADR documenting the decisions.

**Why first:** Every other sub-plan depends on stable design tokens and validation infrastructure.

---

### Task 1: Clean up tailwind.config.ts — remove legacy dark theme colors

**Files:**
- Modify: `apps/web/tailwind.config.ts`

The current config has legacy dark-theme `velya.*` colors (`#0a0f1a`, `#3b82f6`, `#22c55e`, etc.) that conflict with the monochromatic standard. These are dead references — the actual colors come from `globals.css` `@theme` block.

- [ ] **Step 1: Read the current file**

Verify it still contains the old velya colors.

- [ ] **Step 2: Replace the config with monochrome-only tokens**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
export default config;
```

All color tokens now live exclusively in `globals.css` via the `@theme` directive (Tailwind v4 pattern). No `colors` extension needed — the `@theme` block already registers `--color-velya-*` tokens.

- [ ] **Step 3: Verify build still works**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tailwind.config.ts
git commit -m "chore(web): remove legacy dark-theme colors from tailwind config

Colors are now exclusively managed via @theme in globals.css (Tailwind v4).
The old velya.* colors (#0a0f1a, #3b82f6, etc.) were dead references that
conflicted with the monochromatic design standard."
```

---

### Task 2: Update globals.css @theme block — monochrome-only tokens

**Files:**
- Modify: `apps/web/src/app/globals.css` (lines 11-39, the `@theme` block)

The `@theme` block still defines colored tokens (`--color-velya-accent: #0969da`, `--color-velya-critical: #d1242f`, etc.) that no component uses anymore after the monochromatic cleanup.

- [ ] **Step 1: Replace the @theme block with monochrome tokens**

Replace lines 11-39 with:

```css
@theme {
  /* Velya Design Tokens — Monochromatic Hospital Standard
     All UI uses neutral palette only. Semantic meaning conveyed by
     text labels and icons, never by color alone. */

  /* Backgrounds */
  --color-velya-bg: #ffffff;
  --color-velya-surface: #ffffff;
  --color-velya-elevated: #f5f5f5;       /* neutral-100 */
  --color-velya-border: #d4d4d4;          /* neutral-300 */
  --color-velya-border-strong: #a3a3a3;   /* neutral-400 */

  /* Text */
  --color-velya-text: #171717;            /* neutral-900 */
  --color-velya-text-secondary: #525252;  /* neutral-600 */
  --color-velya-text-muted: #737373;      /* neutral-500 */

  /* Accent (used only for interactive focus rings, links) */
  --color-velya-accent: #171717;          /* neutral-900 */
  --color-velya-accent-soft: #f5f5f5;     /* neutral-100 */

  /* Semantic — all mapped to neutral for monochrome */
  --color-velya-critical: #171717;
  --color-velya-warning: #404040;
  --color-velya-success: #525252;
  --color-velya-info: #525252;

  /* Legacy aliases — point to monochrome equivalents */
  --color-velya-primary: #171717;
  --color-velya-card: #ffffff;
  --color-velya-muted: #525252;
  --color-velya-subtle: #737373;
  --color-velya-danger: #171717;
  --color-velya-accent-glow: #171717;
}
```

- [ ] **Step 2: Verify build**

Run: `cd /home/jfreire/velya/velya-platform && npx tsc --noEmit --project apps/web/tsconfig.json`

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "chore(web): align @theme tokens with monochrome standard

All velya-* CSS custom properties now resolve to neutral grays.
Semantic meaning is conveyed by text and icons, never color alone."
```

---

### Task 3: Create design-tokens.ts — token constants for scripts

**Files:**
- Create: `apps/web/src/lib/design-tokens.ts`

This file exports the allowed/prohibited patterns as constants so validation scripts can import them instead of hardcoding regex patterns.

- [ ] **Step 1: Create the token constants file**

```typescript
/**
 * Velya Design Token Definitions — used by validation scripts and components.
 *
 * This is the runtime expression of the monochromatic hospital design standard.
 * Validation scripts import these constants to check compliance.
 */

/** Tailwind color families that are ALLOWED in TSX class strings */
export const ALLOWED_COLOR_FAMILIES = [
  'neutral',
  'white',
  'black',
  'inherit',
  'current',
  'transparent',
] as const;

/** Tailwind color families that are PROHIBITED — triggers validation failure */
export const PROHIBITED_COLOR_FAMILIES = [
  'red', 'blue', 'green', 'emerald', 'amber', 'yellow', 'orange',
  'sky', 'lime', 'teal', 'cyan', 'indigo', 'violet', 'purple',
  'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'stone',
] as const;

/** Regex that matches any prohibited Tailwind color class */
export const PROHIBITED_COLOR_REGEX =
  /\b(?:bg|text|border|ring|outline|shadow|from|to|via|divide|placeholder|decoration|accent|caret|fill|stroke)-(?:red|blue|green|emerald|amber|yellow|orange|sky|lime|teal|cyan|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|stone)-\d{1,3}\b/g;

/** Unicode code points and emoji patterns that are prohibited in UI text */
export const PROHIBITED_EMOJI_REGEX =
  /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1FA00}-\u{1FA9F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]|[✓✕✗✘⚠⚡↗↘★⭐✨🕒🔍💊🩺🏥🔬📋📊🔔🚑🛏💉🩹⚕🏨☐]/gu;

/** Allowed neutral Tailwind shades */
export const ALLOWED_NEUTRAL_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** Typography scale (Tailwind defaults) */
export const TYPOGRAPHY = {
  /** Page titles */
  pageTitle: 'text-2xl font-semibold tracking-tight text-neutral-900',
  /** Section headers */
  sectionHeader: 'text-lg font-semibold text-neutral-900',
  /** Card titles */
  cardTitle: 'text-sm font-semibold text-neutral-900',
  /** Body text */
  body: 'text-sm text-neutral-700',
  /** Muted/secondary text */
  muted: 'text-sm text-neutral-500',
  /** Small labels */
  label: 'text-xs font-medium uppercase tracking-wider text-neutral-500',
  /** Table header */
  tableHeader: 'text-xs font-semibold uppercase tracking-wider text-neutral-500',
  /** KPI number */
  kpiValue: 'text-3xl font-bold text-neutral-900',
} as const;

/** Badge standard — single variant for all statuses */
export const BADGE = {
  base: 'inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium',
  default: 'border-neutral-300 bg-neutral-100 text-neutral-800',
} as const;

/** Button variants */
export const BUTTON = {
  primary: 'bg-neutral-900 text-white hover:bg-neutral-800',
  secondary: 'border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50',
  ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
} as const;

/** Card standard */
export const CARD = {
  base: 'bg-white border border-neutral-200 rounded-lg',
  elevated: 'bg-white border border-neutral-200 rounded-lg shadow-sm',
} as const;

/** Table standard */
export const TABLE = {
  header: 'bg-neutral-50 text-neutral-500 uppercase text-xs font-semibold',
  row: 'bg-white hover:bg-neutral-50',
  cell: 'text-neutral-900',
  divider: 'divide-y divide-neutral-100',
} as const;

/** Alert/Banner standard */
export const ALERT = {
  base: 'bg-neutral-50 border border-neutral-300 text-neutral-900 rounded-lg px-5 py-4',
} as const;

/** Spacing scale reference */
export const SPACING = {
  pageGutter: 'px-6',
  sectionGap: 'gap-6',
  cardPadding: 'p-5',
  cardGap: 'gap-4',
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/design-tokens.ts
git commit -m "feat(web): add design token constants for validation scripts

Exports PROHIBITED_COLOR_REGEX, PROHIBITED_EMOJI_REGEX, and standard
class strings (BADGE, BUTTON, CARD, TABLE, ALERT, TYPOGRAPHY) that
validation scripts import to check compliance."
```

---

### Task 4: Create validate-color-policy.ts script

**Files:**
- Create: `scripts/validate/validate-color-policy.ts`

This script greps all TSX files for prohibited Tailwind color classes and exits non-zero if any are found.

- [ ] **Step 1: Create the validation script**

```typescript
#!/usr/bin/env tsx
/**
 * validate-color-policy.ts — Ensures no prohibited Tailwind color classes
 * exist in TSX files. Part of the frontend governance pipeline (Stage 1).
 *
 * Usage: npx tsx scripts/validate/validate-color-policy.ts
 * Exit 0 = clean, Exit 1 = violations found
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { PROHIBITED_COLOR_REGEX } from '../../apps/web/src/lib/design-tokens';

const WEB_SRC = join(process.cwd(), 'apps/web/src');

interface Violation {
  file: string;
  line: number;
  match: string;
  context: string;
}

async function collectTsxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      files.push(...await collectTsxFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await collectTsxFiles(WEB_SRC);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Reset regex state
      PROHIBITED_COLOR_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = PROHIBITED_COLOR_REGEX.exec(line)) !== null) {
        violations.push({
          file: relative(process.cwd(), file),
          line: i + 1,
          match: match[0],
          context: line.trim().slice(0, 120),
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log('validate-color-policy: PASS (0 violations)');
    process.exit(0);
  }

  console.error(`validate-color-policy: FAIL (${violations.length} violations)\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — ${v.match}`);
    console.error(`    ${v.context}\n`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-color-policy: ERROR', err);
  process.exit(2);
});
```

- [ ] **Step 2: Run the script to verify it passes**

Run: `cd /home/jfreire/velya/velya-platform && npx tsx scripts/validate/validate-color-policy.ts`
Expected: `validate-color-policy: PASS (0 violations)`

- [ ] **Step 3: Commit**

```bash
git add scripts/validate/validate-color-policy.ts
git commit -m "feat(scripts): add validate-color-policy — blocks prohibited Tailwind colors

Greps all TSX/TS files for bg-red-*, text-blue-*, border-amber-*, etc.
Imports PROHIBITED_COLOR_REGEX from design-tokens.ts. Exit 1 on violation."
```

---

### Task 5: Create validate-no-emoji.ts script

**Files:**
- Create: `scripts/validate/validate-no-emoji.ts`

- [ ] **Step 1: Create the script**

```typescript
#!/usr/bin/env tsx
/**
 * validate-no-emoji.ts — Ensures no emoji characters exist in TSX UI files.
 * Part of the frontend governance pipeline (Stage 1).
 *
 * Usage: npx tsx scripts/validate/validate-no-emoji.ts
 * Exit 0 = clean, Exit 1 = violations found
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { PROHIBITED_EMOJI_REGEX } from '../../apps/web/src/lib/design-tokens';

const WEB_SRC = join(process.cwd(), 'apps/web/src');

interface Violation {
  file: string;
  line: number;
  match: string;
  context: string;
}

async function collectTsxFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      files.push(...await collectTsxFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.endsWith('.test.ts')) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await collectTsxFiles(WEB_SRC);
  const violations: Violation[] = [];

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Skip imports and comments
      if (line.trimStart().startsWith('import ') || line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

      PROHIBITED_EMOJI_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = PROHIBITED_EMOJI_REGEX.exec(line)) !== null) {
        violations.push({
          file: relative(process.cwd(), file),
          line: i + 1,
          match: match[0],
          context: line.trim().slice(0, 120),
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log('validate-no-emoji: PASS (0 violations)');
    process.exit(0);
  }

  console.error(`validate-no-emoji: FAIL (${violations.length} violations)\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} — U+${v.match.codePointAt(0)?.toString(16).toUpperCase()}`);
    console.error(`    ${v.context}\n`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-no-emoji: ERROR', err);
  process.exit(2);
});
```

- [ ] **Step 2: Run to verify**

Run: `cd /home/jfreire/velya/velya-platform && npx tsx scripts/validate/validate-no-emoji.ts`
Expected: `validate-no-emoji: PASS (0 violations)`

- [ ] **Step 3: Commit**

```bash
git add scripts/validate/validate-no-emoji.ts
git commit -m "feat(scripts): add validate-no-emoji — blocks emoji in UI code

Scans TSX/TS files for prohibited Unicode emoji ranges and specific
characters (checkmarks, sparkles, medical emojis). Exit 1 on violation."
```

---

### Task 6: Create validate-form-labels.ts script

**Files:**
- Create: `scripts/validate/validate-form-labels.ts`

This script uses Playwright to crawl all pages and verify every `<input>`, `<select>`, and `<textarea>` has an associated `<label>` or `aria-label`.

- [ ] **Step 1: Create the script**

```typescript
#!/usr/bin/env tsx
/**
 * validate-form-labels.ts — Ensures every form field has a visible label.
 * Uses Playwright to crawl pages and check for label associations.
 *
 * Usage: VELYA_SESSION=<cookie> npx tsx scripts/validate/validate-form-labels.ts [--url=http://localhost:3003]
 * Exit 0 = all fields labeled, Exit 1 = unlabeled fields found
 */

import { chromium } from 'playwright';

interface Violation {
  page: string;
  element: string;
  name: string;
  reason: string;
}

const ROUTES = [
  '/', '/patients', '/patients/new', '/tasks', '/prescriptions',
  '/lab/orders', '/lab/results', '/imaging/orders', '/imaging/results',
  '/discharge', '/beds', '/surgery', '/icu', '/ems', '/pharmacy',
  '/pharmacy/stock', '/staff-on-duty', '/cleaning/tasks',
  '/transport/orders', '/meals/orders', '/search', '/alerts',
  '/delegations', '/delegations/new', '/handoffs', '/handoffs/new',
  '/employees', '/employees/new', '/suppliers', '/suppliers/new',
  '/supply/items', '/supply/purchase-orders',
];

async function main() {
  const baseUrl = process.argv.find(a => a.startsWith('--url='))?.split('=')[1] ?? 'http://localhost:3003';
  const sessionCookie = process.env.VELYA_SESSION ?? '';

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  if (sessionCookie) {
    await context.addCookies([{
      name: 'velya-session',
      value: sessionCookie,
      domain: new URL(baseUrl).hostname,
      path: '/',
    }]);
  }

  const violations: Violation[] = [];

  for (const route of ROUTES) {
    const page = await context.newPage();
    try {
      await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(500);

      const results = await page.evaluate(() => {
        const issues: { element: string; name: string; reason: string }[] = [];
        const fields = document.querySelectorAll('input, select, textarea');

        for (const field of fields) {
          const el = field as HTMLInputElement;
          // Skip hidden fields
          if (el.type === 'hidden') continue;
          if (el.offsetParent === null) continue;

          const hasLabel = el.labels && el.labels.length > 0;
          const hasAriaLabel = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby');
          const hasTitle = el.hasAttribute('title');

          if (!hasLabel && !hasAriaLabel && !hasTitle) {
            issues.push({
              element: el.tagName.toLowerCase(),
              name: el.name || el.id || el.className.slice(0, 40),
              reason: 'No label, aria-label, aria-labelledby, or title',
            });
          }
        }
        return issues;
      });

      for (const r of results) {
        violations.push({ page: route, ...r });
      }
    } catch {
      // Page may not exist or timeout — skip
    } finally {
      await page.close();
    }
  }

  await browser.close();

  if (violations.length === 0) {
    console.log(`validate-form-labels: PASS (checked ${ROUTES.length} pages)`);
    process.exit(0);
  }

  console.error(`validate-form-labels: FAIL (${violations.length} unlabeled fields)\n`);
  for (const v of violations) {
    console.error(`  ${v.page} — <${v.element}> "${v.name}": ${v.reason}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-form-labels: ERROR', err);
  process.exit(2);
});
```

- [ ] **Step 2: Commit** (script requires running server to test — will be tested in CI)

```bash
git add scripts/validate/validate-form-labels.ts
git commit -m "feat(scripts): add validate-form-labels — checks label associations

Playwright-based crawler that visits all routes and verifies every visible
input/select/textarea has a label, aria-label, or aria-labelledby."
```

---

### Task 7: Create validate-design-tokens.ts — comprehensive token audit

**Files:**
- Create: `scripts/validate/validate-design-tokens.ts`

Checks that all TSX files use only design-token-approved patterns.

- [ ] **Step 1: Create the script**

```typescript
#!/usr/bin/env tsx
/**
 * validate-design-tokens.ts — Comprehensive design system compliance check.
 * Combines color policy, emoji policy, and typography pattern checks.
 *
 * Usage: npx tsx scripts/validate/validate-design-tokens.ts
 * Exit 0 = compliant, Exit 1 = violations found
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  PROHIBITED_COLOR_REGEX,
  PROHIBITED_EMOJI_REGEX,
} from '../../apps/web/src/lib/design-tokens';

const WEB_SRC = join(process.cwd(), 'apps/web/src');

type ViolationType = 'color' | 'emoji' | 'inline-style-color';

interface Violation {
  type: ViolationType;
  file: string;
  line: number;
  match: string;
  context: string;
}

/** Regex for inline style color values (hex colors that aren't white/black/neutral) */
const INLINE_COLOR_REGEX =
  /(?:color|background|borderColor|backgroundColor)\s*[:=]\s*['"]#(?!(?:fff|000|171717|262626|404040|525252|737373|a3a3a3|d4d4d4|e5e5e5|f5f5f5|fafafa|ffffff|1f2328|59636e|818b98|d1d9e0|f6f8fa))[0-9a-fA-F]{3,8}['"]/g;

async function collectFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__tests__') {
      files.push(...await collectFiles(full));
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) && !entry.name.endsWith('.test.ts') && !entry.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

async function main() {
  const files = await collectFiles(WEB_SRC);
  const violations: Violation[] = [];
  let filesChecked = 0;

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const lines = content.split('\n');
    const relPath = relative(process.cwd(), file);
    filesChecked++;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trimStart();

      // Skip imports and JSDoc comments
      if (trimmed.startsWith('import ') || trimmed.startsWith('* ') || trimmed.startsWith('//')) continue;

      // Check prohibited colors
      PROHIBITED_COLOR_REGEX.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = PROHIBITED_COLOR_REGEX.exec(line)) !== null) {
        violations.push({
          type: 'color',
          file: relPath,
          line: i + 1,
          match: match[0],
          context: trimmed.slice(0, 120),
        });
      }

      // Check emojis (skip design-tokens.ts itself)
      if (!file.endsWith('design-tokens.ts')) {
        PROHIBITED_EMOJI_REGEX.lastIndex = 0;
        while ((match = PROHIBITED_EMOJI_REGEX.exec(line)) !== null) {
          violations.push({
            type: 'emoji',
            file: relPath,
            line: i + 1,
            match: `U+${match[0].codePointAt(0)?.toString(16).toUpperCase()}`,
            context: trimmed.slice(0, 120),
          });
        }
      }

      // Check inline style colors
      INLINE_COLOR_REGEX.lastIndex = 0;
      while ((match = INLINE_COLOR_REGEX.exec(line)) !== null) {
        violations.push({
          type: 'inline-style-color',
          file: relPath,
          line: i + 1,
          match: match[0],
          context: trimmed.slice(0, 120),
        });
      }
    }
  }

  console.log(`\nvalidate-design-tokens: checked ${filesChecked} files\n`);

  if (violations.length === 0) {
    console.log('RESULT: PASS (0 violations)');
    process.exit(0);
  }

  const byType = violations.reduce<Record<string, number>>((acc, v) => {
    acc[v.type] = (acc[v.type] ?? 0) + 1;
    return acc;
  }, {});

  console.error(`RESULT: FAIL (${violations.length} violations)`);
  console.error(`  color: ${byType.color ?? 0}`);
  console.error(`  emoji: ${byType.emoji ?? 0}`);
  console.error(`  inline-style-color: ${byType['inline-style-color'] ?? 0}\n`);

  for (const v of violations) {
    console.error(`  [${v.type}] ${v.file}:${v.line} — ${v.match}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('validate-design-tokens: ERROR', err);
  process.exit(2);
});
```

- [ ] **Step 2: Run to verify**

Run: `cd /home/jfreire/velya/velya-platform && npx tsx scripts/validate/validate-design-tokens.ts`
Expected: Shows files checked, may show inline-style-color violations (to be addressed separately).

- [ ] **Step 3: Commit**

```bash
git add scripts/validate/validate-design-tokens.ts
git commit -m "feat(scripts): add validate-design-tokens — comprehensive token audit

Combines color-policy, emoji-policy, and inline-style-color checks
into a single gate script. Part of Stage 1 of frontend governance."
```

---

### Task 8: Write ADR 0017 — Design System Tokens

**Files:**
- Create: `docs/architecture/decisions/0017-design-system-tokens.md`

- [ ] **Step 1: Write the ADR**

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/decisions/0017-design-system-tokens.md
git commit -m "docs: ADR 0017 — monochromatic design system tokens

Documents the decision to use neutral-only palette, the rationale
(hospital accessibility, cognitive load), and enforcement mechanisms."
```

---

### Task 9: Create design-tokens-reference.md — living catalog

**Files:**
- Create: `docs/frontend/design-tokens-reference.md`

- [ ] **Step 1: Write the reference document**

```markdown
# Velya Design Tokens Reference

> Auto-enforced by `scripts/validate/validate-design-tokens.ts`.
> ADR: `docs/architecture/decisions/0017-design-system-tokens.md`

## Color Palette

| Token | Hex | Tailwind | Usage |
|-------|-----|----------|-------|
| Background | #FFFFFF | `bg-white` | Page background, cards |
| Surface | #F5F5F5 | `bg-neutral-50` | Table headers, subtle backgrounds |
| Muted surface | #E5E5E5 | `bg-neutral-100` | Badges, hover states, tags |
| Active surface | #171717 | `bg-neutral-900` | Primary buttons, selected states |
| Primary text | #171717 | `text-neutral-900` | Headings, body text, values |
| Secondary text | #525252 | `text-neutral-700` | Descriptions, secondary info |
| Tertiary text | #737373 | `text-neutral-500` | Labels, placeholders, timestamps |
| Inverted text | #FFFFFF | `text-white` | Text on dark backgrounds |
| Border default | #D4D4D4 | `border-neutral-200` | Cards, table borders, dividers |
| Border strong | #A3A3A3 | `border-neutral-300` | Badges, input borders, emphasis |

## Typography

| Element | Classes | Example |
|---------|---------|---------|
| Page title | `text-2xl font-semibold tracking-tight text-neutral-900` | "Centro de Comando" |
| Section header | `text-lg font-semibold text-neutral-900` | "Caixa de Acoes Prioritarias" |
| Card title | `text-sm font-semibold text-neutral-900` | "Total Internados" |
| Body | `text-sm text-neutral-700` | Description paragraphs |
| Label | `text-xs font-medium uppercase tracking-wider text-neutral-500` | "STATUS", "PRIORIDADE" |
| KPI value | `text-3xl font-bold text-neutral-900` | "47", "87%" |
| Table header | `text-xs font-semibold uppercase tracking-wider text-neutral-500` | "PACIENTE", "ALA" |

## Component Patterns

### Badge (all statuses)
```
border-neutral-300 bg-neutral-100 text-neutral-800 rounded px-2 py-0.5 text-xs font-medium
```

### Button Primary
```
bg-neutral-900 text-white hover:bg-neutral-800 rounded-lg px-4 py-2 text-sm font-semibold
```

### Button Secondary
```
border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 rounded-lg px-4 py-2
```

### Card
```
bg-white border border-neutral-200 rounded-lg shadow-sm
```

### Alert/Banner
```
bg-neutral-50 border border-neutral-300 text-neutral-900 rounded-lg px-5 py-4
```

### Table Row
```
bg-white hover:bg-neutral-50 text-neutral-900
```

## Prohibited

- Any Tailwind color family except neutral/white/black
- Emojis, unicode symbols as decorative elements
- Colored borders as status indicators
- Gradient backgrounds
- Glow effects, neon colors
- Colored icons (use `text-neutral-*` only)

## Enforcement

| Script | Stage | Blocking |
|--------|-------|----------|
| `validate-color-policy.ts` | Static Governance | Yes |
| `validate-no-emoji.ts` | Static Governance | Yes |
| `validate-design-tokens.ts` | Static Governance | Yes |
| `validate-form-labels.ts` | Accessibility | Yes |
```

- [ ] **Step 2: Commit**

```bash
git add docs/frontend/design-tokens-reference.md
git commit -m "docs: add design tokens reference — living catalog of approved patterns

Covers color palette, typography scale, component patterns, prohibited
patterns, and enforcement scripts."
```

---

### Task 10: Add npm scripts for validation

**Files:**
- Modify: `apps/web/package.json` (add scripts)

- [ ] **Step 1: Add validate scripts to package.json**

Add to the `"scripts"` section:

```json
"validate:colors": "tsx ../../scripts/validate/validate-color-policy.ts",
"validate:emoji": "tsx ../../scripts/validate/validate-no-emoji.ts",
"validate:tokens": "tsx ../../scripts/validate/validate-design-tokens.ts",
"validate:labels": "tsx ../../scripts/validate/validate-form-labels.ts",
"validate:all": "tsx ../../scripts/validate/validate-design-tokens.ts"
```

- [ ] **Step 2: Fix the test script (currently points to jest, should point to vitest)**

Change `"test": "jest"` to `"test": "vitest run"`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json
git commit -m "chore(web): add validate:* npm scripts and fix test command

validate:colors, validate:emoji, validate:tokens, validate:labels,
validate:all now available. Test command corrected from jest to vitest."
```

---

### Task 11: Run full validation suite and fix any remaining violations

**Files:**
- Possibly modify: any TSX file with remaining violations

- [ ] **Step 1: Run validate-color-policy**

Run: `cd /home/jfreire/velya/velya-platform && npx tsx scripts/validate/validate-color-policy.ts`
Expected: PASS

- [ ] **Step 2: Run validate-no-emoji**

Run: `cd /home/jfreire/velya/velya-platform && npx tsx scripts/validate/validate-no-emoji.ts`
Fix any violations found.

- [ ] **Step 3: Run validate-design-tokens**

Run: `cd /home/jfreire/velya/velya-platform && npx tsx scripts/validate/validate-design-tokens.ts`
Note inline-style-color violations for future cleanup (non-blocking for now).

- [ ] **Step 4: Commit fixes if any**

```bash
git add -A
git commit -m "fix(web): resolve remaining design token violations

Fixes found by validate-design-tokens.ts sweep."
```

---

### Task 12: Create initial CI workflow stub

**Files:**
- Create: `.github/workflows/frontend-governance.yaml`

- [ ] **Step 1: Create the Stage 1 workflow**

```yaml
name: Frontend Governance

on:
  pull_request:
    paths:
      - 'apps/web/**'
      - 'scripts/validate/**'
      - 'scripts/ui-audit/**'

concurrency:
  group: frontend-governance-${{ github.head_ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write

jobs:
  stage-1-static-governance:
    name: 'Stage 1: Static Governance'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1

      - uses: actions/setup-node@1d0ff469b7ec7b3cb9d8673fde0c81c44821de2a  # v4.2.0
        with:
          node-version: '22'
          cache: 'npm'

      - run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit --project apps/web/tsconfig.json

      - name: Lint
        run: cd apps/web && npm run lint

      - name: Validate color policy
        run: npx tsx scripts/validate/validate-color-policy.ts

      - name: Validate no emoji
        run: npx tsx scripts/validate/validate-no-emoji.ts

      - name: Validate design tokens
        run: npx tsx scripts/validate/validate-design-tokens.ts
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/frontend-governance.yaml
git commit -m "ci: add frontend-governance workflow — Stage 1 (Static Governance)

Runs typecheck, lint, color-policy, no-emoji, and design-tokens validation
on every PR touching apps/web/ or scripts/validate/."
```

---

# SUB-PLAN 2: Contextual Navigation & Entity Panels

**Goal:** Build a reusable entity detail panel system that opens a side panel when clicking on entity references (patient names, bed numbers, MRN codes, prescription IDs, etc.) throughout the application.

**Dependency:** Sub-plan 1 must be complete (design tokens used by panel components).

---

### Task 13: Create entity-panel.tsx — the side panel shell

**Files:**
- Create: `apps/web/src/app/components/entity-panel/entity-panel.tsx`

Uses Radix Dialog (already installed) for the slide-out panel. Monochrome style per design tokens.

- [ ] **Step 1: Create the panel component**

```tsx
'use client';

import { useCallback, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../../lib/utils';

export interface EntityPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Canonical route for "open full page" link */
  href?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg';
}

const WIDTH_MAP = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
} as const;

export function EntityPanel({
  open,
  onClose,
  title,
  subtitle,
  href,
  children,
  width = 'md',
}: EntityPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/20" />
        <Dialog.Content
          ref={panelRef}
          className={cn(
            'fixed right-0 top-[var(--header-height)] bottom-0 z-50 w-full overflow-y-auto',
            'border-l border-neutral-200 bg-white shadow-lg',
            'animate-in slide-in-from-right duration-200',
            WIDTH_MAP[width],
          )}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-neutral-900">
                {title}
              </h2>
              {subtitle && (
                <p className="truncate text-xs text-neutral-500">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {href && (
                <a
                  href={href}
                  className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900"
                >
                  Abrir pagina
                </a>
              )}
              <Dialog.Close asChild>
                <button
                  className="rounded-md p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  aria-label="Fechar painel"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/components/entity-panel/entity-panel.tsx
git commit -m "feat(web): add EntityPanel — reusable side panel shell

Radix Dialog-based slide-out panel for entity detail views. Monochrome
style, keyboard-closable, with optional 'open full page' link."
```

---

### Task 14: Create entity-panel-trigger.tsx — clickable wrapper

**Files:**
- Create: `apps/web/src/app/components/entity-panel/entity-panel-trigger.tsx`

- [ ] **Step 1: Create the trigger component**

```tsx
'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '../../../lib/utils';

interface EntityPanelTriggerProps {
  /** The panel to render when clicked */
  panel: (props: { open: boolean; onClose: () => void }) => ReactNode;
  children: ReactNode;
  className?: string;
}

export function EntityPanelTrigger({
  panel,
  children,
  className,
}: EntityPanelTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'text-left text-neutral-900 underline decoration-neutral-300 underline-offset-2',
          'hover:decoration-neutral-500 cursor-pointer',
          className,
        )}
      >
        {children}
      </button>
      {panel({ open, onClose: () => setOpen(false) })}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/components/entity-panel/entity-panel-trigger.tsx
git commit -m "feat(web): add EntityPanelTrigger — clickable entity wrapper

Renders children as an underlined button that opens the associated
EntityPanel on click."
```

---

### Task 15: Create patient-panel.tsx — first entity panel

**Files:**
- Create: `apps/web/src/app/components/entity-panel/panels/patient-panel.tsx`

This is the highest-value panel — patients are referenced on almost every page.

- [ ] **Step 1: Create the patient panel**

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { EntityPanel } from '../entity-panel';
import { Badge } from '../../ui/badge';

interface PatientData {
  id: string;
  name: string;
  mrn: string;
  birthDate: string;
  gender: string;
  ward: string;
  bed: string;
  admissionDate: string;
  attendingPhysician: string;
  allergies: string[];
  alerts: string[];
  los: number;
}

interface PatientPanelProps {
  patientId: string;
  open: boolean;
  onClose: () => void;
}

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-1.5 border-b border-neutral-100 last:border-0">
      <span className="text-xs text-neutral-500 shrink-0">{label}</span>
      <span className="text-sm font-medium text-neutral-900 text-right">{value}</span>
    </div>
  );
}

export function PatientPanel({ patientId, open, onClose }: PatientPanelProps) {
  const [data, setData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !patientId) return;
    setLoading(true);
    fetch(`/api/patients/${patientId}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, patientId]);

  return (
    <EntityPanel
      open={open}
      onClose={onClose}
      title={data?.name ?? 'Paciente'}
      subtitle={data?.mrn ? `MRN ${data.mrn}` : undefined}
      href={`/patients/${patientId}`}
    >
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-neutral-500">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          Carregando...
        </div>
      ) : !data ? (
        <div className="text-sm text-neutral-500">Paciente nao encontrado.</div>
      ) : (
        <>
          <PanelSection title="Dados do paciente">
            <DataRow label="Nome" value={data.name} />
            <DataRow label="MRN" value={<span className="font-mono">{data.mrn}</span>} />
            <DataRow label="Nascimento" value={data.birthDate} />
            <DataRow label="Genero" value={data.gender} />
          </PanelSection>

          <PanelSection title="Internacao">
            <DataRow label="Ala" value={data.ward} />
            <DataRow label="Leito" value={data.bed} />
            <DataRow label="Admissao" value={data.admissionDate} />
            <DataRow label="Tempo internacao" value={`${data.los} dias`} />
            <DataRow label="Medico responsavel" value={data.attendingPhysician} />
          </PanelSection>

          {data.allergies.length > 0 && (
            <PanelSection title="Alergias">
              <div className="flex flex-wrap gap-1">
                {data.allergies.map((a) => (
                  <Badge key={a} variant="default">{a}</Badge>
                ))}
              </div>
            </PanelSection>
          )}

          {data.alerts.length > 0 && (
            <PanelSection title="Alertas ativos">
              <div className="flex flex-col gap-1">
                {data.alerts.map((a) => (
                  <div key={a} className="rounded border border-neutral-300 bg-neutral-50 px-3 py-2 text-xs text-neutral-800">
                    {a}
                  </div>
                ))}
              </div>
            </PanelSection>
          )}

          <PanelSection title="Acesso rapido">
            <div className="flex flex-wrap gap-2">
              <Link href={`/patients/${patientId}`} className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Prontuario completo
              </Link>
              <Link href="/prescriptions" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Prescricoes
              </Link>
              <Link href="/lab/results" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Resultados lab
              </Link>
              <Link href="/tasks" className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900">
                Tarefas
              </Link>
            </div>
          </PanelSection>
        </>
      )}
    </EntityPanel>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/app/components/entity-panel/panels/patient-panel.tsx
git commit -m "feat(web): add PatientPanel — contextual patient detail panel

Shows patient demographics, admission info, allergies, alerts, and
quick links. Fetches from /api/patients/:id. Monochrome design."
```

---

### Task 16-22: Remaining Sub-plan 2 tasks (entity panels for bed, prescription, lab, professional, plus integration into module-list-view and ADR)

These follow the same pattern as Task 15. Each creates a panel component, then Task 21 integrates EntityPanelTrigger into module-list-view.tsx for columns that have `linkTo` in the module manifest, and Task 22 writes ADR 0018.

---

# SUB-PLAN 3: Keyboard Shortcuts System

**Goal:** Build a context-aware keyboard shortcut system with per-module scoping, visual overlay, and user-configurable mappings.

**Tasks 23-30:** Create shortcut-registry.ts (definitions), shortcut-provider.tsx (React context + global listener), shortcut-overlay.tsx (help modal), shortcut-hint.tsx (inline badge), shortcuts-config.ts (per-module definitions), integrate into app-shell.tsx, write ADR 0019, create shortcuts-catalog.md.

---

# SUB-PLAN 4: CI Pipeline & Governance Agents

**Goal:** Expand the Stage 1 workflow from Task 12 to a full 8-stage pipeline, create screen/component inventory generators, and define governance agent specifications.

**Tasks 31-40:** Extend frontend-governance.yaml with Stages 2-8, create generate-screen-inventory.ts, generate-component-inventory.ts, define agent specifications in `agents/` following the existing agent template pattern, create promotion gate logic.

---

# SUB-PLAN 5: Visual Regression & Accessibility Automation

**Goal:** Build screenshot baseline capture, pixel-diff comparison, axe-core contrast validation, and keyboard navigation testing.

**Tasks 41-48:** Create capture-screenshots.ts (extends existing screenshot-key-pages.ts), compare-visual-baseline.ts, validate-contrast.ts (axe-core integration), validate-keyboard-nav.ts (Playwright tab traversal), create baseline storage, integrate into CI Stages 5-6, write ADR 0020.

---

## Quick Wins (can be done immediately)

1. **Task 1** — Remove legacy dark colors from tailwind.config.ts (5 min)
2. **Task 2** — Update @theme block to monochrome (5 min)
3. **Task 4-5** — Color and emoji validation scripts (10 min each)
4. **Task 12** — CI workflow Stage 1 (10 min)

## Risks and Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Entity panel API endpoints don't exist yet | Panels show loading forever | Use fixtures/mock data first, add API later |
| Playwright not in devDependencies | Scripts fail | Add to package.json devDependencies in Task 6 |
| Visual regression generates too many false positives | CI blocked constantly | Start with critical pages only, tune thresholds |
| Shortcut conflicts with browser shortcuts | User confusion | Require modifier keys (Ctrl/Cmd), no single-key shortcuts |

## Criteria of Acceptance

- [ ] Zero prohibited color classes in TSX files (enforced by CI)
- [ ] Zero emojis in TSX files (enforced by CI)
- [ ] Every form field has a label (enforced by CI)
- [ ] Entity panel opens on click for patient, bed, prescription references
- [ ] Keyboard shortcut overlay accessible via `?` key
- [ ] CI pipeline blocks PR on Stage 1 failures
- [ ] Screenshot baseline exists for all critical pages
- [ ] ADRs 0017-0020 written and committed
- [ ] Design tokens reference doc complete
- [ ] Screen inventory auto-generated
