import * as React from 'react'
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import type { ElementId, PageId, ProjectState, ResolvedProps } from '../core'
import { resolveElement } from '../core/decisions'
import { QuilStore } from './store'
import { Canvas } from './renderer'
import { Inspector } from './inspector'
import { ScopePicker } from './scope-picker'
import { DriftBadge } from './drift-badge'
import { ContrastBadge } from './contrast-badge'
import { newCommandId } from './command-id'
import { PreviewOverlay } from './preview-overlay'
import { isTextEditable } from './text-editor'
import { bgColorFor as nearestBg, colourTargets } from './colour'
import { baseResizeValue, clampResize, resizeHandles, resizeValueFor } from './resize'
import { InsertMenu } from './insert-menu'
import { LayersPanel } from './layers-panel'
import { DecisionsPanel } from './decisions-panel'
import { duplicateCommands } from './element-ops'
import { CommandPalette, type PaletteAction } from './command-palette'
import { attachPan } from './pan'
import { GenerationPanel } from './generation-panel'
import type { Candidate } from '../core/generation'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
const ZOOM_STEP = 0.1

export function Editor({
  store,
  onStartIntake
}: {
  store: QuilStore
  onStartIntake?: () => void
}): React.ReactElement {
  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )

  const [pageId, setPageId] = useState<PageId | null>(null)
  const [selectedId, setSelectedId] = useState<ElementId | null>(null)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const getZoom = useCallback(() => zoomRef.current, [])
  const canvasRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<ElementId | null>(null)
  const [colourOpen, setColourOpen] = useState(false)
  const [insertOpen, setInsertOpen] = useState(false)
  const [decisionsOpen, setDecisionsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [generationOpen, setGenerationOpen] = useState(false)
  const [handMode, setHandMode] = useState(false)
  const [genCandidates, setGenCandidates] = useState<Candidate[]>([])
  const [genActiveIndex, setGenActiveIndex] = useState<number | null>(null)
  const [variantCount, setVariantCount] = useState(3)
  const handRef = useRef(handMode)
  handRef.current = handMode
  const spaceHeldRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const pages = [...state.pages.values()]
  const currentPageIdResolved: PageId | null =
    pageId && state.pages.has(pageId) ? pageId : (pages[0]?.id ?? null)

  const element = selectedId ? (state.nodes.get(selectedId) ?? undefined) : undefined
  const resolved = selectedId ? resolveElement(state, selectedId) : undefined
  const resolvedProps: ResolvedProps | undefined = resolved?.ok ? resolved.result : undefined
  const fg = (resolvedProps?.props.textColor ?? resolvedProps?.props.color) as string | undefined
  const bg = element ? nearestBg(state, element.id) : undefined
  const scopeProperty = element && element.props.bgColor !== undefined ? 'bgColor' : 'color'

  const pagesMap = pages.map((p) => ({
    id: p.id,
    name: p.name,
    isCurrent: p.id === currentPageIdResolved,
  }))

  const canUndo = state.undoStack.length > 0
  const canRedo = state.redoStack.length > 0

  const undo = (): void => {
    store.dispatch({ type: 'undo', commandId: newCommandId('undo') })
  }
  const redo = (): void => {
    store.dispatch({ type: 'redo', commandId: newCommandId('redo') })
  }

  const zoomIn = (): void => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10))
  const zoomOut = (): void => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10))

  const deleteSelection = (): void => {
    if (!selectedId) return
    const result = store.dispatch({
      type: 'remove_element',
      commandId: newCommandId('delete') as never,
      baseRev: store.getState().rev,
      elementId: selectedId
    })
    if (result.ok) {
      setSelectedId(null)
      setEditingId(null)
    }
  }

  const duplicateSelection = (): void => {
    if (!selectedId) return
    const commands = duplicateCommands(store.getState(), selectedId)
    if (!commands) return
    const result = store.dispatch({
      type: 'batch',
      commandId: newCommandId('dup-batch') as never,
      commands
    })
    if (result.ok) {
      const first = commands[0]!
      setSelectedId(first.type === 'add_section' ? first.sectionId : first.elementId)
    }
  }

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    return attachPan(el, () => handRef.current || spaceHeldRef.current)
  }, [])

  React.useEffect(() => {
    const onUp = (e: KeyboardEvent): void => {
      if (e.key === ' ') spaceHeldRef.current = false
    }
    window.addEventListener('keyup', onUp)
    return () => window.removeEventListener('keyup', onUp)
  }, [])

  const handleCanvasClick = (e: React.MouseEvent): void => {
    if (handRef.current || spaceHeldRef.current) return
    if (e.target instanceof Element && e.target.closest('[data-resize-property]')) return
    const t = e.target instanceof Element ? e.target.closest('[data-element-id]') : null
    const raw = t?.getAttribute('data-element-id') ?? null
    setSelectedId(raw as ElementId | null)
  }

  const handleCanvasKey = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      setSelectedId(null)
      return
    }
    if (e.key !== 'Tab') return
    const nodes = Array.from(canvasRef.current?.querySelectorAll('[data-element-id]') ?? [])
    if (nodes.length === 0) return
    e.preventDefault()
    const ids = nodes.map((n) => n.getAttribute('data-element-id') ?? '')
    const index = ids.indexOf(String(selectedId ?? ''))
    const next = e.shiftKey
      ? index <= 0 ? ids.length - 1 : index - 1
      : (index + 1) % ids.length
    setSelectedId(ids[next] as ElementId)
  }

  const startEditing = (): void => {
    if (!selectedId) return
    const node = store.getState().nodes.get(selectedId)
    if (node && isTextEditable(node.kind)) setEditingId(selectedId)
  }

  const handleDoubleClick = (e: React.MouseEvent): void => {
    if (e.target instanceof Element && e.target.closest('[data-resize-property]')) return
    const t = e.target instanceof Element ? e.target.closest('[data-element-id]') : null
    const raw = t?.getAttribute('data-element-id') ?? null
    if (!raw) return
    const node = store.getState().nodes.get(raw as ElementId)
    if (node && isTextEditable(node.kind)) {
      setSelectedId(node.id)
      setEditingId(node.id)
    }
  }

  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e: KeyboardEvent): void => {
    const t = e.target
    if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setPaletteOpen((v) => !v)
      return
    }
    if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault()
      zoomIn()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '-') {
      e.preventDefault()
      zoomOut()
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === '0') {
      e.preventDefault()
      setZoom(1)
      return
    }
    if (e.key === ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      spaceHeldRef.current = true
      return
    }
    if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      setHandMode((v) => !v)
      return
    }
    if (e.key === 'Escape') {
      setSelectedId(null)
      return
    }
    if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      canvasRef.current?.focus()
      return
    }
    if ((e.key === 'Enter' || e.key === 't' || e.key === 'T') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      startEditing()
      return
    }
    if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!selectedId) return
      const node = store.getState().nodes.get(selectedId)
      if (node && colourTargets(node.kind).length > 0) setColourOpen((v) => !v)
      return
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      setInsertOpen((v) => !v)
      return
    }
    if ((e.key === 'd' || e.key === 'D') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      setDecisionsOpen((v) => !v)
      return
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!selectedId) return
      e.preventDefault()
      deleteSelection()
      return
    }
    if ((e.key === 'd' || e.key === 'D') && (e.metaKey || e.ctrlKey)) {
      if (!selectedId) return
      e.preventDefault()
      duplicateSelection()
      return
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (!selectedId) return
      // Arrow keys on a focused chrome button should not nudge the canvas.
      if (t instanceof HTMLElement && t.tagName === 'BUTTON') return
      const node = store.getState().nodes.get(selectedId)
      if (!node) return
      const handles = resizeHandles(node.kind)
      const vertical = e.key === 'ArrowUp' || e.key === 'ArrowDown'
      const handle =
        (vertical ? handles.find((h) => h.edge === 'bottom') : undefined) ??
        handles.find((h) => h.edge === 'right') ??
        handles[0]
      if (!handle) return
      const current = baseResizeValue(node.props, handle.property)
      if (current === null) return
      const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : -1)
      const next = clampResize(handle.min, handle.max, current + step)
      if (next === current) return
      e.preventDefault()
      store.dispatch({
        type: 'set_property',
        commandId: newCommandId('nudge'),
        baseRev: store.getState().rev,
        targetId: selectedId,
        property: handle.property,
        value: resizeValueFor(handle.property, next)
      })
    }
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent): void => keyRef.current(e)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const paletteActions: PaletteAction[] = [
    { id: 'undo', label: 'Undo', run: undo },
    { id: 'redo', label: 'Redo', run: redo },
    { id: 'zoom-in', label: 'Zoom in', run: zoomIn },
    { id: 'zoom-out', label: 'Zoom out', run: zoomOut },
    { id: 'zoom-reset', label: 'Zoom to 100%', run: () => setZoom(1) },
    { id: 'hand', label: 'Toggle hand tool (H)', run: () => setHandMode((v) => !v) },
    { id: 'insert', label: 'Insert element (/)', run: () => setInsertOpen(true) },
    { id: 'decisions', label: 'Show decisions (D)', run: () => setDecisionsOpen((v) => !v) },
    { id: 'edit-text', label: 'Edit selected text (T)', run: startEditing },
    { id: 'colour', label: 'Pick selected colour (C)', run: () => setColourOpen((v) => !v) },
    { id: 'delete', label: 'Delete selection', run: deleteSelection },
    { id: 'duplicate', label: 'Duplicate selection (Ctrl+D)', run: duplicateSelection }
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        height: '100vh',
        background: 'var(--quil-bg)',
        color: 'var(--quil-text-100)',
        fontFamily: 'var(--quil-font-ui)'
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--quil-space-3)',
          padding: `var(--quil-space-2) var(--quil-space-4)`,
          borderBottom: `1px solid var(--quil-line)`
        }}
      >
        <strong style={{ fontFamily: 'var(--quil-font-head)' }}>Quil</strong>
        <div style={{ fontSize: 'var(--quil-text-sm)' }}>Project</div>
        <button data-testid="intake-btn" onClick={() => onStartIntake?.()} style={{ ...buttonBase(false) }}>
          Intake
        </button>
        <button
          data-testid="gen-btn"
          onClick={() => setGenerationOpen((v) => !v)}
          style={{ ...buttonBase(true) }}
        >
          Generate
        </button>
        <span style={{ flex: 1 }} />
        <button
          data-testid="undo-btn"
          onClick={undo}
          disabled={!canUndo}
          style={{ ...buttonBase(false) }}
        >
          Undo
        </button>
        <button
          data-testid="redo-btn"
          onClick={redo}
          disabled={!canRedo}
          style={{ ...buttonBase(false) }}
        >
          Redo
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', overflow: 'hidden' }}>
        <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 'var(--quil-space-1)', padding: 'var(--quil-space-2) var(--quil-space-4) 0', borderBottom: `1px solid var(--quil-line)` }}>
            {pagesMap.map((p) => (
              <button
                key={String(p.id)}
                style={{
                  ...buttonBase(false),
                  background: p.isCurrent ? 'var(--quil-button)' : 'transparent',
                  color: p.isCurrent ? 'var(--quil-button-text)' : 'var(--quil-text-70)',
                  borderRadius: 'var(--quil-radius-md)',
                  boxShadow: p.isCurrent ? 'var(--quil-shadow-3)' : 'none'
                }}
                onClick={() => {
                  setPageId(p.id)
                  setSelectedId(null)
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-2)', padding: 'var(--quil-space-1) var(--quil-space-4)' }}>
            <button data-testid="zoom-out" aria-label="Zoom out" onClick={zoomOut} style={{ ...iconButton() }}>
              −
            </button>
            <span style={{ minWidth: 'var(--quil-target-icon)', textAlign: 'center', fontSize: 'var(--quil-text-sm)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button data-testid="zoom-in" aria-label="Zoom in" onClick={zoomIn} style={{ ...iconButton() }}>
              +
            </button>
          </div>
          <div
            ref={scrollRef}
            data-testid="canvas-scroll"
            data-hand={handMode ? 'true' : 'false'}
            style={{
              flex: 1,
              overflow: 'auto',
              position: 'relative',
              cursor: handMode ? 'grab' : 'default'
            }}
          >
            {currentPageIdResolved ? (
              <div
                ref={canvasRef}
                tabIndex={0}
                aria-label="Canvas"
                data-testid="canvas-root"
                onKeyDown={handleCanvasKey}
                onClick={handleCanvasClick}
                onDoubleClick={handleDoubleClick}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: 'top left',
                  width: `${100 / zoom}%`,
                  outline: 'none'
                }}
              >
                <Canvas
                  store={store}
                  pageId={currentPageIdResolved}
                  getZoom={getZoom}
                  selectedId={selectedId}
                  editingId={editingId}
                  onTextDone={() => setEditingId(null)}
                />
              </div>
            ) : (
              <div data-testid="canvas-empty" style={{ padding: 'var(--quil-space-4)', color: 'var(--quil-text-70)', fontFamily: 'var(--quil-font-ui)' }}>
                <h2 style={{ fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', fontSize: 'var(--quil-text-lg)' }}>
                  Start with your brief
                </h2>
                <p style={{ fontSize: 'var(--quil-text-sm)' }}>
                  Quil works for any site. Describe what you are building; Quil proposes pages and you approve the decisions.
                </p>
                <button data-testid="canvas-empty-intake" onClick={() => onStartIntake?.()} style={{ ...buttonBase(false) }}>
                  Start intake
                </button>
              </div>
            )}
            <PreviewOverlay store={store} pageId={currentPageIdResolved} activeCandidate={null} />
          </div>

          {generationOpen && (
            <div data-testid="generation-tray" style={{ marginTop: 'var(--quil-space-6)', padding: 'var(--quil-space-4)', borderTop: `1px solid var(--quil-line)`, background: 'var(--quil-surface)', borderRadius: 'var(--quil-radius-md)', boxShadow: 'var(--quil-shadow-3)' }}>
              <GenerationPanel
                store={store}
                state={state}
                candidates={genCandidates}
                activeIndex={genActiveIndex}
                variantCount={variantCount}
                onGenerate={(candidates: Candidate[], activeIndex: number | null) => {
                  setGenCandidates(candidates)
                  setGenActiveIndex(activeIndex)
                }}
                onApprove={(candidate: Candidate) => {
                  const result = store.dispatch({
                    type: 'apply_candidate',
                    commandId: newCommandId('gen-approve') as never,
                    baseRev: store.getState().rev,
                    candidateId: candidate.candidateId,
                    componentDefId: candidate.componentDefId,
                    targetId: candidate.targetId,
                    patches: Object.entries(candidate.props).map(([property, value]) => ({ property, value }))
                  })
                  if (!result.ok) {
                    setGenCandidates([])
                    setGenActiveIndex(null)
                  } else {
                    setGenCandidates([])
                    setGenActiveIndex(null)
                    setGenerationOpen(false)
                  }
                }}
                onReject={() => {
                  setGenCandidates([])
                  setGenActiveIndex(null)
                }}
                onRegenerate={() => {
                  void setGenerationOpen(true)
                }}
                onSelectIndex={(index) => setGenActiveIndex(index)}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-2)', marginTop: 'var(--quil-space-3)' }}>
                <button data-testid="variant-count-1" aria-pressed={variantCount === 1} onClick={() => setVariantCount(1)} style={{ ...buttonBase(false), background: variantCount === 1 ? 'var(--quil-accent)' : 'var(--quil-surface)', color: variantCount === 1 ? 'var(--quil-accent-text)' : 'var(--quil-text-100)', minWidth: 'var(--quil-target-min)', padding: '0 var(--quil-space-3)' }}>
                  1
                </button>
                <button data-testid="variant-count-2" aria-pressed={variantCount === 2} onClick={() => setVariantCount(2)} style={{ ...buttonBase(false), background: variantCount === 2 ? 'var(--quil-accent)' : 'var(--quil-surface)', color: variantCount === 2 ? 'var(--quil-accent-text)' : 'var(--quil-text-100)', minWidth: 'var(--quil-target-min)', padding: '0 var(--quil-space-3)' }}>
                  2
                </button>
                <button data-testid="variant-count-3" aria-pressed={variantCount === 3} onClick={() => setVariantCount(3)} style={{ ...buttonBase(false), background: variantCount === 3 ? 'var(--quil-accent)' : 'var(--quil-surface)', color: variantCount === 3 ? 'var(--quil-accent-text)' : 'var(--quil-text-100)', minWidth: 'var(--quil-target-min)', padding: '0 var(--quil-space-3)' }}>
                  3
                </button>
              </div>
            </div>
          )}
        </section>

        <aside style={{ overflow: 'auto', minWidth: 320, borderLeft: `1px solid var(--quil-line)`, padding: 'var(--quil-space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--quil-space-1)', marginBottom: 'var(--quil-space-2)' }}>
            <button
              data-testid="insert-toggle"
              aria-expanded={insertOpen}
              onClick={() => setInsertOpen((v) => !v)}
              style={{ ...buttonBase() }}
            >
              Insert
            </button>
          </div>
          <InsertMenu
            store={store}
            pageId={currentPageIdResolved}
            selectedId={selectedId}
            open={insertOpen}
            onOpenChange={setInsertOpen}
            onInserted={(id) => setSelectedId(id)}
          />
          <LayersPanel
            store={store}
            pageId={currentPageIdResolved}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <DecisionsPanel store={store} open={decisionsOpen} onOpenChange={setDecisionsOpen} />
          {selectedId && element ? (
            <>
              <Inspector
                store={store}
                elementId={selectedId}
              />
              <ScopePicker store={store} elementId={selectedId} property={scopeProperty} />
              <DriftBadge store={store} elementId={selectedId} property={scopeProperty} currentValue={element?.props?.[scopeProperty]} />
              {fg && bg && <ContrastBadge foreground={fg} background={bg} />}
            </>
          ) : (
            <div style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', padding: 'var(--quil-space-4)' }}>
              Select an element on the canvas
              <button
                data-testid="intake-open-btn"
                onClick={() => onStartIntake?.()}
                style={{ marginTop: 'var(--quil-space-2)', ...buttonBase(false), fontSize: 'var(--quil-text-xs)', padding: '0 var(--quil-space-2)', minHeight: 'var(--quil-target-icon)', minWidth: 'var(--quil-target-icon)' }}
              >
                Start intake
              </button>
              <button
                data-testid="gen-open-btn"
                onClick={() => setGenerationOpen((v) => !v)}
                style={{ marginTop: 'var(--quil-space-1)', ...buttonBase(false), fontSize: 'var(--quil-text-xs)', padding: '0 var(--quil-space-2)', minHeight: 'var(--quil-target-icon)', minWidth: 'var(--quil-target-icon)' }}
              >
                Start generation
              </button>
            </div>
          )}
        </aside>
      </div>
      <CommandPalette open={paletteOpen} actions={paletteActions} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

function buttonBase(isPrimary: boolean = false): React.CSSProperties {
  if (isPrimary) {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--quil-space-2)',
      padding: `0 var(--quil-space-3)`,
      minHeight: 'var(--quil-target-min)',
      minWidth: 'var(--quil-target-min)',
      background: 'var(--quil-button)',
      border: `1px solid var(--quil-line)`,
      borderRadius: 'var(--quil-radius-sm)',
      color: 'var(--quil-button-text)',
      fontSize: 'var(--quil-text-sm)',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity var(--quil-duration-fast), transform var(--quil-duration-fast)'
    }
  }
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--quil-space-2)',
    padding: `0 var(--quil-space-3)`,
    minHeight: 'var(--quil-target-min)',
    minWidth: 'var(--quil-target-min)',
    background: 'var(--quil-surface)',
    border: `1px solid var(--quil-line)`,
    borderRadius: 'var(--quil-radius-sm)',
    color: 'var(--quil-text-100)',
    fontSize: 'var(--quil-text-sm)',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity var(--quil-duration-fast), transform var(--quil-duration-fast)'
  }
}

function iconButton(): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--quil-space-2)',
    padding: `0 var(--quil-space-2)`,
    minWidth: 'var(--quil-target-icon)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
  }
}