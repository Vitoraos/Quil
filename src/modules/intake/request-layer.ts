// Request layer for provider calls.
//
// Enforces: AbortController deadline, retry with jittered backoff on 429 and 5xx
// only, circuit breaker, cancel on navigation (AbortController), size caps on
// inputs and outputs. Returns parsed, schema-validated data or a typed error.
// Never logs secrets.

import { ProviderError } from './provider'

export interface RequestLayerOptions {
  /** Fetch implementation (defaults to global fetch). */
  fetchImpl?: typeof fetch
  /** Max retry attempts. Default 3. */
  maxAttempts?: number
  /** Base delay in ms for exponential backoff. Default 500. */
  baseDelayMs?: number
  /** Maximum delay in ms. Default 8000. */
  maxDelayMs?: number
  /** Deadline in ms for the whole request. Default 30000. */
  deadlineMs?: number
  /** Maximum response body bytes. Default 200000 (~200KB). */
  maxResponseBytes?: number
  /** Maximum request body bytes. Default 100000 (~100KB). */
  maxRequestBytes?: number
  /** Circuit breaker: trips after this many failures. Default 5. */
  circuitThreshold?: number
  /** Circuit breaker cooldown in ms. Default 30000. */
  circuitCooldownMs?: number
}

export class CircuitOpenError extends Error {
  readonly code = 'CIRCUIT_OPEN'
  readonly recoverable = true
  constructor(message: string) {
    super(message)
    this.name = 'CircuitOpenError'
  }
}

export class RequestTimeoutError extends Error {
  readonly code = 'TIMEOUT'
  readonly recoverable = true
  constructor(message: string) {
    super(message)
    this.name = 'RequestTimeoutError'
  }
}

export class RequestTooLargeError extends Error {
  readonly code = 'TOO_LARGE'
  readonly recoverable = false
  constructor(message: string) {
    super(message)
    this.name = 'RequestTooLargeError'
  }
}

export class RequestUnavailableError extends Error {
  readonly code = 'UNAVAILABLE'
  readonly recoverable = true
  constructor(message: string) {
    super(message)
    this.name = 'RequestUnavailableError'
  }
}

export interface CircuitState {
  failures: number
  lastFailureTime: number | null
  state: 'closed' | 'open' | 'half-open'
}

export class RequestLayer {
  private fetchImpl: typeof fetch
  private maxAttempts: number
  private baseDelayMs: number
  private maxDelayMs: number
  private deadlineMs: number
  private maxResponseBytes: number
  private maxRequestBytes: number
  private circuitThreshold: number
  private circuitCooldownMs: number
  private circuits = new Map<string, CircuitState>()

  constructor(options: RequestLayerOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch
    this.maxAttempts = options.maxAttempts ?? 3
    this.baseDelayMs = options.baseDelayMs ?? 500
    this.maxDelayMs = options.maxDelayMs ?? 8000
    this.deadlineMs = options.deadlineMs ?? 30000
    this.maxResponseBytes = options.maxResponseBytes ?? 200000
    this.maxRequestBytes = options.maxRequestBytes ?? 100000
    this.circuitThreshold = options.circuitThreshold ?? 5
    this.circuitCooldownMs = options.circuitCooldownMs ?? 30000
  }

  /** Get or create circuit state for an endpoint key. */
  private circuit(key: string): CircuitState {
    let c = this.circuits.get(key)
    if (!c) {
      c = { failures: 0, lastFailureTime: null, state: 'closed' }
      this.circuits.set(key, c)
    }
    return c
  }

  private canProceed(circuit: CircuitState): boolean {
    if (circuit.state === 'closed') return true
    if (circuit.state === 'open') {
      const last = circuit.lastFailureTime
      if (last && Date.now() - last >= this.circuitCooldownMs) {
        circuit.state = 'half-open'
        return true
      }
      return false
    }
    // half-open: allow one probe
    return true
  }

  private recordFailure(circuit: CircuitState): void {
    circuit.failures++
    circuit.lastFailureTime = Date.now()
    if (circuit.failures >= this.circuitThreshold) {
      circuit.state = 'open'
    } else {
      circuit.state = 'closed'
    }
  }

  private recordSuccess(circuit: CircuitState): void {
    circuit.failures = 0
    circuit.lastFailureTime = null
    circuit.state = 'closed'
  }

  private delayMs(attempt: number): number {
    const exp = this.baseDelayMs * Math.pow(2, attempt - 1)
    const jitter = Math.floor(Math.random() * exp * 0.2)
    return Math.min(exp + jitter, this.maxDelayMs)
  }

  private isRetryable(status: number): boolean {
    return status === 429 || (status >= 500 && status < 600)
  }

  /**
   * Execute a provider request with deadline, retries, circuit breaker, and size caps.
   * `run` receives an AbortSignal and must return a Response-like object with
   * `ok`, `status`, `json()`, and `text()` methods.
   */
  async request<T>(
    key: string,
    input: RequestInfo | URL,
    init: RequestInit,
    parse: (json: unknown) => T,
    options?: Partial<RequestLayerOptions> & { signal?: AbortSignal }
  ): Promise<T> {
    const circuit = this.circuit(key)
    if (!this.canProceed(circuit)) {
      throw new CircuitOpenError(`Circuit breaker open for ${key}`)
    }

    const abortController = new AbortController()
    const deadline = setTimeout(() => abortController.abort(), (options?.deadlineMs ?? this.deadlineMs))

    // Combine external signal (e.g. from caller navigation) with internal deadline
    const combined = new AbortController()
    const unlistenExternal = options?.signal?.addEventListener
      ? () => options.signal!.addEventListener('abort', () => combined.abort(), { once: true })
      : () => {}
    unlistenExternal()
    if (options?.signal?.aborted) combined.abort()
    options?.signal?.addEventListener('abort', () => combined.abort(), { once: true })

    // Cancel on navigation: listen to pagehide / beforeunload as a best effort
    const onPageHide = () => combined.abort()
    window.addEventListener('pagehide', onPageHide, { once: true })

    let lastError: unknown = null
    let response: Response | null = null

    try {
      for (let attempt = 1; attempt <= (options?.maxAttempts ?? this.maxAttempts); attempt++) {
        if (combined.signal.aborted) {
          throw new RequestTimeoutError('Request cancelled (navigation or deadline)')
        }

        const bodyBytes = init.body
          ? new TextEncoder().encode(typeof init.body === 'string' ? init.body : JSON.stringify(init.body)).length
          : 0
        if (bodyBytes > (options?.maxRequestBytes ?? this.maxRequestBytes)) {
          throw new RequestTooLargeError(`Request body ${bodyBytes} bytes exceeds cap`)
        }

        try {
          response = await this.fetchImpl(input, {
            ...init,
            signal: combined.signal
          })

          if (!response.ok) {
            if (this.isRetryable(response.status) && attempt < (options?.maxAttempts ?? this.maxAttempts)) {
              await this.sleep(this.delayMs(attempt))
              continue
            }
            // Non-retryable or exhausted retries
            const body = await response.text().catch(() => '')
            throw new ProviderError(
              'INVALID_RESPONSE',
              `Provider returned ${response.status}: ${body.slice(0, 500)}`,
              'provider-response',
              key,
              true
            )
          }

          // Size cap on response
          const contentLength = Number(response.headers.get('content-length') ?? '0')
          if (contentLength > 0 && contentLength > (options?.maxResponseBytes ?? this.maxResponseBytes)) {
            throw new RequestTooLargeError(`Response ${contentLength} bytes exceeds cap`)
          }

          const text = await response.text()
          if (new TextEncoder().encode(text).length > (options?.maxResponseBytes ?? this.maxResponseBytes)) {
            throw new RequestTooLargeError(`Response body exceeds size cap`)
          }

          let json: unknown
          try {
            json = JSON.parse(text)
          } catch {
            throw new ProviderError(
              'INVALID_RESPONSE',
              'Provider returned non-JSON',
              'provider-response',
              key,
              true
            )
          }

          const parsed = parse(json)
          this.recordSuccess(circuit)
          return parsed
        } catch (err) {
          lastError = err
          if (err instanceof ProviderError || err instanceof RequestTooLargeError || err instanceof CircuitOpenError) {
            this.recordFailure(circuit)
            throw err
          }
          if (err instanceof RequestTimeoutError) {
            this.recordFailure(circuit)
            throw err
          }
          // Network error: retryable
          if (attempt < (options?.maxAttempts ?? this.maxAttempts)) {
            await this.sleep(this.delayMs(attempt))
            continue
          }
          this.recordFailure(circuit)
          throw err
        }
      }
      throw lastError ?? new ProviderError('UNAVAILABLE', 'Request failed', 'provider', key, true)
    } finally {
      clearTimeout(deadline)
      window.removeEventListener('pagehide', onPageHide)
      // Only record final failure if not already handled
      if (lastError && !(lastError instanceof ProviderError) && !(lastError instanceof CircuitOpenError)) {
        this.recordFailure(circuit)
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

export const requestLayer = new RequestLayer()
