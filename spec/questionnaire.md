# Workspace Page — Design Questionnaire

Purpose: resolve the design questions that change the workspace *layout and interaction model*.
Companion: `spec/workspace.md` (unstyled spec), `spec/tool-scope.md` (the 14 tools + 20/80 scope),
`spec/execution-plan.md` (build order).

Answer with a short phrase. Skip anything already settled — the "Resolved" section below records
what the 20/80 tool scope already decided.

---

## Resolved by the 20/80 tool scope (do not re-ask)

| Question | Answer |
|---|---|
| Primary workflow | Tools-first. Decisions (Variants/Approve/Scope) are the signature, not drawing. |
| Stokes of the layout | A top bar, B left rail, C canvas, D floating toolbar, E variants tray, F inspector, G prompt, H overlays. |
| Canvas role | Direct manipulation only where it maps to a property: select, in-place text, resize handles, drag-reorder. No free positioning. |
| Tools per tool | At most three entry points: canvas, panel/toolbar, keyboard or palette. |
| Tools in scope | 14, in three tiers. Everything else is explicitly out of scope. |
| Density | Desktop-first: 2fr canvas / 1fr inspector, independent scroll panels. |
| Out of scope | Pen/vectors, freeform position, gradients/blend, prototyping, component authoring, custom fonts, comments, plugins; code export is MVP. |

---

## Open questions that block build steps

### Q1. Gap between siblings (blocks tool 8: Space and shape) — answered
Add `gap` to `sectionPropsSchema` and `cardPropsSchema`. Matches Auto Layout's core sibling gap; keeps structured flow consistent across sections/cards. → Picked.

### Q2. Resize schema (blocks tool 9: Resize) — answered
Keep resize to the existing property set: `image` w/h, `section`/`card` padding/radius, `button` radius, `text` fontSize. Do not extend to new kinds (keeps schema bounded, Gestures already scrubs these). → Picked.

### Q3. Form element controls (blocks tool group F completeness) — answered
Form gets an own inspector group (`fields` add/rename/reorder; `submitLabel` edit); not variants-only (schema review needed for form UI field types). → Picked.

### Q4. Usage counts (blocks §8 of the tool scope) — answered
NOT NOW. Per-session anonymous counting deferred until launch. After ~20 sessions (§8), demote low-frequency Tier A tools and promote high-frequency Tier C tools. → Picked.

### Q5. Code export (blocks roadmap, not a build step) — answered
NOW (MVP). Exportable JSON of project + decisions; no server dependency for MVP. → Picked.

### Q6. Insert menu contents (blocks tool 10: Insert) — answered
Seven element kinds only. Templated blocks deferred; ask again if feature repeats after launch. → Picked.

### Q7. Tools panel width (blocks D/F layout) — answered
Fixed 1fr inspector at 320 px floor; nothing above this needs user-draggable resizing. → Picked.

### Q8. Left rail default state (blocks B) — answered
Collapsed by default (keep 2fr canvas; rail dims on wide desktop). Expanded only if project has > 3 pages. → Picked.

### Q9. Preview mode depth (blocks tool 11) — answered
Zoom + pan only now. Device width switch and shareable read-only link deferred; both are view-only, non-document changes. → Picked.

### Q10. Identity guardrails (blocks the anti-slop audit)
One thing the workspace must NOT feel like:
- [ ] Generic no-code builder (Bubble/Webflow)
- [ ] General design tool (Figma/Sketch chrome)
- [ ] CMS admin (WordPress/Contentful)

One signature that must survive the redesign:
- [ ] Decision scope badges (instance / page / global)
- [ ] Variant tray with live miniatures
- [ ] Prompt-as-design-tool

---

## Constraints already fixed by the repo (no need to answer)

- Tokens only. Every colour, size, space, radius, shadow, duration comes from `src/ui/tokens.css`.
- Dark theme only, monochrome + one violet accent, no pure black/white.
- Archivo for H1–H4, Inter for everything else, both self-hosted.
- Text intensity is colour tone (100/95/90/85/80/75/70), never opacity; CI contrast test at 4.5:1.
- Buttons are solid fill with label `var(--quil-bg)`, hard 3px press edge, no ghost/outline buttons.
- 44px minimum target, 40px icon-only.
- Cards 10px radius, 3px shadow token, surface colour.
- Workspace desktop-first at 1100px+; landing/sign-in responsive to 360px.
- WCAG 2.2 AA; reduced motion respected.
- UI chrome never re-renders canvas content; all changes through the command bus.
- Untrusted text renders as text and is length-capped.

---

## Token gaps found while writing the spec (not questions — facts)

1. `src/ui/tokens.css` lines 34–35 are missing semicolons, so both font tokens are broken
   (`--quil-font-ui` swallows the next declaration). Fix before any styling work.
2. There is no `--quil-focus-ring` token. WCAG 2.2 AA needs a visible focus style; add one token.
3. There is no `--quil-overlay` / `--quil-backdrop` token. Zone H overlays need one.
4. `--quil-space-2` … `--quil-space-8` are declared twice. Harmless, but delete the duplicates.
