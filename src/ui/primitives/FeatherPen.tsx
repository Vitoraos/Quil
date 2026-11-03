// src/ui/primitives/FeatherPen.tsx
// Quil logo feather pen: minimal SVG of a quill feather used to write in
// old days. Feather body in --quil-text-100, pen nib in --quil-accent.
// Decorative (aria-hidden); never conveys state by colour alone.

import * as React from 'react'

interface FeatherPenProps {
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function FeatherPen({ size = 24, className, style }: FeatherPenProps): React.ReactElement {
  const cx = size / 2

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-testid="feather-pen"
      className={className}
      style={style}
    >
      {/* Quill calamus (hollow base) -- feather body colour */}
      <path
        d={`M ${cx} ${size * 0.78} L ${cx - size * 0.12} ${size * 0.92} L ${cx + size * 0.12} ${size * 0.92} Z`}
        stroke="var(--quil-text-100)"
        strokeWidth={size * 0.05}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Central rachis (shaft) -- feather body colour */}
      <path
        d={`M ${cx} ${size * 0.78} L ${cx} ${size * 0.12}`}
        stroke="var(--quil-text-100)"
        strokeWidth={size * 0.05}
        strokeLinecap="round"
      />
      {/* Barbs on left side -- feather body colour */}
      <path
        d={`M ${cx - size * 0.06} ${size * 0.70} L ${cx - size * 0.28} ${size * 0.62}
             M ${cx - size * 0.06} ${size * 0.58} L ${cx - size * 0.30} ${size * 0.52}
             M ${cx - size * 0.06} ${size * 0.46} L ${cx - size * 0.30} ${size * 0.40}
             M ${cx - size * 0.06} ${size * 0.34} L ${cx - size * 0.26} ${size * 0.28}
             M ${cx - size * 0.06} ${size * 0.24} L ${cx - size * 0.18} ${size * 0.20}`}
        stroke="var(--quil-text-100)"
        strokeWidth={size * 0.04}
        strokeLinecap="round"
        fill="none"
      />
      {/* Barbs on right side -- feather body colour */}
      <path
        d={`M ${cx + size * 0.06} ${size * 0.70} L ${cx + size * 0.28} ${size * 0.62}
             M ${cx + size * 0.06} ${size * 0.58} L ${cx + size * 0.30} ${size * 0.52}
             M ${cx + size * 0.06} ${size * 0.46} L ${cx + size * 0.30} ${size * 0.40}
             M ${cx + size * 0.06} ${size * 0.34} L ${cx + size * 0.26} ${size * 0.28}
             M ${cx + size * 0.06} ${size * 0.24} L ${cx + size * 0.18} ${size * 0.20}`}
        stroke="var(--quil-text-100)"
        strokeWidth={size * 0.04}
        strokeLinecap="round"
        fill="none"
      />
      {/* Pen nib / writing tip -- accent colour */}
      <path
        d={`M ${cx - size * 0.04} ${size * 0.92} L ${cx} ${size} L ${cx + size * 0.04} ${size * 0.92}`}
        stroke="var(--quil-accent)"
        strokeWidth={size * 0.06}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ink drop / writing point -- accent colour */}
      <circle
        cx={cx}
        cy={size * 0.97}
        r={size * 0.04}
        fill="var(--quil-accent)"
      />
    </svg>
  )
}
