import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { DesignDecision, ProjectState } from '../core'
import type { QuilStore } from './store'

function scopeLabel(decision: DesignDecision): string {
  const scope = decision.scope
  if (scope.kind === 'global') return `Every ${scope.targetType}`
  if (scope.kind === 'page') return `Every ${scope.targetType} on ${scope.pageId}`
  return `This element (${scope.elementId})`
}

function valueLabel(value: unknown): string {
  const shown = typeof value === 'string' ? value : JSON.stringify(value)
  return shown.length > 40 ? `${shown.slice(0, 40)}…` : shown
}

/**
 * Approved decisions are the design system. This list is read-only evidence:
 * changing one goes through the inspector and the approval path, never here.
 */
export function DecisionsPanel({
  store,
  open,
  onOpenChange
}: {
  store: QuilStore
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.ReactElement {
  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const decisions = [...state.decisions.values()].sort((a, b) => b.seq - a.seq)

  return (
    <div style={{ marginBottom: 'var(--quil-space-2)' }}>
      <button
        data-testid="decisions-toggle"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        style={{
          width: '100%',
          minHeight: 'var(--quil-target-min)',
          background: 'var(--quil-accent)',
          color: 'var(--quil-accent-text)',
          border: 'none',
          borderRadius: 'var(--quil-radius-sm)',
          cursor: 'pointer'
        }}
      >
        Decisions ({decisions.filter((d) => d.status === 'approved').length})
      </button>

      {open && (
        <div
          data-testid="decisions-panel"
          style={{
            marginTop: 'var(--quil-space-1)',
            padding: 'var(--quil-space-2)',
            border: '1px solid var(--quil-line)',
            borderRadius: 'var(--quil-radius-sm)',
            background: 'var(--quil-surface)'
          }}
        >
          {decisions.length === 0 && (
            <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
              No decisions approved yet
            </div>
          )}
          {decisions.map((decision) => (
            <div
              key={String(decision.id)}
              data-testid={`decision-row-${String(decision.id)}`}
              data-status={decision.status}
              style={{ marginBottom: 'var(--quil-space-1)', fontSize: 'var(--quil-text-xs)' }}
            >
              <div style={{ color: 'var(--quil-text-100)' }}>
                {decision.property}: {valueLabel(decision.value)}
              </div>
              <div data-testid={`decision-scope-${String(decision.id)}`} style={{ color: 'var(--quil-text-70)' }}>
                {scopeLabel(decision)}
              </div>
              <div data-testid={`decision-status-${String(decision.id)}`} style={{ color: 'var(--quil-text-70)' }}>
                {decision.status}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
