# design_plan.md — Quil UI U0 to U4 (with quil-feather pen experience)

## Status
- **U0 — Design system & primitives: COMPLETE** (165 tests pass, tsc clean, lint clean)
- **U1 — Shell, auth, settings: COMPLETE** (routing, auth context, fake provider, SignIn with pen typing adornment, Projects, Settings with BYOK, KeyStatusChip)
- **U2 — Intake UI: COMPLETE** (7-step wizard on /new/:step, FeatherPen typing adornment, PenLoader between steps)
- **U3 — Workspace layout & variants tray: COMPLETE** (variants tray with 3 cards, prompt box pinned to tools panel, FeatherPen/PenLoader integration)
- **U4 — Landing page: COMPLETE** (8-section story, live demo with PenLoader, FeatherPen hero mark, strategy canvas)

## Source documents
- `AGENTS.md` — architecture, module boundaries, perf contract, defensive coding, UI contract
- `Quil Coding-Agent Prompt Pack (1).md` — UI build prompts U0–U4, UI contract, phase gates, red-team list
- `src/ui/tokens.css` — existing design tokens (dark theme, monochrome + one violet accent `#7C3AED`)
- `src/app/` — existing workspace shell, renderer, inspector, scope picker, generation panel, preview overlay, store
- `src/core/` — command bus, decisions, generation, fixtures (verified: `tsc` clean, 156 tests passing, bench2 PASS)

---

## Pen experience (integrated across U0–U4)

**Quil-feather pen** — minimal SVG with the underlying structure of a real quill/quil feather used to write in old days:
- Feather barbs and central rachis (shaft) in `--quil-text-100` (same colour as the logo text / UI text)
- Pen nib/tip in `--quil-accent` (`#7C3AED`) — the writing point
- Size ~24px baseline, scales with container
- `aria-hidden="true"` decorative; never conveys state by colour alone
- Respects `prefers-reduced-motion` (static render, no animation)

**PenLoader** — stroke-dashoffset animation simulating a feather pen writing/drawing:
- Falls back to static feather under reduced motion
- Used as loading indicator on submit actions and generation

**Integration points:**
| Phase | Surface | Pen experience |
|-------|---------|----------------|
| U0 | Design system primitives | `FeatherPen` + `PenLoader` primitives, `/dev/ui` kitchen sink, contrast test |
| U1 | `/signin` | FeatherPen inside email/password inputs as typing adornment; PenLoader behind submit button during OAuth redirect |
| U2 | `/new/:step` intake | FeatherPen typing adornment on answer inputs; PenLoader between adaptive steps while provider options load |
| U3 | Workspace (`/p/:projectId`) | FeatherPen as inline text cursor/adornment when editing text; PenLoader in prompt box during "Generate 3 variants" |
| U4 | `/` landing | FeatherPen as hero logo mark; PenLoader behind the live demo's global-rule change |

---

## U0 — Design system & primitives

**Goal:** Deliver every primitive component plus the quil-feather pen primitives, all token-only, with a dev kitchen-sink route and a contrast test.

**Files to create:**
- `src/ui/primitives/Button.tsx` — primary (accent fill, label `var(--quil-bg)`, hard 3px edge, `translateY(3px)` press, 44px min target)
- `src/ui/primitives/IconButton.tsx` — 40px square variant
- `src/ui/primitives/Card.tsx` — 10px radius, surface colour, 3px shadow token
- `src/ui/primitives/SelectableCard.tsx` — radio + checkbox variants, selected = pressed + accent ring + check/dot, never colour alone
- `src/ui/primitives/Input.tsx` — text input, length-capped, renders untrusted text as text nodes
- `src/ui/primitives/Textarea.tsx` — multi-line text
- `src/ui/primitives/Segmented.tsx` — scope picker segments (instance/page/global)
- `src/ui/primitives/Chip.tsx` + `src/ui/primitives/Badge.tsx`
- `src/ui/primitives/Tabs.tsx` — page tabs (Radix Tabs)
- `src/ui/primitives/StatusMessage.tsx` — icon + text, aria-live
- `src/ui/primitives/FeatherPen.tsx` — quil-feather pen SVG (feather body `--quil-text-100`, nib `--quil-accent`)
- `src/ui/primitives/PenLoader.tsx` — pen stroke animation, reduced-motion safe
- `src/ui/index.ts` — barrel export
- `src/routes/dev-ui.tsx` — dev-only kitchen sink, every primitive in every state
- `tests/ui/contrast.test.ts` — culori contrast suite
- `tests/ui/feather-pen.test.ts` — FeatherPen/PenLoader unit tests

**Files to change:**
- `eslint.config.js` — add token-only rule: no raw hex, font sizes, or shadows in `src/ui/**` and `src/app/**`
- `src/app/App.tsx` — replace inline button styles with `Button`/`IconButton` primitives (token compliance)

**Acceptance:**
- All primitives keyboard-operable, visible focus, no colour-only state
- Contrast suite passes: text levels ≥4.5:1 vs bg/surface, button label vs fill ≥4.5:1, accent vs bg ≥3:1
- No component contains raw colour/font-size/shadow (lint rule)
- FeatherPen/PenLoader render statically under `prefers-reduced-motion: reduce`

---

## U1 — Shell, auth, settings

**Goal:** Router + public pages + auth (Google + Apple only) + Settings with BYOK.

**Files to create:**
- `src/router.tsx` — routes `/`, `/signin`, `/auth/callback`, `/projects`, `/p/:projectId`, `/settings`; route guards; validated `next` param
- `src/pages/Landing.tsx` — public, 8 story sections
- `src/pages/SignIn.tsx` — centered card, Quil mark, "Start designing", Google + Apple full-width buttons, states: idle/redirecting/cancelled/provider-error/already-signed-in
- `src/pages/Projects.tsx` — signed-in, project list + New project
- `src/pages/Settings.tsx` — API key section (provider cards, model list from `src/config/models.json`, masked field with Show toggle, storage choice, Test & save, status block aria-live, Remove key, spend guard) + Account section
- `src/config/models.json` — provider/apiId/label/recommended/why/source/verifiedOn
- `src/components/KeyStatusChip.tsx` — workspace top-bar chip linking to `/settings#api-key`

**Pen experience integration:**
- `FeatherPen` inside email/password `Input` fields as typing adornment on `/signin`
- `PenLoader` behind the sign-in submit button while OAuth redirect initializes

**Supabase:** credentials via environment variables; fake provider for tests (no real network calls in test suite)

**Acceptance:**
- New user signs in → intake; returning user → Projects
- Key page end-to-end with fake provider
- Sign-out clears session + in-memory key
- Seeded fake key never appears in logs, storage dumps, network traces (except provider request), or error reports

---

## U2 — Intake UI

**Goal:** 7-step intake wizard on `/new/:step`.

**Files to create:**
- `src/pages/IntakeWizard.tsx` — centered 640px column, step label, H1 question, helper line, 3px accent progress bar
- `src/components/intake/StepDescribe.tsx` — textarea + example chips
- `src/components/intake/StepAudience.tsx` — multi-pick (checkbox cards)
- `src/components/intake/StepGoals.tsx` — multi-pick (checkbox cards)
- `src/components/intake/StepTone.tsx` — single-pick tone words (radio cards)
- `src/components/intake/StepPages.tsx` — multi-pick pages + inline rename + Add a page
- `src/components/intake/StepStart.tsx` — single-pick starting page, Home preselected
- `src/components/intake/StepReview.tsx` — all answers with Edit links + Create project

**Pen experience integration:**
- `FeatherPen` typing adornment inside answer inputs on each step
- `PenLoader` between adaptive steps while provider options load

**Acceptance:**
- Keyboard-only full flow lands in workspace with valid Home spec
- Malformed-option fuzz; double-submit; resume-on-refresh/back tests
- Single-pick vs multi-pick differ by shape as well as colour

---

## U3 — Workspace layout & variants tray

**Goal:** Rework `App.tsx` into the 2fr/1fr workspace shell + variants tray + prompt box.

**Files to change:**
- `src/app/App.tsx` — 2fr/1fr grid, full viewport height, independent scrolling panels; top bar; page tabs above canvas
- `src/app/generation-panel.tsx` — prompt box pinned to bottom of tools panel
- `src/components/workspace/VariantsTray.tsx` — bottom of canvas, 3 cards, live miniatures, rationale, constraint chips, tap to preview through overlay, Approve/Reject/Regenerate, skeleton cards, stale banner

**Pen experience integration:**
- `FeatherPen` as inline text cursor/adornment when editing text element in inspector
- `PenLoader` in prompt box while "Generate 3 variants" runs

**Acceptance:**
- Tap card swaps preview <50 ms p95, zero network
- Opening/closing panels causes no canvas re-render
- No long task >50 ms during streamed generation
- Keyboard tray: arrow keys, 1–3, Escape to leave preview

---

## U4 — Landing page

**Goal:** 8-section story page with live demo + strategy canvas.

**Files to change:**
- `src/pages/Landing.tsx` — full 8 sections from story table; responsive 360px–4K
- `src/components/landing/LiveDemo.tsx` — imports real renderer + decision engine, fixture project, global button rule change
- `src/components/landing/StrategyCanvas.tsx` — drawn from data, no competitor names

**Pen experience integration:**
- `FeatherPen` as hero logo mark in section 1
- `PenLoader` behind the live demo's global-rule change action

**Acceptance:**
- Page reads as complete story with JavaScript off
- Demo proves only applicable buttons change on global rule update
- Axe + Lighthouse budgets green

---

## Execution order & gates

Per prompt pack: one UI prompt at a time → post plan → stop for approval → write failing tests → implement → verify (`tsc`, `npm run lint`, `vitest run --no-file-parallelism`, benchmarks) → next phase.

1. U0 (design system + pen primitives)
2. U1 (shell + auth + settings)
3. U2 (intake)
4. U3 (workspace + variants tray)
5. U4 (landing page)

---

## Pen feather SVG structure (minimal, quill-based)

The feather has:
- Central rachis (shaft) running vertically — `--quil-text-100`
- Left and right barbs branching off the rachis — `--quil-text-100`
- A quill nib at the bottom tip — `--quil-accent`
- A small ink drop or writing point at the very tip — `--quil-accent`

All colours come from tokens only; no raw hex in components.
