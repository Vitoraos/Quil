import { describe, expect, it } from 'vitest'
import { buildSchemaBlock, INTAKE_SYSTEM_PROMPT, buildSystemPrompt } from '../../src/modules/intake/prompts'
import { slotKeys } from '../../src/core/intake-schema'

const headerRx = (key: string) => new RegExp(`- ${key} \\(`, 'g')

describe('intake prompts: schema drift guard', () => {
  it('buildSchemaBlock lists every slot key exactly once', () => {
    const block = buildSchemaBlock()
    for (const key of slotKeys) {
      expect(block).toContain(key)
    }
    for (const key of slotKeys) {
      const headers = block.match(headerRx(key)) ?? []
      expect(headers).toHaveLength(1)
    }
  })

  it('the assembled prompt mentions no slot key outside the schema', () => {
    const prompt = buildSystemPrompt(buildSchemaBlock())
    const words = new Set(prompt.split(/[^a-zA-Z0-9_]+/))
    for (const key of slotKeys) {
      expect(words.has(key)).toBe(true)
    }
    const madeUp = ['q-tone', 'q-audience', 'goals', 'tone-pick', 'start-page']
    for (const key of madeUp) {
      expect(words.has(key)).toBe(false)
    }
  })

  it('INTAKE_SYSTEM_PROMPT is non-empty and contains the schema', () => {
    expect(INTAKE_SYSTEM_PROMPT.length).toBeGreaterThan(0)
    expect(INTAKE_SYSTEM_PROMPT).toContain('siteType')
    expect(INTAKE_SYSTEM_PROMPT).toContain('<schema>')
  })
})
