# Quil: Coding-Agent Prompt Pack

Oct 24, 2026 · @Maurice

## How to use this pack

Give every agent the master prompt once, then one phase prompt per task, then run the test-engineer and reviewer prompts in fresh sessions before you merge.

1. Commit the master prompt as `AGENTS.md`. Add `docs/PERF.md` and `docs/SECURITY.md` to the seven docs already in your plan.
2. Paste one phase prompt. Every prompt ends with 'post your plan and stop', so you read the plan before any code is written.
3. Run the test-engineer prompt in a fresh session, so tests come from the spec and not from the code under test.
4. Run the reviewer prompt on the diff in another fresh session. Fix, then rerun it.
5. At each phase gate, run the red-team prompt and tick the gate checklist.

This pack follows the sequence in your second document: core model and decision engine first, canvas after. The sync spine has to exist before anything renders. Where it differs from the order in the MVP plan, use this one.

| Phase | Modules | What it produces |
| --- | --- | --- |
| 0 | A (read-only) | Audit, baseline, performance harness |
| 1 | D | Core model, command bus, invariant checker |
| 2 | D | Decision registry, incremental resolver |
| 3 | F, A | Canvas, 20/80 tools, scope picker |
| 4 | G | Local persistence, op log, migrations |
| 5 | B, C | Intake, page specs, provider interface |
| 6 | E | Targeted generation with overlay preview |
| 7 | D, E, A | Rooms page and cross-page inheritance |
| 8 | H, A | Hardening, acceptance test, measurement |

Text in \[brackets\] inside a prompt is yours to fill. The prompts are plain text, so they paste into any coding agent. Every number in them (budgets, size limits) is a starting target; replace each with a measured value after Phase 0.

## Master prompt (AGENTS.md)

This is the contract every agent reads before touching code. It carries the product context, the architecture it must not break, the performance contract, and the defensive-coding standard.

```text
# AGENTS.md: Quil

## What Quil is
Quil is a guided design workspace for websites. Users make design decisions progressively. Quil stores each approved decision as explicit data (a scoped constraint) and applies it deterministically to later generation and editing. Nothing becomes part of the design system just because AI generated it. It becomes canonical only after the user approves it.

The MVP proves one thing: a user decides once, and Quil preserves and applies that decision across the app. Reference project: a boutique-hotel booking site with Home and Rooms pages.

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
```

## Anti-happy-path and defensive rules

An agent that only tests the happy path has not finished. Every phase prompt inherits this catalog: for each boundary, the failure, the required defense, and the test that proves it.

| Boundary | What goes wrong | Required defense | Test that proves it |
| --- | --- | --- | --- |
| AI output | Extra keys, wrong target, out-of-scope properties, fewer or duplicate candidates, NaN, injected instructions in text | Strict schema, per-target property allowlist, dedupe, hard constraints computed in code | Fuzz the validator with random mutations; a hero candidate patching button typography is rejected |
| Stored data | Old schema, truncated write, tampering, duplicate IDs, dangling references | Version stamp, migrate or quarantine, validateProject on load, backup before migration | Load a truncated fixture: recovery screen shown, original untouched |
| Style values | CSS injection through a value, url() exfiltration, oversized values | Per-property value validators, typed style map, no string-built CSS | Payload corpus run against every property |
| Text and names | XSS, RTL override characters, zero-width characters, megabyte strings | Render as text nodes only, length caps, normalization | A name containing an img onerror payload renders as literal text |
| URLs and assets | javascript: and data: URLs, scripted SVG, oversized or spoofed files, SSRF | Scheme allowlist, upload through Storage with size cap and MIME sniffing, no raw SVG, never fetch arbitrary URLs server-side | Hostile upload corpus rejected; private-IP URL refused |
| Object keys | **proto** or constructor used as an ID or property name | Map or null-prototype objects, ID regex, strict schemas | Pollution probe leaves Object.prototype clean |
| Tree structure | Cycles, orphans, self-parent, depth bombs | Acyclic, orphan and depth checks in validateProject | Move-into-own-descendant rejected |
| Numbers | NaN, Infinity, negative sizes, overflow, float drift in layout | Reject non-finite values, clamp, fixed precision | Property test over extreme values |
| Concurrency | Edit during AI generation, double approve, undo mid-command, two tabs | Base-revision check, idempotent IDs, serialized command queue, Web Locks | Race matrix test; second tab opens read-only |
| Storage failure | Quota exceeded, aborted transaction, tab killed mid-write, offline | Atomic snapshot swap plus op log, save status stays unsaved until commit, capped retry | Fault injection at every step of a write |
| Provider failure | 429 or 5xx, timeout, stream cut, refusal | Deadline and abort, jittered backoff, circuit breaker, typed error in the UI, state preserved | Fake provider scripted to fail each way |
| Scope semantics | Deleting an element that has instance decisions, global rule with zero matches, equal-scope conflict, spec change after approval | Explicit orphan policy, deterministic tie-break, conflict surfaced instead of deleted | Oracle test: incremental resolve equals full resolve |
| Secrets (BYOK) | Key in logs, AI context, error reports or analytics | Redacting logger, context builder allowlist, encrypted at rest if stored server-side | Seed a fake key; assert it appears only in the provider request |
| Server | Missing RLS, IDOR, mass assignment, abuse | RLS on every table, server re-validates commands, rate limits | Two-user cross-access test; over-limit test |

### Rules for the tests themselves

- Negative-first: for each acceptance criterion write at least three adversarial cases (malformed, stale or duplicated or late, partial failure) before the happy path.
- Property-based tests (fast-check) for every invariant: resolver determinism, idempotent re-apply, undo then redo round trip, incremental equals full recompute.
- Command fuzzing: random command sequences must either leave validateProject clean or be rejected with state unchanged.
- No vacuous tests. A test with no assertion, or one that mocks the thing it claims to test, counts as missing.
- Failure messages name the rule and the target, so a human can act without reading the code.

## Zero-lag sync architecture

The editor never waits on anything except its own memory. Canvas edits, inspector edits, AI approvals and undo all go through one in-memory command bus. Storage, network and the model run behind it, never in front of it.

&#91;embedded content: command flow · 4 inputs, 1 bus, 2 overlays, 2 async stores\]

Everything left of the renderer happens in memory. The dashed boxes run after the frame and cannot delay it; the preview overlay and gesture layer feed the renderer directly and never enter the document.

### The hot path

1. **Gesture layer.** While the user drags, resizes or scrubs, pointer events write straight to element styles in requestAnimationFrame. The document store is not touched.
2. **Commit.** On release, one coalesced command is dispatched.
3. **Validate in memory.** Cheap checks only: this command's schema, the target exists, the property is allowed, values are in bounds.
4. **Reduce.** The reducer returns the new state, the patches and the inverse patches in one pass. The inverse is the undo entry, so undo is never a snapshot copy.
5. **Incremental resolve.** A dependency index maps each decision to the elements it matches. A command yields a set of dirty element IDs, and only those are re-resolved.
6. **Render.** Each element subscribes to its own resolved props. Only changed elements update.
7. **After the frame.** The op log is written to IndexedDB, batches go to Supabase, telemetry is sent. None of this can block step 6.

### Three layers the renderer composes

- **Committed.** The document plus approved decisions. Persisted and undoable.
- **Preview overlay.** AI candidates and hover previews. Highest precedence, never persisted, never in undo. Approving turns the overlay into one apply\_candidate command. Rejecting drops it.
- **Gesture layer.** In-flight pointer work. Discarded on Escape, blur or pointercancel.

Selection boxes and resize handles live on a fourth overlay above the content, so selecting never re-renders it.

### Keeping manual edits and AI in sync

- Every AI request records the target's revision and the decision registry version it was computed from.
- If the user edits the target while generation runs, the results are marked stale. If the edit touched disjoint properties the candidate can rebase; otherwise the user regenerates. A stale candidate is never applied silently.
- Approval is idempotent by CandidateId and re-validates at apply time against the current state.
- Candidates stream in and render as each one validates. Cancel is instant, and the UI stays interactive during generation.
- Two generations on one target: the newer cancels the older.

### Where Supabase and Redis sit

Neither is on the hot path. The browser holds the live state. Supabase receives op batches with idempotency keys (client ID plus sequence) and assigns the global order. Redis, if used, only rate-limits and caches AI calls. For the later duo mode, the same op log with server-assigned sequence numbers supports branching and diffs, which fits your GitHub-for-design idea.

### Starting latency budgets

These are targets to enforce in CI from the Phase 0 harness, not measured results. Replace them with numbers measured on your reference device.

| Operation | Starting budget | How it is enforced |
| --- | --- | --- |
| Drag, resize or scrub, 500-element page | Under 10 ms main-thread work per frame (60 fps) | Playwright trace, fails CI on regression |
| Committed instance edit, command to painted DOM | Same frame (about 16 ms) | performance.mark from dispatch to paint |
| Page or global decision touching 200 elements | Under 50 ms to paint | Benchmark on the 2,000-element fixture |
| Undo or redo | Under 32 ms | Benchmark |
| Switching AI candidate previews | Under 50 ms, zero network | Long-task test |
| Main thread during streamed generation | No long tasks over 50 ms | PerformanceObserver test |
| Op log flush | Within 300 ms of the last command and on pagehide, off the frame | Fault-injection and long-task tests |
| Cold load, 2,000 elements from IndexedDB | Under 1 s to interactive | Playwright |

Two cheap guards keep these honest. Measure on a CPU throttled to 4x slowdown as well, because the editor must feel instant on mid-range hardware. And profile before moving anything to a Web Worker: start on the main thread, and move the resolver or validators into a worker only if the numbers demand it.

## Recommended stack

Run the editor entirely in the browser and use Supabase for everything durable. Add Redis only for AI rate limits and caching. Nothing in this stack sits on the interaction path.

These picks come from general knowledge, not from benchmarks against Quil. Have the Phase 0 agent verify each one against the current docs for the version you install, including limits and pricing, before you commit.

| Layer | Pick | Why | Avoid for the MVP |
| --- | --- | --- | --- |
| Language and validation | TypeScript (strict) and Zod | One schema serves the browser, any worker and the Edge Function; types are inferred from schemas | Hand-written validators that drift from the types |
| UI shell | React and Vite single-page app | An editor does not need server rendering; Next.js only for marketing and auth pages | Server components in the editor |
| Document store | Small custom store, or Zustand with Immer (produceWithPatches) | Inverse patches give undo for free; per-element selectors keep re-renders narrow | Whole-tree re-renders; opaque auto-tracking that is hard to audit |
| Rendering | DOM and CSS transforms, with a separate overlay layer | Real text, accessibility and real CSS output, so export later is easy | Canvas or WebGL engines (Pixi, Konva): you would rebuild text layout. Revisit above several thousand elements |
| Handles and snapping | Minimal custom move, resize and snap, or Moveable | Small surface you can test | Large scene-graph frameworks |
| Local persistence | IndexedDB through Dexie (op log plus snapshots) | Transactions, versioned schema, works offline | localStorage for project data |
| Backend | Supabase: Postgres with RLS, Auth, Storage with signed URLs, Edge Functions | One vendor; RLS adds defense in depth; Edge Functions hold the AI proxy and server-side validation | One giant JSONB row per project; plan for tables: projects, ops (append-only), snapshots, assets, ai\_usage |
| Cache and limits | Redis, serverless over HTTP (for example Upstash) | Per-user AI rate limits, dedupe and cache of generation calls keyed by a hash of the context, later presence | Redis for sync or document state; Postgres is enough |
| AI layer | Own provider interface, with the Vercel AI SDK or a thin wrapper underneath | Streaming, structured output, multiple providers behind your interface | Letting a provider SDK type leak into core/ |
| BYOK keys | Hold in memory or session only and send per request through the Edge Function; if stored, encrypt server-side (Supabase Vault) | Limits exposure if the page is compromised | Plaintext keys in IndexedDB, logs or analytics |
| Colour | culori (OKLCH, contrast math) and react-colorful | Contrast checks computed in code, tiny picker | Asking a model whether contrast passes |
| Fonts | Fontsource, self-hosted, a curated list of 30 to 40 families with pairing presets | No third-party request on load; limits the font allowlist you must validate | Free-text font names |
| Images | Supabase Storage with image transformations (or Cloudflare Images); Unsplash or Pexels API for placeholders | Resize at the edge, stable asset IDs | Embedding image payloads in the document |
| Testing | Vitest, fast-check, Playwright (with trace and CPU throttling), Stryker on the resolver | Property tests and perf gates are the core of this plan | Snapshot-only testing |
| Boundaries and quality | ESLint boundaries plugin or dependency-cruiser; Biome or Prettier | Module rules become CI failures, not conventions | Rules only described in a doc |
| Observability | Sentry with a redacting scrubber, web-vitals, custom performance.mark; PostHog later | You need time-to-accepted-design and repeated-corrections numbers | Logging document contents |

### Decisions worth making deliberately

- **CRDTs (Yjs) are not in the MVP.** The decision registry has semantic conflicts, such as an instance override against a global rule, that a text-merge CRDT cannot resolve. Use the op log with server-assigned order and explicit conflict detection. Yjs may fit plain text fields later.
- **Duo mode, later.** A per-document single writer fits it best, for example Cloudflare Durable Objects, or a hosted option such as Liveblocks or PartyKit. Keep commands serializable and idempotent now so this is an add-on, not a rewrite.
- **Convex** is a reasonable alternative if you would rather not run sync yourself, since it offers reactive queries and server functions in TypeScript. It would shape your op-log design, so decide before Phase 4. Keep the in-memory command bus either way.
- **Web Workers.** Start on the main thread. Move validators, large resolves or serialization into a worker only when profiling shows frame-time pressure.

## The 20/80 designer toolset

Ship the operations designers use in almost every session, and leave everything that needs a geometry engine or a prototyping runtime. Auto-layout is the single most valuable item, because a website is a tree of stacks and not a pile of free-floating shapes.

| Group | Ship in the MVP | Notes for the agent |
| --- | --- | --- |
| Select and arrange | Select, multi-select, marquee; move; resize (proportional with Shift); align and distribute; snapping with guides to siblings, edges and equal spacing | Snap targets come from the tree, not a global scan |
| Structure | Layers panel (reorder, rename, hide, lock); duplicate, delete, copy and paste | Paste re-IDs every element and validates foreign clipboard data |
| Layout | Auto-layout: direction, gap, padding, alignment, hug or fill sizing | Spacing values snap to a spacing scale from the decisions |
| Fill and stroke | Solid fill, one linear gradient, image fill, opacity; border; corner radius | One fill per element in the MVP |
| Effects | Shadow, as 3 to 5 elevation presets | Presets are tokens, so changing one is a decision |
| Text | Inline editing (plain text, one style per element); family, size, weight, line height, letter spacing, alignment; type-scale presets | Font family comes from the curated allowlist |
| Images | Replace, fit or fill, crop with a focal point | Stable asset IDs only |
| View | Zoom, pan, fit to screen; undo and redo; keyboard shortcuts | Every shortcut dispatches a command |
| Quil-specific | Scope picker on every style edit; drift badge; contrast badge | See below |

### The three Quil-specific tools

- **Scope picker.** Shown only when an edit can reasonably apply beyond the instance. States the effect in plain words and shows a live count of affected elements.
- **Drift badge.** When a hand edit deviates from an approved decision, the user is signalled and chooses: keep it as an instance override, or propose changing the decision. Nothing alters a decision without approval.
- **Contrast badge.** Computed in code from the resolved colours, never asserted by a model.

### Waits until after the MVP

Pen and vector tools, boolean operations, masks, blend modes, multiple fills and effect stacks, responsive breakpoints and constraints, component variants with overrides (only simple shared components now), prototyping and animation, plugins, comments and multiplayer cursors, rotation, rich-text spans, code export and dev mode.

**Rule for adding a tool later.** A tool earns a slot only if it maps to a typed command, to a property the renderer supports reliably, and to a test of its scope behaviour.

## UI foundations

The workspace is one full-height page: the canvas takes two thirds, the tools take one third. Everything below is written as a token or a rule an agent can implement without making taste calls. The MVP ships one theme: dark, with a violet accent.

Quil's own interface uses Archivo and Inter. The designs your users create use their own font choices; never reuse Quil's chrome tokens inside a user's design.

### Tokens

```css
:root {
  /* Dark theme. Monochrome: no pure white, no pure black */
  --bg: #141413;
  --surface: #1E1E1C;
  --ink: #ECECE8;
  /* One accent: violet. Bright, because the button label is the dark background colour. Lightness is tuned until the contrast test passes */
  --accent: oklch(0.74 0.19 295);

  /* Text intensity is colour strength, never opacity. Header 100, then 5 less per level */
  --t100: var(--ink);
  --t95: color-mix(in oklab, var(--ink) 95%, var(--bg));
  --t90: color-mix(in oklab, var(--ink) 90%, var(--bg));
  --t85: color-mix(in oklab, var(--ink) 85%, var(--bg));
  --t80: color-mix(in oklab, var(--ink) 80%, var(--bg));
  --t75: color-mix(in oklab, var(--ink) 75%, var(--bg));
  --t70: color-mix(in oklab, var(--ink) 70%, var(--bg));

  --line: color-mix(in oklab, var(--ink) 14%, var(--bg));

  /* Shape */
  --r-card: 10px;
  --r-ctl: 8px;
  --shadow-card: 0 3px 6px color-mix(in oklab, #0A0A09 70%, transparent);
  --press: 3px;

  /* Type */
  --font-head: 'Archivo', system-ui, sans-serif;
  --font-ui: 'Inter', system-ui, sans-serif;

  /* Space: 4px grid */
  --s1: 4px; --s2: 8px; --s3: 12px; --s4: 16px; --s6: 24px;
  --s8: 32px; --s12: 48px; --s16: 64px; --s24: 96px;
}
```

### Type scale and text intensity

Each step down in importance lowers the text tone by 5 points, starting at 100 for headers. Intensity changes the text colour only. Do not use CSS opacity for it, because opacity also mutes icons and children and breaks contrast math.

| Level | Font | Size and line height | Intensity | Used for |
| --- | --- | --- | --- | --- |
| Display and H1 | Archivo 800 | 56 / 1.05 and 40 / 1.1 | 100% | Landing headline, intake questions, page titles |
| H2 | Archivo 700 | 32 / 1.15 | 95% | Section titles |
| H3 | Archivo 700 | 24 / 1.2 | 90% | Card titles, panel titles |
| H4 | Archivo 600 | 20 / 1.3 | 85% | Option titles, sub-sections |
| Body | Inter 400 | 16 / 1.5 | 80% | Paragraphs, descriptions |
| Small | Inter 500 | 14 / 1.45 | 75% | Inspector labels, helper text |
| Caption | Inter 500 | 12 / 1.4 | 70% | Step counters, hints, metadata |

Self-host both families (Fontsource), preload only the weights in the table, use font-display swap with metric-matched fallbacks so the page does not shift when the fonts load.

### Buttons: full fill with a mechanical press

Every button is a solid fill. The label is the page background colour, so the text looks cut out of the button. A hard 3px edge sits under the button; pressing drops the button onto it.

```css
.btn {
  --fill: var(--accent);
  --edge: color-mix(in oklab, var(--fill) 65%, var(--bg));
  min-height: 44px; padding: 0 var(--s6);
  border: 0; border-radius: var(--r-ctl);
  background: var(--fill); color: var(--bg);
  font: 600 15px/1 var(--font-ui);
  box-shadow: 0 var(--press) 0 var(--edge);
  transition: transform 60ms ease-out, box-shadow 60ms ease-out;
}
.btn--neutral { --fill: color-mix(in oklab, var(--ink) 78%, var(--bg)); --edge: color-mix(in oklab, var(--fill) 55%, var(--bg)); }
.btn:hover:not([aria-disabled='true']) { transform: translateY(-1px); box-shadow: 0 calc(var(--press) + 1px) 0 var(--edge); }
.btn:active:not([aria-disabled='true']) { transform: translateY(var(--press)); box-shadow: 0 0 0 var(--edge); }
.btn:focus-visible { outline: 2px solid var(--ink); outline-offset: 3px; }
.btn[aria-disabled='true'] { --fill: color-mix(in oklab, var(--ink) 30%, var(--bg)); box-shadow: none; cursor: not-allowed; }
@media (prefers-reduced-motion: reduce) { .btn { transition: none; } }
```

- **Two fills only.** Primary uses the accent. Neutral uses a dark monochrome. There are no outline, ghost or text-only buttons; a quiet action is a link.
- **Toggle buttons stay pressed.** A selected toggle renders in the pressed position, so the metaphor stays consistent.
- **Targets.** 44 px minimum height, 40 px square for icon-only buttons, each with an accessible name.
- **Disabled** uses aria-disabled, so it stays focusable and can explain itself, and it does not animate.

### Cards and selection

- Cards use the surface colour, a 10 px radius and the 3px shadow token. The surface is lighter than the page, because a shadow alone barely shows on a dark background.
- Selectable cards (intake options, variants) show selection as a pressed card with an accent ring, never colour alone: the ring, a check mark or dot, and the pressed position all change.
- Hairline borders use the line token. Nothing else uses a border to separate content.

### Contrast is a hard constraint

Because the button label is the background colour, the accent must sit far from the background in lightness. On this dark background that means a bright, saturated accent. Violet works at roughly the lightness in the tokens above, tuned by the test. A deep violet would fail, because a dark label on a dark accent is unreadable. Enforce it in CI with culori:

1. Every text intensity level against the bg and the surface: at least 4.5:1.
2. Button label against each fill: at least 4.5:1.
3. Accent against bg for non-text parts (rings, selection): at least 3:1.
4. If the accent fails, the agent raises its OKLCH lightness, keeping chroma, until it passes, and reports the final value.

## Pages and routes

Six pages and one invisible callback route. A first-time user goes landing, sign-in, intake, workspace. A returning user goes sign-in, projects, workspace. Settings is one click away from every signed-in page.

| Route | Page | Purpose | Access |
| --- | --- | --- | --- |
| / | Landing | Tell the story and move the visitor to sign-in | Public |
| /signin | Sign-in | Continue with Google or Apple | Public; redirects away if signed in |
| /auth/callback | OAuth callback | Exchange the code for a session, then redirect; shows only a spinner and error state | Public |
| /projects | Projects | List projects, start a new one | Signed in |
| /new/:step | Intake | Guided questions, page suggestions, starting page | Signed in |
| /p/:projectId | Workspace | Canvas, tools, variants | Signed in, owner only |
| /settings | Settings | API key setup (BYOK) and sign-out | Signed in |

### Rules every route follows

- **Guards.** Unauthenticated visits to a signed-in route go to /signin with a next parameter. The next value is accepted only if it is a same-origin path from an allowlist of known routes, so it cannot become an open redirect.
- **No existence leaks.** Another user's project returns the same not-found page as a project that does not exist. Row Level Security enforces this; the router does not decide it.
- **Empty, loading and error states** are designed for every page, never a blank screen or a raw error.
- **Desktop first.** The app routes assume a viewport of at least 1100 px; narrower shows a short message instead of a broken layout. The landing and sign-in pages are fully responsive down to 360 px, because visitors arrive from phones.
- **Settings reachable.** A text link labelled Settings sits in the top bar on every signed-in page, and the workspace key-status chip links straight to the API key section.

## Workspace: canvas, tools and variants

The canvas takes two thirds of the width and the tools panel one third. Variant cards sit at the bottom of the canvas, and tapping one previews it in place on the page.

&#91;embedded content: wireframe · canvas with page tabs and variants tray, tools panel with prompt box\]

### Layout rules

- CSS grid with columns 2fr and 1fr, full viewport height. Each column scrolls on its own, and the canvas never reflows when the tools content changes.
- The tools panel has a minimum width of 320 px. The divider is fixed in the MVP; a draggable divider can wait.
- Because the page sidebar is gone, page tabs sit at the top of the canvas, and the layers list is a tab inside the tools panel.
- **Top bar:** logo, editable project name, save status, undo and redo, a Spec link back to the page specification, and a Settings link.

### Tools panel, top to bottom

1. **Selection header.** What is selected, with its path (Home, Hero, Heading).
2. **Inspector.** Only the properties the renderer can represent.
3. **Scope picker.** Appears when an edit can apply beyond the instance. Plain-language effect and a live count of affected elements.
4. **Applicable decisions.** The approved decisions that affect the selection, each marked active or overridden, with the drift badge when a hand edit deviates.
5. **Prompt box, pinned to the bottom.** A target chip filled from the selection (changeable), an optional instruction field, and a Generate 3 variants button. A status line shows the key in use, or a link to Settings when none is set.

### Variants tray

- **Cards.** Each card is a live miniature of the target with that candidate applied, plus a title, one line of rationale, and constraint chips. Chips say whether a check was automated or stated by the model.
- **Tap to preview.** Selecting a card applies the candidate to the preview overlay on the canvas and shows a Previewing variant 2 pill. Escape or tapping the card again returns to the approved design. No network call happens on a tap.
- **Actions in the tray header.** Approve opens the scope picker with the affected-element count. Reject and Regenerate sit beside it. Approve never fires from a single stray keypress.
- **While generating.** Skeleton cards fill in one by one as each candidate validates; the rest of the app stays interactive and Cancel is instant.
- **If the target changed.** The cards carry a Target changed banner and a Regenerate action, per the stale-base protocol.
- **Empty and error states.** No key: the prompt box is disabled with a link to Settings. Provider failure: an inline message with Retry. No valid candidate: say which hard constraint blocked them.

### Accessibility

The tray is a radio group with one tab stop and arrow-key movement, keys 1, 2 and 3 pick a variant, and an aria-live region announces Previewing variant 2. The inspector controls all have visible labels.

## Intake flow

One question per screen, generous space, and option cards that feel like physical keys. The user never sees a font or colour choice here; intake captures intent, and visual decisions come later in the workspace.

### Screen anatomy

- A centred column, 640 px wide at most, 96 px of space above the question.
- A caption-level step label (Question 3 of 6) above a question set in Archivo at H1 size. One helper line below it in body tone.
- 48 px between the question block and the options, 64 px between the options and the footer.
- A 3 px progress bar fixed to the top of the viewport, accent fill.
- Footer: a neutral Back button and a primary Continue button. Skippable questions get a Skip for now link, never a button.
- Steps slide and fade over 200 ms, and switch to an instant swap under reduced motion.

### Single-pick and multi-pick

The two must look different by shape and not only by colour.

|  | Single-pick | Multi-pick |
| --- | --- | --- |
| Control | Round indicator at the card's left edge | Square check box at the card's top right |
| Semantics | Radio group, one tab stop, arrow keys move and select | Checkbox group, each card focusable, Space toggles |
| Helper line | Choose one | Pick all that apply, with a live count (3 selected) |
| Selected state | Pressed card, accent ring, filled dot | Pressed card, accent ring, check mark |
| Special options | None | An Other card that opens an inline text field, and an exclusive None of these card that clears the rest |
| Limits | None | Optional maximum; at the limit, unselected cards disable with a line saying why |

Both use the same card: 72 px minimum height, 20 px padding, an H4 title and a one-line description in small tone. Number keys select options 1 to 9. Cards are at least 44 px high and keep their target size inside two-column grids.

### Default flow

1. **Describe your app.** A large text area, with example chips that insert starter text when tapped.
2. **Who is it for.** Multi-pick, skippable, options proposed from the description.
3. **What should visitors do.** Multi-pick, skippable.
4. **How should it feel.** Single-pick of tone words (calm, bold, playful), no fonts or colours.
5. **Pick your pages.** Multi-pick cards for the suggested pages. Each name can be renamed inline, and an Add a page field sits at the end.
6. **Where do we start.** Single-pick among the selected pages, Home preselected.
7. **Review.** Every answer listed with an Edit link, then a primary Create project button.

Steps 2 to 4 are adaptive: the provider proposes options when they would change the page plan, and a static fallback set appears if it fails. Never exceed seven screens.

### Loading and failure

Create project shows real progress events (reading the brief, proposing pages, drafting the Home spec), not a fake timer. Each answer saves as it is made, so a refresh or the browser back button resumes where the user was. Validation messages appear inline, with an icon and text, and never block going back.

## Landing story and positioning

Do not sell Quil as a better generator or a better canvas. Sell a different category, decision-native design, and compete on the one factor the neighbours do not: whether an approved decision stays true.

### What the neighbours compete on

- **Prompt-to-app builders (Lovable, Figma Make).** Speed from a prompt to a working app. Lovable positions itself as an AI full-stack engineer covering frontend, backend and publishing ([review](https://skillscouter.com/lovable-review/)). Figma Make turns chat prompts into prototypes and web apps and can read a design library for consistency ([Figma docs](https://developers.figma.com/docs/code/intro-to-figma-make/)). One reviewer found that a later prompt could override an earlier fix, such as a contrast correction ([UX Planet](https://uxplanet.org/figma-make-complete-guide-a3bf0425537e)).
- **Canvas tools (Figma, Paper).** Precision, collaboration and handoff. Paper bets on a code-native canvas built on real HTML and CSS that agents read and write through MCP, with tokens and components syncing to the codebase ([Banani review](https://www.banani.co/blog/paper-design-mcp-review), [Brandfetch profile](https://brandfetch.com/paper.design)).
- **Common ground.** All three compete to produce or translate designs faster. In the product descriptions I found, none treats an approved design decision as a scoped object that the system enforces. Confirm that before it appears in public copy.

### Quil's position

For founders and developers who ship interfaces without a design team, Quil is the design workspace where every decision you approve is remembered, scoped and enforced. Unlike generators that rewrite your work, and canvases that make you repeat it.

Your own thesis is the emotional core: AI design is not a skill problem, it is an attention-to-detail problem. Quil supplies the attention.

### Who the blue ocean is for

Three tiers of non-customers to test in interviews. These are hypotheses, not findings.

- **Soon-to-be:** people who use generators today and keep fixing the same things on every pass.
- **Refusing:** developers who avoid design tools because of the learning curve and the repetition.
- **Unexplored:** founders who ship interface by prompting and accept the inconsistency.

### The strategy canvas

Scores run from 1 (low) to 5 (high). They are my judgment from public product descriptions, drawn to show the shape of the position. Validate them with interviews before using them anywhere public.

&#91;embedded content: author judgment, 1 to 5 · builders such as Lovable and Figma Make, canvas tools such as Figma, code-native canvases such as Paper\]

Read the shape, not the individual scores. The neighbours compete on speed, precision and backend reach. Quil gives up the backend and tool breadth on purpose, and climbs the three factors that decide whether a decision lasts.

### Eliminate, reduce, raise, create

| Action | What Quil does |
| --- | --- |
| Eliminate | Blank-canvas starts. Whole-page regeneration that rewrites approved work. Vector and pen tooling. Backend and hosting scope. |
| Reduce | Tool surface down to the 20/80 set. Approvals per decision, by batching and scoping them. The prompt-writing burden, since variants come from a selection. |
| Raise | Persistence of decisions. Human control over every AI change. Consistency across pages. Attention to detail, through drift and contrast flags. |
| Create | The scoped decision registry as a product object. The drift badge. Decision-aware variant generation. Later: the design graph and duo-mode diffs. |

### The landing page story

| Section | Message | Visual |
| --- | --- | --- |
| 1. Hero | Decide once. Quil remembers. One line on what it is, and a Start designing button that goes to sign-in | A live miniature of the workspace |
| 2. The problem | Every AI design tool forgets what you decided. Three short vignettes: the generator rewrote my buttons, the canvas made me repeat myself, a change on page two broke page one | Three small before and after pairs |
| 3. The shift | Describe, decide, keep. Three beats | The intake screen, then a variant card, then the decision list |
| 4. The proof | Change one global button rule. Only the applicable buttons update, and the promo button with its own override stays put | An interactive demo on the real renderer and decision engine with a fixture project |
| 5. You stay in control | Nothing changes without approval, and you choose the scope: this instance, this page, everywhere | The scope picker |
| 6. A different category | Not another generator, not another canvas | The strategy canvas, without competitor names unless verified |
| 7. Who it is for | Solo builders now, design and dev teams next | Two short cards |
| 8. Close | Start designing, with Google or Apple | The sign-in buttons |

### Headline options to test

1. Decide once. Quil remembers. (recommended)
2. Design that remembers.
3. AI that asks before it changes your design.

### Copy and claim rules

- No speed multipliers. The 20 to 50 percent figures in your plan are hypotheses and never appear as claims.
- Compare by category on the public page. Name a competitor only after each statement about it is verified and reviewed.
- The demo is the real product code running on a fixture, not a recorded animation.
- Respect reduced motion, ship no tracking by default, use real product visuals and no stock imagery.

### Sources

The competitor descriptions above come from third-party reviews and product pages found through search, not from hands-on testing. Treat them as a starting point.

- [Paper.design review: MCP, features, pricing (Banani)](https://www.banani.co/blog/paper-design-mcp-review)
- [Paper profile (Brandfetch)](https://brandfetch.com/paper.design)
- [Lovable review 2026 (SkillScouter)](https://skillscouter.com/lovable-review/)
- [Intro to Figma Make (Figma developer docs)](https://developers.figma.com/docs/code/intro-to-figma-make/)
- [Figma Make complete guide (UX Planet)](https://uxplanet.org/figma-make-complete-guide-a3bf0425537e)

## Auth and settings

Sign-in is Google or Apple through Supabase Auth, nothing else. There is no email and password sign-up, so there is no account confirmation step; both providers have already verified the address.

### Sign-in page

- A centred card with the Quil mark, one headline (Start designing), and two full-width buttons: Continue with Google and Continue with Apple.
- One line under them stating that signing in means agreeing to the terms, with links. No other fields.
- States: idle, redirecting (buttons disabled, label changes), cancelled (a calm message and the buttons back), provider error (message with a retry), and already signed in (redirect).

### Flow and defenses

1. The button starts the OAuth redirect with PKCE and a state value.
2. /auth/callback exchanges the code, creates the session, then redirects to the validated next path. The default is Projects if the user has any, otherwise the intake.
3. Reject a callback whose state does not match, one that is replayed, and one that carries an error from the provider, each with its own message.
4. Sessions: supabase-js keeps the session in browser storage by default, which makes any cross-site scripting hole an account-takeover hole. Ship a strict Content Security Policy with no inline script, and revisit cookie-based sessions if you add server rendering.
5. A session that expires mid-edit must not lose work. Keep local changes, show a re-sign-in dialog, and resume in place.
6. Sign-out in one tab signs out the others, using the auth state-change event and BroadcastChannel.

### Provider setup and gotchas

- **Google:** an OAuth client in Google Cloud Console with the Supabase callback as an authorized redirect URI.
- **Apple:** needs an Apple Developer Program membership, a Services ID and key, and an HTTPS return URL on a verified domain, so plan a real dev domain or a tunnel instead of localhost.
- Apple sends the user's name only on the first authorization. Capture it at that moment or it is gone.
- Apple's hide-my-email option gives a relay address, so the same person signing in with Google and Apple can end up with two accounts. Decide whether to link them before launch; for the MVP, show which provider the account used in Settings.
- Both providers publish branding rules for their sign-in buttons that may conflict with your button style. See the questions at the end of this part.

### Settings page

One column, two sections in this order, with a sticky in-page nav on wide screens: API key, then Account. The route supports /settings#api-key so the workspace can link straight to it.

### API key (BYOK)

Plain, in order, one decision per step.

1. **Heading and explanation.** Your AI provider key. Two sentences on why Quil needs it, then three short statements: where the key is kept, that it is never logged, and that it is sent only to your provider through Quil's server function.
2. **Provider.** Radio cards for Anthropic, OpenRouter, OpenAI and Google, each with its own adapter in the server function. Below them, a Model list with the recommended models marked (see Providers and recommended models).
3. **Key.** A masked field with a Show toggle (a button with aria-pressed), a one-line hint about the key format that never blocks input, and a link to where the user gets a key. Trim pasted whitespace. Turn off autocomplete, spellcheck and autocapitalize.
4. **Storage.** Two radio options: This session only (default, forgotten when the tab closes) or Save encrypted to my account.
5. **Test and save.** One primary button runs a minimal validated request through the server function and then saves.
6. **Status.** A single status block that always shows icon plus text: Not set, Testing, Connected (provider, last four characters, storage mode, date), Invalid key, Rate limited, or Network error. It is an aria-live region, and focus moves to it when a test finishes.
7. **Remove key.** A neutral button with a confirmation step.
8. **Spend guard.** A limit on variant generations per hour, defaulting to a conservative number, enforced in the client and again at the server function, so a bug or a loop cannot drain the user's account.

After saving, never show the full key again. The field clears, and only the last four characters appear in the status.

Defenses: the key lives in a module-scoped variable and never in UI state, devtools-visible stores, error reports, URLs or analytics. The test endpoint is rate limited and never echoes the key. The browser's connect-src policy allows only your own function origin, so the page cannot send the key anywhere else.

### Providers and recommended models

The key page offers Anthropic, OpenRouter, OpenAI and Google. Models come from one registry file, src/config/models.json, so the list can change without touching UI code. A model is marked Recommended only after it clears Quil's own evaluation, not because it tops someone else's leaderboard.

This starting set comes from public rankings and reviews found through search, not from testing in Quil. Confirm every model ID and price in the provider's docs before it ships.

| Provider | Starting recommendations | Evidence | Check at build time |
| --- | --- | --- | --- |
| Anthropic | Claude Opus 5.5 (claude-opus-5-5), Claude Fable 5.1 (claude-fable-5-1), Claude Sonnet 5.5 (claude-sonnet-5-5) | Opus 5.5 is in the top three of one design roundup and scores well on component and data-visualization tasks. A blind benchmark found Fable 5 strongest on open-ended design briefs and Opus 5 on briefs written to a spec; I found no separate result for Fable 5.1. Sonnet 5.5 is the lower-cost default | IDs against Anthropic's model list |
| OpenAI | GPT-5.6 Sol, GPT-6 Astra | Sol ranks first on one live website arena. Astra leads the SVG and 3D categories in a design roundup | Exact API IDs and pricing |
| Google | Gemini 3.6 Flash | Appears across several comparisons as a fast, low-cost model with solid layouts. No Google model led the website rankings I found | Its ID, and whether a stronger Gemini tier exists |
| OpenRouter | Kimi K3 (moonshotai/kimi-k3), plus any model above through OpenRouter's own provider/model IDs | Kimi K3 topped the website category in several arena snapshots; it is open-weight and inexpensive | The ID and current pricing on OpenRouter |

### Why not trust the leaderboards blindly

- They disagree. One roundup puts Muse Spark 1.3 first, another Kimi K3, another GPT-5.6 Sol, and a blind benchmark of twelve UI builds put Claude Opus 5 first.
- They mostly rank whole-page generation by human preference. Quil asks for three small structured patches that must obey constraints, which rewards reliable schema output and instruction-following as much as taste.
- They move every month, so every entry carries a verified date.

### Registry rules

- Each entry has: provider, apiId, label, recommended, a one-line why, a source link, and a verifiedOn date.
- The server function rejects any model ID that is not in the registry. OpenRouter also gets a custom model ID field, validated by pattern and length.
- The UI shows a Recommended chip with the why text, selects the first recommended model for the provider by default, and handles a retired model with a clear message and the default as the suggestion.
- A model earns the recommended flag only after Quil's own evaluation (Phase 6): schema-valid rate, hard-constraint pass rate, distinctness of the three candidates, p50 and p95 latency, cost, and a blind pick rate when a person is available. Thresholds live in docs/PERF.md, and the evaluation reruns monthly.

Sources: [Modelgrep design ranking](https://modelgrep.com/best/design), [Better Stack design comparison](https://betterstack.com/community/guides/ai/kimi-claude-astra-design/), [Startrise frontend benchmark](https://www.startrise.io/blog/llm-frontend-benchmark/), [Startrise model guide](https://www.startrise.io/blog/best-llm-for-frontend/), [LLM Stats UI ranking](https://llm-stats.com/best-ai-for-ui-design), [Design Arena website snapshot](https://benchmarklist.com/arenas/design_arena_website/), [GenDesigns UI test](https://gendesigns.ai/blog/best-llm-for-ui-ux-design).

### Account

Shows the signed-in provider, name and email as given by the provider, and a neutral Sign out button. Signing out ends the session, clears any in-memory key, and offers a second choice, Also clear local copies of my projects, off by default. Signing out redirects to the landing page.

## UI assumptions to confirm

Rows marked Confirmed come from your answers. The rest are calls I made where your brief left room; tell me which are wrong and I will revise the spec and the prompts.

| Topic | Decision or assumption | Status |
| --- | --- | --- |
| Text intensity | Colour strength of the text, 100% for headers and 5 points less per level; not font size | Confirmed |
| Theme | Dark only | Confirmed |
| Accent | Violet, kept bright enough that the dark button label stays readable; final value tuned by the contrast test in U0 | Hue confirmed |
| BYOK providers | Anthropic, OpenRouter, OpenAI and Google, with a recommended-models list from a registry | Confirmed; model IDs verified at build |
| Card shadow | A soft shadow with a 3 px vertical offset, on a surface lighter than the page | Assumed |
| Button shadow | A hard 3 px edge that collapses when pressed | Assumed |
| Button fills | Primary is the accent, neutral is a light monochrome fill, the label is the background colour, quiet actions are links | Assumed |
| Page navigation | Page tabs above the canvas; layers as a tab in the tools panel | Assumed |
| Screen size | Workspace is desktop only at 1100 px and up; landing and sign-in are responsive | Assumed |
| Sign-in buttons | Styled to your button rules. Google and Apple publish their own button rules; on a dark theme Apple's white style is the closest fit to yours | Open |
| Competitor names | Kept out of the public landing page until verified | Assumed |

## Phase prompts (0 to 8)

Each prompt assumes AGENTS.md is already in the repo, so the product context and the defensive standard are not repeated. Fill the \[brackets\], paste, and read the agent's plan before approving.

### Generic task template

Use this for any task between phases.

```text
TASK: [one sentence, one responsibility]
PHASE / MODULE: [for example Phase 2, Module D: decision resolver]
READ FIRST: AGENTS.md, [docs/DESIGN_MODEL.md], [files]. Cite what you read.
BEHAVIOR: [the observable behavior that must exist when you are done]
IN SCOPE: [files and directories you may change]
OUT OF SCOPE: [modules you must not touch]
INTERFACES TO PRESERVE: [types and functions]
FAILURE MODES THAT MUST BE HANDLED: [list them]
BUDGETS: [performance numbers if this touches the hot path]
ACCEPTANCE TESTS: [list, adversarial cases first]
Step 1: post your plan and stop. Step 2: after approval, write failing tests first, then implement. Step 3: report in the standard format.
```

### Phase 0: Audit and baseline (Module A, read-only)

```text
TASK: Audit the existing repository and establish a verified baseline. Change no product code.
READ FIRST: AGENTS.md, Quil_MVP_Build_Plan.md, package manifests, config, entry points, state management, canvas and render code, persistence, tests.
DO:
1. Run install, typecheck, lint, build and tests. Record exact commands and results. Separate environment failures from code failures.
2. Map the architecture from actual files, with file and line citations: state stores (count them; every independent store is a sync risk), render path, persistence, AI calls, every place design state is mutated.
3. List every place state is mutated outside a single command path.
4. Security scan: dangerouslySetInnerHTML, eval or new Function, string-built CSS or HTML, unvalidated JSON.parse, secrets in code or logs, unused or unpinned dependencies (npm audit).
5. Build the performance harness: a fixture project at 500 and 2,000 elements, and a Playwright script measuring input-to-paint for drag, inspector edit and undo using performance.mark and performance.measure. Record baseline numbers on this machine, plus a run at 4x CPU throttle.
6. Classify existing code as keep, refactor or replace, with evidence.
DO NOT: refactor, rename, add features, or replace a module because you prefer another architecture.
FAILURE MODES TO CHECK: commands that fail silently, tests that pass vacuously (find tests with no assertions), flaky tests (run the suite three times), lockfile drift.
DELIVERABLES: docs/AUDIT.md (findings with evidence), docs/PERF.md (budgets and baseline), docs/SECURITY.md (threat list from step 4), and a ranked list of blocking defects.
EXIT GATE: I can read AUDIT.md and know what works, what fails and what to keep. Baseline numbers exist.
Step 1: post your plan and stop.
```

### Phase 1: Core model, command bus, invariants (Module D)

```text
TASK: Implement the typed core model, the command bus and the invariant checker in core/, with no React and no I/O.
READ FIRST: AGENTS.md, docs/DESIGN_MODEL.md, the Module D section of Quil_MVP_Build_Plan.md, docs/AUDIT.md.
BUILD:
- Branded ID types (ElementId, PageId, DecisionId, AssetId, CommandId, CandidateId) with strict constructors.
- Zod schemas and inferred types: Project, Page, Section, DesignElement (a discriminated union per kind: heading, text, image, button, card, navigation, form), DesignDecision, DecisionScope, Asset. Each style property has its own value validator (color, length, enum, font from the allowlist, asset reference).
- Normalized storage: elements by id in a Map (or null-prototype object), children as arrays of ids, a rev counter per element and per project.
- DesignCommand union with a schema per command: set_property, add_element, remove_element, move_element, apply_candidate, undo, redo, batch (atomic group). Every command carries a CommandId; commands that depend on state carry a baseRev.
- applyCommand(state, command) returns Result of {state, patches, inversePatches, changedIds} or a CommandError. Pure. Never throws on bad input. Use Immer produceWithPatches or equivalent, so undo is an inverse patch, not a snapshot.
- Coalescing: consecutive set_property on the same element and property within one gesture merge into one history entry.
- validateProject(state): acyclic tree, no orphans, no dangling decision, asset or element references, unique ids, bounds (elements per page, depth, string length, finite clamped numbers), property sets match element kinds. Returns every violation with rule, target and message.
- In dev and test, validateProject runs after every command; a violation rolls the command back.
- Fixtures: the boutique-hotel Home project as typed data, plus malformed fixtures (cycle, dangling ref, __proto__ id, NaN size, 10 MB string, 50,000 elements).
DO NOT: build UI, persistence, the resolver or AI code.
FAILURE MODES: duplicate CommandId replay, command on a deleted element, move that creates a cycle, remove that orphans decisions (policy: mark orphaned, never silently delete), undo on empty history, redo after a new command (redo stack cleared), a batch that fails at step 3 of 5 (all or nothing), prototype-pollution keys, extreme numbers, unknown keys, commands arriving out of order.
TESTS (negative-first): unit tests for each failure mode; fast-check properties: (a) any random command sequence leaves validateProject clean or is rejected with state unchanged, (b) apply then inverse patches returns a deep-equal state, (c) replaying a CommandId is a no-op, (d) undo then redo round-trips.
BUDGET: one set_property on the 2,000-element fixture, p95 under 2 ms in Node. Measure and report.
EXIT GATE: the sample project validates; 10,000 fuzzed command sequences produce no invariant violation.
Step 1: post your plan and stop.
```

### Phase 2: Decision engine (Module D)

```text
TASK: Implement the deterministic decision registry and the incremental resolver in core/decisions/.
READ FIRST: AGENTS.md, docs/DESIGN_MODEL.md, the Phase 1 code, the scope semantics and precedence sections of the build plan.
BUILD:
- Registry: create, approve, supersede (superseded decisions stay in history and become inactive), lookup by target and scope.
- Applicability: a decision matches elements by an explicit rule: target type (for example button), component definition id, or semantic role. Never by fuzzy similarity. Matching is a pure function.
- Scope: instance (one element), page (matching targets on that page), global (matching targets across the project, including future pages). Keep three concepts distinct and never call them all 'global': instance override, shared component definition change, global design rule.
- Precedence: preview overlay (never persisted) > instance > page > global > component default. Same-scope conflicts use a total order of (approvedSeq descending, id ascending) from a monotonic sequence, never Date or insertion order.
- resolve(state, decisions, elementId) returns resolved props with provenance (which decision supplied each property). Pure, and memoized per element on (element rev, applicable decision versions).
- Dependency index: decision to element ids, maintained incrementally on add, remove, move and decision change. changedIds from a command become dirtyIds for the resolver. No full-document recompute per command.
- Orphan policy for instance decisions whose element was deleted. Conflict reporting when a page spec changes after approval (report, never delete).
- Integrate with commands: set_property with a scope creates or updates a decision through applyCommand. Re-applying the same decision never duplicates a record.
DO NOT: build UI, persistence or AI.
FAILURE MODES: a decision whose target type matches zero elements, two decisions with the same scope and target, instance override followed by a global change, page decision on a deleted page, deep supersede chains, resolver called with an unknown id, 10,000 decisions, contradictory rules, a stale memo after undo.
TESTS: property tests: resolve is deterministic for any evaluation order; applying a decision twice equals once; a global change updates all and only matching elements; an instance override survives a global change; a page decision never leaks to another page; undo restores both properties and the registry. Oracle test: incremental resolve equals full resolve across 10,000 random edits.
BUDGET: a global change touching 200 elements on the 2,000-element fixture resolves in under 10 ms in Node (report numbers). An instance edit re-resolves exactly one element.
EXIT GATE: the scope, precedence and inheritance tests from the build plan pass and the oracle test finds no divergence.
Step 1: post your plan and stop.
```

### Phase 3: Canvas, tools and scope picker (Modules F, A)

```text
TASK: Build the structured canvas, selection, inspector, scope picker and the 20/80 tool set on top of the command bus. No AI in this phase.
READ FIRST: AGENTS.md, docs/PERF.md, the Phase 1 and 2 code, Module F of the build plan, the 20/80 tool list.
BUILD:
- Renderer: DOM and CSS from resolved props. Per-element subscription, so an element re-renders only when its resolved props change. Style-only changes apply by direct style or CSS-variable update where profiling shows reconciliation is the cost.
- Layers: committed content, a selection and handles overlay (separate, never re-renders content), and an ephemeral gesture layer.
- Gestures: pointer events with setPointerCapture. During a drag, resize or scrub write only to the gesture layer inside requestAnimationFrame. On release dispatch ONE coalesced command. Escape cancels with no state change. pointercancel, lost capture, window blur and focus loss mid-gesture all abort cleanly.
- Tools: select, multi-select, move, resize (proportional with Shift), snapping and guides, auto-layout controls, fill (solid, one gradient, image), border, radius, shadow presets, plain-text editing, align and distribute, layers panel, duplicate, delete, copy and paste (re-ID on paste), zoom, pan, fit, undo, redo, shortcuts.
- Inspector: shows only properties the renderer can represent. Every control builds a typed command, and the value passes the per-property validator before dispatch. Invalid input shows an inline error and changes nothing.
- Scope picker on edits that can apply beyond the instance: plain-language effect text and a live count of affected elements. Hide choices that are meaningless for the property.
- Drift badge: a hand edit that deviates from an approved decision is signalled and offers 'keep as instance override' or 'propose changing the decision'. Nothing changes a decision without approval.
- Contrast badge computed in code (WCAG math via culori), never asserted by a model.
DO NOT: add vector tools, breakpoints, rotation, multiple fills, plugins or AI. Do not let any component write document state outside the command bus.
FAILURE MODES: the selected element deleted by undo, selecting a locked or hidden element, pasting 5,000 elements, pasting foreign clipboard HTML (validate or reject; never inject it), text containing markup or RTL override characters (render as text nodes only), zero or negative size, dragging outside the viewport, undo spam during a gesture, window resize mid-drag, IME composition during text edit, two pointers at once (touch and mouse), stale selection after a page switch.
PERFORMANCE: drag and resize at 60 fps on the 500-element fixture with under 10 ms of main-thread work per frame; a committed inspector edit visible in the same frame; undo under 32 ms. A Playwright perf test fails CI when a budget regresses.
TESTS: component tests for every tool; a render-consistency test (DOM equals the resolved model across random edits); a gesture suite (cancel, blur, pointercancel); a no-lag test that dispatches 1,000 set_property commands and asserts per-command p95.
EXIT GATE: a page can be fully edited, undone and redone without AI; the model and the DOM never disagree; budgets are green.
Step 1: post your plan and stop.
```

### Phase 4: Persistence (Module G)

```text
TASK: Implement atomic local persistence with an op log, snapshots, migrations and multi-tab safety behind a repository interface.
READ FIRST: AGENTS.md, Module G of the build plan, the Phase 1 command and patch types.
BUILD:
- ProjectRepository interface (load, appendOps, writeSnapshot, listProjects, delete) with an IndexedDB implementation (Dexie).
- Write-behind: subscribe to committed commands and batch them into the op log. Flush within 300 ms of the last command and on visibilitychange and pagehide. Never on the interaction path; never block render.
- Snapshot every N ops and on idle, written atomically (new snapshot, then pointer swap, in one transaction). Load is the latest valid snapshot plus a replay of later ops. Verify checksums and fall back to the previous snapshot on corruption.
- Persist the complete state: brief, page specs, elements, decisions (including superseded), asset references, history metadata, schema version.
- Migrations: versioned, pure, tested on frozen fixtures from every prior version. Back up the pre-migration snapshot. A failed migration opens a recovery screen with the original intact and an export option. Reject future schema versions explicitly.
- Multi-tab: Web Locks elect one writer per project. Other tabs open read-only with a banner and follow via BroadcastChannel. Handle lock loss.
- Truthful save status: saved, saving, unsaved, error. 'Saved' only after the transaction commits.
- Failure handling: QuotaExceededError (warn, keep edits in memory, offer export), aborted transaction, database blocked by another version, private mode without IndexedDB, tab killed mid-write.
- Server sync, only if you decide it belongs in this phase: a Supabase client pushing op batches with idempotency keys (client id plus sequence), the server assigning the global order, RLS on every table, and an Edge Function re-validating commands with the shared core package. All behind the same repository interface.
DO NOT: call persistence from components, or serialize the whole project per edit.
FAILURE MODES: kill the transaction at each step, truncated or tampered snapshot, schema N-1 and N-2, two tabs editing, quota failure, offline then online replay (must be idempotent), op log longer than the snapshot window, clock skew (never order by Date).
TESTS: fake-indexeddb with fault injection at every write step; corrupt-snapshot fallback; migration fixtures; two-tab test; refresh after an approval restores decisions and overrides so the resolved state is deep-equal; if sync exists, a two-user RLS test and an idempotent-replay test.
BUDGET: cold load of the 2,000-element fixture under 1 s to interactive; a flush never produces a long task (observer test).
EXIT GATE: refresh and reopen yield a deep-equal project and resolved state; no injected failure corrupts or silently loses data.
Step 1: post your plan and stop.
```

### Phase 5: Intake and page specification (Modules B, C)

```text
TASK: Build intake, page suggestions and page-spec generation and editing behind a provider interface, with deterministic fixtures.
READ FIRST: AGENTS.md, Modules B and C of the build plan, the provider strategy section, docs/SECURITY.md.
BUILD:
- AIProvider interface with separate operations and separate schemas: generateFollowUpQuestions, suggestPages, generatePageSpec. No mega-prompt. A mock provider returns fixtures. One real adapter sits behind the interface and uses BYOK.
- A strict schema for every provider response. Reject and surface errors. Never partially apply a response.
- Intake UI: brief form, adaptive and skippable questions, page list (add, remove, rename, select), starting-page choice. All changes go through commands and are saved in the project.
- Page-spec editor with validation, versioning on material change, and a trace from each spec element to its element in the tree.
- Spec-versus-decision conflict detection. Regenerating a spec never deletes decisions; conflicts are listed for the user.
- Request layer: AbortController deadline, retry with jittered backoff on 429 and 5xx only, circuit breaker, cancel on navigation, size caps on inputs and outputs, a per-user rate limit at the Edge Function (Redis or a Postgres counter).
- Prompt hygiene: the brief and any imported text go in delimited data fields and are treated as data. System instructions live apart. The response schema is the only channel that reaches state.
- Key handling: the BYOK key is held in memory or session only, or encrypted at rest on the server. Redacted in logs. Never in the context builder. Never in analytics.
DO NOT: generate visual design here, or render pages from the spec beyond the mapped skeleton elements.
FAILURE MODES: an empty brief, a 50 KB brief, a brief that instructs the model to ignore its rules, the provider returning fewer pages, duplicate page names, prose instead of JSON, a truncated stream, extra keys, a 429 storm, the user abandoning mid-flow and returning, editing the spec while a regeneration is in flight (stale base), output that is schema-valid but semantically empty.
TESTS: a malformed-response suite (at least 20 mutations of a valid response, all rejected, state untouched); injection fixtures; cancel and timeout tests; the spec-to-element trace test; a secrets-never-logged test with a seeded fake key.
EXIT GATE: a user can go from a brief to a valid, edited Home spec and a skeleton page, and every failure mode above shows a recoverable message.
Step 1: post your plan and stop.
```

### Phase 6: Targeted generation (Module E)

```text
TASK: Implement the generate, preview, approve, reject and regenerate loop for one or two targets (hero background and button treatment), with instant preview and exact scope control.
READ FIRST: AGENTS.md, Module E of the build plan, the Phase 2 resolver (overlay layer), the Phase 3 renderer, docs/PERF.md.
BUILD:
- Context builder: a pure function returning a minimal, inspectable GenerationContext (brief, page spec, target and its current state, neighbors, applicable approved decisions, the allowed patch surface). Snapshot-test it. No full history. No secrets.
- Target schemas: for each target type, the exact properties a candidate may patch (an allowlist). A hero candidate cannot touch button typography by construction.
- Candidate schema and validator: strict parse, allowlist check, per-property value validation, finite numbers, asset exists, hard constraints evaluated in code (for example contrast ratio via culori). Mark each constraint check as automated or model-asserted. Dedupe near-identical candidates. Fewer than three is allowed and shown honestly.
- Streaming: render each candidate as soon as it validates. The UI stays interactive while generating. Cancel is instant.
- Preview overlay: applying a candidate to the canvas writes only to the overlay layer (highest precedence, not persisted, not in undo). Switching candidates updates with no network. Rejecting drops the overlay.
- Stale-base protocol: each request records the target's rev and the decision registry version. If the user edits the target while generating, mark the results stale and visible. Offer a rebase when the edit touched disjoint properties; otherwise require regenerate. Never apply onto a changed base silently.
- Approve is one apply_candidate command, idempotent by CandidateId. It re-validates at apply time, patches only the allowed surface, records the decision with the scope the user picked, and persists through the normal path.
- Regenerate keeps unrelated approved choices. If no candidate satisfies the hard constraints, explain why. Never weaken constraints silently.
- Model evaluation harness: a script that runs the two targets across the registry models on a fixed fixture (at least 20 prompts per target) and reports schema-valid rate, hard-constraint pass rate, distinctness of the three candidates, p50 and p95 latency, cost and, when a person is available, a blind pick rate. Only models that clear the thresholds in docs/PERF.md may carry the recommended flag in src/config/models.json.
DO NOT: let the provider write to state, add targets beyond the two, or add any code path that applies a patch without apply_candidate.
FAILURE MODES: double-click approve, approve after the target was deleted, approve after another approval changed the base, a candidate patching a forbidden property, a candidate with NaN, huge or negative values, a candidate referencing a missing asset, injected text in the explanation (render as text), a stream cut mid-candidate, the user switching pages mid-generation, all candidates identical, a provider refusal, two generations racing on one target (cancel the older).
PERFORMANCE: candidate preview swap under 50 ms p95; no long task over 50 ms during a streamed response; approval to painted canvas in the same frame as any other command.
TESTS: a forbidden-surface fuzz (random candidate mutations, none escape the allowlist); the hero-cannot-change-buttons test; a stale-base matrix; an idempotent-approve test; a reject-leaves-no-trace test; a reopen-restores-approval test; a constraint-failure messaging test.
EXIT GATE: approving a candidate updates the artifact and the canvas together without mutating unrelated state, previews feel instant, and every race above has a test.
Step 1: post your plan and stop.
```

### Phase 7: Cross-page inheritance (Modules D, E, A)

```text
TASK: Generate the Rooms page from its own spec, resolve applicable decisions into it, and prove the inheritance semantics.
READ FIRST: AGENTS.md, the Phase 2 decision code, the acceptance test in the build plan, Module A navigation.
BUILD:
- A create-page command that instantiates elements from a page spec and resolves global decisions by rule applicability. It never copies Home's layout or content.
- Reusable components and assets: a shared component definition with instances. The scope picker surfaces the three-way distinction: instance override, component definition change, global rule.
- Page navigation with unsaved-change safety and empty, loading and error states.
- Global change propagation: changing the global button treatment updates every applicable button on every page incrementally. Instance overrides and page-specific decisions survive.
DO NOT: copy elements between pages to fake inheritance.
FAILURE MODES: a page created before any global decision exists, a global decision approved after pages exist, a page deleted that held page-scope decisions, a Rooms spec requiring an element kind with no decision, navigation during a pending save, creating the same page twice (must be idempotent), 200 pages, renaming a page, undoing page creation (the decision registry must be restored too).
TESTS: the full hotel acceptance flow as a headless domain test AND as a Playwright test; assertions that Rooms inherited rules rather than copied Home content; page-specific isolation; a global-change fuzz with the oracle (full recompute equals incremental).
PERFORMANCE: a global change across 200 elements and several pages paints within the Phase 2 budget.
EXIT GATE: Rooms inherits applicable shared decisions without copying unrelated layout, and changing a global rule updates only applicable elements.
Step 1: post your plan and stop.
```

### Phase 8: Hardening and measurement (Modules H, A)

```text
TASK: Harden the whole system, run the acceptance test repeatedly, and measure performance and user outcomes. Add no features.
READ FIRST: everything in docs/, the minimum test matrix, the acceptance test in the build plan.
DO:
- Run the hotel acceptance test from a fresh project 20 times. Report the flake rate.
- Chaos suite: inject faults at every boundary (storage abort, provider timeout, garbage output or slow stream, worker crash, clock skew, tab killed mid-write, offline). Assert no corrupted state, a truthful save status and a recoverable UI.
- Fuzz the command bus and the candidate validator for a fixed budget. Zero invariant violations allowed.
- Security pass: CSP with no inline script, an XSS corpus through every text, URL and CSS input, upload validation, dependency audit, RLS cross-user tests, rate-limit tests, a secret scan of the repo and the production bundle, and a check that logs and network traces contain no seeded fake key.
- Performance pass on the 500 and 2,000-element fixtures, plus a 4x CPU-throttled run. Record p50 and p95 against docs/PERF.md. Add every budget to CI.
- Accessibility smoke test: keyboard-only completion of the core flow, labels on every inspector control, focus management after approve and undo.
- Instrument the success metrics: time to an accepted design, repeated corrections, unintended-change count.
- Remove features that do not support the core demonstration.
DELIVERABLE: docs/HARDENING.md with results, remaining risks and a go or no-go list.
EXIT GATE: the full workflow works repeatedly from a fresh project with no developer intervention.
Step 1: post your plan and stop.
```

## UI build prompts (U0 to U4)

The UI runs as a second track beside Phases 0 to 8. Each prompt assumes AGENTS.md is in the repo and the UI contract below has been appended to it.

| Prompt | Runs with | Needs first |
| --- | --- | --- |
| U0 Design system | Before Phase 3 | Phase 0 |
| U1 Shell, auth, settings | After U0, alongside Phase 3 or 4 | U0 and a Supabase project |
| U2 Intake UI | With Phase 5 | U0, U1, the Phase 5 provider interface |
| U3 Workspace layout and variants tray | Chrome with Phase 3, tray with Phase 6 | U0, Phase 2 and 3 code |
| U4 Landing page | After Phase 7 | U0, and a working renderer and decision engine for the live demo |

### UI contract (append to AGENTS.md)

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

### U0: Design system and primitives

```text
TASK: Implement the Quil design system: tokens, fonts and the primitive components, with a dev-only kitchen-sink route.
READ FIRST: AGENTS.md including the UI contract, the UI foundations section of this pack.
BUILD:
- src/ui/tokens.css exactly as specified, plus the font setup (Fontsource, preloaded weights only, metric-matched fallbacks).
- Primitives: Button (primary and neutral), IconButton, Card, SelectableCard (radio and checkbox variants), Input, Textarea, Segmented control (for the scope picker), Chip, Badge, Tabs (page tabs), Tooltip, Popover, Dialog, StatusMessage (icon plus text, aria-live). Use headless accessible primitives (for example Radix) for Dialog, Popover, Tooltip and Tabs rather than hand-rolling focus management.
- A /dev/ui route, available only in development, showing every primitive in every state.
- Lint rules: no raw colours, font sizes or shadows in components.
DO NOT: build any page, call any API, or add a second accent colour.
FAILURE MODES: font files failing to load (fallback with no layout shift), forced-colors mode, 200 percent browser zoom, very long labels (truncate with accessible full text), a screen reader on every primitive, keyboard-only use, reduced motion, an accent that fails contrast.
TESTS: the culori contrast suite (text levels, button labels against fills, accent against bg); a Playwright test that presses a button with the mouse and keyboard and asserts the transform and shadow change; focus-ring visibility; reduced-motion assertions; screenshot tests of the kitchen sink; axe checks on it.
EXIT GATE: all contrast checks pass with the final accent value reported; every primitive is operable by keyboard; no component contains a raw colour, font size or shadow.
Step 1: post your plan and stop.
```

### U1: Shell, auth and settings

```text
TASK: Build the routing shell, Google and Apple sign-in, the Projects page, and the Settings page with BYOK setup and sign-out.
READ FIRST: AGENTS.md, docs/SECURITY.md, the Pages and routes and the Auth and settings sections of this pack, the U0 primitives.
BUILD:
- Router with the routes in the table, route guards, validated next parameter (same-origin allowlisted paths only), and designed empty, loading, error and not-found states.
- Supabase Auth with Google and Apple only, PKCE, state check, /auth/callback. No email and password and no account confirmation.
- Sign-in page with the specified states. Projects page: list and New project.
- Settings page: API key section (provider cards for Anthropic, OpenRouter, OpenAI and Google, a model list with the recommended models marked from src/config/models.json, masked field with Show toggle, storage choice, Test and save, status block, Remove key, spend guard) then Account section (provider, name, email, Sign out with the optional clear-local-copies choice).
- Edge Function for the key test, with one adapter per provider (Anthropic, OpenRouter, OpenAI, Google): validates input, rejects model IDs that are not in the registry, calls the provider with a minimal request, never echoes or logs the key, rate limited.
- Workspace key-status chip component linking to /settings#api-key.
- src/config/models.json as described in Providers and recommended models: provider, apiId, label, recommended, why, source, verifiedOn. The UI reads only from it.
DO NOT: store the key in React state, a global store, localStorage, logs or analytics.
FAILURE MODES: user cancels at the provider, state mismatch, replayed callback, provider outage, open-redirect attempt in next, session expiry mid-edit (keep local work and show a re-sign-in dialog), sign-out in one tab while another is open, Apple first-login name capture, same person on both providers, invalid key, unknown or retired model ID, rate-limited key test, network failure during test, save failure, pasted key with whitespace or newline, a 10 KB paste, browser autofill on the key field.
TESTS: Playwright flows for each state with a fake provider; a redirect-validation test with hostile next values; a seeded fake key that must never appear in logs, storage dumps, network traces other than the provider request, or error reports; a cross-user RLS test on projects; axe checks on every page.
EXIT GATE: a new user signs in, lands in the intake; a returning user lands on Projects; the key page works end to end with a fake provider; signing out clears the session and the in-memory key.
Step 1: post your plan and stop.
```

### U2: Intake UI

```text
TASK: Build the intake wizard UI on top of the Phase 5 intake and provider code.
READ FIRST: AGENTS.md, the Intake flow section of this pack, the U0 primitives, the Phase 5 provider interface and schemas.
BUILD:
- Routes /new/:step with a centred 640px column, step label, H1 question, helper line, a 3px accent progress bar, Back (neutral button), Continue (primary button), and Skip for now (link) on skippable steps.
- Single-pick screens using SelectableCard in radio mode (round indicator, one tab stop, arrow keys) and multi-pick screens using checkbox mode (square check, Space toggles, live count, optional maximum, Other with inline text, exclusive None of these).
- The seven default steps, including page selection with inline rename and Add a page, a starting-page single-pick, and a Review screen with Edit links.
- Adaptive options from the provider with a static fallback set. Option labels from the provider are untrusted: plain text, capped length and count, de-duplicated.
- Autosave each answer through commands; resume on refresh and on browser back and forward.
- Create project: show real progress events from the Phase 5 operations, handle failure at each step with a retry that keeps all answers.
DO NOT: ask for fonts or colours, exceed seven screens, or call the provider from components (go through the provider interface).
FAILURE MODES: refresh mid-flow, browser back and forward, provider returns malformed or oversized options, an option label of 300 characters or with markup, a duplicate option, rapid double Continue, None of these combined with others, maximum picks reached, empty required answer, empty page list, duplicate page names, offline during Create, provider timeout, a user who navigates away mid-create.
TESTS: Playwright keyboard-only run of the whole flow; screen-reader role assertions for radio and checkbox groups; malformed-option fuzz; resume tests; a double-submit test; axe checks on every step; visual tests that single-pick and multi-pick differ by shape as well as colour.
EXIT GATE: a user completes intake with keyboard only and lands in the workspace with a valid Home spec; every failure mode shows a recoverable message and loses no answer.
Step 1: post your plan and stop.
```

### U3: Workspace layout and variants tray

```text
TASK: Build the workspace layout, the tools panel and the variants tray around the existing canvas and command bus.
READ FIRST: AGENTS.md, docs/PERF.md, the Workspace section of this pack, the Phase 3 canvas code, and (for the tray) the Phase 6 generation code.
BUILD:
- A 2fr and 1fr grid at full viewport height with independently scrolling panels, a 320px minimum tools width, a top bar (logo, editable name, save status, undo and redo, Spec link, Settings link), and page tabs above the canvas.
- Tools panel: selection header, inspector, scope picker, applicable decisions with drift badge, layers tab, and the prompt box pinned to the bottom (target chip, optional instruction, Generate 3 variants, key-status line).
- Variants tray at the bottom of the canvas: three cards with live miniatures of the target subtree with the candidate applied, rationale, constraint chips labelled automated or model-stated; tap to preview through the overlay layer; Approve (opens the scope picker with affected count), Reject, Regenerate; skeleton cards that fill as candidates validate; stale banner; empty and error states.
- A radio-group tray with arrow keys, keys 1 to 3, an aria-live announcement, and Escape to leave the preview.
DO NOT: let panel state re-render canvas content, create a second preview path outside the overlay layer, or apply a candidate except through apply_candidate.
FAILURE MODES: window resize, tools content taller than the viewport, no key set, provider error mid-stream, target deleted or edited while previewing, selection cleared while previewing, one or zero valid candidates, rapid card switching, Approve during an in-flight generation, miniature render of a very large subtree, tray open while changing pages.
PERFORMANCE: tapping a card swaps the preview in under 50 ms p95 with no network; opening or closing panels causes no canvas re-render; the main thread has no long task over 50 ms during streamed generation.
TESTS: a render-count test proving canvas elements do not re-render when panel state changes; Playwright preview, approve, reject and stale flows; keyboard-only tray test; axe checks; the Phase 6 race matrix driven through the real UI.
EXIT GATE: the whole generate, preview, approve loop is usable by mouse and keyboard with the budgets green.
Step 1: post your plan and stop.
```

### U4: Landing page

```text
TASK: Build the landing page that tells the story in the Landing story and positioning section, including a live demo on the real product code.
READ FIRST: AGENTS.md, the Landing story and positioning section (story table, copy and claim rules), the U0 primitives, the Phase 2 and 3 code.
BUILD:
- The eight sections in the story table with the chosen headline, using Archivo and Inter and the token rules. Responsive from 360px up.
- The proof section as an interactive demo: import the real renderer and decision engine, load a fixture project (a few buttons, one with an instance override), let the visitor change one global button rule and watch only the applicable buttons update. No network, no auth, no AI.
- The strategy canvas drawn from data, without competitor names.
- Sign-in buttons in the closing section that go to /signin.
- SEO basics (title, description, headings in order, social image), a performance budget (set it from the Phase 0 harness), no tracking by default.
DO NOT: use stock imagery, quote speed multipliers, name competitors, or ship a recorded animation in place of the live demo.
FAILURE MODES: JavaScript disabled (the story must still read in order), a slow network (no layout shift, demo loads lazily), reduced motion, a demo crash (isolate it with an error boundary and show a static fallback image), a CSP that blocks inline script, 360px and 4K widths, very long translated headline.
TESTS: Lighthouse budget in CI; axe checks; a Playwright test that changes the global rule in the demo and asserts only applicable buttons changed; a no-JavaScript render test; reduced-motion test.
EXIT GATE: the page reads as a complete story with JavaScript off, the demo proves the decision behaviour, and performance and accessibility budgets are green.
Step 1: post your plan and stop.
```

## Architect, test-engineer, reviewer and red-team prompts

Run each in its own fresh session. The point is separation: the agent that wrote the code never grades it.

### Architect

```text
ROLE: Architect. You do not write product code.
TASK: Produce an implementation plan for [task] in [phase / module].
READ FIRST: AGENTS.md, [docs], and the code that owns this behavior. Verify every claim by reading code or running a command, and cite file and line.
OUTPUT:
1. Your understanding of the requirement and what is out of scope.
2. Existing implementation involved.
3. Proposed interfaces (types and signatures) and data flow.
4. Files to change, and why each.
5. Failure-mode table: failure, defense, test.
6. Performance impact: does anything touch the hot path? Which budget?
7. Alternatives you rejected, with the reason.
8. Risks and open questions.
FLAG, as blocking, any step that adds a second source of truth, bypasses the command bus, lets a candidate or command exceed its scope, or puts storage, network or whole-state serialization on the interaction path.
```

### Test engineer

```text
ROLE: Test engineer. You have NOT seen the implementation and must not read it before writing tests. Work only from the spec, the acceptance criteria and the public interfaces.
TASK: Write tests for [task].
RULES:
- Negative-first. For every acceptance criterion write at least three adversarial cases: malformed input, stale or duplicated or late input, partial failure, abuse.
- Add property-based tests (fast-check) for every invariant: determinism, idempotent re-apply, undo then redo round trip, incremental equals full recompute.
- No vacuous tests: every test asserts something, and none mocks the thing it claims to test.
- Then run the suite against the implementation. For each failure say whether it is a bug or an ambiguity in the spec.
- Never edit product code. Never weaken a test to make it pass.
- If Stryker is configured, report the mutation score for the files under test.
REPORT: tests added, commands run with real results, failures classified, spec ambiguities found.
```

### Reviewer

```text
ROLE: Hostile code reviewer. You did not write this code.
TASK: Review the diff ([git diff main...HEAD]) and run typecheck, lint and the relevant tests yourself.
Answer each question with file and line evidence, or 'not applicable':
1. Does it create a second source of truth?
2. Does anything bypass the command bus?
3. Does it add hot-path work (allocation per frame, full re-resolve, synchronous storage, serializing whole state)?
4. Is any input unvalidated at a boundary?
5. Can an edit or candidate escape its scope or allowlist?
6. Is there a stale-base race or an unhandled concurrent edit?
7. Is replay idempotent?
8. Can a partial failure leave corrupted state or a false 'saved'?
9. Can a secret reach a log, context, URL or analytics event?
10. Is there an injection path (XSS, CSS, URL, prompt)?
11. Are loops, sizes and retries all bounded?
12. Is any error swallowed?
13. Are the tests vacuous (no assertions, everything mocked, snapshots of garbage)?
14. Were unrelated files changed?
15. Are docs updated where a contract changed?
OUTPUT: blocking issues, non-blocking issues, missing tests, verdict. 'Looks good' is not a review.
```

### Red team (run at every phase gate)

```text
ROLE: Red team. Your goal is to break Quil's invariants or its responsiveness. Budget: [N steps or hours].
RULES: do not fix product code. Report only issues you can reproduce. For each finding give reproduction steps, impact, a minimal failing test added under tests/adversarial/, and a suggested fix.
ATTACK LIST:
1. Craft candidate JSON that patches outside its allowlist.
2. Import a project with __proto__ keys, cycles and 10 MB strings.
3. Run an XSS and CSS-injection corpus through names, text, URLs, SVG uploads and style values.
4. Races: approve during an edit, double approve, undo mid-approve, two tabs on one project.
5. Kill storage mid-write; fill the quota.
6. Make the provider return garbage, stall mid-stream, and return 429 repeatedly.
7. Paste foreign clipboard HTML into the canvas.
8. Put instructions to the model inside the brief and inside imported content, aiming to alter decisions or leak the key.
9. Cross-user access through RLS, IDOR and direct API calls.
10. Exhaust it: 100,000 elements, 10,000 decisions, 1,000 commands per second.
11. Hunt for key leakage in logs, network traces, error reports and the bundle.
12. Find any input that blows the frame budget.
```

## Phase gates and red flags

Do not start the next phase until every box in the current row is ticked with evidence (command output, not the agent's say-so).

| Phase | Must be true before moving on |
| --- | --- |
| 0 | AUDIT.md, PERF.md and SECURITY.md exist; baseline numbers recorded; suite run three times with flake rate noted |
| 1 | 10,000 fuzzed command sequences, zero invariant violations; undo and redo round-trip property holds; core/ imports nothing from React, DOM or network |
| 2 | Scope, precedence and inheritance tests pass; the oracle test (incremental equals full) shows no divergence; global change on 200 elements within budget |
| 3 | Full edit, undo and redo without AI; render-consistency test green; gesture cancel, blur and pointercancel tests green; perf budgets enforced in CI |
| 4 | Fault injection at every write step loses or corrupts nothing; refresh yields deep-equal resolved state; second tab opens read-only |
| 5 | Twenty or more malformed-response mutations rejected with state untouched; seeded fake key never appears in logs or traces; every failure shows a recoverable message |
| 6 | Forbidden-surface fuzz finds no escape; stale-base matrix green; double approve is a no-op; preview swap and approval within budget |
| 7 | Full hotel acceptance test passes headless and in Playwright; Rooms contains no copied Home content; global change updates only applicable elements |
| 8 | Acceptance test stable across 20 fresh runs; chaos, fuzz, security and performance passes recorded in HARDENING.md |

### Always-on CI gates

Typecheck, lint with the boundary rules, unit and property tests, end-to-end tests, performance budgets, dependency audit, secret scan, and a check that no TODO marks a missing failure path.

### Red flags in agent output: stop and push back

- It reports success without pasting command output, or says 'tests should pass'.
- It touched files outside the task's scope, or edited a test, lint rule or validator to make a check pass.
- It added a dependency or a second store without asking.
- Any component now writes document state directly, or a handler calls persistence.
- It stored a resolved value as its own copy of the state.
- It handled only the success path: no timeouts, no cancellation, no error branch in the UI.
- A test passes with the implementation deleted, or mocks the unit it claims to cover.
- Its report lists no failure modes, no assumptions and no open risks. Real work always has some.
