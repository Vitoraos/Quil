import * as React from 'react'
import { useEffect, useState } from 'react'

export interface PaletteAction {
  id: string
  label: string
  run: () => void
}

/** Subsequence match: "zn" finds "Zoom in". Empty query matches everything. */
export function fuzzyMatch(label: string, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  let index = 0
  for (const char of label.toLowerCase()) {
    if (char === needle[index]) index += 1
    if (index === needle.length) return true
  }
  return false
}

/** Cmd/Ctrl+K palette: filters a fixed allowlist of editor actions. */
export function CommandPalette({
  open,
  actions,
  onClose
}: {
  open: boolean
  actions: PaletteAction[]
  onClose: () => void
}): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
    }
  }, [open])

  if (!open) return null
  const matches = actions.filter((a) => fuzzyMatch(a.label, query))
  const run = (action: PaletteAction | undefined): void => {
    if (!action) return
    onClose()
    action.run()
  }

  return (
    <div
      data-testid="command-palette"
      role="dialog"
      aria-label="Command palette"
      style={{
        position: 'fixed',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(420px, 90vw)',
        zIndex: 100,
        padding: 'var(--quil-space-2)',
        border: '1px solid var(--quil-line)',
        borderRadius: 'var(--quil-radius-sm)',
        background: 'var(--quil-surface)',
        boxShadow: 'var(--quil-shadow-3)'
      }}
    >
      <input
        data-testid="palette-input"
        aria-label="Search commands"
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.currentTarget.value)
          setActive(0)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, matches.length - 1))
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            run(matches[active])
          }
        }}
        style={{
          width: '100%',
          minHeight: 'var(--quil-target-min)',
          padding: '0 var(--quil-space-2)',
          background: 'var(--quil-bg)',
          color: 'var(--quil-text-100)',
          border: '1px solid var(--quil-line)',
          borderRadius: 'var(--quil-radius-sm)'
        }}
      />
      <div style={{ marginTop: 'var(--quil-space-1)', maxHeight: 280, overflow: 'auto' }}>
        {matches.length === 0 && (
          <div style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)', padding: 'var(--quil-space-1)' }}>
            No matching command
          </div>
        )}
        {matches.map((action, index) => (
          <button
            key={action.id}
            data-testid={`palette-action-${action.id}`}
            aria-current={index === active}
            onClick={() => run(action)}
            style={{
              display: 'block',
              width: '100%',
              minHeight: 'var(--quil-target-min)',
              textAlign: 'left',
              padding: '0 var(--quil-space-2)',
              background: index === active ? 'var(--quil-accent)' : 'transparent',
              color: index === active ? 'var(--quil-accent-text)' : 'var(--quil-text-100)',
              border: 'none',
              borderRadius: 'var(--quil-radius-sm)',
              cursor: 'pointer'
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
