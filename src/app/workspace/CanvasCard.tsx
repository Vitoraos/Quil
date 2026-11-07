import * as React from 'react'

export function CanvasCard(): React.ReactElement {
  return (
    <div
      className="quil-canvas-card"
      style={{
        width: 'calc(100vw - 620px)',
        minHeight: '100%',
        maxWidth: 1200,
        background: 'var(--quil-canvas-bg)',
        border: 'var(--quil-border-width) solid var(--quil-line)',
        borderRadius: 'var(--quil-radius-xs)',
        boxShadow: 'var(--quil-shadow-3)',
        overflowY: 'auto',
        margin: '0 auto',
        position: 'relative',
      }}
    />
  )
}
