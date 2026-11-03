import * as React from 'react'
import { useCallback, useRef, useState, useSyncExternalStore } from 'react'
import type { ElementId, PageId, ProjectState, ResolvedProps } from '../core'
import { resolveElement } from '../core/decisions'
import { emptyProject } from '../core/fixtures'
import { QuilStore } from './store'
import { Canvas } from './renderer'
import { Inspector } from './inspector'
import { ScopePicker } from './scope-picker'
import { DriftBadge } from './drift-badge'
import { ContrastBadge } from './contrast-badge'
import { SaveStatus } from './save-status'
import { ReadOnlyBanner } from './read-only-banner'
import { RecoveryScreen } from './recovery-screen'
import { IntakePanel } from './intake-panel'
import { GenerationPanel } from './generation-panel'
import { PreviewOverlay } from './preview-overlay'
import type { Candidate } from '../core/generation'

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
const ZOOM_STEP = 0.1

const buttonBase = {
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
  fontFamily: 'var(--quil-font-ui)',
  fontWeight: 600,
  boxShadow: 'var(--quil-shadow-3)',
  cursor: 'pointer',
  transition: 'box-shadow var(--quil-duration-press), transform var(--quil-duration-press)'
} as React.CSSProperties

const buttonActive = {
  boxShadow: 'none',
  transform: 'translateY(3px)'
} as React.CSSProperties

const buttonDisabled = {
  ...buttonBase,
  opacity: 0.5,
  cursor: 'not-allowed',
  boxShadow: 'none'
} as React.CSSProperties

const iconButton = {
  ...buttonBase,
  padding: `0 var(--quil-space-2)`,
  minWidth: 'var(--quil-target-icon)'
} as React.CSSProperties

function bgColorFor(state: ProjectState, elementId: ElementId): string | undefined {
  let cur = state.nodes.get(elementId)
  while (cur) {
    const c = cur.props.bgColor
    if (typeof c === 'string') return c
    cur = cur.parentId ? state.nodes.get(cur.parentId) : undefined
  }
  return undefined
}

export function App(): React.ReactElement {
  const storeRef = useRef<QuilStore | null>(null)
  if (!storeRef.current) storeRef.current = new QuilStore(emptyProject())
  const store = storeRef.current
  React.useEffect(() => {
    void store.init()
  }, [store])

  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => store.subscribe(cb),
    () => store.getSnapshot()
  )

  const [pageId, setPageId] = useState<PageId | null>(null)
  const [selectedId, setSelectedId] = useState<ElementId | null>(null)
  const [zoom, setZoom] = useState(1)
  const [recovery, setRecovery] = useState<{ error: string; backup: string | null } | null>(null)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [generationOpen, setGenerationOpen] = useState(false)
  const [genCandidates, setGenCandidates] = useState<Candidate[]>([])
  const [genActiveIndex, setGenActiveIndex] = useState<number | null>(null)
  const [pressedUndo, setPressedUndo] = useState(false)
  const [pressedRedo, setPressedRedo] = useState(false)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const getZoom = useCallback(() => zoomRef.current, [])

  const onCanvasClick = (e: React.MouseEvent): void => {
    const t = e.target instanceof Element ? e.target.closest('[data-element-id]') : null
    const raw = t?.getAttribute('data-element-id') ?? null
    setSelectedId(raw as ElementId | null)
  }
  const undo = (): void => {
    store.dispatch({ type: 'undo', commandId: `cmd-undo-${Date.now()}` as never })
  }
  const redo = (): void => {
    store.dispatch({ type: 'redo', commandId: `cmd-redo-${Date.now()}` as never })
  }
  const zoomIn = (): void => setZoom((z) => Math.min(ZOOM_MAX, Math.round((z + ZOOM_STEP) * 10) / 10))
  const zoomOut = (): void => setZoom((z) => Math.max(ZOOM_MIN, Math.round((z - ZOOM_STEP) * 10) / 10))

  const element = selectedId ? (state.nodes.get(selectedId) ?? undefined) : undefined
  const resolved = selectedId ? resolveElement(state, selectedId) : undefined
  const resolvedProps: ResolvedProps | undefined = resolved?.ok ? resolved.result : undefined
  const fg = (resolvedProps?.props.textColor ?? resolvedProps?.props.color) as string | undefined
  const bg = element ? bgColorFor(state, element.id) : undefined
  const scopeProperty = element && element.props.bgColor !== undefined ? 'bgColor' : 'color'

  const pages = [...state.pages.values()]

  // Derive the page in view: the user's pick if it still exists, else the first page.
  const currentPageId: PageId | null =
    pageId && state.pages.has(pageId) ? pageId : (pages[0]?.id ?? null)

  const activeCandidate: Candidate | null =
    genActiveIndex != null ? (genCandidates[genActiveIndex] ?? null) : null

  const handleRetry = (): void => {
    void store.init().then(() => setRecovery(null)).catch((err) => {
      setRecovery({
        error: err instanceof Error ? err.message : 'Recovery failed',
        backup: null
      })
    })
  }

  const handleExport = (projectState: ProjectState): void => {
    const json = JSON.stringify(projectState, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quil-${state.name.replace(/\s+/g, '-').toLowerCase()}-recovery.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDismiss = (): void => setRecovery(null)

  if (recovery) {
    return (
      <RecoveryScreen
        projectId={state.projectId}
        error={recovery.error}
        backup={recovery.backup}
        onRetry={handleRetry}
        onExport={handleExport}
        onDismiss={handleDismiss}
      />
    )
  }

  const canUndo = state.undoStack.length > 0
  const canRedo = state.redoStack.length > 0

  const pressStyle = (base: React.CSSProperties, pressed: boolean): React.CSSProperties => ({
    ...base,
    ...(pressed ? { boxShadow: 'none', transform: 'translateY(3px)' } : {})
  })

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
        <div data-testid="project-name" style={{ fontSize: 'var(--quil-text-sm)' }}>
          {state.name}
        </div>
        <SaveStatus store={store} />
        <button data-testid="intake-btn" onClick={() => setIntakeOpen(true)} style={buttonBase}>
          Intake
        </button>
        <button data-testid="gen-btn" onClick={() => setGenerationOpen(true)} style={buttonBase}>
          Generate
        </button>
        <span style={{ flex: 1 }} />
        <button
          data-testid="undo-btn"
          onClick={undo}
          disabled={!canUndo}
          onMouseDown={() => setPressedUndo(true)}
          onMouseUp={() => setPressedUndo(false)}
          onMouseLeave={() => setPressedUndo(false)}
          style={pressStyle(buttonBase, pressedUndo && canUndo)}
        >
          Undo
        </button>
        <button
          data-testid="redo-btn"
          onClick={redo}
          disabled={!canRedo}
          onMouseDown={() => setPressedRedo(true)}
          onMouseUp={() => setPressedRedo(false)}
          onMouseLeave={() => setPressedRedo(false)}
          style={pressStyle(buttonBase, pressedRedo && canRedo)}
        >
          Redo
        </button>
      </header>

      <ReadOnlyBanner store={store} />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', overflow: 'hidden' }}>
        <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 'var(--quil-space-1)', padding: 'var(--quil-space-2) var(--quil-space-4) 0', borderBottom: `1px solid var(--quil-line)` }}>
            {pages.map((p) => (
              <button
                key={String(p.id)}
                data-testid={`page-tab-${String(p.id)}`}
                style={{
                  ...iconButton,
                  background: p.id === currentPageId ? 'var(--quil-accent)' : 'transparent',
                  color: p.id === currentPageId ? 'var(--quil-accent-text)' : 'var(--quil-text-70)'
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
            <button data-testid="zoom-out" aria-label="Zoom out" onClick={zoomOut} style={iconButton}>
              −
            </button>
            <span data-testid="zoom-level" style={{ minWidth: 'var(--quil-target-icon)', textAlign: 'center', fontSize: 'var(--quil-text-sm)' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button data-testid="zoom-in" aria-label="Zoom in" onClick={zoomIn} style={iconButton}>
              +
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            {currentPageId ? (
              <div
                onClick={onCanvasClick}
                style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%` }}
              >
                <Canvas store={store} pageId={currentPageId} getZoom={getZoom} />
              </div>
            ) : (
              <div
                data-testid="canvas-empty"
                style={{
                  padding: 'var(--quil-space-4)',
                  maxWidth: 520,
                  color: 'var(--quil-text-70)',
                  fontFamily: 'var(--quil-font-ui)'
                }}
              >
                <h2 style={{ fontFamily: 'var(--quil-font-head)', color: 'var(--quil-text-100)', fontSize: 'var(--quil-text-lg)' }}>
                  Start with your brief
                </h2>
                <p style={{ fontSize: 'var(--quil-text-sm)' }}>
                  Quil works for any site. Describe what you are building; Quil proposes pages and you approve the decisions.
                </p>
                <button data-testid="canvas-empty-intake" onClick={() => setIntakeOpen(true)} style={buttonBase}>
                  Start intake
                </button>
              </div>
            )}
            <PreviewOverlay store={store} pageId={currentPageId} activeCandidate={activeCandidate} />
          </div>
        </section>

        <aside style={{ overflow: 'auto', minWidth: 320, borderLeft: `1px solid var(--quil-line)`, padding: 'var(--quil-space-4)' }}>
          {selectedId && element ? (
            <>
              <Inspector store={store} elementId={selectedId} />
              <ScopePicker store={store} elementId={selectedId} property={scopeProperty} />
              <DriftBadge store={store} elementId={selectedId} property={scopeProperty} currentValue={element.props[scopeProperty]} />
              {fg && bg && <ContrastBadge foreground={fg} background={bg} />}
              <GenerationPanel
                store={store}
                state={state}
                candidates={genCandidates}
                activeIndex={genActiveIndex}
                onGenerate={(candidates: Candidate[], activeIndex: number | null) => {
                  setGenCandidates(candidates)
                  setGenActiveIndex(activeIndex)
                }}
                onApprove={(candidate: Candidate) => {
                  const result = store.dispatch({
                    type: 'apply_candidate',
                    commandId: `cmd-approve-${Date.now()}` as never,
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
                  }
                }}
                onReject={() => {
                  setGenCandidates([])
                  setGenActiveIndex(null)
                }}
                onRegenerate={() => {}}
                onSelectIndex={(index: number) => setGenActiveIndex(index)}
              />
            </>
          ) : intakeOpen ? (
            <IntakePanel store={store} state={state} />
          ) : generationOpen ? (
            <GenerationPanel
              store={store}
              state={state}
              candidates={genCandidates}
              activeIndex={genActiveIndex}
              onGenerate={(candidates: Candidate[], activeIndex: number | null) => {
                setGenCandidates(candidates)
                setGenActiveIndex(activeIndex)
              }}
              onApprove={(candidate: Candidate) => {
                const result = store.dispatch({
                  type: 'apply_candidate',
                  commandId: `cmd-approve-${Date.now()}` as never,
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
                }
              }}
              onReject={() => {
                setGenCandidates([])
                setGenActiveIndex(null)
              }}
              onRegenerate={() => {}}
              onSelectIndex={(index: number) => setGenActiveIndex(index)}
            />
          ) : (
            <div data-testid="tools-empty" style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', padding: 'var(--quil-space-4)' }}>
              Select an element on the canvas
              <button
                data-testid="intake-open-btn"
                onClick={() => setIntakeOpen(true)}
                style={{
                  marginTop: 'var(--quil-space-2)',
                  ...buttonBase,
                  fontSize: 'var(--quil-text-xs)',
                  padding: '0 var(--quil-space-2)',
                  minHeight: 'var(--quil-target-icon)',
                  minWidth: 'var(--quil-target-icon)'
                }}
              >
                Start intake
              </button>
              <button
                data-testid="gen-open-btn"
                onClick={() => setGenerationOpen(true)}
                style={{
                  marginTop: 'var(--quil-space-1)',
                  ...buttonBase,
                  fontSize: 'var(--quil-text-xs)',
                  padding: '0 var(--quil-space-2)',
                  minHeight: 'var(--quil-target-icon)',
                  minWidth: 'var(--quil-target-icon)'
                }}
              >
                Start generation
              </button>
            </div>
          )}
          <div data-testid="variant-tray" style={{ marginTop: 'var(--quil-space-4)', padding: 'var(--quil-space-2)', border: `1px dashed var(--quil-line)`, color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-xs)' }}>
            Variants (AI candidate previews arrive in Phase 6)
          </div>
        </aside>
      </div>
    </div>
  )
}
