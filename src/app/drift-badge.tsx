import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { ElementId, ProjectState } from '../core'
import { QuilStore } from './store'
import { resolveElement } from '../core/decisions'

export function DriftBadge({
  store,
  elementId,
  property,
  currentValue
}: {
  store: QuilStore
  elementId: ElementId
  property: string
  currentValue: unknown
}): React.ReactElement {
  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const element = state.nodes.get(elementId)
  const baseValue = element?.props[property]
  const drifted = baseValue !== currentValue

  // Check if an approved instance decision already governs this property on this element
  let governedByDecision = false
  if (element) {
    const resolved = resolveElement(state, elementId)
    if (resolved.ok) {
      const decId = resolved.result.provenance.get(property)
      if (decId) {
        const dec = state.decisions.get(decId as never)
        governedByDecision = dec?.scope.kind === 'instance' && dec?.scope.elementId === elementId
      }
    }
  }

  if (!drifted && !governedByDecision) {
    return <div data-testid="drift-badge" style={{ display: 'none' }} />
  }

  return (
    <div
      data-testid="drift-badge"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--quil-space-1)',
        padding: 'var(--quil-space-1) var(--quil-space-2)',
        background: 'var(--quil-warning-bg)',
        border: `var(--quil-border-width) solid var(--quil-warning-border)`,
        borderRadius: 'var(--quil-radius-sm)',
        fontSize: 'var(--quil-text-xs)',
        color: 'var(--quil-warning-text)'
      }}
    >
      <span>Drift: hand edit differs from approved decision</span>
      <button data-action="keep-override">Keep as instance override</button>
      <button data-action="propose-decision">Propose changing decision</button>
    </div>
  )
}
