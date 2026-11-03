import { performance } from 'perf_hooks'
import { applyCommand, buildSyntheticFixture, setInvariantChecking } from '../src/core'

const totalNodes = 2000
const iterations = 500

function measure(checks: boolean): number[] {
  const state = buildSyntheticFixture(totalNodes)
  setInvariantChecking(checks)
  const textElementId = [...state.nodes.keys()].filter((id) => id.includes('el-perf-'))[0]!

  // Warmup
  for (let i = 0; i < 20; i++) {
    applyCommand(state, {
      type: 'set_property',
      commandId: `bench-warm-${i}-${checks}` as never,
      baseRev: state.rev,
      targetId: textElementId,
      property: 'color',
      value: i % 2 === 0 ? '#1C1C1A' : '#F5F5F2'
    })
  }

  const timings: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    applyCommand(state, {
      type: 'set_property',
      commandId: `bench-${i}-${checks}` as never,
      baseRev: state.rev,
      targetId: textElementId,
      property: 'color',
      value: i % 2 === 0 ? '#1C1C1A' : '#F5F5F2'
    })
    timings.push(performance.now() - start)
  }
  return timings
}

const withValidation = measure(true)
const withoutValidation = measure(false)

withValidation.sort((a, b) => a - b)
withoutValidation.sort((a, b) => a - b)

const p95Validation = withValidation[Math.floor(iterations * 0.95)]!
const p50Validation = withValidation[Math.floor(iterations * 0.5)]!
const maxValidation = withValidation[withValidation.length - 1]!

const p95NoValidation = withoutValidation[Math.floor(iterations * 0.95)]!
const p50NoValidation = withoutValidation[Math.floor(iterations * 0.5)]!
const maxNoValidation = withoutValidation[withoutValidation.length - 1]!

console.log(`Phase 1 Performance Benchmark: set_property on ${totalNodes}-element fixture`)
console.log(`Iterations: ${iterations}`)
console.log(`--- With invariant validation (default) ---`)
console.log(`p50: ${p50Validation.toFixed(3)} ms`)
console.log(`p95: ${p95Validation.toFixed(3)} ms`)
console.log(`max: ${maxValidation.toFixed(3)} ms`)
console.log(`--- Without invariant validation (production-sampled) ---`)
console.log(`p50: ${p50NoValidation.toFixed(3)} ms`)
console.log(`p95: ${p95NoValidation.toFixed(3)} ms`)
console.log(`max: ${maxNoValidation.toFixed(3)} ms`)
console.log(`Budget p95 < 2 ms (no validation): ${p95NoValidation < 2 ? 'PASS' : 'FAIL'}`)
console.log(`Budget p95 < 2 ms (with validation): ${p95Validation < 2 ? 'PASS' : 'FAIL'}`)
