// Module E (Phase 6): Preview overlay layer.
// Ephemeral, highest-precedence layer that renders a selected candidate
// on top of the committed document. Never persisted, never in undo, never
// touches the command bus. Only the final approved result is committed
// via apply_candidate.

import * as React from 'react'
import { useSyncExternalStore } from 'react'
import type { ElementId, NodeKind, PageId, ProjectState } from '../core'
import { QuilStore } from './store'
import { createResolver } from './resolve'
import type { Candidate } from '../core/generation'

const resolver = createResolver()

function toStyle(kind: NodeKind, props: Record<string, unknown>): React.CSSProperties {
  const s: React.CSSProperties = {}
  if (props.bgColor) s.backgroundColor = String(props.bgColor)
  if (props.textColor) s.color = String(props.textColor)
  if (props.color) s.color = String(props.color)
  const fs = props.fontSize
  if (fs && typeof fs === 'object' && 'value' in fs) {
    s.fontSize = `${(fs as { value: number }).value}${(fs as { unit?: string }).unit ?? 'px'}`
  }
  if (props.fontWeight) s.fontWeight = String(props.fontWeight)
  if (props.align) s.textAlign = String(props.align) as React.CSSProperties['textAlign']
  const p = props.padding
  if (p && typeof p === 'object' && 'value' in p) {
    s.padding = `${(p as { value: number }).value}px`
  }
  if (props.radius) s.borderRadius = `${Number(props.radius)}px`
  if (props.fit) s.objectFit = String(props.fit) as React.CSSProperties['objectFit']
  if (props.width && typeof props.width === 'number') s.width = `${props.width}px`
  if (props.height && typeof props.height === 'number') s.height = `${props.height}px`
  const shadow = props.shadow
  if (shadow === 'shadow-1') s.boxShadow = '0 1px 2px rgba(0,0,0,0.1)'
  if (shadow === 'shadow-2') s.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'
  if (shadow === 'shadow-3') s.boxShadow = '0 10px 15px rgba(0,0,0,0.1)'
  return s
}

function isTextKind(kind: NodeKind): boolean {
  return kind === 'text' || kind === 'heading'
}

function renderElement(
  kind: NodeKind,
  id: ElementId,
  style: React.CSSProperties,
  text: string,
  childIds: ElementId[]
): React.ReactElement {
  const _children = isTextKind(kind) ? null : childIds.map((cid) => (
    <span key={String(cid)} data-element-id={String(cid)} />
  ))
  switch (kind) {
    case 'heading': return <h1 data-element-id={id} data-kind={kind} style={style}>{text}</h1>
    case 'text': return <div data-element-id={id} data-kind={kind} style={style}>{text}</div>
    case 'image': return <div data-element-id={id} data-kind={kind} style={style}>{text}</div>
    case 'button': return <button data-element-id={id} data-kind={kind} style={style}>{text}</button>
    case 'card': return <div data-element-id={id} data-kind={kind} style={style}>{text}</div>
    case 'navigation': return <nav data-element-id={id} data-kind={kind} style={style}>{text}</nav>
    case 'form': return <form data-element-id={id} data-kind={kind} style={style}>{text}</form>
    default: return <div data-element-id={id} data-kind={kind} style={style}>{text}</div>
  }
}

interface PreviewOverlayProps {
  store: QuilStore
  pageId: PageId | null
  activeCandidate: Candidate | null
}

export function PreviewOverlay({ store, pageId, activeCandidate }: PreviewOverlayProps): React.ReactElement {
  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )

  const elements = Array.from(state.nodes.values()).filter(
    (el) => pageId === null || el.pageId === pageId
  )

  // Build props for each element, applying the active candidate's patches
  // on top (overlay layer, not document state).
  const activePatches = activeCandidate
    ? new Map(Object.entries(activeCandidate.props).map(([k, v]) => [k, v]))
    : new Map<string, unknown>()

  return (
    <div
      data-layer="preview-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 30,
        pointerEvents: 'none'
      }}
    >
      {elements.map((el) => {
        const resolved = resolver.resolve(state, el.id)
        if (!resolved.ok) return null

        const props = { ...resolved.result.props }

        // Apply active candidate patches only to the target element
        if (activeCandidate && activeCandidate.targetId === el.id) {
          for (const [property, value] of activePatches) {
            props[property] = value
          }
        }

        const style = toStyle(el.kind, props)
        const isText = el.kind === 'text' || el.kind === 'heading'
        const text = isText ? ((props as { text?: string }).text ?? '') : ''

        return renderElement(el.kind, el.id, style, text, el.childIds)
      })}
    </div>
  )
}
