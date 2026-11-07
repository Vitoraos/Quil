import * as React from 'react'
import { CanvasCard } from './CanvasCard'

export function CanvasCol(): React.ReactElement {
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
        justifyContent: 'center',
      }}
    >
      <CanvasCard />
    </div>
  )
}
