import { performance } from 'perf_hooks'
import {
  applyCommand,
  buildSyntheticFixture,
  resolveElement,
  createResolverMemo,
  setInvariantChecking
} from '../src/core'

const totalNodes = 2000
const iterations = 500

// Build the 2,000-element fixture
const state = buildSyntheticFixture(totalNodes)
const textElementIds = [...state.nodes.keys()].filter((id) => id.includes('el-perf-')).slice(0, 200)

// Create a global decision touching ALL text elements (simulating a global button/text treatment change)
const decidedState = (() => {
  let id = ''
  const next = (() => {
    // produce via applyCommand set_property with scope global->text
    return applyCommand(state, {
      type: 'set_property',
      commandId: 'bench-global-decision' as never,
      baseRev: state.rev,
      targetId: textElementIds[0],
      property: 'color',
      value: '#F5F5F2',
      scope: { kind: 'global', targetType: 'text' }
    })
  })()
  if (!next.ok) throw new Error('failed to create global decision')
  id = [...next.state.decisions.values()].find((d) => d.property === 'color' && d.scope.kind === 'global')!.id
  return { state: next.state, id }
})()

setInvariantChecking(false)

// Warmup: resolve all 200 text elements
const memo = createResolverMemo()
for (const id of textElementIds) {
  resolveElement(decidedState.state, id, memo)
}

// Benchmark: incremental resolve of the 200 dirty elements (memoized, rev unchanged)
const incrementalTimings: number[] = []
for (let i = 0; i < iterations; i++) {
  const start = performance.now()
  for (const id of textElementIds) {
    resolveElement(decidedState.state, id, memo)
  }
  incrementalTimings.push(performance.now() - start)
}

// Benchmark: full resolve of all 2000 elements (no memo, cold)
const fullTimings: number[] = []
for (let i = 0; i < iterations; i++) {
  const start = performance.now()
  for (const [id] of decidedState.state.nodes) {
    resolveElement(decidedState.state, id, undefined)
  }
  fullTimings.push(performance.now() - start)
}

incrementalTimings.sort((a, b) => a - b)
fullTimings.sort((a, b) => a - b)

const incP95 = incrementalTimings[Math.floor(iterations * 0.95)]!
const incP50 = incrementalTimings[Math.floor(iterations * 0.5)]!
const fullP95 = fullTimings[Math.floor(iterations * 0.95)]!

console.log(`Phase 2 Performance Benchmark: resolver on ${totalNodes}-element fixture`)
console.log(`Iterations: ${iterations}`)
console.log(`Dirty elements resolved per iteration: ${textElementIds.length}`)
console.log(`--- Incremental resolve (memoized, dirty set of 200) ---`)
console.log(`p50: ${incP50.toFixed(3)} ms`)
console.log(`p95: ${incP95.toFixed(3)} ms`)
console.log(`--- Full cold resolve (all 2000 elements, no memo) ---`)
console.log(`p95: ${fullP95.toFixed(3)} ms`)
console.log(`Budget: global change touching 200 elements resolves < 10 ms: ${incP95 < 10 ? 'PASS' : 'FAIL'}`)

if (incP95 >= 10) {
  process.exit(1)
}
