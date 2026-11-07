import { z } from 'zod'
import {
  providerSpecElementSchema,
  providerSpecSectionSchema,
  specKeySchema
} from './specs'
import { shortTextValue } from './values'

/** A patch to a stored section. At least one key must be present. */
export const sectionPatchSchema = z
  .object({
    purpose: shortTextValue.optional(),
    goal: shortTextValue.optional(),
    role: z.string().optional(),
    roleLabel: shortTextValue.optional(),
    layout: z.string().optional(),
    emphasis: z.string().optional()
  })
  .strict()
  .refine((o) => Object.keys(o).length >= 1, 'patch must contain at least one key')

/** A patch to a stored element. At least one key must be present. */
export const elementPatchSchema = z
  .object({
    purpose: shortTextValue.optional(),
    kind: z.string().optional(),
    required: z.boolean().optional(),
    draftCopy: shortTextValue.nullable().optional()
  })
  .strict()
  .refine((o) => Object.keys(o).length >= 1, 'patch must contain at least one key')

/** Spec edit operations — pure, atomic spec mutations (Section 7.4). */
export const specOpSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('add_section'),
      afterKey: specKeySchema.nullable(),
      section: providerSpecSectionSchema
    })
    .strict(),
  z
    .object({
      op: z.literal('remove_section'),
      key: specKeySchema
    })
    .strict(),
  z
    .object({
      op: z.literal('move_section'),
      key: specKeySchema,
      afterKey: specKeySchema.nullable()
    })
    .strict(),
  z
    .object({
      op: z.literal('update_section'),
      key: specKeySchema,
      patch: sectionPatchSchema
    })
    .strict(),
  z
    .object({
      op: z.literal('add_element'),
      sectionKey: specKeySchema,
      afterKey: specKeySchema.nullable(),
      element: providerSpecElementSchema
    })
    .strict(),
  z
    .object({
      op: z.literal('remove_element'),
      sectionKey: specKeySchema,
      key: specKeySchema
    })
    .strict(),
  z
    .object({
      op: z.literal('move_element'),
      fromSectionKey: specKeySchema,
      key: specKeySchema,
      toSectionKey: specKeySchema,
      afterKey: specKeySchema.nullable()
    })
    .strict(),
  z
    .object({
      op: z.literal('update_element'),
      sectionKey: specKeySchema,
      key: specKeySchema,
      patch: elementPatchSchema
    })
    .strict()
])

export type SpecOp = z.infer<typeof specOpSchema>

/** Resolve a key collision against a set of taken keys: base, base-2, base-3, … */
export function uniqueKey(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  let suffix = 2
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1
    if (suffix > 1000) {
      throw new Error(`Unable to generate a unique key for '${base}' after 1000 attempts`)
    }
  }
  return `${base}-${suffix}`
}

/** Result of applying spec ops — atomic: all ops succeed or none do. */
export interface SpecOpError {
  opIndex: number
  code: string
  message: string
}

/** Apply spec edit operations to a copy of the spec, atomically.
 * Validates each op and returns the new spec or a typed error naming
 * the failing op index.
 */
export function applySpecOps(
  spec: { sections: Array<{ key: string; elements: Array<{ key: string }> }> },
  ops: SpecOp[]
): { ok: true; spec: typeof spec } | { ok: false; error: SpecOpError } {
  const next = JSON.parse(JSON.stringify(spec)) as typeof spec
  const sectionKeys = new Set(next.sections.map((s) => s.key))

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i]!
    try {
      applyOp(next, op, sectionKeys)
    } catch (err) {
      return {
        ok: false,
        error: {
          opIndex: i,
          code: err instanceof Error ? err.message : 'OP_FAILED',
          message: err instanceof Error ? err.message : String(err)
        }
      }
    }
  }

  return { ok: true, spec: next }
}

function applyOp(
  spec: { sections: Array<{ key: string; elements: Array<{ key: string }> }> },
  op: SpecOp,
  sectionKeys: Set<string>
): void {
  switch (op.op) {
    case 'add_section': {
      const key = uniqueKey(op.section.key, sectionKeys)
      sectionKeys.add(key)
      spec.sections.push({ key: op.section.key, elements: [] })
      return
    }
    case 'remove_section': {
      const idx = spec.sections.findIndex((s) => s.key === op.key)
      if (idx === -1) throw new Error(`Section '${op.key}' not found`)
      if (spec.sections.length === 1) throw new Error('Cannot remove the last section')
      spec.sections.splice(idx, 1)
      sectionKeys.delete(op.key)
      return
    }
    case 'move_section': {
      const idx = spec.sections.findIndex((s) => s.key === op.key)
      if (idx === -1) throw new Error(`Section '${op.key}' not found`)
      if (op.afterKey !== null && op.afterKey !== undefined) {
        if (op.afterKey === op.key) return // move to self is a no-op
        const targetIdx = spec.sections.findIndex((s) => s.key === op.afterKey)
        if (targetIdx === -1) throw new Error(`Target section '${op.afterKey}' not found`)
        const [removed] = spec.sections.splice(idx, 1)
        if (!removed) throw new Error(`Section '${op.key}' not found`)
        const insertIdx = targetIdx < idx ? targetIdx : targetIdx - 1
        spec.sections.splice(insertIdx, 0, removed)
      }
      return
    }
    case 'update_section': {
      const section = spec.sections.find((s) => s.key === op.key)
      if (!section) throw new Error(`Section '${op.key}' not found`)
      Object.assign(section, op.patch)
      return
    }
    case 'add_element': {
      const section = spec.sections.find((s) => s.key === op.sectionKey)
      if (!section) throw new Error(`Section '${op.sectionKey}' not found`)
      const elementKeys = new Set(section.elements.map((e) => e.key))
      const key = uniqueKey(op.element.key, elementKeys)
      section.elements.push({ key })
      return
    }
    case 'remove_element': {
      const section = spec.sections.find((s) => s.key === op.sectionKey)
      if (!section) throw new Error(`Section '${op.sectionKey}' not found`)
      const idx = section.elements.findIndex((e) => e.key === op.key)
      if (idx === -1) throw new Error(`Element '${op.key}' not found in section '${op.sectionKey}'`)
      section.elements.splice(idx, 1)
      return
    }
    case 'move_element': {
      const fromSection = spec.sections.find((s) => s.key === op.fromSectionKey)
      if (!fromSection) throw new Error(`Source section '${op.fromSectionKey}' not found`)
      const fromIdx = fromSection.elements.findIndex((e) => e.key === op.key)
      if (fromIdx === -1) throw new Error(`Element '${op.key}' not found in source section`)
      const [removed] = fromSection.elements.splice(fromIdx, 1)
      if (!removed) throw new Error(`Element '${op.key}' not found in source section`)

      const toSection = spec.sections.find((s) => s.key === op.toSectionKey)
      if (!toSection) throw new Error(`Target section '${op.toSectionKey}' not found`)
      const elementKeys = new Set(toSection.elements.map((e) => e.key))
      const key = uniqueKey(removed.key, elementKeys)
      if (op.afterKey !== null && op.afterKey !== undefined) {
        const targetIdx = toSection.elements.findIndex((e) => e.key === op.afterKey)
        if (targetIdx === -1) throw new Error(`Target element '${op.afterKey}' not found`)
        toSection.elements.splice(targetIdx, 0, { key })
      } else {
        toSection.elements.push({ key })
      }
      return
    }
    case 'update_element': {
      const section = spec.sections.find((s) => s.key === op.sectionKey)
      if (!section) throw new Error(`Section '${op.sectionKey}' not found`)
      const element = section.elements.find((e) => e.key === op.key)
      if (!element) throw new Error(`Element '${op.key}' not found in section '${op.sectionKey}'`)
      Object.assign(element, op.patch)
      return
    }
    default:
      throw new Error(`Unknown op: ${(op as { op: string }).op}`)
  }
}
