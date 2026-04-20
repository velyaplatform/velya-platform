---
name: top-design
description: 'Create award-winning digital experiences at Awwwards/FWA level. Use when the user mentions "award-winning design", "Awwwards", "3D web", "immersive experience", "creative development", "signature animation", "custom scroll", "dramatic typography", or "world-class UI".'
license: MIT
metadata:
  author: wondelai
  version: "1.0.0"
---

# Top-Design: Award-Winning Digital Experiences

Inspired by Locomotive, Studio Freight, AREA 17, Active Theory, Hello Monday.

## Core Principle

**Every pixel is intentional -- nothing default, nothing accidental.** Typography IS the design, motion creates emotion, white space is a weapon, performance is non-negotiable (60fps or nothing).

## Scoring Categories (Each 0-10)

- **Typography (25%)**: 10 = typography IS the design, gasping moments, custom/variable fonts
- **Visual Composition (25%)**: 10 = magnetic compositions, unexpected scale shifts
- **Motion & Interaction (20%)**: 10 = motion tells stories, scroll feels invented
- **Color & Atmosphere (15%)**: 10 = colors feel invented for this project
- **Details & Craft (15%)**: 10 = every micro-detail considered

## The Seven Pillars

### 1. Typography as Architecture
- Scale contrast minimum 10:1 (180px headline / 14px body)
- Negative tracking on large type (-0.02em to -0.05em)
- Premium foundries: Pangram Pangram, Dinamo, Grilli Type, Klim
- Never Inter, Roboto, Arial for hero experiences
- Variable fonts for weight animation on hover

### 2. Layout & Composition
- White space as weapon -- tension, not emptiness
- Asymmetric balance: offset from center, images bleed beyond containers
- Unexpected scale shifts create rhythm
- The screenshot test: if nobody would screenshot it, you're missing signature moments

### 3. Motion & Animation
- Custom easing MANDATORY: `cubic-bezier(0.16, 1, 0.3, 1)` (expo out)
- Banned: `ease`, `ease-in`, `ease-out`, `linear`
- Page load choreography: structure (0-200ms), hero (200-600ms, 80ms stagger), subtitle (400-800ms), nav (600-900ms)
- Smooth scroll via Lenis or Locomotive Scroll
- 60fps non-negotiable

### 4. Color & Contrast
- Never pure #000000 or #ffffff -- use warm variants (#0a0a0a, #fafaf9)
- Monochromatic tension: 95% one color, 5% accent
- Functional hierarchy: text-primary, text-secondary (60% opacity), text-tertiary (40%)
- Accent color sparingly for maximum impact

### 5. Scroll-Based Design
- Smooth scroll is foundation (Lenis)
- Parallax only on decorative non-essential elements
- Pinned sections for storytelling beats
- Progressive scroll-triggered reveals
- Scroll velocity can modulate animation speed

### 6. Performance & Loading
- Fonts: subset, preload, `font-display: swap`
- Images: WebP/AVIF with responsive srcset
- Only animate `transform` and `opacity` (GPU-accelerated)
- LCP under 2.5s, CLS near zero

### 7. Micro-Interactions
- Branded `::selection` colors
- Every link has considered hover state
- Focus states: beautiful AND accessible
- Loading/empty states are designed
- Smart quotes, proper dashes, `text-wrap: balance`

## Design Process

1. Define: BRAND ESSENCE, VISUAL TENSION, SIGNATURE MOMENT, TECHNICAL AMBITION
2. Design the signature moment FIRST (not the header)
3. Choose display typeface -- it dictates everything else
4. Prototype animations early -- motion is not polish
5. Ship with restraint: 3 things perfect > 10 mediocre

## Key Anti-Patterns
- Using system fonts for hero experiences
- Default browser scroll
- `ease`/`linear` easing curves
- Center-aligning everything
- Purple-to-blue gradient heroes
- Emoji in professional interfaces
- Animations blocking user interaction
