# UI-Layer-3-failure.md — Top Nav Failure Modes

## What Layer 3 builds
TopBar.tsx — fixed 56px top bar (Region A), background `#15100d`, border-bottom `1px solid #2a201a`, right-aligned buttons: Undo `↶`, Redo `↷`, Preview (monospace font). All buttons `#f5f0f0` fill, `#15100d` text, `6px` radius. Shell.tsx updated to render TopBar above CanvasCol.

## Failure modes & mitigations

| # | Failure | Symptom | Detection | Mitigation |
|---|---------|---------|-----------|------------|
| 1 | **Nav covers canvas top** | Canvas content hidden behind fixed nav | Visual: card top edge clipped by nav bar | CanvasCol `paddingTop: 81px` (56px nav + 25px spacing) already set in Layer 2; verify no overlap |
| 2 | **Fixed nav not spanning full width** | Gaps at left/right edges; bg doesn't edge-to-edge | Visual: light bg showing at screen edges | `left: 0; right: 0; width: 100%` on `.topnav`; no padding on container, only inside `.topnav-right` |
| 3 | **Buttons not vertically centered** | Buttons sit top/bottom-aligned in 65px/56px bar | Visual: buttons not centered; uneven gaps top/bottom | `align-items: center` on flex container; height 56px with flex centering |
| 4 | **Button text color not #15100d** | Buttons show white/default text instead of dark | Visual: buttons look wrong; DevTools: color mismatch | Use `var(--quil-button-text)` = `#15100d`; verify token value in tokens.css |
| 5 | **Preview font not monospace** | Preview label renders in Inter instead of tech font | Visual: Preview doesn't look dev-style | Use `var(--quil-font-mono)` = SF Mono stack; verify font loads via @fontsource in index.tsx |
| 6 | **Buttons overlap each other** | Icons/text collide; no gap between buttons | Visual: buttons cramped together | `gap: var(--quil-space-2)` (8px) between buttons; padding `var(--quil-space-1) var(--quil-space-3)` (4px/12px) |
| 7 | **Right alignment broken** | Buttons centered or left instead of right | Visual: buttons not flush right | `justify-content: flex-end` on `.topnav`; `padding-right: var(--quil-space-6)` (24px) |
| 8 | **z-index conflict** | Nav overlaps or is overlapped by canvas/toolbar | Visual: nav behind canvas or quick tools floating above nav | TopBar `z-index: 100`; CanvasCard `z-index: 1`; QuickTools `z-index: 2` (but positioned below canvas, so no conflict) |
| 9 | **Scrollbar appears due to nav height** | 56px nav + 100vh body causes overflow scrollbar | Visual: vertical scrollbar; body slightly overflows | `overflow: hidden` on html/body; CanvasCol handles scrolling internally |
| 10 | **Token not resolved** | Nav shows white/transparent instead of #15100d | Visual: wrong background color | `background: var(--quil-bg)` referencing `:root` token; index.tsx imports tokens.css |
| 11 | **Border bottom missing/duplicated** | No separator line; or double line from canvas | Visual: nav blends into canvas; or two lines | `border-bottom: var(--quil-border-width) solid var(--quil-line)` on nav only; canvas has its own border |
| 12 | **Hover state broken** | Buttons don't react on hover | Visual: no feedback when hovering | `:hover` sets `background: var(--quil-button-hover)` = `#ffffff` |

## Acceptance (Layer 3)
- Fixed 56px top bar at top of viewport, `#15100d` bg
- Undo/Redo/Preview buttons right-aligned with 8px gap
- Buttons: `#f5f0f0` fill, `#15100d` text, 6px radius
- Preview uses monospace font
- Canvas card maintains 25px gap below nav
- `npm run typecheck` passes; `npm run lint` passes

## Next: Layer 4 — Left AI rail (CLI prompt + variant tray)
