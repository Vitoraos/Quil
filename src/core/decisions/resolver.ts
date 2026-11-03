import type { DesignDecision, DesignElement, ProjectState } from '../state'
import type { ElementId, DecisionId, PageId } from '../ids'
import type { NodeKind } from '../elements'

export interface ResolvedProps {
  props: Record<string, unknown>
  provenance: Map<string, DecisionId>
}

export interface ResolveCacheEntry {
  rev: number
  fingerprint: string
  result: ResolvedProps
}

export interface ResolverMemo {
  elementCache: Map<ElementId, ResolveCacheEntry>
}

export function createResolverMemo(): ResolverMemo {
  return { elementCache: new Map() }
}

const SCOPE_RANK: { instance: number; page: number; global: number } = { instance: 3, page: 2, global: 1 }

export function applicableDecisions(state: ProjectState, element: DesignElement): DesignDecision[] {
  const out: DesignDecision[] = []
  for (const dec of state.decisions.values()) {
    if (dec.status !== 'approved') continue
    if (dec.scope.kind === 'instance') {
      if (dec.scope.elementId === element.id) out.push(dec)
    } else if (dec.scope.kind === 'page') {
      if (dec.scope.pageId === element.pageId && dec.scope.targetType === element.kind) out.push(dec)
    } else {
      if (dec.scope.targetType === element.kind) out.push(dec)
    }
  }
  return out
}

function fingerprintOf(decisions: DesignDecision[]): string {
  const sorted = [...decisions].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  return sorted.map((d) => `${d.id}:${d.seq}`).join('|')
}

export interface ResolveError {
  code: string
  rule: string
  target: string
  message: string
}

export type ResolveResult =
  | { ok: true; result: ResolvedProps }
  | { ok: false; error: ResolveError }

export function resolveElement(
  state: ProjectState,
  elementId: ElementId,
  memo?: ResolverMemo
): ResolveResult {
  const element = state.nodes.get(elementId)
  if (!element) {
    return { ok: false, error: { code: 'DECISION_TARGET_UNKNOWN', rule: 'element-exists', target: elementId, message: `Element ${elementId} not found` } }
  }

  const applicable = applicableDecisions(state, element)
  const fingerprint = fingerprintOf(applicable)

  if (memo) {
    const cached = memo.elementCache.get(elementId)
    if (cached && cached.rev === element.rev && cached.fingerprint === fingerprint) {
      return { ok: true, result: cached.result }
    }
  }

  // Component default = the element's own props
  const props: Record<string, unknown> = { ...element.props }

  // Collect every property touched by applicable decisions
  const decisionProps = new Set<string>()
  for (const d of applicable) decisionProps.add(d.property)

  const provenance: Map<string, DecisionId> = new Map()
  for (const prop of decisionProps) {
    const cands = applicable.filter((d) => d.property === prop)
    cands.sort((a, b) => {
      const ra = SCOPE_RANK[a.scope.kind]
      const rb = SCOPE_RANK[b.scope.kind]
      if (rb !== ra) return rb - ra
      if (b.seq !== a.seq) return b.seq - a.seq
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    })
    const winner = cands[0]!
    props[prop] = winner.value
    provenance.set(prop, winner.id)
  }

  const result: ResolvedProps = { props, provenance }
  if (memo) {
    memo.elementCache.set(elementId, { rev: element.rev, fingerprint, result })
  }
  return { ok: true, result }
}

export function resolveBatch(
  state: ProjectState,
  elementIds: ElementId[],
  memo?: ResolverMemo
): Map<ElementId, ResolveResult> {
  const out = new Map<ElementId, ResolveResult>()
  for (const id of elementIds) {
    out.set(id, resolveElement(state, id, memo))
  }
  return out
}

export interface DependencyIndex {
  decisionToElements: Map<DecisionId, Set<ElementId>>
  elementToDecisions: Map<ElementId, DecisionId[]>
}

export function buildDependencyIndex(state: ProjectState): DependencyIndex {
  const decisionToElements = new Map<DecisionId, Set<ElementId>>()
  const elementToDecisions = new Map<ElementId, DecisionId[]>()

  for (const [id] of state.nodes) {
    elementToDecisions.set(id, [])
  }

  for (const dec of state.decisions.values()) {
    if (dec.status !== 'approved') continue
    const matched: ElementId[] = []
    for (const [id, node] of state.nodes) {
      if (appliesTo(dec, node)) {
        matched.push(id)
        const existing = elementToDecisions.get(id) ?? []
        existing.push(dec.id)
        elementToDecisions.set(id, existing)
      }
    }
    decisionToElements.set(dec.id, new Set(matched))
  }
  return { decisionToElements, elementToDecisions }
}

function appliesTo(dec: DesignDecision, node: DesignElement): boolean {
  if (dec.status !== 'approved') return false
  if (dec.scope.kind === 'instance') return dec.scope.elementId === node.id
  if (dec.scope.kind === 'page') return dec.scope.pageId === node.pageId && dec.scope.targetType === node.kind
  return dec.scope.targetType === node.kind
}
