// src/pages/Workspace.tsx
// Workspace: canvas (2/3) + tools panel (1/3), 2fr/1fr grid, independent scrolling panels.
// Existing App content moved here for the /p/:projectId route.

import * as React from 'react'
import { useCallback, useRef, useState, useSyncExternalStore, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { CandidateId, ElementId, PageId, ProjectState, ResolvedProps } from '../core'
import { resolveElement } from '../core/decisions'
import { emptyProject, createProject } from '../core/fixtures'
import { QuilStore } from '../app/store'
import { projectRepository } from '../persistence'
import { Canvas } from '../app/renderer'
import { Inspector } from '../app/inspector'
import { ScopePicker } from '../app/scope-picker'
import { DriftBadge } from '../app/drift-badge'
import { ContrastBadge } from '../app/contrast-badge'
import { SaveStatus } from '../app/save-status'
import { ReadOnlyBanner } from '../app/read-only-banner'
import { RecoveryScreen } from '../app/recovery-screen'
import { IntakePanel } from '../app/intake-panel'
import { GenerationPanel } from '../app/generation-panel'
import { PreviewOverlay } from '../app/preview-overlay'
import type { Candidate } from '../core/generation'
import { Button, IconButton, Card, FeatherPen, Input, Chip, PenLoader } from '../ui'
import { useAuth } from '../contexts/AuthContext'
import { KeyStatusChip } from '../components/KeyStatusChip'

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

export function Workspace(): React.ReactElement {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { projectId: projectIdParam } = useParams<{ projectId: string }>()
  const projectId = projectIdParam ?? ''

  const [store, setStore] = useState<QuilStore | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      const existing = await projectRepository.load(projectId)
      if (cancelled) return
      if (!existing) {
        setNotFound(true)
        setLoading(false)
        return
      }
      const s = new QuilStore(emptyProject())
      await s.init()
      if (cancelled) return
      setStore(s)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [projectId])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--quil-bg)',
          color: 'var(--quil-text-100)',
          fontFamily: 'var(--quil-font-ui)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div data-testid="workspace-loading">Loading project…</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--quil-bg)',
          color: 'var(--quil-text-100)',
          fontFamily: 'var(--quil-font-ui)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--quil-space-4)',
          padding: 'var(--quil-space-4)',
        }}
      >
        <h2 style={{ fontSize: 'var(--quil-heading-2)', fontFamily: 'var(--quil-font-head)' }}>
          Project not found
        </h2>
        <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>
          The project you requested doesn&apos;t exist.
        </p>
        <Button variant="primary" onClick={() => navigate('/projects')}>
          Go to Projects
        </Button>
      </div>
    )
  }

  const storeRef = useRef<QuilStore | null>(store!)
  const currentStore = store!

  const state = useSyncExternalStore<ProjectState>(
    (cb: () => void) => currentStore.subscribe(cb),
    () => currentStore.getSnapshot()
  )

  const [pageId, setPageId] = useState<PageId | null>(null)
  const [selectedId, setSelectedId] = useState<ElementId | null>(null)
  const [zoom, setZoom] = useState(1)
  const [recovery, setRecovery] = useState<{ error: string; backup: string | null } | null>(null)
  const [intakeOpen, setIntakeOpen] = useState(false)
  const [generationOpen, setGenerationOpen] = useState(false)
  const [genCandidates, setGenCandidates] = useState<Candidate[]>([])
  const [genActiveIndex, setGenActiveIndex] = useState<number | null>(null)
  const [promptInstruction, setPromptInstruction] = useState('')
  const [generatingVariants, setGeneratingVariants] = useState(false)
  const keyStatus = 'No AI key set'
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
    currentStore.dispatch({ type: 'undo', commandId: `cmd-undo-${Date.now()}` as never })
  }
  const redo = (): void => {
    currentStore.dispatch({ type: 'redo', commandId: `cmd-redo-${Date.now()}` as never })
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

  const currentPageId: PageId | null =
    pageId && state.pages.has(pageId) ? pageId : (pages[0]?.id ?? null)

  const activeCandidate: Candidate | null =
    genActiveIndex != null ? (genCandidates[genActiveIndex] ?? null) : null

  const handleRetry = (): void => {
    void currentStore.init().then(() => setRecovery(null)).catch((err) => {
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
    ...(pressed ? { boxShadow: 'none', transform: 'translateY(var(--quil-press))' } : {})
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
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--quil-space-2)' }}>
          <FeatherPen size={20} />
          <strong style={{ fontFamily: 'var(--quil-font-head)' }}>Quil</strong>
        </div>
        <div data-testid="project-name" style={{ fontSize: 'var(--quil-text-sm)' }}>
          {state.name}
        </div>
        <SaveStatus store={currentStore} />
        <KeyStatusChip status="not-set" />
        <span style={{ flex: 1 }} />
        <Button variant="primary" onClick={() => navigate('/new/1')} style={buttonBase}>
          Intake
        </Button>
        <Button variant="primary" onClick={() => setGenerationOpen(true)} style={buttonBase}>
          Generate
        </Button>
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
        {user && (
          <button
            onClick={() => {}}
            style={{ ...iconButton, opacity: 0.6 }}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </button>
        )}
      </header>

      <ReadOnlyBanner store={currentStore} />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', overflow: 'hidden' }}>
        <section style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 'var(--quil-space-1)', padding: 'var(--quil-space-2) var(--quil-space-4) 0', borderBottom: '1px solid var(--quil-line)' }}>
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
                <Canvas store={currentStore} pageId={currentPageId} getZoom={getZoom} />
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
            <PreviewOverlay store={currentStore} pageId={currentPageId} activeCandidate={activeCandidate} />
          </div>
        </section>

        <aside style={{ overflow: 'auto', minWidth: 320, borderLeft: '1px solid var(--quil-line)', padding: 'var(--quil-space-4)' }}>
          {selectedId && element ? (
            <>
              <Inspector store={currentStore} elementId={selectedId} />
              <ScopePicker store={currentStore} elementId={selectedId} property={scopeProperty} />
              <DriftBadge store={currentStore} elementId={selectedId} property={scopeProperty} currentValue={element.props[scopeProperty]} />
              {fg && bg && <ContrastBadge foreground={fg} background={bg} />}
              <GenerationPanel
                store={currentStore}
                state={state}
                candidates={genCandidates}
                activeIndex={genActiveIndex}
                onGenerate={(candidates: Candidate[], activeIndex: number | null) => {
                  setGenCandidates(candidates)
                  setGenActiveIndex(activeIndex)
                }}
                onApprove={(candidate: Candidate) => {
                  const result = currentStore.dispatch({
                    type: 'apply_candidate',
                    commandId: `cmd-approve-${Date.now()}` as never,
                    baseRev: currentStore.getState().rev,
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
            <IntakePanel store={currentStore} state={state} />
          ) : generationOpen ? (
            <GenerationPanel
              store={currentStore}
              state={state}
              candidates={genCandidates}
              activeIndex={genActiveIndex}
              onGenerate={(candidates: Candidate[], activeIndex: number | null) => {
                setGenCandidates(candidates)
                setGenActiveIndex(activeIndex)
              }}
              onApprove={(candidate: Candidate) => {
                const result = currentStore.dispatch({
                  type: 'apply_candidate',
                  commandId: `cmd-approve-${Date.now()}` as never,
                  baseRev: currentStore.getState().rev,
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
                onClick={() => navigate('/new/1')}
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
          <div data-testid="variant-tray" style={{ marginTop: 'var(--quil-space-4)', padding: 'var(--quil-space-4)', borderTop: '1px solid var(--quil-line)', background: 'var(--quil-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--quil-space-3)' }}>
              <span style={{ fontSize: 'var(--quil-text-xs)', fontWeight: 600, fontFamily: 'var(--quil-font-ui)' }}>Variants</span>
              <Chip variant="accent">3 candidates</Chip>
            </div>
            <div style={{ display: 'flex', gap: 'var(--quil-space-3)', overflowX: 'auto', paddingBottom: 'var(--quil-space-2)' }}>
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  data-testid={`gen-variant-card-${i}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--quil-space-2)',
                    width: 200,
                    padding: 'var(--quil-space-3)',
                    border: '1px solid var(--quil-line)',
                    borderRadius: 'var(--quil-radius-md)',
                    background: 'var(--quil-surface-hover)',
                    cursor: 'pointer',
                    transition: 'border-color var(--quil-duration-press), box-shadow var(--quil-duration-press)',
                  }}
                >
                  {/* Live miniature */}
                  <div
                    data-testid={`gen-variant-miniature-${i}`}
                    style={{
                      width: '100%',
                      height: 80,
                      borderRadius: 'var(--quil-radius-sm)',
                      background: i === 0 ? 'var(--quil-accent)' : 'var(--quil-line)',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--quil-bg)',
                      fontSize: 'var(--quil-text-xs)',
                      fontWeight: 600,
                    }}
                  >
                    Preview {i + 1}
                  </div>
                  <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
                    Variant {i + 1} — {i === 0 ? 'Hero background' : i === 1 ? 'Button treatment' : 'Card style'}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--quil-space-1)' }}>
                    <Chip variant="success" style={{ fontSize: 'var(--quil-text-xs)' }}>Automated: contrast</Chip>
                    <Chip variant="default" style={{ fontSize: 'var(--quil-text-xs)' }}>Valid</Chip>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 'var(--quil-space-3)', display: 'flex', gap: 'var(--quil-space-2)' }}>
              <Button variant="primary" onClick={() => setGenActiveIndex(0)}>Approve variant 1</Button>
              <Button variant="neutral" onClick={() => setGenCandidates([])}>Reject</Button>
              <Button variant="neutral" onClick={() => {}}>Regenerate</Button>
            </div>
          </div>

          {/* Prompt box pinned to bottom of tools panel */}
          <div
            style={{
              marginTop: 'var(--quil-space-6)',
              padding: 'var(--quil-space-4)',
              borderTop: '1px solid var(--quil-line)',
              background: 'var(--quil-surface)',
              borderRadius: 'var(--quil-radius-md)',
              boxShadow: 'var(--quil-shadow-3)',
            }}
          >
            <div style={{ marginBottom: 'var(--quil-space-3)' }}>
              <span style={{ fontSize: 'var(--quil-text-xs)', fontWeight: 600, fontFamily: 'var(--quil-font-ui)' }}>Prompt</span>
            </div>
            <div style={{ position: 'relative', marginBottom: 'var(--quil-space-3)' }}>
              <Input
                placeholder="Describe the change you want…"
                value={promptInstruction}
                onChange={(e) => setPromptInstruction(e.target.value)}
                maxLength={256}
              />
              <FeatherPen style={{ position: 'absolute', right: 'var(--quil-space-3)', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} size={16} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--quil-space-2)', alignItems: 'center' }}>
              <Button variant="primary" onClick={() => setGenCandidates([])} disabled={generatingVariants}>
                {generatingVariants ? <PenLoader size={20} loading={true} /> : 'Generate 3 variants'}
              </Button>
              <span style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
                {keyStatus}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
