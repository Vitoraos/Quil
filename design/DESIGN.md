# Design Position — Workspace (Light Theme)

**Status:** frozen. Builds on 20/80 tool scope; light theme replaces dark monochrome + violet accent.

## 1. Visual language

- **Palette:** bg #fafafa, text #02040d, button #0054a3, button text #ffffff, accent = button colour.
- **Typography:** Archivo for H1–H4, Inter for all UI text.
- **Contrast:** colour tone only; no opacity used for text intensity.
- **Surface hierarchy:** cards with `radius-sm` (6px) + `shadow-3` (0 3px 0 rgba(2,4,13,0.10)); main panel elevation slightly lower.
- **Buttons:** no mechanical press; hover: opacity 0.92, active: scale 0.98. `secondary` / `neutral` buttons use `--quil-surface` with `--quil-text-100` text.
- **Interactive focus:** `--quil-focus-ring` (2px solid accent) visible on keyboard navigation.

## 2. Layout axis

- 2fr / 1fr grid on desktop; tools panel min-width 320px, independent scroll panels.
- Variant tray moves **below canvas** (compact stack), small rectangular cards; users can select 1–3 variants.
- Left rail (Pages, Layers, Decisions) collapsed by default; drawer on narrow viewports.
- Header (Zone A) flat background with bottom border, no elevation.
- Footer, overlays (Zone H): dark transparent backdrop (`--quil-overlay`), structured groups.

## 3. Components summary (tokens only)

| Component | Main styles | Notes |
|-----------|-------------|-------|
| Header | background --quil-bg, bottom border --quil-line | Toolbar actions use `buttonBase` with --quil-button / --quil-button-text |
| Page tabs | active: background --quil-button, colour --quil-button-text, shadow-3 | Hover/active: subtle opacity/scale (no press) |
| Canvas | transform scale(zoom), independent scrolling | Empty state: --quil-surface card, center-aligned CTA button |
| Inspector groups | background --quil-surface, border-radius --quil-radius-md, shadow-3 | Selection header: --quil-text-100, font-head size, no extra background strip |
| Variant tray | flex column, gap 8, stacked below canvas; cards: 200px width, radius-sm, shadow-3 |
| Prompt box | pinned bottom, --quil-surface, border-radius-md, shadow-3 |
| Overlays | `--quil-overlay` backdrop, `--quil-backdrop`; grouped actions, divider lines |

## 4. Anti-slop guardrails

- No raw colours in components — all via tokens.css.
- Text intensity based on colour tone (100/95/90/85/80/75/70), not opacity.
- Buttons: solid fill, label colour = `var(--quil-bg)`.
- Shadow values calibrated for light background contrast.
- No glassmorphism, no gradients, no pure white/black.
- No mechanical press: hover/active limited to opacity & scale.
- Variant count capped (1–3) to prevent decision fatigue.

## 5. State communication

- Save status, AI key status, read-only banner, recovery screens: top bar.
- Generation in progress: disabled buttons with `opacity 0.5`.
- Contrast/drift badges: inline, `--quil-accent` ring + text.
- Read-only banner: fixed banner with `background: var(--quil-surface)` and clear “Why?” indicator.

## 6. Interaction flow (changes from 20/80 scope)

1. Canvas selection → Inspector panel (right) reveals in full-width cards.
2. Variant tray appears **below canvas** (compact 200px cards, 1–3 selectable).
3. Prompt box pinned to bottom of inspector, not canvas edge.
4. Mechanical press removed — no press edge or translateY on any button.

## 7. Technical constraints

- Token files: `design/tokens.css` (design spec), `src/ui/tokens.css` (implementation mirror).
- No component may import raw hex, font-size, or shadow values.
- All layout use `grid` / `flex`; no `position: absolute` outside overlays.
- Zooms and scrolls independent; no full-page re-render on any interaction.
- Responsive breakpoints as before; on <640px tools stack below canvas.

## 8. Performance contract

- One committed command → command → resolve → render within the same frame for instance-scope edits on a 500-element page.
- Incremental resolution; re-compute only affected elements (dependency index).
- No network call, IndexedDB write or whole-project serialization on the interaction path.
- Variants pre‑rendered miniature (200×80) to stay within 50 ms swap budget.

## 9. Known limitations / risks

- **Theme switch:** only light theme supported; dark‑mode toggle requires separate design position.
- **Reduced motion:** respects `prefers-reduced-motion`, but some scale transitions remain; design accepts this.
- **Accessibility:** contrast meets 4.5:1 for normal text, 3:1 for larger text (as per tokens).
- **Variant count:** 1–3 limited; if user needs more, it requires future scope expansion.

## 10. Usage notes

- In code, use `var(--quil-button)` for button backgrounds, `var(--quil-button-text)` for button labels.
- No `--quil-accent` needed separately; accent and button share the same colour.
- To add a new semantic token, edit `design/tokens.css` and mirror into `src/ui/tokens.css`.
- If adding a new page type, adjust `Workspace.tsx` page‑tab logic; no other changes needed.

---

*Documented design decisions from Light theme switch, variant tray position change, variant count selector (1–3), removal of mechanical press.*
