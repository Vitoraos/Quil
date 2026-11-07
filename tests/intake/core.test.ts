import { describe, expect, it } from 'vitest'
import { applyCommand } from '../../src/core/apply'
import { createProjectState } from '../../src/core/state'
import { pageSpecSchema } from '../../src/core/specs'
import { validatePageSpec } from '../../src/core/specs'
import type { ApplyResult } from '../../src/core/apply'
import type { CommandError } from '../../src/core/commands'
import type { ProjectState } from '../../src/core/state'

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

describe('intake: core spec validation', () => {
  it('accepts a valid page spec', () => {
    const spec = pageSpecSchema.parse({
      pageId: 'page-home' as never,
      name: 'Home',
      purpose: 'Welcome page',
      version: 1,
      sections: [
        {
          key: 'hero',
          purpose: 'Hero section',
          role: 'content' as never,
          goal: 'Test goal',
          elements: [
            { key: 'heading', kind: 'heading', purpose: 'Headline', required: true },
            { key: 'cta', kind: 'button', purpose: 'CTA', required: true }
          ]
        }
      ]
    })
    const errors = validatePageSpec(spec)
    expect(errors).toHaveLength(0)
  })

  it('rejects duplicate section keys', () => {
    const spec = pageSpecSchema.parse({
      pageId: 'page-home' as never,
      name: 'Home',
      purpose: 'Welcome page',
      version: 1,
      sections: [
        { key: 'hero', purpose: 'Hero', role: 'content' as never, goal: 'Test goal', elements: [{ key: 'h1', kind: 'heading', purpose: 'H', required: true }] },
        { key: 'hero', purpose: 'Hero dup', role: 'content' as never, goal: 'Test goal', elements: [{ key: 'h2', kind: 'heading', purpose: 'H2', required: true }] }
      ]
    })
    const errors = validatePageSpec(spec)
    expect(errors.some((e) => e.includes('duplicate section key'))).toBe(true)
  })

  it('rejects duplicate element keys within a section', () => {
    const spec = pageSpecSchema.parse({
      pageId: 'page-home' as never,
      name: 'Home',
      purpose: 'Welcome page',
      version: 1,
      sections: [
        {
          key: 'hero',
          purpose: 'Hero',
          role: 'content' as never,
          goal: 'Test goal',
          elements: [
            { key: 'h1', kind: 'heading', purpose: 'H1', required: true },
            { key: 'h1', kind: 'heading', purpose: 'H1 dup', required: true }
          ]
        }
      ]
    })
    const errors = validatePageSpec(spec)
    expect(errors.some((e) => e.includes('duplicate element key'))).toBe(true)
  })

  it('rejects empty sections', () => {
    const result = pageSpecSchema.safeParse({
      pageId: 'page-home' as never,
      name: 'Home',
      purpose: 'Welcome page',
      version: 1,
      sections: [{ key: 'hero', purpose: 'Hero', role: 'content' as never, goal: 'Test goal', elements: [] }]
    })
    expect(result.success).toBe(false)
  })

  it('rejects more than max sections', () => {
    const sections = Array.from({ length: 21 }, (_, i) => ({
      key: `s${i}`,
      purpose: `Section ${i}`,
      role: 'content' as never,
      goal: 'Test goal',
      elements: [{ key: `e${i}`, kind: 'heading' as const, purpose: 'P', required: true }]
    }))
    const result = pageSpecSchema.safeParse({
      pageId: 'page-home' as never,
      name: 'Home',
      purpose: 'Welcome page',
      version: 1,
      sections
    })
    expect(result.success).toBe(false)
  })
})

describe('intake: skeleton instantiation via commands', () => {
  it('creates section and element nodes from a page spec', () => {
    let state = createProjectState('proj-1' as never, 'Test Project')

    state = applyOk(state, {
      type: 'add_page',
      commandId: 'cmd-add-page-1' as never,
      baseRev: 0,
      pageId: 'page-home' as never,
      name: 'Home'
    })

    state = applyOk(state, {
      type: 'set_page_spec',
      commandId: 'cmd-set-spec-1' as never,
      baseRev: state.rev,
      pageId: 'page-home' as never,
      spec: {
        pageId: 'page-home' as never,
        name: 'Home',
        purpose: 'Welcome page',
        version: 1,
        sections: [
          {
            key: 'hero',
            purpose: 'Hero section',
            role: 'content' as never,
            goal: 'Test goal',
            elements: [
              { key: 'heading', kind: 'heading', purpose: 'Main headline', required: true },
              { key: 'cta', kind: 'button', purpose: 'Call to action', required: true }
            ]
          }
        ]
      }
    })

    state = applyOk(state, {
      type: 'instantiate_spec_skeleton',
      commandId: 'cmd-instantiate-1' as never,
      baseRev: state.rev,
      pageId: 'page-home' as never
    })

    const nodes = state.nodes
    const sectionId = 'sec-page-home-hero' as never
    expect(nodes.get(sectionId)?.kind).toBe('section')
    const headingId = 'el-page-home-hero-heading' as never
    const heading = nodes.get(headingId)
    expect(heading?.kind).toBe('heading')
    expect(heading?.props.text).toBe('Main headline')
    const ctaId = 'el-page-home-hero-cta' as never
    const cta = nodes.get(ctaId)
    expect(cta?.kind).toBe('button')
    expect(cta?.props.label).toBe('Call to action')
    // Trace: spec elementIds are recorded
    const spec = state.pageSpecs.get('page-home' as never)
    const headingSpec = spec?.sections[0]?.elements.find((e) => e.key === 'heading')
    expect(headingSpec?.elementId).toBe(headingId)
  })

  it('is idempotent: re-instantiating the same spec does not duplicate elements', () => {
    let state = createProjectState('proj-2' as never, 'Test Project')

    state = applyOk(state, {
      type: 'add_page',
      commandId: 'cmd-add-page-2' as never,
      baseRev: 0,
      pageId: 'page-rooms' as never,
      name: 'Rooms'
    })

    state = applyOk(state, {
      type: 'set_page_spec',
      commandId: 'cmd-set-spec-2' as never,
      baseRev: state.rev,
      pageId: 'page-rooms' as never,
      spec: {
        pageId: 'page-rooms' as never,
        name: 'Rooms',
        purpose: 'Rooms page',
        version: 1,
        sections: [
          {
            key: 'intro',
            purpose: 'Intro',
            role: 'content' as never,
            goal: 'Test goal',
            elements: [{ key: 'h1', kind: 'heading', purpose: 'Rooms', required: true }]
          }
        ]
      }
    })

    state = applyOk(state, {
      type: 'instantiate_spec_skeleton',
      commandId: 'cmd-instantiate-2a' as never,
      baseRev: state.rev,
      pageId: 'page-rooms' as never
    })

    const nodeCountFirst = state.nodes.size

    // Re-instantiate same spec - should not create duplicates
    state = applyOk(state, {
      type: 'instantiate_spec_skeleton',
      commandId: 'cmd-instantiate-2b' as never,
      baseRev: state.rev,
      pageId: 'page-rooms' as never
    })
    expect(state.nodes.size).toBe(nodeCountFirst)
  })

  it('rejects instantiate when no spec exists', () => {
    let state = createProjectState('proj-3' as never, 'Test Project')
    state = applyOk(state, {
      type: 'add_page',
      commandId: 'cmd-add-page-3' as never,
      baseRev: 0,
      pageId: 'page-empty' as never,
      name: 'Empty'
    })

    const err = applyFail(state, {
      type: 'instantiate_spec_skeleton',
      commandId: 'cmd-instantiate-3' as never,
      baseRev: state.rev,
      pageId: 'page-empty' as never
    })
    expect(err.code).toBe('TARGET_MISSING')
  })

  it('rejects adding duplicate page', () => {
    let state = createProjectState('proj-4' as never, 'Test Project')
    state = applyOk(state, {
      type: 'add_page',
      commandId: 'cmd-add-page-4a' as never,
      baseRev: 0,
      pageId: 'page-dup' as never,
      name: 'Dup'
    })

    const err = applyFail(state, {
      type: 'add_page',
      commandId: 'cmd-add-page-4b' as never,
      baseRev: state.rev,
      pageId: 'page-dup' as never,
      name: 'Dup again'
    })
    expect(err.code).toBe('DUPLICATE_ID')
  })
})

describe('intake: brief and answers commands', () => {
  it('sets brief and intake answers', () => {
    let state = createProjectState('proj-5' as never, 'Test Project')

    state = applyOk(state, {
      type: 'set_brief',
      commandId: 'cmd-brief-1' as never,
      baseRev: 0,
      brief: 'A portfolio site'
    })
    expect(state.brief).toBe('A portfolio site')

    state = applyOk(state, {
      type: 'set_intake_answer',
      commandId: 'cmd-answer-1' as never,
      baseRev: state.rev,
      questionId: 'q-tone',
      answer: 'Calm'
    })
    expect(state.intakeAnswers.get('q-tone')).toBe('Calm')
  })

  it('rejects empty brief', () => {
    const state = createProjectState('proj-6' as never, 'Test Project')
    const err = applyFail(state, {
      type: 'set_brief',
      commandId: 'cmd-brief-2' as never,
      baseRev: 0,
      brief: ''
    })
    expect(err.code).toBe('INVALID_COMMAND')
  })

  it('rejects brief over max length', () => {
    const state = createProjectState('proj-7' as never, 'Test Project')
    const err = applyFail(state, {
      type: 'set_brief',
      commandId: 'cmd-brief-3' as never,
      baseRev: 0,
      brief: 'x'.repeat(5001)
    })
    expect(err.code).toBe('INVALID_COMMAND')
  })

  it('rejects page spec referencing missing page', () => {
    const state = createProjectState('proj-8' as never, 'Test Project')
    const err = applyFail(state, {
      type: 'set_page_spec',
      commandId: 'cmd-set-spec-8' as never,
      baseRev: 0,
      pageId: 'page-nonexistent' as never,
      spec: {
        pageId: 'page-nonexistent' as never,
        name: 'X',
        purpose: 'p',
        version: 1,
        sections: [
          { key: 's1', purpose: 'P', role: 'content' as never, goal: 'Test goal', elements: [{ key: 'e1', kind: 'heading', purpose: 'E', required: true }] }
        ]
      }
    })
    expect(err.code).toBe('TARGET_MISSING')
  })
})
