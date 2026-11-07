import { describe, expect, it } from 'vitest'
import { newCommandId } from '../../src/app/command-id'
import { commandIdSchema } from '../../src/core'

describe('newCommandId', () => {
  it('produces ids that pass the command schema', () => {
    for (let i = 0; i < 100; i++) {
      expect(commandIdSchema.safeParse(newCommandId('set-property')).success).toBe(true)
    }
  })

  it('never repeats, even within one millisecond', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newCommandId('burst')))
    expect(ids.size).toBe(1000)
  })

  it('falls back to a safe prefix for hostile input', () => {
    for (const p of ['', 'UPPER', 'has space', '../../etc', 'a'.repeat(80)]) {
      expect(commandIdSchema.safeParse(newCommandId(p)).success).toBe(true)
    }
  })
})