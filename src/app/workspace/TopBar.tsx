import * as React from 'react'

export function TopBar(): React.ReactElement {
  return (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 56,
        background: 'var(--quil-bg)',
        borderBottom: 'var(--quil-border-width) solid var(--quil-line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingRight: 'var(--quil-space-6)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--quil-space-2)',
        }}
      >
        <button
          title="Undo"
          style={{
            background: 'var(--quil-button)',
            border: 'none',
            color: 'var(--quil-button-text)',
            cursor: 'pointer',
            padding: 'var(--quil-space-1) var(--quil-space-3)',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-base)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ↶
        </button>
        <button
          title="Redo"
          style={{
            background: 'var(--quil-button)',
            border: 'none',
            color: 'var(--quil-button-text)',
            cursor: 'pointer',
            padding: 'var(--quil-space-1) var(--quil-space-3)',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-base)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ↷
        </button>
        <button
          title="Preview"
          style={{
            background: 'var(--quil-button)',
            border: 'none',
            color: 'var(--quil-button-text)',
            cursor: 'pointer',
            padding: 'var(--quil-space-1) var(--quil-space-3)',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-base)',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--quil-font-mono)',
            letterSpacing: '0.2px',
          }}
        >
          Preview
        </button>
      </div>
    </header>
  )
}
