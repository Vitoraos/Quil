import * as React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ElementId } from '../core'
import { textValue } from '../core/values'
import type { QuilStore } from './store'
import { newCommandId } from './command-id'
import { boxFor } from './overlay-box'

const editableKinds = ['heading', 'text', 'button'] as const
type EditableKind = (typeof editableKinds)[number]

export function isTextEditable(kind: string): kind is EditableKind {
  return (editableKinds as readonly string[]).includes(kind)
}

function textProperty(kind: EditableKind): 'text' | 'label' {
  return kind === 'button' ? 'label' : 'text'
}

/**
 * In-place text editing. Lives in the overlay layer so the committed element is never
 * mutated directly: typing stays local, one coalesced set_property is dispatched on
 * Enter or blur, Escape commits nothing.
 */
export function TextEditor({
  rootRef,
  elementId,
  store,
  getZoom,
  onDone
}: {
  rootRef: React.RefObject<HTMLDivElement | null>
  elementId: ElementId
  store: QuilStore
  getZoom: () => number
  onDone: (committed: boolean) => void
}): React.ReactElement | null {
  const element = store.getState().nodes.get(elementId)
  const kind = element?.kind
  const editable = kind !== undefined && isTextEditable(kind)
  const property = editable ? textProperty(kind) : 'text'
  const [value, setValue] = useState(String(element?.props[property] ?? ''))
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [box, setBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const doneRef = useRef(false)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || !editable) return
    const el = root.querySelector(`[data-element-id="${String(elementId)}"]`)
    setBox(el ? boxFor(root, el, getZoom()) : null)
    const measure = (): void => {
      const target = root.querySelector(`[data-element-id="${String(elementId)}"]`)
      setBox(target ? boxFor(root, target, getZoom()) : null)
    }
    document.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      document.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [rootRef, elementId, editable, getZoom])

  useEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.focus()
    input.select()
  }, [])

  if (!editable || !element) return null

  const finish = (commit: boolean): void => {
    if (doneRef.current) return
    doneRef.current = true
    if (!commit) {
      onDone(false)
      return
    }
    const parsed = textValue.safeParse(value)
    if (!parsed.success) {
      setError('Text contains characters Quil does not allow')
      doneRef.current = false
      return
    }
    if (parsed.data !== String(element.props[property] ?? '')) {
      store.dispatch({
        type: 'set_property',
        commandId: newCommandId('text'),
        baseRev: store.getState().rev,
        targetId: elementId,
        property,
        value: parsed.data
      })
    }
    onDone(true)
  }

  const resolved = element.props as Record<string, unknown>
  const fontSize = resolved.fontSize as { value?: number; unit?: string } | undefined

  return (
    <div style={{ position: 'absolute', left: box?.left ?? 0, top: box?.top ?? 0, width: Math.max(box?.width ?? 200, 120), pointerEvents: 'auto', zIndex: 30 }}>
      <textarea
        ref={inputRef}
        data-testid="text-editor"
        aria-label="Edit text"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            finish(false)
          }
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            finish(true)
          }
        }}
        onBlur={() => finish(true)}
        rows={1}
        style={{
          width: '100%',
          minHeight: Math.max(box?.height ?? 24, 24),
          padding: '2px 4px',
          background: 'var(--quil-surface)',
          color: 'var(--quil-text-100)',
          border: '1px solid var(--quil-accent)',
          borderRadius: 'var(--quil-radius-sm)',
          fontFamily: 'var(--quil-font-ui)',
          fontSize: fontSize?.value ? `${fontSize.value}${fontSize.unit ?? 'px'}` : 'var(--quil-text-sm)',
          resize: 'none'
        }}
      />
      {error && (
        <div data-testid="text-editor-error" role="alert" style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
          {error}
        </div>
      )}
    </div>
  )
}