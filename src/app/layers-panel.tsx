import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { DesignElement, ElementId, PageId, ProjectState } from '../core'
import type { QuilStore } from './store'
import { newCommandId } from './command-id'

interface Row {
  id: ElementId
  depth: number
}

function flatten(state: ProjectState, ids: readonly ElementId[], depth = 0, out: Row[] = []): Row[] {
  for (const id of ids) {
    const node = state.nodes.get(id)
    if (!node) continue
    out.push({ id, depth })
    flatten(state, node.childIds, depth + 1, out)
  }
  return out
}

function labelFor(node: DesignElement): string {
  const props = node.props as Record<string, unknown>
  for (const key of ['text', 'label', 'alt']) {
    const value = props[key]
    if (typeof value === 'string' && value.trim()) return value.length > 32 ? `${value.slice(0, 32)}…` : value
  }
  return node.kind
}

/**
 * Page outline: select an element or move it among its siblings. Reordering is a
 * planned tree edit, so it goes through move_element (one command per move).
 */
export function LayersPanel({
  store,
  pageId,
  selectedId,
  onSelect
}: {
  store: QuilStore
  pageId: PageId | null
  selectedId: ElementId | null
  onSelect: (id: ElementId) => void
}): React.ReactElement {
  const state = useSyncExternalStore(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const page = pageId ? state.pages.get(pageId) : undefined
  const rows = page ? flatten(state, page.sectionIds) : []

  const move = (id: ElementId, delta: -1 | 1): void => {
    const node = state.nodes.get(id)
    if (!node) return
    const siblings = node.parentId ? state.nodes.get(node.parentId)?.childIds : state.pages.get(node.pageId)?.sectionIds
    if (!siblings) return
    const index = siblings.indexOf(id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= siblings.length) return
    store.dispatch({
      type: 'move_element',
      commandId: newCommandId('move') as never,
      baseRev: store.getState().rev,
      elementId: id,
      newParentId: node.parentId,
      index: target
    })
  }

  return (
    <div
      data-testid="layers-panel"
      style={{
        marginBottom: 'var(--quil-space-2)',
        padding: 'var(--quil-space-2)',
        border: '1px solid var(--quil-line)',
        borderRadius: 'var(--quil-radius-sm)',
        background: 'var(--quil-surface)'
      }}
    >
      <div style={{ fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-1)' }}>Layers</div>
      {rows.length === 0 && (
        <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>No elements on this page</div>
      )}
      {rows.map((row) => {
        const node = state.nodes.get(row.id)
        if (!node) return null
        const selected = row.id === selectedId
        return (
          <div
            key={String(row.id)}
            data-testid={`layer-row-${String(row.id)}`}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-1)', paddingLeft: row.depth * 12 }}
          >
            <button
              data-testid={`layer-select-${String(row.id)}`}
              aria-pressed={selected}
              onClick={() => onSelect(row.id)}
              style={{
                flex: 1,
                minHeight: 'var(--quil-target-icon)',
                textAlign: 'left',
                padding: '0 var(--quil-space-1)',
                background: selected ? 'var(--quil-accent)' : 'transparent',
                color: selected ? 'var(--quil-accent-text)' : 'var(--quil-text-100)',
                border: 'none',
                borderRadius: 'var(--quil-radius-sm)',
                fontSize: 'var(--quil-text-xs)',
                cursor: 'pointer'
              }}
            >
              {labelFor(node)}
            </button>
            <button
              data-testid={`layer-up-${String(row.id)}`}
              aria-label={`Move ${node.kind} up`}
              onClick={() => move(row.id, -1)}
              style={miniButton()}
            >
              ↑
            </button>
            <button
              data-testid={`layer-down-${String(row.id)}`}
              aria-label={`Move ${node.kind} down`}
              onClick={() => move(row.id, 1)}
              style={miniButton()}
            >
              ↓
            </button>
          </div>
        )
      })}
    </div>
  )
}

function miniButton(): React.CSSProperties {
  return {
    minHeight: 'var(--quil-target-icon)',
    minWidth: 'var(--quil-target-icon)',
    background: 'var(--quil-surface)',
    color: 'var(--quil-text-100)',
    border: '1px solid var(--quil-line)',
    borderRadius: 'var(--quil-radius-sm)',
    cursor: 'pointer'
  }
}
