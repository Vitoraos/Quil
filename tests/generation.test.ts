import { describe, expect, it } from 'vitest'
import { dedupeCandidates, type Candidate } from '../src/core/generation'

function candidate(candidateId: string, props: Record<string, unknown>): Candidate {
  return {
    candidateId: candidateId as never,
    componentDefId: 'button',
    targetId: 'el-hero-cta' as never,
    props
  }
}

describe('dedupeCandidates', () => {
  it('drops near-identical candidates regardless of prop order and keeps distinct ones', () => {
    const a = candidate('cand-1', { bgColor: '#1C1C1A', textColor: '#F5F3EC' })
    const b = candidate('cand-2', { textColor: '#F5F3EC', bgColor: '#1C1C1A' })
    const c = candidate('cand-3', { bgColor: '#1C1C1A', textColor: '#F5F3EC', radius: 12 })

    expect(dedupeCandidates([a, b, c]).map((x) => x.candidateId)).toEqual(['cand-1', 'cand-3'])
  })

  it('keeps candidates with the same props on different targets', () => {
    const a = candidate('cand-1', { bgColor: '#1C1C1A' })
    const b = { ...candidate('cand-2', { bgColor: '#1C1C1A' }), targetId: 'el-other' as never }

    expect(dedupeCandidates([a, b])).toHaveLength(2)
  })
})
