import { afterAll, describe, expect, it } from 'vitest'
import { applyCommand, referenceProject, validateProject } from '../src/core'

const SEED = 0x5f3759df

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = Math.imul(t + (t >>> 3), t)
    t = t + (t >>> 16)
    t ^= t << 16
    t += t << 4
    t ^= t << 12
    t = t + (t >>> 7)
    t = t + (t >>> 15)
    return (t >>> 0) / 4294967296
  }
}

describe('Phase 1 exit gate: 10,000 fuzzed command sequences produce no invariant violation', () => {
  it('no invariant violations across 10,000 random command sequences', () => {
    const rand = mulberry32(SEED)
    const kind = ['set_property', 'undo', 'redo', 'add_element', 'remove_element', 'move_element', 'apply_candidate'] as const
    const propPool = ['color', 'bgColor', 'text', 'level', 'padding', 'radius', 'fontWeight', 'align']
    const valuePool = ['#1C1C1A', '#F5F5F2', 'oklch(0.47 0.27 264)', { value: 16, unit: 'px' }, NaN, Infinity]

    const ids = [
      'el-hero-heading', 'el-hero-text', 'el-hero-cta', 'el-hero-img',
      'sec-hero', 'sec-nav', 'sec-features', 'sec-footer',
      'el-card-a', 'el-card-a-h', 'el-card-b', 'el-card-b-h', 'el-footer-copy'
    ]

    let violations = 0
    let rejectedCommands = 0

    for (let seq = 0; seq < 10000; seq++) {
      const state = referenceProject()
      const steps = 3 + Math.floor(rand() * 5) // 3 to 7 steps per sequence

      for (let step = 0; step < steps; step++) {
        const kindPick = kind[Math.floor(rand() * kind.length)]
        const targetId = ids[Math.floor(rand() * ids.length)]

        if (kindPick === 'set_property') {
          const res = applyCommand(state, {
            type: 'set_property',
            commandId: `f-${seq}-${step}` as never,
            baseRev: state.rev,
            targetId: targetId as never,
            property: propPool[Math.floor(rand() * propPool.length)],
            value: valuePool[Math.floor(rand() * valuePool.length)]
          })
          if (!res.ok) {
            rejectedCommands++
            continue
          }
        } else if (kindPick === 'undo') {
          const res = applyCommand(state, {
            type: 'undo',
            commandId: `f-${seq}-${step}` as never
          })
          if (!res.ok) {
            rejectedCommands++
            continue
          }
        } else if (kindPick === 'redo') {
          const res = applyCommand(state, {
            type: 'redo',
            commandId: `f-${seq}-${step}` as never
          })
          if (!res.ok) {
            rejectedCommands++
            continue
          }
        } else if (kindPick === 'add_element') {
          const res = applyCommand(state, {
            type: 'add_element',
            commandId: `f-${seq}-${step}` as never,
            baseRev: state.rev,
            elementId: `f-el-${seq}-${step}` as never,
            parentId: targetId as never,
            kind: 'text',
            props: { text: 'fuzz text' }
          })
          if (!res.ok) {
            rejectedCommands++
            continue
          }
        } else if (kindPick === 'remove_element') {
          const res = applyCommand(state, {
            type: 'remove_element',
            commandId: `f-${seq}-${step}` as never,
            baseRev: state.rev,
            elementId: targetId as never
          })
          if (!res.ok) {
            rejectedCommands++
            continue
          }
        } else if (kindPick === 'move_element') {
          const res = applyCommand(state, {
            type: 'move_element',
            commandId: `f-${seq}-${step}` as never,
            baseRev: state.rev,
            elementId: targetId as never,
            newParentId: targetId as never
          })
          if (!res.ok) {
            rejectedCommands++
            continue
          }
        } else if (kindPick === 'apply_candidate') {
          const targetKind = state.nodes.get(targetId as never)?.kind
          const defId = targetKind === 'section' ? 'hero' : targetKind === 'button' ? 'button' : null
          if (!defId) {
            rejectedCommands++
            continue
          }
          const res = applyCommand(state, {
            type: 'apply_candidate',
            commandId: `f-${seq}-${step}` as never,
            candidateId: `f-cand-${seq}-${step}` as never,
            componentDefId: defId,
            baseRev: state.rev,
            targetId: targetId as never,
            patches: [
              { property: 'bgColor', value: '#1C1C1A' },
              { property: 'textColor', value: '#F5F3EC' }
            ]
          })
          if (!res.ok) {
            rejectedCommands++
            continue
          }
        }

        // After every successful apply, validate invariant clean
        const violationsThisStep = validateProject(state)
        if (violationsThisStep.length > 0) {
          violations++
          break // this sequence produced a violation
        }
      }
    }

    expect(violations).toBe(0)
  })

  afterAll(() => {
    console.log('Fuzz gate completed: 10,000 sequences evaluated')
  })
})
