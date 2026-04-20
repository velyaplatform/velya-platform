---
name: refactoring-ui
description: 'Audit and fix visual hierarchy, spacing, color, and depth in web UIs. Use when the user mentions "my UI looks off", "fix the design", "Tailwind styling", "color palette", "visual hierarchy", "design system", "spacing scale", or "component styling".'
license: MIT
metadata:
  author: wondelai
  version: "1.2.0"
---

# Refactoring UI Design System

A practical, opinionated approach to UI design by Adam Wathan & Steve Schoger.

## Core Principle

**Design in grayscale first. Add color last.** This forces proper hierarchy through spacing, contrast, and typography before relying on color as a crutch.

## Scoring

Rate UI 0-10. A 10/10 means full alignment. Always provide current score and improvements needed.

## The 7 Principles

### 1. Visual Hierarchy

- Not everything can be important. Three levers: size, weight, and color
- Combine levers, don't multiply -- primary text = large OR bold OR dark, not all three
- Labels are secondary -- they support the data, not compete with it
- Button hierarchy: primary (filled), secondary (outlined), tertiary (text only)

### 2. Spacing & Sizing

- Constrained spacing scale: 4, 8, 16, 24, 32, 48, 64px
- Start with too much white space, then remove
- Spacing between groups > spacing within groups
- Text blocks: 45-75 characters (`max-w-prose` or ~65ch)
- Forms: max 300-500px width

### 3. Typography

- Modular type scale: 12, 14, 16, 20, 24, 30, 36px (1.25 ratio)
- Headings: tight line-height (1.0-1.25); body: relaxed (1.5-1.75)
- Two fonts maximum
- Avoid font weights below 400 for body text

### 4. Color

- Each color needs 5-9 shades (50-900)
- Pure grays look lifeless -- add subtle saturation
- HSL adjustments: lighter = higher lightness, lower saturation, shift hue toward 60deg
- Body text minimum 4.5:1 contrast ratio
- Use `#374151` (gray-700) on white, not lighter grays

### 5. Depth & Shadows

- Shadow scale: `shadow-sm` (buttons) -> `shadow-md` (cards) -> `shadow-lg` (dropdowns) -> `shadow-xl` (modals)
- Two-part shadows: tight dark + larger softer
- Shadow color: transparent dark, not opaque gray

### 6. Images & Icons

- Icons sized relative to context
- `object-fit: cover` with fixed `aspect-ratio`
- Empty states: illustrations + clear CTA

### 7. Layout & Composition

- Left-align text by default; center only short headlines, hero, single-action CTAs
- Let images bleed to edges, overlap containers
- Vary visual treatment in lists

## Quick Diagnostic

| Question | If No | Action |
|----------|-------|--------|
| Does hierarchy read when squinting? | Elements competing | Increase contrast between primary/secondary |
| Does it work in grayscale? | Relying on color | Strengthen size/weight/spacing hierarchy |
| Is there enough white space? | Too dense | Increase spacing between groups |
| Are labels de-emphasized vs values? | Labels competing | Make labels smaller, lighter, uppercase-small |
| Does spacing follow consistent scale? | Visual noise | Use 4/8/16/24/32/48/64 scale only |
