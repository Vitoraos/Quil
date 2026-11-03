// Strict Zod schemas for every provider response. Separate operations, separate
// schemas — no mega-prompt. All objects are strict (extra keys rejected).
//
// These schemas are used to validate untrusted provider output before any state
// is touched.

import { z } from 'zod'
import { elementKinds } from '../../core/elements'
import { specKeySchema } from '../../core/specs'
import { shortTextValue } from '../../core/values'

export const MAX_QUESTIONS = 6
export const MAX_PAGES = 12
export const MAX_PARAGRAPH = 280

export const followUpQuestionSchema = z.object({
  id: specKeySchema,
  question: shortTextValue,
  options: z.array(shortTextValue).max(8).optional(),
  skippable: z.boolean()
}).strict()

export const followUpQuestionsResponseSchema = z.object({
  questions: z.array(followUpQuestionSchema).min(1).max(MAX_QUESTIONS)
}).strict()

export const pageSuggestionSchema = z.object({
  name: shortTextValue,
  purpose: shortTextValue
}).strict()

export const suggestPagesResponseSchema = z.object({
  pages: z.array(pageSuggestionSchema).min(1).max(MAX_PAGES)
}).strict()

export const specElementSchema = z.object({
  key: specKeySchema,
  kind: z.enum([...elementKinds]),
  purpose: shortTextValue,
  required: z.boolean()
}).strict()

export const specSectionSchema = z.object({
  key: specKeySchema,
  purpose: shortTextValue,
  elements: z.array(specElementSchema).min(1).max(20)
}).strict()

export const pageSpecResponseSchema = z.object({
  name: shortTextValue,
  purpose: shortTextValue,
  sections: z.array(specSectionSchema).min(1).max(20)
}).strict()

export type FollowUpQuestion = z.infer<typeof followUpQuestionSchema>
export type PageSuggestion = z.infer<typeof pageSuggestionSchema>
export type GeneratedPageSpec = z.infer<typeof pageSpecResponseSchema>

/** Parse provider output strictly, rejecting anything that doesn't match. */
export function parseProviderResponse<T>(schema: z.ZodSchema<T>, raw: unknown, target: string): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
    throw new Error(`Invalid provider response for ${target}: ${issues}`)
  }
  return result.data
}
