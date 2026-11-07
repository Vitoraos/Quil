import { describe, expect, it } from 'vitest'
import {
  createProjectState,
  referenceProject,
  validateProject,
  type IntakeFact,
  type PageId,
  type FactId
} from '../src/core'

function fact(overrides: Partial<IntakeFact> = {}): IntakeFact {
  return {
    id: 'fact-1' as never,
    topic: 'product',
    question: 'What does the site do?',
    answer: 'It sells widgets.',
    basis: 'stated',
    confidence: 1,
    evidence: 'It sells widgets.',
    turnId: null,
    superseded: [],
    ...overrides
  }
}

describe('Phase 5 — validate.ts v4 invariants', () => {
  it('passes on the reference project (no v4 violations)', () => {
    const violations = validateProject(referenceProject())
    expect(violations).toEqual([])
  })

  // ── intake.facts bound ──────────────────────────────────────────────

  it('flags too many project-level facts (> maxFacts)', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    const facts = new Map<FactId, IntakeFact>()
    for (let i = 0; i < 41; i++) {
      facts.set(`fact-${i}` as FactId, fact({ id: `fact-${i}` as FactId }))
    }
    s0.facts = facts
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'fact-count-exceeded')).toBe(true)
  })

  // ── IntakeFact field validation ─────────────────────────────────────

  it('flags fact answer longer than maxFactAnswer', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.facts.set('fact-1' as never, fact({ answer: 'x'.repeat(501) }))
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'fact-answer-too-long')).toBe(true)
  })

  it('flags fact question longer than 280 chars', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.facts.set('fact-1' as never, fact({ question: 'x'.repeat(281) }))
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'fact-question-too-long')).toBe(true)
  })

  it('flags fact confidence out of 0..1 range', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.facts.set('fact-1' as never, fact({ confidence: 1.5 }))
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'fact-confidence')).toBe(true)
  })

  it('flags fact evidence that is not a substring of the turn text', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.facts.set('fact-1' as never, fact({ evidence: 'not-in-turn', turnId: 't-1' }))
    // evidence 'not-in-turn' is not a substring of any user text stored; the
    // invariant checks against the fact's own turn context is not stored here,
    // so we validate against an empty fallback — non-'user' evidence must still
    // be plausible. This test verifies the reducer stored bad evidence.
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'fact-evidence')).toBe(true)
  })

  it('flags fact superseded history exceeding 3', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.facts.set('fact-1' as never, fact({
      superseded: [
        { answer: 'v1', basis: 'stated', turnId: null },
        { answer: 'v2', basis: 'stated', turnId: null },
        { answer: 'v3', basis: 'stated', turnId: null },
        { answer: 'v4', basis: 'stated', turnId: null }
      ]
    }))
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'fact-superseded-exceeded')).toBe(true)
  })

  // ── pageIntake validation ───────────────────────────────────────────

  it('flags too many facts in a page intake (> maxFacts)', () => {
    const s0 = referenceProject()
    const pageIntakeFacts = new Map<FactId, IntakeFact>()
    for (let i = 0; i < 41; i++) {
      pageIntakeFacts.set(`fact-${i}` as FactId, fact({ id: `fact-${i}` as FactId }))
    }
    s0.pageIntake.set('page-home' as PageId, { slots: new Map(), facts: pageIntakeFacts })
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'page-fact-count-exceeded')).toBe(true)
  })

  // ── intakeStatus validation ─────────────────────────────────────────

  it('flags intakeStatus.pages referencing a missing page', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.intakeStatus.pages.set('page-ghost' as PageId, 'confirmed')
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'intake-status-dangling-page')).toBe(true)
  })

  // ── intakeRev / nextFactSeq ─────────────────────────────────────────

  it('flags negative intakeRev', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.intakeRev = -1
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'intake-rev-invalid')).toBe(true)
  })

  it('flags negative nextFactSeq', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.nextFactSeq = -1
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'next-fact-seq-invalid')).toBe(true)
  })

  // ── page spec stale detection ───────────────────────────────────────

  it('flags spec basedOnIntakeRev greater than intakeRev (stale)', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.pageSpecs.set('page-home' as PageId, {
      pageId: 'page-home' as PageId,
      name: 'Home',
      purpose: 'Landing',
      version: 1,
      status: 'draft',
      basedOnIntakeRev: 5,
      sections: [
        { key: 'hero', purpose: 'Hero', elements: [{ key: 'h1', kind: 'heading', purpose: 'H1', required: true }] }
      ]
    } as never)
    s0.intakeRev = 2
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'spec-stale')).toBe(true)
  })

  // ── spec status ─────────────────────────────────────────────────────

  it('flags invalid spec status', () => {
    const s0 = createProjectState('proj-x' as never, 'X')
    s0.pageSpecs.set('page-home' as PageId, {
      pageId: 'page-home' as PageId,
      name: 'Home',
      purpose: 'Landing',
      version: 1,
      status: 'archived' as never,
      basedOnIntakeRev: 0,
      sections: [
        { key: 'hero', purpose: 'Hero', elements: [{ key: 'h1', kind: 'heading', purpose: 'H1', required: true }] }
      ]
    } as never)
    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'spec-status-invalid')).toBe(true)
  })
})
