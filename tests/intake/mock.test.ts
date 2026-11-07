import { describe, expect, it } from 'vitest'
import { mockProvider } from '../../src/modules/intake/mock-provider'
import { intakeTurnOutputSchema, type SlotUpdate } from '../../src/modules/intake/schemas'

function emptyState(): Record<string, unknown> {
  return {}
}

describe('mock provider: planIntakeTurn', () => {
  it('extracts siteType and purpose from a first message', async () => {
    const out = await mockProvider.planIntakeTurn({
      schema: 'siteType (enum): ...',
      state: emptyState(),
      summary: '',
      lastQuestion: '',
      userTurn: 'I want an ecommerce store for handmade ceramics. It sells pottery.'
    })
    const parsed = intakeTurnOutputSchema.safeParse(out)
    expect(parsed.success).toBe(true)
    const site = out.updates.find((u: SlotUpdate) => u.slot === 'siteType')
    expect(site?.value).toBe('ecommerce')
    expect(site?.basis).toBe('stated')
    expect(site?.evidence).toContain('ecommerce')
    const purpose = out.updates.find((u: SlotUpdate) => u.slot === 'purpose')
    expect(purpose?.value).toContain('handmade ceramics')
  })

  it('never returns an update whose evidence is not in the user turn', async () => {
    const out = await mockProvider.planIntakeTurn({
      schema: '',
      state: emptyState(),
      summary: '',
      lastQuestion: '',
      userTurn: 'A portfolio site for a designer.'
    })
    for (const u of out.updates as SlotUpdate[]) {
      const turn = 'A portfolio site for a designer.'
      expect(turn.toLowerCase().includes(u.evidence.toLowerCase())).toBe(true)
    }
  })

  it('returns done once required slots are stated', async () => {
    const state: Record<string, unknown> = {}
    for (const key of ['siteType', 'purpose', 'audience', 'primaryAction', 'pages', 'tone']) {
      state[key] = { value: 'x', basis: 'stated', confidence: 1, evidence: 'x', turnId: null, asked: 0, superseded: [] }
    }
    const out = await mockProvider.planIntakeTurn({
      schema: '',
      state,
      summary: '',
      lastQuestion: '',
      userTurn: 'that covers everything'
    })
    expect(out.next.kind).toBe('done')
  })

  it('returns confirm when required are inferred but present', async () => {
    const state: Record<string, unknown> = {}
    for (const key of ['siteType', 'purpose', 'audience', 'primaryAction', 'pages', 'tone']) {
      state[key] = { value: 'x', basis: 'inferred', confidence: 0.5, evidence: 'x', turnId: null, asked: 0, superseded: [] }
    }
    const out = await mockProvider.planIntakeTurn({
      schema: '',
      state,
      summary: '',
      lastQuestion: '',
      userTurn: 'ok'
    })
    expect(out.next.kind).toBe('confirm')
    if (out.next.kind === 'confirm') {
      expect(out.next.slots.length).toBeGreaterThan(0)
    }
  })

  it('aborts on signal', async () => {
    const ac = new AbortController()
    ac.abort()
    await expect(mockProvider.planIntakeTurn({
      schema: '', state: emptyState(), summary: '', lastQuestion: '', userTurn: 'x'
    }, ac.signal)).rejects.toThrow()
  })
})
