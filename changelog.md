# Changelog — Phase 6: Targeted Generation

This file records where the implemented Phase 6 differs from the original plan in
`Quil Coding-Agent Prompt Pack (1).md`, and why. Contracts in `AGENTS.md` were not
weakened: candidates remain untrusted input, approvals still go through
`apply_candidate` on the single command bus, and nothing is committed without a
decision.

## Deltas from the planned design

| Planned | Built | Why |
| --- | --- | --- |
| Streaming candidates, rendered as each one validates | Batch validation of a bounded candidate list, then render | No network provider exists yet; the mock provider returns all candidates synchronously. The validation loop is the same one a streaming transport would call per candidate. |
| Model evaluation harness (>= 20 prompts per target across registry models, cost/latency/blind-pick report) | Not built | There are no registry models or API keys in the MVP. `targetDefs` + `validateCandidate` are the deterministic seam the harness would report on. |
| Candidates as free-form patches constrained by a per-target property allowlist | Candidates are component **instances** validated against a `ComponentDef` (`targetDefs`: `hero`, `button`) with allowlisted props, required props, per-property validators and hard constraints | "Valid by design": the model cannot express a shape outside the definition, so no arbitrary patch surface exists. |
| Variant cards were scheduled for a later workspace phase (U3) | Cards shipped with Phase 6's generation panel: definition summary, per-candidate Valid/Invalid chip, live miniature, rationale, stale banner | The panel had no other way to review candidates; deferring cards would have meant an untestable approve path. |
| Preview overlay: highest precedence, ephemeral, never persisted or undone | Implemented as `PreviewOverlay` fed by the active candidate; it reads committed state and never dispatches | Matches the contract. `App` mounts it above the canvas; selecting a card changes the overlay only. |
| Approve re-validates at apply time and records the decision with the picked scope | `apply_candidate` carries `componentDefId`; `applyCandidateIn` re-checks the definition (exists, matches the target kind, required props, allowlists, value validators, contrast) before recording each patch as an **instance-scoped decision** (`upsertDecision`) | Approvals are untrusted input until the bus validates them. Apply-time validation covers the definition and the element's strict prop schema; base props are never patched. |
| Deduplicate near-identical candidates | `dedupeCandidates` keys on `componentDefId:targetId:props` (prop order independent) and runs on every generate | Duplicate cards would offer the user the same choice twice; the mock provider is deterministic but a real provider can repeat itself. |

## Fixes found while implementing Phase 6

- **Contrast checks were silently passing.** `culori` v4 exports `wcagContrast`,
  not `contrast`; the old lookup returned `undefined` and the `try/catch` turned
  every ratio into `1`. `src/core/generation.ts` and
  `src/app/contrast-badge.tsx` now import `wcagContrast`, so the
  "black on black" mock candidate and the contrast badge report real numbers.
- **`apply_candidate` patched base props.** It now records an instance decision
  through the same `upsertDecision` path as a scoped inspector edit. Base props
  stay untouched, the overlay/resolver picks the value up, and replaying the same
  `candidateId` is still a no-op.
- **Optional props failed their own constraints.** `radius` and `fontWeight` are
  optional in `targetDefs`, but the finite-number checks treated a missing value
  as invalid. They now only run when the prop is present.

## Tooling

- `npm run lint` runs ESLint with module-boundary rules: `core/` cannot import
  `app/`, `modules/`, `persistence/`, React or storage; `modules/` cannot import
  `persistence/` or sibling modules; `persistence/` imports `core/` only.
  Unused-variable warnings are reported but do not fail the run.

## Generalization (post-Phase 6)

The hotel-specific demo was removed: `emptyProject()` is the start state,
`referenceProject()` is site-agnostic, and the former `Rooms` page is now `About`.
Hotel-only canvas/nav/global-change files were deleted in favour of the generic
`Canvas`, `App` page tabs and `ScopePicker`.

## Verification

- `npx tsc --noEmit` — clean.
- `npm run lint` — 0 errors, 60 unused-variable warnings.
- `npx vitest run --no-file-parallelism` — 23 files, 156 tests passing.
- `npx tsx scripts/bench2.ts` — incremental resolve p95 0.234–0.380 ms
  (budget < 10 ms); full cold resolve p95 3.3–19.1 ms depending on run
  (first run pays JIT warm-up).
