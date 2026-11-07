import { describe, expect, it } from 'vitest'
import { mockProvider } from '../../src/modules/variants/mock-provider'
import { variantOutputSchema, type VariantContext } from '../../src/modules/variants/schemas'
import { buildVariantContext } from '../../src/core/generation'
import { createProjectState, type ProjectState } from '../../src/core/state'
import { applyCommand } from '../../src/core/apply'

function applyOk(state: ProjectState, cmd: unknown): ProjectState {
  const r = applyCommand(state, cmd)
  if (!r.ok) throw new Error(`Command failed: ${r.error.message}`)
  return r.state
}

function buildVariantState(brief: string, toneSlot?: 'calm' | 'bold'): { state: ProjectState; buttonId: string } {
  let state = createProjectState('proj-variant' as never, 'Variant Project')
  state = applyOk(state, { type: 'set_brief', commandId: 'c1' as never, baseRev: state.rev, brief })
  state = applyOk(state, { type: 'add_page', commandId: 'c2' as never, baseRev: state.rev, pageId: 'page-home' as never, name: 'Home' })
  state = applyOk(state, {
    type: 'set_page_spec',
    commandId: 'c3' as never,
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
  state = applyOk(state, { type: 'instantiate_spec_skeleton', commandId: 'c4' as never, baseRev: state.rev, pageId: 'page-home' as never })
  if (toneSlot) {
    state = applyOk(state, {
      type: 'apply_intake_update',
      commandId: 'c5' as never,
      baseRev: state.rev,
      turnId: 'turn-tone',
      updates: [{ slot: 'tone', value: [toneSlot], basis: 'stated', confidence: 1, evidence: toneSlot }],
      askedSlots: [],
      userText: toneSlot
    })
  }
  const buttonId = [...state.nodes.values()].find((n) => n.kind === 'button')!.id
  return { state, buttonId }
}

describe('mock variant provider', () => {
  it('returns different candidates for calm vs bold tone', async () => {
    const calm = buildVariantState('A portfolio site', 'calm')
    const calmCtx = buildVariantContext(calm.state, calm.buttonId, 'button')
    if (!calmCtx.ok) throw new Error('expected ok')
    const calmOut = await mockProvider.proposeVariants({ context: calmCtx.context, instruction: null })
    const calmParsed = variantOutputSchema.safeParse(calmOut)
    if (!calmParsed.success) throw new Error('calm parse failed')

    const bold = buildVariantState('A portfolio site', 'bold')
    const boldCtx = buildVariantContext(bold.state, bold.buttonId, 'button')
    if (!boldCtx.ok) throw new Error('expected ok')
    const boldOut = await mockProvider.proposeVariants({ context: boldCtx.context, instruction: null })
    const boldParsed = variantOutputSchema.safeParse(boldOut)
    if (!boldParsed.success) throw new Error('bold parse failed')

    // Calm's primary candidate is light; bold's primary candidate is dark.
    const calmPrimary = calmParsed.data.candidates[0]!.props.bgColor
    const boldPrimary = boldParsed.data.candidates[0]!.props.bgColor
    expect(calmPrimary).not.toBe(boldPrimary)
    // Calm relies on the tone slot; bold does too.
    expect(calmParsed.data.candidates[0]!.uses).toContain('tone')
    expect(boldParsed.data.candidates[0]!.uses).toContain('tone')
  })

  it('returns at most 3 candidates and all have componentDefId matching target', async () => {
    const { state, buttonId } = buildVariantState('A portfolio site', 'calm')
    const ctx = buildVariantContext(state, buttonId, 'button')
    if (!ctx.ok) throw new Error('expected ok')
    const out = await mockProvider.proposeVariants({ context: ctx.context, instruction: null })
    const parsed = variantOutputSchema.safeParse(out)
    expect(parsed.success).toBe(true)
    expect(parsed.data!.candidates.length).toBeLessThanOrEqual(3)
    expect(parsed.data!.candidates.length).toBeGreaterThan(0)
    for (const c of parsed.data!.candidates) {
      expect(c.componentDefId).toBe('button')
      expect(c.explanation.length).toBeLessThanOrEqual(140)
    }
  })

  it('aborts on signal', async () => {
    const ac = new AbortController()
    ac.abort()
    const { state, buttonId } = buildVariantState('A portfolio site', 'calm')
    const ctx = buildVariantContext(state, buttonId, 'button')
    if (!ctx.ok) throw new Error('expected ok')
    await expect(mockProvider.proposeVariants({ context: ctx.context, instruction: null, signal: ac.signal })).rejects.toThrow()
  })

  it('returns hero props (not button props) for a hero section target', async () => {
    // Directly construct a VariantContext with componentDefId='hero' to test
    // that the mock provider returns hero props, not button props.
    const heroContext: VariantContext = {
      project: { brief: 'A portfolio site' },
      page: { name: 'Home', purpose: 'Landing', position: 1, otherPages: [] },
      section: { key: 'hero', purpose: 'Hero section', position: 1, elements: [] },
      target: { id: 'sec-hero', kind: 'section', componentDefId: 'hero', purpose: 'Hero section', required: true, props: {} },
      houseRules: [],
      palette: ['#1C1C1A'],
      history: [],
      revisions: { targetRev: 1, decisionVersion: 1, specVersion: 1 }
    }
    const out = await mockProvider.proposeVariants({ context: heroContext, instruction: null })
    const parsed = variantOutputSchema.safeParse(out)
    expect(parsed.success).toBe(true)
    for (const c of parsed.data!.candidates) {
      expect(c.componentDefId).toBe('hero')
      // Hero props should be bgColor and padding, NOT button props like radius/fontWeight
      expect(c.props.bgColor).toBeDefined()
      expect(c.props.radius).toBeUndefined()
      expect(c.props.fontWeight).toBeUndefined()
    }
  })
})
