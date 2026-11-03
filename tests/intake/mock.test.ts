import { describe, expect, it, vi } from 'vitest'
import { mockProvider } from '../../src/modules/intake/mock-provider'
import { createByokAdapter } from '../../src/modules/intake/adapters/byok-adapter'
import { RequestLayer, CircuitOpenError } from '../../src/modules/intake/request-layer'

describe('intake: mock provider determinism', () => {
  it('returns the same follow-up questions every time', async () => {
    const q1 = await mockProvider.generateFollowUpQuestions({ brief: 'x', answers: {} })
    const q2 = await mockProvider.generateFollowUpQuestions({ brief: 'y', answers: { q1: 'a' } })
    expect(q1).toEqual(q2)
    expect(q1.length).toBeGreaterThan(0)
    expect(q1[0]!.id).toBeDefined()
    expect(q1[0]!.question).toBeDefined()
  })

  it('returns the same page suggestions', async () => {
    const p1 = await mockProvider.suggestPages({ brief: 'x', answers: {} })
    const p2 = await mockProvider.suggestPages({ brief: 'y', answers: {} })
    expect(p1).toEqual(p2)
    expect(p1.length).toBeGreaterThan(0)
  })

  it('returns deterministic page specs per page name', async () => {
    const home1 = await mockProvider.generatePageSpec({ brief: 'x', answers: {}, pageName: 'Home' })
    const home2 = await mockProvider.generatePageSpec({ brief: 'y', answers: {}, pageName: 'Home' })
    expect(home1).toEqual(home2)
    expect(home1.name).toBe('Home')

    const about = await mockProvider.generatePageSpec({ brief: 'x', answers: {}, pageName: 'About' })
    expect(about.name).toBe('About')
    expect(about).not.toEqual(home1)
  })

  it('aborts on AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(mockProvider.generateFollowUpQuestions({ brief: 'x', answers: {} }, controller.signal)).rejects.toThrow()
  })
})

describe('intake: BYOK adapter redacts key in logs', () => {
  it('never includes the key in redacted messages', () => {
    const adapter = createByokAdapter({
      apiKey: 'sk-abcdef1234567890abcdef1234567890abcdef',
      baseUrl: 'https://api.example.com'
    })
    const redacted = (adapter as unknown as { redact: (m: string) => string }).redact('Error with sk-abcdef1234567890abcdef1234567890abcdef')
    expect(redacted).not.toContain('sk-abcdef')
    expect(redacted).toContain('[REDACTED KEY]')
    adapter.destroy()
  })

  it('destroy clears the key from memory', () => {
    const adapter = createByokAdapter({
      apiKey: 'sk-secret-key-12345678901234567890',
      baseUrl: 'https://api.example.com'
    })
    adapter.destroy()
    expect((adapter as unknown as { apiKey: string }).apiKey).toBe('')
  })
})

describe('intake: request layer circuit breaker', () => {
  it('opens circuit after threshold failures and blocks further requests', async () => {
    const layer = new RequestLayer({
      maxAttempts: 1,
      baseDelayMs: 1,
      maxDelayMs: 10,
      circuitThreshold: 2,
      circuitCooldownMs: 5000
    } as any)

    const failingFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'boom' }), { status: 500, headers: { 'content-type': 'application/json' } })
    })

    // Two failures trip the circuit
    for (let i = 0; i < 2; i++) {
      try {
        await layer.request('circuit-key', 'https://example.com', { method: 'POST', body: JSON.stringify({}) }, (json) => json, {
          fetchImpl: failingFetch as any,
          maxAttempts: 1
        })
      } catch {
        // expected
      }
    }

    let circuitOpen = false
    try {
      await layer.request('circuit-key', 'https://example.com', { method: 'POST', body: JSON.stringify({}) }, (json) => json, {
        maxAttempts: 1
      })
    } catch (e) {
      circuitOpen = (e as Error).name === 'CircuitOpenError'
    }
    expect(circuitOpen).toBe(true)
  })

  it('rejects oversized request body', async () => {
    const layer = new RequestLayer({
      maxRequestBytes: 10,
      maxAttempts: 1
    } as any)

    let tooLarge = false
    try {
      await layer.request('size-key', 'https://example.com', { method: 'POST', body: JSON.stringify({ data: 'x'.repeat(1000) }) }, (json) => json, {
        maxAttempts: 1
      })
    } catch (e) {
      tooLarge = (e as Error).name === 'RequestTooLargeError'
    }
    expect(tooLarge).toBe(true)
  })
})
