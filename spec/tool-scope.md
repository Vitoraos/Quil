# 20/80 Tool Scope — Workspace (prepared 3 Nov 2026)

Source: Quil UI redesign plan sections 1-10. The 14 tools covering day-to-day design.
Organising rule: direct manipulation on canvas, exact numbers in inspector, decisions in tray, everything else one keystroke away.

---

## 14 tools sorted by tier

### Tier A — every session

| # | Tool | Purpose | Property / command | Canvas | Panel / toolbar | Keyboard |
|---|---|---|---|---|---|---|
| 1 | Select | Click/tab to pick; hover outline; Esc deselect | selection | click / hover / layers list (B) | V / Esc |
| 2 | Edit text | In-place headings, labels; plain text only | text / label | double-click / caret | Enter / T |
| 3 | Colour | Picker with approved first + live contrast | bgColor / color / textColor | toolbar swatch → picker overlay (H) | C |
| 4 | Variants & Approve | 3 options; preview; approve | apply_candidate | preview | variants tray (E) / prompt (G) | G / 1-3 / A |
| 5 | Scope | Instance / page / global + live counts | decision scope | — | scope row (E) / inspector (F) | S |
| 6 | Undo/Redo | One gesture = one step | undo / redo | — | top bar (A) | Cmd/Ctrl+Z / Shift+Z |

### Tier B — most sessions

| # | Tool | Purpose | Property | Canvas | Panel / toolbar | Keyboard |
|---|---|---|---|---|---|---|
| 7 | Type | Size, weight, line-height, align, family (allowlist) | fontSize / fontWeight / lineHeight / align | toolbar (size/weight) | type group (F) | Cmd/Ctrl+B |
| 8 | Space & shape | Padding, radius, shadow | padding / radius / shadow | corner / edge handles | space group (F) | [ / ] |
| 9 | Resize | Handles changing real property (image w/h, card p, btn r, text s) | width / height / padding / radius / fontSize | handles / edges | fields / scrub (F) | arrow nudge |
| 10 | Insert / reorder | "/" menu; drag / arrow reorder in flow | add_element / move_element | drag / grip | floating toolbar (D) / layers drag (B) | / / Alt+↑↓ |
| 11 | Zoom / pan / preview | View-only; never document change | view state | pinch / Space-drag | zoom control (C) / preview (A) | Cmd+ +/ - / 0 / H |

### Tier C — support

| # | Tool | Purpose | Property | Canvas | Panel / toolbar | Keyboard |
|---|---|---|---|---|---|---|
| 12 | Duplicate / delete | Copy in place; remove with undo | add_element / remove_element | context menu | selection header menu (F) | Cmd/Ctrl+D / Backspace |
| 13 | Decisions list | Approved decisions; where applied; superseded | decision registry | From-Home badges (C) | decisions (B) | D |
| 14 | Command palette | Search any action / page / setting | all | — | top-bar search (A) | Cmd/Ctrl+K |

---

## Per-element controls (§4)

Only schema-supported properties; selection toolbar shows top 3 for kind; inspector shows full group.

| Kind | Content | Colour | Type | Space/shape | Resize handles |
|---|---|---|---|---|---|
| Heading | text, level | color | size, weight, align | — | baseline size |
| Text | text | color | size, line-height, align | — | baseline size |
| Button | label | bgColor, textColor | weight | radius | corner radius |
| Card | — | bgColor | — | radius, padding, shadow | corner / edges |
| Section | — | bgColor | — | padding | edges padding |
| Image | alt | — | — | fit (cover/contain/fill) | 8 handles w/h |
| Navigation | items | bgColor | — | — | — |
| Form | submitLabel + fields | bgColor | — | — | — (not reviewed) |

---

## Placement matrix (§5) — three entry points max

Every tool reaches the user via Canvas (C), Panel/toolbar (D/F), or Keyboard/Palette (H) — matching the workspace zones.

---

## Build order (§7) — small slices, one at a time

**Slice 1:** Tools 1-3 (Select, Edit text, Colour picker) — one gesture = one coalesced command (AGENTS.md interaction contract); Escape/blur/pointercancel abort with zero state change.
**Slice 2:** Tools 7-9 (Type, Space & shape, Resize) — handles preview real element; scrubProperty already maps `image→width`, `section/card→padding`; extend if needed.
**Slice 3:** Tools 10, 12 (Insert/reorder, Duplicate/delete) — `/` menu, drag handles, `add_element` / `move_element` / `remove_element` commands exist (`core/commands.ts`).
**Slice 4:** Tools 13-14 + shortcuts — decisions list + command palette; command palette uses existing command registry (no new command type needed).

Shared acceptance per tool: one gesture → one coalesced command on release; invalid values show inline message, change nothing; never re-renders canvas content from chrome; variant preview swap under 50 ms budget (`docs/PERF.md`).

---

## Out of scope (§6) — deliberate exclusions

| Left out | Why | Alternative offered |
|---|---|---|
| Pen / vectors / masks | Different product | Structured elements |
| Freeform position / rotation | Breaks flow | Reorder + padding; device preview |
| Constraints / responsive rules by hand | Needs layout engine | Auto flow; preview view-only |
| Gradients / blend / effect stacks | Hard to stay consistent | Flat fills; 3 shadow levels |
| Prototyping / interactions | Not design-decision workflow | Out of MVP |
| Component authoring | Auto-matching elements | Decisions list shows shared |
| Variables / token editor | Heavy | Approved decisions = tokens |
| Custom fonts / image edit / crop | Security / scope | Font allowlist; image fit modes |
| Comments / multiplayer / plugins / code export | Solo / strategy / open | Revisit / open decisions (§9) |

---

## Open decisions (§9) — answers block build

1. **Gap** (blocks 8): add `gap` to sections/cards or skip?
2. **Resize** (blocks 9): approve w/h on more kinds, or keep to image + section/card padding/radius/size?
3. **Form**: own controls or variants-only?
4. **Usage counts** (blocks §8): local / backend / not now?
5. **Code export**: MVP / later / never?
6. **Insert menu**: 7 kinds only / templated blocks?

---

## Sources

- Codebase: `core/elements.ts`, `core/commands.ts`, `core/specs.ts`, `app/inspector.tsx`, `app/gestures.ts`, `docs/TOOLS.md`, `AGENTS.md`
- Design-tool guides / Auto Layout references (meshworld.in, pixso.net, uxdesign.cc, arounda.agency; Udemy)
- Limit: guide-informed ranking; needs §8 verification with real usage data
