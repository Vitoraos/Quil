// src/ui/primitives/Card.tsx
// Card: 10px radius, surface colour, 3px shadow token.

import * as React from 'react'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean
}

export function Card({ padded = false, className, children, ...props }: CardProps): React.ReactElement {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--quil-radius-md)',
        background: 'var(--quil-surface)',
        boxShadow: 'var(--quil-shadow-3)',
        padding: padded ? 'var(--quil-space-4)' : undefined,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </div>
  )
}
