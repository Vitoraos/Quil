// src/ui/primitives/SelectableCard.tsx
// Selectable card (radio or checkbox variant).
// Selected state: pressed card, accent ring, check or dot — never colour alone.

import * as React from 'react'

export type SelectableCardMode = 'radio' | 'checkbox'

interface SelectableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  mode?: SelectableCardMode
  isSelected?: boolean
  isDisabled?: boolean
  onSelect?: () => void
  'aria-checked'?: boolean
  children: React.ReactNode
}

export function SelectableCard({
  mode = 'radio',
  isSelected = false,
  isDisabled = false,
  onSelect,
  className,
  children,
  ...props
}: SelectableCardProps): React.ReactElement {
  const indicator = mode === 'radio' ? (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: '50%',
        border: `2px solid ${isSelected ? 'var(--quil-accent)' : 'var(--quil-line)'}`,
        background: isSelected ? 'var(--quil-accent)' : 'transparent',
        boxShadow: isSelected ? 'var(--quil-shadow-3)' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden="true"
    >
      {isSelected && (
        <div style={{ width: 6, height: 6, background: 'var(--quil-bg)', borderRadius: '50%' }} />
      )}
    </div>
  ) : (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: 'var(--quil-radius-sm)',
        border: `2px solid ${isSelected ? 'var(--quil-accent)' : 'var(--quil-line)'}`,
        background: isSelected ? 'var(--quil-accent)' : 'transparent',
        boxShadow: isSelected ? 'var(--quil-shadow-3)' : undefined,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      aria-hidden="true"
    >
      {isSelected && (
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="var(--quil-bg)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </div>
  )

  return (
    <div
      role={mode === 'radio' ? 'radio' : 'checkbox'}
      aria-checked={isSelected}
      aria-disabled={isDisabled}
      tabIndex={isDisabled ? undefined : 0}
      onClick={isDisabled ? undefined : onSelect}
      onKeyDown={(e) => {
        if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onSelect?.()
        }
      }}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--quil-space-3)',
        padding: 'var(--quil-space-2) var(--quil-space-3)',
        borderRadius: 'var(--quil-radius-sm)',
        border: `1px solid ${isSelected ? 'var(--quil-accent)' : 'var(--quil-line)'}`,
        background: isSelected ? 'var(--quil-surface-hover)' : 'var(--quil-surface)',
        boxShadow: isSelected ? `0 0 0 2px var(--quil-accent)` : 'var(--quil-shadow-3)',
        transform: isDisabled ? 'translateY(var(--quil-press))' : undefined,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        transition: 'border-color var(--quil-duration-press), background-color var(--quil-duration-press)',
      } as React.CSSProperties}
      {...props}
    >
      {indicator}
      {children}
    </div>
  )
}
