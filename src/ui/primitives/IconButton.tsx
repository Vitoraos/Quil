// src/ui/primitives/IconButton.tsx
// 40px square icon-only button, solid fill.

import * as React from 'react'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactElement
  isDisabled?: boolean
  isPressed?: boolean
}

export function IconButton({
  icon,
  isDisabled = false,
  isPressed = false,
  className,
  ...props
}: IconButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `0 var(--quil-space-2)`,
        minWidth: 'var(--quil-target-icon)',
        minHeight: 'var(--quil-target-icon)',
        border: '0',
        borderRadius: 'var(--quil-radius-sm)',
        background: 'var(--quil-surface)',
        color: 'var(--quil-text-100)',
        fontSize: 'var(--quil-text-sm)',
        boxShadow: `0 var(--quil-press) 0 color-mix(in oklab, var(--quil-text-100) 55%, var(--quil-bg))`,
        transform: (isDisabled || isPressed) ? 'translateY(var(--quil-press))' : undefined,
        transition: 'transform var(--quil-duration-press) ease-out',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      } as React.CSSProperties}
      {...props}
    >
      {icon}
    </button>
  )
}
