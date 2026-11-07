import * as React from 'react'
import { useState, useSyncExternalStore } from 'react'
import type { ElementId, PageId } from '../core'
import type { QuilStore } from './store'
import { newCommandId, newId } from './command-id'
import { defaultPropsFor, insertableKinds, insertParent } from './element-ops'

/**
 * Insert menu (opened with /). Adds one element of an allowlisted kind to the
 * nearest container; the command bus validates the props before anything changes.
 */
export function InsertMenu({
  store,
  pageId,
  selectedId,
  open,
  onOpenChange,
  onInserted
}: {
  store: QuilStore
  pageId: PageId | null
  selectedId: ElementId | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onInserted?: (id: ElementId) => void
}): React.ReactElement | null {
  const state = useSyncExternalStore(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const [error, setError] = useState<string | null>(null)

  if (!open) return null
  const parentId = insertParent(state, selectedId, pageId)

  const insert = (kind: (typeof insertableKinds)[number]): void => {
    setError(null)
    if (!parentId) {
      setError('Add a section before inserting elements')
      return
    }
    const props = defaultPropsFor(kind, state)
    if (!props) {
      setError(`No asset available for ${kind}`)
      return
    }
    const elementId = newId('el') as ElementId
    const result = store.dispatch({
      type: 'add_element',
      commandId: newCommandId('insert') as never,
      baseRev: store.getState().rev,
      elementId,
      parentId,
      kind,
      props
    })
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    onOpenChange(false)
    onInserted?.(elementId)
  }

  const insertSection = (): void => {
    setError(null)
    if (!pageId) {
      setError('No page to add a section to')
      return
    }
    const sectionId = newId('el') as ElementId
    const result = store.dispatch({
      type: 'add_section',
      commandId: newCommandId('insert') as never,
      baseRev: store.getState().rev,
      sectionId,
      pageId,
      props: { padding: { value: 48 } }
    })
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    onOpenChange(false)
    onInserted?.(sectionId)
  }

  return (
    <div
      data-testid="insert-menu"
      style={{
        marginBottom: 'var(--quil-space-2)',
        padding: 'var(--quil-space-2)',
        border: '1px solid var(--quil-line)',
        borderRadius: 'var(--quil-radius-sm)',
        background: 'var(--quil-surface)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--quil-space-2)' }}>
        <span style={{ fontSize: 'var(--quil-text-sm)' }}>Insert element</span>
        <button
          data-testid="insert-close"
          aria-label="Close insert menu"
          onClick={() => onOpenChange(false)}
          style={{
            minHeight: 'var(--quil-target-icon)',
            minWidth: 'var(--quil-target-icon)',
            background: 'var(--quil-surface)',
            color: 'var(--quil-text-100)',
            border: '1px solid var(--quil-line)',
            borderRadius: 'var(--quil-radius-sm)',
            cursor: 'pointer'
          }}
        >
          ×
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--quil-space-1)' }}>
        {insertableKinds.map((kind) => {
          const unavailable = kind === 'image' && state.assets.size === 0
          return (
            <button
              key={kind}
              data-testid={`insert-kind-${kind}`}
              disabled={unavailable}
              title={unavailable ? 'Add an image asset first' : undefined}
              onClick={() => insert(kind)}
              style={{
                minHeight: 'var(--quil-target-min)',
                padding: '0 var(--quil-space-2)',
                background: unavailable ? 'var(--quil-surface)' : 'var(--quil-accent)',
                color: unavailable ? 'var(--quil-text-70)' : 'var(--quil-accent-text)',
                border: unavailable ? '1px solid var(--quil-line)' : 'none',
                borderRadius: 'var(--quil-radius-sm)',
                cursor: unavailable ? 'not-allowed' : 'pointer'
              }}
            >
              {kind}
            </button>
          )
        })}
        <button
          data-testid="insert-kind-section"
          onClick={insertSection}
          style={{
            minHeight: 'var(--quil-target-min)',
            padding: '0 var(--quil-space-2)',
            background: 'var(--quil-surface)',
            color: 'var(--quil-text-100)',
            border: '1px solid var(--quil-line)',
            borderRadius: 'var(--quil-radius-sm)',
            cursor: 'pointer'
          }}
        >
          section
        </button>
      </div>
      {error && (
        <div data-testid="insert-error" role="alert" style={{ marginTop: 'var(--quil-space-1)', fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
          {error}
        </div>
      )}
    </div>
  )
}
