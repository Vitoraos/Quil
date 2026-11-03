import * as React from 'react'
import type { ProjectState } from '../core'
import { restoreFromBackup } from '../persistence/migration'

export interface RecoveryScreenProps {
  projectId: string
  error: string
  backup: string | null
  onRetry: () => void
  onExport: (state: ProjectState) => void
  onDismiss: () => void
}

export function RecoveryScreen({
  projectId,
  error,
  backup,
  onRetry,
  onExport,
  onDismiss,
}: RecoveryScreenProps): React.ReactElement {
  const state = backup ? restoreFromBackup(backup) : null

  return (
    <div
      data-testid="recovery-screen"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--quil-bg)',
        color: 'var(--quil-text-100)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--quil-space-4)',
        padding: 'var(--quil-space-6)',
        fontFamily: 'var(--quil-font-ui)',
        zIndex: 100,
      }}
    >
      <h1 id="recovery-title" style={{ fontSize: 'var(--quil-heading-3)', margin: 0, fontFamily: 'var(--quil-font-head)' }}>
        Recovery needed
      </h1>
      <p data-testid="recovery-error" style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', maxWidth: 400, textAlign: 'center' }}>
        {error}
      </p>
      {state && (
        <div style={{ display: 'flex', gap: 'var(--quil-space-2)' }}>
          <button
            data-testid="recovery-retry"
            onClick={onRetry}
            style={{
              padding: 'var(--quil-space-2) var(--quil-space-4)',
              background: 'var(--quil-accent)',
              border: 'none',
              borderRadius: 'var(--quil-radius-sm)',
              color: 'var(--quil-accent-text)',
              fontSize: 'var(--quil-text-sm)',
              fontFamily: 'var(--quil-font-ui)',
              minHeight: 'var(--quil-target-min)',
              cursor: 'pointer',
              boxShadow: 'var(--quil-shadow-3)',
            }}
          >
            Retry
          </button>
          <button
            data-testid="recovery-export"
            onClick={() => onExport(state)}
            style={{
              padding: 'var(--quil-space-2) var(--quil-space-4)',
              background: 'transparent',
              border: `1px solid var(--quil-line)`,
              borderRadius: 'var(--quil-radius-sm)',
              color: 'var(--quil-text-100)',
              fontSize: 'var(--quil-text-sm)',
              fontFamily: 'var(--quil-font-ui)',
              minHeight: 'var(--quil-target-min)',
              cursor: 'pointer',
            }}
          >
            Export project
          </button>
        </div>
      )}
      <button
        data-testid="recovery-dismiss"
        onClick={onDismiss}
        style={{
          padding: 'var(--quil-space-2) var(--quil-space-4)',
          background: 'transparent',
          border: `1px solid var(--quil-line)`,
          borderRadius: 'var(--quil-radius-sm)',
          color: 'var(--quil-text-70)',
          fontSize: 'var(--quil-text-sm)',
          fontFamily: 'var(--quil-font-ui)',
          minHeight: 'var(--quil-target-min)',
          cursor: 'pointer',
        }}
      >
        Dismiss
      </button>
    </div>
  )
}
