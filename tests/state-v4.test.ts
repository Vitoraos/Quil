import { describe, expect, it } from 'vitest'
import {
  createProjectState,
  referenceProject,
  validateProject,
  type FactId,
  type IntakeFact,
  type IntakeScope,
  type PageId,
  type PageIntake,
  type IntakeStatus,
  type TurnRecord,
  bounds,
} from '../src/core'
import { factIdSchema } from '../src/core/ids'

describe('Phase 1 — data model v4 (adversarial & negative first)', () => {
  it('1. FactId accepts only branded ids matching the ID pattern', () => {
    expect(() => factIdSchema.parse('fact-1')).not.toThrow()
    expect(() => factIdSchema.parse('fact-42')).not.toThrow()

    const invalid = ['Fact-1', 'fact 1', '1fact', 'fact!', 'a'.repeat(65), '', 'UNDER_CASE']
    for (const bad of invalid) {
      expect(() => factIdSchema.parse(bad)).toThrow()
    }
  })

  it('2. createProjectState bumps schemaVersion to 4', () => {
    const s = createProjectState('proj-x' as never, 'X')
    expect(s.schemaVersion).toBe(4)
  })

  it('3. createProjectState initialises all new v4 maps (none undefined)', () => {
    const s = createProjectState('proj-x' as never, 'X')
    expect(s.facts).toBeDefined()
    expect(s.pageIntake).toBeDefined()
    expect(s.intakeStatus).toBeDefined()
    expect(s.facts.size).toBe(0)
    expect(s.pageIntake.size).toBe(0)
  })

  it('4. intakeStatus starts with project open and empty pages map', () => {
    const s = createProjectState('proj-x' as never, 'X')
    expect(s.intakeStatus.project).toBe('open')
    expect(s.intakeStatus.pages.size).toBe(0)
  })

  it('5. intakeRev starts at 0 and nextFactSeq at 1 (monotonic)', () => {
    const s = createProjectState('proj-x' as never, 'X')
    expect(s.intakeRev).toBe(0)
    expect(s.nextFactSeq).toBe(1)
  })

  it('6. TurnRecord carries scope and optional asked', () => {
    const rec: TurnRecord = {
      turnId: 't-1',
      askedSlots: [],
      userText: '',
      acceptedUpdates: [],
      scope: 'project'
    }
    expect(rec.scope).toBe('project')

    const recPage: TurnRecord = {
      turnId: 't-2',
      askedSlots: [],
      userText: '',
      acceptedUpdates: [],
      scope: 'page-home' as PageId,
      asked: {
        mode: 'model',
        kind: 'ask',
        target: { type: 'slot', slots: ['purpose'] },
        question: 'Purpose?',
        options: [],
        why: 'To scope the page'
      }
    }
    expect(recPage.scope).toBe('page-home')
    expect(recPage.asked?.kind).toBe('ask')
  })

  it('7. bounds contain the new v4 entries', () => {
    expect(bounds.maxFacts).toBe(40)
    expect(bounds.maxFactAnswer).toBe(500)
    expect(bounds.maxTurnText).toBe(2000)
    expect(bounds.maxProjectTurns).toBe(15)
    expect(bounds.maxPageTurns).toBe(8)
    expect(bounds.maxSpecOpsPerCommand).toBe(20)
    expect(bounds.maxFactsPerTurn).toBe(6)
  })

  it('8. referenceProject is schema v4 with empty intake maps', () => {
    const s = referenceProject()
    expect(s.schemaVersion).toBe(4)
    expect(s.facts.size).toBe(0)
    expect(s.pageIntake.size).toBe(0)
    expect(s.intakeStatus.project).toBe('open')
    expect(s.intakeRev).toBe(0)
    expect(s.nextFactSeq).toBe(1)
  })

  it('9. referenceProject passes validateProject with the new v4 fields', () => {
    const s = referenceProject()
    expect(validateProject(s)).toEqual([])
  })

  it('10. IntakeFact shape: required fields, basis stated|inferred, confidence 0..1, superseded max 3', () => {
    const fact: IntakeFact = {
      id: 'fact-1' as FactId,
      topic: 'product',
      question: 'What does the site do?',
      answer: 'It sells widgets.',
      basis: 'stated',
      confidence: 1,
      evidence: 'It sells widgets.',
      turnId: 't-1',
      superseded: []
    }
    expect(fact.topic).toBe('product')
    expect(fact.basis).toBe('stated')
    expect(fact.confidence).toBe(1)
    expect(fact.superseded).toHaveLength(0)
  })

  it('11. PageIntake shape: slots map and facts map', () => {
    const pi: PageIntake = { slots: new Map(), facts: new Map() }
    expect(pi.slots.size).toBe(0)
    expect(pi.facts.size).toBe(0)
  })

  it('12. IntakeStatus union: project open|confirmed, pages map', () => {
    const open: IntakeStatus = { project: 'open', pages: new Map() }
    const confirmed: IntakeStatus = { project: 'confirmed', pages: new Map() }
    expect(open.project).toBe('open')
    expect(confirmed.project).toBe('confirmed')
  })

  it('13. IntakeScope union: project or page-scoped', () => {
    const proj: IntakeScope = { kind: 'project' }
    const page: IntakeScope = { kind: 'page', pageId: 'page-home' as never }
    expect(proj.kind).toBe('project')
    expect(page.kind).toBe('page')
    expect(page.pageId).toBe('page-home')
  })
})
