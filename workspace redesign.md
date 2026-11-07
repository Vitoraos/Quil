# Workspace Redesign Plan

## Source of truth
`quil-workspace-functionality (1).json` — every region, tool, token, keyboard shortcut, and edge case.
`quil-intake-spec-overhaul-prompt.md` — intake flow, stage model, and data model v4.
If it is not in either spec, it does not exist in the UI.

## Build sequence (constraint)
We build the **workspace shell first** (Layers 1–8 below), then add the **intake UI** on top (Intake Layers), even though intake comes first in the real user flow. The user flow is: project → intake → spec → design. The build order is: workspace shell → intake dock → design tools.

## What gets deleted (scrapped)
- `Quil_Ui.html` (repo root)
- `src/app/editor.tsx` (monolithic UI — 608 lines, inline styles)
- `src/pages/Workspace.tsx`, `Landing.tsx`, `Settings.tsx`, `IntakeWizard.tsx`
- `src/ui/primitives/` (old Button/Card/Input/etc.)
- Any other page/component under `src/` that renders chrome

## What stays (untouched)
- `src/core/` — commands, state, elements, decisions resolver, apply, specs, values, validation (pure, no React/DOM)
- `src/app/store.ts` — QuilStore (command bus bridge to persistence)
- `src/app/router.tsx` — routes `/`, `/p/:projectId`, `/settings`, `/new`
- `src/pages/Projects.tsx` — project grid + new-project dialog (kept; new-project lives here per overhaul)
- `src/ui/tokens.css` + `src/ui/base.css` — design tokens
- `src/persistence/` — IndexedDB / Dexie layer
- `tests/` — existing test suite (run after each layer)

## New modular structure (`src/app/workspace/`)
```
src/app/workspace/
├── Shell.tsx          → outer grid: TopBar + CanvasCol + DesignRiley + Overlays
├── TopBar.tsx         → Region A: nav, undo/redo, preview (right aligned)
├── CanvasCol.tsx      → Region E: screen tabs, zoom row, scrollable artboard container
├── CanvasCard.tsx     → the artboard card (bg, scroll, renderer integration)
├── DesignRiley.tsx    → Region C: stage-aware right rail (Intake Dock OR design tree + inspector)
├── IntakeDock.tsx     → intake UI inside the right rail: stepper, question, answer box, chips, coverage bar
├── QuickTools.tsx     → floating strip below canvas: Select/Frame/Text/Insert/Hand
├── Overlays/          → colour picker, insert menu, command palette
└── index.ts           → exports Workspace component
```

## Build order (each layer = one inspectable step)

| Layer | What ships | Verify |
|-------|-----------|--------|
| 1. Background | Root shell with `--quil-bg`, fills viewport | Dark bg renders, no flash |
| 2. Canvas card | Scrollable artboard centered, 25px top / 65px bottom spacing, `calc(100vw - 620px)` width | Card visible, scroll works |
| 3. Top nav | 56px fixed bar, Undo/Redo/Preview right-aligned, `#f5f0f0` buttons | Buttons click, correct placement |
| 4. Left AI rail | Tabs + CLI prompt + variant tray placeholder | Prompt is CLI-style (single line, compact) |
| 5. Right design rail | Stage-aware rail skeleton: Intake Dock placeholder | Rail renders, collapsible |
| 6. Quick tools | Floating strip below canvas (5px gap) | 5 tools, Select active state |
| 7. Overlays | Colour picker, insert menu, command palette | Esc closes, no bleed |
| 8. Wiring | Connect to QuilStore command bus | Undo/redo/insert actually mutate state |
| 9. Intake Dock | Real intake UI: stepper, question, answer box, option chips, coverage bar, page chips | Intake renders inside workspace right rail |
| 10. Stage switching | `deriveWorkspaceStage` wiring: project-intake → pick-start-page → page-intake → spec-review → design | Right rail swaps modes correctly |

## Key design decisions
- **Workspace first, intake second**: Shell and canvas are complete before intake UI is added, even though intake is first in the real user flow.
- **Prompt box**: Compressed to CLI-style single-line input (not a textarea), saves vertical space in AI rail
- **Stage-aware right rail**: The right panel runs the Intake Dock during project/page/spec stages and collapses to a one-line status + inspector during design stage. `deriveWorkspaceStage` (pure) drives which mode shows.
- **Intake inside workspace**: Intake runs in the workspace right panel, never a separate `/new` wizard page. `IntakeWizard.tsx` is replaced by `IntakeDock.tsx`.
- **Project creation stays on Projects page**: New-project dialog (Radix Dialog) on `Projects.tsx`, navigates to `/p/:id`. `Projects.tsx` is kept, not deleted.
- **Tokens only**: Every value from `tokens.css` — no inline hex, font sizes, or shadows
- **No generics**: Only what is in `quil-workspace-functionality (1).json` plus the intake overhaul
- **Testable slices**: Each layer inspected independently before wiring to the command bus
- **Open questions**: which routes to keep, prompt CLI exact styling, exact Intake Dock layout

## Delete strategy
Delete per layer as it is replaced (app stays broken only briefly), not all upfront.

---

## FIRST STEP — Layer 1: Background

**Goal**: Render the root shell with the dark background token, filling the viewport.

**Files to create**: `src/app/workspace/Shell.tsx`, `src/app/workspace/index.ts`

**Files to delete**: None yet (core/store/router untouched)

**What ships**:
- `Shell.tsx`: outer container, `display: grid`, `height: 100vh`, `background: var(--quil-bg)`, `color: var(--quil-text-100)`, `font-family: var(--quil-font-ui)`
- `index.ts`: re-exports `Shell` as `Workspace` (placeholder export, router not yet pointed at it)

**Acceptance**:
- Page background is `#15100d` (espresso)
- No white flash, no browser default margins
- Fills full viewport

**Next after this**: Layer 2 (Canvas card)
