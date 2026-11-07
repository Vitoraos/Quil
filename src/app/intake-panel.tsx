import * as React from 'react'
import { useState } from 'react'
import type { PageId, ProjectState } from '../core'
import { QuilStore } from './store'
import { newCommandId } from './command-id'
import { mockProvider } from '../modules/intake/mock-provider'
import type { GeneratedPageSpec, FollowUpQuestion } from '../modules/intake/provider'
import { pageSpecSchema, validatePageSpec } from '../core/specs'

type IntakeStep = 'brief' | 'questions' | 'pages' | 'spec' | 'skeleton' | 'done'

interface IntakePanelProps {
  store: QuilStore
  state: ProjectState
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

const buttonDisabled = {
  ...buttonBase,
  opacity: 0.5,
  cursor: 'not-allowed',
  boxShadow: 'none',
} as React.CSSProperties

export function IntakePanel({ store, state }: IntakePanelProps): React.ReactElement {
  const [step, setStep] = useState<IntakeStep>('brief')
  const [brief, setBrief] = useState(state.brief)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [questions, setQuestions] = useState<FollowUpQuestion[]>([])
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0)
  const [pages, setPages] = useState<{ id: PageId; name: string }[]>([])
  const [pageNames, setPageNames] = useState<Record<PageId, string>>({})
  const [selectedPageId, setSelectedPageId] = useState<PageId | null>(null)
  const [editingSpec, setEditingSpec] = useState<GeneratedPageSpec | null>(null)
  const [_specBeingEdited, setSpecBeingEdited] = useState<PageId | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const _existingSpec = state.pageSpecs.get(selectedPageId ?? '' as PageId)
  const _hasSpecForPage = selectedPageId ? !!state.pageSpecs.get(selectedPageId) : false

  const goBrief = (): void => {
    setError(null)
    setStep('brief')
  }

  const submitBrief = async (): Promise<void> => {
    setError(null)
    if (!brief.trim()) {
      setError('Brief is required')
      return
    }
    if (brief.length > 5000) {
      setError('Brief is too long (max 5000 characters)')
      return
    }
    setSaving(true)
    try {
      const qs = await mockProvider.generateFollowUpQuestions({ brief, answers })
      setQuestions(qs)
      setCurrentQuestionIdx(0)
      setStep('questions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
    } finally {
      setSaving(false)
    }
  }

  const answerQuestion = (answer: string): void => {
    const q = questions[currentQuestionIdx]
    if (!q) return
    setAnswers({ ...answers, [q.id]: answer })
    const next = currentQuestionIdx + 1
    if (next < questions.length) {
      setCurrentQuestionIdx(next)
    } else {
      setStep('pages')
    }
  }

  const skipQuestion = (): void => {
    const next = currentQuestionIdx + 1
    if (next < questions.length) {
      setCurrentQuestionIdx(next)
    } else {
      setStep('pages')
    }
  }

  const suggestPages = async (): Promise<void> => {
    setError(null)
    setSaving(true)
    try {
      const suggestions = await mockProvider.suggestPages({ brief, answers })
      const newPages: { id: PageId; name: string }[] = []
      const newNames: Record<PageId, string> = {}
      suggestions.forEach((s, i) => {
        const id = `page-${i + 1}` as PageId
        newPages.push({ id, name: s.name })
        newNames[id] = s.name
      })
      setPages(newPages)
      setPageNames(newNames)
      // Also persist pages via commands
      newPages.forEach((p) => {
        if (!state.pages.has(p.id)) {
          store.dispatch({
            type: 'add_page',
            commandId: newCommandId('add-page'),
            baseRev: store.getState().rev,
            pageId: p.id,
            name: p.name
          })
        }
      })
      setStep('pages')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to suggest pages')
    } finally {
      setSaving(false)
    }
  }

  const addPage = (): void => {
    const id = `page-${pages.length + 1}` as PageId
    const name = `Page ${pages.length + 1}`
    setPages([...pages, { id, name }])
    setPageNames({ ...pageNames, [id]: name })
    store.dispatch({
      type: 'add_page',
      commandId: newCommandId('add-page'),
      baseRev: store.getState().rev,
      pageId: id,
      name
    })
  }

  const removePage = (id: PageId): void => {
    setPages(pages.filter((p) => p.id !== id))
    const newNames = { ...pageNames }
    delete newNames[id]
    setPageNames(newNames)
    if (selectedPageId === id) setSelectedPageId(null)
    store.dispatch({
      type: 'remove_page',
      commandId: newCommandId('remove-page'),
      baseRev: store.getState().rev,
      pageId: id
    })
  }

  const renamePage = (id: PageId, name: string): void => {
    setPageNames({ ...pageNames, [id]: name })
    setPages(pages.map((p) => (p.id === id ? { ...p, name } : p)))
    store.dispatch({
      type: 'rename_page',
      commandId: newCommandId('rename-page'),
      baseRev: store.getState().rev,
      pageId: id,
      name
    })
  }

  const selectPage = (id: PageId): void => {
    setSelectedPageId(id)
    setSpecBeingEdited(id)
    const existing = state.pageSpecs.get(id)
    if (existing) {
      setEditingSpec({
        name: existing.name,
        purpose: existing.purpose,
        sections: existing.sections
      })
      detectConflicts(existing)
    } else {
      setEditingSpec(null)
      setConflicts([])
    }
  }

  const updateSpecField = (field: 'name' | 'purpose', value: string): void => {
    if (!editingSpec) return
    setEditingSpec({ ...editingSpec, [field]: value })
  }

  const updateElementPurpose = (sectionKey: string, elementKey: string, value: string): void => {
    if (!editingSpec) return
    setEditingSpec({
      ...editingSpec,
      sections: editingSpec.sections.map((s) =>
        s.key === sectionKey
          ? {
              ...s,
              elements: s.elements.map((e) =>
                e.key === elementKey ? { ...e, purpose: value } : e
              )
            }
          : s
      )
    })
  }

  const saveSpec = (): void => {
    if (!editingSpec || !selectedPageId) return
    setError(null)
    const spec = pageSpecSchema.parse({
      pageId: selectedPageId,
      name: editingSpec.name,
      purpose: editingSpec.purpose,
      version: (state.pageSpecs.get(selectedPageId)?.version ?? 0) + 1,
      sections: editingSpec.sections.map((s) => ({
        key: s.key,
        purpose: s.purpose,
        elements: s.elements.map((e) => ({ ...e }))
      }))
    })
    const validationErrors = validatePageSpec(spec)
    if (validationErrors.length > 0) {
      setError(validationErrors.join('; '))
      return
    }
    store.dispatch({
      type: 'set_page_spec',
      commandId: `cmd-set-spec-${Date.now()}` as never,
      baseRev: store.getState().rev,
      pageId: selectedPageId,
      spec
    })
    detectConflicts(spec)
    setStep('skeleton')
  }

  const detectConflicts = (spec: GeneratedPageSpec): void => {
    const existing = state.pageSpecs.get(selectedPageId ?? '' as PageId)
    if (!existing) {
      setConflicts([])
      return
    }
    const oldKeys = new Set(
      existing.sections.flatMap((s) => s.elements.map((e) => e.key))
    )
    const newKeys = new Set(spec.sections.flatMap((s) => s.elements.map((e) => e.key)))
    const removed = [...oldKeys].filter((k) => !newKeys.has(k))
    const conflicts: string[] = []
    // Check decisions targeting removed elements
    state.decisions.forEach((dec) => {
      if (dec.scope.kind === 'instance' && removed.includes(dec.scope.elementId as unknown as string)) {
        conflicts.push(`Instance decision for '${dec.property}' targets removed element '${dec.scope.elementId}'`)
      }
    })
    setConflicts(conflicts)
  }

  const instantiateSkeleton = async (): Promise<void> => {
    if (!selectedPageId || !editingSpec) return
    setError(null)
    setSaving(true)
    try {
      store.dispatch({
        type: 'instantiate_spec_skeleton',
        commandId: newCommandId('instantiate'),
        baseRev: store.getState().rev,
        pageId: selectedPageId
      })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to instantiate skeleton')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      data-testid="intake-panel"
      style={{
        padding: 'var(--quil-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--quil-space-3)',
        overflow: 'auto',
      }}
    >
      <div data-testid="intake-header" style={{ fontWeight: 600, fontSize: 'var(--quil-text-lg)', fontFamily: 'var(--quil-font-head)' }}>
        Intake & Page Specification
      </div>

      {error && (
        <div
          data-testid="intake-error"
          style={{
            padding: 'var(--quil-space-2) var(--quil-space-3)',
            background: 'var(--quil-danger-bg)',
            color: 'var(--quil-danger-text)',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-sm)',
            border: `var(--quil-border-width) solid var(--quil-danger-line)`,
          }}
        >
          {error}
        </div>
      )}

      {conflicts.length > 0 && (
        <div
          data-testid="intake-conflicts"
          style={{
            padding: 'var(--quil-space-2) var(--quil-space-3)',
            background: 'var(--quil-warning-bg)',
            color: 'var(--quil-warning-text)',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-sm)',
            border: `var(--quil-border-width) solid var(--quil-warning-line)`,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 'var(--quil-space-1)' }}>Conflicts:</div>
          {conflicts.map((c, i) => (
            <div key={i} style={{ marginLeft: 'var(--quil-space-2)', fontSize: 'var(--quil-text-xs)' }}>
              • {c}
            </div>
          ))}
        </div>
      )}

      {step === 'brief' && (
        <div>
          <div style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-2)' }}>
            Tell Quil about your site
          </div>
          <textarea
            data-testid="intake-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="e.g. A marketing site with Home, About, and Contact pages"
            style={{
              width: '100%',
              minHeight: 120,
              padding: 'var(--quil-space-2)',
              border: `1px solid var(--quil-line)`,
              borderRadius: 'var(--quil-radius-sm)',
              background: 'var(--quil-bg)',
              color: 'var(--quil-text-100)',
              fontFamily: 'var(--quil-font-ui)',
              fontSize: 'var(--quil-text-sm)',
            }}
          />
          <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', marginTop: 'var(--quil-space-1)' }}>
            Max 5000 characters
          </div>
          <button
            data-testid="intake-submit-brief"
            onClick={submitBrief}
            disabled={saving || !brief.trim()}
            style={buttonDisabled}
          >
            {saving ? 'Generating questions…' : 'Next: Questions'}
          </button>
        </div>
      )}

      {step === 'questions' && (
        <div>
          <div style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-2)' }}>
            Answer a few questions (optional)
          </div>
          {questions[currentQuestionIdx] && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 'var(--quil-space-2)' }}>
                {questions[currentQuestionIdx].question}
              </div>
              {(questions[currentQuestionIdx].options ?? []).map((opt, i) => (
                <button
                  key={i}
                  onClick={() => answerQuestion(opt)}
                  style={{
                    ...buttonBase,
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    marginBottom: 'var(--quil-space-1)',
                  }}
                >
                  {opt}
                </button>
              ))}
              <button
                data-testid="intake-skip-question"
                onClick={skipQuestion}
                style={{
                  ...buttonBase,
                  background: 'transparent',
                  border: '1px dashed var(--quil-line)',
                  color: 'var(--quil-text-70)',
                  marginTop: 'var(--quil-space-2)',
                }}
              >
                Skip
              </button>
            </div>
          )}
          <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', marginTop: 'var(--quil-space-1)' }}>
            Question {currentQuestionIdx + 1} of {questions.length}
          </div>
        </div>
      )}

      {step === 'pages' && (
        <div>
          <div style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-2)' }}>
            Suggested pages
          </div>
          <button
            data-testid="intake-suggest-pages"
            onClick={suggestPages}
            disabled={saving}
            style={buttonDisabled}
          >
            {saving ? 'Suggesting…' : 'Suggest pages'}
          </button>
          <button
            data-testid="intake-add-page"
            onClick={addPage}
            style={buttonBase}
          >
            Add page
          </button>
          <div style={{ marginTop: 'var(--quil-space-2)' }}>
            {pages.map((p) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--quil-space-2)', marginBottom: 'var(--quil-space-1)' }}>
                <input
                  value={pageNames[p.id] ?? p.name}
                  onChange={(e) => renamePage(p.id, e.target.value)}
                  style={{
                    flex: 1,
                    padding: 'var(--quil-space-1)',
                    border: `1px solid var(--quil-line)`,
                    borderRadius: 'var(--quil-radius-sm)',
                    background: 'var(--quil-bg)',
                    color: 'var(--quil-text-100)',
                    fontSize: 'var(--quil-text-sm)',
                  }}
                />
                <button
                  onClick={() => selectPage(p.id)}
                  style={{
                    ...buttonBase,
                    background: selectedPageId === p.id ? 'var(--quil-accent)' : 'transparent',
                    color: selectedPageId === p.id ? 'var(--quil-bg)' : 'var(--quil-text-100)',
                    padding: '0 var(--quil-space-2)',
                  }}
                >
                  {selectedPageId === p.id ? 'Selected' : 'Select'}
                </button>
                <button
                  onClick={() => removePage(p.id)}
                  style={{
                    ...buttonBase,
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: 'var(--quil-text-70)',
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {step === 'spec' && selectedPageId && editingSpec && (
        <div>
          <div style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-2)' }}>
            Edit spec for {pageNames[selectedPageId] ?? selectedPageId}
          </div>
          <input
            data-testid="intake-spec-name"
            value={editingSpec.name}
            onChange={(e) => updateSpecField('name', e.target.value)}
            placeholder="Page name"
            style={{
              width: '100%',
              padding: 'var(--quil-space-1)',
              border: `1px solid var(--quil-line)`,
              borderRadius: 'var(--quil-radius-sm)',
              background: 'var(--quil-bg)',
              color: 'var(--quil-text-100)',
              fontSize: 'var(--quil-text-sm)',
              marginBottom: 'var(--quil-space-2)',
            }}
          />
          <textarea
            value={editingSpec.purpose}
            onChange={(e) => updateSpecField('purpose', e.target.value)}
            placeholder="Purpose of this page"
            style={{
              width: '100%',
              minHeight: 60,
              padding: 'var(--quil-space-1)',
              border: `1px solid var(--quil-line)`,
              borderRadius: 'var(--quil-radius-sm)',
              background: 'var(--quil-bg)',
              color: 'var(--quil-text-100)',
              fontFamily: 'var(--quil-font-ui)',
              fontSize: 'var(--quil-text-sm)',
              marginBottom: 'var(--quil-space-2)',
            }}
          />
          {editingSpec.sections.map((section) => (
            <div key={section.key} style={{ marginBottom: 'var(--quil-space-3)' }}>
              <div style={{ fontWeight: 600, marginBottom: 'var(--quil-space-1)' }}>{section.key}</div>
              <input
                value={section.purpose}
                onChange={(_e) => {
                  // Purpose edit not implemented inline for brevity
                }}
                style={{
                  width: '100%',
                  padding: 'var(--quil-space-1)',
                  border: `1px solid var(--quil-line)`,
                  borderRadius: 'var(--quil-radius-sm)',
                  background: 'var(--quil-bg)',
                  color: 'var(--quil-text-70)',
                  fontSize: 'var(--quil-text-xs)',
                  opacity: 0.6,
                }}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--quil-space-1)' }}>
                {section.elements.map((el) => (
                  <div
                    key={el.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--quil-space-1)',
                      padding: 'var(--quil-space-1)',
                      border: `1px solid var(--quil-line)`,
                      borderRadius: 'var(--quil-radius-sm)',
                      background: 'var(--quil-surface)',
                    }}
                  >
                    <span style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', width: 80 }}>
                      {el.key}
                    </span>
                    <span style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', width: 60 }}>
                      {el.kind}
                    </span>
                    <input
                      value={el.purpose}
                      onChange={(e) => updateElementPurpose(section.key, el.key, e.target.value)}
                      style={{
                        flex: 1,
                        padding: 'var(--quil-space-1)',
                        border: `1px solid var(--quil-line)`,
                        borderRadius: 'var(--quil-radius-sm)',
                        background: 'var(--quil-bg)',
                        color: 'var(--quil-text-100)',
                        fontSize: 'var(--quil-text-xs)',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 'var(--quil-text-xs)',
                        color: el.required ? 'var(--quil-accent)' : 'var(--quil-text-70)',
                      }}
                    >
                      {el.required ? 'required' : 'optional'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            data-testid="intake-save-spec"
            onClick={saveSpec}
            disabled={saving}
            style={buttonDisabled}
          >
            {saving ? 'Saving…' : 'Save spec & continue'}
          </button>
        </div>
      )}

      {step === 'skeleton' && selectedPageId && (
        <div>
          <div style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-2)' }}>
            Skeleton page for {pageNames[selectedPageId] ?? selectedPageId}
          </div>
          <div style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginBottom: 'var(--quil-space-2)' }}>
            Instantiating spec elements into the canvas tree. This creates the initial element structure.
          </div>
          <button
            data-testid="intake-instantiate"
            onClick={instantiateSkeleton}
            disabled={saving}
            style={buttonDisabled}
          >
            {saving ? 'Instantiating…' : 'Create skeleton page'}
          </button>
        </div>
      )}

      {step === 'done' && (
        <div>
          <div style={{ color: 'var(--quil-success-strong)', fontWeight: 600, marginBottom: 'var(--quil-space-1)' }}>
            ✓ Intake complete
          </div>
          <div style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)' }}>
            The project now has pages and a skeleton structure. Select elements on the canvas to edit them.
          </div>
          <button
            data-testid="intake-restart"
            onClick={goBrief}
            style={buttonBase}
          >
            Start over
          </button>
        </div>
      )}
    </div>
  )
}
