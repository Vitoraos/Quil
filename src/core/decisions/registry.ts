import type { Draft } from 'immer'
import type { DesignDecision, DecisionScope, DesignElement, ProjectState } from '../state'
import type { NodeKind } from '../elements'
import { decisionIdSchema, type DecisionId, type ElementId, type PageId } from '../ids'

export function scopesMatch(a: DecisionScope, b: DecisionScope): boolean {
  if (a.kind === 'instance' && b.kind === 'instance') return a.elementId === b.elementId
  if (a.kind === 'page' && b.kind === 'page') return a.pageId === b.pageId && a.targetType === b.targetType
  if (a.kind === 'global' && b.kind === 'global') return a.targetType === b.targetType
  return false
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a == null || b == null || typeof a !== 'object') return false
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => deepEqual(v, b[i]))
  }
  const ka = Object.keys(a as Record<string, unknown>)
  const kb = Object.keys(b as Record<string, unknown>)
  if (ka.length !== kb.length) return false
  return ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/**
 * Create or update a decision for (scope, property).
 * - Idempotent: same scope+property+value already approved -> returns existing id, no new record.
 * - Otherwise supersedes any approved matches and creates one new approved decision.
 * Returns the active DecisionId, or null when it was a no-op replay.
 */
export function upsertDecision(
  draft: Draft<ProjectState>,
  scope: DecisionScope,
  property: string,
  value: unknown,
  _elementKind: NodeKind
): DecisionId | null {
  let existing: DesignDecision | undefined
  for (const dec of draft.decisions.values()) {
    if (dec.property === property && scopesMatch(dec.scope, scope) && dec.status === 'approved') {
      existing = dec
      break
    }
  }

  if (existing && deepEqual(existing.value, value)) {
    return existing.id
  }

  for (const dec of draft.decisions.values()) {
    if (dec.property === property && scopesMatch(dec.scope, scope) && dec.status === 'approved') {
      dec.status = 'superseded'
    }
  }

  const seq = draft.nextDecisionSeq++
  const id = decisionIdSchema.parse(`dec-${seq}`)
  const newDecision: DesignDecision = {
    id,
    property,
    value,
    scope,
    status: 'approved',
    seq
  }
  draft.decisions.set(id, newDecision)
  return id
}

export function getDecision(state: ProjectState, id: DecisionId): DesignDecision | undefined {
  return state.decisions.get(id)
}

export function lookupByScope(state: ProjectState, scope: DecisionScope): DesignDecision[] {
  const out: DesignDecision[] = []
  for (const dec of state.decisions.values()) {
    if (scopesMatch(dec.scope, scope)) out.push(dec)
  }
  return out
}

export function appliesTo(dec: DesignDecision, node: DesignElement): boolean {
  if (dec.status !== 'approved') return false
  if (dec.scope.kind === 'instance') return dec.scope.elementId === node.id
  if (dec.scope.kind === 'page') return dec.scope.pageId === node.pageId && dec.scope.targetType === node.kind
  return dec.scope.targetType === node.kind
}

export function decisionZeroMatchReport(state: ProjectState): { total: number; zeroMatch: number; zeroMatchIds: DecisionId[] } {
  const zeroMatchIds: DecisionId[] = []
  let total = 0
  for (const dec of state.decisions.values()) {
    if (dec.status !== 'approved') continue
    total++
    let matches = 0
    for (const node of state.nodes.values()) {
      if (appliesTo(dec, node)) matches++
    }
    if (matches === 0) zeroMatchIds.push(dec.id)
  }
  return { total, zeroMatch: zeroMatchIds.length, zeroMatchIds }
}
