// Real BYOK provider adapter for the variant generator. Self-contained
// (modules may not import each other, so it does not pull in intake's
// RequestLayer): deadline via AbortController, size caps, schema validation.
// The key is held in memory only and redacted in logs.

import type { VariantContext, VariantOutput } from './schemas'
import type { VariantProvider } from './provider'
import { variantOutputSchema } from './schemas'
import { VariantProviderError } from './provider'
import { VARIANT_SYSTEM_PROMPT } from './prompts'

export interface ByokAdapterOptions {
  apiKey: string
  baseUrl: string
  fetchImpl?: typeof fetch
  deadlineMs?: number
  maxResponseBytes?: number
}

export class ByokAdapter implements VariantProvider {
  private apiKey: string
  private baseUrl: string
  private fetchImpl: typeof fetch
  private deadlineMs: number
  private maxResponseBytes: number

  constructor(options: ByokAdapterOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.deadlineMs = options.deadlineMs ?? 30000
    this.maxResponseBytes = options.maxResponseBytes ?? 200000
  }

  /** Redact the key from any message for logging. */
  private redact(message: string): string {
    return message.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED KEY]')
  }

  async proposeVariants(input: {
    context: VariantContext
    instruction: string | null
    signal?: AbortSignal
  }): Promise<VariantOutput> {
    const bodyStr = JSON.stringify({
      system: VARIANT_SYSTEM_PROMPT,
      context: input.context,
      instruction: input.instruction
    })
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), this.deadlineMs)

    const combined = new AbortController()
    const unlisten = input.signal?.addEventListener
      ? () => input.signal!.addEventListener('abort', () => combined.abort(), { once: true })
      : () => {}
    unlisten()
    if (input.signal?.aborted) combined.abort()
    input.signal?.addEventListener('abort', () => combined.abort(), { once: true })

    // Connect the deadline controller to the combined signal so the timeout fires.
    controller.signal.addEventListener('abort', () => combined.abort(), { once: true })

    try {
      const res = await this.fetchImpl(`${this.baseUrl}/v1/propose-variants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: bodyStr,
        signal: combined.signal
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new VariantProviderError(
          'INVALID_RESPONSE',
          this.redact(`Provider returned ${res.status}: ${body.slice(0, 500)}`),
          'provider-response',
          'propose-variants',
          true
        )
      }

      const contentLength = Number(res.headers.get('content-length') ?? '0')
      if (contentLength > 0 && contentLength > this.maxResponseBytes) {
        throw new VariantProviderError('TOO_LARGE', `Response ${contentLength} bytes exceeds cap`, 'provider-response', 'propose-variants', false)
      }

      const text = await res.text()
      if (new TextEncoder().encode(text).length > this.maxResponseBytes) {
        throw new VariantProviderError('TOO_LARGE', 'Response body exceeds size cap', 'provider-response', 'propose-variants', false)
      }

      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new VariantProviderError('INVALID_RESPONSE', 'Provider returned non-JSON', 'provider-response', 'propose-variants', true)
      }

      return variantOutputSchema.parse(json)
    } finally {
      clearTimeout(deadline)
    }
  }

  /** Clear the key from memory. */
  destroy(): void {
    this.apiKey = ''
  }
}

export function createByokAdapter(options: ByokAdapterOptions): ByokAdapter {
  return new ByokAdapter(options)
}
