import type { ElementId, NodeKind, ProjectState } from '../core'
import { resolveElement } from '../core/decisions'
import { contrastRatioCore } from '../core/generation'
import { colorRegex } from '../core/values'

export type ColourProperty = 'bgColor' | 'color' | 'textColor'

export interface ColourTarget {
  property: ColourProperty
  label: string
}

/** Which colour properties the inspector may offer for a kind. Images carry none. */
export function colourTargets(kind: NodeKind): ColourTarget[] {
  switch (kind) {
    case 'heading':
    case 'text':
      return [{ property: 'color', label: 'Text' }]
    case 'button':
      return [
        { property: 'bgColor', label: 'Fill' },
        { property: 'textColor', label: 'Text' }
      ]
    case 'card':
    case 'section':
    case 'navigation':
    case 'form':
      return [{ property: 'bgColor', label: 'Background' }]
    default:
      return []
  }
}

/** Nearest background colour walking up the tree. */
export function bgColorFor(state: ProjectState, elementId: ElementId): string | undefined {
  let cur = state.nodes.get(elementId)
  while (cur) {
    const c = cur.props.bgColor
    if (typeof c === 'string') return c
    cur = cur.parentId ? state.nodes.get(cur.parentId) : undefined
  }
  return undefined
}

/** Neutral seeds. User designs are not chrome, so these are plain swatches, not tokens. */
const seedColours = ['#111113', '#1C1C20', '#2A2A30', '#4A4A52', '#7A7A84', '#B8B8BE', '#ECECE8', '#FFFFFF']

export function approvedColours(state: ProjectState): string[] {
  const seen = new Set<string>()
  for (const decision of state.decisions.values()) {
    if (decision.status !== 'approved') continue
    if (decision.property !== 'bgColor' && decision.property !== 'color' && decision.property !== 'textColor') continue
    if (typeof decision.value === 'string' && colorRegex.test(decision.value)) seen.add(decision.value)
  }
  return [...seen]
}

export function colourSwatches(state: ProjectState): Array<{ value: string; approved: boolean }> {
  const approved = approvedColours(state)
  const seen = new Set(approved)
  return [
    ...approved.map((value) => ({ value, approved: true })),
    ...seedColours.filter((value) => !seen.has(value)).map((value) => ({ value, approved: false }))
  ]
}

/** Contrast of a candidate colour against whatever sits behind/inside it. */
export function contrastForCandidate(
  state: ProjectState,
  elementId: ElementId,
  property: ColourProperty,
  candidate: string
): { ratio: number; passes: boolean } {
  const element = state.nodes.get(elementId)
  const resolved = resolveElement(state, elementId)
  const props = resolved.ok ? resolved.result.props : element?.props ?? {}

  const fallbackBg = '#111113'
  const fallbackFg = '#ECECE8'

  const foreground = property === 'textColor' || property === 'color'
    ? candidate
    : (typeof props.textColor === 'string' ? props.textColor : typeof props.color === 'string' ? props.color : fallbackFg)
  const background = property === 'bgColor' ? candidate : (bgColorFor(state, elementId) ?? fallbackBg)

  const ratio = contrastRatioCore(foreground, background)
  return { ratio, passes: ratio >= 4.5 }
}