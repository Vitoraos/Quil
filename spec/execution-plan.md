# Execution Plan — Workspace Redesign (DeepSeek / 200k context; progressive codegraph)

Prepared: 3 Nov 2026. Companion to `spec/questionnaire.md`, `spec/workspace.md`, `spec/tool-scope.md`.

---

## Context budget rules (avoid unnecessary compaction / full-file re-reads)

1. Search with `codegraph explore` per symbol (not full repo scans).
2. Read only the lines shown in `codegraph` output or 30-line slice around target.
3. Never read full `Workspace.tsx` (590 lines) in one call; target subregions.
4. One session = one build slice (Slice 1–4 from tool scope). Don't mix slices.
5. Each change ships with a one-line test; no new test file needed unless a new module is added.
6. Token changes (fix, new tokens) go in `src/ui/tokens.css`; styling changes never invent hex/px outside tokens.

---

## Plan sections = slices (small, independent)

### Slice 0 — Token fixes + missing tokens (+ answers to Q1–Q2)

**Before any UI:** fix `src/ui/tokens.css`; add missing tokens; decide gap + resize schema.

Step 0.1 — Fix broken font declaration (bug from read: lines 34–35 missing `;`)
- Edit: `tokens.css`
- Codegraph query: `grep` for `font-ui` / `font-head`
- Done when: both font tokens parse correctly; nothing else broken

Step 0.2 — Add `--quil-focus-ring` (required for WCAG 2.2 AA focus visibility)
- Edit: `tokens.css`
- Done when: token declared; inspector, buttons, tabs reference it

Step 0.3 — Add `--quil-overlay` / `--quil-backdrop` (Zone H overlays)
- Edit: `tokens.css`
- Done when: overlay uses it instead of raw rgba

Step 0.4 — Remove duplicate `--quil-space-*` declarations (lines 49–67 duplicate 49–67; safe)
- Edit: `tokens.css`
- Done when: single declaration per token

Step 0.5 — Answer Q1 (gap) and Q2 (resize schema) — ask user if still open; if answered, edit `core/elements.ts` (section/card props) or don't.
- Blocked on user answers; do not proceed to Slice 1 without.

---

### Slice 1 — Tools 1-3: Select / Edit text / Colour picker

Step 1.1 — Confirm `Select` already works (click `onCanvasClick` + `setSelectedId` in `Workspace.tsx`).
- Verify: `Workspace.tsx:172-176`; `Canvas` renders with `data-element-id`

Step 1.2 — Confirm `Edit text` already works (`Inspector` `handleBlur` at `app/inspector.tsx:30-53`; `set_property` command).
- Verify: `tests/app/inspector.test.tsx`

Step 1.3 — Confirm `Colour` picker can open (`Colour group` in inspector opens `picker` overlay from `Zone H`).
- No code change if picker overlay exists; if missing, build overlay (new component in `app/` or `src/ui/`)
- Use `colorValue` schema (`core/values.ts`) — allowlisted, not string-constructed

Step 1.4 — Confirm live contrast check (`ContrastBadge` at `app/contrast-badge.tsx`; depends on `fg` + `bg` from `Workspace.tsx:189-190`).
- Verify with `tests/ui/contrast.test.ts`

Done-when: all three entry points work (canvas, inspector, keyboard C/T/V).

---

### Slice 2 — Tools 7-9: Type / Space & shape / Resize (gestures)

Step 2.1 — `Type`: extend inspector (group 4) with font controls (`fontSize`, `fontWeight`, `lineHeight`, `align`) for heading/text/button/card/section. Read `propsSchemas` from `core/elements.ts` to know allowed fields.
- Verify: `shapeFor(kind)` in `app/inspector.tsx:8`

Step 2.2 — `Space & shape`: inspector group 5 (padding, radius, shadow). Already partially present for cards/sections; extend to buttons/headings/text if missing.

Step 2.3 — `Resize` handles: `gestures.ts` already scrubs `width`, `padding`, `radius`. Extend `SCRUB_BOUNDS` and `scrubProperty` if new properties (e.g., `width`/`height` for cards). Confirm `onDown` reads `elementId` from closest `[data-element-id]`; confirm `makeGhost` renders projection.
- Target: `gestures.ts:119-145`; read 40 lines max.
- Verify: `tests/app/gestures.test.tsx`

Done-when: resize preview works live; Escape / pointercancel / blur / resize / lost capture abort cleanly (per `gestures.ts` comments); one `set_property` with `gestureId` committed on release.

---

### Slice 3 — Tools 10, 12: Insert / reorder / Duplicate / delete

Step 3.1 — Insert (`/` menu / floating toolbar `D`). `addElementCommandSchema` exists; `app/intake-panel.tsx` already calls `generateSpec`. Confirm `add_element` applies through command bus.
- Read `core/commands.ts:76-86` (addElement); verify `core/apply.ts` applies it.

Step 3.2 — Reorder (`moveElementCommandSchema`; `move_element` with `newParentId` and `index`). Confirm drag handle emits `move_element`; arrow-key reorder also emits command.
- Read `core/commands.ts:97-106`; `app/gestures.ts` if drag needed.

Step 3.3 — Duplicate (`add_element` with copied props + new id). Not a new command; implement by reading current props, copying, new id, then `add_element`. Confirm undo reverses.
- Test with `tests/commands.test.ts`

Step 3.4 — Delete (`remove_element` at `core/commands.ts:88-95`). Confirm `Backspace` triggers; confirm `Undo` restores.

Done-when: all actions go through command bus; one gesture = one coalesced command; invalid inputs rejected by `designCommandSchema`.

---

### Slice 4 — Tools 13-14: Decisions list / Command palette + all shortcuts

Step 4.1 — Decisions list (Zone B — left rail). Read `src/app/store.ts` decision registry access; build panel listing `state.decisions` with scope counts (instance/page/global). Confirm supersede order shown.
- Read `core/decisions/registry.ts`: `upsertDecision`, `lookupByScope`

Step 4.2 — Command palette (Zone A / H overlay). Search within existing command set; display results by command type + target; execute through existing `store.dispatch`. No new command type needed.
- Keep keyboard at Cmd/Ctrl+K; close with Esc

Step 4.3 — Shortcuts for all 14 (keyboard layer on `Workspace.tsx` / `app/`). Confirm all are reachable (V / T / C / G / 1-3 / A / S / Cmd+Z / Cmd+B / [ / ] / / / Alt+↑↓ / +/ - / Cmd+D / D / Cmd+K).

Done-when: everything reachable by keyboard; command palette executes through command bus; decisions panel shows live counts per scope.

---

## Verification per slice

After each slice: `npm test` (or `npm run test` per `vitest.config.ts`); check relevant file subset; confirm no new hex values in components; confirm all visual changes reference `tokens.css`; confirm `core/` imports nothing from `app/`/`modules/`.

---

## Risk / failure modes per slice

- **Malformed input:** `designCommandSchema` (Zod strict) rejects unknown keys; all commands pass through this at `core/apply.ts`. Test with `tests/commands.test.ts`.
- **Stale / duplicated commands:** idempotency by `commandId` already in store (`seenCommandIds`). Double-click protected.
- **Race / partial apply:** `baseRev` check in `applyCommand`; if base changed, apply fails safely.
- **Partial failure of persistence:** `IndexedDBRepository` (`persistence/indexeddb-repository.ts`) writes atomically; if partial, recover from snapshot (`SNAPSHOT_EVERY = 50`).
- **Multi-tab:** Web Lock (`document.lock` in repository) prevents concurrent writers.
- **Secret exposure:** nothing sends keys; `BYOK` handled via `keyStatus` only.

---

## Open decision gates (do not start slice until answered)

- Q1 (gap): answered — ADD to section/card (blocks Slice 2; unblocks 2.1)
- Q2 (resize): answered — keep to existing set (blocks Slice 2; unblocks 2.3)
- Q3 (form): answered — own inspector group (blocks Slice 4; unblocks 4.1)
- Q4 (usage counts): answered — NOT NOW (Slice 4 can skip telemetry)
- Q5 (code export): answered — MVP (roadmap; does not block build)
- Q6 (insert menu): answered — 7 kinds only (blocks Slice 3; unblocks 3.1)
- **Hex palette override**: bg `#fafafa`, text `#02040d`, button `#0054a3`, button text `#ffffff` — used as raw values overriding tokens (UNIQUE DECISION; requires documenting override contract)
- **Variant tray position**: below canvas, small rectangular cards (layout change; moves out of right panel)
- **Variant count selector**: min 1 / max 3 (change from fixed 3; wired to prompt → LLM code path)**
- Q7-Q9 (panel width / rail / preview depth): affect layout; can adjust during styling without blocking logic
- Q10 (identity): design audit after Slice 4; does not block

---

## Progress tracking per session

Session format (one per slice):
- Read `spec/questionnaire.md` answers for the slice's questions
- Use `codegraph explore` for the 2-3 symbols in scope
- Read 30-40 lines per symbol (not full files)
- Edit, test subset, commit with message naming slice and symbol
- Update `spec/workspace.md` if layout changed; do not invent raw values
- Confirm budget (no full-document re-resolve, narrow selectors)

---

*Plan written without inventing any tool behavior outside what's already in `core/commands.ts`, `app/gestures.ts`, `core/elements.ts`, `core/specs.ts`, and `AGENTS.md`.*
