import { describe, expect, it } from 'vitest'
import { produce } from 'immer'
import {
  referenceProject,
  createProjectState,
  upsertDecision,
  resolveElement,
  createResolverMemo,
  applicableDecisions,
  type DecisionScope,
  type ElementId,
  type NodeKind,
  type PageId
} from '../../src/core'

function upsert(
  state: ReturnType<typeof referenceProject>,
  scope: DecisionScope,
  property: string,
  value: unknown,
  kind: NodeKind
): { state: ReturnType<typeof referenceProject>; id: string } {
  let id: string = ''
  const next = produce(state, (draft) => {
    id = upsertDecision(draft, scope, property, value, kind) as string
  })
  return { state: next, id }
}

const globalButtonScope: DecisionScope = { kind: 'global', targetType: 'button' }
const pageHomeButtonScope: DecisionScope = {
  kind: 'page',
  pageId: 'page-home' as PageId,
  targetType: 'button'
}

describe('decision resolver', () => {
  it('global decision applies to matching element kind with provenance', () => {
    const s0 = referenceProject()
    const res = resolveElement(s0, 'el-hero-cta' as ElementId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.result.props['bgColor']).toBe('oklch(0.47 0.27 264)')
    expect(res.result.provenance.get('bgColor')).toBe('dec-btn-brand')
  })

  it('instance decision applies to its element with provenance', () => {
    const s0 = referenceProject()
    const res = resolveElement(s0, 'el-hero-heading' as ElementId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.result.props['fontSize']).toEqual({ value: 40, unit: 'px' })
    expect(res.result.provenance.get('fontSize')).toBe('dec-hero-font')
  })

  it('element with no applicable decisions keeps its own props and empty provenance', () => {
    const s0 = referenceProject()
    const res = resolveElement(s0, 'el-hero-text' as ElementId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.result.props['text']).toBe('A starter page for whatever you are building. You approve each decision; Quil keeps applying it.')
    expect(res.result.provenance.size).toBe(0)
  })

  it('resolving an unknown element id returns DECISION_TARGET_UNKNOWN', () => {
    const s0 = referenceProject()
    const res = resolveElement(s0, 'el-does-not-exist' as ElementId)
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('DECISION_TARGET_UNKNOWN')
  })

  it('page-scoped decision beats global-scoped decision (precedence)', () => {
    const s0 = referenceProject()
    const { state: s1 } = upsert(s0, pageHomeButtonScope, 'bgColor', '#1C1C1A', 'button')
    const res = resolveElement(s1, 'el-hero-cta' as ElementId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.result.props['bgColor']).toBe('#1C1C1A')
    expect(res.result.provenance.get('bgColor')).not.toBe('dec-btn-brand')
  })

  it('instance-scoped decision beats page-scoped decision (precedence)', () => {
    const s0 = referenceProject()
    const { state: s1 } = upsert(s0, pageHomeButtonScope, 'bgColor', '#1C1C1A', 'button')
    const { state: s2 } = upsert(
      s1,
      { kind: 'instance', elementId: 'el-hero-cta' as ElementId },
      'bgColor',
      '#F5F5F2',
      'button'
    )
    const res = resolveElement(s2, 'el-hero-cta' as ElementId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.result.props['bgColor']).toBe('#F5F5F2')
  })

  it('same-scope conflict resolves by higher seq (total order, seq descending)', () => {
    const s0 = createProjectState('proj' as never, 'Seq Test')
    const page: any = { id: 'p1' as never, name: 'P1', sectionIds: [] }
    s0.pages.set(page.id, page)
    const sec: any = {
      id: 's1' as never,
      kind: 'section',
      pageId: page.id,
      parentId: null,
      childIds: [],
      rev: 0,
      props: {}
    }
    page.sectionIds.push(sec.id)
    s0.nodes.set(sec.id, sec)
    const btn: any = {
      id: 'btn1' as never,
      kind: 'button',
      pageId: page.id,
      parentId: sec.id,
      childIds: [],
      rev: 0,
      props: { label: 'X', bgColor: '#1C1C1A', textColor: '#ECECE8' }
    }
    sec.childIds.push(btn.id)
    s0.nodes.set(btn.id, btn)
    // nextDecisionSeq starts at 1
    const { state: s1, id: id1 } = (() => {
      let id = ''
      const n = produce(s0, (d) => {
        id = upsertDecision(d, globalButtonScope, 'bgColor', '#F5F5F2', 'button') as string
      })
      return { state: n, id }
    })()
    const { state: s2, id: id2 } = (() => {
      let id = ''
      const n = produce(s1, (d) => {
        id = upsertDecision(d, globalButtonScope, 'bgColor', '#1C1C1A', 'button') as string
      })
      return { state: n, id }
    })()
    const res = resolveElement(s2, 'btn1' as ElementId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.result.props['bgColor']).toBe('#1C1C1A') // higher seq (id2) wins
    expect(res.result.provenance.get('bgColor')).toBe(id2)
  })
})
