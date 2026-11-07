import * as React from 'react'
import { useEffect, useRef } from 'react'
import type { ElementId, NodeKind } from '../core'
import { boxFor } from './overlay-box'
import { resizeHandles } from './resize'

function writeBox(node: HTMLElement | null, box: { left: number; top: number; width: number; height: number } | null): void {
  if (!node) return
  if (!box) {
    node.style.display = 'none'
    return
  }
  node.style.display = 'block'
  node.style.left = `${box.left}px`
  node.style.top = `${box.top}px`
  node.style.width = `${box.width}px`
  node.style.height = `${box.height}px`
}

/** Selection outline + hover outline. Writes straight to the overlay layer so canvas content never re-renders. */
export function SelectionOverlay({
  rootRef,
  selectedId,
  kind,
  rev,
  getZoom
}: {
  rootRef: React.RefObject<HTMLDivElement | null>
  selectedId: ElementId | null
  kind?: NodeKind | null
  rev: number
  getZoom: () => number
}): React.ReactElement {
  const selectionRef = useRef<HTMLDivElement>(null)
  const hoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const measure = (): void => {
      if (!selectedId) {
        writeBox(selectionRef.current, null)
        return
      }
      const el = root.querySelector(`[data-element-id="${String(selectedId)}"]`)
      writeBox(selectionRef.current, el ? boxFor(root, el, getZoom()) : null)
    }

    measure()
    const el = selectedId ? root.querySelector(`[data-element-id="${String(selectedId)}"]`) : null
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (ro) {
      ro.observe(root)
      if (el) ro.observe(el)
    }
    document.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      ro?.disconnect()
      document.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [selectedId, rev, rootRef, getZoom])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onMove = (e: PointerEvent): void => {
      const target = e.target instanceof Element ? e.target.closest('[data-element-id]') : null
      writeBox(hoverRef.current, target ? boxFor(root, target, getZoom()) : null)
    }
    const onLeave = (): void => writeBox(hoverRef.current, null)
    root.addEventListener('pointermove', onMove)
    root.addEventListener('pointerleave', onLeave)
    return () => {
      root.removeEventListener('pointermove', onMove)
      root.removeEventListener('pointerleave', onLeave)
    }
  }, [rootRef, getZoom])

  return (
    <>
      <div
        ref={hoverRef}
        data-testid="hover-outline"
        aria-hidden="true"
        style={{
          position: 'absolute',
          display: 'none',
          pointerEvents: 'none',
          outline: '1px solid var(--quil-line)',
          borderRadius: 'var(--quil-radius-sm)'
        }}
      />
      <div
        ref={selectionRef}
        data-testid="selection-outline"
        data-selected-id={selectedId ? String(selectedId) : ''}
        data-resize-element={selectedId ? String(selectedId) : ''}
        aria-hidden="true"
        style={{
          position: 'absolute',
          display: 'none',
          pointerEvents: 'none',
          outline: '2px solid var(--quil-accent)',
          borderRadius: 'var(--quil-radius-sm)'
        }}
      >
        {selectedId && kind
          ? resizeHandles(kind).map((handle) => (
              <span
                key={`${handle.property}-${handle.edge}`}
                data-resize-property={handle.property}
                data-handle-edge={handle.edge}
                data-handle-sign={handle.sign}
                data-testid={`resize-handle-${handle.property}-${handle.edge}`}
                role="button"
                aria-label={`Resize ${handle.property}`}
                style={{
                  position: 'absolute',
                  pointerEvents: 'auto',
                  background: 'var(--quil-accent)',
                  border: '1px solid var(--quil-surface)',
                  borderRadius: 2,
                  ...(handle.edge === 'left' && { left: -6, top: '50%', width: 10, height: 24, transform: 'translateY(-50%)', cursor: 'ew-resize' }),
                  ...(handle.edge === 'right' && { right: -6, top: '50%', width: 10, height: 24, transform: 'translateY(-50%)', cursor: 'ew-resize' }),
                  ...(handle.edge === 'top' && { top: -6, left: '50%', width: 24, height: 10, transform: 'translateX(-50%)', cursor: 'ns-resize' }),
                  ...(handle.edge === 'bottom' && { bottom: -6, left: '50%', width: 24, height: 10, transform: 'translateX(-50%)', cursor: 'ns-resize' })
                }}
              />
            ))
          : null}
      </div>
    </>
  )
}