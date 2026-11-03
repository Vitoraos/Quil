// src/ui/primitives/Button.tsx
// Solid fill button per UI contract: label colour is var(--quil-bg),
// mechanical press with hard 3px edge collapsing on :active via translateY(3px).
// Primary uses accent fill; neutral uses monochrome fill.

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
          ? 'var(--quil-accent)'
          : 'color-mix(in oklab, var(--quil-text-100) 78%, var(--quil-bg))',
        color: 'var(--quil-bg)',
        fontWeight: 600,
        fontSize: 'var(--quil-text-sm)',
        lineHeight: 1,
        fontFamily: 'var(--quil-font-ui)',
        boxShadow: `0 var(--quil-press) 0 ${isPrimary ? 'color-mix(in oklab, var(--quil-accent) 65%, var(--quil-bg))' : 'color-mix(in oklab, var(--quil-text-100) 55%, var(--quil-bg))'}`,
        transform: (isDisabled || isPressed) ? 'translateY(var(--quil-press))' : undefined,
        transition: 'transform var(--quil-duration-press) ease-out',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </button>
  )
}
