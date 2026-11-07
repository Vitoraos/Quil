// Part 5.3: Variant provider interface.
//
// proposeVariants(context, instruction, signal) returns up to 3 candidate
// proposals. The application assigns candidateId/targetId and validates every
// proposal before it reaches the screen — fail closed, no mock fallback.

import type { ProposeVariantsInput, VariantOutput } from './schemas'

export interface VariantProvider {
  proposeVariants(input: ProposeVariantsInput): Promise<VariantOutput>
}

export class VariantProviderError extends Error {
  readonly code: string
  readonly rule: string
  readonly target: string
  readonly recoverable: boolean
  constructor(code: string, message: string, rule: string, target: string, recoverable = true) {
    super(message)
    this.name = 'VariantProviderError'
    this.code = code
    this.rule = rule
    this.target = target
    this.recoverable = recoverable
  }
}
