import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { ElementId } from '../core'
import type { QuilStore } from './store'
import { newCommandId } from './command-id'
import { colourSwatches, colourTargets, contrastForCandidate, type ColourProperty } from './colour'

/**
 * Colour group for the selected element: approved decision colours first, then neutrals,
 * with live contrast for the candidate. One swatch click = one command.
 */
export function ColourPicker({
  store,
  elementId,
  open,
  onOpenChange
}: {
  store: QuilStore
  elementId: ElementId
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.ReactElement | null {
  const state = useSyncExternalStore(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const element = state.nodes.get(elementId)
  const targets = element ? colourTargets(element.kind) : []
  const [active, setActive] = React.useState<ColourProperty>(targets[0]?.property ?? 'color')
  const [error, setError] = React.useState<string | null>(null)

  if (!element || targets.length === 0) return null

  const property = targets.some((t) => t.property === active) ? active : targets[0]!.property
  const current = element.props[property]
  const currentValue = typeof current === 'string' ? current : undefined
  const swatches = colourSwatches(state)

  const apply = (value: string): void => {
    setError(null)
    const result = store.dispatch({
      type: 'set_property',
      commandId: newCommandId('colour'),
      baseRev: store.getState().rev,
      targetId: elementId,
      property,
      value
    })
    if (!result.ok) {
      setError(result.error.message)
      return
    }
    onOpenChange(false)
  }

  const contrast = currentValue ? contrastForCandidate(state, elementId, property, currentValue) : null

  return (
    <div data-testid="colour-picker" style={{ padding: 'var(--quil-space-2) 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-2)' }}>
        <button
          data-testid="colour-toggle"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--quil-space-2)', minHeight: 'var(--quil-target-icon)', background: 'transparent', border: 'none', color: 'var(--quil-text-100)', cursor: 'pointer' }}
        >
          <span
            aria-hidden="true"
            data-testid="colour-swatch-current"
            style={{
              width: 20,
              height: 20,
              borderRadius: 'var(--quil-radius-sm)',
              border: '1px solid var(--quil-line)',
              background: currentValue ?? 'transparent'
            }}
          />
          <span style={{ fontSize: 'var(--quil-text-sm)' }}>Colour</span>
        </button>
        {targets.length > 1 &&
          targets.map((t) => (
            <button
              key={t.property}
              data-testid={`colour-target-${t.property}`}
              aria-pressed={t.property === property}
              onClick={() => setActive(t.property)}
              style={{
                minHeight: 'var(--quil-target-icon)',
                padding: '0 var(--quil-space-2)',
                background: t.property === property ? 'var(--quil-accent)' : 'var(--quil-surface)',
                color: t.property === property ? 'var(--quil-accent-text)' : 'var(--quil-text-100)',
                border: '1px solid var(--quil-line)',
                borderRadius: 'var(--quil-radius-sm)',
                fontSize: 'var(--quil-text-xs)',
                cursor: 'pointer'
              }}
            >
              {t.label}
            </button>
          ))}
      </div>

      {open && (
        <div data-testid="colour-panel" style={{ marginTop: 'var(--quil-space-2)', padding: 'var(--quil-space-2)', border: '1px solid var(--quil-line)', borderRadius: 'var(--quil-radius-sm)', background: 'var(--quil-surface)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--quil-space-1)' }}>
            {swatches.map((s) => (
              <button
                key={s.value}
                data-testid={`colour-swatch-${s.value}`}
                data-approved={s.approved ? 'true' : 'false'}
                aria-label={`${s.value}${s.approved ? ' (approved)' : ''}`}
                onClick={() => apply(s.value)}
                style={{
                  width: 'var(--quil-target-icon)',
                  height: 'var(--quil-target-icon)',
                  borderRadius: 'var(--quil-radius-sm)',
                  border: s.value === currentValue ? '2px solid var(--quil-accent)' : '1px solid var(--quil-line)',
                  background: s.value,
                  cursor: 'pointer'
                }}
              />
            ))}
          </div>
          {contrast && (
            <div data-testid="colour-contrast" style={{ marginTop: 'var(--quil-space-2)', fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
              {contrast.ratio.toFixed(1)}:1 {contrast.passes ? 'passes AA' : 'below AA'}
            </div>
          )}
          {error && (
            <div data-testid="colour-error" role="alert" style={{ marginTop: 'var(--quil-space-1)', fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}