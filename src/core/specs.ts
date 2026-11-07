import { z } from 'zod'
import { elementKinds, layoutArchetypes } from './elements'
import { elementIdSchema, pageIdSchema } from './ids'
import { bounds } from './state'
import { shortTextValue } from './values'

export const specKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9-]{0,31}$/, 'spec key must be lowercase letters, digits and dashes')

export const sectionRoles = [
  'header', 'hero', 'features', 'benefits', 'how-it-works', 'social-proof',
  'pricing', 'faq', 'cta', 'gallery', 'team', 'contact', 'content', 'footer', 'custom'
] as const
export type SectionRole = (typeof sectionRoles)[number]

export const emphasisLevels = ['primary', 'secondary', 'quiet'] as const
export type Emphasis = (typeof emphasisLevels)[number]

export const specElementBaseSchema = z.object({
  key: specKeySchema,
  kind: z.enum([...elementKinds]),
  purpose: shortTextValue,
  required: z.boolean(),
  draftCopy: shortTextValue.nullable().optional()
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
  role: z.enum([...sectionRoles]),
  purpose: shortTextValue,
  goal: shortTextValue,
  layout: z.enum([...layoutArchetypes]).optional(),
  emphasis: z.enum([...emphasisLevels]).optional(),
  roleLabel: shortTextValue.optional(),
  elements: z.array(providerSpecElementSchema).min(1).max(bounds.maxSpecElementsPerSection)
}).strict()

export const storedSpecSectionSchema = z.object({
  key: specKeySchema,
  role: z.enum([...sectionRoles]),
  purpose: shortTextValue,
  goal: shortTextValue,
  layout: z.enum([...layoutArchetypes]).optional(),
  emphasis: z.enum([...emphasisLevels]).optional(),
  roleLabel: shortTextValue.optional(),
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
  status: z.enum(['draft', 'approved']).default('draft'),
  basedOnIntakeRev: z.number().int().nonnegative().default(0),
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
  let headerCount = 0
  let heroCount = 0
  let footerCount = 0

  for (let i = 0; i < spec.sections.length; i++) {
    const section = spec.sections[i]!
    if (sectionKeys.has(section.key)) {
      errors.push(`duplicate section key '${section.key}'`)
    }
    sectionKeys.add(section.key)

    // roleLabel rule: REQUIRED when role === 'custom', forbidden otherwise
    if (section.role === 'custom' && !section.roleLabel) {
      errors.push(`Section '${section.key}' has role 'custom' but no roleLabel`)
    }
    if (section.role !== 'custom' && section.roleLabel !== undefined) {
      errors.push(`Section '${section.key}' has roleLabel but role is not 'custom'`)
    }

    // Count singletons
    if (section.role === 'header') headerCount++
    if (section.role === 'hero') heroCount++
    if (section.role === 'footer') footerCount++

    // Header must be first, footer must be last
    if (section.role === 'header' && i !== 0) {
      errors.push(`Section '${section.key}' has role 'header' but is not the first section`)
    }
    if (section.role === 'footer' && i !== spec.sections.length - 1) {
      errors.push(`Section '${section.key}' has role 'footer' but is not the last section`)
    }

    const elementKeys = new Set<string>()
    for (const el of section.elements) {
      if (elementKeys.has(el.key)) {
        errors.push(`duplicate element key '${el.key}' in section '${section.key}'`)
      }
      elementKeys.add(el.key)
    }
  }

  if (headerCount > 1) {
    errors.push(`at most one 'header' section allowed, found ${headerCount}`)
  }
  if (heroCount > 1) {
    errors.push(`at most one 'hero' section allowed, found ${heroCount}`)
  }
  if (footerCount > 1) {
    errors.push(`at most one 'footer' section allowed, found ${footerCount}`)
  }

  return errors
}

/** QualityIssue — a soft warning shown to the user (not a hard error). */
export interface QualityIssue {
  rule: string
  target: string
  message: string
}

/** Assess spec quality — pure soft warnings (plus one automatic revision request).
 * sectionRoles, layoutArchetypes and emphasisLevels are imported from elements.ts.
 */
export function assessSpecQuality(spec: PageSpec): QualityIssue[] {
  const issues: QualityIssue[] = []

  // The same layout on 3 or more consecutive sections.
  for (let i = 0; i + 2 < spec.sections.length; i++) {
    const a = spec.sections[i]!.layout
    const b = spec.sections[i + 1]!.layout
    const c = spec.sections[i + 2]!.layout
    if (a && a === b && b === c) {
      issues.push({
        rule: 'repetitive-layout',
        target: spec.sections[i + 1]!.key,
        message: `Sections '${spec.sections[i]!.key}', '${spec.sections[i + 1]!.key}' and '${spec.sections[i + 2]!.key}' all use layout '${a}'`
      })
    }
  }

  // A section with no required element.
  for (const section of spec.sections) {
    const hasRequired = section.elements.some((el) => el.required)
    if (!hasRequired) {
      issues.push({
        rule: 'section-no-required-element',
        target: section.key,
        message: `Section '${section.key}' has no required element`
      })
    }
  }

  // Two adjacent sections with identical role.
  for (let i = 0; i + 1 < spec.sections.length; i++) {
    const a = spec.sections[i]!.role
    const b = spec.sections[i + 1]!.role
    if (a === b) {
      issues.push({
        rule: 'adjacent-duplicate-role',
        target: spec.sections[i + 1]!.key,
        message: `Adjacent sections '${spec.sections[i]!.key}' and '${spec.sections[i + 1]!.key}' both have role '${a}'`
      })
    }
  }

  return issues
}

export function countSpecElements(spec: PageSpec): number {
  return spec.sections.reduce((total, section) => total + section.elements.length, 0)
}
