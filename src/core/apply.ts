import { applyPatches, enableMapSet, enablePatches, produce, produceWithPatches, type Draft, type Patch } from 'immer'
import type {
  AddElementCommand,
  AddPageCommand,
  AddSectionCommand,
  ApplyCandidateCommand,
  ApplyIntakeUpdateCommand,
  ApprovePageSpecCommand,
  BatchCommand,
  CommandError,
  ConfirmIntakeCommand,
  EditIntakeFactCommand,
  EditPageSpecCommand,
  InstantiateSpecSkeletonCommand,
  LeafCommand,
  MoveElementCommand,
  RemoveElementCommand,
  RemovePageCommand,
  RenamePageCommand,
  SetBriefCommand,
  SetIntakeAnswerCommand,
  SetIntakeSlotCommand,
  SetPageSpecCommand,
  SetPropertyCommand,
  SetStartingPageCommand,
  UndoCommand
} from './commands'
import { designCommandSchema } from './commands'
import { applySpecOps } from './spec-ops'
import { validatePageSpec, type PageSpec } from './specs'
import { propsSchemas, type NodeKind } from './elements'
import type { AssetId, CommandId, DecisionId, ElementId, FactId, PageId } from './ids'
import { bounds, type DesignElement, type DecisionScope, type FactTopic, type IntakeFact, type IntakeScope, type Page, type ProjectState, factTopics } from './state'
import type { SpecElement, SpecSection } from './specs'
import { upsertDecision } from './decisions'
import { buildGenerationContext, targetDefs, validateCandidate, type TargetType } from './generation'
import { validateProject } from './validate'
import {
  canContinue,
  emptySlotValue,
  slotDefsFor,
  type AskedQuestion,
  validateSlotValue,
  type SlotValue
} from './intake-schema'

enableMapSet()
enablePatches()

let invariantCheckingEnabled = true
export function setInvariantChecking(enabled: boolean): void {
  invariantCheckingEnabled = enabled
}
export function isInvariantCheckingEnabled(): boolean {
  return invariantCheckingEnabled
}

export type ApplyResult =
  | {
      ok: true
      state: ProjectState
      patches: Patch[]
      inversePatches: Patch[]
      changedIds: ElementId[]
    }
  | {
      ok: false
      error: CommandError
    }

class DomainError extends Error {
  constructor(public readonly error: CommandError) {
    super(error.message)
    this.name = 'DomainError'
  }
}

function fail(code: CommandError['code'], rule: string, target: string, message: string): never {
  throw new DomainError({ code, rule, target, message })
}

function idsFromPatches(patches: Patch[]): ElementId[] {
  const ids = new Set<ElementId>()
  for (const p of patches) {
    if (p.path[0] === 'nodes' && typeof p.path[1] === 'string') {
      ids.add(p.path[1] as ElementId)
    }
  }
  return [...ids]
}

function pushBounded<T>(arr: T[], item: T, max: number): void {
  arr.push(item)
  if (arr.length > max) {
    arr.shift()
  }
}

function applySetPropertyIn(draft: Draft<ProjectState>, cmd: SetPropertyCommand): ElementId[] {
  const node = draft.nodes.get(cmd.targetId)
  if (!node) {
    fail('TARGET_MISSING', 'element-exists', cmd.targetId, `Target element ${cmd.targetId} not found`)
  }

  const schema = propsSchemas[node.kind as NodeKind]
  if (!schema || !('shape' in schema)) {
    fail('PROPERTY_UNKNOWN', 'property-allowlist', `${cmd.targetId}.${cmd.property}`, `Kind ${node.kind} has no schema`)
  }

  const shape = (schema as { shape: Record<string, { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: { issues: { message: string }[] } } }> }).shape
  if (!Object.prototype.hasOwnProperty.call(shape, cmd.property)) {
    fail('PROPERTY_UNKNOWN', 'property-allowlist', `${cmd.targetId}.${cmd.property}`, `Property ${cmd.property} is not allowed for ${node.kind}`)
  }

  const fieldSchema = shape[cmd.property]
  if (!fieldSchema) {
    fail('PROPERTY_UNKNOWN', 'property-allowlist', `${cmd.targetId}.${cmd.property}`, `Property ${cmd.property} schema not found`)
  }

  const parsed = fieldSchema.safeParse(cmd.value)
  if (!parsed.success) {
    fail(
      'PROPERTY_INVALID',
      'property-value',
      `${cmd.targetId}.${cmd.property}`,
      parsed.error?.issues[0]?.message ?? `Invalid value for ${cmd.property}`
    )
  }

  // Scoped edit: create/update a decision instead of patching base props directly.
  if (cmd.scope) {
    upsertDecision(draft, cmd.scope, cmd.property, parsed.data, node.kind)
    return [cmd.targetId]
  }

  node.props[cmd.property] = parsed.data
  return [cmd.targetId]
}

function applyAddElementIn(draft: Draft<ProjectState>, cmd: AddElementCommand): ElementId[] {
  if (draft.nodes.has(cmd.elementId)) {
    fail('DUPLICATE_ID', 'unique-id', cmd.elementId, `Element id ${cmd.elementId} already exists`)
  }

  const parent = draft.nodes.get(cmd.parentId)
  if (!parent) {
    fail('PARENT_MISSING', 'parent-exists', cmd.parentId, `Parent element ${cmd.parentId} does not exist`)
  }

  const leafKinds: NodeKind[] = ['heading', 'text', 'image', 'button', 'navigation', 'form']
  if (leafKinds.includes(parent.kind)) {
    fail('PARENT_LEAF', 'container-kind', cmd.parentId, `Parent ${cmd.parentId} of kind ${parent.kind} cannot have children`)
  }

  const schema = propsSchemas[cmd.kind as NodeKind]
  if (!schema) {
    fail('PROPERTY_INVALID', 'kind-valid', cmd.elementId, `Unknown element kind ${cmd.kind}`)
  }

  const parsedProps = schema.safeParse(cmd.props)
  if (!parsedProps.success) {
    fail(
      'PROPERTY_INVALID',
      'props-schema',
      cmd.elementId,
      parsedProps.error.issues[0]?.message ?? 'Invalid element props'
    )
  }

  const newElement: DesignElement = {
    id: cmd.elementId,
    kind: cmd.kind,
    pageId: parent.pageId,
    parentId: cmd.parentId,
    childIds: [],
    rev: 0,
    props: parsedProps.data as Record<string, unknown>
  }

  draft.nodes.set(cmd.elementId, newElement)
  parent.childIds.push(cmd.elementId)

  return [cmd.elementId, cmd.parentId]
}

function applyAddSectionIn(draft: Draft<ProjectState>, cmd: AddSectionCommand): ElementId[] {
  const page = draft.pages.get(cmd.pageId)
  if (!page) {
    fail('TARGET_MISSING', 'page-exists', cmd.pageId, `Page ${cmd.pageId} not found`)
  }
  if (draft.nodes.has(cmd.sectionId)) {
    fail('DUPLICATE_ID', 'unique-id', cmd.sectionId, `Element id ${cmd.sectionId} already exists`)
  }

  const parsedProps = propsSchemas.section.safeParse(cmd.props)
  if (!parsedProps.success) {
    fail(
      'PROPERTY_INVALID',
      'props-schema',
      cmd.sectionId,
      parsedProps.error.issues[0]?.message ?? 'Invalid section props'
    )
  }

  const section: DesignElement = {
    id: cmd.sectionId,
    kind: 'section',
    pageId: cmd.pageId,
    parentId: null,
    childIds: [],
    rev: 0,
    props: parsedProps.data as Record<string, unknown>
  }

  draft.nodes.set(cmd.sectionId, section)
  page.sectionIds.push(cmd.sectionId)

  return [cmd.sectionId]
}

function collectDescendants(nodes: Map<ElementId, DesignElement> | Draft<Map<ElementId, DesignElement>>, rootId: ElementId): ElementId[] {
  const result: ElementId[] = []
  const stack = [rootId]
  while (stack.length > 0) {
    const curId = stack.pop()!
    result.push(curId)
    const node = nodes.get(curId)
    if (node) {
      for (const c of node.childIds) stack.push(c)
    }
  }
  return result
}

function applyRemoveElementIn(draft: Draft<ProjectState>, cmd: RemoveElementCommand): ElementId[] {
  const node = draft.nodes.get(cmd.elementId)
  if (!node) {
    fail('TARGET_MISSING', 'element-exists', cmd.elementId, `Element ${cmd.elementId} not found`)
  }

  const toRemove = collectDescendants(draft.nodes, cmd.elementId)
  const removedSet = new Set(toRemove)

  if (node.parentId !== null) {
    const parent = draft.nodes.get(node.parentId)
    if (parent) {
      parent.childIds = parent.childIds.filter((cid) => cid !== cmd.elementId)
    }
  } else {
    const page = draft.pages.get(node.pageId)
    if (page) {
      page.sectionIds = page.sectionIds.filter((sid) => sid !== cmd.elementId)
    }
  }

  for (const id of toRemove) {
    draft.nodes.delete(id)
  }

  // Orphan policy: mark instance decisions targeting deleted elements as orphaned
  for (const dec of draft.decisions.values()) {
    if (dec.scope.kind === 'instance' && removedSet.has(dec.scope.elementId)) {
      dec.status = 'orphaned'
    }
  }

  return node.parentId ? [...toRemove, node.parentId] : toRemove
}

function applyMoveElementIn(draft: Draft<ProjectState>, cmd: MoveElementCommand): ElementId[] {
  const node = draft.nodes.get(cmd.elementId)
  if (!node) {
    fail('TARGET_MISSING', 'element-exists', cmd.elementId, `Element ${cmd.elementId} not found`)
  }

  if (cmd.newParentId === null) {
    if (node.kind !== 'section') {
      fail('CYCLE', 'section-root', cmd.elementId, 'Only sections can be top-level')
    }
    const page = draft.pages.get(node.pageId)
    if (!page) {
      fail('TARGET_MISSING', 'page-exists', node.pageId, 'Page not found')
    }
    if (node.parentId !== null) {
      const oldParent = draft.nodes.get(node.parentId)
      if (oldParent) oldParent.childIds = oldParent.childIds.filter((cid) => cid !== cmd.elementId)
      node.parentId = null
    }
    const idx = cmd.index ?? page.sectionIds.length
    const boundedIdx = Math.max(0, Math.min(idx, page.sectionIds.length))
    page.sectionIds = page.sectionIds.filter((sid) => sid !== cmd.elementId)
    page.sectionIds.splice(boundedIdx, 0, cmd.elementId)
    return [cmd.elementId]
  }

  const newParent = draft.nodes.get(cmd.newParentId)
  if (!newParent) {
    fail('PARENT_MISSING', 'parent-exists', cmd.newParentId, `New parent ${cmd.newParentId} not found`)
  }

  if (newParent.pageId !== node.pageId) {
    fail('CROSS_PAGE_MOVE', 'same-page', cmd.elementId, 'Cannot move elements across pages in Phase 1')
  }

  const leafKinds: NodeKind[] = ['heading', 'text', 'image', 'button', 'navigation', 'form']
  if (leafKinds.includes(newParent.kind)) {
    fail('PARENT_LEAF', 'container-kind', cmd.newParentId, `New parent ${cmd.newParentId} cannot have children`)
  }

  // Cycle check: newParent cannot be in subtree of elementId
  const descendants = new Set(collectDescendants(draft.nodes, cmd.elementId))
  if (descendants.has(cmd.newParentId)) {
    fail('CYCLE', 'acyclic-tree', cmd.elementId, `Cannot move ${cmd.elementId} into its own descendant ${cmd.newParentId}`)
  }

  // Detach from old parent
  const oldParentId = node.parentId
  if (oldParentId !== null) {
    const oldParent = draft.nodes.get(oldParentId)
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((cid) => cid !== cmd.elementId)
    }
  } else {
    const page = draft.pages.get(node.pageId)
    if (page) {
      page.sectionIds = page.sectionIds.filter((sid) => sid !== cmd.elementId)
    }
  }

  node.parentId = cmd.newParentId
  const idx = cmd.index ?? newParent.childIds.length
  const boundedIdx = Math.max(0, Math.min(idx, newParent.childIds.length))
  newParent.childIds.splice(boundedIdx, 0, cmd.elementId)

  return oldParentId ? [cmd.elementId, oldParentId, cmd.newParentId] : [cmd.elementId, cmd.newParentId]
}

function applySetBriefIn(draft: Draft<ProjectState>, cmd: SetBriefCommand): ElementId[] {
  if (cmd.brief.length > bounds.maxBriefLength) {
    fail('BOUNDS_EXCEEDED', 'brief-length', 'brief', `Brief exceeds ${bounds.maxBriefLength} characters`)
  }
  draft.brief = cmd.brief
  return []
}

function applySetIntakeAnswerIn(draft: Draft<ProjectState>, cmd: SetIntakeAnswerCommand): ElementId[] {
  if (draft.intakeAnswers.size >= bounds.maxIntakeAnswers && !draft.intakeAnswers.has(cmd.questionId)) {
    fail('BOUNDS_EXCEEDED', 'intake-answers', 'intakeAnswers', `Too many intake answers (max ${bounds.maxIntakeAnswers})`)
  }
  draft.intakeAnswers.set(cmd.questionId, cmd.answer)
  return []
}

function applyApplyIntakeUpdateIn(draft: Draft<ProjectState>, cmd: ApplyIntakeUpdateCommand): ElementId[] {
  // Idempotent on turnId: replaying the same turn leaves state unchanged.
  if (draft.seenTurnIds.includes(cmd.turnId)) {
    return []
  }

  const scope: IntakeScope = cmd.scope ?? { kind: 'project' }
  const defs = slotDefsFor(scope)

  // Helper: resolve the slot store for the given scope, creating a page
  // intake entry lazily when needed.
  const slotStore = (): Map<string, SlotValue> => {
    if (scope.kind === 'page') {
      let pi = draft.pageIntake.get(scope.pageId)
      if (!pi) {
        pi = { slots: new Map(), facts: new Map() }
        draft.pageIntake.set(scope.pageId, pi)
      }
      return pi.slots
    }
    return draft.intake
  }

  // Helper: resolve the fact store for the given scope.
  const factStore = (): Map<FactId, IntakeFact> => {
    if (scope.kind === 'page') {
      let pi = draft.pageIntake.get(scope.pageId)
      if (!pi) {
        pi = { slots: new Map(), facts: new Map() }
        draft.pageIntake.set(scope.pageId, pi)
      }
      return pi.facts
    }
    return draft.facts
  }

  // Validate and apply slot updates.
  for (const update of cmd.updates) {
    const def = defs[update.slot]
    if (!def) {
      fail(
        'PROPERTY_UNKNOWN',
        'slot-allowlist',
        update.slot,
        `Unknown intake slot '${update.slot}' for scope ${scope.kind}`
      )
    }

    const parsed = validateSlotValue(def, update.value)
    if (!parsed.ok) {
      fail('PROPERTY_INVALID', 'slot-value', update.slot, parsed.message)
    }

    const slots = slotStore()
    const existing = slots.get(update.slot) ?? emptySlotValue()
    const next: SlotValue = {
      value: parsed.data,
      basis: update.basis,
      confidence: update.confidence,
      evidence: update.evidence,
      turnId: cmd.turnId,
      asked: existing.asked,
      superseded: [...existing.superseded]
    }

    // Never silently overwrite a stated value: keep up to three superseded.
    if (existing.basis === 'stated' && update.basis === 'stated' && existing.value !== undefined) {
      pushBounded(next.superseded, existing, 3)
    }

    slots.set(update.slot, next)
  }

  // Validate and apply facts (max 6 per turn, already bounded by schema).
  const factsToApply = cmd.facts ?? []
  for (const fact of factsToApply) {
    if (!factTopics.includes(fact.topic as FactTopic)) {
      fail('PROPERTY_INVALID', 'fact-topic', fact.id, `Unknown fact topic '${fact.topic}'`)
    }
    if (fact.question.length < 1 || fact.question.length > 280) {
      fail('PROPERTY_INVALID', 'fact-question', fact.id, 'Fact question must be 1..280 chars')
    }
    if (fact.answer.length < 1 || fact.answer.length > bounds.maxFactAnswer) {
      fail('PROPERTY_INVALID', 'fact-answer', fact.id, `Fact answer must be 1..${bounds.maxFactAnswer} chars`)
    }
    if (fact.confidence < 0 || fact.confidence > 1 || !Number.isFinite(fact.confidence)) {
      fail('PROPERTY_INVALID', 'fact-confidence', fact.id, 'Fact confidence must be 0..1')
    }
    if (fact.evidence !== 'user' && cmd.userText && !cmd.userText.includes(fact.evidence)) {
      fail('PROPERTY_INVALID', 'fact-evidence', fact.id, 'Fact evidence must be an exact substring of the user turn')
    }
    if (fact.superseded.length > 3) {
      fail('BOUNDS_EXCEEDED', 'fact-superseded', fact.id, 'Fact superseded history exceeds 3')
    }

    const facts = factStore()
    const existing = facts.get(fact.id)
    const next: IntakeFact = {
      id: fact.id,
      topic: fact.topic as FactTopic,
      question: fact.question,
      answer: fact.answer,
      basis: fact.basis,
      confidence: fact.confidence,
      evidence: fact.evidence,
      turnId: fact.turnId,
      superseded: [...(existing?.superseded ?? [])]
    }

    // Never silently overwrite a stated value: keep up to three superseded.
    if (existing && existing.basis === 'stated' && fact.basis === 'stated' && existing.answer !== undefined) {
      pushBounded(next.superseded, { answer: existing.answer, basis: existing.basis, turnId: existing.turnId }, 3)
    }

    facts.set(fact.id, next)
  }

  // Reject if total facts would exceed maxFacts.
  if (factStore().size > bounds.maxFacts) {
    fail('BOUNDS_EXCEEDED', 'fact-count', 'facts', `Too many facts (max ${bounds.maxFacts})`)
  }

  // Increment asked counts for slots the orchestrator just asked about.
  const slots = slotStore()
  for (const slotKey of cmd.askedSlots) {
    const slot = slots.get(slotKey)
    if (slot) {
      slot.asked = Math.min(slot.asked + 1, 2)
    } else {
      slots.set(slotKey, { ...emptySlotValue(), asked: 1 })
    }
  }

  pushBounded(draft.seenTurnIds, cmd.turnId, bounds.maxSeenTurnIds)

  draft.intakeRev = draft.intakeRev + 1

  // Record the turn for memory/history (Part 4.4). Keep at most 50.
  // A turn is recorded even when updates and facts are empty, so user text
  // is never lost.
  const turnScope: 'project' | PageId = scope.kind === 'project' ? 'project' : scope.pageId
  draft.turnRecords = pushBoundedArray(draft.turnRecords, {
    turnId: cmd.turnId,
    askedSlots: [...cmd.askedSlots],
    userText: cmd.userText,
    scope: turnScope,
    asked: (cmd.asked ?? undefined) as AskedQuestion | undefined,
    acceptedUpdates: cmd.updates.map((u) => ({
      slot: u.slot,
      value: u.value,
      basis: u.basis,
      confidence: u.confidence,
      evidence: u.evidence
    }))
  }, bounds.maxTurnRecords)

  return []
}

function applySetIntakeSlotIn(draft: Draft<ProjectState>, cmd: SetIntakeSlotCommand): ElementId[] {
  const scope: IntakeScope = cmd.scope
  const defs = slotDefsFor(scope)
  const def = defs[cmd.slot]
  if (!def) {
    fail('PROPERTY_UNKNOWN', 'slot-allowlist', cmd.slot, `Unknown intake slot '${cmd.slot}' for scope ${scope.kind}`)
  }

  const parsed = validateSlotValue(def, cmd.value)
  if (!parsed.ok) {
    fail('PROPERTY_INVALID', 'slot-value', cmd.slot, parsed.message)
  }

  const slots = ((): Map<string, SlotValue> => {
    if (scope.kind === 'page') {
      let pi = draft.pageIntake.get(scope.pageId)
      if (!pi) {
        pi = { slots: new Map(), facts: new Map() }
        draft.pageIntake.set(scope.pageId, pi)
      }
      return pi.slots
    }
    return draft.intake
  })()

  const existing = slots.get(cmd.slot) ?? emptySlotValue()
  const next: SlotValue = {
    value: parsed.data,
    basis: 'stated',
    confidence: 1,
    evidence: 'user',
    turnId: null,
    asked: existing.asked,
    superseded: [...existing.superseded]
  }

  // Never silently overwrite a stated value: keep up to three superseded.
  if (existing.basis === 'stated' && existing.value !== undefined) {
    pushBounded(next.superseded, existing, 3)
  }

  slots.set(cmd.slot, next)
  draft.intakeRev = draft.intakeRev + 1
  return []
}

function applyEditIntakeFactIn(draft: Draft<ProjectState>, cmd: EditIntakeFactCommand): ElementId[] {
  const scope: IntakeScope = cmd.scope

  // null answer deletes the fact.
  if (cmd.answer === null) {
    const facts = ((): Map<FactId, IntakeFact> => {
      if (scope.kind === 'page') {
        const pi = draft.pageIntake.get(scope.pageId)
        return pi ? pi.facts : new Map()
      }
      return draft.facts
    })()
    if (!facts.has(cmd.factId)) {
      fail('TARGET_MISSING', 'fact-exists', cmd.factId, `Fact ${cmd.factId} not found`)
    }
    facts.delete(cmd.factId)
    draft.intakeRev = draft.intakeRev + 1
    return []
  }

  // Validate the new answer.
  if (cmd.answer.length < 1 || cmd.answer.length > bounds.maxFactAnswer) {
    fail('PROPERTY_INVALID', 'fact-answer', cmd.factId, `Fact answer must be 1..${bounds.maxFactAnswer} chars`)
  }

  const facts = ((): Map<FactId, IntakeFact> => {
    if (scope.kind === 'page') {
      let pi = draft.pageIntake.get(scope.pageId)
      if (!pi) {
        pi = { slots: new Map(), facts: new Map() }
        draft.pageIntake.set(scope.pageId, pi)
      }
      return pi.facts
    }
    return draft.facts
  })()

  const existing = facts.get(cmd.factId)
  const next: IntakeFact = {
    id: cmd.factId,
    topic: existing?.topic ?? 'product',
    question: existing?.question ?? 'Edited fact',
    answer: cmd.answer,
    basis: 'stated',
    confidence: existing?.confidence ?? 1,
    evidence: 'user',
    turnId: null,
    superseded: [...(existing?.superseded ?? [])]
  }

  // Edited facts become stated; keep prior stated value as superseded.
  if (existing && existing.basis === 'stated' && existing.answer !== undefined) {
    pushBounded(next.superseded, { answer: existing.answer, basis: existing.basis, turnId: existing.turnId }, 3)
  }

  facts.set(cmd.factId, next)
  draft.intakeRev = draft.intakeRev + 1
  return []
}

function applyConfirmIntakeIn(draft: Draft<ProjectState>, cmd: ConfirmIntakeCommand): ElementId[] {
  const scope: IntakeScope = cmd.scope

  if (scope.kind === 'project') {
    // Idempotent: already confirmed.
    if (draft.intakeStatus.project === 'confirmed') {
      return []
    }
    if (!canContinue(draft, scope)) {
      fail(
        'INVALID_COMMAND',
        'precondition',
        'intake',
        'Cannot confirm project intake: purpose must be stated and pages must have at least one entry'
      )
    }
    draft.intakeStatus.project = 'confirmed'
  } else {
    const pageStatus = draft.intakeStatus.pages.get(scope.pageId)
    if (pageStatus === 'confirmed') {
      return []
    }
    if (!canContinue(draft, scope)) {
      fail(
        'INVALID_COMMAND',
        'precondition',
        'intake',
        'Cannot confirm page intake: purpose must be stated'
      )
    }
    draft.intakeStatus.pages.set(scope.pageId, 'confirmed')
  }

  draft.intakeRev = draft.intakeRev + 1
  return []
}

function applyEditPageSpecIn(draft: Draft<ProjectState>, cmd: EditPageSpecCommand): ElementId[] {
  const page = draft.pages.get(cmd.pageId)
  if (!page) {
    fail('TARGET_MISSING', 'page-exists', cmd.pageId, `Page ${cmd.pageId} not found`)
  }

  const existingSpec = draft.pageSpecs.get(cmd.pageId)
  if (!existingSpec) {
    fail('TARGET_MISSING', 'spec-missing', cmd.pageId, `No page spec for ${cmd.pageId}`)
  }

  // STALE_SPEC: baseSpecVersion must match current spec version.
  if (existingSpec.version !== cmd.baseSpecVersion) {
    fail(
      'STALE_SPEC',
      'spec-version',
      cmd.pageId,
      `Spec baseSpecVersion ${cmd.baseSpecVersion} does not match current version ${existingSpec.version}`
    )
  }

  // Apply ops atomically.
  const result = applySpecOps(existingSpec, cmd.ops)
  if (!result.ok) {
    fail(
      'SPEC_OP_FAILED',
      'spec-op',
      `opIndex:${result.error.opIndex}`,
      result.error.message
    )
  }

  // If the page has a skeleton, check whether removing sections/elements
  // would orphan approved instance decisions. If so and confirmOrphans is
  // not true, fail with CONFLICT_NEEDS_CONFIRMATION listing the decision ids.
  const removedElementIds: ElementId[] = []
  for (const op of cmd.ops) {
    if (op.op === 'remove_section') {
      const section = existingSpec.sections.find((s) => s.key === op.key)
      if (section) {
        for (const el of section.elements) {
          if (el.elementId) removedElementIds.push(el.elementId)
        }
      }
    } else if (op.op === 'remove_element') {
      const section = existingSpec.sections.find((s) => s.key === op.sectionKey)
      const el = section?.elements.find((e) => e.key === op.key)
      if (el?.elementId) removedElementIds.push(el.elementId)
    }
  }

  if (removedElementIds.length > 0) {
    const orphanedDecisionIds: DecisionId[] = []
    for (const [id, dec] of draft.decisions) {
      if (
        dec.scope.kind === 'instance' &&
        removedElementIds.includes(dec.scope.elementId) &&
        dec.status === 'approved'
      ) {
        orphanedDecisionIds.push(id)
      }
    }
    if (orphanedDecisionIds.length > 0 && !cmd.confirmOrphans) {
      fail(
        'CONFLICT_NEEDS_CONFIRMATION',
        'spec-conflict',
        cmd.pageId,
        `Edit would orphan approved decisions: ${orphanedDecisionIds.join(', ')}`
      )
    }
  }

  const nextSpec: PageSpec = {
    ...(result.spec as PageSpec),
    pageId: cmd.pageId,
    version: existingSpec.version + 1,
    status: existingSpec.status,
    basedOnIntakeRev: existingSpec.basedOnIntakeRev ?? 0
  }
  draft.pageSpecs.set(cmd.pageId, nextSpec)
  draft.intakeRev = draft.intakeRev + 1
  return [cmd.pageId as unknown as ElementId]
}

function applyApprovePageSpecIn(draft: Draft<ProjectState>, cmd: ApprovePageSpecCommand): ElementId[] {
  const existingSpec = draft.pageSpecs.get(cmd.pageId)

  // Idempotent: already approved at this version.
  if (existingSpec?.status === 'approved' && existingSpec.version === cmd.baseSpecVersion) {
    return []
  }

  const page = draft.pages.get(cmd.pageId)
  if (!page) {
    fail('TARGET_MISSING', 'page-exists', cmd.pageId, `Page ${cmd.pageId} not found`)
  }

  if (!existingSpec) {
    fail('TARGET_MISSING', 'spec-missing', cmd.pageId, `No page spec for ${cmd.pageId}`)
  }

  // STALE_SPEC: baseSpecVersion must match current spec version.
  if (existingSpec.version !== cmd.baseSpecVersion) {
    fail(
      'STALE_SPEC',
      'spec-version',
      cmd.pageId,
      `Spec baseSpecVersion ${cmd.baseSpecVersion} does not match current version ${existingSpec.version}`
    )
  }

  // Structural validation (hard errors).
  const errors = validatePageSpec(existingSpec)
  if (errors.length > 0) {
    fail('PROPERTY_INVALID', 'spec-validation', cmd.pageId, errors.join('; '))
  }

  const nextSpec: PageSpec = {
    ...existingSpec,
    status: 'approved',
    version: existingSpec.version + 1
  }
  draft.pageSpecs.set(cmd.pageId, nextSpec)
  draft.intakeRev = draft.intakeRev + 1

  // Reconcile skeleton: instantiate only missing nodes, never reset existing.
  applyInstantiateSpecSkeletonIn(draft, {
    type: 'instantiate_spec_skeleton',
    commandId: cmd.commandId,
    baseRev: draft.rev,
    pageId: cmd.pageId
  })

  return [cmd.pageId as unknown as ElementId]
}

function applyInstantiateSpecSkeletonIn(draft: Draft<ProjectState>, cmd: InstantiateSpecSkeletonCommand): ElementId[] {
  const page = draft.pages.get(cmd.pageId)
  if (!page) {
    fail('TARGET_MISSING', 'page-exists', cmd.pageId, `Page ${cmd.pageId} not found`)
  }

  const spec = draft.pageSpecs.get(cmd.pageId)
  if (!spec) {
    fail('TARGET_MISSING', 'spec-missing', cmd.pageId, `No page spec for ${cmd.pageId}`)
  }

  const created: ElementId[] = []

  for (const section of spec.sections) {
    // Assign deterministic section id.
    const sectionElementId = `sec-${spec.pageId}-${section.key}` as ElementId

    // Idempotent reconcile: only create if missing. Never reset existing
    // props or children on a second run.
    let sectionNode = draft.nodes.get(sectionElementId)
    if (!sectionNode) {
      sectionNode = {
        id: sectionElementId,
        kind: 'section',
        pageId: cmd.pageId,
        parentId: null,
        childIds: [],
        rev: 0,
        props: { bgColor: '#ECECE8', padding: { value: 24 } }
      }
      draft.nodes.set(sectionElementId, sectionNode)
      if (!page.sectionIds.includes(sectionElementId)) {
        page.sectionIds.push(sectionElementId)
      }
      created.push(sectionElementId)
    }

    for (const element of section.elements) {
      // Reuse existing elementId from spec trace if present and node exists,
      // otherwise assign a deterministic id.
      let elementId: ElementId
      if (element.elementId && draft.nodes.has(element.elementId)) {
        elementId = element.elementId
      } else {
        elementId = `el-${spec.pageId}-${section.key}-${element.key}` as ElementId
        let suffix = 2
        while (draft.nodes.has(elementId)) {
          elementId = `el-${spec.pageId}-${section.key}-${element.key}-${suffix}` as ElementId
          suffix += 1
        }
      }

      let elementNode = draft.nodes.get(elementId)
      if (!elementNode) {
        const props = defaultSkeletonProps(element.kind, element.purpose)

        // For images, create a placeholder asset.
        if (element.kind === 'image') {
          const assetId = `asset-${spec.pageId}-${element.key}` as AssetId
          draft.assets.set(assetId, {
            id: assetId,
            kind: 'image',
            width: 800,
            height: 600,
            alt: element.purpose
          })
          props.assetId = assetId
        }

        elementNode = {
          id: elementId,
          kind: element.kind,
          pageId: cmd.pageId,
          parentId: sectionElementId,
          childIds: [],
          rev: 0,
          props
        }
        draft.nodes.set(elementId, elementNode)
        created.push(elementId)
      }

      // Ensure the element is a child of its section (idempotent).
      if (!sectionNode.childIds.includes(elementId)) {
        sectionNode.childIds.push(elementId)
      }

      // Record elementId into the spec trace.
      const specEl = spec.sections.find((s) => s.key === section.key)?.elements.find((e) => e.key === element.key)
      if (specEl && specEl.elementId !== elementId) {
        specEl.elementId = elementId
      }
    }
  }

  return created
}

function applyApplyCandidateIn(draft: Draft<ProjectState>, cmd: ApplyCandidateCommand): ElementId[] {
  const node = draft.nodes.get(cmd.targetId)
  if (!node) {
    fail('TARGET_MISSING', 'element-exists', cmd.targetId, `Candidate target ${cmd.targetId} not found`)
  }

  // Re-validate against the ComponentDef at apply time: the command is untrusted.
  const def = targetDefs[cmd.componentDefId]
  if (!def) {
    fail('CANDIDATE_INVALID', 'candidate-def', cmd.candidateId, `Unknown component definition '${cmd.componentDefId}'`)
  }
  if (def.kind !== node.kind) {
    fail(
      'CANDIDATE_INVALID',
      'candidate-def',
      cmd.candidateId,
      `Definition '${def.id}' targets ${def.kind}, but ${cmd.targetId} is ${node.kind}`
    )
  }

  const contextResult = buildGenerationContext(draft as unknown as ProjectState, cmd.targetId, cmd.componentDefId as TargetType)
  if (!contextResult.ok) {
    fail('CANDIDATE_INVALID', 'candidate-context', cmd.candidateId, contextResult.error.message)
  }

  const validation = validateCandidate(contextResult.context, {
    candidateId: cmd.candidateId,
    componentDefId: cmd.componentDefId,
    targetId: cmd.targetId,
    props: Object.fromEntries(cmd.patches.map((p) => [p.property, p.value]))
  })
  if (!validation.ok) {
    fail('CANDIDATE_INVALID', 'candidate-validation', cmd.candidateId, validation.errors.join('; '))
  }

  // An approval is a decision: record it at the command's scope (default
  // instance). Section targets stay instance-only.
  const scope: DecisionScope = cmd.scope ?? { kind: 'instance', elementId: cmd.targetId }
  for (const patch of cmd.patches) {
    applySetPropertyIn(draft, {
      type: 'set_property',
      commandId: cmd.commandId,
      baseRev: cmd.baseRev,
      targetId: cmd.targetId,
      property: patch.property,
      value: patch.value,
      scope
    })
  }

  pushBounded(draft.seenCandidateIds, cmd.candidateId, bounds.maxSeenIds)
  return [cmd.targetId]
}

function pushBoundedArray<T>(arr: T[], item: T, max: number): T[] {
  const next = [...arr]
  next.push(item)
  if (next.length > max) {
    next.shift()
  }
  return next
}

function applyAddPageIn(draft: Draft<ProjectState>, cmd: AddPageCommand): ElementId[] {
  if (draft.pages.size >= bounds.maxPages) {
    fail('BOUNDS_EXCEEDED', 'page-count', 'pages', `Too many pages (max ${bounds.maxPages})`)
  }
  if (draft.pages.has(cmd.pageId)) {
    fail('DUPLICATE_ID', 'page-id', cmd.pageId, `Page id ${cmd.pageId} already exists`)
  }
  const page: Page = { id: cmd.pageId, name: cmd.name, sectionIds: [] }
  draft.pages.set(cmd.pageId, page)
  return [cmd.pageId as unknown as ElementId]
}

function applyRemovePageIn(draft: Draft<ProjectState>, cmd: RemovePageCommand): ElementId[] {
  const page = draft.pages.get(cmd.pageId)
  if (!page) {
    fail('TARGET_MISSING', 'page-exists', cmd.pageId, `Page ${cmd.pageId} not found`)
  }

  // Remove all elements in sections of this page
  const removed: ElementId[] = []
  for (const sectionId of page.sectionIds) {
    const toRemove = collectDescendants(draft.nodes, sectionId)
    for (const id of toRemove) {
      draft.nodes.delete(id)
      removed.push(id)
    }
  }
  removed.push(...page.sectionIds)

  draft.pages.delete(cmd.pageId)

  // Remove page spec if any
  draft.pageSpecs.delete(cmd.pageId)

  // Mark instance decisions targeting deleted elements as orphaned
  const removedSet = new Set(removed)
  for (const dec of draft.decisions.values()) {
    if (dec.scope.kind === 'instance' && removedSet.has(dec.scope.elementId)) {
      dec.status = 'orphaned'
    }
  }

  // Clear starting page if it was removed
  if (draft.startingPageId === cmd.pageId) {
    draft.startingPageId = null
  }

  return removed
}

function applyRenamePageIn(draft: Draft<ProjectState>, cmd: RenamePageCommand): ElementId[] {
  const page = draft.pages.get(cmd.pageId)
  if (!page) {
    fail('TARGET_MISSING', 'page-exists', cmd.pageId, `Page ${cmd.pageId} not found`)
  }
  page.name = cmd.name
  return [cmd.pageId as unknown as ElementId]
}

function applySetStartingPageIn(draft: Draft<ProjectState>, cmd: SetStartingPageCommand): ElementId[] {
  if (!draft.pages.has(cmd.pageId)) {
    fail('TARGET_MISSING', 'page-exists', cmd.pageId, `Page ${cmd.pageId} not found`)
  }
  draft.startingPageId = cmd.pageId
  return []
}

function applySetPageSpecIn(draft: Draft<ProjectState>, cmd: SetPageSpecCommand): ElementId[] {
  const page = draft.pages.get(cmd.pageId)
  if (!page) {
    fail('TARGET_MISSING', 'page-exists', cmd.pageId, `Page ${cmd.pageId} not found`)
  }

  const validationErrors = validatePageSpec(cmd.spec)
  if (validationErrors.length > 0) {
    fail('PROPERTY_INVALID', 'spec-validation', cmd.pageId, validationErrors.join('; '))
  }

  // Carry over elementIds from the existing spec for keys that still exist,
  // so regeneration never orphans decisions targeting existing elements.
  const existingSpec = draft.pageSpecs.get(cmd.pageId)
  const carriedElementIds = new Map<string, ElementId>()
  if (existingSpec) {
    for (const section of existingSpec.sections) {
      for (const el of section.elements) {
        if (el.elementId) carriedElementIds.set(el.key, el.elementId)
      }
    }
  }

  const newSections: SpecSection[] = []
  for (const section of cmd.spec.sections) {
    const newElements: SpecElement[] = []
    for (const el of section.elements) {
      newElements.push({ ...el, elementId: carriedElementIds.get(el.key) ?? undefined })
    }
    newSections.push({ ...section, elements: newElements })
  }

  // Allowed only while the existing spec (if any) is draft; for approved specs
  // use edit_page_spec.
  if (existingSpec && existingSpec.status === 'approved') {
    fail('INVALID_COMMAND', 'spec-approved', cmd.pageId, `Spec for ${cmd.pageId} is already approved; use edit_page_spec`)
  }

  draft.pageSpecs.set(cmd.pageId, {
    pageId: cmd.pageId,
    name: cmd.spec.name,
    purpose: cmd.spec.purpose,
    version: (existingSpec?.version ?? 0) + 1,
    status: 'draft',
    basedOnIntakeRev: draft.intakeRev,
    sections: newSections
  })
  return [cmd.pageId as unknown as ElementId]
}

function defaultSkeletonProps(kind: NodeKind, purpose: string): Record<string, unknown> {
  switch (kind) {
    case 'heading': return { text: purpose, level: 2 }
    case 'text': return { text: purpose }
    case 'button': return { label: purpose, bgColor: '#7C3AED', textColor: '#F5F3EC' }
    case 'card': return { bgColor: '#141418', radius: 10, padding: { value: 24 }, shadow: 'shadow-1' }
    case 'navigation': return { items: [], bgColor: '#141418' }
    case 'form': return { submitLabel: purpose, fields: [] }
    case 'image':
      return { alt: purpose, fit: 'cover' } // assetId filled by caller if available
    default:
      return { text: purpose }
  }
}

function applyLeaf(draft: Draft<ProjectState>, cmd: LeafCommand): ElementId[] {
  switch (cmd.type) {
    case 'set_property':
      return applySetPropertyIn(draft, cmd)
    case 'add_element':
      return applyAddElementIn(draft, cmd)
    case 'add_section':
      return applyAddSectionIn(draft, cmd)
    case 'remove_element':
      return applyRemoveElementIn(draft, cmd)
    case 'move_element':
      return applyMoveElementIn(draft, cmd)
    case 'apply_candidate':
      return applyApplyCandidateIn(draft, cmd)
    case 'set_brief':
      return applySetBriefIn(draft, cmd)
    case 'set_intake_answer':
      return applySetIntakeAnswerIn(draft, cmd)
    case 'apply_intake_update':
      return applyApplyIntakeUpdateIn(draft, cmd)
    case 'set_intake_slot':
      return applySetIntakeSlotIn(draft, cmd)
    case 'edit_intake_fact':
      return applyEditIntakeFactIn(draft, cmd)
    case 'confirm_intake':
      return applyConfirmIntakeIn(draft, cmd)
    case 'add_page':
      return applyAddPageIn(draft, cmd)
    case 'remove_page':
      return applyRemovePageIn(draft, cmd)
    case 'rename_page':
      return applyRenamePageIn(draft, cmd)
    case 'set_starting_page':
      return applySetStartingPageIn(draft, cmd)
    case 'set_page_spec':
      return applySetPageSpecIn(draft, cmd)
    case 'edit_page_spec':
      return applyEditPageSpecIn(draft, cmd)
    case 'approve_page_spec':
      return applyApprovePageSpecIn(draft, cmd)
    case 'instantiate_spec_skeleton':
      return applyInstantiateSpecSkeletonIn(draft, cmd)
    case 'undo':
    case 'redo':
      return []
    default:
      return fail(
        'INVALID_COMMAND',
        'unhandled-command',
        (cmd as { type: string }).type,
        `No reducer registered for command type '${(cmd as { type: string }).type}'`
      )
  }
}

export function applyCommand(state: ProjectState, command: unknown): ApplyResult {
  const parsed = designCommandSchema.safeParse(command)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message ?? 'Invalid command schema'
    return {
      ok: false,
      error: { code: 'INVALID_COMMAND', rule: 'schema', target: 'command', message: firstIssue }
    }
  }

  const cmd = parsed.data

  // Idempotency: replaying a seen commandId returns state unchanged with empty patches
  if (state.seenCommandIds.includes(cmd.commandId)) {
    return { ok: true, state, patches: [], inversePatches: [], changedIds: [] }
  }

  if (cmd.type === 'undo') {
    return applyUndo(state, cmd)
  }

  if (cmd.type === 'redo') {
    return applyRedo(state, cmd)
  }

  if (cmd.type === 'batch') {
    return applyBatch(state, cmd)
  }

  // Apply candidate idempotency by candidateId (checked before baseRev so replays are idempotent)
  if (cmd.type === 'apply_candidate' && state.seenCandidateIds.includes(cmd.candidateId)) {
    return { ok: true, state, patches: [], inversePatches: [], changedIds: [] }
  }

  // Base rev check
  if ('baseRev' in cmd && cmd.baseRev !== state.rev) {
    return {
      ok: false,
      error: {
        code: 'STALE_BASE',
        rule: 'concurrency',
        target: 'state.rev',
        message: `Command baseRev ${cmd.baseRev} does not match current state rev ${state.rev}`
      }
    }
  }

  try {
    const [nextDoc, patches, inversePatches] = produceWithPatches(state, (draft) => {
      applyLeaf(draft, cmd)
    })

    if (invariantCheckingEnabled) {
      const violations = validateProject(nextDoc)
      if (violations.length > 0) {
        const v = violations[0]!
        return {
          ok: false,
          error: {
            code: 'INVARIANT_VIOLATION',
            rule: v.rule,
            target: v.target,
            message: v.message
          }
        }
      }
    }

    const changedIds = idsFromPatches(patches)

    // Bookkeeping pass
    const finalState = produce(nextDoc, (d) => {
      d.rev = state.rev + 1
      pushBounded(d.seenCommandIds, cmd.commandId, bounds.maxSeenIds)
      d.redoStack.length = 0 // new normal command clears redo

      // No-op commands (empty patches) don't create history entries
      if (patches.length === 0) {
        for (const id of changedIds) {
          const n = d.nodes.get(id)
          if (n) n.rev++
        }
        return
      }

      // Coalescing: consecutive set_property on same element & property in one gesture merge
      const gestureKey =
        cmd.type === 'set_property' && cmd.gestureId
          ? `${cmd.targetId}:${cmd.property}:${cmd.gestureId}`
          : undefined

      const lastUndo = d.undoStack[d.undoStack.length - 1]
      if (gestureKey && lastUndo?.gestureKey === gestureKey) {
        lastUndo.forwardPatches.push(...patches)
      } else {
        d.undoStack.push({
          commandId: cmd.commandId,
          inversePatches,
          forwardPatches: patches,
          gestureKey
        })
        if (d.undoStack.length > bounds.maxHistory) {
          d.undoStack.shift()
        }
      }

      for (const id of changedIds) {
        const n = d.nodes.get(id)
        if (n) n.rev++
      }
    })

    return { ok: true, state: finalState, patches, inversePatches, changedIds }
  } catch (err) {
    if (err instanceof DomainError) {
      return { ok: false, error: err.error }
    }
    throw err
  }
}

function applyBatch(state: ProjectState, cmd: BatchCommand): ApplyResult {
  try {
    const [nextDoc, patches, inversePatches] = produceWithPatches(state, (draft) => {
      for (const sub of cmd.commands) {
        if ('baseRev' in sub && sub.baseRev !== state.rev) {
          fail('STALE_BASE', 'concurrency', 'state.rev', `Batch subcommand baseRev ${sub.baseRev} != ${state.rev}`)
        }
        applyLeaf(draft, sub)
      }
    })

    if (invariantCheckingEnabled) {
      const violations = validateProject(nextDoc)
      if (violations.length > 0) {
        const v = violations[0]!
        return {
          ok: false,
          error: { code: 'INVARIANT_VIOLATION', rule: v.rule, target: v.target, message: v.message }
        }
      }
    }

    const changedIds = idsFromPatches(patches)

    const finalState = produce(nextDoc, (d) => {
      d.rev = state.rev + 1
      pushBounded(d.seenCommandIds, cmd.commandId, bounds.maxSeenIds)
      d.redoStack.length = 0

      d.undoStack.push({
        commandId: cmd.commandId,
        inversePatches,
        forwardPatches: patches
      })
      if (d.undoStack.length > bounds.maxHistory) {
        d.undoStack.shift()
      }

      for (const id of changedIds) {
        const n = d.nodes.get(id)
        if (n) n.rev++
      }
    })

    return { ok: true, state: finalState, patches, inversePatches, changedIds }
  } catch (err) {
    if (err instanceof DomainError) {
      return {
        ok: false,
        error: {
          code: 'BATCH_FAILED',
          rule: 'atomic-batch',
          target: 'batch',
          message: `Batch failed: ${err.error.message}`
        }
      }
    }
    throw err
  }
}

function applyUndo(state: ProjectState, cmd: UndoCommand): ApplyResult {
  const entry = state.undoStack[state.undoStack.length - 1]
  if (!entry) {
    return {
      ok: false,
      error: { code: 'EMPTY_HISTORY', rule: 'history', target: 'undoStack', message: 'No commands to undo' }
    }
  }

  // Apply inverse patches to document directly (applyPatches works on plain state)
  const nextDoc = applyPatches(state, entry.inversePatches)

  if (invariantCheckingEnabled) {
    const violations = validateProject(nextDoc)
    if (violations.length > 0) {
      const v = violations[0]!
      return {
        ok: false,
        error: { code: 'INVARIANT_VIOLATION', rule: v.rule, target: v.target, message: v.message }
      }
    }
  }

  const changedIds = idsFromPatches(entry.inversePatches)

  const finalState = produce(nextDoc, (d) => {
    d.rev = state.rev + 1
    pushBounded(d.seenCommandIds, cmd.commandId, bounds.maxSeenIds)
    const popped = d.undoStack.pop()!
    d.redoStack.push(popped)
    for (const id of changedIds) {
      const n = d.nodes.get(id)
      if (n) n.rev++
    }
  })

  return {
    ok: true,
    state: finalState,
    patches: entry.inversePatches,
    inversePatches: entry.forwardPatches,
    changedIds
  }
}

function applyRedo(state: ProjectState, cmd: { commandId: CommandId }): ApplyResult {
  const entry = state.redoStack[state.redoStack.length - 1]
  if (!entry) {
    return {
      ok: false,
      error: { code: 'EMPTY_REDO', rule: 'history', target: 'redoStack', message: 'No commands to redo' }
    }
  }

  // Apply forward patches to document directly
  const nextDoc = applyPatches(state, entry.forwardPatches)

  if (invariantCheckingEnabled) {
    const violations = validateProject(nextDoc)
    if (violations.length > 0) {
      const v = violations[0]!
      return {
        ok: false,
        error: { code: 'INVARIANT_VIOLATION', rule: v.rule, target: v.target, message: v.message }
      }
    }
  }

  const changedIds = idsFromPatches(entry.forwardPatches)

  const finalState = produce(nextDoc, (d) => {
    d.rev = state.rev + 1
    pushBounded(d.seenCommandIds, cmd.commandId, bounds.maxSeenIds)
    const popped = d.redoStack.pop()!
    d.undoStack.push(popped)
    for (const id of changedIds) {
      const n = d.nodes.get(id)
      if (n) n.rev++
    }
  })

  return {
    ok: true,
    state: finalState,
    patches: entry.forwardPatches,
    inversePatches: entry.inversePatches,
    changedIds
  }
}
