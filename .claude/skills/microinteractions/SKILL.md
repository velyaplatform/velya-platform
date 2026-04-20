---
name: microinteractions
description: 'Design the small details -- triggers, rules, feedback, loops and modes -- that separate good products from great ones. Use when the user mentions "microinteraction", "button feedback", "loading state", "toggle design", "animation detail", "interaction polish", "state transitions", or "input feedback".'
license: MIT
metadata:
  author: wondelai
  version: "1.1.0"
---

# Microinteractions Framework

By Dan Saffer. The difference between a product you tolerate and one you love is almost always in the microinteractions.

## Core Structure

Every microinteraction has four parts:

### 1. Triggers
- **Manual**: tap, click, swipe, voice command
- **System**: time elapsed, threshold reached, data received
- Must communicate: that it exists, what it does, current state
- States: default, hover, active, disabled, loading -- must be visually distinct
- Invisible triggers (gestures) must have visible alternatives

### 2. Rules
- Define what happens once triggered
- Should feel natural and match mental models
- Constrain inputs to prevent errors
- Handle edge cases: zero, maximum, repeated triggers, interruption
- Simple rules produce complex-feeling interactions

### 3. Feedback
- Must be immediate (under 100ms for direct manipulation)
- Use least noticeable feedback that still communicates
- Feedback proportional to significance: small action = small feedback
- Visual is primary; audio/haptic are supplementary
- Use existing elements when possible (animate the button, not a separate notification)
- Progress indicators reduce perceived wait time

### 4. Loops and Modes
- Open loops: continue until stopped (repeating alarm)
- Long loops: change over time (progressive reduction)
- Modes are dangerous -- same action should produce same result
- If modes needed, make current mode extremely visible

## Signature Moments
- Distinctive microinteraction that becomes brand identity
- Must be functional first, delightful second
- Facebook Like, iPhone slide-to-unlock, Slack loading messages
- Restraint: if everything is signature, nothing is

## Quick Diagnostic

| Question | If No | Action |
|----------|-------|--------|
| Clear, discoverable trigger? | Can't initiate | Add visible control |
| Trigger shows current state? | Can't tell state | Add distinct visual states |
| Immediate feedback? | Users wonder if it worked | Visual response within 100ms |
| Feedback matches significance? | Small actions dramatic | Scale feedback to event importance |
| Interaction evolves over time? | Power users see beginner hints | Progressive reduction |
