import * as React from 'react'
import type { QuilStore } from './store'

export function ReadOnlyBanner({ store }: { store: QuilStore }): React.ReactElement | null {
  if (store.isLeader()) return null

  return (
    <div
      data-testid="read-only-banner"
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 'var(--quil-space-2) var(--quil-space-4)',
        background: 'var(--quil-accent-hover)',
        color: 'var(--quil-accent-text)',
        fontSize: 'var(--quil-text-xs)',
        fontFamily: 'var(--quil-font-ui)',
        borderBottom: `1px solid var(--quil-line)`,
      }}
    >
      <span style={{ fontSize: 'var(--quil-text-base)' }}>🔒</span>
      <span>This project is open for editing in another tab. You are viewing read-only.</span>
    </div>
  )
}
