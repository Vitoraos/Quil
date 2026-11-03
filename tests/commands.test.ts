import { describe, expect, it } from 'vitest'
import {
  applyCommand,
  referenceProject,
  validateProject,
  type CommandId,
  type ElementId,
  type CandidateId
} from '../src/core'

describe('commands failure modes (adversarial & negative-first)', () => {
  it('1. duplicate CommandId replay returns identical state and no new patches', () => {
    const s0 = referenceProject()
    const cmd = {
      type: 'set_property',
      commandId: 'cmd-dup-1' as CommandId,
      baseRev: s0.rev,
      targetId: 'el-hero-heading' as ElementId,
      property: 'color',
      value: '#F5F5F2'
    }

    const res1 = applyCommand(s0, cmd)
    expect(res1.ok).toBe(true)
    if (!res1.ok) return

    expect(res1.state.rev).toBe(1)
    expect(res1.patches.length).toBeGreaterThan(0)

    // Replay exact same commandId
    const res2 = applyCommand(res1.state, cmd)
    expect(res2.ok).toBe(true)
    if (!res2.ok) return

    expect(res2.state).toBe(res1.state)
    expect(res2.patches).toEqual([])
    expect(res2.inversePatches).toEqual([])
  })

  it('2. command targeting a non-existent element fails with TARGET_MISSING', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-missing-target' as CommandId,
      baseRev: s0.rev,
      targetId: 'el-does-not-exist' as ElementId,
      property: 'color',
      value: '#FFFFFF'
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('TARGET_MISSING')
  })

  it('3. moving element into its own descendant is rejected with CYCLE error', () => {
    const s0 = referenceProject()
    // sec-features contains el-card-a
    const res = applyCommand(s0, {
      type: 'move_element',
      commandId: 'cmd-cycle-test' as CommandId,
      baseRev: s0.rev,
      elementId: 'sec-features' as ElementId,
      newParentId: 'el-card-a' as ElementId
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('CYCLE')
  })

  it('4. removing an element marks related instance decisions orphaned rather than deleting them', () => {
    const s0 = referenceProject()
    expect(s0.decisions.get('dec-hero-font' as never)?.status).toBe('approved')

    const res = applyCommand(s0, {
      type: 'remove_element',
      commandId: 'cmd-remove-hero' as CommandId,
      baseRev: s0.rev,
      elementId: 'el-hero-heading' as ElementId
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return

    const dec = res.state.decisions.get('dec-hero-font' as never)
    expect(dec).toBeDefined()
    expect(dec?.status).toBe('orphaned')
  })

  it('5. undo on empty history returns EMPTY_HISTORY error', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'undo',
      commandId: 'cmd-undo-empty' as CommandId
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('EMPTY_HISTORY')
  })

  it('6. redo after a new command returns EMPTY_REDO (redo stack cleared)', () => {
    const s0 = referenceProject()
    const edit1 = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-e1' as CommandId,
      baseRev: s0.rev,
      targetId: 'el-hero-heading' as ElementId,
      property: 'color',
      value: '#F5F5F2'
    })
    expect(edit1.ok).toBe(true)
    if (!edit1.ok) return

    const undone = applyCommand(edit1.state, {
      type: 'undo',
      commandId: 'cmd-undo-1' as CommandId
    })
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(undone.state.redoStack.length).toBe(1)

    // Intervening new command
    const edit2 = applyCommand(undone.state, {
      type: 'set_property',
      commandId: 'cmd-e2' as CommandId,
      baseRev: undone.state.rev,
      targetId: 'el-hero-heading' as ElementId,
      property: 'color',
      value: '#ECECE8'
    })
    expect(edit2.ok).toBe(true)
    if (!edit2.ok) return
    expect(edit2.state.redoStack.length).toBe(0)

    const redoAttempt = applyCommand(edit2.state, {
      type: 'redo',
      commandId: 'cmd-redo-fail' as CommandId
    })
    expect(redoAttempt.ok).toBe(false)
    if (redoAttempt.ok) return
    expect(redoAttempt.error.code).toBe('EMPTY_REDO')
  })

  it('7. batch failure at step 2 of 3 rolls back all changes atomically', () => {
    const s0 = referenceProject()
    const headingInitialColor = s0.nodes.get('el-hero-heading' as ElementId)?.props['color']

    const res = applyCommand(s0, {
      type: 'batch',
      commandId: 'cmd-batch-atomic' as CommandId,
      commands: [
        {
          type: 'set_property',
          commandId: 'sub-1' as CommandId,
          baseRev: s0.rev,
          targetId: 'el-hero-heading' as ElementId,
          property: 'color',
          value: '#F5F5F2'
        },
        {
          type: 'set_property',
          commandId: 'sub-2' as CommandId,
          baseRev: s0.rev,
          targetId: 'el-does-not-exist' as ElementId, // FAILS HERE
          property: 'color',
          value: '#000000'
        },
        {
          type: 'set_property',
          commandId: 'sub-3' as CommandId,
          baseRev: s0.rev,
          targetId: 'el-hero-heading' as ElementId,
          property: 'color',
          value: '#1C1C1A'
        }
      ]
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('BATCH_FAILED')
    // s0 state must remain pristine
    expect(s0.nodes.get('el-hero-heading' as ElementId)?.props['color']).toBe(headingInitialColor)
  })

  it('8. prototype pollution keys in commands are rejected and Object.prototype stays clean', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'add_element',
      commandId: 'cmd-pollute' as CommandId,
      baseRev: s0.rev,
      elementId: '__proto__' as unknown as ElementId,
      parentId: 'sec-hero' as ElementId,
      kind: 'text',
      props: { text: 'injection attempt' }
    })

    expect(res.ok).toBe(false)
    expect((Object.prototype as unknown as Record<string, unknown>)['text']).toBeUndefined()
  })

  it('9. stale baseRev commands are rejected with STALE_BASE', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-stale-rev' as CommandId,
      baseRev: 999, // Stale!
      targetId: 'el-hero-heading' as ElementId,
      property: 'color',
      value: '#F5F5F2'
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('STALE_BASE')
  })

  it('10. unknown properties outside kind allowlist are rejected', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-unknown-prop' as CommandId,
      baseRev: s0.rev,
      targetId: 'el-hero-cta' as ElementId, // button
      property: 'fontSize', // heading/text property, forbidden on button
      value: { value: 20, unit: 'px' }
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('PROPERTY_UNKNOWN')
  })

  it('11. apply_candidate is idempotent by candidateId', () => {
    const s0 = referenceProject()
    const cmd = {
      type: 'apply_candidate',
      commandId: 'cmd-cand-1' as CommandId,
      candidateId: 'cand-hero-var-1' as CandidateId,
      componentDefId: 'button',
      baseRev: s0.rev,
      targetId: 'el-hero-cta' as ElementId,
      patches: [
        { property: 'bgColor', value: 'oklch(0.40 0.20 250)' },
        { property: 'textColor', value: '#F5F3EC' }
      ]
    }

    const res1 = applyCommand(s0, cmd)
    expect(res1.ok).toBe(true)
    if (!res1.ok) return

    const res2 = applyCommand(res1.state, {
      ...cmd,
      commandId: 'cmd-cand-2' as CommandId // Different commandId, same candidateId
    })
    expect(res2.ok).toBe(true)
    if (!res2.ok) return

    expect(res2.patches).toEqual([])
    expect(res2.state).toBe(res1.state)
  })

  it('11a. apply_candidate records an instance decision and leaves base props untouched', () => {
    const s0 = referenceProject()
    const targetId = 'el-hero-cta' as ElementId
    const baseBg = s0.nodes.get(targetId)?.props.bgColor

    const res = applyCommand(s0, {
      type: 'apply_candidate',
      commandId: 'cmd-cand-decision' as CommandId,
      candidateId: 'cand-hero-var-2' as CandidateId,
      componentDefId: 'button',
      baseRev: s0.rev,
      targetId,
      patches: [
        { property: 'bgColor', value: 'oklch(0.40 0.20 250)' },
        { property: 'textColor', value: '#F5F3EC' }
      ]
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return

    expect(res.state.nodes.get(targetId)?.props.bgColor).toBe(baseBg)
    const decisions = [...res.state.decisions.values()].filter(
      (d) => d.property === 'bgColor' && d.scope.kind === 'instance' && d.scope.elementId === targetId
    )
    expect(decisions).toHaveLength(1)
    expect(decisions[0]?.status).toBe('approved')
    expect(decisions[0]?.value).toBe('oklch(0.40 0.20 250)')
    expect(validateProject(res.state)).toEqual([])
  })

  it('11b. apply_candidate rejects a property outside the target kind allowlist', () => {
    const s0 = referenceProject()

    const res = applyCommand(s0, {
      type: 'apply_candidate',
      commandId: 'cmd-cand-bad-prop' as CommandId,
      candidateId: 'cand-hero-var-3' as CandidateId,
      componentDefId: 'button',
      baseRev: s0.rev,
      targetId: 'el-hero-cta' as ElementId, // button: no fontSize
      patches: [{ property: 'fontSize', value: { value: 20, unit: 'px' } }]
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('CANDIDATE_INVALID')
    expect(
      [...s0.decisions.values()].some(
        (d) => d.property === 'fontSize' && d.scope.kind === 'instance' && d.scope.elementId === 'el-hero-cta'
      )
    ).toBe(false)
  })

  it('11c. apply_candidate rejects a definition that does not match the target kind', () => {
    const s0 = referenceProject()
    const res = applyCommand(s0, {
      type: 'apply_candidate',
      commandId: 'cmd-cand-wrong-def' as CommandId,
      candidateId: 'cand-hero-var-4' as CandidateId,
      componentDefId: 'hero', // section def on a button
      baseRev: s0.rev,
      targetId: 'el-hero-cta' as ElementId,
      patches: [
        { property: 'bgColor', value: '#1C1C1A' },
        { property: 'textColor', value: '#F5F3EC' }
      ]
    })

    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('CANDIDATE_INVALID')
  })

  it('11d. apply_candidate enforces required props and hard constraints at apply time', () => {
    const s0 = referenceProject()

    const missingRequired = applyCommand(s0, {
      type: 'apply_candidate',
      commandId: 'cmd-cand-missing' as CommandId,
      candidateId: 'cand-hero-var-5' as CandidateId,
      componentDefId: 'button',
      baseRev: s0.rev,
      targetId: 'el-hero-cta' as ElementId,
      patches: [{ property: 'bgColor', value: '#1C1C1A' }] // textColor required
    })
    expect(missingRequired.ok).toBe(false)
    if (missingRequired.ok) return
    expect(missingRequired.error.code).toBe('CANDIDATE_INVALID')

    const lowContrast = applyCommand(s0, {
      type: 'apply_candidate',
      commandId: 'cmd-cand-contrast' as CommandId,
      candidateId: 'cand-hero-var-6' as CandidateId,
      componentDefId: 'button',
      baseRev: s0.rev,
      targetId: 'el-hero-cta' as ElementId,
      patches: [
        { property: 'bgColor', value: '#000000' },
        { property: 'textColor', value: '#000000' }
      ]
    })
    expect(lowContrast.ok).toBe(false)
    if (lowContrast.ok) return
    expect(lowContrast.error.code).toBe('CANDIDATE_INVALID')
    expect(lowContrast.error.message).toContain('Contrast')
  })

  it('12. consecutive set_property within same gesture merges into one history entry', () => {
    const s0 = referenceProject()
    const gestureId = 'drag-session-1'

    const res1 = applyCommand(s0, {
      type: 'set_property',
      commandId: 'cmd-scrub-1' as CommandId,
      baseRev: s0.rev,
      targetId: 'el-hero-heading' as ElementId,
      property: 'color',
      value: '#1C1C1A',
      gestureId
    })
    expect(res1.ok).toBe(true)
    if (!res1.ok) return

    const res2 = applyCommand(res1.state, {
      type: 'set_property',
      commandId: 'cmd-scrub-2' as CommandId,
      baseRev: res1.state.rev,
      targetId: 'el-hero-heading' as ElementId,
      property: 'color',
      value: '#F5F5F2',
      gestureId
    })
    expect(res2.ok).toBe(true)
    if (!res2.ok) return

    expect(res2.state.undoStack.length).toBe(1)

    // Undo should revert all the way back to initial state before gesture started
    const undone = applyCommand(res2.state, {
      type: 'undo',
      commandId: 'cmd-undo-merged' as CommandId
    })
    expect(undone.ok).toBe(true)
    if (!undone.ok) return

    expect(undone.state.nodes.get('el-hero-heading' as ElementId)?.props['color']).toBe('#1C1C1A')
  })
})
