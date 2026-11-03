// Module E (Phase 6): Generation panel UI.
// Generate, preview, approve, reject, regenerate loop for targeted edits.
//
// The AI outputs component instances that conform to strict ComponentDef
// schemas ("valid by design"). Quil validates them in code. The user sees
// variant cards in this panel; tapping one shows a live preview overlay on
// the canvas; approving commits via apply_candidate through the command bus.

import * as React from 'react'
import { useCallback, useState } from 'react'
import type { ElementId, PageId, ProjectState } from '../core'
import { QuilStore } from './store'
import {
  buildGenerationContext,
  dedupeCandidates,
  validateCandidate,
  Candidate,
  CandidateValidationResult,
  targetDefs,
  type TargetType
} from '../core/generation'

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
  cursor: 'pointer'
} as React.CSSProperties

const buttonDisabled = {
  ...buttonBase,
  opacity: 0.5,
  cursor: 'not-allowed',
  boxShadow: 'none'
} as React.CSSProperties

// Mock provider: deterministic candidates for testing.
// In production this would be replaced by a real AI provider (BYOK).
const MOCK_CANDIDATES: Record<string, Candidate[]> = {
  'sec-hero': [
    {
      candidateId: 'cand-hero-1' as never,
      componentDefId: 'hero',
      targetId: 'sec-hero' as never,
      props: { bgColor: '#1C1C1A', textColor: '#F5F3EC', padding: { value: 48 } },
      explanation: 'Dark hero background with light text for contrast'
    },
    {
      candidateId: 'cand-hero-2' as never,
      componentDefId: 'hero',
      targetId: 'sec-hero' as never,
      props: { bgColor: '#F5F5F2', textColor: '#1C1C1A', padding: { value: 32 } },
      explanation: 'Light hero background with dark text'
    },
    {
      candidateId: 'cand-hero-3' as never,
      componentDefId: 'hero',
      targetId: 'sec-hero' as never,
      props: { bgColor: '#000000', textColor: '#000000', padding: { value: 24 } },
      explanation: 'Black on black - should fail contrast'
    }
  ],
  'el-hero-cta': [
    {
      candidateId: 'cand-btn-1' as never,
      componentDefId: 'button',
      targetId: 'el-hero-cta' as never,
      props: { bgColor: '#7C3AED', textColor: '#F5F3EC', radius: 12, fontWeight: 700 },
      explanation: 'Violet button with light text, rounded corners'
    },
    {
      candidateId: 'cand-btn-2' as never,
      componentDefId: 'button',
      targetId: 'el-hero-cta' as never,
      props: { bgColor: '#1C1C1A', textColor: '#F5F3EC', radius: 6, fontWeight: 600 },
      explanation: 'Dark button with light text, moderate radius'
    },
    {
      candidateId: 'cand-btn-3' as never,
      componentDefId: 'button',
      targetId: 'el-hero-cta' as never,
      props: { bgColor: '#F5F3EC', textColor: '#F5F3EC', radius: 999, fontWeight: 9999 },
      explanation: 'Same color bg/text, invalid radius and fontWeight'
    }
  ]
}

const TARGET_LABELS: Record<TargetType, string> = {
  hero: 'Hero background',
  button: 'Button treatment'
}

const TARGET_IDS: Record<TargetType, ElementId> = {
  hero: 'sec-hero' as never,
  button: 'el-hero-cta' as never
}

interface GenerationPanelProps {
  store: QuilStore
  state: ProjectState
  candidates: Candidate[]
  activeIndex: number | null
  onGenerate: (candidates: Candidate[], activeIndex: number | null) => void
  onApprove: (candidate: Candidate) => void
  onReject: () => void
  onRegenerate: () => void
  onSelectIndex: (index: number) => void
}

export function GenerationPanel({
  store,
  state,
  candidates,
  activeIndex,
  onGenerate,
  onApprove,
  onReject,
  onRegenerate,
  onSelectIndex
}: GenerationPanelProps): React.ReactElement {
  const [targetType, setTargetType] = useState<TargetType>('hero')
  const [stale, setStale] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [baseRev, setBaseRev] = useState<number>(0)
  const [registryVersion, setRegistryVersion] = useState<number>(0)

  const currentTargetId: ElementId = TARGET_IDS[targetType]!

  const generateCandidates = useCallback(async (): Promise<void> => {
    setError(null)

    const contextResult = buildGenerationContext(state, currentTargetId, targetType)
    if (!contextResult.ok) {
      setError(contextResult.error.message)
      return
    }

    const context = contextResult.context
    setBaseRev(context.targetRev)
    setRegistryVersion(context.decisionRegistryVersion)

    const mockCandidates = MOCK_CANDIDATES[currentTargetId] ?? []

    // Validate each candidate against the context
    const validated: Array<{ candidate: Candidate; result: CandidateValidationResult }> = []
    for (const c of mockCandidates) {
      const result = validateCandidate(context, c, candidates)
      validated.push({ candidate: c, result })
    }

    const validCandidates = validated.filter((v) => v.result.ok).map((v) => v.candidate)
    const nextCandidates = dedupeCandidates(validCandidates.length > 0 ? validCandidates : mockCandidates.slice(0, 3))

    const nextValidations = new Map<string, CandidateValidationResult>()
    for (const v of validated) {
      nextValidations.set(v.candidate.candidateId, v.result)
    }

    onGenerate(nextCandidates, nextCandidates.length > 0 ? 0 : null)
  }, [state, targetType, currentTargetId, candidates, onGenerate])

  const checkStale = useCallback((): boolean => {
    const contextResult = buildGenerationContext(state, currentTargetId, targetType)
    if (!contextResult.ok) return false
    const context = contextResult.context
    const isStale = context.targetRev !== baseRev || context.decisionRegistryVersion !== registryVersion
    setStale(isStale)
    return isStale
  }, [state, currentTargetId, targetType, baseRev, registryVersion])

  const handleApprove = useCallback((): void => {
    if (activeIndex === null || !candidates[activeIndex]) return

    if (checkStale()) {
      setError('Target has changed since generation. Regenerate before approving.')
      return
    }

    const candidate = candidates[activeIndex]
    onApprove(candidate)
  }, [activeIndex, candidates, state, currentTargetId, targetType, baseRev, registryVersion, checkStale, onApprove])

  const targetDef = targetDefs[targetType]!

  return (
    <div
      data-testid="generation-panel"
      style={{
        padding: 'var(--quil-space-4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--quil-space-3)',
        overflow: 'auto',
        borderLeft: `1px solid var(--quil-line)`
      }}
    >
      <div data-testid="gen-header" style={{ fontWeight: 600, fontSize: 'var(--quil-text-lg)', fontFamily: 'var(--quil-font-head)' }}>
        Targeted Generation
      </div>

      {/* Target selector */}
      <div style={{ display: 'flex', gap: 'var(--quil-space-2)', marginBottom: 'var(--quil-space-2)' }}>
        {Object.keys(targetDefs).map((t) => {
          const tt = t as TargetType
          return (
            <button
              key={t}
              data-testid={`gen-target-${t}`}
              onClick={() => setTargetType(tt)}
              style={{
                ...(targetType === tt
                  ? { ...buttonBase, background: 'var(--quil-accent)', color: 'var(--quil-accent-text)' }
                  : buttonBase)
              }}
            >
              {TARGET_LABELS[tt]}
            </button>
          )
        })}
      </div>

      {/* Target definition (the "shape" the AI must conform to) */}
      <div
        data-testid="gen-target-def"
        style={{
          padding: 'var(--quil-space-2) var(--quil-space-3)',
          background: 'var(--quil-surface)',
          border: `1px solid var(--quil-line)`,
          borderRadius: 'var(--quil-radius-sm)',
          fontSize: 'var(--quil-text-xs)',
          color: 'var(--quil-text-70)',
          marginBottom: 'var(--quil-space-2)'
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 'var(--quil-space-1)' }}>{TARGET_LABELS[targetType]} definition</div>
        <div style={{ fontFamily: 'monospace', fontSize: 'var(--quil-text-xs)' }}>
          Allowed props: {targetDef.props.map((p) => p.property).join(', ')}
        </div>
      </div>

      {/* Generate button */}
      <button
        data-testid="gen-generate"
        onClick={generateCandidates}
        style={buttonBase}
      >
        Generate candidates
      </button>

      {error && (
        <div
          data-testid="gen-error"
          style={{
            padding: 'var(--quil-space-2) var(--quil-space-3)',
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-sm)',
            border: '1px solid #fecaca',
            marginBottom: 'var(--quil-space-2)'
          }}
        >
          {error}
        </div>
      )}

      {stale && (
        <div
          data-testid="gen-stale"
          style={{
            padding: 'var(--quil-space-2) var(--quil-space-3)',
            background: '#fef3c7',
            color: '#92400e',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-sm)',
            border: '1px solid #fcd34d',
            marginBottom: 'var(--quil-space-2)'
          }}
        >
          ⚠ Target has changed since generation. Regenerate before approving.
        </div>
      )}

      {/* Candidates as variant cards */}
      {candidates.length > 0 && (
        <>
          <div style={{ fontSize: 'var(--quil-text-sm)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-2)' }}>
            Candidates ({candidates.length}) — tap to preview live
          </div>
          {candidates.map((c, i) => {
            const contextResult = buildGenerationContext(state, currentTargetId, targetType)
            const context = contextResult.ok ? contextResult.context : null
            const validation = context ? validateCandidate(context, c, candidates) : null
            const isActive = i === activeIndex

            return (
              <div
                key={c.candidateId}
                data-testid={`gen-candidate-${i}`}
                style={{
                  border: `2px solid ${isActive ? 'var(--quil-accent)' : 'var(--quil-line)'}`,
                  borderRadius: 'var(--quil-radius-sm)',
                  padding: 'var(--quil-space-2)',
                  background: isActive ? 'var(--quil-surface-hover)' : 'var(--quil-surface)',
                  cursor: 'pointer',
                  transition: 'border-color var(--quil-duration-fast), background-color var(--quil-duration-fast)',
                  marginBottom: 'var(--quil-space-2)'
                }}
                onClick={() => onSelectIndex(i)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 'var(--quil-space-1)' }}>
                  <div style={{ fontWeight: 600, fontSize: 'var(--quil-text-sm)' }}>Candidate {i + 1}</div>
                  <span
                    style={{
                      fontSize: 'var(--quil-text-xs)',
                      padding: '1px 6px',
                      borderRadius: 4,
                      background: validation?.ok ? '#dcfce7' : '#fee2e2',
                      color: validation?.ok ? '#166534' : '#991b1b'
                    }}
                  >
                    {validation?.ok ? 'Valid' : 'Invalid'}
                  </span>
                </div>
                <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-1)' }}>
                  <span style={{ fontWeight: 600 }}>Def:</span> {c.componentDefId}
                  <span style={{ marginLeft: 'var(--quil-space-2)', fontWeight: 600 }}>Target:</span>{' '}
                  {c.targetId}
                </div>
                {/* Live preview card */}
                <div
                  data-testid={`gen-preview-${i}`}
                  style={{
                    width: 200,
                    height: 100,
                    marginBottom: 'var(--quil-space-1)',
                    borderRadius: 'var(--quil-radius-sm)',
                    overflow: 'hidden',
                    border: `1px solid var(--quil-line)`
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      backgroundColor:
                        typeof c.props.bgColor === 'string' ? c.props.bgColor : 'transparent',
                      color:
                        typeof c.props.textColor === 'string' ? c.props.textColor : '#000',
                      borderRadius:
                        typeof c.props.radius === 'number' ? `${c.props.radius}px` : '0',
                      padding:
                        typeof c.props.padding === 'object' &&
                        c.props.padding != null &&
                        typeof (c.props.padding as Record<string, unknown>).value === 'number'
                          ? `${(c.props.padding as Record<string, unknown>).value}px`
                          : 0,
                      fontSize:
                        typeof c.props.fontSize === 'object' &&
                        c.props.fontSize != null &&
                        typeof (c.props.fontSize as Record<string, unknown>).value === 'number'
                          ? `${(c.props.fontSize as Record<string, unknown>).value}${(c.props.fontSize as Record<string, unknown>).unit ?? 'px'}`
                          : '14px',
                      fontWeight:
                        typeof c.props.fontWeight === 'number'
                          ? c.props.fontWeight
                          : undefined,
                      fontFamily: 'var(--quil-font-ui)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center'
                    }}
                  >
                    {(c.props.bgColor || c.props.textColor
                      ? c.props.bgColor || c.props.textColor
                      : c.props.bgColor) as string}
                  </div>
                </div>
                <div style={{ fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)', marginBottom: 'var(--quil-space-1)' }}>
                  {c.explanation ?? ''}
                </div>
                <div style={{ marginTop: 'var(--quil-space-1)', fontSize: 'var(--quil-text-xs)', color: 'var(--quil-text-70)' }}>
                  {validation?.constraints.map((c) => (
                    <div key={c.name} style={{ display: 'flex', alignItems: 'start', gap: 'var(--quil-space-1)', marginBottom: 'var(--quil-space-0-5)' }}>
                      <span style={{ color: c.pass ? '#166534' : '#991b1b', fontSize: 'var(--quil-text-xs)' }}>
                        {c.pass ? '✓' : '✗'}
                      </span>
                      <span style={{ fontSize: 'var(--quil-text-xs)' }}>{c.message || c.name}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 'var(--quil-space-1)', marginTop: 'var(--quil-space-1)' }}>
                  <button
                    data-testid={`gen-approve-${i}`}
                    onClick={() => onApprove(c)}
                    disabled={stale || !(validation?.ok)}
                    style={{
                      ...buttonBase,
                      background: 'var(--quil-accent)',
                      color: 'var(--quil-accent-text)',
                      flex: 1,
                      fontSize: 'var(--quil-text-xs)',
                      padding: '0 var(--quil-space-2)'
                    }}
                  >
                    Approve
                  </button>
                  <button
                    data-testid={`gen-reject-${i}`}
                    onClick={onReject}
                    style={{
                      ...buttonBase,
                      background: 'transparent',
                      border: '1px solid var(--quil-line)',
                      color: 'var(--quil-text-70)',
                      flex: 1,
                      fontSize: 'var(--quil-text-xs)',
                      padding: '0 var(--quil-space-2)'
                    }}
                  >
                    Reject
                  </button>
                </div>
              </div>
            )
          })}
        </>
      )}

      {candidates.length === 0 && (
        <div style={{ color: 'var(--quil-text-70)', fontSize: 'var(--quil-text-sm)', marginTop: 'var(--quil-space-2)' }}>
          Select a target and generate candidates.
        </div>
      )}
    </div>
  )
}
