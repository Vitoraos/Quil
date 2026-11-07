import { describe, expect, it } from 'vitest'
import { dedupeCandidates, buildVariantContext, targetDefs, type Candidate } from '../src/core/generation'
import { createProjectState, type ProjectState } from '../src/core/state'
import { applyCommand } from '../src/core/apply'

function candidate(candidateId: string, props: Record<string, unknown>): Candidate {
  return {
    candidateId: candidateId as never,
    componentDefId: 'button',
    targetId: 'el-hero-cta' as never,
    props
  }
}

describe('dedupeCandidates', () => {
  it('drops near-identical candidates regardless of prop order and keeps distinct ones', () => {
    const a = candidate('cand-1', { bgColor: '#1C1C1A', textColor: '#F5F3EC' })
    const b = candidate('cand-2', { textColor: '#F5F3EC', bgColor: '#1C1C1A' })
    const c = candidate('cand-3', { bgColor: '#1C1C1A', textColor: '#F5F3EC', radius: 12 })

    expect(dedupeCandidates([a, b, c]).map((x) => x.candidateId)).toEqual(['cand-1', 'cand-3'])
  })

  it('keeps candidates with the same props on different targets', () => {
    const a = candidate('cand-1', { bgColor: '#1C1C1A' })
    const b = { ...candidate('cand-2', { bgColor: '#1C1C1A' }), targetId: 'el-other' as never }

    expect(dedupeCandidates([a, b])).toHaveLength(2)
  })
})

function applyOk(state: ProjectState, cmd: unknown): ProjectState {
  const r = applyCommand(state, cmd)
  if (!r.ok) throw new Error(`Command failed: ${r.error.message}`)
  return r.state
}

function buildVariantState(): { state: ProjectState; buttonId: string } {
  let state = createProjectState('proj-variant' as never, 'Variant Project')
  state = applyOk(state, {
    type: 'set_brief',
    commandId: 'cmd-brief' as never,
    baseRev: state.rev,
    brief: 'A portfolio site'
  })
  state = applyOk(state, {
    type: 'add_page',
    commandId: 'cmd-page' as never,
    baseRev: state.rev,
    pageId: 'page-home' as never,
    name: 'Home'
  })
  state = applyOk(state, {
    type: 'set_page_spec',
    commandId: 'cmd-spec' as never,
    baseRev: state.rev,
    pageId: 'page-home' as never,
    spec: {
      pageId: 'page-home' as never,
      name: 'Home',
      purpose: 'Landing page',
      version: 1,
      sections: [
        {
          key: 'hero',
          purpose: 'Hero section',
          role: 'content' as never,
          goal: 'Test goal',
          elements: [
            { key: 'heading', kind: 'heading', purpose: 'Headline', required: true, elementId: 'el-hero-heading' as never },
            { key: 'cta', kind: 'button', purpose: 'Primary CTA', required: true, elementId: 'el-hero-cta' as never }
          ]
        }
      ]
    }
  })
  state = applyOk(state, {
    type: 'instantiate_spec_skeleton',
    commandId: 'cmd-instantiate' as never,
    baseRev: state.rev,
    pageId: 'page-home' as never
  })
  // The skeleton assigns deterministic ids; find the button by kind.
  const buttonId = [...state.nodes.values()].find((n) => n.kind === 'button')!.id
  return { state, buttonId }
}

describe('buildVariantContext', () => {
  it('builds a rich context for a button target', () => {
    const { state, buttonId } = buildVariantState()
    const result = buildVariantContext(state, buttonId, 'button')
    expect(result.ok).toBe(true)
    if (result.ok) {
      const c = result.context
      expect(c.page.name).toBe('Home')
      expect(c.page.purpose).toBe('Landing page')
      expect(c.section.key).toBe('hero')
      expect(c.target.id).toBe(buttonId)
      expect(c.target.kind).toBe('button')
      expect(c.target.componentDefId).toBe('button')
      expect(typeof c.project.brief).toBe('string')
      expect(c.project.brief.length).toBeGreaterThan(0)
      expect(Array.isArray(c.houseRules)).toBe(true)
      expect(Array.isArray(c.palette)).toBe(true)
      expect(c.revisions.decisionVersion).toBeGreaterThanOrEqual(0)
    }
  })

  it('returns no component definition for an unsupported element', () => {
    const { state } = buildVariantState()
    const headingId = [...state.nodes.values()].find((n) => n.kind === 'heading')!.id
    const result = buildVariantContext(state, headingId, 'hero')
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.context.target.componentDefId).toBeNull()
    }
  })

  it('revisions use a monotonic value (state.rev)', () => {
    const { state, buttonId } = buildVariantState()
    const first = buildVariantContext(state, buttonId, 'button')
    if (!first.ok) throw new Error('expected ok')
    const firstRev = first.context.revisions.decisionVersion

    // A set_property bumps rev, so the decision version must change.
    const next = applyCommand(state, {
      type: 'set_property',
      commandId: 'cmd-prop' as never,
      baseRev: state.rev,
      targetId: buttonId,
      property: 'radius',
      value: 12
    })
    if (!next.ok) throw new Error('expected ok')
    const second = buildVariantContext(next.state, buttonId, 'button')
    if (!second.ok) throw new Error('expected ok')
    expect(second.context.revisions.decisionVersion).toBeGreaterThan(firstRev)
  })
})

describe('Phase 8 — generation targetDefs and variant context', () => {
  it('targetDefs.hero does not require textColor (sections have no text prop)', () => {
    const heroDef = targetDefs['hero']!
    const textColorProp = heroDef.props.find((p) => p.property === 'textColor')
    expect(textColorProp).toBeUndefined()
    const bgColorProp = heroDef.props.find((p) => p.property === 'bgColor')
    expect(bgColorProp).toBeDefined()
    expect(bgColorProp!.required).toBe(true)
  })

  it('buildVariantContext palette comes from resolved/approved decisions, not base props', () => {
    let state = createProjectState('proj-variant' as never, 'Variant Project')
    state = applyOk(state, {
      type: 'set_brief',
      commandId: 'cmd-brief' as never,
      baseRev: state.rev,
      brief: 'A portfolio site'
    })
    state = applyOk(state, {
      type: 'add_page',
      commandId: 'cmd-page' as never,
      baseRev: state.rev,
      pageId: 'page-home' as never,
      name: 'Home'
    })
    state = applyOk(state, {
      type: 'set_page_spec',
      commandId: 'cmd-spec' as never,
      baseRev: state.rev,
      pageId: 'page-home' as never,
      spec: {
        pageId: 'page-home' as never,
        name: 'Home',
        purpose: 'Landing page',
        version: 1,
        sections: [
          {
            key: 'hero',
            purpose: 'Hero section',
            role: 'content' as never,
            goal: 'Test goal',
            elements: [
              { key: 'heading', kind: 'heading', purpose: 'Headline', required: true, elementId: 'el-hero-heading' as never },
              { key: 'cta', kind: 'button', purpose: 'Primary CTA', required: true, elementId: 'el-hero-cta' as never }
            ]
          }
        ]
      }
    })
    state = applyOk(state, {
      type: 'instantiate_spec_skeleton',
      commandId: 'cmd-instantiate' as never,
      baseRev: state.rev,
      pageId: 'page-home' as never
    })

    // Set a base bgColor on the section
    const sectionId = 'sec-page-home-hero' as never
    state = applyOk(state, {
      type: 'set_property',
      commandId: 'cmd-set-bg' as never,
      baseRev: state.rev,
      targetId: sectionId,
      property: 'bgColor',
      value: '#1C1C1A'
    })

    // Approve a global decision overriding bgColor to a different color
    state = applyOk(state, {
      type: 'set_property',
      commandId: 'cmd-global-bg' as never,
      baseRev: state.rev,
      targetId: sectionId,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'global', targetType: 'section' }
    })

    const buttonId = [...state.nodes.values()].find((n) => n.kind === 'button')!.id
    const result = buildVariantContext(state, buttonId, 'button')
    if (!result.ok) throw new Error('expected ok')

    // Palette should include the resolved global decision color (#F5F5F2), not just base (#1C1C1A)
    expect(result.context.palette).toContain('#F5F5F2')
  })
})

