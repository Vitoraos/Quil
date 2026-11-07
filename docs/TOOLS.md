# Quil Tooling & Module Overview

This document describes the tools, modules, and implementation artifacts of the Quil design workspace, organized by layer.

## Quil Overview

Quil is a guided design workspace where every approved design decision is stored as explicit data (a scoped constraint) and applied deterministically. Nothing becomes part of the design system just because AI generated it — it becomes canonical only after the user approves it.

Architecture principles (from `AGENTS.md`):
- Structured state is the source of truth: typed project document (project > pages > sections > elements) + decision registry + asset registry. The canvas is a view of that state; HTML is never the source of truth.
- Every document change is a typed Command sent through ONE command bus. No component writes document state directly.
- The model proposes; the application validates and applies. AI output is untrusted input.
- Scope is first-class: instance / page / global. Deterministic precedence: preview overlay > instance > page > global > component default.
- Resolved design is derived from the document and decisions — never stored as a second mutable copy.
- `core/` has no React, DOM, network, or AI-provider imports. Pure, runs in Node tests.

---

## Core (`src/core/`) — Phases 1 & 2

| File | Purpose |
|------|---------|
| `core/ids.ts` | Branded ID types (`ElementId`, `PageId`, `DecisionId`, `AssetId`, `CommandId`, `CandidateId`, `ProjectId`) with strict Zod ID constructors. |
| `core/values.ts` | Per-property value validators: `colorValue` (hex/oklch), `fontSizeValue`, `spacingValue`, `radiusValue`, `fontWeightValue`, `alignValue`, `fitValue`, `shadowValue`, `textValue` (bans control/RTL chars). |
| `core/elements.ts` | Per-element-kind Zod props schemas (`propsSchemas`) for `heading`, `text`, `image`, `button`, `card`, `navigation`, `form`, `section`. |
| `core/state.ts` | `ProjectState`, `DesignElement`, `Page`, `DesignDecision`, `DecisionScope`, `Asset`, `HistoryEntry`, bounds constants, `createProjectState`. |
| `core/commands.ts` | Zod strict command schemas (`set_property`, `add_element`, `add_section`, `remove_element`, `move_element`, `apply_candidate`, `undo`, `redo`, `batch`), command error codes, `DesignCommand` union. |
| `core/apply.ts` | `applyCommand(state, command)` — the single command bus. Returns `ApplyResult` (`{ok, state, patches, inversePatches, changedIds}` or `{ok, error}`). Immer `produceWithPatches` for patches/inverse patches (undo for free). Command idempotency, base-rev staleness, gesture coalescing, batch atomicity, undo/redo stacks. Invariant validation via `validateProject`. |
| `core/validate.ts` | `validateProject(state)` — invariant checker: acyclic tree, no orphans, no dangling references, unique ids, bounds, property-schema validity, decision orphan/dangling checks, decision zero-match reporting. |
| `core/decisions/registry.ts` | Decision lifecycle: create (monotonic seq), approve, supersede (superseded stay in history), lookup by target & scope, `decisionZeroMatchReport`. |
| `core/decisions/resolver.ts` | `resolveElement(state, elementId, memo)` — pure incremental resolver with precedence, same-scope total order (approved-seq descending, id ascending), provenance tracking, memoization per element, dependency index (`decisionToElements`, `elementToDecisions`). |
| `core/decisions/index.ts` | Barrel exports for `core/decisions/`. |
| `core/fixtures.ts` | `emptyProject()` (blank project every session starts from), `referenceProject()` (site-agnostic two-page reference used by tests/benches) and `buildSyntheticFixture(n)` (scaled fixture for perf tests). |
| `core/index.ts` | Barrel re-exports for `core/`. |

## Canvas / Tools — Phase 3 (`src/app/`)

| File | Purpose |
|------|---------|
| `src/app/store.ts` | `QuilStore` — in-memory store holding `ProjectState`. `applyCommand(state, command)` dispatches through the single command bus (core `applyCommand`), runs invariant validation, notifies subscribers. Implements `getSnapshot`/`subscribe` for `useSyncExternalStore`. Wires persistence: `init()` becomes write leader, restores saved state when one exists, otherwise writes the initial snapshot; `dispatch()` queues committed ops for write-behind flush. |
| `src/app/resolve.ts` | `createResolver()` — memoized per-element resolver wrapper using core `resolveElement` with a `ResolverMemo` cache keyed on element revision + decision fingerprint. |
| `src/app/renderer.tsx` | `Canvas` — DOM/CSS renderer from resolved props. Per-element subscription via `useSyncExternalStore`; only changed elements re-render. Element → DOM mapping (`heading`→`h1`, `text`→`div`, `button`→`button`, etc.), style-only updates via resolved props, text rendered as text nodes only (no `dangerouslySetInnerHTML`). Accepts `pageId` filter and `getZoom` for view-only transform. |
| `src/app/layers.tsx` | `Layers` — three-layer composition: committed content, selection/handles overlay (separate, never re-renders content), ephemeral gesture layer. |
| `src/app/gestures.ts` | Pointer gesture layer: pointer capture (`setPointerCapture`), drag/resize/scrub written to the gesture layer inside `requestAnimationFrame`; on release dispatches ONE coalesced command; Escape/pointercancel/blur/focus-loss abort cleanly with no state change. |
| `src/app/inspector.ts` | `Inspector` — shows only renderer-representable properties. Each control builds a typed command; the value passes the per-property Zod validator before dispatch. Invalid input shows an inline error and changes nothing. |
| `src/app/scope-picker.tsx` | `ScopePicker` — plain-language effect text + live count of affected elements (computed via resolver). Hides meaningless choices per property. |
| `src/app/drift-badge.tsx` | `DriftBadge` — signals when a hand edit deviates from an approved decision; offers "keep as instance override" or "propose changing the decision"; nothing changes a decision without approval. |
| `src/app/contrast-badge.tsx` | `ContrastBadge` — WCAG contrast ratio computed in code via `culori`; pass/fail against WCAG AA (4.5:1) / AAA (7:1). |
| `src/app/editor.tsx` | Editor composition root: canvas, tools panel, inspector, scope picker, drift/contrast badges, selection overlay, colour picker, insert menu, layers/decisions panels, command palette, zoom/pan viewport, save status, read-only banner, recovery screen, preview overlay and the global keymap. Starts from `emptyProject()`; with no pages it shows the brief prompt and routes to intake. Pages are generic — any site, any page names. |
| `src/app/index.tsx` | React entry point. |
| `src/app/save-status.tsx` | Save status indicator: `saved`/`saving`/`unsaved`/`error` with dot pulse, subscribed via `store.onSaveStatus`. |
| `src/app/read-only-banner.tsx` | Read-only banner shown on non-leader tabs (multi-tab Web Locks follower). |
| `src/app/recovery-screen.tsx` | Recovery screen for migration/corruption failures: retry, export project, dismiss. |
| `src/app/selection-overlay.tsx` | Selection + hover outlines written straight to the DOM, plus one resize handle per property the selected kind supports. |
| `src/app/resize.ts` | Pure handle table (`resizeHandles`), bounds clamp, prop-shape adapters and kebab-case CSS names for the live preview. |
| `src/app/gestures.ts` | Handle-driven resize: rAF inline-style preview, ONE `set_property` on release, abort on Escape/pointercancel/lost capture/blur/resize. |
| `src/app/text-editor.tsx` | In-place text editing overlay; Enter/blur commits one `set_property`, Escape cancels. |
| `src/app/color-picker.tsx`, `src/app/colour.ts` | Colour group: approved decision colours first, neutral seeds, live WCAG contrast for the candidate. |
| `src/app/insert-menu.tsx`, `src/app/element-ops.ts` | Insert allowlist of element kinds with schema-valid defaults, plus a page section root via `add_section`; image is disabled when the project has no asset. Duplicate copies any subtree (section root included) as one batch. |
| `src/app/layers-panel.tsx` | Page outline: select and reorder siblings through `move_element`. |
| `src/app/decisions-panel.tsx` | Read-only list of decisions with status and plain-language scope. |
| `src/app/command-palette.tsx`, `src/app/pan.ts` | Cmd/Ctrl+K action palette with subsequence matching ("zn" finds "Zoom in"); hand/Space viewport panning captured so it never starts a select or resize, clamped to the scrollable extent. |
| `src/app/command-id.ts` | Monotonic command/element ids that satisfy `ID_PATTERN` (timestamp ids collided inside one millisecond). |

## Persistence — Phase 4 (`src/persistence/`)

| File | Purpose |
|------|---------|
| `src/persistence/repository.ts` | `ProjectRepository` interface: `init`, `load`, `appendOps`, `writeSnapshot`, `flush`, `listProjects`, `delete`, `subscribe`, `getSaveStatus`, `isLeader`, `close`. `CommittedOp`, `ProjectSummary`, `SaveStatus` types, `PersistenceError` class with codes (`QUOTA_EXCEEDED`, `ABORTED`, `BLOCKED`, `PRIVATE_MODE`, `CORRUPT_SNAPSHOT`, `FUTURE_SCHEMA`, `STALE_BASE`). |
| `src/persistence/indexeddb-repository.ts` | Dexie implementation of `ProjectRepository`. Op log (`ops` table), snapshots (`projects` table), numbered snapshots (`snapshots` table) with FNV-1a checksums. Write-behind flush debounced 300 ms + on `visibilitychange`/`pagehide`. Load = latest snapshot + op replay by `seq`. Corrupt-snapshot fallback to previous numbered snapshot. Schema version check, migration on load. Web Locks leader election with `FallbackLock` fallback, `BroadcastChannel` for cross-tab flush notification. |
| `src/persistence/migration.ts` | Versioned migrations (`SCHEMA_VERSION`), `migrate()`, `backupSnapshot()`/`restoreFromBackup()` (Map-aware JSON), `priorVersions` frozen fixtures for testing. |
| `src/persistence/save-status.ts` | `SaveStatusStore` interface and `MemorySaveStatusStore` implementation. |
| `src/persistence/index.ts` | Barrel exports for `src/persistence/`. |


| File | Purpose |
|------|---------|
| `tests/commands.test.ts` | Command bus adversarial/failure-mode tests: duplicate CommandId replay, target-missing, cycle, orphan-on-delete, undo/redo history, batch atomicity, prototype pollution, stale base, unknown property, candidate idempotency, gesture coalescing. |
| `tests/validate.test.ts` | `validateProject` against malformed fixtures: cycle, dangling parent/child/asset, `__proto__` id, orphan node, node-count bound. |
| `tests/properties.test.ts` | fast-check property tests: random command leaves `validateProject` clean or is rejected with state unchanged; undo/redo round trip; CommandId idempotency. |
| `tests/decisions/registry.test.ts` | Decision registry: create/approve/supersede/lookup, idempotent replay, supersede chains, scope distinctness, zero-match detection. |
| `tests/decisions/resolver.test.ts` | Resolver: precedence, provenance, page/global isolation, same-scope total order (seq descending), unknown element rejection. |
| `tests/decisions/properties.test.ts` | fast-check: resolve determinism, apply-twice-equals-once, global updates all+only matching, instance override survives global, page isolation, undo restores registry. |
| `tests/decisions/fuzz.test.ts` | Oracle test: incremental resolve equals full resolve across 10,000 random command sequences with zero divergence. |
| `tests/decisions/integration.test.ts` | `set_property` with scope creates a decision via `applyCommand`; non-scoped edits patch base props; idempotent replay; stale base rejection; undo removes decision. |
| `tests/app/renderer.test.tsx` | Render-consistency (DOM equals resolved model), XSS defense (text nodes only, no innerHTML), unknown-size rejection. |
| `tests/app/inspector.test.tsx` | Valid/invalid input via command bus, validation rejection, state unchanged on invalid input. |
| `tests/app/scope-picker.test.tsx` | Scope picker: affected-element count, meaningful choices only. |
| `tests/app/drift.test.tsx` | Drift badge: deviation signal, keep-as-override/propose-decision actions, no silent decision change. |
| `tests/app/gestures.test.tsx` | Gesture suite: Escape cancel, blur abort, pointercancel abort, two-pointer handling. |
| `tests/app/perf.test.tsx` | Performance: 1,000 `set_property` commands p95 under 10 ms; undo under 32 ms. |
| `tests/persistence/repository.test.ts` | Persistence: save-status lifecycle, load/save round-trip, op replay, corrupt-snapshot checksum fallback, numbered snapshot fallback, listProjects/delete, read-only mode, save-status subscription, cold-load performance (2,000 elements < 1 s). |
| `tests/persistence/migration.test.ts` | Migration: schema version, no-op at current version, future schema rejection, backup/restore round-trip, Map serialization. |
| `tests/persistence/store.test.ts` | Store integration: initial snapshot on init, write-behind flush, refresh deep-equal (resolved state matches after reload), isLeader. |

## Performance Budgets (`docs/PERF.md`)

| Operation | Budget | Phase 3 Status |
|-----------|--------|----------------|
| Drag/resize/scrub (500-element page) | < 10 ms/frame | `set_property` p95 < 10 ms (PASS) |
| Committed instance edit | Same frame (~16 ms) | Core `applyCommand` p95 measured |
| Undo / redo | < 32 ms | PASS |
| Global decision (200 elements) | < 50 ms | Phase 2: incremental resolve p95 0.259 ms (PASS) |

## Module Boundaries (enforced)

- `core/` imports nothing from `app/`, `modules/`, or `persistence/`. Pure, runs in Node tests.
- `app/` composes `core/`; modules never import each other.
- All document mutations go through the single command bus (`applyCommand`). No component writes document state directly.
- Resolved design is derived from document + decisions; never stored as a second mutable copy.

## Keyboard (editor canvas)

| Key | Action |
|-----|--------|
| `V` | Focus the canvas (Tab then cycles elements) |
| `Enter` / `T` | Edit the selected text element |
| `C` | Open the colour group for the selected element |
| `D` | Toggle the decisions list |
| `/` | Toggle the insert menu |
| `Delete` / `Backspace` | Remove the selection (one `remove_element`) |
| `Ctrl/Cmd+D` | Duplicate the selection (one batch, props only; a section root is duplicated with its children) |
| Arrow keys | Nudge the kind's primary resize property by 1px; `Shift` = 10px |
| `H` | Toggle hand tool; hold `Space` to pan |
| `Ctrl/Cmd+=` / `-` / `0` | Zoom in / out / reset to 100% |
| `Ctrl/Cmd+K` | Command palette |
| `Escape` | Clear selection or abort the active gesture |

## Running

```bash
npm install            # zod, immer, vitest, fast-check, react, react-dom, @vitejs/plugin-react, jsdom, @testing-library/react, culori
npm run typecheck      # tsc --noEmit
npm test               # vitest run (jsdom + React)
npm run bench          # core command-bus performance (scripts/bench.ts)
npm run bench2         # resolver performance benchmark — run `npx tsx scripts/bench2.ts` (no npm script defined yet)
```

## Intake / Page Specification — Phase 5 (`src/modules/intake/`)

| File | Purpose |
|------|---------|
| `src/modules/intake/provider.ts` | `AIProvider` interface with separate operations and schemas: `generateFollowUpQuestions`, `suggestPages`, `generatePageSpec`. `ProviderError` class with recoverable flag. No mega-prompt. |
| `src/modules/intake/schemas.ts` | Strict Zod schemas for every provider response (no extra keys allowed). `parseProviderResponse` validates and rejects malformed output. |
| `src/modules/intake/mock-provider.ts` | Deterministic mock provider returning fixtures for offline mode and tests. |
| `src/modules/intake/request-layer.ts` | `RequestLayer` — AbortController deadline, retry with jittered backoff on 429/5xx only, circuit breaker, cancel on navigation (pagehide), size caps on inputs/outputs. |
| `src/modules/intake/adapters/byok-adapter.ts` | `ByokAdapter` — real adapter using BYOK key held in memory only, redacted in logs, never in analytics. `destroy()` clears key from memory. |
| `src/modules/intake/index.ts` | Barrel exports for `src/modules/intake/`. |

| File | Purpose |
|------|---------|
| `src/app/intake-panel.tsx` | Intake UI: brief form, adaptive skippable questions, page list (add/remove/rename/select), page-spec editor with validation, spec-versus-decision conflict detection, skeleton instantiation. |

## Targeted Generation — Phase 6 (`src/modules/intake/` + `src/core/generation.ts` + `src/app/`)

| File | Purpose |
|------|---------|
| `src/core/generation.ts` | `ComponentDef` schema (the "shape" that makes components valid by design), `Candidate` schema (component instance instance), `buildGenerationContext()` (pure context builder), `validateCandidate()` (strict validation against definition), `contrastRatioCore()` / `contrastPassesCore()` (WCAG math via culori). Target defs for `hero` and `button` with allowlisted props and hard constraints. |
| `src/app/generation-panel.tsx` | Generation UI: target selector, candidate generation, one card per candidate (tap a card to preview it live through the preview overlay), validation constraint display (pass/fail per constraint), approve/reject/regenerate actions, stale-base detection. |
| `src/core/apply.ts` | `apply_candidate` command handler — validates candidate at apply time, patches only allowed surface properties, records decision via `upsertDecision`, idempotent by `CandidateId`. |
