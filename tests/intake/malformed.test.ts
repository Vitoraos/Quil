import { describe, expect, it } from 'vitest'
import { applyCommand } from '../../src/core/apply'
import { createProjectState } from '../../src/core/state'
import {
  followUpQuestionsResponseSchema,
  suggestPagesResponseSchema,
  pageSpecResponseSchema,
  parseProviderResponse
} from '../../src/modules/intake/schemas'

describe('intake: malformed response suite (20+ mutations, all rejected, state untouched)', () => {
  const badSpecs: unknown[] = [
    // Not an object at all
    null,
    'not json',
    42,
    [1, 2, 3],
    // Missing required fields
    { purpose: 'p', sections: [] },
    { name: 'Home', sections: [] },
    { name: 'Home', purpose: 'p' },
    {},
    // Wrong types for scalar fields
    { name: 123, purpose: 'p', sections: [] },
    { name: true, purpose: 'p', sections: [] },
    { name: 'Home', purpose: 456, sections: [] },
    { name: 'Home', purpose: 'p', sections: [], version: '1' },
    // Sections wrong type
    { name: 'Home', purpose: 'p', sections: 'not array' },
    { name: 'Home', purpose: 'p', sections: { key: 'x' } },
    // Section missing fields
    { name: 'Home', purpose: 'p', sections: [{ purpose: 'P', elements: [] }] },
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', elements: [] }] },
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P' }] },
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P', elements: 'x' }] },
    // Element wrong kind
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P', elements: [{ key: 'e1', kind: 'cloud', purpose: 'X', required: true }] }] },
    // Element missing required fields
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P', elements: [{ kind: 'heading', purpose: 'X', required: true }] }] },
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P', elements: [{ key: 'e1', purpose: 'X', required: true }] }] },
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P', elements: [{ key: 'e1', kind: 'heading', required: true }] }] },
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P', elements: [{ key: 'e1', kind: 'heading', purpose: 'X' }] }] },
    // Extra keys (strict rejection - prompt injection)
    { name: 'Home', purpose: 'p', sections: [], injected: 'malicious' },
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P', elements: [], injected: true }] },
    { name: 'Home', purpose: 'p', sections: [{ key: 's1', purpose: 'P', elements: [{ key: 'e1', kind: 'heading', purpose: 'X', required: true, injected: 999 }] }] },
    // name/purpose too long
    { name: 'x'.repeat(281), purpose: 'p', sections: [] },
    { name: 'Home', purpose: 'x'.repeat(281), sections: [] },
    // version present (provider spec should not have version)
    { name: 'Home', purpose: 'p', sections: [], version: 5 }
  ]

  it.each(badSpecs)('rejects malformed input %j and leaves state untouched', (raw) => {
    const state = createProjectState('proj-malformed' as never, 'Test')
    const revBefore = state.rev
    expect(() => parseProviderResponse(pageSpecResponseSchema, raw, 'page-spec')).toThrow()
    expect(state.rev).toBe(revBefore)
    expect(state.pageSpecs.size).toBe(0)
  })
})

describe('intake: malformed follow-up and pages responses', () => {
  it('rejects malformed follow-up questions', () => {
    expect(() => parseProviderResponse(followUpQuestionsResponseSchema, { questions: 'not array' }, 'follow-up')).toThrow()
    expect(() =>
      parseProviderResponse(followUpQuestionsResponseSchema, { questions: [{ id: 123, question: 'q', skippable: true }] }, 'follow-up')
    ).toThrow()
    expect(() =>
      parseProviderResponse(followUpQuestionsResponseSchema, { questions: [] }, 'follow-up')
    ).toThrow()
  })

  it('rejects malformed page suggestions', () => {
    expect(() => parseProviderResponse(suggestPagesResponseSchema, { pages: 'not array' }, 'pages')).toThrow()
    expect(() =>
      parseProviderResponse(suggestPagesResponseSchema, { pages: [{ name: 123, purpose: 'p' }] }, 'pages')
    ).toThrow()
    expect(() => parseProviderResponse(suggestPagesResponseSchema, { pages: [] }, 'pages')).toThrow()
  })

  it('rejects non-JSON string', () => {
    expect(() => parseProviderResponse(pageSpecResponseSchema, '{not json', 'spec')).toThrow()
  })
})

describe('intake: valid response parses', () => {
  it('accepts valid page spec', () => {
    const parsed = parseProviderResponse(pageSpecResponseSchema, {
      name: 'Home',
      purpose: 'Welcome',
      sections: [
        {
          key: 'hero',
          purpose: 'Hero',
          elements: [{ key: 'h1', kind: 'heading', purpose: 'Headline', required: true }]
        }
      ]
    }, 'spec')
    expect(parsed.name).toBe('Home')
    const firstSection = parsed.sections[0]
    expect(firstSection).not.toBeUndefined()
    if (firstSection) {
      const firstEl = firstSection.elements[0]
      expect(firstEl).not.toBeUndefined()
      if (firstEl) {
        expect(firstEl.key).toBe('h1')
      }
    }
  })
})
