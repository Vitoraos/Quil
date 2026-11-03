import type { NodeKind } from './elements'
import { propsSchemas } from './elements'
import { ID_PATTERN, type ElementId } from './ids'
import { bounds, type ProjectState } from './state'
import { decisionZeroMatchReport } from './decisions'
import { validatePageSpec } from './specs'

export interface InvariantViolation {
  rule: string
  target: string
  message: string
}

export function validateProject(state: ProjectState): InvariantViolation[] {
  const violations: InvariantViolation[] = []

  if (state.name.length > bounds.maxNameLength) {
    violations.push({ rule: 'name-length', target: 'project', message: 'Project name exceeds bound' })
  }

  if (state.brief.length > bounds.maxBriefLength) {
    violations.push({ rule: 'brief-length', target: 'brief', message: 'Brief exceeds bound' })
  }

  if (state.pages.size > bounds.maxPages) {
    violations.push({ rule: 'page-count-exceeded', target: 'pages', message: 'Page count exceeds bound' })
  }

  // Page specs must reference existing pages and be structurally valid
  for (const [pageId, spec] of state.pageSpecs) {
    if (!state.pages.has(pageId)) {
      violations.push({ rule: 'dangling-spec-page', target: pageId, message: `Page spec references missing page ${pageId}` })
      continue
    }
    const specErrors = validatePageSpec(spec)
    for (const err of specErrors) {
      violations.push({ rule: 'spec-invalid', target: pageId, message: err })
    }
    // Trace elementIds, if assigned, must exist and belong to the page
    for (const el of spec.sections.flatMap((s) => s.elements)) {
      if (el.elementId) {
        const en = state.nodes.get(el.elementId)
        if (!en || en.pageId !== pageId) {
          violations.push({ rule: 'dangling-spec-element', target: el.elementId, message: `Spec element elementId missing or wrong page` })
        }
      }
    }
  }

  if (state.decisions.size > bounds.maxDecisions) {
    violations.push({ rule: 'decision-count-exceeded', target: 'decisions', message: 'Decision count exceeds bound' })
  }

  // ID format on all nodes
  for (const [id, node] of state.nodes) {
    if (!ID_PATTERN.test(id) || id !== node.id) {
      violations.push({ rule: 'id-format', target: id, message: `Node id '${id}' is malformed` })
    }
  }

  // Reachability and tree consistency
  const visited = new Set<ElementId>()
  for (const [pageId, page] of state.pages) {
    let pageCount = 0
    const stack: ElementId[] = [...page.sectionIds]
    const pageVisited = new Set<ElementId>()

    for (const sectionId of page.sectionIds) {
      const secNode = state.nodes.get(sectionId)
      if (!secNode) {
        violations.push({ rule: 'dangling-section', target: sectionId, message: `Page references missing section ${sectionId}` })
        continue
      }
      if (secNode.parentId !== null) {
        violations.push({ rule: 'root-parent-non-null', target: sectionId, message: `Section ${sectionId} must have null parentId` })
      }
      if (secNode.kind !== 'section') {
        violations.push({ rule: 'root-kind', target: sectionId, message: `Page root ${sectionId} must have kind 'section'` })
      }
    }

    while (stack.length > 0) {
      const curId = stack.pop()!
      if (pageVisited.has(curId)) {
        violations.push({ rule: 'cycle', target: curId, message: `Cycle detected via page reachability at ${curId}` })
        continue
      }
      pageVisited.add(curId)
      visited.add(curId)
      pageCount++

      const node = state.nodes.get(curId)
      if (!node) continue

      if (node.pageId !== pageId) {
        violations.push({ rule: 'page-mismatch', target: curId, message: `Node pageId does not match owning page` })
      }

      for (const childId of node.childIds) {
        const childNode = state.nodes.get(childId)
        if (!childNode) {
          violations.push({ rule: 'dangling-child', target: childId, message: `Node ${curId} references missing child ${childId}` })
          continue
        }
        if (childNode.parentId !== curId) {
          violations.push({ rule: 'tree-consistency', target: childId, message: `Child ${childId} points to parent ${childNode.parentId}, expected ${curId}` })
        }
        stack.push(childId)
      }
    }

    if (pageCount > bounds.maxNodesPerPage) {
      violations.push({
        rule: 'node-count-exceeded',
        target: pageId,
        message: `Page ${pageId} has ${pageCount} elements, exceeds bound ${bounds.maxNodesPerPage}`
      })
    }
  }

  // Check orphans (nodes not reached from any page root)
  for (const id of state.nodes.keys()) {
    if (!visited.has(id)) {
      violations.push({ rule: 'orphan-node', target: id, message: `Node ${id} is not reachable from any page` })
    }
  }

  // Depth checks and cycle detection per node
  for (const [id, node] of state.nodes) {
    let cur = node.parentId
    let steps = 0
    const ancestors = new Set<ElementId>([id])

    while (cur !== null) {
      if (ancestors.has(cur)) {
        violations.push({ rule: 'cycle', target: id, message: `Cycle detected in ancestry of ${id}` })
        break
      }
      ancestors.add(cur)
      steps++
      if (steps > bounds.maxDepth) {
        violations.push({ rule: 'tree-depth', target: id, message: `Depth of ${id} exceeds max depth ${bounds.maxDepth}` })
        break
      }
      const pNode = state.nodes.get(cur)
      if (!pNode) {
        violations.push({ rule: 'dangling-parent', target: id, message: `Parent ${cur} does not exist` })
        break
      }
      cur = pNode.parentId
    }

    // Props schema validation
    const schema = propsSchemas[node.kind as NodeKind]
    if (!schema) {
      violations.push({ rule: 'unknown-kind', target: id, message: `Node has unknown kind ${node.kind}` })
    } else {
      const parsed = schema.safeParse(node.props)
      if (!parsed.success) {
        violations.push({
          rule: 'props-schema',
          target: id,
          message: parsed.error.issues[0]?.message ?? 'Invalid props'
        })
      }
    }

    // Asset reference check
    if (node.kind === 'image') {
      const assetId = (node.props as { assetId?: string }).assetId
      if (assetId && !state.assets.has(assetId as never)) {
        violations.push({ rule: 'dangling-asset', target: id, message: `Image references missing asset ${assetId}` })
      }
    }
  }

  // Decisions validation
  const seqs = new Set<number>()
  for (const [decId, dec] of state.decisions) {
    if (seqs.has(dec.seq)) {
      violations.push({ rule: 'decision-seq-duplicate', target: decId, message: `Duplicate decision seq ${dec.seq}` })
    }
    seqs.add(dec.seq)

    if (dec.scope.kind === 'instance') {
      const targetExists = state.nodes.has(dec.scope.elementId)
      if (!targetExists && dec.status !== 'orphaned') {
        violations.push({
          rule: 'dangling-decision',
          target: decId,
          message: `Instance decision targets deleted element ${dec.scope.elementId} without being marked orphaned`
        })
      }
    } else if (dec.scope.kind === 'page') {
      if (!state.pages.has(dec.scope.pageId)) {
        violations.push({
          rule: 'dangling-decision',
          target: decId,
          message: `Page decision targets missing page ${dec.scope.pageId}`
        })
      }
    }
  }

  // Approved decisions that match zero elements are inert (handled, not silent)
  const { zeroMatchIds } = decisionZeroMatchReport(state)
  for (const zeroId of zeroMatchIds) {
    violations.push({
      rule: 'decision-zero-match',
      target: zeroId,
      message: `Approved decision ${zeroId} matches no element`
    })
  }

  return violations
}
