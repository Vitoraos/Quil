import { describe, expect, it } from 'vitest'
import {
  referenceProject,
  validateProject,
  type DesignElement,
  type ElementId,
  type Page
} from '../src/core'

describe('validateProject invariant tests against malformed fixtures', () => {
  it('passes on the reference project', () => {
    const s0 = referenceProject()
    const violations = validateProject(s0)
    expect(violations).toEqual([])
  })

  it('detects cycles in element tree', () => {
    const s0 = referenceProject()
    // Create an explicit cycle: el-hero-heading parent is sec-hero, set sec-hero parent to el-hero-heading
    const sec = s0.nodes.get('sec-hero' as ElementId)!
    sec.parentId = 'el-hero-heading' as ElementId

    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'cycle' || v.rule === 'tree-depth' || v.rule === 'root-parent-non-null')).toBe(true)
  })

  it('detects dangling parent reference', () => {
    const s0 = referenceProject()
    const heading = s0.nodes.get('el-hero-heading' as ElementId)!
    heading.parentId = 'sec-ghost' as ElementId

    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'dangling-parent' || v.rule === 'tree-consistency')).toBe(true)
  })

  it('detects malformed/prototype-polluting id format', () => {
    const s0 = referenceProject()
    const badNode: DesignElement = {
      id: '__proto__' as unknown as ElementId,
      kind: 'text',
      pageId: 'page-home' as never,
      parentId: 'sec-hero' as ElementId,
      childIds: [],
      rev: 0,
      props: { text: 'bad' }
    }
    s0.nodes.set(badNode.id, badNode)
    s0.nodes.get('sec-hero' as ElementId)?.childIds.push(badNode.id)

    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'id-format')).toBe(true)
  })

  it('detects dangling asset reference in image element', () => {
    const s0 = referenceProject()
    const img = s0.nodes.get('el-hero-img' as ElementId)!
    img.props['assetId'] = 'asset-ghost-pool'

    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'dangling-asset')).toBe(true)
  })

  it('detects orphan nodes disconnected from any page', () => {
    const s0 = referenceProject()
    const orphan: DesignElement = {
      id: 'el-floating-orphan' as ElementId,
      kind: 'text',
      pageId: 'page-home' as never,
      parentId: null,
      childIds: [],
      rev: 0,
      props: { text: 'Lost in space' }
    }
    s0.nodes.set(orphan.id, orphan)

    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'orphan-node')).toBe(true)
  })

  it('detects page element count exceeding bound', () => {
    const s0 = referenceProject()
    // Synthesize a page with > 5000 elements
    const bigPage: Page = {
      id: 'page-huge' as never,
      name: 'Huge Page',
      sectionIds: []
    }
    s0.pages.set(bigPage.id, bigPage)

    const rootSec: DesignElement = {
      id: 'sec-huge-root' as ElementId,
      kind: 'section',
      pageId: bigPage.id,
      parentId: null,
      childIds: [],
      rev: 0,
      props: {}
    }
    bigPage.sectionIds.push(rootSec.id)
    s0.nodes.set(rootSec.id, rootSec)

    for (let i = 0; i < 5005; i++) {
      const childId = `el-huge-${i}` as ElementId
      rootSec.childIds.push(childId)
      s0.nodes.set(childId, {
        id: childId,
        kind: 'text',
        pageId: bigPage.id,
        parentId: rootSec.id,
        childIds: [],
        rev: 0,
        props: { text: `Item ${i}` }
      })
    }

    const violations = validateProject(s0)
    expect(violations.some((v) => v.rule === 'node-count-exceeded')).toBe(true)
  })
})
