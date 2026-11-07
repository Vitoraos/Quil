import { describe, expect, it, vi } from 'vitest'
import { createByokAdapter } from '../../src/modules/variants/byok-adapter'
import type { VariantContext } from '../../src/modules/variants/schemas'

describe('byok-adapter', () => {
  const baseContext: VariantContext = {
    project: { brief: 'A test site' },
    page: { name: 'Home', purpose: 'Landing', position: 1, otherPages: [] },
    section: { key: 'hero', purpose: 'Hero', position: 1, elements: [] },
    target: { id: 'el-1', kind: 'section', componentDefId: 'hero', purpose: 'Hero', required: true, props: {} },
    houseRules: [],
    palette: ['#1C1C1A'],
    history: [],
    revisions: { targetRev: 1, decisionVersion: 1, specVersion: 1 }
  }

  it('connects the deadline AbortController to the fetch signal (timeout fires)', async () => {
    let receivedSignal: AbortSignal | null = null
    // Return a response slower than the deadline so the deadline abort fires first
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init: RequestInit) => {
      receivedSignal = init.signal as AbortSignal | null
      await new Promise((resolve) => setTimeout(resolve, 5000))
      return new Response(JSON.stringify({ candidates: [] }), { status: 200 })
    }) as unknown as typeof fetch

    const adapter = createByokAdapter({
      apiKey: 'sk-test12345678901234567890',
      baseUrl: 'https://api.example.com',
      fetchImpl,
      deadlineMs: 50
    })

    await expect(
      adapter.proposeVariants({ context: baseContext, instruction: null })
    ).rejects.toThrow()

    // The deadline controller's signal should have been passed to fetch
    expect(receivedSignal).not.toBeNull()
    expect(receivedSignal!.aborted).toBe(true)

    adapter.destroy()
  })

  it('sends the system prompt in the request body', async () => {
    let receivedBody: string | null = null
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init: RequestInit) => {
      receivedBody = init.body as string
      return new Response(JSON.stringify({ candidates: [{ componentDefId: 'button', props: {}, explanation: 'test', uses: [], deviatesFrom: [] }] }), { status: 200 })
    }) as unknown as typeof fetch

    const adapter = createByokAdapter({
      apiKey: 'sk-test12345678901234567890',
      baseUrl: 'https://api.example.com',
      fetchImpl
    })

    await adapter.proposeVariants({ context: baseContext, instruction: 'Make it bolder' })
    expect(receivedBody).not.toBeNull()
    const body = JSON.parse(receivedBody!)
    expect(body.system).toContain('variant designer')
    expect(body.instruction).toBe('Make it bolder')
    expect(body.context).toEqual(baseContext)

    adapter.destroy()
  })

  it('redacts the API key in error messages', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response('sk-secret12345678901234567890 leaked', { status: 500, statusText: 'Internal Server Error' })
    }) as unknown as typeof fetch

    const adapter = createByokAdapter({
      apiKey: 'sk-secret12345678901234567890',
      baseUrl: 'https://api.example.com',
      fetchImpl
    })

    await expect(
      adapter.proposeVariants({ context: baseContext, instruction: null })
    ).rejects.toThrow(/\[REDACTED KEY\]/)

    adapter.destroy()
  })
})
