# Quil: Intake, Flow and Page-Spec Overhaul

**Implementation brief for the executing engineer.** Follow it literally. Where this brief gives an interface, schema, constant or algorithm, use it exactly. Where it is silent or contradicts the code, stop and ask (see 0.2).

---

## 0. Rules of engagement

### 0.1 How you work
1. You are **executing**, not designing. Do not invent features, rename things, or refactor outside the phase you are in.
2. Work in **phases, in order** (Section 9). One phase = one branch = one reviewable change set. Do not start phase N+1 until phase N passes its gate and the owner says go.
3. For every phase follow this loop (from `AGENTS.md`):
   1. **Read** the files listed for the phase (cite file and symbol names you read).
   2. **Post a plan**: understanding, files to change, interfaces touched, failure modes, tests, budgets affected.
   3. **Stop for approval** (Phase 2 and any deviation from this brief always stop; other phases proceed once the owner has said "proceed" for this brief).
   4. **Write failing tests first**: adversarial and negative cases before happy path.
   5. Implement the **smallest change** that makes them pass.
   6. **Hostile self-review**: list five ways your change breaks (malformed input, stale state, partial failure, race, abuse). Add a test for each.
   7. Run `npm run typecheck`, `npm run lint`, `npx vitest run --no-file-parallelism`, and `npx tsx scripts/bench2.ts` if you touched the hot path.
   8. Report in the format in Section 14.
4. **Never claim a check passed unless you ran it and saw it pass.** Paste real counts. If you could not run something, say so.

### 0.2 When to stop and ask
Stop and ask the owner (do not guess) when:
- the code does not match what this brief says it is;
- a decision in Section 6 is marked **ASK** and has not been answered;
- you need a new dependency, a new shared type, a schema change not listed here, or you must weaken a test, lint rule or validator;
- something stores or sends secrets or user content to a new place;
- two instructions conflict.

Ask in your plan under a heading `Questions`. Each question must offer your recommended answer so the owner can reply "yes".

### 0.3 Hard bans (CI or review will reject these)
- `any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`, non-null `!` on untrusted data, `as never` / `as unknown as X` to silence an error you do not understand.
- `dangerouslySetInnerHTML`, `eval`, `new Function`, building CSS or HTML from strings.
- `Date.now()`, `Math.random()`, `crypto.*` inside `src/core/` or inside anything run by the reducer. Inject a clock and id generator at the app edge.
- Empty `catch {}`, swallowed errors, thrown strings, ignoring the result of `store.dispatch(...)`.
- Raw hex colours, raw font sizes or raw shadows inside `src/app/**` and `src/ui/**` (tokens only). Exception: user-design colours in `core/skeleton-theme.ts` (Section 9, Phase 5).
- New npm dependencies.
- Editing, skipping or deleting an existing test to make it pass. If a test encodes behaviour this brief changes, update it and explain why in the report.
- `console.log` of anything derived from user text or keys.
- TODO or FIXME comments that hide a missing failure path.

### 0.4 Coding style that makes this production code
- **Parse, don't validate.** Every boundary (provider output, user input, persisted data, command payloads) goes through a strict Zod schema (`.strict()`, unknown keys rejected). Downstream code only sees parsed, branded types.
- **Result types at module boundaries**: `{ ok: true; value } | { ok: false; error: { code; rule; target; message } }`. No throwing across a module boundary.
- **Exhaustive `switch` with a `never` check** for every union.
- **Bound everything**: list lengths, string lengths, retries, history. Clamp numbers. Reject `NaN` and `Infinity`.
- **Every `await` that crosses a boundary** (AI, network, storage) has a timeout and an `AbortController`.
- **Idempotent**: applying the same command twice gives the same state.
- **Pure core**: `src/core/` imports no React, DOM, network, or provider code.
- Small functions, named constants (no magic numbers), one responsibility per file, descriptive names, comments explain *why* not *what*.

---

## 1. Product context (read in two minutes)

Quil is a guided design workspace for websites. The user makes design decisions progressively; each approved decision is stored as a scoped constraint (instance, page, global) and applied deterministically. AI output is **untrusted input**: the model proposes, the application validates and applies.

The user journey this brief delivers:

1. User saves a **project name**.
2. The **workspace opens immediately**. A **project-level intake** conversation runs inside the workspace's right panel. It asks whatever it needs to understand the whole product (dynamic questions, not a fixed list).
3. User **picks the starting page**. A **page-level intake** starts in the same panel and asks about that page (purpose first).
4. Quil generates a **page spec** (what the page must contain and why, with a creative structure). The user can **edit it** (outline editor, natural-language edits, per-section regenerate) and **approve** it.
5. Approving instantiates a greyscale **skeleton** on the canvas. Design then continues layer by layer (later work; this brief only fixes the variant wiring and writes the layer design doc).

Intake must feel like **part of the workspace**, never a separate page or wizard.

---

## 2. Architecture invariants (do not break)

1. Structured state is the source of truth (`project > pages > sections > elements`, plus decisions, assets). Canvas is a view.
2. **Every document change is a typed Command through ONE command bus** (`QuilStore.dispatch` → `applyCommand`). No component writes state directly. No second store.
3. The model proposes; the app validates and applies.
4. Scope is first-class: instance, page, global. Precedence: preview overlay > instance > page > global > component default.
5. Resolved design is derived, never stored as a mutable copy.
6. Keep three things separate: page spec (what must exist), design decisions (how it looks), element tree (rendered state).
7. Stable branded IDs.
8. Module boundaries (lint-enforced): `core/` imports nothing from `app/`, `modules/`, `persistence/`. `modules/*` may import `core/` but **never each other**. `persistence/` imports `core/` only. `app/` composes everything.
9. Persistence is write-behind and never on the interaction path.
10. Do not claim a guarantee that no validator or test checks.

---

## 3. Reading list (read before you plan anything)

Read these fully. Items marked (NOT REVIEWED) were not analysed when this brief was written; verify them yourself and report surprises.

| Area | Files |
|---|---|
| Rules | `AGENTS.md`, `PRODUCT.md`, `docs/PERF.md`, `docs/SECURITY.md`, `docs/TOOLS.md` |
| Core | `src/core/state.ts`, `commands.ts`, `apply.ts`, `validate.ts`, `specs.ts`, `elements.ts`, `values.ts`, `ids.ts`, `fixtures.ts`, `intake-schema.ts`, `generation.ts`, `decisions/*` |
| Intake | `src/modules/intake/*` (orchestrator, context, prompts, schemas, provider, mock-provider, `adapters/byok-adapter.ts`, `request-layer.ts` (NOT REVIEWED)) |
| Variants | `src/modules/variants/*` |
| App | `src/app/editor.tsx` (NOT REVIEWED beyond shortcuts), `store.ts`, `intake-panel.tsx`, `generation-panel.tsx`, `scope-picker.tsx`, `inspector.tsx`, `renderer.tsx` (NOT REVIEWED), `resolve.ts` (NOT REVIEWED), `command-id.ts` |
| Pages | `src/pages/*`, `src/router.tsx`, `Settings.tsx` (NOT REVIEWED), `config/models.json` (NOT REVIEWED) |
| Persistence | `src/persistence/*` (NOT REVIEWED: how Maps are serialised, Dexie version, migration chain) |
| Tests | everything under `tests/` for the areas you touch |

Run the baseline first (Phase 0) so you know what "green" looked like before you started.

---

## 4. Verified defects (the fix list)

Each was confirmed by reading the code. Line numbers drift; search by symbol.

| ID | Where | Defect | Fixed in |
|---|---|---|---|
| D1 | `pages/Workspace.tsx` | Loads the saved project only to check it exists, then builds `new QuilStore(emptyProject())`. `emptyProject()` mints a fresh `proj-${Date.now()}-n` id, so the editor opens a **new blank project**, never the one from intake. | P1 |
| D2 | `router.tsx`, `pages/Projects.tsx` | Router has `/`, `/p/:id`, `/settings`, `/new` only. `Projects.tsx` is not routed and navigates to `/new/1`. Workspace "Go to Projects" goes to `/projects`, which falls through the wildcard to Landing. | P1 |
| D3 | `pages/IntakeWizard.tsx` | Stores only `result.session`; **discards `result.question`**, so options, "why" and confirm kinds never render, and confirm shows raw slot keys. No opening question. | P6 (replaced) |
| D4 | `IntakeWizard.tsx` | **Skip is a no-op** (empty turn returns early). **"That's enough" cannot finish** because `done` requires every required slot stated. Progress = turns/12, not coverage. | P6 |
| D5 | `IntakeWizard.tsx` | Hardcoded `mockProvider`; session only in React state (no resume); also writes `set_intake_answer` copies that duplicate `state.intake` (arrays flattened with `', '`); page ids `page-${name}` collide and can contain invalid characters; hex colours (`#fee2e2`, `#16a34a`), dashed ghost buttons violate the UI contract. | P1, P6 |
| D6 | `modules/intake/orchestrator.ts` | A validation failure **discards the entire turn including valid updates** and asks a generic fallback, so users retype. Comment says "retry once", code does not. Provider failure retries twice immediately with no backoff and loses the user's text. | P3 |
| D7 | `orchestrator.ts`, `context.ts` | `buildContext(...)` result is assigned to `_context` and **never used**. `capForContext` truncates user text to 280 chars before the model sees it, yet the prompt says a long first message may fill many slots, and evidence is validated against the *untruncated* text. | P3 |
| D8 | `orchestrator.ts` | `buildCommand` mutates `session.turnIdCounter`; slot `asked` counters are mutated on objects shared with the previous session. Impure. | P3 |
| D9 | `app/intake-panel.tsx` | `setStep('spec')` is **never called** and `generatePageSpec` has **no UI caller**: spec editing and skeleton are unreachable. Section purpose edit is a stub. `dispatch` results are ignored (try/catch around a non-throwing call). Page ids `page-N` collide with wizard ids. Uses `Date.now()` in command ids. Duplicates the wizard with a second, older intake system. | P6 (replaced) |
| D10 | `app/generation-panel.tsx` | Targets hardcoded `sec-hero` / `el-hero-cta` and hardcoded `MOCK_CANDIDATES`. **`modules/variants` is imported by nothing in the UI.** If no candidate validates it falls back to showing the **invalid** ones (breaks fail-closed). | P8 |
| D11 | `core/generation.ts` `targetDefs.hero` | Requires `textColor`, but `sectionPropsSchema` is strict (`bgColor`, `padding` only). `applySetPropertyIn` rejects it, so **every hero approval fails**. The contrast check compares a pair the section does not render. | P8 |
| D12 | `apply.ts` `applyCandidateIn` | Always records an **instance** decision. `ScopePicker` later dispatches `set_property` with `element.props[property]` (the **base** value, not the resolved/approved value). Sections only get instance scope. Editor passes only `bgColor`/`color` to the picker. | P8 |
| D13 | `core/generation.ts` `buildVariantContext` | Palette is built from **base** props (ignores approved decisions). `houseRules` are only decisions already governing the target. Only `hero` and `button` have definitions. | P8 |
| D14 | `modules/variants/mock-provider.ts` | For any definition other than `button` it returns button props under that definition id. | P8 |
| D15 | `modules/*/byok-adapter.ts` | Both POST to invented routes (`/v1/propose-variants`, etc.) and **never send the system prompt**, so they cannot talk to a real model. In the variants adapter the deadline `AbortController` is **not connected to the fetch signal**, so the timeout never fires. No UI code constructs an adapter. | P4 |
| D16 | `context.ts` | Secret redaction regex `\bsk-[A-Za-z0-9]{20,}` does not match keys containing hyphens or underscores (for example `sk-ant-...`). | P1 |
| D17 | `core/apply.ts` `applyInstantiateSpecSkeletonIn` | Writes each section with `draft.nodes.set(...)` unconditionally, so a second run **resets section props and children**. Skeleton defaults hardcode hex colours including Quil's own accent for the user's buttons. | P5 |
| D18 | `intake-schema.ts` | 14 fixed slots tuned for marketing/commerce sites; `done` requires every required slot to be `stated`, so an inferred value can only be fixed by re-asking. | P3 |

---

## 5. Target experience (the flow you are building)

### 5.1 Stages (derived, never stored as a second copy)

A pure function `deriveWorkspaceStage(state): WorkspaceStage` in `src/core/workspace-stage.ts` decides what the right panel shows:

```ts
export type WorkspaceStage =
  | { kind: 'project-intake' }                       // project intake not confirmed
  | { kind: 'pick-start-page' }                      // intake confirmed, no starting page
  | { kind: 'page-intake'; pageId: PageId }          // start page intake not confirmed
  | { kind: 'spec-review'; pageId: PageId }          // spec missing, draft, or stale
  | { kind: 'design' }                               // spec approved, skeleton exists
```

Rules (evaluate top to bottom; first match wins):
1. `intakeStatus.project !== 'confirmed'` → `project-intake`
2. `startingPageId === null` → `pick-start-page`
3. `intakeStatus.pages.get(startingPageId) !== 'confirmed'` → `page-intake`
4. `pageSpecs.get(startingPageId)?.status !== 'approved'` → `spec-review`
5. otherwise → `design`

Opening any other page that lacks an approved spec uses the same function with that page id (lighter page intake, pre-seeded).

### 5.2 Screens

1. **New project dialog** (Radix Dialog on the Projects page, opened by "New project" and by `/projects?new=1`). One field: project name. On save: create project, persist, navigate to `/p/:id`.
2. **Workspace, project-intake stage.** Canvas shows an empty state (brief card that fills as slots are captured; page tabs appear as soon as `pages` is stated). Right panel shows the **Intake Dock**: header stepper (`Project › Page › Design`), the current question, answer box, option chips, "Why we ask", and a coverage progress bar.
3. **Review card** (end of project intake): "Here is what I understood", every slot and fact in human labels with inline edit and delete. User confirms.
4. **Pick starting page**: chips from the pages list; matching canvas tab highlights; picking dispatches `set_starting_page`.
5. **Page intake** in the same dock: page purpose is pre-filled from project intake (user confirms or edits), then dynamic follow-ups.
6. **Spec review**: outline editor (Phase 7), "Regenerate", "Approve and create skeleton".
7. **Design stage**: dock collapses to a one-line status; inspector and variants take over.

### 5.3 Behaviour rules
- Every intake turn is committed through the command bus, so a refresh resumes at the same question.
- The user can always click **Continue with what we have** once `canContinue` is true (Section 7.4).
- The dock never steals keyboard focus from canvas shortcuts (the editor already ignores keys while an `INPUT`/`TEXTAREA` is focused; keep that).
- When no AI key is configured the dock runs on the mock provider and shows a **Demo mode** badge (text, not colour only).

---

## 6. Decisions

Defaults below are **approved when the owner approves this brief**. Items marked **ASK** must be confirmed in your Phase plan before you build them.

| # | Decision | Default |
|---|---|---|
| X1 | Auth (Supabase) in scope? | **No.** Keep routes public. Do not add sign-in. **ASK** if the owner wants it. |
| X2 | Real providers for BYOK | One `ChatTransport` interface with two implementations: Anthropic Messages API and OpenAI-compatible Chat Completions (covers OpenRouter and similar). Models come from `config/models.json`. **ASK** if Settings/`models.json` imply a different set. |
| X3 | `siteType` enum | Add `web-app` and `dashboard` to the existing values. **ASK**. |
| X4 | Schema v4 (Section 7) | Approved as written. Phase 2 posts exact types for sign-off before any code. |
| X5 | Section layout archetypes | Exactly: `stack`, `centered`, `split`, `grid-2`, `grid-3`, `list`. Plus `gap` on sections and cards (approved earlier in `spec/questionnaire.md` Q1). |
| X6 | Turn caps | Project intake 15 turns, page intake 8 turns. |
| X7 | Intake commands and undo | Intake, fact, confirm and status commands are **not** undoable with Cmd/Ctrl+Z. Spec edits and skeleton changes **are** (one command = one undo step). Verify how history is recorded in `applyCommand` first and report. |
| X8 | Legacy projects (schema 3) | Migrate to v4: empty `facts`/`pageIntake`, `intakeStatus.project = 'confirmed'`, every existing spec `status = 'approved'`, section `role = 'content'`, `layout = 'stack'`, `emphasis = 'secondary'`. |
| X9 | Page intake for non-start pages | Lazy: runs when the user opens a page with no approved spec. Pre-seeded from project intake. |
| X10 | Desktop only | Workspace is desktop-first (1100px and up). Below that show a notice; do not build a mobile workspace. |

---

## 7. Data model v4 (exact types; Phase 2 posts these for sign-off)

All new schemas are Zod `.strict()`. All new IDs follow the branded-ID pattern in `src/core/ids.ts` (read it and copy the pattern; do not invent a format).

### 7.1 State additions (`src/core/state.ts`)

```ts
export type IntakeScope =
  | { kind: 'project' }
  | { kind: 'page'; pageId: PageId }

export const factTopics = [
  'product', 'audience', 'goals', 'content', 'brand',
  'features', 'business', 'constraints', 'integrations', 'other'
] as const
export type FactTopic = (typeof factTopics)[number]

export interface IntakeFactVersion {
  answer: string
  basis: SlotBasis
  turnId: string | null
}

export interface IntakeFact {
  id: FactId                 // branded, e.g. fact-1 (monotonic, assigned by the reducer)
  topic: FactTopic
  question: string           // plain-words question this answers, 1..280
  answer: string             // 1..500
  basis: SlotBasis           // 'stated' | 'inferred'
  confidence: number         // 0..1
  evidence: string           // exact substring of the user turn, or 'user' for UI edits
  turnId: string | null
  superseded: IntakeFactVersion[]   // max 3
}

export interface PageIntake {
  slots: Map<string, SlotValue>
  facts: Map<FactId, IntakeFact>
}

export interface IntakeStatus {
  project: 'open' | 'confirmed'
  pages: Map<PageId, 'open' | 'confirmed'>
}

// ProjectState (schemaVersion 4) adds:
//   facts: Map<FactId, IntakeFact>          // project-level dynamic facts
//   pageIntake: Map<PageId, PageIntake>     // page-level slots + facts
//   intakeStatus: IntakeStatus
//   intakeRev: number                       // +1 on every accepted intake/fact/confirm command
//   nextFactSeq: number
```

`TurnRecord` gains `scope: 'project' | PageId` and `asked?: AskedQuestion`:

```ts
export interface AskedQuestion {
  mode: 'model' | 'fallback'                       // fallback = app-written, provider unavailable
  kind: 'ask'
  target:
    | { type: 'slot'; slots: string[] }            // 1..2 slot keys valid in the scope
    | { type: 'topic'; topic: FactTopic }
  question: string                                 // <= 25 words, <= 280 chars
  options: string[]                                // 0..5, each <= 60 chars
  why: string                                      // <= 140 chars
}
```

New `bounds` entries: `maxFacts: 40`, `maxFactAnswer: 500`, `maxTurnText: 2000`, `maxProjectTurns: 15`, `maxPageTurns: 8`, `maxSpecOpsPerCommand: 20`, `maxFactsPerTurn: 6`.

### 7.2 Slots

- Add slot type `'page-list'` (items `{ name, purpose }`, validated by the existing `_pageChoiceSchema`, max 12). The project `pages` slot becomes `page-list`.
- Add `web-app` and `dashboard` to `siteType` options (decision X3).
- Add `pageSlotDefs` (same `SlotDef` shape; `fallbackQuestion` required):

| key | type | required | weight | description (written for the model) |
|---|---|---|---|---|
| `purpose` | text | yes | 10 | What this page is for, in one sentence |
| `visitorIntent` | text | yes | 8 | Who arrives here, from where, and what they want |
| `primaryAction` | text | yes | 8 | The one action this page should drive |
| `mustInclude` | list (max 8) | no | 6 | Content or features this page must contain |
| `objections` | list (max 5) | no | 4 | Doubts a visitor has that the page must answer |
| `contentReadiness` | enum ready/partial/none | no | 3 | Whether copy and images exist |
| `avoid` | list (max 5) | no | 3 | Things not to put on this page |

- `slotDefsFor(scope): Record<string, SlotDef>` returns project or page defs. `coverage(slots, defs)` takes the defs as a parameter (default = project defs so old callers still compile).
- Project **spine** (required) stays: `siteType`, `purpose`, `audience`, `primaryAction`, `pages`, `tone`. Everything else about the product is captured as **dynamic facts**.
- `canContinue(state, scope)` (pure): project → `purpose` has a value AND `pages` has at least one entry; page → `purpose` has a value.

### 7.3 Page spec v4 (`src/core/specs.ts`)

```ts
export const sectionRoles = [
  'header', 'hero', 'features', 'benefits', 'how-it-works', 'social-proof',
  'pricing', 'faq', 'cta', 'gallery', 'team', 'contact', 'content', 'footer', 'custom'
] as const
export const layoutArchetypes = ['stack', 'centered', 'split', 'grid-2', 'grid-3', 'list'] as const
export const emphasisLevels = ['primary', 'secondary', 'quiet'] as const

// Section (stored + provider variants; provider variant has no elementId)
{
  key: specKey,
  role: SectionRole,
  roleLabel?: string,          // 1..40, REQUIRED when role === 'custom', forbidden otherwise
  purpose: shortText,          // why the section exists
  goal: shortText,             // what the visitor should feel or do here
  layout: LayoutArchetype,
  emphasis: Emphasis,
  elements: SpecElement[]      // 1..20
}

// Element
{ key, kind, purpose, required, draftCopy?: string /* 1..500, a PROPOSAL, never approved copy */, elementId? /* stored only */ }

// PageSpec (stored)
{
  pageId, name, purpose,
  version: number,                       // +1 on every change
  status: 'draft' | 'approved',
  basedOnIntakeRev: number,              // state.intakeRev when generated (stale detection)
  sections: Section[]                    // 1..20
}
```

Provider output schema must **not** contain `elementId`, `version`, `status`, `basedOnIntakeRev`. The application sets them.

`validatePageSpec` (structural, hard errors): unique section keys; unique element keys per section; counts within bounds; `roleLabel` rule; at most one `header`, one `hero`, one `footer`; if present `header` is first and `footer` is last.

`assessSpecQuality(spec): QualityIssue[]` (pure, soft warnings, shown to the user, plus one automatic revision request to the provider):
- the same `layout` on 3 or more consecutive sections;
- fewer than 3 sections when `pageIntake.mustInclude` has 3 or more items;
- a section with no `required` element;
- two adjacent sections with identical `role`.

Element props: add to `sectionPropsSchema` `layout: layoutArchetypeSchema.optional()` and `gap: spacingValue.optional()`; add `gap: spacingValue.optional()` to `cardPropsSchema`. Add `layout` (select) and `gap` (number) to the inspector `fieldSpecs`.

### 7.4 Spec edit operations (`src/core/spec-ops.ts`)

```ts
export const specOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add_section'),    afterKey: specKeySchema.nullable(), section: providerSpecSectionSchema }).strict(),
  z.object({ op: z.literal('remove_section'), key: specKeySchema }).strict(),
  z.object({ op: z.literal('move_section'),   key: specKeySchema, afterKey: specKeySchema.nullable() }).strict(),
  z.object({ op: z.literal('update_section'), key: specKeySchema, patch: sectionPatchSchema }).strict(),
  z.object({ op: z.literal('add_element'),    sectionKey: specKeySchema, afterKey: specKeySchema.nullable(), element: providerSpecElementSchema }).strict(),
  z.object({ op: z.literal('remove_element'), sectionKey: specKeySchema, key: specKeySchema }).strict(),
  z.object({ op: z.literal('move_element'),   fromSectionKey: specKeySchema, key: specKeySchema, toSectionKey: specKeySchema, afterKey: specKeySchema.nullable() }).strict(),
  z.object({ op: z.literal('update_element'), sectionKey: specKeySchema, key: specKeySchema, patch: elementPatchSchema }).strict()
])
// sectionPatchSchema: { purpose?, goal?, role?, roleLabel?, layout?, emphasis? } strict, at least one key
// elementPatchSchema: { purpose?, kind?, required?, draftCopy?: string | null } strict, at least one key
```

`applySpecOps(spec: PageSpec, ops: SpecOp[]): Result<PageSpec, SpecOpError>` is **pure and atomic**: apply to a copy, run `validatePageSpec`, return the new spec or a typed error naming the failing op index. Key collisions on add are resolved with `uniqueKey(base, taken)` (`base`, `base-2`, `base-3`, ...). Removing the last section is an error. A `move` that targets itself is a no-op. `kind` change on an element is treated by reconcile as remove + add (new node).

---

## 8. Commands

Follow the existing patterns in `commands.ts` / `apply.ts`. Every command: `commandId`, `baseRev`, strict schema, bounded payload, idempotent on `commandId` (existing dedupe) and on its natural key.

| Command | Payload | Notes |
|---|---|---|
| `apply_intake_update` (changed) | `scope?` (defaults to project so old persisted ops still replay), `updates`, `facts` (max 6), `askedSlots`, `asked?: AskedQuestion`, `turnId`, `userText` (max 2000) | Idempotent on `turnId`. Increments `intakeRev` and slot `asked`. Records a `TurnRecord` even when `updates` and `facts` are empty (so user text is never lost). Rejects `facts` beyond `maxFacts`. |
| `set_intake_slot` (new) | `scope`, `slot`, `value` | User-authored. `basis: 'stated'`, `evidence: 'user'`. Validated by `validateSlotValue` for the scope's defs. Keeps up to 3 superseded values. |
| `edit_intake_fact` (new) | `scope`, `factId`, `answer: string \| null` | `null` deletes. Edited facts become `stated`, evidence `'user'`. |
| `confirm_intake` (new) | `scope` | Allowed only if `canContinue`. Sets `intakeStatus`. Page scope also seeds nothing else. Idempotent. |
| `set_page_spec` (changed) | `pageId`, `spec` (provider shape) | Sets `status: 'draft'`, `basedOnIntakeRev = state.intakeRev`, carries `elementId`s by key (existing behaviour). Allowed only while the existing spec (if any) is `draft`; for approved specs use `edit_page_spec`. |
| `edit_page_spec` (new) | `pageId`, `baseSpecVersion`, `ops` (1..20), `confirmOrphans?: boolean` | Fails `STALE_SPEC` if `baseSpecVersion` differs. Atomic. If the page has a skeleton, runs reconcile (Phase 7). Fails `CONFLICT_NEEDS_CONFIRMATION` listing decision ids if reconcile would orphan decisions and `confirmOrphans` is not true. One undo step. |
| `approve_page_spec` (new) | `pageId`, `baseSpecVersion` | Validates, sets `status: 'approved'`, reconciles skeleton. One undo step. Idempotent. |
| `instantiate_spec_skeleton` (changed) | `pageId` | Becomes **idempotent reconcile**: creates only missing nodes; never resets existing props or children. |
| `apply_candidate` (changed, Phase 8) | adds `scope` (instance default) | Section targets stay instance-only. |

### 8.1 Checklist for adding or changing a command (do all eight)

1. Zod schema in `commands.ts` (strict, bounded) and add it to the union(s) and type exports.
2. Reducer function in `apply.ts` and a `case` in the exhaustive switch (the `never` check must still compile).
3. New invariants in `validate.ts` (Section 9, Phase 2 lists them).
4. Idempotency on `commandId` plus the natural key (turnId, factId, spec version).
5. History policy per decision X7 (undoable or not), verified in `applyCommand`.
6. Persistence: `indexeddb-repository.ts` serialisation, `migration.ts`, and **op-log replay** of old commands (new fields optional or defaulted).
7. Tests: valid payload; every field invalid; stale `baseRev`; duplicate replay; bound exceeded; property/fuzz test.
8. Update `docs/TOOLS.md`.
