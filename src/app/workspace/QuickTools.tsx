import * as React from 'react'
import type { QuilStore } from '../store'

/**
 * Region E — Quick tools: floating strip below the canvas.
 * Five tools: Select · Frame · Text · Insert · Hand.
 * Select is active by default. The strip stays with the canvas card
 * (in-flow below it, 5px gap) so it never overlaps content.
 *
 * Layer 6 is UI only: tool buttons render and toggle local active state.
 * Command wiring (add_element, set_property, etc.) lands in Layer 8.
 */
export function QuickTools({ store: _store }: { store: QuilStore }): React.ReactElement {
  const [activeTool, setActiveTool] = React.useState<'select' | 'frame' | 'text' | 'insert' | 'hand'>('select')

  const tools: Array<{ id: 'select' | 'frame' | 'text' | 'insert' | 'hand'; label: string; shortcut: string }> = [
    { id: 'select', label: 'Select', shortcut: 'V' },
    { id: 'frame', label: 'Frame', shortcut: '—' },
    { id: 'text', label: 'Text', shortcut: '—' },
    { id: 'insert', label: 'Insert', shortcut: '/' },
    { id: 'hand', label: 'Hand', shortcut: 'H' }
  ]

  const isActive = (id: typeof tools[number]['id']) => activeTool === id

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        paddingTop: 5,
        minHeight: 0
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: 'var(--quil-space-1)',
          background: 'var(--quil-surface)',
          border: 'var(--quil-border-width) solid var(--quil-line)',
          borderRadius: 'var(--quil-radius-md)',
          boxShadow: 'var(--quil-shadow-1)',
          padding: 'var(--quil-space-1)',
          alignItems: 'center'
        }}
      >
        {tools.map((tool) => {
          const active = isActive(tool.id)
          return (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              data-testid={`quick-tool-${tool.id}`}
              aria-pressed={active}
              title={`${tool.label} (${tool.shortcut})`}
              style={{
                minHeight: 'var(--quil-target-icon)',
                minWidth: 'var(--quil-target-icon)',
                padding: `0 ${'var(--quil-space-2)'}`,
                background: active ? 'var(--quil-accent)' : 'var(--quil-surface-hover)',
                color: active ? 'var(--quil-accent-text)' : 'var(--quil-text-100)',
                border: '1px solid var(--quil-line)',
                borderRadius: 'var(--quil-radius-sm)',
                fontSize: 'var(--quil-text-xs)',
                fontFamily: 'var(--quil-font-ui)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--quil-space-1)'
              }}
            >
              {tool.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
