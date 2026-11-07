// src/pages/IntakeWizard.tsx
// Intake turn loop: replaces the hardcoded seven-step wizard. Each turn the
// orchestrator extracts facts into slots and picks the single most valuable
// gap to ask. Every change goes through store.dispatch (the single command
// bus); nothing calls applyCommand directly.

import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  emptyProject,
  type CommandId,
  type PageId,
} from '../core'
import { QuilStore } from '../app/store'
import { projectRepository } from '../persistence'
import { mockProvider } from '../modules/intake/mock-provider'
import {
  Button,
  Textarea,
  Chip,
  FeatherPen,
  PenLoader,
} from '../ui'
import {
  createIntakeSession,
  step,
  MAX_TURNS,
  type IntakeSession,
  type IntakeTurnResult,
  type TurnQuestion,
} from '../modules/intake/orchestrator'

const PROGRESS_BAR_HEIGHT = 3

export function IntakeWizard(): React.ReactElement {
  const navigate = useNavigate()

  const storeRef = React.useRef<QuilStore | null>(null)
  if (!storeRef.current) storeRef.current = new QuilStore(emptyProject())
  const store = storeRef.current

  const [session, setSession] = React.useState<IntakeSession>(createIntakeSession)
  const [inputValue, setInputValue] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState<'active' | 'done'>('active')

  const _baseRev = store.getState().rev

  const handleUserTurn = async (userTurn: string): Promise<void> => {
    setError(null)
    if (!userTurn.trim()) return
    setSaving(true)
    try {
      const currentRev = store.getState().rev
      const result: IntakeTurnResult = await step(session, userTurn, mockProvider, currentRev)
      // Commit the intake update through the single command bus.
      if (result.command) {
        result.command.baseRev = currentRev
        const commit = store.dispatch(result.command)
        if (!commit.ok) {
          setError(commit.error.message)
          setSaving(false)
          return
        }
      }
      setSession(result.session)
      setInputValue('')
      if (result.done) {
        setStatus('done')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Intake turn failed')
    } finally {
      setSaving(false)
    }
  }

  const handleOptionTap = (option: string): void => {
    void handleUserTurn(option)
  }

  const handleSkip = (): void => {
    // Skip just submits an empty turn; the orchestrator will ask the next gap.
    void handleUserTurn('')
  }

  const finishIntake = async (): Promise<void> => {
    setSaving(true)
    try {
      // Create pages from the confirmed 'pages' slot.
      const pagesSlot = session.slots.get('pages')
      const pageNames: string[] = pagesSlot?.value && Array.isArray(pagesSlot.value)
        ? pagesSlot.value
        : ['Home']

      const pageIdMap = new Map<string, PageId>()
      let cmd = 1
      const nextId = (): CommandId => `cmd-${cmd++}` as CommandId
      const rev = (): number => store.getState().rev

      // set_brief from the purpose slot
      const purposeSlot = session.slots.get('purpose')
      let brief: string = 'Untitled project'
      if (purposeSlot && typeof purposeSlot.value === 'string') {
        brief = purposeSlot.value
      }
      const r0 = store.dispatch({
        type: 'set_brief',
        commandId: nextId(),
        baseRev: rev(),
        brief,
      })
      if (!r0.ok) throw new Error(r0.error.message)

      // Commit each intake answer as a set_intake_answer command
      for (const [key, slot] of session.slots) {
        if (slot.value === undefined || slot.value === null) continue
        const answer = Array.isArray(slot.value) ? slot.value.join(', ') : String(slot.value)
        const r = store.dispatch({
          type: 'set_intake_answer',
          commandId: nextId(),
          baseRev: rev(),
          questionId: key,
          answer,
        })
        if (!r.ok) throw new Error(r.error.message)
      }

      // add_page for each confirmed page
      for (const pageName of pageNames) {
        const pageId = `page-${String(pageName).toLowerCase().replace(/\s+/g, '-')}` as PageId
        pageIdMap.set(String(pageName), pageId)
        const r = store.dispatch({
          type: 'add_page',
          commandId: nextId(),
          baseRev: rev(),
          pageId,
          name: String(pageName),
        })
        if (!r.ok) throw new Error(r.error.message)
      }

      // set_starting_page (default to first page)
      const startingSlot = session.slots.get('startingPage')
      let startName: string = pageNames[0] ?? 'Home'
      if (startingSlot && typeof startingSlot.value === 'string') {
        startName = startingSlot.value
      }
      const startPageId = pageIdMap.get(startName) ?? [...pageIdMap.values()][0]!
      const rStart = store.dispatch({
        type: 'set_starting_page',
        commandId: nextId(),
        baseRev: rev(),
        pageId: startPageId,
      })
      if (!rStart.ok) throw new Error(rStart.error.message)

      await projectRepository.init()
      await projectRepository.writeSnapshot(store.getState().projectId, store.getState())

      navigate(`/p/${store.getState().projectId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setSaving(false)
    }
  }

  const currentQuestion: TurnQuestion | undefined = session.lastQuestion
    ? {
        kind: 'ask',
        slots: [],
        question: session.lastQuestion,
        options: [],
        why: '',
      }
    : undefined

  const progress = status === 'done' ? 100 : Math.min(100, Math.round((session.turnIdCounter / MAX_TURNS) * 100))

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--quil-bg)',
        color: 'var(--quil-text-100)',
        fontFamily: 'var(--quil-font-ui)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Progress bar */}
      <div
        style={{
          height: `${PROGRESS_BAR_HEIGHT}px`,
          background: 'var(--quil-line)',
          width: '100%',
        }}
      >
        <div
          style={{
            height: '100%',
            background: 'var(--quil-accent)',
            width: `${progress}%`,
            transition: 'width var(--quil-duration-press) ease-out',
          }}
        />
      </div>

      <div style={{ padding: 'var(--quil-space-8) var(--quil-space-4)', flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ marginBottom: 'var(--quil-space-6)' }}>
            <span
              style={{
                fontSize: 'var(--quil-text-xs)',
                color: 'var(--quil-text-70)',
                fontFamily: 'var(--quil-font-head)',
                letterSpacing: '0.05em',
              }}
            >
              Intake — turn {session.turnIdCounter} of {MAX_TURNS}
            </span>
            <h1
              style={{
                fontSize: 'var(--quil-heading-1)',
                fontFamily: 'var(--quil-font-head)',
                margin: 'var(--quil-space-1) 0 var(--quil-space-2) 0',
                lineHeight: 1.1,
              }}
            >
              {status === 'done' ? 'Review complete' : currentQuestion?.question ?? 'Starting intake…'}
            </h1>
            {currentQuestion?.why && (
              <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginTop: 'var(--quil-space-1)' }}>
                {currentQuestion.why}
              </p>
            )}
          </div>

          {error && (
            <div
              data-testid="intake-error"
              style={{
                padding: 'var(--quil-space-2) var(--quil-space-3)',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 'var(--quil-radius-sm)',
                fontSize: 'var(--quil-text-sm)',
                border: '1px solid #fecaca',
                marginBottom: 'var(--quil-space-4)',
              }}
            >
              {error}
            </div>
          )}

          {status === 'done' ? (
            <div>
              <div style={{ color: '#16a34a', fontWeight: 600, marginBottom: 'var(--quil-space-1)' }}>
                ✓ Intake complete
              </div>
              <div style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>
                All required decisions are confirmed. Creating your project…
              </div>
              <Button
                data-testid="intake-create-project"
                onClick={finishIntake}
                disabled={saving}
                style={buttonBase}
              >
                {saving ? <PenLoader size={20} loading={true} /> : 'Create project'}
              </Button>
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative' }}>
                <Textarea
                  data-testid="intake-input"
                  placeholder="Type your answer…"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  rows={4}
                />
                <FeatherPen
                  style={{ position: 'absolute', right: 'var(--quil-space-3)', top: 'var(--quil-space-4)', pointerEvents: 'none' }}
                  size={16}
                />
              </div>
              {currentQuestion?.options && currentQuestion.options.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                    gap: 'var(--quil-space-2)',
                    marginTop: 'var(--quil-space-3)',
                  }}
                >
                  {currentQuestion.options.map((opt) => (
                    <Chip
                      key={opt}
                      variant="default"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOptionTap(opt)}
                    >
                      {opt}
                    </Chip>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 'var(--quil-space-3)', display: 'flex', gap: 'var(--quil-space-2)', alignItems: 'center' }}>
                <Button
                  data-testid="intake-submit"
                  onClick={() => void handleUserTurn(inputValue)}
                  disabled={saving || !inputValue.trim()}
                  style={buttonBase}
                >
                  {saving ? <PenLoader size={20} loading={true} /> : 'Submit'}
                </Button>
                <button
                  data-testid="intake-skip"
                  onClick={handleSkip}
                  style={{
                    background: 'transparent',
                    border: '1px dashed var(--quil-line)',
                    color: 'var(--quil-text-70)',
                    fontSize: 'var(--quil-text-sm)',
                    fontFamily: 'var(--quil-font-ui)',
                    padding: '0 var(--quil-space-2)',
                    cursor: 'pointer',
                  }}
                >
                  Skip
                </button>
                <button
                  data-testid="intake-enough"
                  onClick={() => {
                    // Treat 'That's enough' as a done signal: mark remaining
                    // required slots and finish.
                    void handleUserTurn("That's enough")
                  }}
                  style={{
                    background: 'transparent',
                    border: '1px dashed var(--quil-line)',
                    color: 'var(--quil-text-70)',
                    fontSize: 'var(--quil-text-sm)',
                    fontFamily: 'var(--quil-font-ui)',
                    padding: '0 var(--quil-space-2)',
                    cursor: 'pointer',
                    marginLeft: 'var(--quil-space-2)',
                  }}
                >
                  That&apos;s enough
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
} as React.CSSProperties
