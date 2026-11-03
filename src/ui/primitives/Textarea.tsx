// src/ui/primitives/Textarea.tsx

import * as React from 'react'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  maxLength?: number
  error?: string
  rows?: number
}

export function Textarea({
  maxLength = 4096,
  error,
  rows = 4,
  className,
  ...props
}: TextareaProps): React.ReactElement {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--quil-space-1)',
      } as React.CSSProperties}
    >
      <textarea
        maxLength={maxLength}
        rows={rows}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoCapitalize="none"
        style={{
          minHeight: 'var(--quil-target-min)',
          padding: 'var(--quil-space-3)',
          borderRadius: 'var(--quil-radius-sm)',
          border: `1px solid ${error ? 'color-mix(in oklab, var(--quil-text-100) 40%, var(--quil-bg))' : 'var(--quil-line)'}`,
          background: 'var(--quil-surface)',
          color: 'var(--quil-text-100)',
          fontSize: 'var(--quil-text-base)',
          fontFamily: 'var(--quil-font-ui)',
          outline: 'none',
          resize: 'vertical',
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
