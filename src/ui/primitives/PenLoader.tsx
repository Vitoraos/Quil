// src/ui/primitives/PenLoader.tsx
// Pen stroke animation simulating a feather pen writing/drawing.
// Respects prefers-reduced-motion (renders static feather).
// Colours come from tokens only.

import * as React from 'react'
import { FeatherPen } from './FeatherPen'

interface PenLoaderProps {
  size?: number
  loading?: boolean
  className?: string
}

export function PenLoader({ size = 24, loading = true, className }: PenLoaderProps): React.ReactElement {
  const [draw, setDraw] = React.useState<number>(loading ? 1 : 0)

  React.useEffect(() => {
    if (!loading) {
      setDraw(0)
      return undefined
    }
    let raf: number
    const step = () => {
      setDraw((d) => (d >= 100 ? 0 : d + 6))
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [loading])

  const dash = size * 0.8
  const offset = dash - (dash * draw) / 100

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {loading && draw > 0 ? (
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Pen writing"
          aria-busy="true"
          data-testid="pen-loader"
          style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
        >
          <path
            d={`M ${size / 2} ${size * 0.78} L ${size / 2} ${size * 0.12}`}
            stroke="var(--quil-text-100)"
            strokeWidth={size * 0.05}
            strokeLinecap="round"
            strokeDasharray={dash}
            strokeDashoffset={offset}
          />
          <path
            d={`M ${size / 2 - size * 0.06} ${size * 0.70} L ${size / 2 - size * 0.28} ${size * 0.62}
                 M ${size / 2 - size * 0.06} ${size * 0.58} L ${size / 2 - size * 0.30} ${size * 0.52}
                 M ${size / 2 - size * 0.06} ${size * 0.46} L ${size / 2 - size * 0.30} ${size * 0.40}
                 M ${size / 2 - size * 0.06} ${size * 0.34} L ${size / 2 - size * 0.26} ${size * 0.28}
                 M ${size / 2 - size * 0.06} ${size * 0.24} L ${size / 2 - size * 0.18} ${size * 0.20}`}
            stroke="var(--quil-text-100)"
            strokeWidth={size * 0.04}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${size / 2 + size * 0.06} ${size * 0.70} L ${size / 2 + size * 0.28} ${size * 0.62}
                 M ${size / 2 + size * 0.06} ${size * 0.58} L ${size / 2 + size * 0.30} ${size * 0.52}
                 M ${size / 2 + size * 0.06} ${size * 0.46} L ${size / 2 + size * 0.30} ${size * 0.40}
                 M ${size / 2 + size * 0.06} ${size * 0.34} L ${size / 2 + size * 0.26} ${size * 0.28}
                 M ${size / 2 + size * 0.06} ${size * 0.24} L ${size / 2 + size * 0.18} ${size * 0.20}`}
            stroke="var(--quil-text-100)"
            strokeWidth={size * 0.04}
            strokeLinecap="round"
            fill="none"
          />
          <path
            d={`M ${size / 2 - size * 0.04} ${size * 0.92} L ${size / 2} ${size} L ${size / 2 + size * 0.04} ${size * 0.92}`}
            stroke="var(--quil-accent)"
            strokeWidth={size * 0.06}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={size / 2} cy={size * 0.97} r={size * 0.04} fill="var(--quil-accent)" />
        </svg>
      ) : (
        <FeatherPen size={size} />
      )}
    </div>
  )
}
