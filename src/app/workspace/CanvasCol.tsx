import * as React from 'react'
import type { QuilStore } from '../store'
import { CanvasCard } from './CanvasCard'
import { QuickTools } from './QuickTools'

export function CanvasCol({ store }: { store: QuilStore }): React.ReactElement {
  return (
    <div
      className="quil-canvas-col"
      style={{
        flex: 1,
        paddingTop: 81,    /* 56px nav + 25px top spacing */
        paddingBottom: 65, /* 65px bottom spacing */
        minHeight: 0,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: 5, /* spacing between canvas card and quick tools strip */
      }}
    >
      <CanvasCard />
      <QuickTools store={store} />
    </div>
  )
}
