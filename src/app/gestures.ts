import type { ElementId } from '../core'
import { elementIdSchema } from '../core'
import type { QuilStore } from './store'
import { newCommandId } from './command-id'
import { baseResizeValue, clampResize, cssPropertyFor, resizeHandles, resizeValueFor, type ResizeProperty } from './resize'

/**
 * Handle-driven resize layer. During a drag the commit is written to the element's own
 * inline style (ephemeral, never the document); on release ONE coalesced set_property
 * is dispatched. Escape / pointercancel / lost capture / blur / resize abort and restore.
 */
interface ResizeGesture {
  pointerId: number
  elementId: ElementId
  property: ResizeProperty
  sign: 1 | -1
  min: number
  max: number
  start: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  target: HTMLElement
  restoreValue: string
  restorePriority: string
  raf: number | null
  applied: boolean
}

function deltaFor(property: ResizeProperty, dx: number, dy: number, sign: 1 | -1): number {
  const axis = property === 'height' || property === 'fontSize' ? dy : dx
  return Math.round(axis * sign)
}

export function attachGestures(
  root: HTMLElement,
  store: QuilStore,
  getZoom: () => number = () => 1
): () => void {
  let gesture: ResizeGesture | null = null
  let gestureSeq = 0

  function restore(g: ResizeGesture): void {
    if (!g.applied) return
    const css = cssPropertyFor(g.property)
    // Put back whatever React had written; removing it would drop the prop's style.
    if (g.restoreValue) g.target.style.setProperty(css, g.restoreValue, g.restorePriority)
    else g.target.style.removeProperty(css)
    g.applied = false
  }

  function end(commit: boolean): void {
    const g = gesture
    gesture = null
    if (!g) return
    if (g.raf !== null) {
      cancelAnimationFrame(g.raf)
      g.raf = null
    }
    const zoom = Math.max(getZoom(), 0.25)
    const value = clampResize(
      g.min,
      g.max,
      g.start + deltaFor(g.property, (g.lastX - g.startX) / zoom, (g.lastY - g.startY) / zoom, g.sign)
    )
    restore(g)
    if (!commit || value === g.start) return
    store.dispatch({
      type: 'set_property',
      commandId: newCommandId('resize'),
      baseRev: store.getState().rev,
      targetId: g.elementId,
      property: g.property,
      value: resizeValueFor(g.property, value),
      gestureId: `gesture-${gestureSeq}` as never
    })
  }

  function preview(g: ResizeGesture, value: number): void {
    g.target.style.setProperty(cssPropertyFor(g.property), `${value}px`)
    g.applied = true
  }

  function schedule(g: ResizeGesture, dx: number, dy: number): void {
    if (g.raf !== null) return
    g.raf = requestAnimationFrame(() => {
      if (gesture !== g) return
      g.raf = null
      const next = clampResize(g.min, g.max, g.start + deltaFor(g.property, dx, dy, g.sign))
      preview(g, next)
    })
  }

  function onDown(e: PointerEvent): void {
    if (gesture) return // primary wins, secondary pointers ignored
    const handle = e.target instanceof Element ? e.target.closest('[data-resize-property]') : null
    if (!handle) return
    const holder = handle.closest('[data-resize-element]')
    if (!(holder instanceof HTMLElement)) return
    const parsedId = elementIdSchema.safeParse(holder.getAttribute('data-resize-element') ?? '')
    if (!parsedId.success) return
    const target = root.querySelector(`[data-element-id="${String(parsedId.data)}"]`)
    if (!(target instanceof HTMLElement)) return
    const element = store.getState().nodes.get(parsedId.data as ElementId)
    if (!element) return

    const property = handle.getAttribute('data-resize-property') as ResizeProperty | null
    if (!property) return
    const edge = handle.getAttribute('data-handle-edge')
    const spec = resizeHandles(element.kind).find((h) => h.property === property && h.edge === edge)
    if (!spec) return
    const start = baseResizeValue(element.props, property)
    if (start === null) return

    try {
      ;(handle as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // jsdom rejects capture for unregistered pointer ids; carry on.
    }
    gestureSeq += 1
    gesture = {
      pointerId: e.pointerId,
      elementId: parsedId.data as ElementId,
      property,
      sign: spec.sign,
      min: spec.min,
      max: spec.max,
      start,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      target,
      restoreValue: target.style.getPropertyValue(cssPropertyFor(property)),
      restorePriority: target.style.getPropertyPriority(cssPropertyFor(property)),
      raf: null,
      applied: false
    }
  }

  function onMove(e: PointerEvent): void {
    const g = gesture
    if (!g || g.pointerId !== e.pointerId) return
    g.lastX = e.clientX
    g.lastY = e.clientY
    const zoom = Math.max(getZoom(), 0.25)
    schedule(g, (e.clientX - g.startX) / zoom, (e.clientY - g.startY) / zoom)
  }

  function onUp(e: PointerEvent): void {
    const g = gesture
    if (!g || g.pointerId !== e.pointerId) return
    g.lastX = e.clientX
    g.lastY = e.clientY
    end(true)
  }

  function onCancel(e: PointerEvent): void {
    if (gesture?.pointerId === e.pointerId) end(false)
  }

  function onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && gesture) end(false)
  }

  const abort = (): void => end(false)
  function onLostCapture(e: PointerEvent): void {
    if (gesture?.pointerId === e.pointerId) end(false)
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
    end(false)
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