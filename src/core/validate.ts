import type { NodeKind } from './elements'
import { propsSchemas } from './elements'
import { ID_PATTERN, type ElementId } from './ids'
import { bounds, type ProjectState } from './state'
import { decisionZeroMatchReport } from './decisions'
import { validatePageSpec } from './specs'
import { getSlotDef, validateSlotValue } from './intake-schema'

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

  // Intake slot store invariants
  if (state.seenTurnIds.length > bounds.maxSeenTurnIds) {
    violations.push({
      rule: 'turn-id-count-exceeded',
      target: 'seenTurnIds',
      message: `Seen turn IDs exceed bound ${bounds.maxSeenTurnIds}`
    })
  }
  if (state.turnRecords.length > bounds.maxTurnRecords) {
    violations.push({
      rule: 'turn-record-count-exceeded',
      target: 'turnRecords',
      message: `Turn records exceed bound ${bounds.maxTurnRecords}`
    })
  }
  for (const rec of state.turnRecords) {
    if (rec.userText.length > 2000) {
      violations.push({
        rule: 'turn-record-text-too-long',
        target: rec.turnId,
        message: `Turn record userText exceeds 2000 chars`
      })
      break
    }
  }
  for (const [slotKey, slot] of state.intake) {
    const def = getSlotDef(slotKey)
    if (!def) {
      violations.push({
        rule: 'unknown-intake-slot',
        target: slotKey,
        message: `Unknown intake slot '${slotKey}'`
      })
      continue
    }
    // An unanswered slot (value === undefined) is legitimate; only validate
    // once a value has been committed.
    if (slot.value !== undefined) {
      const parsed = validateSlotValue(def, slot.value)
      if (!parsed.ok) {
        violations.push({
          rule: 'intake-slot-value',
          target: slotKey,
          message: parsed.message
        })
      }
    }
    if (slot.confidence < 0 || slot.confidence > 1 || !Number.isFinite(slot.confidence)) {
      violations.push({
        rule: 'intake-confidence',
        target: slotKey,
        message: `Intake confidence for '${slotKey}' must be between 0 and 1`
      })
    }
    if (slot.asked > 2) {
      violations.push({
        rule: 'intake-asked-exceeded',
        target: slotKey,
        message: `Slot '${slotKey}' asked more than twice`
      })
    }
    if (slot.superseded.length > 3) {
      violations.push({
        rule: 'intake-superseded-exceeded',
        target: slotKey,
        message: `Slot '${slotKey}' keeps more than three superseded values`
      })
    }
  }

  // ── Intake v4 invariants ────────────────────────────────────────────

  // Project-level facts bound.
  if (state.facts.size > bounds.maxFacts) {
    violations.push({
      rule: 'fact-count-exceeded',
      target: 'facts',
      message: `Project-level facts exceed bound ${bounds.maxFacts}`
    })
  }

  // Validate each IntakeFact field.
  for (const [factId, fact] of state.facts) {
    if (fact.question.length < 1 || fact.question.length > 280) {
      violations.push({
        rule: 'fact-question-too-long',
        target: factId,
        message: `Fact question must be 1..280 chars`
      })
    }
    if (fact.answer.length < 1 || fact.answer.length > bounds.maxFactAnswer) {
      violations.push({
        rule: 'fact-answer-too-long',
        target: factId,
        message: `Fact answer must be 1..${bounds.maxFactAnswer} chars`
      })
    }
    if (fact.confidence < 0 || fact.confidence > 1 || !Number.isFinite(fact.confidence)) {
      violations.push({
        rule: 'fact-confidence',
        target: factId,
        message: `Fact confidence must be between 0 and 1`
      })
    }
    if (fact.superseded.length > 3) {
      violations.push({
        rule: 'fact-superseded-exceeded',
        target: factId,
        message: `Fact '${factId}' keeps more than three superseded values`
      })
    }
    // Evidence must be 'user' (UI edit) or an exact substring of the turn text.
    if (fact.evidence !== 'user') {
      const turn = state.turnRecords.find((r) => r.turnId === fact.turnId)
      const turnText = turn ? turn.userText : ''
      if (!turnText.includes(fact.evidence)) {
        violations.push({
          rule: 'fact-evidence',
          target: factId,
          message: `Fact evidence is not an exact substring of the user turn`
        })
      }
    }
  }

  // Per-page intake validation.
  for (const [pageId, pageIntake] of state.pageIntake) {
    if (!state.pages.has(pageId)) {
      violations.push({
        rule: 'page-intake-dangling-page',
        target: pageId,
        message: `Page intake references missing page ${pageId}`
      })
      continue
    }
    if (pageIntake.facts.size > bounds.maxFacts) {
      violations.push({
        rule: 'page-fact-count-exceeded',
        target: pageId,
        message: `Page intake facts for ${pageId} exceed bound ${bounds.maxFacts}`
      })
    }
    for (const [factId, fact] of pageIntake.facts) {
      if (fact.question.length < 1 || fact.question.length > 280) {
        violations.push({
          rule: 'page-fact-question-too-long',
          target: factId,
          message: `Fact question must be 1..280 chars`
        })
      }
      if (fact.answer.length < 1 || fact.answer.length > bounds.maxFactAnswer) {
        violations.push({
          rule: 'page-fact-answer-too-long',
          target: factId,
          message: `Fact answer must be 1..${bounds.maxFactAnswer} chars`
        })
      }
      if (fact.confidence < 0 || fact.confidence > 1 || !Number.isFinite(fact.confidence)) {
        violations.push({
          rule: 'page-fact-confidence',
          target: factId,
          message: `Fact confidence must be between 0 and 1`
        })
      }
      if (fact.superseded.length > 3) {
        violations.push({
          rule: 'page-fact-superseded-exceeded',
          target: factId,
          message: `Fact '${factId}' keeps more than three superseded values`
        })
      }
      if (fact.evidence !== 'user') {
        const turn = state.turnRecords.find((r) => r.turnId === fact.turnId)
        const turnText = turn ? turn.userText : ''
        if (!turnText.includes(fact.evidence)) {
          violations.push({
            rule: 'page-fact-evidence',
            target: factId,
            message: `Fact evidence is not an exact substring of the user turn`
          })
        }
      }
    }
  }

  // intakeStatus.pages keys must reference existing pages.
  for (const [pageId] of state.intakeStatus.pages) {
    if (!state.pages.has(pageId)) {
      violations.push({
        rule: 'intake-status-dangling-page',
        target: pageId,
        message: `Intake status references missing page ${pageId}`
      })
    }
  }

  // intakeRev and nextFactSeq must be finite and non-negative.
  if (!Number.isFinite(state.intakeRev) || state.intakeRev < 0) {
    violations.push({
      rule: 'intake-rev-invalid',
      target: 'intakeRev',
      message: `Intake rev must be a finite non-negative number`
    })
  }
  if (!Number.isFinite(state.nextFactSeq) || state.nextFactSeq < 0) {
    violations.push({
      rule: 'next-fact-seq-invalid',
      target: 'nextFactSeq',
      message: `Next fact seq must be a finite non-negative number`
    })
  }

  // Page spec stale detection: basedOnIntakeRev must not exceed intakeRev.
  for (const [pageId, spec] of state.pageSpecs) {
    if (spec.basedOnIntakeRev > state.intakeRev) {
      violations.push({
        rule: 'spec-stale',
        target: pageId,
        message: `Page spec for ${pageId} is based on intake rev ${spec.basedOnIntakeRev}, current is ${state.intakeRev}`
      })
    }
    // Status must be a valid value (Zod enforces this, but double-check).
    if (spec.status !== 'draft' && spec.status !== 'approved') {
      violations.push({
        rule: 'spec-status-invalid',
        target: pageId,
        message: `Page spec for ${pageId} has invalid status '${spec.status}'`
      })
    }
  }

  return violations
}
