# UI-Layer-1-failure.md — Background Shell Failure Modes

## What Layer 1 builds
Root shell: `Shell.tsx` + `index.ts`, outer container `display: grid`, `height: 100vh`, `background: var(--quil-bg)`, `color: var(--quil-text-100)`, `font-family: var(--quil-font-ui)`. No deletions yet.

## Failure modes & mitigations

| # | Failure | Symptom | Detection | Mitigation |
|---|---------|---------|-----------|------------|
| 1 | **Token CSS not loaded** | Page shows white or browser default bg instead of `#15100d` | Visual: background not dark; DevTools: `--quil-bg` undefined | `index.tsx` already imports `../ui/tokens.css`; Shell must not re-import or duplicate. Verify `<link>` or style injection resolves. |
| 2 | **var(--quil-bg) not resolving** | Fallback to transparent/white; body shows through | DevTools computed styles: `--quil-bg` shows initial/invalid | Token defined in `:root` in tokens.css. Confirm `index.tsx` import order: fonts → tokens.css → base.css before React render. |
| 3 | **FOUC (flash of unstyled content)** | White screen for a frame before dark bg applies | Visual: brief white flash on load | `index.html` loads tokens.css via `index.tsx` import chain; ensure `<head>` has no render-blocking that delays CSS. Vite bundles CSS into JS, so minimal risk. |
| 4 | **Body/html default margins** | 8px margin around shell; bg doesn't fill edge-to-edge | Visual: thin light border at viewport edges; DevTools: margin on body/html | Reset `html, body { margin: 0; height: 100%; }` in Shell CSS. base.css already does this — verify no conflict. |
| 5 | **100vh overflow / scrollbar** | Vertical scrollbar appears; content slightly overflows | Visual: scrollbar on right; 100vh > visible height | `overflow: hidden` on html/body; Shell `height: 100vh` not `min-height`. |
| 6 | **React createRoot fails** | Blank page; React error in console | Console: "Target container is not a DOM element" or similar | `index.tsx` already handles `#root` creation. Shell is rendered by Router → Workspace page, not directly. Layer 1 Shell is a placeholder export; Router not yet pointed at it. |
| 7 | **Router still points to old Workspace/Editor** | App shows old monolithic editor, not Shell | Visual: old UI renders instead of dark shell | Layer 1 does NOT change router. Shell exported as placeholder; router update comes later. No conflict. |
| 8 | **TypeScript typecheck error** | `npm run typecheck` fails; build blocked | Console/terminal: TS errors in Shell.tsx | Use only React types, no `any`. Import types from `react` only. |
| 9 | **ESLint violation** | `npm run lint` fails | Lint errors in new files | Follow existing conventions: named exports, no unused vars, no inline styles (use CSS module or `<style>`). |
| 10 | **Font source not loaded** | Text falls back to system font briefly | Visual: font swap after load; DevTools: 404 on font files | `index.tsx` imports `@fontsource/inter` and `@fontsource/archivo` before Shell renders. Layer 1 uses `--quil-font-ui` (Inter) which is loaded. |
| 11 | **z-index / stacking context** | Shell overlaps or is overlapped by unexpected elements | Visual: other UI bleeds through | Layer 1 is the only content; no z-index issues yet. |
| 12 | **CSS variable shadowing** | Shell defines `--quil-bg` locally and overrides token | DevTools: local `--quil-bg` wins over `:root` | Shell does NOT redeclare `--quil-bg`; only references it. |

## Acceptance (Layer 1)
- Page background is `#15100d` (espresso), fills entire viewport
- No white flash, no default browser margins
- `npm run typecheck` passes
- `npm run lint` passes on new files
- App loads at `http://localhost:5173` without console errors
