/**
 * Viewport panning for the canvas scroller. Active only in hand mode or while Space
 * is held; captured so a pan never starts a selection or a resize.
 */
export function attachPan(root: HTMLElement, isActive: () => boolean): () => void {
  let start: { x: number; y: number; left: number; top: number; pointerId: number } | null = null

  const down = (e: PointerEvent): void => {
    if (!isActive()) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    start = { x: e.clientX, y: e.clientY, left: root.scrollLeft, top: root.scrollTop, pointerId: e.pointerId }
    try {
      root.setPointerCapture(e.pointerId)
    } catch {
      // jsdom rejects capture for unregistered pointer ids; carry on.
    }
  }

  const move = (e: PointerEvent): void => {
    if (!start || e.pointerId !== start.pointerId) return
    e.stopPropagation()
    const left = start.left - (e.clientX - start.x)
    const top = start.top - (e.clientY - start.y)
    // jsdom reports 0 for layout sizes; only clamp when the browser knows the extent.
    const maxLeft = root.scrollWidth - root.clientWidth
    const maxTop = root.scrollHeight - root.clientHeight
    root.scrollLeft = maxLeft > 0 ? Math.min(Math.max(left, 0), maxLeft) : left
    root.scrollTop = maxTop > 0 ? Math.min(Math.max(top, 0), maxTop) : top
  }

  const up = (e: PointerEvent): void => {
    if (!start || e.pointerId !== start.pointerId) return
    e.stopPropagation()
    start = null
    try {
      root.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
  }

  root.addEventListener('pointerdown', down, true)
  root.addEventListener('pointermove', move, true)
  root.addEventListener('pointerup', up, true)
  root.addEventListener('pointercancel', up, true)

  return () => {
    start = null
    root.removeEventListener('pointerdown', down, true)
    root.removeEventListener('pointermove', move, true)
    root.removeEventListener('pointerup', up, true)
    root.removeEventListener('pointercancel', up, true)
  }
}
