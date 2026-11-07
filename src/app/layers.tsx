import * as React from 'react'

export const Layers = React.forwardRef<HTMLDivElement, { className?: string; children?: React.ReactNode; overlay?: React.ReactNode }>(
  (props, ref) => (
  <div
    ref={ref}
    className={props.className ?? 'quil-layers'}
    style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: 'var(--bg, #ECECE8)'
    }}
  >
    {/* Layer 1: committed content */}
    <div
      data-layer="committed"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0
      }}
    >
      {props.children}
    </div>
    {/* Layer 2: selection + handles overlay (never re-renders content) */}
    <div
      data-layer="selection"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 10,
        pointerEvents: 'none'
      }}
    >
      {props.overlay}
    </div>
    {/* Layer 3: ephemeral gesture layer */}
    <div
      data-layer="gesture"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 20,
        pointerEvents: 'none'
      }}
    />
  </div>
))

Layers.displayName = 'Layers'
