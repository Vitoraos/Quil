import { describe, expect, it } from 'vitest'
import { applyCommand, referenceProject, validateProject } from '../src/core'
import type { ElementId } from '../src/core'

function addSection(state = referenceProject(), sectionId = 'sec-new') {
  return applyCommand(state, {
    type: 'add_section',
    commandId: `cmd-add-${sectionId}`,
    baseRev: state.rev,
    sectionId,
    pageId: 'page-home',
    props: { padding: { value: 32 } }
  })
}

describe('add_section', () => {
  it('creates a valid root section at the end of the page', () => {
    const state = referenceProject()
    const result = addSection(state)
    if (!result.ok) throw new Error(result.error.message)

    const page = result.state.pages.get('page-home' as never)!
    expect(page.sectionIds[page.sectionIds.length - 1]).toBe('sec-new')
    const section = result.state.nodes.get('sec-new' as ElementId)!
    expect(section.kind).toBe('section')
    expect(section.parentId).toBeNull()
    expect(section.childIds).toEqual([])
    expect(validateProject(result.state)).toEqual([])
  })

  it('is one undoable command', () => {
    const state = referenceProject()
    const added = addSection(state)
    if (!added.ok) throw new Error(added.error.message)

    const undone = applyCommand(added.state, { type: 'undo', commandId: 'cmd-undo-section' })
    if (!undone.ok) throw new Error(undone.error.message)
    expect(undone.state.nodes.has('sec-new' as ElementId)).toBe(false)
    expect(undone.state.pages.get('page-home' as never)!.sectionIds).not.toContain('sec-new')
  })

  it('rejects an unknown page', () => {
    const state = referenceProject()
    const result = applyCommand(state, {
      type: 'add_section',
      commandId: 'cmd-add-nowhere',
      baseRev: state.rev,
      sectionId: 'sec-new',
      pageId: 'page-nowhere',
      props: {}
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TARGET_MISSING')
  })

  it('rejects a duplicate element id', () => {
    const state = referenceProject()
    const result = addSection(state, 'sec-hero')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('DUPLICATE_ID')
  })

  it('rejects props that do not match the section schema', () => {
    const state = referenceProject()
    const result = applyCommand(state, {
      type: 'add_section',
      commandId: 'cmd-add-bad-props',
      baseRev: state.rev,
      sectionId: 'sec-new',
      pageId: 'page-home',
      props: { padding: -1 }
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('PROPERTY_INVALID')
  })
})
