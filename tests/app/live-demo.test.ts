// tests/app/live-demo.test.ts
// Landing-page live demo: the real decision engine enforces scoped precedence.
// Changing one global button rule updates only applicable buttons; a button
// with an instance override keeps its own colour.

import { describe, expect, it } from 'vitest'
import { demoProject, type ElementId } from '../../src/core'
import { QuilStore } from '../../src/app/store'
import { createResolver } from '../../src/app/resolve'

const B1 = 'el-demo-btn-1' as ElementId
const B2 = 'el-demo-btn-2' as ElementId
const B3 = 'el-demo-btn-3' as ElementId // promo: instance override holds
const B4 = 'el-demo-btn-4' as ElementId

const NEW_RULE = 'oklch(0.97 0.01 80)'
const PROMO_OVERRIDE = '#868076'
const INITIAL_GLOBAL = '#8B5CF6'

function resolvedBg(store: QuilStore, resolver: ReturnType<typeof createResolver>, id: ElementId): string {
  const r = resolver.resolve(store.getState(), id)
  return r.ok ? String(r.result.props.bgColor ?? '') : ''
}

describe('live demo decision behaviour', () => {
  it('applies a global button rule to every applicable button', () => {
    const store = new QuilStore(demoProject())
    const resolver = createResolver()

    // Initial: buttons without an override take the global accent; the promo
    // button keeps its own instance override from the start.
    expect(resolvedBg(store, resolver, B1)).toBe(INITIAL_GLOBAL)
    expect(resolvedBg(store, resolver, B2)).toBe(INITIAL_GLOBAL)
    expect(resolvedBg(store, resolver, B4)).toBe(INITIAL_GLOBAL)
    expect(resolvedBg(store, resolver, B3)).toBe(PROMO_OVERRIDE)

    // Change the single global button rule.
    const applied = store.dispatch({
      type: 'set_property',
      commandId: 'cmd-demo-change' as never,
      baseRev: store.getState().rev,
      targetId: B1,
      property: 'bgColor',
      value: NEW_RULE,
      scope: { kind: 'global', targetType: 'button' }
    })
    expect(applied.ok).toBe(true)

    // Applicable buttons take the new rule...
    for (const id of [B1, B2, B4]) {
      expect(resolvedBg(store, resolver, id)).toBe(NEW_RULE)
    }
    // ...but the promo button's instance override (rank 3 > global rank 1) holds.
    expect(resolvedBg(store, resolver, B3)).toBe(PROMO_OVERRIDE)
  })

  it('is idempotent: replaying the same command changes nothing', () => {
    const store = new QuilStore(demoProject())
    const resolver = createResolver()
    const command = {
      type: 'set_property' as const,
      commandId: 'cmd-demo-idempotent' as never,
      baseRev: store.getState().rev,
      targetId: B1,
      property: 'bgColor',
      value: NEW_RULE,
      scope: { kind: 'global', targetType: 'button' }
    }
    const first = store.dispatch(command)
    const second = store.dispatch(command)
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    expect(resolvedBg(store, resolver, B1)).toBe(NEW_RULE)
  })
})
