import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { ElementId, ProjectState } from '../core'
import { QuilStore } from './store'

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

  const instanceCount = 1

  const meaningful =
    kind === 'section'
      ? [{ kind: 'instance' as const, elementId, label: 'This element only' }]
      : [
          { kind: 'instance' as const, elementId, label: 'This element only (instance)' },
          { kind: 'page' as const, pageId, targetType: kind, label: `This page (${pageCount} ${kind}s)` },
          { kind: 'global' as const, targetType: kind, label: `Everywhere (${globalCount} ${kind}s)` }
        ]

  return (
    <div data-testid="scope-picker" style={{ padding: 8, fontSize: 12 }}>
      <div>Apply <b>{property}</b> to:</div>
      {meaningful.map((scope) => (
        <button
          key={JSON.stringify(scope)}
          data-scope={scope.kind}
          onClick={() => {
            store.dispatch({
              type: 'set_property',
              commandId: `cmd-scope-${Date.now()}` as never,
              baseRev: state.rev,
              targetId: elementId,
              property,
              value: (element.props as Record<string, unknown>)[property],
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
