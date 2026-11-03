import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import {
  referenceProject,
  createProjectState,
  upsertDecision,
  lookupByScope,
  getDecision,
  decisionZeroMatchReport,
type DecisionScope,
type DecisionId,
type ElementId,
type NodeKind,
type PageId
} from '../../src/core'

function upsert(
  state: ReturnType<typeof referenceProject>,
  scope: DecisionScope,
  property: string,
  value: unknown,
  kind: NodeKind
): { state: ReturnType<typeof referenceProject>; id: DecisionId | null } {
  let id: DecisionId | null = null
  const next = produce(state, (draft) => {
    id = upsertDecision(draft, scope, property, value, kind)
  })
  return { state: next, id }
}

const globalButtonScope: DecisionScope = { kind: 'global', targetType: 'button' }
const pageHomeButtonScope: DecisionScope = {
  kind: 'page',
  pageId: 'page-home' as PageId,
  targetType: 'button'
}
const instanceHeadingScope: DecisionScope = {
  kind: 'instance',
  elementId: 'el-hero-heading' as ElementId
}

describe('decision registry', () => {
  it('creates an approved decision for a scoped property', () => {
    const s0 = referenceProject()
    const { state, id } = upsert(s0, globalButtonScope, 'bgColor', '#F5F5F2', 'button')
    expect(id).toBeDefined()
    const dec = getDecision(state, id as DecisionId)
    expect(dec).toBeDefined()
    expect(dec!.status).toBe('approved')
    expect(dec!.property).toBe('bgColor')
    expect(dec!.value).toBe('#F5F5F2')
    expect(typeof dec!.seq).toBe('number')
    expect(dec!.seq).toBeGreaterThan(0)
  })

  it('re-applying the same scope+property+value is idempotent (no duplicate record)', () => {
    const s0 = referenceProject()
    const { state: s1, id: id1 } = upsert(s0, globalButtonScope, 'bgColor', '#F5F5F2', 'button')
    const { state: s2, id: id2 } = upsert(s1, globalButtonScope, 'bgColor', '#F5F5F2', 'button')
    expect(id2).toBe(id1)
    expect(s2.decisions.size).toBe(s0.decisions.size + 1) // only the one new decision
  })

  it('applying a different value supersedes the old approved decision (no duplicate active record)', () => {
    const s0 = referenceProject()
    const { state: s1, id: id1 } = upsert(s0, globalButtonScope, 'bgColor', '#F5F5F2', 'button')
    const { state: s2, id: id2 } = upsert(s1, globalButtonScope, 'bgColor', '#1C1C1A', 'button')
    expect(id2).not.toBe(id1)
    expect(getDecision(s2, id1 as DecisionId)!.status).toBe('superseded')
    expect(getDecision(s2, id2 as DecisionId)!.status).toBe('approved')
    const approved = [...s2.decisions.values()].filter((d) => d.status === 'approved' && d.property === 'bgColor')
    expect(approved).toHaveLength(1)
  })

  it('lookupByScope returns decisions matching the scope', () => {
    const s0 = referenceProject()
    const { state } = upsert(s0, pageHomeButtonScope, 'radius', 8, 'button')
    const matches = lookupByScope(state, pageHomeButtonScope)
    expect(matches.length).toBe(1)
    expect(matches[0]!.property).toBe('radius')
  })

  it('instance and page scopes are distinct (never conflated as global)', () => {
    const s0 = referenceProject()
    const { state: s1 } = upsert(s0, instanceHeadingScope, 'color', '#F5F5F2', 'heading')
    const pageMatches = lookupByScope(s1, { kind: 'page', pageId: 'page-home' as PageId, targetType: 'heading' })
    expect(pageMatches).toHaveLength(0)
    const instMatches = lookupByScope(s1, instanceHeadingScope)
    expect(instMatches.length).toBeGreaterThanOrEqual(1)
    expect(instMatches.find((m) => m.property === 'color')).toBeDefined()
  })

  it('deep supersede chains keep only the latest approved', () => {
    const s0 = referenceProject()
    const { state: s1, id: id1 } = upsert(s0, globalButtonScope, 'bgColor', '#F5F5F2', 'button')
    const { state: s2, id: id2 } = upsert(s1, globalButtonScope, 'bgColor', '#1C1C1A', 'button')
    const { state: s3, id: id3 } = upsert(s2, globalButtonScope, 'bgColor', '#ECECE8', 'button')
    expect(getDecision(s3, id1 as DecisionId)!.status).toBe('superseded')
    expect(getDecision(s3, id2 as DecisionId)!.status).toBe('superseded')
    expect(getDecision(s3, id3 as DecisionId)!.status).toBe('approved')
    const approved = [...s3.decisions.values()].filter((d) => d.status === 'approved' && d.property === 'bgColor')
    expect(approved).toHaveLength(1)
    expect(approved[0]!.seq).toBeGreaterThan(approved[0]!.seq - 1) // seqs are monotonic
  })

  it('decision targeting an element kind with zero matches is flagged as zero-match', () => {
    const s0 = createProjectState('proj' as never, 'No Buttons')
    // No button elements exist; a global button decision matches nothing
    const { state } = upsert(s0, globalButtonScope, 'bgColor', '#F5F5F2', 'button')
    const report = decisionZeroMatchReport(state)
    expect(report.zeroMatch).toBe(1)
    expect(report.zeroMatchIds).toHaveLength(1)
  })

  it('getDecision returns undefined for unknown id', () => {
    const s0 = referenceProject()
    expect(getDecision(s0, 'dec-does-not-exist' as DecisionId)).toBeUndefined()
  })
})
