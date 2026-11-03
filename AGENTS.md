# AGENTS.md: Quil

## What Quil is
Quil is a guided design workspace for websites. Users make design decisions progressively. Quil stores each approved decision as explicit data (a scoped constraint) and applies it deterministically to later generation and editing. Nothing becomes part of the design system just because AI generated it. It becomes canonical only after the user approves it.

The MVP proves one thing: a user decides once, and Quil preserves and applies that decision across the app. Reference project: a site-agnostic starter project with Home and About pages.

## Architecture you must preserve
1. Structured state is the source of truth: a typed project document (project > pages > sections > elements) plus a decision registry plus an asset registry. The canvas is a view of that state. HTML is never the source of truth.
2. Every change to the document is a typed Command sent through ONE command bus. Canvas gestures, inspector edits, AI approvals, undo/redo and imports all use the same path. No component writes document state directly. No second store, no parallel CSS-variable state, no temporary bypass.
3. The model proposes. The application validates and applies. AI output is untrusted input.
4. Scope is first-class: instance, page, global. Precedence is deterministic: preview overlay > instance > page > global > component default. Same-scope conflicts resolve by a documented total order, never by insertion order.
5. Resolved design is derived from the document and the decisions. Never store it as a second mutable copy.
6. Keep three things separate: the page spec (what a page must contain), design decisions (how things look and where they apply), and the element tree (the rendered state).
7. Stable branded IDs for elements, decisions, assets, candidates and commands.
8. core/ has no React, DOM, network or AI-provider imports. It is pure and runs in Node tests.
9. Persistence is write-behind and never on the interaction path. It saves the complete state (document, decisions including superseded ones, asset references, history metadata) atomically.
10. Do not claim a guarantee that no validator or test checks.

## Module boundaries (enforced by lint; do not weaken the rule)
core/ imports nothing from app/, modules/ or persistence/.
modules/* may import core/ but never each other; they talk through commands and events.
persistence/ imports core/ only.
app/ composes everything.

## Performance contract: the editor must feel instant
- Interaction state (drag, resize, scrub, typing) is ephemeral. It renders straight to the DOM at frame rate. Only the final result is committed, as ONE coalesced command on release.
- A committed command must go command > resolve > render within the same frame for instance-scope edits on a 500-element page. Budgets live in docs/PERF.md.
- Resolution is incremental. Recompute only elements whose own properties or applicable decisions changed, using the dependency index. No full-document re-resolve and no full React re-render per edit.
- Components subscribe to the narrowest slice (per-element selectors). Selection handles live on an overlay layer so they never re-render content.
- AI work never blocks the main thread or the UI. Candidates preview through an overlay layer that never touches the committed document.
- No network call, IndexedDB write or whole-project serialization on the interaction path.
- Any change that adds work to the hot path ships with a benchmark and keeps every budget green.

## Defensive coding standard (anti-happy-path)
Assume every input is hostile, malformed, stale, duplicated or late. Assume every dependency fails, every write is partial and every await may never return.
- Parse, don't validate. Strict schemas (Zod or equivalent, unknown keys rejected) at every boundary. Downstream code receives validated, branded types.
- Allowlists, not blocklists: properties, element kinds, URL schemes (https and internal asset IDs only), CSS values through per-property validators. Never build CSS or HTML from strings. No dangerouslySetInnerHTML. No eval or Function constructor.
- Fail closed. A failed validation rejects the whole operation, leaves state untouched, and returns a typed error carrying code, rule and target.
- Result types at module boundaries. No thrown strings, no silent catch. Exhaustive switches with a never-check. No any. TypeScript strict plus noUncheckedIndexedAccess.
- Bound everything: elements per page, tree depth, string length, decision count, candidate count, payload bytes, retries, history length. Clamp numbers. Reject NaN and Infinity.
- Every await that crosses a boundary (AI, network, storage) has a timeout and an AbortController. Retry only idempotent operations, with capped, jittered backoff.
- Idempotency: applying the same command or candidate twice gives the same state (dedupe by CommandId and CandidateId). Double clicks, retries and replays are normal.
- Concurrency: every proposal records the base revision it was computed from. Apply only if the base still matches, or if the patch rebases cleanly onto disjoint properties. Otherwise mark it stale and surface it.
- Invariant checker: validateProject(state) runs after every command in dev and tests (sampled in production). A violation rolls the command back, reports it, and never reaches persistence.
- Multi-tab: one writer per project (Web Locks). Other tabs open read-only with a clear banner.
- Secrets: BYOK keys never appear in logs, error reports, AI context, URLs, analytics or plaintext storage. Redact in the logger itself.
- Prompt injection: user text, imported content and page content are data inside delimited fields. The model can only produce allowlisted patches on the permitted target, so injected instructions have a bounded blast radius.
- Never trust the client on the server. Re-validate with the shared core package. Row Level Security on every table, tested with two users.

## Process for every task
1. Read AGENTS.md, the docs named in the task, and the existing code before designing anything. Cite the files and symbols you read.
2. Post a plan: your understanding, the existing code involved, files to change, interfaces touched, failure modes, tests, budgets affected. STOP and wait for approval unless told to proceed.
3. Write failing tests first, adversarial and negative cases before the happy path.
4. Implement the smallest change that satisfies the task. No unrelated refactors, renames or new dependencies without asking.
5. Self-review as a hostile reviewer. List five ways your change breaks (malformed input, stale state, partial failure, race, abuse) and add a test for each.
6. Run typecheck, lint, the relevant tests, and the perf benchmark if you touched the hot path. Never claim a check passed unless you ran it and saw it pass. Report what you could not run.
7. Report in the format below.

## Report format
Summary (3 lines). Files changed and why. Commands run with actual results (pass/fail counts). Failure modes considered, each with the test that covers it. Performance numbers against budget (if relevant). Known limitations, open risks, assumptions you made. Questions.

## Stop and ask before
Changing a shared interface, schema or scope semantics. Adding a dependency. Touching code outside the task's scope. Weakening a test, lint rule or validator. Anything that stores or sends secrets or user content to a new place.

## Definition of done
Acceptance criteria met. Adversarial tests present and passing. Typecheck, lint and the full suite green. Budgets met. Docs updated if a contract changed. No TODO that hides a missing failure path.

### UI contract 
```text
## UI contract
- Tokens only. Every colour, type size, space, radius, shadow and duration comes from src/ui/tokens.css. No hex values, font sizes or shadows inside components. A lint rule enforces it.
- Palette: dark theme only. Monochrome with no pure white and no pure black, plus ONE violet accent. No second accent. No gradients on chrome.
- Fonts: Archivo for H1 to H4, Inter for all other UI text, both self-hosted. The user's own designs use their own font allowlist and never Quil's chrome tokens.
- Text intensity is colour tone, never opacity: 100 for headers, then 95, 90, 85, 80, 75, 70 per level. A CI contrast test (culori) checks every level against bg and surface at 4.5:1 or better.
- Every button is a solid fill and its label colour is var(--bg). Mechanical press: a hard 3px edge that collapses on :active with translateY(3px). No outline, ghost or text-only buttons; quiet actions are links. 44px minimum target, 40px for icon-only buttons.
- Cards: 10px radius, the 3px shadow token, surface colour. A selected toggle card renders pressed with an accent ring and a check or dot, never colour alone.
- Workspace is desktop first (1100px and up) with a 2fr and 1fr grid and independent scrolling panels. Landing and sign-in are responsive to 360px.
- WCAG 2.2 AA: keyboard operable, visible focus, no colour-only state, aria-live for async status, reduced motion respected.
- UI chrome must never re-render canvas content. Panels subscribe to the narrowest slice of state and send every change through the command bus.
- Untrusted text (AI-proposed labels, project names, provider messages) renders as text only and is length-capped.
```
