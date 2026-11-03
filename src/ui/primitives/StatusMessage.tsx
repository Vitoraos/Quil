// src/ui/primitives/StatusMessage.tsx
// Icon + text status block, aria-live for async status.

import * as React from 'react'

export type StatusVariant = 'default' | 'success' | 'error' | 'warning'

interface StatusMessageProps {
  variant?: StatusVariant
  message: string
  icon?: React.ReactElement
  'aria-live'?: 'polite' | 'assertive' | 'off'
  className?: string
  style?: React.CSSProperties
}

export function StatusMessage({
  variant = 'default',
  message,
  icon,
  'aria-live': ariaLive = 'polite',
  className,
  style,
}: StatusMessageProps): React.ReactElement {
  const color =
    variant === 'success'
      ? 'var(--quil-text-100)'
      : variant === 'error'
        ? 'color-mix(in oklab, var(--quil-text-100) 40%, var(--quil-bg))'
        : variant === 'warning'
          ? 'color-mix(in oklab, var(--quil-text-100) 70%, var(--quil-bg))'
          : 'var(--quil-text-70)'

  return (
    <div
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--quil-space-2)',
        padding: `var(--quil-space-2) var(--quil-space-3)`,
        borderRadius: 'var(--quil-radius-sm)',
        background: 'var(--quil-surface)',
        border: `1px solid var(--quil-line)`,
        color,
        fontSize: 'var(--quil-text-sm)',
        fontFamily: 'var(--quil-font-ui)',
        ...(style ?? {})
      } as React.CSSProperties}
      role="status"
      aria-live={ariaLive}
    >
      {icon}
      <span>{message}</span>
    </div>
  )
}
