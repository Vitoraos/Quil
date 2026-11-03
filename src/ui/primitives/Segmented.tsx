// src/ui/primitives/Segmented.tsx
// Segmented control for scope picker: instance / page / global.

import * as React from 'react'

interface SegmentItem {
  value: string
  label: string
  icon?: React.ReactElement
}

interface SegmentedProps {
  items: SegmentItem[]
  value: string
  onChange: (value: string) => void
  isDisabled?: boolean
  className?: string
}

export function Segmented({
  items,
  value,
  onChange,
  isDisabled = false,
  className,
}: SegmentedProps): React.ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label="Scope"
      className={className}
      style={{
        display: 'inline-flex',
        border: `1px solid var(--quil-line)`,
        borderRadius: 'var(--quil-radius-sm)',
        background: 'var(--quil-surface)',
        padding: 'var(--quil-space-0-5)',
      } as React.CSSProperties}
    >
      {items.map((item) => {
        const isActive = item.value === value
        return (
          <button
            key={item.value}
            role="radio"
            aria-checked={isActive}
            type="button"
            onClick={() => onChange(item.value)}
            disabled={isDisabled}
            style={{
              flex: 1,
              padding: `var(--quil-space-1) var(--quil-space-3)`,
              border: '0',
              borderRadius: 'var(--quil-radius-sm)',
              background: isActive ? 'var(--quil-accent)' : 'transparent',
              color: isActive ? 'var(--quil-bg)' : 'var(--quil-text-70)',
              fontSize: 'var(--quil-text-xs)',
              fontWeight: 600,
              fontFamily: 'var(--quil-font-ui)',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              transition: 'background-color var(--quil-duration-press), color var(--quil-duration-press)',
            } as React.CSSProperties}
          >
            {item.icon}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
