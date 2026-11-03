import { describe, expect, it } from 'vitest'
import { applyCommand, referenceProject, validateProject, resolveElement, elementIdSchema, type CommandId, type ElementId } from '../../src/core'

describe('decision integration with command bus', () => {
  it('set_property with scope creates a decision through applyCommand', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-int-1' as CommandId,
      baseRev: s0.rev,
      targetId: elementIdSchema.parse('el-hero-cta') as ElementId,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'instance', elementId: elementIdSchema.parse('el-hero-cta') as ElementId }
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.decisions.size).toBeGreaterThan(0)
    const dec = [...res.state.decisions.values()].find((d) => d.property === 'bgColor' && d.status === 'approved' && d.scope.kind === 'instance')
    expect(dec).toBeDefined()
    expect(res.state.nodes.get(elementIdSchema.parse('el-hero-cta'))!.props['bgColor']).toBe('oklch(0.47 0.27 264)') // base props NOT patched by scoped edit
    expect(validateProject(res.state)).toEqual([])
  })

  it('set_property without scope still patches base props directly', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-int-2' as CommandId,
      baseRev: s0.rev,
      targetId: elementIdSchema.parse('el-hero-cta') as ElementId,
      property: 'label',
      value: 'New Label'
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.state.nodes.get(elementIdSchema.parse('el-hero-cta'))!.props['label']).toBe('New Label')
    // no decision created for non-scoped edit
    const decs = [...res.state.decisions.values()]
    expect(decs.length).toBe(2) // only the two fixture decisions
  })

  it('re-applying same scope+property+value via separate commands does not duplicate', () => {
    const s0 = referenceProject()
    const r1 = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-int-3a' as CommandId,
      baseRev: s0.rev,
      targetId: elementIdSchema.parse('el-hero-cta') as ElementId,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'instance', elementId: elementIdSchema.parse('el-hero-cta') as ElementId }
    })
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    const count1 = [...r1.state.decisions.values()].filter((d) => d.status === 'approved').length
    const r2 = applyCommand(r1.state, {
      type: 'set_property',
      commandId: 'cmd-int-3b' as CommandId,
      baseRev: r1.state.rev,
      targetId: elementIdSchema.parse('el-hero-cta') as ElementId,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'instance', elementId: elementIdSchema.parse('el-hero-cta') as ElementId }
    })
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    const count2 = [...r2.state.decisions.values()].filter((d) => d.status === 'approved').length
    expect(count2).toBe(count1)
  })

  it('stale baseRev on scoped set_property is rejected', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-int-4' as CommandId,
      baseRev: 99999,
      targetId: elementIdSchema.parse('el-hero-cta') as ElementId,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'instance', elementId: elementIdSchema.parse('el-hero-cta') as ElementId }
    })
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('STALE_BASE')
  })

  it('undo removes the decision instance override', () => {
    const s0 = referenceProject()
    const edit = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-int-5' as CommandId,
      baseRev: s0.rev,
      targetId: elementIdSchema.parse('el-hero-cta') as ElementId,
      property: 'bgColor',
      value: '#F5F5F2',
      scope: { kind: 'instance', elementId: elementIdSchema.parse('el-hero-cta') as ElementId }
    })
    expect(edit.ok).toBe(true)
    if (!edit.ok) return
    const undone = applyCommand(edit.state, { type: 'undo', commandId: 'cmd-int-6' as CommandId })
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    const instDec = [...undone.state.decisions.values()].find((d) => d.scope.kind === 'instance' && d.property === 'bgColor')
    expect(instDec).toBeUndefined()
    const res = resolveElement(undone.state, elementIdSchema.parse('el-hero-cta') as ElementId)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.result.props['bgColor']).toBe('oklch(0.47 0.27 264)')
    expect(validateProject(undone.state)).toEqual([])
  })
})
