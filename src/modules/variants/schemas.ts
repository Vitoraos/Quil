// Strict Zod schemas for the variant generator (Part 5.3). Pure — no React,
// DOM, network, or AI-provider imports. Runs in Node tests.

import { z } from 'zod'
import type { VariantContext } from '../../core/generation'
import { decisionIdSchema } from '../../core/ids'
import { shortTextValue } from '../../core/values'

export const variantProposalSchema = z.object({
  componentDefId: z.string().min(1).max(64),
  props: z.record(z.unknown()),
  explanation: shortTextValue, // max 140, must say how it serves the purpose
  uses: z.array(z.string()).max(4), // brief facts (slot keys) relied on
  deviatesFrom: z.array(decisionIdSchema).max(5) // house rules it overrides
}).strict()

export const variantOutputSchema = z.object({
  candidates: z.array(variantProposalSchema).min(1).max(3)
}).strict()

export type VariantProposal = z.infer<typeof variantProposalSchema>
export type VariantOutput = z.infer<typeof variantOutputSchema>

export interface ProposeVariantsInput {
  context: VariantContext
  instruction: string | null
  signal?: AbortSignal
}

export type { VariantContext }
