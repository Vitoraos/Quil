import { describe, expect, it } from 'vitest'
import {
  canContinue,
  coverage,
  emptySlotValue,
  getSlotDef,
  pageSlotDefs,
  slotDefsFor,
  slotKeys,
  validateSlotValue
} from '../../src/core/intake-schema'
import { createProjectState } from '../../src/core/state'
import type { SlotValue } from '../../src/core/intake-schema'

function slot(overrides: Partial<SlotValue> = {}): SlotValue {
  return { ...emptySlotValue(), ...overrides }
}

describe('intake-schema: slot keys and defs', () => {
  it('exposes all 14 slot keys', () => {
    expect(slotKeys.sort()).toEqual([
      'avoid', 'brandAssets', 'businessName', 'contentReadiness', 'constraints',
      'features', 'pages', 'primaryAction', 'purpose', 'siteType', 'startingPage',
      'tone', 'visualStyle', 'audience'
    ].sort())
  })

  it('each def has required fields and sane bounds', () => {
    for (const key of slotKeys) {
      const def = getSlotDef(key)!
      expect(typeof def.key).toBe('string')
      expect(typeof def.label).toBe('string')
      expect(typeof def.description).toBe('string')
      expect(['text', 'enum', 'multi-enum', 'list', 'page-list']).toContain(def.type)
      expect(typeof def.required).toBe('boolean')
      expect(def.weight).toBeGreaterThanOrEqual(1)
      expect(def.weight).toBeLessThanOrEqual(10)
      expect(typeof def.fallbackQuestion).toBe('string')
      expect(def.fallbackQuestion.length).toBeGreaterThan(0)
    }
  })

  it('siteType enum allows only listed values', () => {
    const def = getSlotDef('siteType')!
    expect(validateSlotValue(def, 'ecommerce').ok).toBe(true)
    expect(validateSlotValue(def, 'not-a-real-type').ok).toBe(false)
    expect(validateSlotValue(def, 123).ok).toBe(false)
  })

  it('purpose text caps at 280 and rejects control chars', () => {
    const def = getSlotDef('purpose')!
    expect(validateSlotValue(def, 'A boutique hotel').ok).toBe(true)
    expect(validateSlotValue(def, 'x'.repeat(281)).ok).toBe(false)
    expect(validateSlotValue(def, 'bad\u200Btext').ok).toBe(false)
    expect(validateSlotValue(def, '').ok).toBe(false)
  })

  it('businessName text caps at 60', () => {
    const def = getSlotDef('businessName')!
    expect(validateSlotValue(def, 'Acme Co').ok).toBe(true)
    expect(validateSlotValue(def, 'x'.repeat(61)).ok).toBe(false)
  })

  it('audience list respects maxItems of 5', () => {
    const def = getSlotDef('audience')!
    expect(validateSlotValue(def, ['customers', 'partners']).ok).toBe(true)
    expect(validateSlotValue(def, ['a', 'b', 'c', 'd', 'e', 'f']).ok).toBe(false)
  })

  it('tone multi-enum caps at 3 and rejects unknown values', () => {
    const def = getSlotDef('tone')!
    expect(validateSlotValue(def, ['calm', 'bold']).ok).toBe(true)
    expect(validateSlotValue(def, ['calm', 'bold', 'professional', 'warm']).ok).toBe(false)
    expect(validateSlotValue(def, ['calm', 'neon']).ok).toBe(false)
    expect(validateSlotValue(def, ['calm', 'calm']).ok).toBe(false)
  })

  it('rejects NaN and Infinity', () => {
    const def = getSlotDef('purpose')!
    expect(validateSlotValue(def, NaN).ok).toBe(false)
    expect(validateSlotValue(def, Infinity).ok).toBe(false)
  })
})

describe('intake-schema: coverage', () => {
  it('reports missing and inferred required slots', () => {
    const slots = new Map<string, SlotValue>()
    slots.set('siteType', slot({ basis: 'stated' }))
    slots.set('purpose', slot({ basis: 'inferred' }))
    const c = coverage(slots)
    expect(c.missing).toContain('audience')
    expect(c.missing).toContain('primaryAction')
    expect(c.inferred).toContain('purpose')
    expect(c.complete).toBe(false)
    expect(c.score).toBeGreaterThanOrEqual(0)
    expect(c.score).toBeLessThanOrEqual(100)
  })

  it('is complete when every required slot is stated', () => {
    const slots = new Map<string, SlotValue>()
    for (const key of ['siteType', 'purpose', 'audience', 'primaryAction', 'pages', 'tone']) {
      slots.set(key, slot({ basis: 'stated' }))
    }
    const c = coverage(slots)
    expect(c.complete).toBe(true)
    expect(c.missing).toHaveLength(0)
    expect(c.inferred).toHaveLength(0)
    expect(c.score).toBe(100)
  })

  it('does not move a stated slot back to inferred', () => {
    const slots = new Map<string, SlotValue>()
    slots.set('siteType', slot({ basis: 'stated' }))
    const before = coverage(slots)
    // Simulate a later turn that re-affirms the same stated slot.
    slots.set('siteType', slot({ basis: 'stated', confidence: 0.9 }))
    const after = coverage(slots)
    expect(before.missing).not.toContain('siteType')
    expect(after.missing).not.toContain('siteType')
  })
})

describe('intake-schema: page-list slot (pages)', () => {
  const def = getSlotDef('pages')!

  it('pages slot type is page-list with maxItems 12', () => {
    expect(def.type).toBe('page-list')
    expect(def.maxItems).toBe(12)
    expect(def.required).toBe(true)
  })

  it('accepts valid {name, purpose} items up to 12', () => {
    const items = [
      { name: 'Home', purpose: 'Landing page' },
      { name: 'About', purpose: 'Company story' }
    ]
    const result = validateSlotValue(def, items)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toEqual(items)
  })

  it('rejects more than 12 items', () => {
    const items = Array.from({ length: 13 }, (_, i) => ({ name: `P${i}`, purpose: `purpose ${i}` }))
    expect(validateSlotValue(def, items).ok).toBe(false)
  })

  it('rejects items missing name or purpose', () => {
    expect(validateSlotValue(def, [{ name: 'Home' }]).ok).toBe(false)
    expect(validateSlotValue(def, [{ purpose: 'Landing' }]).ok).toBe(false)
    expect(validateSlotValue(def, [{ name: '', purpose: 'Landing' }]).ok).toBe(false)
    expect(validateSlotValue(def, [{ name: 'Home', purpose: '' }]).ok).toBe(false)
  })

  it('rejects non-array and malformed items', () => {
    expect(validateSlotValue(def, 'Home').ok).toBe(false)
    expect(validateSlotValue(def, [{ name: 1, purpose: 'x' }]).ok).toBe(false)
    expect(validateSlotValue(def, [{ name: 'Home', purpose: 'x'.repeat(281) }]).ok).toBe(false)
    expect(validateSlotValue(def, [{ name: 'Home', purpose: 'bad\u200Btext' }]).ok).toBe(false)
  })
})

describe('intake-schema: siteType includes web-app and dashboard (X3)', () => {
  const def = getSlotDef('siteType')!

  it('allows the original values', () => {
    expect(validateSlotValue(def, 'ecommerce').ok).toBe(true)
    expect(validateSlotValue(def, 'portfolio').ok).toBe(true)
  })

  it('allows web-app and dashboard', () => {
    expect(validateSlotValue(def, 'web-app').ok).toBe(true)
    expect(validateSlotValue(def, 'dashboard').ok).toBe(true)
  })

  it('rejects unknown site types', () => {
    expect(validateSlotValue(def, 'not-a-real-type').ok).toBe(false)
    expect(validateSlotValue(def, 'Web-App').ok).toBe(false)
  })
})

describe('intake-schema: slotDefsFor and pageSlotDefs', () => {
  it('pageSlotDefs has all seven page keys each with a fallbackQuestion', () => {
    const expected = ['purpose', 'visitorIntent', 'primaryAction', 'mustInclude', 'objections', 'contentReadiness', 'avoid']
    expect(Object.keys(pageSlotDefs).sort()).toEqual(expected.sort())
    for (const key of expected) {
      const def = pageSlotDefs[key]!
      expect(typeof def.fallbackQuestion).toBe('string')
      expect(def.fallbackQuestion.length).toBeGreaterThan(0)
      expect(def.required).toBe(key === 'purpose' || key === 'visitorIntent' || key === 'primaryAction')
    }
  })

  it('slotDefsFor returns project defs for project scope', () => {
    const defs = slotDefsFor({ kind: 'project' })
    expect(defs.siteType).toBeDefined()
    expect(defs.pages).toBeDefined()
    expect(defs.visitorIntent).toBeUndefined()
  })

  it('slotDefsFor returns page defs for page scope', () => {
    const defs = slotDefsFor({ kind: 'page', pageId: 'page-home' as never })
    expect(defs.visitorIntent).toBeDefined()
    expect(defs.primaryAction).toBeDefined()
    expect(defs.mustInclude).toBeDefined()
    expect(defs.siteType).toBeUndefined()
    expect(defs.pages).toBeUndefined()
  })
})

describe('intake-schema: coverage accepts a defs parameter', () => {
  it('defaults to project defs when defs omitted', () => {
    const slots = new Map<string, SlotValue>()
    slots.set('siteType', slot({ basis: 'stated' }))
    const c1 = coverage(slots)
    const c2 = coverage(slots, slotDefsFor({ kind: 'project' }))
    expect(c1).toEqual(c2)
  })

  it('measures page coverage against page defs independently', () => {
    const slots = new Map<string, SlotValue>()
    slots.set('purpose', slot({ basis: 'stated' }))
    // visitorIntent and primaryAction are required page slots but not set
    const c = coverage(slots, slotDefsFor({ kind: 'page', pageId: 'page-home' as never }))
    expect(c.missing).toContain('visitorIntent')
    expect(c.missing).toContain('primaryAction')
    expect(c.complete).toBe(false)
  })

  it('reports complete when all required page slots are stated', () => {
    const slots = new Map<string, SlotValue>()
    for (const key of ['purpose', 'visitorIntent', 'primaryAction']) {
      slots.set(key, slot({ basis: 'stated' }))
    }
    const c = coverage(slots, slotDefsFor({ kind: 'page', pageId: 'page-home' as never }))
    expect(c.complete).toBe(true)
    expect(c.missing).toHaveLength(0)
    expect(c.inferred).toHaveLength(0)
  })
})

describe('intake-schema: canContinue', () => {
  function projectStateWith(intake: Map<string, SlotValue>) {
    const s = createProjectState('proj-x' as never, 'X')
    s.intake = intake
    return s
  }

  it('project scope: false when purpose missing', () => {
    const s = projectStateWith(new Map())
    expect(canContinue(s, { kind: 'project' })).toBe(false)
  })

  it('project scope: false when pages missing even with purpose', () => {
    const s = projectStateWith(new Map([['purpose', slot({ basis: 'stated', value: 'Sell widgets' })]]))
    expect(canContinue(s, { kind: 'project' })).toBe(false)
  })

  it('project scope: true when purpose stated and pages has at least one entry', () => {
    const s = projectStateWith(
      new Map([
        ['purpose', slot({ basis: 'stated', value: 'Sell widgets' })],
        ['pages', slot({ basis: 'stated', value: [{ name: 'Home', purpose: 'Landing' }] })]
      ])
    )
    expect(canContinue(s, { kind: 'project' })).toBe(true)
  })

  it('project scope: pages with zero entries does not satisfy canContinue', () => {
    const s = projectStateWith(
      new Map([
        ['purpose', slot({ basis: 'stated', value: 'Sell widgets' })],
        ['pages', slot({ basis: 'stated', value: [] })]
      ])
    )
    expect(canContinue(s, { kind: 'project' })).toBe(false)
  })

  it('project scope: inferred purpose does not satisfy canContinue', () => {
    const s = projectStateWith(
      new Map([
        ['purpose', slot({ basis: 'inferred', value: 'Sell widgets' })],
        ['pages', slot({ basis: 'stated', value: [{ name: 'Home', purpose: 'Landing' }] })]
      ])
    )
    expect(canContinue(s, { kind: 'project' })).toBe(false)
  })

  it('page scope: false when purpose missing', () => {
    const s = createProjectState('proj-x' as never, 'X')
    s.pageIntake = new Map()
    expect(canContinue(s, { kind: 'page', pageId: 'page-home' as never })).toBe(false)
  })

  it('page scope: true when purpose stated', () => {
    const s = createProjectState('proj-x' as never, 'X')
    s.pageIntake = new Map([
      ['page-home' as never, { slots: new Map([['purpose', slot({ basis: 'stated', value: 'Home page' })]]), facts: new Map() }]
    ])
    expect(canContinue(s, { kind: 'page', pageId: 'page-home' as never })).toBe(true)
  })

  it('page scope: inferred purpose does not satisfy canContinue', () => {
    const s = createProjectState('proj-x' as never, 'X')
    s.pageIntake = new Map([
      ['page-home' as never, { slots: new Map([['purpose', slot({ basis: 'inferred', value: 'Home page' })]]), facts: new Map() }]
    ])
    expect(canContinue(s, { kind: 'page', pageId: 'page-home' as never })).toBe(false)
  })
})
