// Module E (Phase 6): Targeted generation — "valid by design" component
// definitions.
//
// The AI does not render components. It outputs a component instance that
// conforms to a strict ComponentDef schema. Quil validates that the candidate
// conforms to its definition (allowlisted props, value constraints, hard
// constraints like contrast). The user/rendering layer takes the validated
// candidate and renders it.
//
// Pure — no React, DOM, network, or AI-provider imports. Runs in Node tests.

import { z } from 'zod'
import { candidateIdSchema, elementIdSchema } from './ids'
import {
  colorValue,
  fontSizeValue,
  fontWeightValue,
  radiusValue,
  shortTextValue,
  spacingValue
} from './values'
import type { ElementKind, NodeKind } from './elements'
import type { PageSpec } from './specs'
import type { DesignElement, ProjectState } from './state'
import { resolveElement } from './decisions'
import { applicableDecisions as applicableDecisionsFromResolver } from './decisions'

// culori is a pure color library (no React/DOM/network/AI), safe for core/.
import { wcagContrast as contrast } from 'culori'

export function contrastRatioCore(foreground: string, background: string): number {
  try {
    const c = contrast(foreground, background)
    return typeof c === 'number' ? c : 1
  } catch {
    return 1
  }
}

export function contrastPassesCore(foreground: string, background: string, level: 'AA' | 'AAA' = 'AA'): boolean {
  const ratio = contrastRatioCore(foreground, background)
  return ratio >= (level === 'AAA' ? 7 : 4.5)
}

// ── Component definition schema ─────────────────────────────────────────────
//
// A ComponentDef is the "shape" that makes a component valid by design.
// Every candidate must conform to exactly one definition.

export interface ComponentPropDef {
  property: string
  required: boolean
  type: 'color' | 'fontSize' | 'fontWeight' | 'radius' | 'spacing' | 'text' | 'number'
  min?: number
  max?: number
}

export interface ComponentDef {
  id: string                 // e.g. 'hero', 'button', 'card'
  kind: NodeKind             // underlying element kind
  props: ComponentPropDef[]  // which props can be set + which are required
  constraints: ComponentConstraint[]  // hard constraints evaluated in code
}

export interface ComponentConstraint {
  name: string
  check: 'contrast:text-background' | 'finite-number' | 'positive-number'
  // which two props are involved (for contrast)
  foregroundProp?: string
  backgroundProp?: string
  // which prop (for finite/positive)
  prop?: string
}

export const targetDefs: Record<string, ComponentDef> = {
  hero: {
    id: 'hero',
    kind: 'section',
    props: [
      { property: 'bgColor', required: true, type: 'color' },
      { property: 'textColor', required: true, type: 'color' },
      { property: 'padding', required: false, type: 'spacing' }
    ],
    constraints: [
      {
        name: 'contrast:text-background',
        check: 'contrast:text-background',
        foregroundProp: 'textColor',
        backgroundProp: 'bgColor'
      }
    ]
  },
  button: {
    id: 'button',
    kind: 'button',
    props: [
      { property: 'bgColor', required: true, type: 'color' },
      { property: 'textColor', required: true, type: 'color' },
      { property: 'radius', required: false, type: 'radius', min: 0, max: 999 },
      { property: 'fontWeight', required: false, type: 'fontWeight' }
    ],
    constraints: [
      {
        name: 'contrast:text-background',
        check: 'contrast:text-background',
        foregroundProp: 'textColor',
        backgroundProp: 'bgColor'
      },
      {
        name: 'radius:finite',
        check: 'finite-number',
        prop: 'radius'
      },
      {
        name: 'fontWeight:finite',
        check: 'finite-number',
        prop: 'fontWeight'
      }
    ]
  }
} as const

export type TargetType = keyof typeof targetDefs

export function getTargetDef(targetType: TargetType): ComponentDef {
  const def = targetDefs[targetType]
  if (!def) {
    throw new Error(`Unknown target type '${targetType}'`)
  }
  return def
}

export function isAllowedProp(targetType: TargetType, property: string): boolean {
  return getTargetDef(targetType).props.some((p) => p.property === property)
}

// ── Per-property value validators ───────────────────────────────────────────

const PROPERTY_VALIDATORS: Record<string, z.ZodTypeAny> = {
  color: colorValue,
  fontSize: fontSizeValue,
  fontWeight: fontWeightValue,
  radius: radiusValue,
  spacing: spacingValue,
  text: shortTextValue,
  number: z.number().finite()
} as const

export function validatePropertyValue(propertyType: string, value: unknown): { ok: true; data: unknown } | { ok: false; message: string } {
  const schema = PROPERTY_VALIDATORS[propertyType]
  if (!schema) {
    return { ok: false, message: `No validator for property type '${propertyType}'` }
  }
  const result = schema.safeParse(value)
  if (!result.success) {
    return { ok: false, message: result.error.issues[0]?.message ?? `Invalid value` }
  }
  return { ok: true, data: result.data }
}

// ── Candidate schema ────────────────────────────────────────────────────────
//
// A candidate is a component instance that must conform to a ComponentDef.
// The AI outputs this; Quil validates it; the user renders it.

export const candidateSchema = z.object({
  candidateId: candidateIdSchema,
  componentDefId: z.string(),
  targetId: elementIdSchema,
  props: z.record(z.unknown()),
  explanation: shortTextValue.optional()
})

export type Candidate = z.infer<typeof candidateSchema>

// ── Generation context ──────────────────────────────────────────────────────

export interface NeighborElement {
  id: string
  kind: string
  props: Record<string, unknown>
}

export interface GenerationContext {
  brief: string
  pageSpec: PageSpec | null
  target: {
    id: string
    kind: string
    props: Record<string, unknown>
    pageId: string
  }
  neighbors: NeighborElement[]
  applicableDecisions: Array<{ id: string; property: string; value: unknown; scope: unknown }>
  targetRev: number
  decisionRegistryVersion: number
}

export function buildGenerationContext(
  state: ProjectState,
  targetId: string,
  targetType: TargetType
): { ok: true; context: GenerationContext } | { ok: false; error: { code: string; message: string } } {
  const element = state.nodes.get(targetId as never)
  if (!element) {
    return { ok: false, error: { code: 'TARGET_MISSING', message: `Target element ${targetId} not found` } }
  }

  const page = state.pages.get(element.pageId)
  const siblings = page ? page.sectionIds.flatMap((sid) => {
    const section = state.nodes.get(sid as never)
    if (!section || section.kind !== 'section') return []
    return section.childIds.filter((cid) => cid !== targetId).map((cid) => {
      const child = state.nodes.get(cid as never)
      return child ? { id: cid, kind: child.kind, props: child.props } : null
    }).filter(Boolean) as NeighborElement[]
  }) : []

  const resolved = resolveElement(state, targetId as never)
  const applicable = resolved.ok ? resolved.result.provenance : new Map<string, string>()

  const applicableDecisionsList = Array.from(applicable.entries()).map(([property, decId]) => {
    const dec = state.decisions.get(decId as never)
    return dec ? { id: decId, property, value: dec.value, scope: dec.scope } : { id: decId, property, value: undefined, scope: undefined }
  })

  const pageSpec = state.pageSpecs.get(element.pageId as never) ?? null

  const context: GenerationContext = {
    brief: state.brief,
    pageSpec,
    target: {
      id: element.id,
      kind: element.kind,
      props: { ...element.props },
      pageId: element.pageId
    },
    neighbors: siblings,
    applicableDecisions: applicableDecisionsList,
    targetRev: element.rev,
    decisionRegistryVersion: state.decisions.size
  }

  return { ok: true, context }
}

// ── Candidate validation ────────────────────────────────────────────────────
//
// Validates that a candidate conforms to its ComponentDef definition.
// All checks are automated in code — nothing is trusted from the model.

export interface ValidationConstraint {
  name: string
  automated: true
  pass: boolean
  message?: string
}

export type CandidateValidationResult =
  | { ok: true; candidate: Candidate; constraints: ValidationConstraint[] }
  | { ok: false; candidate: Candidate; constraints: ValidationConstraint[]; errors: string[] }

function patchesAreNearIdentical(a: Array<{ property: string; value: unknown }>, b: Array<{ property: string; value: unknown }>): boolean {
  if (a.length !== b.length) return false
  const aSorted = [...a].sort((x, y) => x.property.localeCompare(y.property))
  const bSorted = [...b].sort((x, y) => x.property.localeCompare(y.property))
  return aSorted.every((p, i) => p.property === bSorted[i]!.property && JSON.stringify(p.value) === JSON.stringify(bSorted[i]!.value))
}

export function validateCandidate(
  context: GenerationContext,
  candidate: Candidate,
  existingCandidates: Candidate[] = []
): CandidateValidationResult {
  const errors: string[] = []
  const constraints: ValidationConstraint[] = []

  const def = targetDefs[candidate.componentDefId as TargetType]
  if (!def) {
    errors.push(`Unknown component definition '${candidate.componentDefId}'`)
    return { ok: false, candidate, constraints, errors }
  }

  // 1. Each patch property must be in the allowlist for this definition
  const definedProps = new Set(def.props.map((p) => p.property))
  for (const [property] of Object.entries(candidate.props)) {
    if (!definedProps.has(property)) {
      errors.push(`Property '${property}' is not allowed for '${def.id}' definition. Allowed: ${[...definedProps].join(', ')}`)
      constraints.push({
        name: `allowlist:${property}`,
        automated: true,
        pass: false,
        message: `Property '${property}' not allowed for '${def.id}'`
      })
    } else {
      constraints.push({
        name: `allowlist:${property}`,
        automated: true,
        pass: true
      })
    }
  }

  // 2. Required props must be present
  for (const p of def.props) {
    if (p.required && !(p.property in candidate.props)) {
      errors.push(`Required property '${p.property}' is missing for '${def.id}'`)
      constraints.push({
        name: `required:${p.property}`,
        automated: true,
        pass: false,
        message: `Required property '${p.property}' is missing`
      })
    } else if (p.required && p.property in candidate.props) {
      constraints.push({
        name: `required:${p.property}`,
        automated: true,
        pass: true
      })
    }
  }

  // 3. Per-property value validation
  for (const [property, value] of Object.entries(candidate.props)) {
    const propDef = def.props.find((p) => p.property === property)
    if (!propDef) continue
    const valueResult = validatePropertyValue(propDef.type, value)
    if (!valueResult.ok) {
      errors.push(`Invalid value for '${property}': ${valueResult.message}`)
      constraints.push({
        name: `value:${property}`,
        automated: true,
        pass: false,
        message: valueResult.message
      })
    } else {
      constraints.push({
        name: `value:${property}`,
        automated: true,
        pass: true
      })
    }
  }

  // 4. Hard constraints
  for (const constraint of def.constraints) {
    let passes = true
    let message = ''

    if (constraint.check === 'contrast:text-background') {
      const fgProp = constraint.foregroundProp!
      const bgProp = constraint.backgroundProp!
      const fg = candidate.props[fgProp] as string | undefined
      const bg = candidate.props[bgProp] as string | undefined
      if (fg && bg) {
        const ratio = contrastRatioCore(fg, bg)
        passes = ratio >= 4.5
        message = passes
          ? `Contrast ${ratio.toFixed(2)}:1 passes WCAG AA`
          : `Contrast ${ratio.toFixed(2)}:1 fails WCAG AA (need 4.5:1)`
        if (!passes) {
          errors.push(`Contrast ratio ${ratio.toFixed(2)}:1 between ${fgProp} (${fg}) and ${bgProp} (${bg}) is below WCAG AA (4.5:1)`)
        }
      }
    } else if (constraint.check === 'finite-number') {
      const prop = constraint.prop!
      const v = candidate.props[prop]
      // Optional props are only constrained when present.
      if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v))) {
        passes = false
        message = `Must be a finite number`
        errors.push(`Property '${prop}' must be a finite number, got ${typeof v}`)
      }
    } else if (constraint.check === 'positive-number') {
      const prop = constraint.prop!
      const v = candidate.props[prop]
      if (v !== undefined && (typeof v !== 'number' || !Number.isFinite(v) || v <= 0)) {
        passes = false
        message = `Must be a positive finite number`
        errors.push(`Property '${prop}' must be a positive finite number, got ${typeof v} ${String(v)}`)
      }
    }

    constraints.push({
      name: constraint.name,
      automated: true,
      pass: passes,
      message
    })
  }

  // 4d. Dedupe near-identical candidates
  const isDuplicate = existingCandidates.some((c) =>
    c.componentDefId === candidate.componentDefId &&
    c.targetId === candidate.targetId &&
    patchesAreNearIdentical(
      Object.entries(c.props).map(([k, v]) => ({ property: k, value: v })),
      Object.entries(candidate.props).map(([k, v]) => ({ property: k, value: v }))
    )
  )
  constraints.push({
    name: 'dedupe:near-identical',
    automated: true,
    pass: !isDuplicate,
    message: isDuplicate ? 'Candidate is near-identical to an existing candidate' : 'Candidate is distinct'
  })
  if (isDuplicate) {
    errors.push('Candidate is near-identical to an existing candidate')
  }

  if (errors.length > 0) {
    return { ok: false, candidate, constraints, errors }
  }
  return { ok: true, candidate, constraints }
}

// ── Dedupe helper ─────────────────────────────────────────────────────────

export function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>()
  const result: Candidate[] = []
  for (const c of candidates) {
    const key = `${c.componentDefId}:${c.targetId}:${JSON.stringify([...Object.entries(c.props)].sort(([a], [b]) => a.localeCompare(b)))}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(c)
    }
  }
  return result
}
