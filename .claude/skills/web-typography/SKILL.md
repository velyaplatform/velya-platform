---
name: web-typography
description: 'Select, pair, and implement typefaces for web projects. Use when the user mentions "font pairing", "which typeface", "line height", "responsive typography", "web font loading", "type hierarchy", "variable fonts", or "typographic scale".'
license: MIT
metadata:
  author: wondelai
  version: "1.2.0"
---

# Web Typography

By Jason Santa Maria. Typography is the voice of your content.

## Core Principle

**The "clear goblet" principle:** Typography should be like a crystal-clear wine glass -- focus on the wine (content), not the glass (type). Readers don't read, they scan (7-9 character saccades).

## Two Contexts

| Context | Purpose | Priorities |
|---------|---------|------------|
| **Type for a moment** | Headlines, buttons, nav | Personality, impact |
| **Type to live with** | Body text, articles | Readability, comfort |

## Key Measurements

- **Body font size**: 16px minimum; prefer 18px for reading-heavy
- **Line length**: 45-75 characters ideal, 66 optimal. Use `max-width: 65ch`
- **Line height**: 1.4-1.8 for body; 1.1-1.25 for headlines
- **Heading scale**: 1.2-1.5 ratio between levels

## Evaluating Typefaces

- Consistent stroke weights, even color across text blocks
- Good kerning pairs (AV, To, Ty)
- Adequate x-height (larger = better screen readability)
- Open counters and apertures (a, e, c shapes)
- Distinct letterforms (Il1, O0, rn vs m)
- Test with REAL content, not Lorem ipsum

## Pairing Rules

- Two typefaces maximum
- Contrast types: structure (serif+sans), weight, era, width
- Same designer strategy often works (FF Meta + FF Meta Serif)
- Superfamilies eliminate guesswork (Roboto + Roboto Slab)
- When in doubt, one family with weight variation

## Responsive & Performance

```css
/* Fluid typography */
body { font-size: clamp(1rem, 0.9rem + 0.5vw, 1.25rem); }
h1 { font-size: clamp(2rem, 1.5rem + 2vw, 3.5rem); }

/* Performant loading */
@font-face {
  font-family: 'Custom';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0000-00FF;
}
```

- Total font payload under 200KB
- Use WOFF2, subset aggressively
- Preload critical fonts
- Variable fonts replace multiple static weight files

## Building Hierarchy

- Three levers: size, weight, color
- Vary one or two between adjacent levels
- The squint test: squint -- if everything blurs to sameness, distinction is too subtle
- Consistent ratio (1.2-1.5) between heading levels

## Quick Diagnostic

| Question | If No | Action |
|----------|-------|--------|
| Body text >= 16px? | Too small | Increase to 16-18px |
| Line length < 75 chars? | Eye loses position | Add `max-width: 65ch` |
| Line height >= 1.4 body? | Cramped | Increase to 1.5-1.7 |
| Sufficient contrast between levels? | Hierarchy invisible | Increase size/weight differences |
| Font payload < 200KB? | Slow loading | Subset, WOFF2, variable fonts |
