// Module E (Phase 6): Generation panel UI.
// Generate, preview, approve, reject, regenerate loop for targeted edits.
//
// The AI (mock provider or BYOK adapter) outputs component instances that
// conform to strict ComponentDef schemas ("valid by design"). Quil validates
// them in code. The user sees variant cards in this panel; tapping one shows
// a live preview overlay on the canvas; approving commits via apply_candidate
// through the command bus.

import * as React from 'react'
import { useCallback, useState } from 'react'
import type { ElementId, ProjectState } from '../core'
import { QuilStore } from './store'
import {
  dedupeCandidates,
  validateCandidate,
  Candidate,
  CandidateValidationResult,
  targetDefs,
  type TargetType,
  type GenerationContext,
  buildVariantContext
} from '../core/generation'
import { mockProvider } from '../modules/variants/mock-provider'
import { variantOutputSchema } from '../modules/variants/schemas'

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
  /** How many variants the user asked for (1–3). Caps the candidate list. */
  variantCount: number
  onGenerate: (candidates: Candidate[], activeIndex: number | null) => void
  onApprove: (candidate: Candidate) => void
  onReject: () => void
  onRegenerate: () => void
  onSelectIndex: (index: number) => void
}

export function GenerationPanel({
  store: _store,
  state,
  candidates,
  activeIndex,
  variantCount,
  onGenerate,
  onApprove,
  onReject,
  onRegenerate: _onRegenerate,
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

    // Build variant context from the resolved state (decisions, palette, etc.)
    const contextResult = buildVariantContext(state, currentTargetId, targetType)
    if (!contextResult.ok) {
      setError(contextResult.error.message)
      return
    }

    const context = contextResult.context
    setBaseRev(context.revisions.targetRev)
    setRegistryVersion(context.revisions.decisionVersion)

    // Ask the mock provider for proposals (in production this would be a BYOK adapter)
    const output = await mockProvider.proposeVariants({
      context,
      instruction: null
    })

    const parsed = variantOutputSchema.safeParse(output)
    if (!parsed.success) {
      setError(`Provider returned invalid proposals: ${parsed.error.issues.map((i) => i.message).join(', ')}`)
      return
    }

    // Map provider proposals → Candidate commands (app assigns candidateId/targetId)
    const proposals: Candidate[] = parsed.data.candidates.map((p, i) => ({
      candidateId: `cand-${Date.now()}-${i}` as never,
      componentDefId: p.componentDefId,
      targetId: currentTargetId,
      props: p.props,
      explanation: p.explanation
    }))

    // Validate each candidate against the context
    const validated: Array<{ candidate: Candidate; result: CandidateValidationResult }> = []
    for (const c of proposals) {
      const result = validateCandidate(context as unknown as GenerationContext, c, candidates)
      validated.push({ candidate: c, result })
    }

    const validCandidates = validated.filter((v) => v.result.ok).map((v) => v.candidate)
    const nextCandidates = dedupeCandidates(
      validCandidates.length > 0 ? validCandidates : proposals
    ).slice(0, variantCount)

    const nextValidations = new Map<string, CandidateValidationResult>()
    for (const v of validated) {
      nextValidations.set(v.candidate.candidateId, v.result)
    }

    onGenerate(nextCandidates, nextCandidates.length > 0 ? 0 : null)
  }, [state, targetType, currentTargetId, candidates, variantCount, onGenerate])

  const checkStale = useCallback((): boolean => {
    const contextResult = buildVariantContext(state, currentTargetId, targetType)
    if (!contextResult.ok) return false
    const context = contextResult.context
    const isStale = context.revisions.targetRev !== baseRev || context.revisions.decisionVersion !== registryVersion
    setStale(isStale)
    return isStale
  }, [state, currentTargetId, targetType, baseRev, registryVersion])

  const _handleApprove = useCallback((): void => {
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
        overflow: 'auto'
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
            background: 'var(--quil-danger-bg)',
            color: 'var(--quil-danger-text)',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-sm)',
            border: '1px solid var(--quil-danger-line)',
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
            background: 'var(--quil-warning-bg)',
            color: 'var(--quil-warning-text)',
            borderRadius: 'var(--quil-radius-sm)',
            fontSize: 'var(--quil-text-sm)',
            border: '1px solid var(--quil-warning-line)',
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
            const contextResult = buildVariantContext(state, currentTargetId, targetType)
            const context = contextResult.ok ? contextResult.context : null
            const validation = context ? validateCandidate(context as unknown as GenerationContext, c, candidates.filter((o) => o.candidateId !== c.candidateId)) : null
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
                  boxShadow: 'var(--quil-shadow-3)',
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
                      padding: 'var(--quil-space-0-5) var(--quil-space-1)',
                      borderRadius: 'var(--quil-radius-sm)',
                      background: validation?.ok ? 'var(--quil-success-bg)' : 'var(--quil-danger-bg)',
                      color: validation?.ok ? 'var(--quil-success-text)' : 'var(--quil-danger-text)'
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
                      <span style={{ color: c.pass ? 'var(--quil-success-text)' : 'var(--quil-danger-text)', fontSize: 'var(--quil-text-xs)' }}>
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
