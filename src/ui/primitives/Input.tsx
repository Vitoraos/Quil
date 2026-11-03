// src/ui/primitives/Input.tsx
// Text input: length-capped, renders untrusted text as text nodes only.

import * as React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  maxLength?: number
  error?: string
}

export function Input({
  maxLength = 256,
  error,
  className,
  ...props
}: InputProps): React.ReactElement {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--quil-space-1)',
      } as React.CSSProperties}
    >
      <input
        type="text"
        maxLength={maxLength}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoCapitalize="none"
        style={{
          minHeight: 'var(--quil-target-min)',
          padding: `0 var(--quil-space-3)`,
          borderRadius: 'var(--quil-radius-sm)',
          border: `1px solid ${error ? 'color-mix(in oklab, var(--quil-text-100) 40%, var(--quil-bg))' : 'var(--quil-line)'}`,
          background: 'var(--quil-surface)',
          color: 'var(--quil-text-100)',
          fontSize: 'var(--quil-text-base)',
          fontFamily: 'var(--quil-font-ui)',
          outline: 'none',
        } as React.CSSProperties}
        {...props}
      />
      {error && (
        <span style={{ fontSize: 'var(--quil-text-xs)', color: 'color-mix(in oklab, var(--quil-text-100) 40%, var(--quil-bg))' }}>
          {error}
        </span>
      )}
    </div>
  )
}
