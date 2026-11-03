import { z } from 'zod'
import { elementKinds } from './elements'
import { elementIdSchema, pageIdSchema } from './ids'
import { bounds } from './state'
import { shortTextValue } from './values'

export const specKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,31}$/, 'spec key must be lowercase letters, digits and dashes')

export const specElementBaseSchema = z.object({
  key: specKeySchema,
  kind: z.enum([...elementKinds]),
  purpose: shortTextValue,
  required: z.boolean()
})

/** What a provider is allowed to return for a page spec element — never carries
 * an elementId (that is assigned by the application at instantiation time). */
export const providerSpecElementSchema = specElementBaseSchema.strict()

/** The stored spec element: provider fields plus the spec→tree trace (elementId). */
export const storedSpecElementSchema = specElementBaseSchema.extend({
  elementId: elementIdSchema.optional()
}).strict()

export const providerSpecSectionSchema = z.object({
  key: specKeySchema,
  purpose: shortTextValue,
  elements: z.array(providerSpecElementSchema).min(1).max(bounds.maxSpecElementsPerSection)
}).strict()

export const storedSpecSectionSchema = z.object({
  key: specKeySchema,
  purpose: shortTextValue,
  elements: z.array(storedSpecElementSchema).min(1).max(bounds.maxSpecElementsPerSection)
}).strict()

export const providerPageSpecSchema = z.object({
  name: shortTextValue,
  purpose: shortTextValue,
  sections: z.array(providerSpecSectionSchema).min(1).max(bounds.maxSpecSections)
}).strict()

export const pageSpecSchema = z.object({
  pageId: pageIdSchema,
  name: shortTextValue,
  purpose: shortTextValue,
  version: z.number().int().positive(),
  sections: z.array(storedSpecSectionSchema).min(1).max(bounds.maxSpecSections)
}).strict()

export type SpecElement = z.infer<typeof storedSpecElementSchema>
export type SpecSection = z.infer<typeof storedSpecSectionSchema>
export type PageSpec = z.infer<typeof pageSpecSchema>
export type ProviderPageSpec = z.infer<typeof providerPageSpecSchema>

export type GeneratedPageSpec = z.infer<typeof providerPageSpecSchema>

/** Validate structural constraints of a page spec beyond the Zod schema. */
export function validatePageSpec(spec: PageSpec): string[] {
  const errors: string[] = []
  const sectionKeys = new Set<string>()
  for (const section of spec.sections) {
    if (sectionKeys.has(section.key)) {
      errors.push(`duplicate section key '${section.key}'`)
    }
    sectionKeys.add(section.key)
    const elementKeys = new Set<string>()
    for (const el of section.elements) {
      if (elementKeys.has(el.key)) {
        errors.push(`duplicate element key '${el.key}' in section '${section.key}'`)
      }
      elementKeys.add(el.key)
    }
  }
  return errors
}

export function countSpecElements(spec: PageSpec): number {
  return spec.sections.reduce((total, section) => total + section.elements.length, 0)
}
