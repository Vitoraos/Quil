// Real BYOK (Bring-Your-Own-Key) provider adapter. The key is held in memory
// only, redacted in logs, never sent to analytics or stored in plaintext.
// Wraps RequestLayer for deadline, retry, circuit breaker, and size caps.

import { AIProvider, FollowUpQuestion, PageSuggestion, GeneratedPageSpec } from '../provider'
import {
  followUpQuestionsResponseSchema,
  suggestPagesResponseSchema,
  pageSpecResponseSchema,
  parseProviderResponse
} from '../schemas'
import { RequestLayer } from '../request-layer'

export interface ByokAdapterOptions {
  apiKey: string
  baseUrl: string
  fetchImpl?: typeof fetch
  requestLayer?: RequestLayer
}

export class ByokAdapter implements AIProvider {
  private apiKey: string
  private baseUrl: string
  private fetchImpl: typeof fetch
  private requestLayer: RequestLayer

  constructor(options: ByokAdapterOptions) {
    this.apiKey = options.apiKey
    this.baseUrl = options.baseUrl.replace(/\/$/, '')
    this.fetchImpl = options.fetchImpl ?? fetch
    this.requestLayer = options.requestLayer ?? new RequestLayer()
  }

  /** Redact the key from any message for logging. */
  private redact(message: string): string {
    return message.replace(/sk-[A-Za-z0-9]{20,}/g, '[REDACTED KEY]')
  }

  private async post<T>(path: string, body: unknown, parse: (json: unknown) => T, signal?: AbortSignal): Promise<T> {
    const bodyStr = JSON.stringify(body)
    const res = await this.requestLayer.request(
      path,
      `${this.baseUrl}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: bodyStr,
        signal: signal ?? undefined
      },
      parse,
      { signal: signal ?? undefined }
    )
    return res
  }

  async generateFollowUpQuestions(input: { brief: string; answers: Record<string, string> }, signal?: AbortSignal): Promise<FollowUpQuestion[]> {
    const parsed = await this.post('/v1/follow-up-questions', input, (json) =>
      parseProviderResponse(followUpQuestionsResponseSchema, json, 'follow-up-questions'),
      signal
    )
    return parsed.questions
  }

  async suggestPages(input: { brief: string; answers: Record<string, string> }, signal?: AbortSignal): Promise<PageSuggestion[]> {
    const parsed = await this.post('/v1/suggest-pages', input, (json) =>
      parseProviderResponse(suggestPagesResponseSchema, json, 'suggest-pages'),
      signal
    )
    return parsed.pages
  }

  async generatePageSpec(input: { brief: string; answers: Record<string, string>; pageName: string }, signal?: AbortSignal): Promise<GeneratedPageSpec> {
    return this.post('/v1/generate-page-spec', input, (json) =>
      parseProviderResponse(pageSpecResponseSchema, json, `page-spec:${input.pageName}`),
      signal
    )
  }

  /** Clear the key from memory. */
  destroy(): void {
    this.apiKey = ''
  }
}

export function createByokAdapter(options: ByokAdapterOptions): ByokAdapter {
  return new ByokAdapter(options)
}
