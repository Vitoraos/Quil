import type { ElementId, NodeKind } from '../core'
import { elementIdSchema } from '../core'
import type { QuilStore } from './store'

/**
 * Pointer gesture layer. During a gesture the document store is NEVER touched:
 * feedback is written only to the ephemeral gesture layer (inside rAF). On
 * release, exactly ONE coalesced `set_property` (with `gestureId`) is committed
 * through the command bus. Escape / pointercancel / lost capture / blur /
 * window resize abort cleanly with no state change.
 */
interface Gesture {
  pointerId: number
  elementId: ElementId
  property: string | null
  start: number | null
  startX: number
  startY: number
  lastX: number
  ghost: HTMLDivElement | null
  raf: number | null
}

// Must match each property's Zod bounds in core/values + core/elements.
const SCRUB_BOUNDS: Record<string, { min: number; max: number }> = {
  width: { min: 1, max: 10000 },
  height: { min: 1, max: 10000 },
  padding: { min: 0, max: 4096 }
}

/** The one geometric property a horizontal canvas scrub can adjust, per kind. */
function scrubProperty(kind: NodeKind): string | null {
  switch (kind) {
    case 'image':
      return 'width'
    case 'section':
    case 'card':
      return 'padding'
    default:
      return null
  }
}

function baseScrubValue(props: Record<string, unknown>, property: string): number | null {
  const raw = props[property]
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null
}

function clampedScrubValue(property: string, start: number, dx: number): number | null {
  const b = SCRUB_BOUNDS[property]
  if (!b) return null
  return Math.min(Math.max(Math.round(start + dx), b.min), b.max)
}

export function attachGestures(
  root: HTMLElement,
  store: QuilStore,
  getZoom: () => number = () => 1
): () => void {
  let gesture: Gesture | null = null
  let gestureSeq = 0

  function end(commit: boolean, dx: number, dy: number): void {
    const g = gesture
    gesture = null
    if (!g) return
    if (g.raf !== null) {
      cancelAnimationFrame(g.raf)
      g.raf = null
    }
    g.ghost?.remove()
    if (!commit || g.property === null || g.start === null) return
    if (dx === 0 && dy === 0) return
    const value = clampedScrubValue(g.property, g.start, dx / Math.max(getZoom(), 0.25))
    if (value === null) return
    store.dispatch({
      type: 'set_property',
      commandId: `cmd-gesture-${++gestureSeq}` as never,
      baseRev: store.getState().rev,
      targetId: g.elementId,
      property: g.property,
      value,
      gestureId: `gesture-${gestureSeq}` as never
    })
  }

  function paint(): void {
    const g = gesture
    if (!g || g.ghost === null || g.start === null || g.property === null) return
    const projected = clampedScrubValue(g.property, g.start, (g.lastX - g.startX) / Math.max(getZoom(), 0.25))
    g.ghost.textContent = projected === null ? `${g.property} — scrub unavailable` : `${g.property} → ${projected}`
  }

  function schedulePaint(): void {
    const g = gesture
    // shortcut: no live resize preview on the committed element, only the ghost
    // text — upgrade when the renderer exposes per-element gesture transforms.
    if (!g || g.ghost === null || g.raf !== null) return
    g.raf = requestAnimationFrame(() => {
      const current = gesture
      if (!current) return
      current.raf = null
      paint()
    })
  }

  function makeGhost(): HTMLDivElement {
    const layer = root.querySelector('[data-layer="gesture"]')
    const ghost = document.createElement('div')
    ghost.setAttribute('data-gesture-ghost', '')
    ghost.style.cssText =
      'position:absolute;left:8px;top:8px;padding:4px 10px;border-radius:8px;' +
      'outline:2px solid var(--quil-accent, #7C3AED);background:var(--quil-surface, #141418);' +
      'color:var(--quil-text-100, #F5F3EC);font:12px system-ui;'
    ;(layer ?? root).appendChild(ghost)
    return ghost
  }

  function onDown(e: PointerEvent): void {
    if (gesture) return // a gesture is active: primary wins, secondary pointers ignored
    const target = e.target instanceof Element ? e.target.closest('[data-element-id]') : null
    if (!(target instanceof HTMLElement)) return
    const parsedId = elementIdSchema.safeParse(target.getAttribute('data-element-id') ?? '')
    if (!parsedId.success) return
    const element = store.getState().nodes.get(parsedId.data as ElementId)
    if (!element) return

    const property = scrubProperty(element.kind)
    const start = property ? baseScrubValue(element.props, property) : null
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // jsdom (and some browsers) reject capture for unregistered pointer ids; carry on.
    }
    gesture = {
      pointerId: e.pointerId,
      elementId: parsedId.data as ElementId,
      property: start === null ? null : property,
      start,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      ghost: start !== null ? makeGhost() : null,
      raf: null
    }
  }

  function onMove(e: PointerEvent): void {
    const g = gesture
    if (!g || g.pointerId !== e.pointerId) return
    g.lastX = e.clientX
    schedulePaint()
  }

  function onUp(e: PointerEvent): void {
    const g = gesture
    if (!g || g.pointerId !== e.pointerId) return
    end(true, e.clientX - g.startX, e.clientY - g.startY)
  }

  function onCancel(e: PointerEvent): void {
    if (gesture?.pointerId === e.pointerId) end(false, 0, 0)
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && gesture) end(false, 0, 0)
  }

  const abort = (): void => end(false, 0, 0)
  function onLostCapture(e: PointerEvent): void {
    if (gesture?.pointerId === e.pointerId) end(false, 0, 0)
  }

  root.addEventListener('pointerdown', onDown)
  root.addEventListener('pointermove', onMove)
  root.addEventListener('pointerup', onUp)
  root.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
  window.addEventListener('blur', abort)
  window.addEventListener('resize', abort)
  window.addEventListener('lostpointercapture', onLostCapture, true)

  return () => {
    end(false, 0, 0)
    root.removeEventListener('pointerdown', onDown)
    root.removeEventListener('pointermove', onMove)
    root.removeEventListener('pointerup', onUp)
    root.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('blur', abort)
    window.removeEventListener('resize', abort)
    window.removeEventListener('lostpointercapture', onLostCapture, true)
  }
}
