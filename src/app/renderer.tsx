// src/app/renderer.tsx
// Canvas renderer: renders the element tree from page.sectionIds,
// recursing through childIds. Containers (section, card, navigation, form)
// render their children; text and heading render their text prop.
// Every element carries data-element-id for gesture targeting.

import * as React from 'react'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { DesignElement, ElementId, NodeKind, PageId, ProjectState, ResolvedProps } from '../core'
import { QuilStore } from './store'
import { createResolver } from './resolve'
import { Layers } from './layers'
import { attachGestures } from './gestures'

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
  if (shadow === 'shadow-1') s.boxShadow = 'var(--quil-shadow-1)'
  if (shadow === 'shadow-2') s.boxShadow = 'var(--quil-shadow-2)'
  if (shadow === 'shadow-3') s.boxShadow = 'var(--quil-shadow-3)'
  return s
}

function isContainerKind(kind: NodeKind): boolean {
  return kind === 'section' || kind === 'card' || kind === 'navigation' || kind === 'form'
}

function isTextKind(kind: NodeKind): boolean {
  return kind === 'text' || kind === 'heading'
}

function renderElement(
  state: ProjectState,
  elementId: ElementId
): React.ReactElement | null {
  const element = state.nodes.get(elementId)
  if (!element) return null

  const resolved = resolver.resolve(state, elementId)
  if (!resolved.ok) return null

  const style = toStyle(element.kind, resolved.result.props)
  const isText = isTextKind(element.kind)
  const text = isText ? ((resolved.result.props as { text?: string }).text ?? '') : ''

  const children = isContainerKind(element.kind)
    ? element.childIds.map((cid) => renderElement(state, cid))
    : null

  switch (element.kind) {
    case 'heading':
      return (
        <h1 key={element.id} data-element-id={element.id} data-kind={element.kind} style={style}>
          {text}
          {children}
        </h1>
      )
    case 'text':
      return (
        <div key={element.id} data-element-id={element.id} data-kind={element.kind} style={style}>
          {text}
          {children}
        </div>
      )
    case 'image':
      return (
        <div key={element.id} data-element-id={element.id} data-kind={element.kind} style={style}>
          {children}
        </div>
      )
    case 'button':
      return (
        <button key={element.id} data-element-id={element.id} data-kind={element.kind} style={style}>
          {text}
          {children}
        </button>
      )
    case 'card':
      return (
        <div key={element.id} data-element-id={element.id} data-kind={element.kind} style={style}>
          {children}
        </div>
      )
    case 'navigation':
      return (
        <nav key={element.id} data-element-id={element.id} data-kind={element.kind} style={style}>
          {children}
        </nav>
      )
    case 'form':
      return (
        <form key={element.id} data-element-id={element.id} data-kind={element.kind} style={style}>
          {children}
        </form>
      )
    default:
      return (
        <div key={element.id} data-element-id={element.id} data-kind={element.kind} style={style}>
          {text}
          {children}
        </div>
      )
  }
}

export function Canvas({
  store,
  pageId = null,
  getZoom
}: {
  store: QuilStore
  pageId?: PageId | null
  getZoom?: () => number
}): React.ReactElement {
  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    return attachGestures(el, store, getZoom ?? (() => 1))
  }, [store, getZoom])

  const page = pageId ? state.pages.get(pageId) : undefined
  const sectionIds = page
    ? page.sectionIds
    : Array.from(state.pages.values()).flatMap((p) => p.sectionIds)

  return (
    <Layers ref={rootRef}>
      {sectionIds.map((sid) => renderElement(state, sid))}
    </Layers>
  )
}
