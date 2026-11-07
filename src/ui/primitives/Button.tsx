// src/ui/primitives/Button.tsx
// Solid fill button per UI contract: primary uses the button fill with the
// button label colour. Press is subtle (opacity/scale from base.css), not a
// hard 3px mechanical edge.

import * as React from 'react'

export type ButtonVariant = 'primary' | 'neutral'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  isDisabled?: boolean
  isPressed?: boolean
}

export function Button({
  variant = 'primary',
  isDisabled = false,
  isPressed = false,
  className,
  children,
  ...props
}: ButtonProps): React.ReactElement {
  const isPrimary = variant === 'primary'

  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-pressed={isPressed || undefined}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--quil-space-2)',
        padding: `0 var(--quil-space-6)`,
        minHeight: 'var(--quil-target-min)',
        minWidth: 'var(--quil-target-min)',
        border: '0',
        borderRadius: 'var(--quil-radius-sm)',
        background: isPrimary
          ? 'var(--quil-button)'
          : 'color-mix(in oklab, var(--quil-text-100) 78%, var(--quil-bg))',
        color: isPrimary ? 'var(--quil-button-text)' : 'var(--quil-bg)',
        fontWeight: 600,
        fontSize: 'var(--quil-text-sm)',
        lineHeight: 1,
        fontFamily: 'var(--quil-font-ui)',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </button>
  )
}
