import * as React from 'react'
import { useSyncExternalStore, useState } from 'react'
import { ZodTypeAny } from 'zod'
import type { ElementId, NodeKind, ProjectState } from '../core'
import { propsSchemas } from '../core/elements'
import { applicableDecisions } from '../core/decisions/resolver'
import type { QuilStore } from './store'
import { newCommandId } from './command-id'
import { colourSwatches, colourTargets } from './colour'

type Control =
  | { control: 'text' }
  | { control: 'number'; unit?: boolean }
  | { control: 'select'; options: string[] }
  | { control: 'segmented'; options: string[] }
  | { control: 'readonly' }
  | { control: 'colour' }

const fieldSpecs: Record<string, Control> = {
  text: { control: 'text' },
  label: { control: 'text' },
  alt: { control: 'text' },
  submitLabel: { control: 'text' },
  level: { control: 'select', options: ['1', '2', '3', '4', '5', '6'] },
  fontSize: { control: 'number', unit: true },
  fontWeight: { control: 'segmented', options: ['400', '500', '600', '700', '800'] },
  lineHeight: { control: 'number' },
  align: { control: 'segmented', options: ['left', 'center', 'right', 'justify'] },
  padding: { control: 'number', unit: true },
  radius: { control: 'number', unit: true },
  shadow: { control: 'select', options: ['shadow-1', 'shadow-2', 'shadow-3'] },
  fit: { control: 'select', options: ['cover', 'contain', 'fill'] },
  width: { control: 'number', unit: true },
  height: { control: 'number', unit: true },
  items: { control: 'readonly' },
  fields: { control: 'readonly' },
  assetId: { control: 'readonly' },
  bgColor: { control: 'colour' },
  color: { control: 'colour' },
  textColor: { control: 'colour' }
}

const groups = [
  { id: 'content', label: 'Content' },
  { id: 'colour', label: 'Colour' },
  { id: 'type', label: 'Type' },
  { id: 'space', label: 'Space and shape' }
] as const

function groupOf(property: string): (typeof groups)[number]['id'] {
  if (['text', 'label', 'alt', 'level', 'submitLabel', 'assetId', 'items', 'fields'].includes(property)) return 'content'
  if (['fontSize', 'fontWeight', 'lineHeight', 'align'].includes(property)) return 'type'
  return 'space'
}

function shapeFor(kind: NodeKind): Record<string, ZodTypeAny> | undefined {
  const schema = (propsSchemas as Record<string, ZodTypeAny>)[kind]
  if (!schema || !('shape' in schema)) return undefined
  return schema.shape as Record<string, ZodTypeAny>
}

/** Strip a stored value down to what the field shows. */
function displayValue(property: string, value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (property === 'fontSize' || property === 'padding') {
    const v = value as { value?: number }
    return v?.value == null ? '' : String(v.value)
  }
  return ''
}

/** Build the candidate value the schema expects, then parse it. */
function buildValue(property: string, raw: string, unit: 'px' | 'rem'): unknown {
  if (property === 'fontSize') return { value: Number(raw), unit }
  if (property === 'padding') return { value: Number(raw) }
  if (['radius', 'lineHeight', 'width', 'height'].includes(property)) return Number(raw)
  if (property === 'level') return Number(raw)
  if (property === 'fontWeight') return Number(raw)
  return raw
}

function labelFor(node: { props: Record<string, unknown>; kind: NodeKind }): string {
  const props = node.props as Record<string, unknown>
  for (const key of ['text', 'label', 'alt']) {
    const value = props[key]
    if (typeof value === 'string' && value.trim()) return value.length > 32 ? `${value.slice(0, 32)}…` : value
  }
  return node.kind
}

function originFor(kind: NodeKind): string {
  switch (kind) {
    case 'heading':
    case 'text':
    case 'button':
    case 'card':
    case 'image':
    case 'navigation':
    case 'form':
      return 'element'
    case 'section':
      return 'frame'
    default:
      return 'element'
  }
}

/** Colour swatch row: approved colours first (✓), then neutral seeds, then custom '+'. */
function ColourSwatchRow({
  store,
  elementId,
  property,
  activeValue,
  onApply
}: {
  store: QuilStore
  elementId: ElementId
  property: 'bgColor' | 'color' | 'textColor'
  activeValue: string | undefined
  onApply: (value: string) => void
}): React.ReactElement {
  const state = useSyncExternalStore(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const swatches = colourSwatches(state)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--quil-space-1)' }}>
      {swatches.map((swatch) => {
        const isActive = swatch.value === activeValue
        const border = isActive
          ? `2px solid var(--quil-accent)`
          : `1px solid var(--quil-line)`
        return (
          <button
            key={swatch.value}
            onClick={() => onApply(swatch.value)}
            style={{
              width: '20px',
              height: '20px',
              background: swatch.value,
              border,
              borderRadius: 'var(--quil-radius-sm)',
              cursor: 'pointer',
              boxSizing: 'border-box',
              opacity: swatch.approved ? 1 : 0.7
            }}
            title={`${swatch.value} ${swatch.approved ? '(approved)' : ''}`}
          />
        )
      })}
      <button
        onClick={() => onApply('')}
        style={{
          width: '20px',
          height: '20px',
          background: 'var(--quil-surface)',
          border: `1px dashed var(--quil-line)`,
          borderRadius: 'var(--quil-radius-sm)',
          cursor: 'pointer',
          color: 'var(--quil-text-70)',
          fontSize: 'var(--quil-text-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 600
        }}
        title="Custom colour"
      >
        +
      </button>
    </div>
  )
}

export function Inspector({
  store,
  elementId
}: {
  store: QuilStore
  elementId: ElementId
}): React.ReactElement {
  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const element = state.nodes.get(elementId)
  const kind = element?.kind ?? 'text'
  const fields = shapeFor(kind) ?? {}

  if (!element) {
    return (
      <div data-testid="inspector-empty" style={{ padding: 'var(--quil-space-4)', color: 'var(--quil-text-70)' }}>
        No element selected
      </div>
    )
  }

  const applicable = applicableDecisions(state, element)
  const decisionsCount = applicable.length

  const toggle = (group: string): void => {
    const next = { ...collapsed, [group]: !collapsed[group] }
    setCollapsed(next)
  }

  const commit = (property: string, value: unknown): boolean => {
    setError(null)
    const field = fields[property]
    const parsed = field?.safeParse(value)
    if (!parsed || !parsed.success) {
      setError((parsed?.error?.issues?.[0]?.message as string | undefined) ?? 'Invalid value')
      return false
    }
    const result = store.dispatch({
      type: 'set_property',
      commandId: newCommandId('inspector'),
      baseRev: store.getState().rev,
      targetId: elementId,
      property,
      value: parsed.data
    })
    if (!result.ok) {
      setError(result.error.message)
      return false
    }
    return true
  }

  const renderField = (property: string): React.ReactNode => {
    const spec = fieldSpecs[property]
    if (!spec) return null
    const value = (element.props as Record<string, unknown>)[property]
    const shown = displayValue(property, value)

    if (spec.control === 'readonly') {
      const count = Array.isArray(value) ? `${value.length} item(s)` : shown || 'not set'
      return (
        <div key={property} data-testid={`field-readonly-${property}`} style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
          {count}
        </div>
      )
    }

    if (spec.control === 'segmented') {
      return (
        <div key={property} data-testid={`field-${property}`} style={{ display: 'flex', gap: 2 }}>
          {spec.options.map((option) => (
            <button
              key={option}
              data-testid={`field-${property}-${option}`}
              aria-pressed={shown === option}
              onClick={() => commit(property, buildValue(property, option, 'px'))}
              style={{
                minHeight: 'var(--quil-target-icon)',
                minWidth: 'var(--quil-target-icon)',
                padding: '0 var(--quil-space-1)',
                background: shown === option ? 'var(--quil-accent)' : 'var(--quil-surface)',
                color: shown === option ? 'var(--quil-accent-text)' : 'var(--quil-text-100)',
                border: '1px solid var(--quil-line)',
                borderRadius: 'var(--quil-radius-sm)',
                fontSize: 'var(--quil-text-xs)',
                cursor: 'pointer'
              }}
            >
              {option}
            </button>
          ))}
        </div>
      )
    }

    if (spec.control === 'select') {
      return (
        <select
          key={property}
          data-testid={`field-${property}`}
          value={shown}
          onChange={(e) => commit(property, buildValue(property, e.currentTarget.value, 'px'))}
          style={{ minHeight: 'var(--quil-target-icon)', background: 'var(--quil-surface)', color: 'var(--quil-text-100)', border: '1px solid var(--quil-line)', borderRadius: 'var(--quil-radius-sm)' }}
        >
          <option value="">—</option>
          {spec.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      )
    }

    if (spec.control === 'colour') {
      const current = typeof value === 'string' ? value : undefined
      return (
        <div key={property} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-1)' }}>
          <label
            data-testid={`field-label-${property}`}
            style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', display: 'flex', alignItems: 'center', gap: 'var(--quil-space-1)' }}
          >
            {property}{decisionsCount > 0 && ` <span style={{ color: 'var(--quil-text-90)', fontSize: 'var(--quil-text-xs)' }}>(from decisions)</span>`}
          </label>
          <ColourSwatchRow
            store={store}
            elementId={elementId}
            property={property as 'bgColor' | 'color' | 'textColor'}
            activeValue={current}
            onApply={(v) => commit(property, v)}
          />
        </div>
      )
    }

    const unit = (value as { unit?: 'px' | 'rem' } | undefined)?.unit ?? 'px'
    return (
      <div key={`${property}-${shown}-${unit}`} style={{ display: 'flex', gap: 'var(--quil-space-1)', alignItems: 'center' }}>
        <input
          name={property}
          data-testid={`field-input-${property}`}
          defaultValue={shown}
          inputMode={spec.control === 'number' ? 'decimal' : 'text'}
          onBlur={(e) => commit(property, buildValue(property, e.currentTarget.value, unit))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          style={{ minHeight: 'var(--quil-target-icon)', width: '100%', background: 'var(--quil-surface)', color: 'var(--quil-text-100)', border: '1px solid var(--quil-line)', borderRadius: 'var(--quil-radius-sm)', padding: '0 var(--quil-space-1)' }}
        />
        {spec.control === 'number' && spec.unit && <span style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>{unit}</span>}
      </div>
    )
  }

  const propertiesByGroup = Object.keys(fields).reduce<Record<string, string[]>>((acc, property) => {
    const spec = fieldSpecs[property]
    if (!spec || spec.control === 'colour') return acc
    const group = groupOf(property)
    ;(acc[group] ??= []).push(property)
    return acc
  }, {})

  const hasColourProps = colourTargets(kind).length > 0

  return (
    <div
      data-testid="inspector"
      style={{
        padding: 'var(--quil-space-2)',
        border: '1px solid var(--quil-line)',
        background: 'var(--quil-surface)',
        borderRadius: 'var(--quil-radius-md)',
        boxShadow: 'var(--quil-shadow-3)',
        overflowY: 'auto',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Selection header: kind badge + name + origin */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--quil-space-2)',
          paddingBottom: 'var(--quil-space-2)',
          borderBottom: 'var(--quil-border-width) solid var(--quil-line)',
          marginBottom: 'var(--quil-space-2)'
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--quil-space-1)',
            padding: '0 var(--quil-space-1)',
            background: 'var(--quil-accent-soft)',
            color: 'var(--quil-accent-text)',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-xs)',
            fontFamily: 'var(--quil-font-mono)',
            fontWeight: 600
          }}
        >
          {kind}
        </span>
        <span
          style={{
            fontSize: 'var(--quil-text-sm)',
            color: 'var(--quil-text-100)',
            fontFamily: 'var(--quil-font-ui)',
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0
          }}
        >
          {labelFor(element)}
        </span>
        <span
          style={{
            fontSize: 'var(--quil-text-xs)',
            color: 'var(--quil-text-80)',
            fontFamily: 'var(--quil-font-ui)'
          }}
        >
          {originFor(kind)}
        </span>
        {decisionsCount > 0 && (
          <span
            style={{
              fontSize: 'var(--quil-text-xs)',
              color: 'var(--quil-accent)',
              fontFamily: 'var(--quil-font-mono)',
              fontWeight: 600,
              marginLeft: 'auto'
            }}
          >
            ✦ {decisionsCount} decision{decisionsCount !== 1 ? 's' : ''}
          </span>
        )}
      </header>

      {groups.map((group) => {
        if (group.id === 'colour') {
          if (!hasColourProps) return null
          const isCollapsed = collapsed[group.id] === true
          return (
            <section key={group.id} data-testid={`inspector-group-${group.id}`} style={{ marginTop: 'var(--quil-space-2)', borderTop: '1px solid var(--quil-line)', paddingTop: 'var(--quil-space-2)' }}>
              <button
                data-testid={`inspector-toggle-${group.id}`}
                aria-expanded={!isCollapsed}
                onClick={() => toggle(group.id)}
                style={{ display: 'flex', width: '100%', justifyContent: 'space-between', minHeight: 'var(--quil-target-icon)', background: 'transparent', border: 'none', color: 'var(--quil-text-100)', fontSize: 'var(--quil-text-sm)', cursor: 'pointer' }}
              >
                <span>{group.label}</span>
                <span aria-hidden="true">{isCollapsed ? '+' : '−'}</span>
              </button>
              {!isCollapsed && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-1)' }}>
                  {colourTargets(kind).map((target) => (
                    <div key={target.property} style={{ marginBottom: 'var(--quil-space-1)' }}>
                      <label
                        data-testid={`field-label-${target.property}`}
                        style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', display: 'block', marginBottom: 'var(--quil-space-1)' }}
                      >
                        {target.label}
                      </label>
                      <ColourSwatchRow
                        store={store}
                        elementId={elementId}
                        property={target.property}
                        activeValue={(element.props as Record<string, unknown>)[target.property] as string | undefined}
                        onApply={(v) => commit(target.property, v)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )
        }
        const props = propertiesByGroup[group.id] ?? []
        if (props.length === 0) return null
        const isCollapsed = collapsed[group.id] === true
        return (
          <section key={group.id} data-testid={`inspector-group-${group.id}`} style={{ marginTop: 'var(--quil-space-2)', borderTop: '1px solid var(--quil-line)', paddingTop: 'var(--quil-space-2)' }}>
            <button
              data-testid={`inspector-toggle-${group.id}`}
              aria-expanded={!isCollapsed}
              onClick={() => toggle(group.id)}
              style={{ display: 'flex', width: '100%', justifyContent: 'space-between', minHeight: 'var(--quil-target-icon)', background: 'transparent', border: 'none', color: 'var(--quil-text-100)', fontSize: 'var(--quil-text-sm)', cursor: 'pointer' }}
            >
              <span>{group.label}</span>
              <span aria-hidden="true">{isCollapsed ? '+' : '−'}</span>
            </button>
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-1)' }}>
                {props.map((property) => (
                  <label key={property} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span data-testid={`field-label-${property}`} style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
                      {property}
                    </span>
                    {renderField(property)}
                  </label>
                ))}
              </div>
            )}
          </section>
        )
      })}

      {decisionsCount > 0 && (
        <section
          data-testid="inspector-decisions"
          style={{
            marginTop: 'var(--quil-space-2)',
            padding: 'var(--quil-space-2)',
            background: 'var(--quil-accent-soft)',
            borderRadius: 'var(--quil-radius-sm)',
            border: '1px solid var(--quil-accent-soft)'
          }}
        >
          <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-1)' }}>
            Decisions applied to this element
          </div>
          <div style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-100)', fontWeight: 600 }}>
            {decisionsCount} scoped decision{decisionsCount !== 1 ? 's' : ''} govern this element's appearance
          </div>
        </section>
      )}

      {error && (
        <div data-testid="inline-error" role="alert" style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-xs)', marginTop: 'var(--quil-space-1)' }}>
          {error}
        </div>
      )}

      {/* Duplicate / Delete footer */}
      <footer
        style={{
          marginTop: 'var(--quil-space-2)',
          paddingTop: 'var(--quil-space-2)',
          borderTop: 'var(--quil-border-width) solid var(--quil-line)',
          display: 'flex',
          gap: 'var(--quil-space-1)'
        }}
      >
        <button
          data-testid="inspector-duplicate"
          onClick={() => {
            store.dispatch({
              type: 'batch',
              commandId: newCommandId('duplicate'),
              baseRev: store.getState().rev,
              commands: [
                {
                  type: 'add_element',
                  commandId: newCommandId('duplicate-add'),
                  baseRev: store.getState().rev,
                  elementId: `dup-${elementId}` as ElementId,
                  parentId: element.parentId,
                  kind: element.kind,
                  props: { ...element.props }
                }
              ]
            })
          }}
          style={{
            flex: 1,
            minHeight: 'var(--quil-target-icon)',
            background: 'transparent',
            border: '1px solid var(--quil-line)',
            borderRadius: 'var(--quil-radius-sm)',
            color: 'var(--quil-text-100)',
            fontSize: 'var(--quil-text-xs)',
            fontFamily: 'var(--quil-font-ui)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--quil-space-1)'
          }}
        >
          <span>Duplicate</span>
        </button>
        <button
          data-testid="inspector-delete"
          onClick={() => {
            store.dispatch({
              type: 'remove_element',
              commandId: newCommandId('delete'),
              baseRev: store.getState().rev,
              elementId
            })
          }}
          style={{
            minHeight: 'var(--quil-target-icon)',
            minWidth: 'var(--quil-target-icon)',
            background: 'transparent',
            border: '1px solid var(--quil-line)',
            borderRadius: 'var(--quil-radius-sm)',
            color: 'var(--quil-warn)',
            fontSize: 'var(--quil-text-xs)',
            fontFamily: 'var(--quil-font-ui)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ✕
        </button>
      </footer>
    </div>
  )
}
