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
