import { describe, expect, it } from 'vitest'
import { applyCommand } from '../../src/core/apply'
import { createProjectState, type ProjectState } from '../../src/core/state'
import type { SlotValue } from '../../src/core/intake-schema'
import type { ApplyResult } from '../../src/core/apply'
import type { CommandError } from '../../src/core/commands'

function applyOk(state: ProjectState, cmd: unknown): ProjectState {
  const r = applyCommand(state, cmd) as ApplyResult
  if (!r.ok) throw new Error(`Command failed: ${r.error.message}`)
  return r.state
}

function applyFail(state: ProjectState, cmd: unknown): CommandError {
  const r = applyCommand(state, cmd) as ApplyResult
  if (r.ok) throw new Error('Command unexpectedly succeeded')
  return r.error
}

function baseCmd(state: ProjectState, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'apply_intake_update',
    commandId: `cmd-${Math.random().toString(36).slice(2)}` as never,
    baseRev: state.rev,
    turnId: 'turn-1',
    updates: [],
    askedSlots: [],
    userText: 'hello',
    ...overrides
  }
}

describe('apply_intake_update command', () => {
  it('applies a stated slot update and records a turn', () => {
    let state = createProjectState('proj-1' as never, 'T')
    state = applyOk(state, baseCmd(state, {
      updates: [
        {
          slot: 'siteType',
          value: 'ecommerce',
          basis: 'stated',
          confidence: 1,
          evidence: 'ecommerce'
        }
      ]
    }))
    const intake = (state as { intake: Map<string, unknown> }).intake
    const slot = intake.get('siteType') as { basis: string; value: unknown }
    expect(slot.basis).toBe('stated')
    expect(slot.value).toBe('ecommerce')
    expect((state as { turnRecords: unknown[] }).turnRecords).toHaveLength(1)
  })

  it('rejects an unknown slot', () => {
    const state = createProjectState('proj-2' as never, 'T')
    const err = applyFail(state, baseCmd(state, {
      updates: [{ slot: 'nope', value: 'x', basis: 'stated', confidence: 1, evidence: 'x' }]
    }))
    expect(err.code).toBe('PROPERTY_UNKNOWN')
  })

  it('rejects an enum value outside the list', () => {
    const state = createProjectState('proj-3' as never, 'T')
    const err = applyFail(state, baseCmd(state, {
      updates: [{ slot: 'siteType', value: 'not-a-real-type', basis: 'stated', confidence: 1, evidence: 'x' }]
    }))
    expect(err.code).toBe('PROPERTY_INVALID')
  })

  it('rejects oversize updates (>8)', () => {
    const state = createProjectState('proj-4' as never, 'T')
    const updates = Array.from({ length: 9 }, (_, _i) => ({
      slot: 'audience' as never,
      value: ['a'],
      basis: 'inferred' as const,
      confidence: 0.5,
      evidence: 'a'
    }))
    const err = applyFail(state, baseCmd(state, { updates: updates as never }))
    expect(err.code).toBe('INVALID_COMMAND')
  })

  it('rejects control characters in evidence', () => {
    const state = createProjectState('proj-5' as never, 'T')
    const err = applyFail(state, baseCmd(state, {
      updates: [{ slot: 'siteType', value: 'ecommerce', basis: 'stated', confidence: 1, evidence: 'bad\u200Btext' }]
    }))
    // shortTextValue rejects control characters at the command-schema boundary.
    expect(err.code).toBe('INVALID_COMMAND')
  })

  it('is idempotent on turnId', () => {
    let state = createProjectState('proj-6' as never, 'T')
    const cmd = baseCmd(state, {
      updates: [{ slot: 'siteType', value: 'ecommerce', basis: 'stated', confidence: 1, evidence: 'ecommerce' }],
      turnId: 'turn-a'
    })
    state = applyOk(state, cmd)
    const first = (state as { intake: Map<string, unknown> }).intake.get('siteType')
    const rev1 = state.rev

    // Same turnId ('turn-a'), different commandId and fresh baseRev -> no-op (idempotent on turnId)
    const cmd2 = {
      type: 'apply_intake_update',
      commandId: 'cmd-other' as never,
      baseRev: state.rev,
      turnId: 'turn-a',
      updates: [{ slot: 'siteType', value: 'ecommerce', basis: 'stated', confidence: 1, evidence: 'ecommerce' }],
      askedSlots: [],
      userText: 'hello'
    }
    state = applyOk(state, cmd2)
    expect(state.rev).toBe(rev1 + 1) // rev still advances on bookkeeping, but intake unchanged
    const second = (state as { intake: Map<string, unknown> }).intake.get('siteType')
    expect(second).toBe(first)
  })

  it('rejects a stale baseRev', () => {
    const state = createProjectState('proj-7' as never, 'T')
    const err = applyFail(state, baseCmd(state, { baseRev: 999 }))
    expect(err.code).toBe('STALE_BASE')
  })

  it('keeps a superseded value when a stated value replaces a stated one', () => {
    let state = createProjectState('proj-8' as never, 'T')
    state = applyOk(state, baseCmd(state, {
      updates: [{ slot: 'siteType', value: 'ecommerce', basis: 'stated', confidence: 1, evidence: 'ecommerce' }],
      turnId: 'turn-a'
    }))
    state = applyOk(state, baseCmd(state, {
      updates: [{ slot: 'siteType', value: 'portfolio', basis: 'stated', confidence: 1, evidence: 'portfolio' }],
      turnId: 'turn-b'
    }))
    const slot = (state as { intake: Map<string, unknown> }).intake.get('siteType') as SlotValue
    expect(slot.superseded).toHaveLength(1)
    expect(slot.superseded[0]).toMatchObject({ value: 'ecommerce', basis: 'stated' })
  })

  it('does not supersede when replacing an inferred value with stated', () => {
    let state = createProjectState('proj-9' as never, 'T')
    state = applyOk(state, baseCmd(state, {
      updates: [{ slot: 'siteType', value: 'ecommerce', basis: 'inferred', confidence: 0.4, evidence: 'ecommerce' }],
      turnId: 'turn-a'
    }))
    state = applyOk(state, baseCmd(state, {
      updates: [{ slot: 'siteType', value: 'portfolio', basis: 'stated', confidence: 1, evidence: 'portfolio' }],
      turnId: 'turn-b'
    }))
    const slot = (state as { intake: Map<string, unknown> }).intake.get('siteType') as SlotValue
    expect(slot.superseded).toHaveLength(0)
    expect(slot.value).toBe('portfolio')
  })

  it('caps asked at 2 and records askedSlots', () => {
    let state = createProjectState('proj-10' as never, 'T')
    state = applyOk(state, baseCmd(state, { askedSlots: ['siteType'], turnId: 't1' }))
    state = applyOk(state, baseCmd(state, { askedSlots: ['siteType'], turnId: 't2' }))
    state = applyOk(state, baseCmd(state, { askedSlots: ['siteType'], turnId: 't3' }))
    const slot = (state as { intake: Map<string, unknown> }).intake.get('siteType') as SlotValue
    expect(slot.asked).toBe(2)
  })
})
