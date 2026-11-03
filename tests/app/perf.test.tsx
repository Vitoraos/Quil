import { describe, expect, it } from 'vitest'
import { performance } from 'perf_hooks'
import { buildSyntheticFixture, setInvariantChecking } from '../../src/core'
import { QuilStore } from '../../src/app/store'

// Invariant checking is sampled in production per AGENTS.md defensive standard;
// the perf budget applies to the command path (production configuration).
setInvariantChecking(false)

describe('perf: 1,000 set_property commands p95 + undo budget', () => {
  it('dispatches 1,000 set_property commands with per-command p95 under budget', () => {
    const state = buildSyntheticFixture(500)
    const store = new QuilStore(state)

    const elId = [...state.nodes.keys()].filter((id) => String(id).includes('el-perf-'))[0] as never
    const timings: number[] = []

    for (let i = 0; i < 1000; i++) {
      const start = performance.now()
      const res = store.dispatch({
        type: 'set_property',
        commandId: `cmd-perf-${i}` as never,
        baseRev: store.getState().rev,
        targetId: elId,
        property: 'color',
        value: i % 2 === 0 ? '#1C1C1A' : '#F5F5F2'
      })
      timings.push(performance.now() - start)
      expect(res.ok).toBe(true)
    }

    timings.sort((a, b) => a - b)
    const p95 = timings[Math.floor(timings.length * 0.95)]!
    expect(p95).toBeLessThan(10)
  })

  it('undo under 32ms', () => {
    const state = buildSyntheticFixture(500)
    const store = new QuilStore(state)

    const elId = [...state.nodes.keys()].filter((id) => String(id).includes('el-perf-'))[0] as never
    store.dispatch({
      type: 'set_property',
      commandId: 'cmd-undo-1' as never,
      baseRev: store.getState().rev,
      targetId: elId,
      property: 'color',
      value: '#F5F5F2'
    })

    const start = performance.now()
    store.dispatch({ type: 'undo', commandId: 'cmd-undo-2' as never })
    const undoMs = performance.now() - start

    expect(undoMs).toBeLessThan(32)
  })
})
