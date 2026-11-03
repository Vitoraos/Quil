import * as React from 'react'
import { useSyncExternalStore, useState } from 'react'
import { ZodTypeAny } from 'zod'
import type { ElementId, ElementKind, NodeKind, ProjectState } from '../core'
import { propsSchemas } from '../core/elements'
import { QuilStore } from './store'

function shapeFor(kind: NodeKind): Record<string, ZodTypeAny> | undefined {
  const schema = (propsSchemas as Record<string, ZodTypeAny>)[kind]
  if (!schema || !('shape' in schema)) return undefined
  return schema.shape as Record<string, ZodTypeAny>
}

export function Inspector({
  store,
  elementId
}: {
  store: QuilStore
  elementId: ElementId
}): React.ReactElement {
  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const [error, setError] = useState<string | null>(null)
  const element = state.nodes.get(elementId)
  const kind = element?.kind ?? 'text'
  const fields = shapeFor(kind) ?? {}

  const handleBlur = (property: string, value: string) => {
    setError(null)
    const field = fields[property]
    if (!field || typeof field.safeParse !== 'function') {
      setError(`Property ${property} not allowed for ${kind}`)
      return
    }
    const parsed = field.safeParse(value)
    if (!parsed.success) {
      setError((parsed.error?.issues?.[0]?.message) ?? 'Invalid value')
      return
    }
    const result = store.dispatch({
      type: 'set_property',
      commandId: `cmd-inspector-${Date.now()}` as never,
      baseRev: state.rev,
      targetId: elementId,
      property,
      value: parsed.data
    })
    if (!result.ok) {
      setError(result.error.message)
    }
  }

  if (!element) {
    return <div data-testid="inspector-empty">No element selected</div>
  }

  return (
    <div
      data-testid="inspector"
      style={{ padding: 12, border: '1px solid var(--line, #ccc)', background: 'var(--surface, #fff)' }}
    >
      <div data-testid="inspector-title">{String(element.id)}</div>
      <div data-testid="inspector-kind">{kind}</div>
      {Object.entries(fields).map(([property]) => {
        const current = element.props[property]
        return (
          <div key={property} style={{ marginBottom: 8 }}>
            <label data-testid={`field-label-${property}`}>{property}</label>
            <input
              name={property}
              data-testid={`field-input-${property}`}
              defaultValue={current == null ? '' : String(current)}
              onChange={() => {}}
              onBlur={(e) => handleBlur(property, e.currentTarget.value)}
            />
          </div>
        )
      })}
      {error && (
        <div data-testid="inline-error" style={{ color: '#b00020', fontSize: 12 }}>
          {error}
        </div>
      )}
    </div>
  )
}
