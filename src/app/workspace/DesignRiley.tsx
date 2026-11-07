import * as React from 'react'
import { useSyncExternalStore, useState } from 'react'
import type { ElementId, PageId, ProjectState } from '../../core'
import type { QuilStore } from '../store'
import { LayersPanel } from '../layers-panel'
import { Inspector } from '../inspector'

/**
 * Region C — Design rail (right column, 300–340px).
 *
 * Stage-aware: in the design stage it shows the design tree (top ≈40%)
 * and the inspector (bottom ≈60%). In intake stages (Layer 9+) the same
 * rail swaps to the Intake Dock. With nothing selected the inspector
 * shows screen-level properties + spec coverage instead of element props.
 *
 * Nothing in this rail generates content — it only edits what exists.
 */
export function DesignRiley({ store }: { store: QuilStore }): React.ReactElement {
  const [collapsed, setCollapsed] = useState(false)
  const [selectedId, setSelectedId] = useState<ElementId | null>(null)

  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )

  const pageId = state.pages.size > 0 ? (Array.from(state.pages.keys())[0] as PageId) : null

  return (
    <aside
      style={{
        width: 300,
        minWidth: 300,
        background: 'var(--quil-surface)',
        borderLeft: 'var(--quil-border-width) solid var(--quil-line)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        minHeight: 0,
      }}
    >
      {/* Rail header — collapsible to a ~40px bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--quil-space-3) var(--quil-space-4)',
          borderBottom: 'var(--quil-border-width) solid var(--quil-line)',
          background: 'var(--quil-surface-hover)',
          minHeight: 'var(--quil-target-icon)',
        }}
      >
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--quil-space-1)',
            background: 'transparent',
            border: 'none',
            color: 'var(--quil-text-100)',
            fontSize: 'var(--quil-text-sm)',
            fontFamily: 'var(--quil-font-ui)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.2px',
            cursor: 'pointer',
          }}
        >
          <span>Design tree</span>
          <span aria-hidden="true">{collapsed ? '▾' : '▴'}</span>
        </button>
      </header>

      {!collapsed ? (
        <div
          style={{
            flex: 1,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Design tree — top ≈40% of rail height */}
          <div
            style={{
              flex: '0 0 40%',
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            <LayersPanel
              store={store}
              pageId={pageId}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </div>
          {/* Inspector — bottom ≈60% of rail height */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            }}
          >
            {selectedId ? (
              <Inspector store={store} elementId={selectedId} />
            ) : (
              <div
                style={{
                  padding: 'var(--quil-space-4)',
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-xs)',
                  fontFamily: 'var(--quil-font-ui)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--quil-space-1)',
                  height: '100%',
                  minHeight: 0
                }}
              >
                <span>No element selected</span>
                <span>Screen: {pageId ?? '—'}</span>
                <span>Click an element on canvas or in the tree</span>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  )
}
