---
name: ux-heuristics
description: 'Evaluate and improve interface usability using heuristic analysis. Use when the user mentions "usability audit", "UX review", "users are confused", "heuristic evaluation", "Nielsen heuristics", "cognitive walkthrough", or "usability testing".'
license: MIT
metadata:
  author: wondelai
  version: "1.3.0"
---

# UX Heuristics Framework

Based on Steve Krug and Jakob Nielsen. Users don't read, they scan. They don't make optimal choices, they satisfice.

## Core Principle

**"Don't Make Me Think"** - Every page should be self-evident.

## Krug's Three Laws

### 1. Don't Make Me Think
- Clever names lose to clear names every time
- "Sign in" not "Access your account portal"
- If a label needs explanation, simplify the label

### 2. It Doesn't Matter How Many Clicks
- Three mindless, confident clicks beat one confusing click
- Users abandon when confused, not when they've clicked too many times

### 3. Get Rid of Half the Words
- Then get rid of half of what's left
- Before: "Please kindly note that you will need to enter your password in order to proceed"
- After: "Enter your password to continue."

### 4. The Trunk Test
Any random page must answer: What site? What page? Major sections? Options here? Where am I in hierarchy? Where's search?

## Nielsen's 10 Heuristics

1. **Visibility of System Status** - Progress bars, confirmations, skeleton screens
2. **Match System and Real World** - "Sign in" not "Authenticate"
3. **User Control and Freedom** - Undo beats "Are you sure?" dialogs
4. **Consistency and Standards** - Same words/styles mean same thing throughout
5. **Error Prevention** - Date pickers over text fields, autocomplete, defaults
6. **Recognition Over Recall** - Show options, don't require memorization
7. **Flexibility and Efficiency** - Keyboard shortcuts, bulk actions, Cmd+K
8. **Aesthetic and Minimalist Design** - Every element must earn its place
9. **Help Users Recover from Errors** - What happened, why, how to fix
10. **Help and Documentation** - Searchable, task-focused, contextual

## Severity Rating

| Severity | Description | Priority |
|----------|-------------|----------|
| 0 | Not a problem | Ignore |
| 1 | Cosmetic | Fix if time |
| 2 | Minor - causes delay | Schedule fix |
| 3 | Major - significant task failure | Fix soon |
| 4 | Catastrophic - prevents completion | Fix immediately |

## Quick Diagnostic

| Question | If No | Action |
|----------|-------|--------|
| Can I tell what site/page this is immediately? | Lost users | Add logo, page title, breadcrumbs |
| Is the main action obvious? | Users don't know what to do | Single primary CTA |
| Does system show what's happening? | Trust lost | Loading states, confirmations |
| Are error messages helpful? | Users stuck | Plain language with specific fix |
| Can users undo or go back? | Users afraid to act | Add undo, cancel, back everywhere |
