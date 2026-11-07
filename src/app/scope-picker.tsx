import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { ElementId, ProjectState } from '../core'
import { QuilStore } from './store'
import { newCommandId } from './command-id'
import { resolveElement } from '../core/decisions/resolver'

export function ScopePicker({
  store,
  elementId,
  property
}: {
  store: QuilStore
  elementId: ElementId
  property: string
}): React.ReactElement {
  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const element = state.nodes.get(elementId)
  if (!element) return <div data-testid="scope-picker-empty">No element selected</div>

  // Count affected elements per scope choice for this property
  let pageCount = 0
  let globalCount = 0
  const kind = element.kind
  const pageId = element.pageId
  for (const node of state.nodes.values()) {
    if (node.kind === kind) {
      globalCount++
      if (node.pageId === pageId) pageCount++
    }
  }

  const meaningful =
    kind === 'section'
      ? [{ kind: 'instance' as const, elementId, label: 'This element only' }]
      : [
          { kind: 'instance' as const, elementId, label: 'This element only (instance)' },
          { kind: 'page' as const, pageId, targetType: kind, label: `This page (${pageCount} ${kind}s)` },
          { kind: 'global' as const, targetType: kind, label: `Everywhere (${globalCount} ${kind}s)` }
        ]

  return (
    <div data-testid="scope-picker" style={{ padding: 'var(--quil-space-2)', fontSize: 'var(--quil-text-xs)' }}>
      <div>Apply <b>{property}</b> to:</div>
      {meaningful.map((scope) => (
        <button
          key={JSON.stringify(scope)}
          data-scope={scope.kind}
          onClick={() => {
            // Resolve the current value for this property so the dispatched
            // decision carries the resolved (not base) value. This ensures a
            // scope change preserves the user's current visual state.
            const resolved = resolveElement(state, elementId)
            const resolvedValue = resolved.ok
              ? resolved.result.props[property]
              : (element.props as Record<string, unknown>)[property]
            store.dispatch({
              type: 'set_property',
              commandId: newCommandId('scope'),
              baseRev: state.rev,
              targetId: elementId,
              property,
              value: resolvedValue,
              scope: scope as never
            })
          }}
        >
          {scope.label}
        </button>
      ))}
      <div data-testid="affected-count">{meaningful.length} scope choice(s)</div>
    </div>
  )
}
