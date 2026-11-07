import * as React from 'react'
import { TopBar } from './TopBar'
import { CanvasCol } from './CanvasCol'
import { AIRail } from './AIRail'
import { DesignRiley } from './DesignRiley'
import type { QuilStore } from '../store'

export function Shell({ store }: { store: QuilStore }): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--quil-bg)',
        color: 'var(--quil-text-100)',
        fontFamily: 'var(--quil-font-ui)',
        margin: 0,
      }}
    >
      <TopBar />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '305px 1fr 300px',
          gap: 20,
          height: '100%',
          overflow: 'hidden',
          paddingTop: 56,
        }}
      >
        <AIRail />
        <CanvasCol store={store} />
        <DesignRiley store={store} />
      </div>
    </div>
  )
}
