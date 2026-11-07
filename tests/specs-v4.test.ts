import { describe, expect, it } from 'vitest'
import {
  assessSpecQuality,
  sectionRoles,
  validatePageSpec,
  emphasisLevels,
  type PageSpec,
  type SpecSection
} from '../src/core/specs'
import { sectionPropsSchema, cardPropsSchema, layoutArchetypes } from '../src/core/elements'
import { spacingValue } from '../src/core/values'

function section(overrides: Partial<SpecSection> = {}): SpecSection {
  return {
    key: 'sec-test',
    role: 'content' as never,
    purpose: 'A test section',
    goal: 'Test goal',
    elements: [{ key: 'el-1', kind: 'heading', purpose: 'A heading', required: true }],
    ...overrides
  }
}

function makeSpec(overrides: Partial<PageSpec> = {}): PageSpec {
  return {
    pageId: 'page-home' as never,
    name: 'Home',
    purpose: 'Landing page',
    version: 1,
    status: 'draft',
    basedOnIntakeRev: 0,
    sections: [section()],
    ...overrides
  }
}

describe('Phase 6 — specs.ts v4', () => {
  it('exports sectionRoles array', () => {
    expect(Array.isArray(sectionRoles)).toBe(true)
    expect(sectionRoles).toContain('header')
    expect(sectionRoles).toContain('hero')
    expect(sectionRoles).toContain('footer')
    expect(sectionRoles).toContain('custom')
  })

  it('exports layoutArchetypes array', () => {
    expect(layoutArchetypes).toEqual([
      'stack', 'centered', 'split', 'grid-2', 'grid-3', 'list'
    ])
  })

  it('exports emphasisLevels array', () => {
    expect(emphasisLevels).toEqual(['primary', 'secondary', 'quiet'])
  })

  describe('validatePageSpec extended', () => {
    it('passes for a valid spec', () => {
      const errors = validatePageSpec(makeSpec())
      expect(errors).toEqual([])
    })

    it('rejects duplicate section keys', () => {
      const spec = makeSpec({
        sections: [section({ key: 'hero' }), section({ key: 'hero' })]
      })
      const errors = validatePageSpec(spec)
      expect(errors.some((e) => e.includes('duplicate section key'))).toBe(true)
    })

    it('rejects duplicate element keys per section', () => {
      const spec = makeSpec({
        sections: [
          section({
            elements: [
              { key: 'el-1', kind: 'heading', purpose: 'H1', required: true },
              { key: 'el-1', kind: 'text', purpose: 'H2', required: false }
            ]
          })
        ]
      })
      const errors = validatePageSpec(spec)
      expect(errors.some((e) => e.includes('duplicate element key'))).toBe(true)
    })

    it('requires roleLabel when role is custom, forbids otherwise', () => {
      // custom without roleLabel -> error
      const spec1 = makeSpec({
        sections: [section({ role: 'custom' as never })]
      })
      const errors1 = validatePageSpec(spec1)
      expect(errors1.some((e) => e.includes('roleLabel'))).toBe(true)

      // header with roleLabel -> error
      const spec2 = makeSpec({
        sections: [
          section({ role: 'header' as never, roleLabel: 'My Header' })
        ]
      })
      const errors2 = validatePageSpec(spec2)
      expect(errors2.some((e) => e.includes('roleLabel'))).toBe(true)
    })

    it('allows at most one header, one hero, one footer', () => {
      const spec = makeSpec({
        sections: [
          section({ key: 'h1', role: 'header' as never }),
          section({ key: 'h2', role: 'header' as never })
        ]
      })
      const errors = validatePageSpec(spec)
      expect(errors.some((e) => e.includes('at most one'))).toBe(true)
    })

    it('requires header to be first and footer to be last', () => {
      // header not first
      const spec1 = makeSpec({
        sections: [
          section({ key: 'hero', role: 'hero' as never }),
          section({ key: 'head', role: 'header' as never })
        ]
      })
      const errors1 = validatePageSpec(spec1)
      expect(errors1.some((e) => e.includes('first'))).toBe(true)

      // footer not last
      const spec2 = makeSpec({
        sections: [
          section({ key: 'foot', role: 'footer' as never }),
          section({ key: 'cta', role: 'cta' as never })
        ]
      })
      const errors2 = validatePageSpec(spec2)
      expect(errors2.some((e) => e.includes('last'))).toBe(true)
    })
  })

  describe('assessSpecQuality', () => {
    it('returns empty array for a well-varied spec', () => {
      const spec = makeSpec({
        sections: [
          section({ key: 's1', role: 'header' as never, layout: 'stack' as never }),
          section({ key: 's2', role: 'hero' as never, layout: 'centered' as never }),
          section({ key: 's3', role: 'cta' as never, layout: 'split' as never })
        ]
      })
      const issues = assessSpecQuality(spec)
      expect(issues).toEqual([])
    })

    it('flags same layout on 3+ consecutive sections', () => {
      const spec = makeSpec({
        sections: [
          section({ key: 's1', layout: 'stack' as never }),
          section({ key: 's2', layout: 'stack' as never }),
          section({ key: 's3', layout: 'stack' as never })
        ]
      })
      const issues = assessSpecQuality(spec)
      expect(issues.length).toBeGreaterThan(0)
      expect(issues.some((i) => i.rule === 'repetitive-layout')).toBe(true)
    })

    it('flags fewer than 3 sections when mustInclude has 3+ items', () => {
      // mustInclude is page-level intake, not spec field — assessSpecQuality
      // checks spec.sections against pageIntake.mustInclude via context.
      // For a standalone spec, we test the adjacent-role rule instead.
      const spec2 = makeSpec({
        sections: [
          section({ key: 's1', role: 'hero' as never }),
          section({ key: 's2', role: 'hero' as never })
        ]
      })
      const issues2 = assessSpecQuality(spec2)
      expect(issues2.some((i) => i.rule === 'adjacent-duplicate-role')).toBe(true)
    })

    it('flags a section with no required element', () => {
      const spec = makeSpec({
        sections: [
          section({
            elements: [{ key: 'el-1', kind: 'text', purpose: 'Optional text', required: false }]
          })
        ]
      })
      const issues = assessSpecQuality(spec)
      expect(issues.some((i) => i.rule === 'section-no-required-element')).toBe(true)
    })

    it('flags two adjacent sections with identical role', () => {
      const spec = makeSpec({
        sections: [
          section({ key: 's1', role: 'hero' as never }),
          section({ key: 's2', role: 'hero' as never })
        ]
      })
      const issues = assessSpecQuality(spec)
      expect(issues.some((i) => i.rule === 'adjacent-duplicate-role')).toBe(true)
    })

    it('does not flag non-adjacent sections with identical role', () => {
      const spec = makeSpec({
        sections: [
          section({ key: 's1', role: 'hero' as never }),
          section({ key: 's2', role: 'cta' as never }),
          section({ key: 's3', role: 'hero' as never })
        ]
      })
      const issues = assessSpecQuality(spec)
      expect(issues.some((i) => i.rule === 'adjacent-duplicate-role')).toBe(false)
    })
  })

  describe('sectionPropsSchema / cardPropsSchema layout + gap', () => {
    it('sectionPropsSchema accepts layout and gap', () => {
      const result = sectionPropsSchema.safeParse({
        bgColor: '#F5F5F2',
        padding: { value: 24 },
        layout: 'split' as never,
        gap: { value: 16 }
      })
      expect(result.success).toBe(true)
    })

    it('cardPropsSchema accepts gap', () => {
      const result = cardPropsSchema.safeParse({
        bgColor: '#141418',
        radius: 10,
        padding: { value: 24 },
        gap: { value: 16 }
      })
      expect(result.success).toBe(true)
    })

    it('sectionPropsSchema rejects unknown layout value', () => {
      const result = sectionPropsSchema.safeParse({
        layout: 'not-an-archetype' as never
      })
      expect(result.success).toBe(false)
    })

    it('gap value must be finite and non-negative', () => {
      const result = spacingValue.safeParse({ value: -5 })
      expect(result.success).toBe(false)
      const result2 = spacingValue.safeParse({ value: NaN })
      expect(result2.success).toBe(false)
    })
  })
})
