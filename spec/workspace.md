# Workspace Page — Unstyled Spec

**Status:** Ready for styling (tokens only). This is the stable spec for the workspace page with zones A-H per the 20/80 tool scope.

---

## Layout zones (2fr canvas / 1fr inspector, independent scrolling on desktop)

```
+───────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────┐  <Row A> header                   │
│  │      Quil  •  Project name   │                                 │
│  │  Saved  •  [Generate] [Intake] │  <Buttons: toolbar only>        │
│  └───────────────────────────────┘                                 │
│───────────────────────────────────────────────────────────────────────┤
│  ┌───────────┬───────────────────┐  <Row B> page tabs + zoom         │
│  │  P1   P2   P3   P4          │  Canvas area (Row C)             │
│  │  │  │  │  │                 │  Includes:
│  │  │  │  │  │                 │    • Hover highlights + selection   │
│  │  │  │  │  │                 │    • In‑place text edits           │
│  │  │  │  │  │                 │    • Resize handles (corner/edge)   │
│  │  │  │  │  │                 │    • Drag‑and‑drop reorder          │
│  │  ───────   │  ────────────────┼─────────────────────────────────────┤
│  │Zoom out   │    75%           │  ┌───────────────────────────────┐ │
│  │   │   │   │   │   │           │  │                               │ │
│  │   │   │   │   │   │           │  │                               │ │
│  └───────────┴───────────────────┘  <Canvas> preview of current page  │ │
│  ┌───────────────────────────────┐  (transformed with zoom)        │ │
│  │   Canvas content              │  No free positioning; flows only  │ │
│  └───────────────────────────────┘                                 │ │
├─ F Inspector (right) ──────────────────────────────────────────────┤
│  • Selection header (kind, origin, drift)                           │
│  • Content (text fields)                                           │
│  • Colour (fills, text)                                             │
│  • Type (size, weight, line‑height, align)                          │
│  • Space & shape (padding, radius, shadow)                          │
│  • Decision scope (live count) + contrast badge                     │
│  • Prompt box (pinned bottom, see Row G)                           │
│  • Variant tray (pinned bottom, see Row G)                          │
│                                                                    │
│  Resizable width; min 320px; cannot shrink canvas panel.          │
│  (Only visible when an element is selected)                         │
│                                                                    │
│  G Prompt box (pinned bottom of inspector)                          │
│  ┌───────────────────────────────┐                                 │
│  │  Describe the change…           │  Text input, one line, 256 max  │
│  │  [Generate 3 variants]          │  Generates candidates            │
│  │  AI key: [status]               │                                 │
│  └───────────────────────────────┘                                 │
│  ┌───────────────────────────────┐                                 │
│  │  Variant tray (only when generating)                            │
│  │  • Card 1 (live miniature)       │  • Preview + headline + badges   │
│  │  • Card 2                       │  • Approve / Reject buttons      │
│  │  • Card 3                       │  • Regenerate button             │
│  └───────────────────────────────┘                                 │
│                                                                    │
│  H Overlays (not drawn)                                            │
│    • Colour picker                                             │
│    • Insert “/” menu (tool 10)                                   │
│    • Command palette (tool 14)                                   │
│    • Context menus                                            │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Zone A — Top bar (Row A)

- **Left**: Quil icon + feather, project name (heading-2, colour-100)
- **Middle** (flex:1): Save status badge + AI key chip + multi‑tab banner
- **Right**: Toolbar actions (Generate, Intake, Undo, Redo)
- **Right (overflow)**: Settings icon (opacity‑70, aria‑label "Settings")

All actions are toolbar‑only; nothing depends on selection.

---

## Zone B — Left rail (collapsed by default, B in tool scope)

Pages, Layers, Decisions.

Default collapsed to keep the 2fr/1fr canvas + inspector split.

---

## Zone C — Canvas (Row B + Row C)

Contains the viewport, zoom controls and page tabs.

- **Page tabs**: horizontal bar, active tab highlighted (var(--quil-accent))
- **Zoom**: buttons + centred percentage label
- **Canvas**: `transform: scale(zoom)`; independent scrolling; only direct manipulation (select, edit, resize, reorder)
- **Variants tray** and **Prompt box** are **outside** the canvas (see Row G & H). 

---

## Zone D — Floating toolbar (Row H overlay)

Four buttons, centred, accessible via "/” shortcut:
- Select, Text, Insert, Hand

Only floating chrome layer; all other tools are either toolbar (A), panel (F), or overlay (H).

---

## Zone E — Variants tray (Row G, bottom of inspector)

Three candidate cards with live miniatures; approves/rejects/regenerates.
Always visible when `generationOpen` or `genCandidates.length > 0`.

---

## Zone F — Inspector (right panel)

Shows property groups for the selected element:

### Selection header
Element name, kind, origin (drift count) and drift notice.

### Groups (only those that apply to the selected kind)
1. **Content** (text, label) – one field per schema property
2. **Colour** (fills, text) – swatches for `bgColor`, `color`, `textColor`
3. **Type** (size, weight, line‑height, align) – font controls
4. **Space & shape** (padding, radius, shadow) – for sections, cards, buttons
5. **Decision** (scope + contrast badge) – instance/page/global decision count + contrast status

Groups that are irrelevant for the current element are hidden.

### Prompt box (pinned to bottom)
Visible when no element selected:
- Project brief (heading‑lg)
- "Start with your brief. Quil works for any site…" (text‑sm)
- [Start intake] button (solid, label bg = current bg)

When element selected: inspector expands upward (existing)

---

## Zone G — Prompt box (inspector bottom)

Only when no element selected.
See above.

---

## Zone H — Overlays (positioned, not drawn in grid)

Colour picker, "/” menu, command palette, context menus.

---

## Tools placement per the 20/80 tool scope

| Tool | Canvas (C) | Inspector (F) / Toolbar (D) | Keyboard (H) | Entry point priority |
|------|------------|------------------------------|---------------|----------------------|
| 1 Select | click, hover outline | Layers list (B) | V, Tab | Canvas first |
| 2 Edit text | double‑click, in‑place | Content field (F) | Enter, T | Canvas first |
| 3 Colour | selection toolbar swatch | Colour group (F) | C | Canvas first |
| 4 Variants/Approve | preview on canvas | Variants tray (E) | G, 1‑3, A | Panel first |
| 5 Scope | — | Scope row beside Approve (E) and in inspector (F) | S | Panel |
| 6 Undo/Redo | — | Top bar (A) | Cmd/Ctrl+Z | Toolbar |
| 7 Type | selection toolbar | Type group (F) | Cmd/Ctrl+B | Panel |
| 8 Space & shape | corner/edge handles | Space & shape group (F) | [, ] | Panel first |
| 9 Resize | 8 handles or edge handles | Width/Height fields (F) | arrow keys nudge | Canvas first |
| 10 Insert | — | Floating toolbar Insert (D) | / , Alt+↑↓ | Toolbar |
| 11 Zoom | — | Zoom control (C) | Cmd/Ctrl+ +/ - | Panel |
| 12 Duplicate/ delete | context menu | Selection header menu (F) | Cmd/Ctrl+D, Backspace | Panel |
| 13 Decisions list | From Home badges (C) | Decisions list (B) | D | Panel |
| 14 Command palette | — | Top bar search (A) | Cmd/Ctrl+K | Toolbar |

---

## Inspector group order (top to bottom)

1. Selection header (always visible)
2. Content (if present)
3. Colour (if present)
4. Type (if present)
5. Space & shape (if present)
6. Decision (always, when element selected)

Groups collapse/expand and remember state.

---

## State visibility (non‑toast)

- Save status, AI key status, Read‑only banner, Recovery screen — top bar
- Generation in progress — toolbar (disabled buttons)
- Contrast/drift badges — inspector
- Undo/redo disabled — top bar

---

## Anti‑slop commitments (design reasons, not CSS)

- No decorative shadows on header or tabs
- Colour never sole state indicator (contrast badge shows text + icon)
- No uniform spacing — use design tokens hierarchy (within-element → group → section)
- No glassmorphism/gradients; solid surfaces only
- No oversized hero headings — adhere to heading scale

---

## Token dependencies (semantic only)

| Custom prop | Purpose |
|--------------|---------|
| `--quil-header-height` | Header region height |
| `--quil-toolbar-height` | Page‑tab+zoom row height |
| `--quil-tools-min-width` | Minimum inspector width |
| `--quil-canvas-gap` | Gap between canvas and inspector |
| `--quil-page-tab-height` | Page‑tab button height |

All defined in `src/ui/tokens.css`; this spec only references them.

---

## Accessibility (principles)

- [ ] Keyboard order: header → canvas → inspector → header
- [ ] Focus visible via `--quil-focus-ring` (add token)
- [ ] Touch targets ≥ 44px (`--quil-target-min`, `--quil-target-icon`)
- [ ] WCAG 2.2 AA contrast (already validated by tokens)
- [ ] Reduced motion disables zoom / scroll animations
- [ ] Screen‑reader labels on icon‑only buttons
- [ ] Escape closes open panels (generation, variants)
- [ ] No colour‑only state communication (contrast badge already includes text)

---

## Responsive behavior (breakpoints)

| Breakpoint | Change |
|------------|--------|
| 1100px+ (desktop) | 2fr/1fr grid, independent scrolling panels |
| 640px–1099px | Stack: canvas on top (full width), tools below (full width) — header buttons vertically |
| < 640px | Hamburger menu for header buttons; tools become right drawer; page tabs become dropdown |

---

*End of unstyled spec.*
