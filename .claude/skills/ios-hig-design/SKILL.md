---
name: ios-hig-design
description: 'Apple Human Interface Guidelines for iOS. Use when the user mentions "iOS app", "iPhone interface", "SwiftUI design", "mobile app design", "tab bar", "navigation bar", or "Dynamic Type".'
license: MIT
metadata:
  author: wondelai
  version: "1.0.0"
---

# iOS HIG Design

Three pillars: clarity, deference, depth.

## Key Principles

### Layout & Safe Areas
- Design for smallest screen first (375pt width)
- Minimum touch target: 44x44pt
- Standard spacing: 8/16/24pt
- Never place interactive elements under notch/Dynamic Island/home indicator

### Typography & Dynamic Type
- San Francisco (SF Pro) typeface
- Large Title: 34pt Bold; Body: 17pt Regular; Caption: 12-13pt
- Always use semantic text styles (`.title`, `.body`, `.caption`)
- Support Dynamic Type at all sizes

### Color & Dark Mode
- Use semantic system colors (`Color(.label)`, `Color(.systemBackground)`)
- Dark Mode is expected, not optional
- 4.5:1 minimum contrast ratio

### Navigation
- Tab bar: 2-5 destinations, always visible
- Navigation bar: back (top-left), title (center), actions (top-right)
- Never use hamburger menus on iOS
- Modals for focused tasks, dismiss via swipe-down

### Controls
- Match keyboard type to input (`.emailAddress`, `.phonePad`)
- Destructive actions in red with confirmation
- Swipe actions on list rows

### Accessibility
- Every interactive element needs `.accessibilityLabel`
- VoiceOver, Dynamic Type, Switch Control support
- Never convey meaning through color alone

### Gestures & Haptics
- Never override: swipe-back, swipe-down-dismiss, pull-to-refresh
- Three haptic types: impact, notification, selection
- Haptics should be subtle and meaningful
