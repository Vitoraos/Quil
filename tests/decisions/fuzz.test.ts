import { describe, expect, it } from 'vitest'
import { applyCommand, referenceProject, resolveElement, createResolverMemo } from '../../src/core'

const SEED = 0xdeadbeef

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

describe('decision resolver oracle: incremental resolve == full resolve', () => {
  it('across 10,000 random edits with no divergence', () => {
    const rand = mulberry32(SEED)
    const propPool = ['color', 'bgColor', 'text', 'fontSize', 'radius', 'align']
    const valuePool = ['#1C1C1A', '#F5F5F2', 'oklch(0.47 0.27 264)', '#ECECE8', { value: 16, unit: 'px' }, 'center']
    const kindsPool = ['button', 'text', 'heading', 'card']
    const scopePool: any[] = [
      { kind: 'global', targetType: 'button' },
      { kind: 'global', targetType: 'heading' },
      { kind: 'instance', elementId: 'el-hero-cta' },
      { kind: 'instance', elementId: 'el-hero-heading' },
      { kind: 'page', pageId: 'page-home', targetType: 'button' },
      null
    ]

    const ids = ['el-hero-heading', 'el-hero-text', 'el-hero-cta', 'sec-hero', 'el-footer-copy']

    let divergenceCount = 0
    let seq = 0

    for (let sequence = 0; sequence < 10000; sequence++) {
      const state = referenceProject()
      const steps = 3 + Math.floor(rand() * 4)

      for (let step = 0; step < steps; step++) {
        const pickTarget = ids[Math.floor(rand() * ids.length)]
        const pickProp = propPool[Math.floor(rand() * propPool.length)]
        const pickValue = valuePool[Math.floor(rand() * valuePool.length)]
        const pickScope = scopePool[Math.floor(rand() * scopePool.length)]
        const pickKind = kindsPool[Math.floor(rand() * kindsPool.length)]

        const res = applyCommand(state, {
          type: 'set_property',
          commandId: `fuzz-${sequence}-${step}` as never,
          baseRev: state.rev,
          targetId: pickTarget as never,
          property: pickProp,
          value: pickValue,
          ...(pickScope ? { scope: pickScope } : {})
        })

        if (!res.ok) continue

        // Build full resolve (no memo) vs memoized resolve for every element
        const fullMemo = createResolverMemo()
        const memoizedMemo = createResolverMemo()
        let divergent = false

        for (const [id] of state.nodes) {
          const full = resolveElement(state, id, undefined)
          const memoized = resolveElement(state, id, memoizedMemo)
          if (!full.ok || !memoized.ok) {
            divergent = true
            break
          }
          const afull = JSON.stringify(full.result.props)
          const amemo = JSON.stringify(memoized.result.props)
          const pf = JSON.stringify([...full.result.provenance.entries()].sort())
          const pm = JSON.stringify([...memoized.result.provenance.entries()].sort())
          if (afull !== amemo || pf !== pm) {
            divergent = true
            break
          }
        }

        if (divergent) {
          divergenceCount++
          break
        }
        seq++
      }
    }

    expect(divergenceCount).toBe(0)
  })
})
