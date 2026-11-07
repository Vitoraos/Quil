import type { NodeKind } from '../core'

export type ResizeProperty = 'width' | 'height' | 'padding' | 'radius' | 'fontSize'

export interface ResizeHandle {
  property: ResizeProperty
  edge: 'left' | 'right' | 'top' | 'bottom'
  /** +1 grows the value in the drag direction, -1 shrinks. */
  sign: 1 | -1
  min: number
  max: number
}

const bounds: Record<ResizeProperty, { min: number; max: number }> = {
  width: { min: 1, max: 10000 },
  height: { min: 1, max: 10000 },
  padding: { min: 0, max: 4096 },
  radius: { min: 0, max: 256 },
  fontSize: { min: 1, max: 512 }
}

/**
 * One handle per property, per the kind's schema. No width/height on kinds that
 * do not allow it — resize changes the property the element actually has.
 */
export function resizeHandles(kind: NodeKind): ResizeHandle[] {
  const make = (property: ResizeProperty, edge: ResizeHandle['edge'], sign: 1 | -1): ResizeHandle => ({
    property,
    edge,
    sign,
    ...bounds[property]
  })

  switch (kind) {
    case 'image':
      return [make('width', 'right', 1), make('width', 'left', -1), make('height', 'bottom', 1), make('height', 'top', -1)]
    case 'card':
      return [make('padding', 'right', 1), make('padding', 'left', -1), make('radius', 'bottom', 1)]
    case 'section':
      return [make('padding', 'right', 1), make('padding', 'left', -1)]
    case 'button':
      return [make('radius', 'right', 1)]
    case 'heading':
    case 'text':
      return [make('fontSize', 'bottom', 1)]
    default:
      return []
  }
}

export function clampResize(min: number, max: number, next: number): number {
  if (!Number.isFinite(next)) return min
  return Math.min(Math.max(Math.round(next), min), max)
}

/** CSS property a live preview writes to (document stays untouched until release). */
export function cssPropertyFor(property: ResizeProperty): string {
  switch (property) {
    case 'width':
      return 'width'
    case 'height':
      return 'height'
    case 'padding':
      return 'padding'
    case 'radius':
      return 'border-radius'
    case 'fontSize':
      return 'font-size'
  }
}

/** Numeric value the resize starts from, or null when the props do not carry one. */
export function baseResizeValue(props: Record<string, unknown>, property: ResizeProperty): number | null {
  const raw = props[property]
  if (property === 'padding') {
    const v = raw as { value?: number } | undefined
    return typeof v?.value === 'number' ? v.value : null
  }
  if (property === 'fontSize') {
    const v = raw as { value?: number } | undefined
    return typeof v?.value === 'number' ? v.value : null
  }
  return typeof raw === 'number' ? raw : null
}

/** Candidate props value for a committed resize. */
export function resizeValueFor(property: ResizeProperty, value: number): unknown {
  if (property === 'padding') return { value }
  if (property === 'fontSize') return { value, unit: 'px' }
  return value
}

export type { NodeKind }