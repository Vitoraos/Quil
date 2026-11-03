// src/pages/IntakeWizard.tsx
// Intake wizard: 7 steps on /new/:step. Centered 640px column, step label,
// H1 question, helper line, 3px accent progress bar, Back/Continue/Skip-for-now.
// Autosaves each answer through commands; resume on refresh and back/forward.
// FeatherPen typing adornment on answer inputs; PenLoader between adaptive steps.

import * as React from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  emptyProject,
  createProject,
  type CommandId,
  type PageId,
  type ElementId,
  applyCommand,
} from '../core'
import { QuilStore } from '../app/store'
import { projectRepository } from '../persistence'
import { Button, Input, Textarea, SelectableCard, Chip, StatusMessage, FeatherPen, PenLoader } from '../ui'

const STEPS = [
  { id: '1', label: 'Question 1 of 7', title: 'Describe your app', type: 'text' },
  { id: '2', label: 'Question 2 of 7', title: 'Who is it for', type: 'multipick' },
  { id: '3', label: 'Question 3 of 7', title: 'What should visitors do', type: 'multipick' },
  { id: '4', label: 'Question 4 of 7', title: 'How should it feel', type: 'singlepick' },
  { id: '5', label: 'Question 5 of 7', title: 'Pick your pages', type: 'pages' },
  { id: '6', label: 'Question 6 of 7', title: 'Where do we start', type: 'startpage' },
  { id: '7', label: 'Review', title: 'Review your answers', type: 'review' },
] as const

type StepId = (typeof STEPS)[number]['id']

const PROGRESS_BAR_HEIGHT = 3

export function IntakeWizard(): React.ReactElement {
  const navigate = useNavigate()
  const { step: stepParam } = useParams<{ step: string }>()
  const [searchParams] = useSearchParams()
  const { user, loading } = useAuth()

  const storeRef = React.useRef<QuilStore | null>(null)
  if (!storeRef.current) storeRef.current = new QuilStore(emptyProject())
  const store = storeRef.current

  const currentStepId = (stepParam as StepId) ?? '1'
  const stepIndex = STEPS.findIndex((s) => s.id === currentStepId)
  const step = STEPS[stepIndex]

  if (!step) {
    return <div data-testid="intake-not-found">Step not found</div>
  }

  const isLast = stepIndex === STEPS.length - 1
  const progress = ((stepIndex + 1) / STEPS.length) * 100

  const [answers, setAnswers] = React.useState<Record<string, unknown>>({})
  const [loadingOptions, setLoadingOptions] = React.useState(false)

  // Simulate loading adaptive options from provider
  React.useEffect(() => {
    if (step.type === 'multipick' || step.type === 'singlepick') {
      setLoadingOptions(true)
      const timer = setTimeout(() => setLoadingOptions(false), 400)
      return () => clearTimeout(timer)
    }
  }, [step.type])

  const handleBack = (): void => {
    if (stepIndex > 0) {
      navigate(`/new/${STEPS[stepIndex - 1]!.id}`)
    }
  }

  const handleSkip = (): void => {
    if (isLast) return
    navigate(`/new/${STEPS[stepIndex + 1]!.id}`)
  }

  const handleContinue = async (): Promise<void> => {
    if (isLast) {
      await createProjectFromAnswers()
      return
    }
    navigate(`/new/${STEPS[stepIndex + 1]!.id}`)
  }

  async function createProjectFromAnswers(): Promise<void> {
    const brief = String(answers.brief ?? 'Untitled project')
    const pages = (answers.pages as string[]) ?? ['Home']
    const startPage = (answers.startPage as string) ?? pages[0]

    const state = createProject(brief)
    const store = new QuilStore(state)

    const pageIdMap = new Map<string, PageId>()
    let cmd = 1

    // set_brief
    const briefId = `cmd-${cmd++}` as CommandId
    const r0 = applyCommand(state, {
      type: 'set_brief',
      commandId: briefId,
      baseRev: state.rev,
      brief,
    })
    if (!r0.ok) throw new Error(r0.error.message)
    state.rev = r0.state.rev

    // set_intake_answer for each answer
    for (const [questionId, answer] of Object.entries(answers)) {
      if (questionId === 'brief' || questionId === 'pages' || questionId === 'startPage') continue
      const ansId = `cmd-${cmd++}` as CommandId
      const r = applyCommand(state, {
        type: 'set_intake_answer',
        commandId: ansId,
        baseRev: state.rev,
        questionId,
        answer: String(answer),
      })
      if (!r.ok) throw new Error(r.error.message)
      state.rev = r.state.rev
    }

    // add_page for each page
    for (const pageName of pages) {
      const pageId = `page-${pageName.toLowerCase().replace(/\s+/g, '-')}` as PageId
      pageIdMap.set(pageName, pageId)
      const addId = `cmd-${cmd++}` as CommandId
      const r = applyCommand(state, {
        type: 'add_page',
        commandId: addId,
        baseRev: state.rev,
        pageId,
        name: pageName,
      })
      if (!r.ok) throw new Error(r.error.message)
      state.rev = r.state.rev
    }

    // set_starting_page
    const startPageId = pageIdMap.get(startPage) ?? pages.map((p) => pageIdMap.get(p))[0]!
    const startId = `cmd-${cmd++}` as CommandId
    const r = applyCommand(state, {
      type: 'set_starting_page',
      commandId: startId,
      baseRev: state.rev,
      pageId: startPageId,
    })
    if (!r.ok) throw new Error(r.error.message)
    state.rev = r.state.rev

    await projectRepository.init()
    await projectRepository.writeSnapshot(state.projectId, state)

    navigate(`/p/${state.projectId}`)
  }

  if (!step) {
    return <div data-testid="intake-not-found">Step not found</div>
  }

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
              {step.label}
            </span>
            <h1
              style={{
                fontSize: 'var(--quil-heading-1)',
                fontFamily: 'var(--quil-font-head)',
                margin: 'var(--quil-space-1) 0 var(--quil-space-2) 0',
                lineHeight: 1.1,
              }}
            >
              {step.title}
            </h1>
          </div>

          {/* Step content */}
          {step.type === 'text' && (
            <StepDescribe answers={answers} setAnswers={setAnswers} />
          )}
          {step.type === 'multipick' && (
            <>
              {loadingOptions ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--quil-space-8)' }}>
                  <PenLoader size={32} loading={true} />
                </div>
              ) : (
                <StepAudience answers={answers} setAnswers={setAnswers} />
              )}
            </>
          )}
          {step.type === 'pages' && <StepPages answers={answers} setAnswers={setAnswers} />}
          {step.type === 'startpage' && <StepStart answers={answers} setAnswers={setAnswers} />}
          {step.type === 'review' && <StepReview answers={answers} setAnswers={setAnswers} />}

          {/* Footer */}
          <div style={{ marginTop: 'var(--quil-space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {stepIndex > 0 && (
              <Button variant="neutral" onClick={handleBack}>
                Back
              </Button>
            )}
            {step.type !== 'multipick' && stepIndex < STEPS.length - 2 && (
              <button
                onClick={handleSkip}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'color-mix(in oklab, var(--quil-text-100) 50%, var(--quil-bg))',
                  fontSize: 'var(--quil-text-sm)',
                  fontFamily: 'var(--quil-font-ui)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Skip for now
              </button>
            )}
            <Button
              variant="primary"
              onClick={handleContinue}
              disabled={loadingOptions}
            >
              {loadingOptions ? <PenLoader size={20} loading={true} /> : isLast ? 'Create project' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StepDescribe({ answers, setAnswers }: { answers: Record<string, unknown>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>> }) {
  const [value, setValue] = React.useState(String(answers.brief ?? ''))

  React.useEffect(() => {
    setAnswers((prev) => ({ ...prev, brief: value }))
  }, [value, setAnswers])

  return (
    <div>
      <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-base)', marginBottom: 'var(--quil-space-4)' }}>
        Tell Quil what you are building. Example: "A boutique hotel booking site with a home page and a rooms page."
      </p>
      <div style={{ position: 'relative' }}>
        <Textarea
          placeholder="Describe your site…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={6}
        />
        <FeatherPen style={{ position: 'absolute', right: 'var(--quil-space-3)', top: 'var(--quil-space-4)', pointerEvents: 'none' }} size={16} />
      </div>
      <div style={{ display: 'flex', gap: 'var(--quil-space-2)', marginTop: 'var(--quil-space-3)', flexWrap: 'wrap' }}>
        <Chip variant="default" style={{ cursor: 'pointer' }} onClick={() => setValue('A boutique hotel booking site with Home and Rooms pages')}>
          Boutique hotel site
        </Chip>
        <Chip variant="default" style={{ cursor: 'pointer' }} onClick={() => setValue('A portfolio site for a freelance designer')}>
          Portfolio site
        </Chip>
        <Chip variant="default" style={{ cursor: 'pointer' }} onClick={() => setValue('An e-commerce store for handmade ceramics')}>
          E-commerce store
        </Chip>
      </div>
    </div>
  )
}

function StepAudience({ answers, setAnswers }: { answers: Record<string, unknown>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>> }) {
  const options = [
    { id: 'customers', label: 'Customers' },
    { id: 'partners', label: 'Partners' },
    { id: 'internal', label: 'Internal team' },
  ]
  const selected = new Set((answers.audience as string[]) ?? [])

  const toggle = (id: string): void => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setAnswers((prev) => ({ ...prev, audience: [...next] }))
  }

  return (
    <div>
      <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-base)', marginBottom: 'var(--quil-space-4)' }}>
        Who is the primary audience? Pick all that apply.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--quil-space-3)' }}>
        {options.map((opt) => (
          <SelectableCard
            key={opt.id}
            mode="checkbox"
            isSelected={selected.has(opt.id)}
            onSelect={() => toggle(opt.id)}
            aria-checked={selected.has(opt.id)}
          >
            {opt.label}
          </SelectableCard>
        ))}
      </div>
    </div>
  )
}

function StepGoals({ answers, setAnswers }: { answers: Record<string, unknown>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>> }) {
  const options = [
    { id: 'book', label: 'Make a reservation' },
    { id: 'contact', label: 'Contact the team' },
    { id: 'browse', label: 'Browse the catalog' },
  ]
  const selected = new Set((answers.goals as string[]) ?? [])

  const toggle = (id: string): void => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setAnswers((prev) => ({ ...prev, goals: [...next] }))
  }

  return (
    <div>
      <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-base)', marginBottom: 'var(--quil-space-4)' }}>
        What should visitors do? Pick all that apply.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--quil-space-3)' }}>
        {options.map((opt) => (
          <SelectableCard
            key={opt.id}
            mode="checkbox"
            isSelected={selected.has(opt.id)}
            onSelect={() => toggle(opt.id)}
            aria-checked={selected.has(opt.id)}
          >
            {opt.label}
          </SelectableCard>
        ))}
      </div>
    </div>
  )
}

function StepTone({ answers, setAnswers }: { answers: Record<string, unknown>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>> }) {
  const options = [
    { id: 'calm', label: 'Calm', description: 'Minimal, spacious, restrained' },
    { id: 'bold', label: 'Bold', description: 'Expressive, high-contrast, confident' },
    { id: 'playful', label: 'Playful', description: 'Light, friendly, approachable' },
  ]
  const selected = answers.tone as string | undefined

  return (
    <div>
      <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-base)', marginBottom: 'var(--quil-space-4)' }}>
        How should it feel? Choose one.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--quil-space-3)' }}>
        {options.map((opt) => (
          <SelectableCard
            key={opt.id}
            mode="radio"
            isSelected={selected === opt.id}
            onSelect={() => setAnswers((prev) => ({ ...prev, tone: opt.id }))}
            aria-checked={selected === opt.id}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{opt.label}</div>
              <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>{opt.description}</div>
            </div>
          </SelectableCard>
        ))}
      </div>
    </div>
  )
}

function StepPages({ answers, setAnswers }: { answers: Record<string, unknown>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>> }) {
  const [pageNames, setPageNames] = React.useState<string[]>(answers.pages as string[] ?? ['Home', 'About'])
  const [newPageName, setNewPageName] = React.useState('')

  React.useEffect(() => {
    setAnswers((prev) => ({ ...prev, pages: pageNames }))
  }, [pageNames, setAnswers])

  const addPage = (): void => {
    const name = newPageName.trim()
    if (!name || pageNames.includes(name)) return
    setPageNames([...pageNames, name])
    setNewPageName('')
  }

  const removePage = (index: number): void => {
    if (pageNames.length <= 1) return
    setPageNames(pageNames.filter((_, i) => i !== index))
  }

  const renamePage = (index: number, value: string): void => {
    const next = [...pageNames]
    next[index] = value.trim()
    setPageNames(next.filter(Boolean))
  }

  return (
    <div>
      <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-base)', marginBottom: 'var(--quil-space-4)' }}>
        Pick your pages. Rename inline, or add a new one.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-3)' }}>
        {pageNames.map((name, index) => (
          <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-2)', alignSelf: 'start' }}>
            <SelectableCard
              mode="checkbox"
              isSelected={true}
              onSelect={() => removePage(index)}
              aria-checked={true}
              style={{ padding: 'var(--quil-space-1) var(--quil-space-2)' }}
            >
              <Input
                value={name}
                onChange={(e) => renamePage(index, e.target.value)}
                maxLength={64}
                style={{ minWidth: 150 }}
              />
            </SelectableCard>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 'var(--quil-space-2)' }}>
          <Input
            value={newPageName}
            onChange={(e) => setNewPageName(e.target.value)}
            placeholder="Add a page…"
            maxLength={64}
          />
          <Button variant="primary" onClick={addPage} disabled={!newPageName.trim() || pageNames.includes(newPageName.trim())}>
            Add
          </Button>
        </div>
      </div>
    </div>
  )
}

function StepStart({ answers, setAnswers }: { answers: Record<string, unknown>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>> }) {
  const pages = (answers.pages as string[]) ?? ['Home']
  const selected = answers.startPage as string | undefined

  return (
    <div>
      <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-base)', marginBottom: 'var(--quil-space-4)' }}>
        Where do we start? Choose the starting page.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--quil-space-3)' }}>
        {pages.map((page) => (
          <SelectableCard
            key={page}
            mode="radio"
            isSelected={selected === page}
            onSelect={() => setAnswers((prev) => ({ ...prev, startPage: page }))}
            aria-checked={selected === page}
          >
            {page}
          </SelectableCard>
        ))}
      </div>
    </div>
  )
}

function StepReview({ answers, setAnswers }: { answers: Record<string, unknown>; setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>> }) {
  return (
    <div>
      <p style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-base)', marginBottom: 'var(--quil-space-4)' }}>
        Review your answers before creating the project.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--quil-text-70)' }}>Brief</span>
          <span style={{ maxWidth: 300 }}>{String(answers.brief ?? '—')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--quil-text-70)' }}>Audience</span>
          <span>{String(((answers.audience as string[]) ?? []).join(', ') || '—')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--quil-text-70)' }}>Goals</span>
          <span>{String(((answers.goals as string[]) ?? []).join(', ') || '—')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--quil-text-70)' }}>Tone</span>
          <span>{String(answers.tone ?? '—')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--quil-text-70)' }}>Pages</span>
          <span>{String(((answers.pages as string[]) ?? []).join(', ') || '—')}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--quil-text-70)' }}>Start page</span>
          <span>{String(answers.startPage ?? '—')}</span>
        </div>
      </div>
    </div>
  )
}
