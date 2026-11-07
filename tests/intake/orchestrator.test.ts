import { describe, expect, it } from 'vitest'
import {
  createIntakeSession,
  MAX_ASKS_PER_SLOT,
  MAX_TURNS,
  step,
  type IntakeSession,
} from '../../src/modules/intake/orchestrator'
import { mockProvider } from '../../src/modules/intake/mock-provider'
import { validateSlotValue, getSlotDef } from '../../src/core/intake-schema'

async function runTurn(session: IntakeSession, userTurn: string, baseRev: number) {
  return step(session, userTurn, mockProvider, baseRev)
}

describe('orchestrator: turn loop', () => {
  it('extracts siteType and purpose from first message and asks next gap', async () => {
    const session = createIntakeSession()
    const result = await runTurn(
      session,
      'I want an ecommerce store for handmade ceramics. It sells pottery.',
      0
    )
    expect(result.error).toBeUndefined()
    expect(result.command).toBeDefined()
    const siteUpdate = result.command?.updates.find((u) => u.slot === 'siteType')
    expect(siteUpdate?.value).toBe('ecommerce')
    expect(siteUpdate?.basis).toBe('stated')
    const purposeUpdate = result.command?.updates.find((u) => u.slot === 'purpose')
    expect(purposeUpdate?.value).toContain('handmade ceramics')
    expect(result.done).toBe(false)
    expect(result.question).toBeDefined()
  })

  it('reaches completion when all required slots stated', async () => {
    const session = createIntakeSession()
    for (const key of ['siteType', 'purpose', 'audience', 'primaryAction', 'pages', 'tone']) {
      session.slots.set(key, {
        value: 'x',
        basis: 'stated',
        confidence: 1,
        evidence: 'x',
        turnId: null,
        asked: 0,
        superseded: [],
      })
    }
    const result = await runTurn(session, 'that covers everything', session.slots.size as number)
    expect(result.done).toBe(true)
  })

  it('does not exceed max turns', async () => {
    const session = createIntakeSession()
    let current = session
    for (let i = 0; i < MAX_TURNS; i++) {
      const r = await runTurn(current, 'turn ' + i, i)
      current = r.session
      if (r.done) break
    }
    const r = await runTurn(current, 'one more turn', MAX_TURNS)
    expect(r.done).toBe(true)
    expect(r.error).toContain('Maximum turns')
  })

  it('caps asks per slot at MAX_ASKS_PER_SLOT', async () => {
    const session = createIntakeSession()
    session.slots.set('tone', {
      value: 'calm',
      basis: 'inferred',
      confidence: 0.5,
      evidence: 'calm',
      turnId: null,
      asked: MAX_ASKS_PER_SLOT,
      superseded: [],
    })
    const result = await runTurn(session, 'whatever', 0)
    if (result.question?.kind === 'ask') {
      expect(result.question.slots).not.toContain('tone')
    }
  })
})

describe('orchestrator: slot validation', () => {
  it('rejects enum value outside list', () => {
    const def = getSlotDef('siteType')!
    expect(validateSlotValue(def, 'not-a-real-type').ok).toBe(false)
    expect(validateSlotValue(def, 'ecommerce').ok).toBe(true)
  })

  it('rejects oversize lists', () => {
    const def = getSlotDef('audience')!
    const tooMany = Array.from({ length: 6 }, (_, i) => `person${i}`)
    expect(validateSlotValue(def, tooMany).ok).toBe(false)
  })
})
