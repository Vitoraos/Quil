import { describe, expect, it } from 'vitest'
import { referenceProject, emptyProject } from '../../src/core'
import type { ElementId } from '../../src/core'
import { defaultPropsFor, duplicateCommands, insertParent } from '../../src/app/element-ops'

const home = 'page-home' as never
const id = (v: string) => v as ElementId

describe('insertParent', () => {
  it('inserts inside a selected container', () => {
    expect(insertParent(referenceProject(), id('sec-features'), home)).toBe('sec-features')
  })

  it('inserts beside a selected leaf', () => {
    expect(insertParent(referenceProject(), id('el-hero-img'), home)).toBe('sec-hero')
  })

  it('falls back to the first section of the page when nothing is selected', () => {
    expect(insertParent(referenceProject(), null, home)).toBe('sec-nav')
  })

  it('returns null when the page has no section', () => {
    expect(insertParent(referenceProject(), null, 'page-about' as never)).toBeNull()
    expect(insertParent(emptyProject(), null, null)).toBeNull()
  })
})

describe('defaultPropsFor', () => {
  it('produces props that satisfy each kind schema', () => {
    const state = referenceProject()
    expect(defaultPropsFor('heading', state)).toMatchObject({ level: 2 })
    expect(defaultPropsFor('text', state)).toMatchObject({ text: 'Body text' })
    expect(defaultPropsFor('button', state)).toMatchObject({ bgColor: expect.any(String) })
    expect(defaultPropsFor('form', state)).toMatchObject({ fields: [] })
  })

  it('refuses an image when there is no asset to point at', () => {
    expect(defaultPropsFor('image', emptyProject())).toBeNull()
    expect(defaultPropsFor('image', referenceProject())).toMatchObject({ assetId: 'asset-hero' })
  })
})

describe('duplicateCommands', () => {
  it('copies a leaf beside itself with props only', () => {
    const state = referenceProject()
    const commands = duplicateCommands(state, id('el-hero-img'))!
    expect(commands).toHaveLength(1)
    const command = commands[0]!
    expect(command.type).toBe('add_element')
    if (command.type !== 'add_element') return
    expect(command.parentId).toBe('sec-hero')
    expect(command.props).toEqual(state.nodes.get(id('el-hero-img'))!.props)
    expect(command.elementId).not.toBe('el-hero-img')
  })

  it('copies a subtree parent-first so every child has its new parent', () => {
    const state = referenceProject()
    const commands = duplicateCommands(state, id('el-card-a'))!
    expect(commands).toHaveLength(2)
    const root = commands[0]!
    const child = commands[1]!
    expect(root.type === 'add_element' && root.kind).toBe('card')
    if (root.type !== 'add_element' || child.type !== 'add_element') return
    expect(child.parentId).toBe(root.elementId)
    expect(new Set(commands.map((c) => (c.type === 'add_section' ? c.sectionId : c.elementId))).size).toBe(2)
  })

  it('duplicates a section as a root plus its children', () => {
    const commands = duplicateCommands(referenceProject(), id('sec-nav'))!
    expect(commands).toHaveLength(2)
    const root = commands[0]!
    expect(root.type).toBe('add_section')
    if (root.type !== 'add_section') return
    expect(root.pageId).toBe('page-home')
    expect(root.props).toEqual(referenceProject().nodes.get(id('sec-nav'))!.props)
    expect(commands[1]!.type).toBe('add_element')
    if (commands[1]!.type !== 'add_element') return
    expect(commands[1]!.parentId).toBe(root.sectionId)
  })

  it('returns null for unknown ids', () => {
    expect(duplicateCommands(referenceProject(), id('el-nope'))).toBeNull()
  })
})
