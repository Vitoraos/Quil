import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { produce, type Draft } from 'immer'
import {
  applyCommand,
  referenceProject,
  createProjectState,
  upsertDecision,
  resolveElement,
  validateProject,
  type CommandId,
  type DecisionId,
  type ElementId,
  type NodeKind,
  type PageId,
  type ProjectId,
  type ProjectState
} from '../../src/core'

function upsertIn(
  state: ReturnType<typeof referenceProject>,
  scope: { kind: 'global'; targetType: 'button' } | { kind: 'instance'; elementId: ElementId },
  property: string,
  value: unknown,
  kind: NodeKind
): ReturnType<typeof referenceProject> {
  return produce(state, (draft: Draft<ReturnType<typeof referenceProject>>) => {
    upsertDecision(draft, scope as never, property, value, kind as never)
  })
}

describe('decision resolver properties (fast-check)', () => {
  it('determinism: resolving the same element repeatedly yields deep-equal results', () => {
    const s0 = referenceProject()
    fc.assert(
      fc.property(
        fc.constantFrom('el-hero-cta', 'el-hero-heading', 'el-hero-text', 'el-footer-copy'),
        (targetId) => {
          const a = resolveElement(s0, targetId as ElementId)
          const b = resolveElement(s0, targetId as ElementId)
          expect(a.ok).toBe(true)
          if (!a.ok || !b.ok) return
          expect(a.result.props).toEqual(b.result.props)
          expect([...a.result.provenance.entries()]).toEqual([...b.result.provenance.entries()])
        }
      ),
      { numRuns: 50 }
    )
  })

  it('global change updates all and only matching elements', () => {
    const s0 = referenceProject()
    const s1 = upsertIn(s0, { kind: 'global', targetType: 'button' }, 'bgColor', '#1C1C1A', 'button')
    const buttons: ElementId[] = []
    const nonButtons: ElementId[] = []
    for (const [id, node] of s1.nodes) {
      if (node.kind === 'button') buttons.push(id)
      else nonButtons.push(id)
    }
    for (const id of buttons) {
      const res = resolveElement(s1, id)
      expect(res.ok).toBe(true)
      if (!res.ok) continue
      expect(res.result.props['bgColor']).toBe('#1C1C1A')
    }
    for (const id of nonButtons) {
      const res = resolveElement(s1, id)
      expect(res.ok).toBe(true)
      if (!res.ok) continue
      expect(res.result.provenance.has('bgColor')).toBe(false)
    }
  })

  it('instance override survives a global change', () => {
    const s0 = referenceProject()
    const s1 = upsertIn(
      s0,
      { kind: 'instance', elementId: 'el-hero-cta' as ElementId },
      'bgColor',
      '#F5F5F2',
      'button'
    )
    const res1 = resolveElement(s1, 'el-hero-cta' as ElementId)
    expect(res1.ok).toBe(true)
    if (!res1.ok) return
    expect(res1.result.props['bgColor']).toBe('#F5F5F2')

    const s2 = upsertIn(s1, { kind: 'global', targetType: 'button' }, 'bgColor', '#1C1C1A', 'button')
    const res2 = resolveElement(s2, 'el-hero-cta' as ElementId)
    expect(res2.ok).toBe(true)
    if (!res2.ok) return
    expect(res2.result.props['bgColor']).toBe('#F5F5F2') // instance survives

    let other: ElementId | null = null
    for (const [id, node] of s2.nodes) {
      if (node.kind === 'button' && id !== 'el-hero-cta') { other = id; break }
    }
    if (other) {
      const resOther = resolveElement(s2, other)
      expect(resOther.ok).toBe(true)
      if (!resOther.ok) return
      expect(resOther.result.props['bgColor']).toBe('#1C1C1A') // other button gets global
    }
  })

  it('page decision never leaks to another page', () => {
    const s0 = createProjectState('proj' as ProjectId, 'Two Pages')
    const p1 = { id: 'p1' as PageId, name: 'P1', sectionIds: [] as ElementId[] }
    const p2 = { id: 'p2' as PageId, name: 'P2', sectionIds: [] as ElementId[] }
    s0.pages.set(p1.id, p1)
    s0.pages.set(p2.id, p2)
    const addBtn = (st: ProjectState, pid: PageId, sid: ElementId, bid: ElementId) => {
      const sec: any = { id: sid, kind: 'section', pageId: pid, parentId: null, childIds: [], rev: 0, props: {} }
      st.pages.get(pid)!.sectionIds.push(sid)
      st.nodes.set(sid, sec)
      const btn: any = { id: bid, kind: 'button', pageId: pid, parentId: sid, childIds: [], rev: 0, props: { label: 'B', bgColor: '#1C1C1A', textColor: '#ECECE8' } }
      sec.childIds.push(bid)
      st.nodes.set(bid, btn)
      return st
    }
    const s1 = addBtn(addBtn(s0, p1.id, 's1' as ElementId, 'btn1' as ElementId), p2.id, 's2' as ElementId, 'btn2' as ElementId)
    const s2 = produce(s1, (draft: Draft<typeof s1>) => {
      upsertDecision(draft, { kind: 'page', pageId: p1.id, targetType: 'button' }, 'bgColor', '#F5F5F2', 'button')
    })
    const r1 = resolveElement(s2, 'btn1' as ElementId)
    const r2 = resolveElement(s2, 'btn2' as ElementId)
    expect(r1.ok).toBe(true)
    expect(r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    expect(r1.result.props['bgColor']).toBe('#F5F5F2')
    expect(r2.result.props['bgColor']).toBe('#1C1C1A')
  })

  it('undo restores both properties and the registry', () => {
    const s0 = referenceProject()
    const edit = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-undo-int' as CommandId,
      baseRev: s0.rev,
      targetId: 'el-hero-cta' as ElementId,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'instance', elementId: 'el-hero-cta' as ElementId }
    })
    expect(edit.ok).toBe(true)
    if (!edit.ok) return
    const before = resolveElement(edit.state, 'el-hero-cta' as ElementId)
    expect(before.ok).toBe(true)
    if (!before.ok) return
    expect(before.result.props['bgColor']).toBe('#F5F5F2')

    const undone = applyCommand(edit.state, { type: 'undo', commandId: 'cmd-undo-int-2' as CommandId })
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    const after = resolveElement(undone.state, 'el-hero-cta' as ElementId)
    expect(after.ok).toBe(true)
    if (!after.ok) return
    expect(after.result.props['bgColor']).toBe('oklch(0.47 0.27 264)')
    expect(after.result.provenance.get('bgColor')).toBe('dec-btn-brand')
    expect(validateProject(undone.state)).toEqual([])
  })

  it('re-applying the same decision via command is idempotent by decision', () => {
    const s0 = referenceProject()
    const c1 = {
      type: 'set_property',
      commandId: 'cmd-idem-1' as CommandId,
      baseRev: s0.rev,
      targetId: 'el-hero-cta' as ElementId,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'instance', elementId: 'el-hero-cta' as ElementId }
    }
    const r1 = applyCommand(s0, c1)
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    const decCount1 = [...r1.state.decisions.values()].filter((d) => d.status === 'approved' && d.property === 'bgColor').length
    // same decision value again -> no new decision record
    const c2 = { ...c1, commandId: 'cmd-idem-2' as CommandId, baseRev: r1.state.rev }
    const r2 = applyCommand(r1.state, c2)
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    const decCount2 = [...r2.state.decisions.values()].filter((d) => d.status === 'approved' && d.property === 'bgColor').length
    expect(decCount2).toBe(decCount1)
  })
})
