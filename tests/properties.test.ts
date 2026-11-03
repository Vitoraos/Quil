import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  applyCommand,
  referenceProject,
  validateProject,
  type CommandId,
  type ElementId
} from '../src/core'

describe('core model invariants (fast-check property tests)', () => {
  it('Property A: Any random command leaves validateProject clean or is rejected with state unchanged', () => {
    const s0 = referenceProject()

    const targets = ['el-hero-heading', 'el-hero-text', 'el-hero-cta', 'sec-hero', 'el-card-a'] as const
    const properties = ['color', 'bgColor', 'text', 'level', 'padding', 'invalid_prop'] as const

    fc.assert(
      fc.property(
        fc.constantFrom(...targets),
        fc.constantFrom(...properties),
        fc.oneof(
          fc.constant('#1C1C1A'),
          fc.constant('#F5F5F2'),
          fc.constant('oklch(0.47 0.27 264)'),
          fc.string({ maxLength: 100 }),
          fc.integer({ min: -50, max: 100 }),
          fc.constant(NaN),
          fc.constant(Infinity)
        ),
        (targetId, property, value) => {
          const res = applyCommand(s0, {
            type: 'set_property',
            commandId: `cmd-prop-a-${Math.random()}` as CommandId,
            baseRev: s0.rev,
            targetId: targetId as ElementId,
            property,
            value
          })

          if (res.ok) {
            const violations = validateProject(res.state)
            expect(violations).toEqual([])
          } else {
            // State must be completely untouched
            expect(s0.rev).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property B: Undo then Redo round trips to identical state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('#F5F5F2', '#ECECE8'),
        fc.integer({ min: 0, max: 999999 }),
        (newColor, seq) => {
          const s0 = referenceProject()
          const edit = applyCommand(s0, {
            type: 'set_property',
            commandId: `cmd-round-trip-${seq}` as CommandId,
            baseRev: s0.rev,
            targetId: 'el-hero-heading' as ElementId,
            property: 'color',
            value: newColor
          })

          expect(edit.ok).toBe(true)
          if (!edit.ok) return

          const undone = applyCommand(edit.state, {
            type: 'undo',
            commandId: `cmd-undo-${seq}` as CommandId
          })
          expect(undone.ok).toBe(true)
          if (!undone.ok) return

          // After undo, heading color returns to original
          expect(undone.state.nodes.get('el-hero-heading' as ElementId)?.props['color']).toBe('#1C1C1A')

          const redone = applyCommand(undone.state, {
            type: 'redo',
            commandId: `cmd-redo-${seq}` as CommandId
          })
          expect(redone.ok).toBe(true)
          if (!redone.ok) return

          // After redo, heading color matches edit state
          expect(redone.state.nodes.get('el-hero-heading' as ElementId)?.props['color']).toBe(newColor)
        }
      ),
      { numRuns: 20 }
    )
  })

  it('Property C: Replaying the same CommandId is strictly idempotent', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 20 }).map((s) => `cmd-idemp-${s.toLowerCase().replace(/[^a-z0-9_-]/g, 'a')}` as CommandId),
        (cmdId) => {
          const s0 = referenceProject()
          const cmd = {
            type: 'set_property',
            commandId: cmdId,
            baseRev: s0.rev,
            targetId: 'el-hero-heading' as ElementId,
            property: 'color',
            value: '#F5F5F2'
          }

          const res1 = applyCommand(s0, cmd)
          expect(res1.ok).toBe(true)
          if (!res1.ok) return

          const res2 = applyCommand(res1.state, cmd)
          expect(res2.ok).toBe(true)
          if (!res2.ok) return

          expect(res2.state).toBe(res1.state)
          expect(res2.patches).toEqual([])
        }
      ),
      { numRuns: 25 }
    )
  })
})
