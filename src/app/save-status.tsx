import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { QuilStore } from './store'

export function SaveStatus({ store }: { store: QuilStore }): React.ReactElement {
  const status = useSyncExternalStore<'saved' | 'saving' | 'unsaved' | 'error'>(
    (cb) => store.onSaveStatus(cb),
    () => store.getSaveStatus()
  )

  const config: Record<'saved' | 'saving' | 'unsaved' | 'error', { label: string; color: string }> = {
    saved: { label: 'Saved', color: 'var(--quil-text-70)' },
    saving: { label: 'Saving…', color: 'var(--quil-accent)' },
    unsaved: { label: 'Unsaved changes', color: 'var(--quil-accent-hover)' },
    error: { label: 'Save error', color: 'var(--quil-text-70)' },
  }

  const c = config[status]

  return (
    <div
      data-testid="save-status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px',
        borderRadius: 'var(--quil-radius-sm)',
        background: 'var(--quil-surface)',
        border: `1px solid ${c.color}`,
        color: c.color,
        fontSize: 'var(--quil-text-xs)',
        fontFamily: 'var(--quil-font-ui)',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: status === 'saved' ? 'var(--quil-text-70)' : status === 'error' ? 'var(--quil-text-70)' : c.color,
        }}
      />
      <span>{c.label}</span>
    </div>
  )
}
