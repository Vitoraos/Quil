// src/ui/primitives/Badge.tsx

import * as React from 'react'

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'accent' | 'success' | 'error'
}

export function Badge({
  variant = 'default',
  className,
  children,
  ...props
}: BadgeProps): React.ReactElement {
  const bg =
    variant === 'accent'
      ? 'var(--quil-accent)'
      : variant === 'success'
        ? 'color-mix(in oklab, var(--quil-text-100) 12%, var(--quil-bg))'
        : variant === 'error'
          ? 'color-mix(in oklab, var(--quil-text-100) 12%, var(--quil-bg))'
          : 'var(--quil-surface-hover)'
  const color =
    variant === 'accent' ? 'var(--quil-bg)' : 'var(--quil-text-100)'

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: `0 var(--quil-space-1)`,
        minHeight: 'var(--quil-target-icon)',
        borderRadius: 'var(--quil-radius-sm)',
        background: bg,
        color,
        fontSize: 'var(--quil-text-xs)',
        fontWeight: 600,
        fontFamily: 'var(--quil-font-ui)',
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </span>
  )
}
